if (typeof libc_addr === 'undefined') {
  try { include('userland.js'); } catch (e) { log('userland include failed: ' + (e.message || e)); }
}
if (typeof lang === 'undefined') {
  try { include('languages.js'); } catch (e) { log('languages include failed: ' + (e.message || e)); }
}
(function () {
  'use strict';
  log('Loading File Explorer (PS4-first, viewer-enabled, hardened)...');
  // --- syscall registration (best-effort)
  try { fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint'); } catch (e) {}
  try { fn.register(0x06, 'close_sys', ['bigint'], 'bigint'); } catch (e) {}
  try { fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint'); } catch (e) {}
  try { fn.register(0x03, 'read_sys', ['bigint', 'bigint', 'bigint'], 'bigint'); } catch (e) {}
  // --- helpers
  function strToAddr(s) {
    var addr = mem.malloc((s ? s.length : 0) + 1);
    if (!addr) return null;
    for (var i = 0; i < (s ? s.length : 0); i++) mem.view(addr).setUint8(i, s.charCodeAt(i));
    mem.view(addr).setUint8((s ? s.length : 0), 0);
    return addr;
  }
  function extOf(name) {
    if (!name) return '';
    var idx = name.lastIndexOf('.');
    if (idx < 0) return '';
    return name.substring(idx + 1).toLowerCase();
  }
  function safeBigIntToNumber(bi) {
    try {
      if (bi === null || typeof bi === 'undefined') return 0;
      if (typeof bi === 'number') return bi;
      if (typeof bi === 'object' && bi.lo !== undefined) return bi.lo;
      if (typeof bi === 'bigint') return Number(bi);
      return Number(bi);
    } catch (e) { return 0; }
  }
  // --- state
  var startPath = '/';
  var currentPath = startPath;
  var pathStack = [startPath];
  var entries = [];
  var filteredEntries = [];
  var sortMode = 'alpha';
  var searchQuery = '';
  var currentButton = 0;
  var buttons = [];
  var buttonTexts = [];
  var buttonIcons = [];
  var buttonMarkers = [];
  var buttonOrigPos = [];
  var textOrigPos = [];
  var createdElements = [];
  var buttonsPerRow = 5;
  var buttonWidth = 300;
  var buttonHeight = 80;
  var startX = 130;
  var startY = 220;
  var xSpacing = 340;
  var ySpacing = 90;
  var cursor, virtualMouse = { x: 960, y: 540 }, cursorSize = { w: 28, h: 28 };
  // modal / viewer
  var modal = null;
  var modalOverlay = null;
  var modalHeader = null;
  var modalCloseBtn = null;
  var modalCloseText = null;
  var modalContentText = null;
  var modalImage = null;
  var modalVideo = null;
  var modalAudio = null;
  var modalControls = null;
  var modalJsScrollOffset = 0; // for JS viewer scrolling
  // BGM (integrated into this script)
  var bgm = null;
  try {
    if (typeof global !== 'undefined' && global.__explorerBgm && global.__explorerBgm._valid) {
      bgm = global.__explorerBgm;
    } else if (typeof window !== 'undefined' && window.__explorerBgm && window.__explorerBgm._valid) {
      bgm = window.__explorerBgm;
    } else {
      bgm = new jsmaf.AudioClip();
      try { bgm.open('file:///../download0/sfx/explorer_bgm.wav'); } catch (e) {}
      try { bgm.loop = true; } catch (e) {}
      bgm._valid = true;
      bgm._isPlaying = false;
      if (typeof global !== 'undefined') global.__explorerBgm = bgm;
      else if (typeof window !== 'undefined') window.__explorerBgm = bgm;
    }
  } catch (e) { log('bgm init error: ' + (e.message || e)); bgm = null; }
  var _bgmFadeInterval = null;
  // intervals
  var _intervals = [];
  function _setInterval(fn, ms) { var id = jsmaf.setInterval(fn, ms); _intervals.push(id); return id; }
  function _clearAllIntervals() { for (var i = 0; i < _intervals.length; i++) try { jsmaf.clearInterval(_intervals[i]); } catch (e) {} } _intervals = [];
  // timeouts tracking (new)
  var _timeouts = [];
  function _setTimeout(fn, ms) {
    try {
      var id = jsmaf.setTimeout(fn, ms);
      _timeouts.push(id);
      return id;
    } catch (e) { return null; }
  }
  function _clearAllTimeouts() {
    for (var i = 0; i < _timeouts.length; i++) try { jsmaf.clearTimeout(_timeouts[i]); } catch (e) {}
    _timeouts = [];
  }
  // created visuals tracker
  function pushCreated(el) { if (!el) return; createdElements.push(el); }
  function hideCreated() { for (var i = 0; i < createdElements.length; i++) { try { createdElements[i].visible = false; } catch (e) {} } }
  function showCreated() { for (var i = 0; i < createdElements.length; i++) { try { createdElements[i].visible = true; } catch (e) {} } }
  function clearCreated() { createdElements = []; }
  // --- visuals
  try { jsmaf.root.children.length = 0; } catch (e) {}
  // larger styles for readability
  new Style({ name: 'white', color: 'white', size: 28 });
  new Style({ name: 'title', color: 'white', size: 40 });
  new Style({ name: 'small', color: 'white', size: 22 });
  var background = new Image({ url: 'file:///../download0/img/multiview_bg_VAF.png', x: 0, y: 0, width: 1920, height: 1080 });
  background.alpha = 0; background._baseX = background.x; jsmaf.root.children.push(background);
  var logo = new Image({ url: 'file:///../download0/img/logo.png', x: 1620, y: 0, width: 300, height: 169 });
  logo.alpha = 0; logo.scaleX = 0.98; logo.scaleY = 0.98; jsmaf.root.children.push(logo);
  var titleText;
  if (typeof useImageText !== 'undefined' && useImageText) {
    try {
      var titleImg = new Image({ url: (typeof textImageBase !== 'undefined' ? textImageBase : '') + 'explorer.png', x: 760, y: 80, width: 420, height: 84 });
      titleImg.alpha = 0; jsmaf.root.children.push(titleImg);
    } catch (e) {}
  } else {
    titleText = new jsmaf.Text();
    titleText.text = (typeof lang !== 'undefined' ? (lang.fileExplorer || 'File Explorer') : 'File Explorer');
    titleText.x = 760; titleText.y = 80; titleText.style = 'title'; titleText.alpha = 0;
    jsmaf.root.children.push(titleText);
  }
  // controls: search placeholder and sort/breadcrumb
  var searchBox = new Image({ url: 'file:///../download0/img/button_over_9.png', x: 130, y: 140, width: 420, height: 56 });
  searchBox.alpha = 0.95; jsmaf.root.children.push(searchBox);
  var searchText = new jsmaf.Text(); searchText.text = 'Search: (Triangle to clear)'; searchText.x = 140; searchText.y = 152; searchText.style = 'white'; jsmaf.root.children.push(searchText);
  var sortText = new jsmaf.Text(); sortText.text = 'Sort: ' + sortMode; sortText.x = 580; sortText.y = 152; sortText.style = 'white'; jsmaf.root.children.push(sortText);
  var breadcrumbText = new jsmaf.Text(); breadcrumbText.text = currentPath; breadcrumbText.x = 130; breadcrumbText.y = 190; breadcrumbText.style = 'small'; jsmaf.root.children.push(breadcrumbText);
  // modal overlay and container (bigger)
  modalOverlay = new Image({ url: 'file:///assets/img/modal_overlay.png', x: 0, y: 0, width: 1920, height: 1080 });
  try { modalOverlay.alpha = 0.55; } catch (e) { modalOverlay.alpha = 0.7; }
  modalOverlay.visible = false; jsmaf.root.children.push(modalOverlay);
  modal = new Image({ url: 'file:///assets/img/panel_bg.png', x: 120, y: 60, width: 1680, height: 960 });
  modal.visible = false; jsmaf.root.children.push(modal);
  modalHeader = new jsmaf.Text(); modalHeader.text = ''; modalHeader.x = 200; modalHeader.y = 90; modalHeader.style = 'title'; modalHeader.alpha = 0; jsmaf.root.children.push(modalHeader);
  modalCloseBtn = new Image({ url: 'file:///../download0/img/button_over_9.png', x: 1600, y: 100, width: 120, height: 46 });
  modalCloseBtn.visible = false; jsmaf.root.children.push(modalCloseBtn);
  modalCloseText = new jsmaf.Text(); modalCloseText.text = 'Close'; modalCloseText.x = 1630; modalCloseText.y = 110; modalCloseText.style = 'white'; modalCloseText.visible = false; jsmaf.root.children.push(modalCloseText);
  modalContentText = new jsmaf.Text(); modalContentText.text = ''; modalContentText.x = 200; modalContentText.y = 160; modalContentText.style = 'small'; modalContentText.alpha = 0; modalContentText.wrap = true; jsmaf.root.children.push(modalContentText);
  modalImage = new Image({ url: '', x: 240, y: 200, width: 1440, height: 720 });
  modalImage.visible = false; jsmaf.root.children.push(modalImage);
  modalControls = new jsmaf.Text(); modalControls.text = ''; modalControls.x = 240; modalControls.y = 940; modalControls.style = 'white'; modalControls.alpha = 0; jsmaf.root.children.push(modalControls);
  // cursor
  cursor = new Image({ url: 'file:///../download0/img/cursor.png', x: virtualMouse.x - cursorSize.w/2, y: virtualMouse.y - cursorSize.h/2, width: cursorSize.w, height: cursorSize.h });
  cursor.visible = false; jsmaf.root.children.push(cursor);
  // --- animation helpers
  var _markerPulseInterval = null;
  var _logoAnimInterval = null;
  // *** NEW: button idle animation interval variable (only addition) ***
  var _buttonIdleInterval = null;
  function easeInOut(t) { return (1 - Math.cos(t * Math.PI)) / 2; }
  function animate(obj, from, to, duration, onStep, done) {
    var elapsed = 0, step = 16;
    var id = _setInterval(function () {
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var e = easeInOut(t);
      for (var k in to) {
        try {
          var f = (from && from[k] !== undefined) ? from[k] : (obj[k] !== undefined ? obj[k] : 0);
          obj[k] = f + (to[k] - f) * e;
        } catch (ex) {}
      }
      if (onStep) onStep(e);
      if (t >= 1) {
        try { jsmaf.clearInterval(id); } catch (ex) {}
        if (done) done();
      }
    }, step);
    return id;
  }
  function startOrangeDotLoop() {
    if (_markerPulseInterval) try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {}
    var phase = 0;
    _markerPulseInterval = jsmaf.setInterval(function () {
      phase += 0.06;
      for (var i = 0; i < buttonMarkers.length; i++) {
        var m = buttonMarkers[i];
        if (!m) continue;
        if (m.isOrangeDot) {
          if (m.visible) {
            var a = 0.6 + Math.sin(phase) * 0.35;
            m.alpha = Math.max(0.25, Math.min(a, 1.0));
            m.scaleX = 1 + Math.sin(phase * 1.2) * 0.06;
            m.scaleY = m.scaleX;
          } else {
            m.alpha = 0; m.scaleX = 1; m.scaleY = 1;
          }
        }
      }
    }, 16);
    _intervals.push(_markerPulseInterval);
  }
  function startLogoLoop() {
    var phase = 0;
    if (_logoAnimInterval) try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}
    _logoAnimInterval = jsmaf.setInterval(function () {
      phase += 0.02;
      try { logo.y = Math.sin(phase) * 6; logo.scaleX = 0.99 + Math.sin(phase * 0.9) * 0.01; logo.scaleY = logo.scaleX; } catch (e) {}
      try { if (background) background.x = background._baseX + Math.sin(phase * 0.4) * 6; } catch (e) {}
    }, 16);
    _intervals.push(_logoAnimInterval);
  }
  // --- BGM fade helpers
  function fadeOutBgm(duration, done) {
    if (!bgm) { if (done) done(); return; }
    if (_bgmFadeInterval) try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}
    var elapsed = 0; var step = 50; var dur = duration || 600;
    _bgmFadeInterval = jsmaf.setInterval(function () {
      elapsed += step; var t = Math.min(elapsed / dur, 1);
      try { bgm.volume = Math.max(0, 0.45 * (1 - t)); } catch (e) {}
      if (t >= 1) { try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {} _bgmFadeInterval = null; try { if (bgm && typeof bgm.pause === 'function') bgm.pause(); } catch (e) {} if (done) done(); }
    }, step);
  }
  function fadeInBgm(duration, done) {
    if (!bgm) { if (done) done(); return; }
    try { if (typeof bgm.play === 'function') bgm.play(); } catch (e) {}
    if (_bgmFadeInterval) try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}
    var elapsed = 0; var step = 50; var dur = duration || 600;
    _bgmFadeInterval = jsmaf.setInterval(function () {
      elapsed += step; var t = Math.min(elapsed / dur, 1);
      try { bgm.volume = Math.min(0.45, 0.45 * t); } catch (e) {}
      if (t >= 1) { try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {} _bgmFadeInterval = null; if (done) done(); }
    }, step);
  }
  function startBgm() {
    try { if (bgm && typeof bgm.play === 'function') bgm.play(); } catch (e) {}
    fadeInBgm(900);
  }
  // --- NEW HELPER: attempt to restart main-menu bgm (safe, non-invasive)
  function tryStartMainMenuBgm() {
    try {
      var candidates = ['__mainMenuBgm','__main_menu_bgm','__menuBgm','menuBgm','mainBgm','__mainBgm','__menu_bgm'];
      for (var i = 0; i < candidates.length; i++) {
        var name = candidates[i];
        var obj = null;
        try { if (typeof global !== 'undefined' && global[name]) obj = global[name]; } catch (e) {}
        try { if (!obj && typeof window !== 'undefined' && window[name]) obj = window[name]; } catch (e) {}
        if (!obj) continue;
        try {
          if (typeof obj.play === 'function') {
            try { if (typeof obj.volume !== 'undefined') obj.volume = 0; } catch (e) {}
            try { obj.play(); } catch (e) {}
            // fade volume up
            (function (a) {
              var elapsed = 0; var step = 50; var dur = 800;
              var id = jsmaf.setInterval(function () {
                try {
                  elapsed += step;
                  var t = Math.min(elapsed / dur, 1);
                  if (typeof a.volume !== 'undefined') {
                    try { a.volume = Math.min(0.65, 0.65 * t); } catch (e) {}
                  }
                } catch (e) {}
                if (t >= 1) try { jsmaf.clearInterval(id); } catch (e) {}
              }, step);
            })(obj);
            log('tryStartMainMenuBgm: attempted to start main menu bgm via ' + name);
            break;
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  // --- filesystem scanning and preview
  function makePreviewFromBuffer(buf, len) {
    var maxChars = 2000;
    var s = '';
    for (var i = 0; i < Math.min(len, maxChars); i++) {
      try {
        var ch = mem.view(buf).getUint8(i);
        if (ch === 9 || ch === 10 || ch === 13 || (ch >= 32 && ch < 127))
          s += String.fromCharCode(ch);
        else s += '.';
      } catch (e) { s += '.'; }
    }
    if (len > maxChars) s += '\n\n...preview truncated (' + maxChars + ' chars)';
    return s;
  }
  function scanDirectory(path) {
    var results = [];
    if (!path) return results;
    try {
      var paddr = strToAddr(path);
      if (!paddr) return results;
      var fd = fn.open_sys(paddr, new BigInt(0, 0), new BigInt(0, 0));
      if (!fd || (fd.eq && fd.eq(new BigInt(0xffffffff, 0xffffffff)))) { log('Failed to open ' + path); return results; }
      var buf = mem.malloc(8192);
      if (!buf) { fn.close_sys(fd); return results; }
      var res = fn.getdents(fd, buf, new BigInt(0, 8192));
      var rlen = safeBigIntToNumber(res);
      if (rlen > 0) {
        var offset = 0;
        while (offset < rlen) {
          try {
            var reclen = 1;
            try { reclen = mem.view(buf.add(new BigInt(0, offset + 4))).getUint16(0, true); } catch (e) {}
            var d_type = 0;
            try { d_type = mem.view(buf.add(new BigInt(0, offset + 6))).getUint8(0); } catch (e) {}
            var d_namlen = 0;
            try { d_namlen = mem.view(buf.add(new BigInt(0, offset + 7))).getUint8(0); } catch (e) {}
            var name = '';
            for (var n = 0; n < d_namlen; n++) {
              try { name += String.fromCharCode(mem.view(buf.add(new BigInt(0, offset + 8 + n))).getUint8(0)); } catch (e) {}
            }
            if (name && name !== '.' && name !== '..') {
              var itemPath = path + (path.endsWith('/') ? '' : '/') + name;
              var isDir = (d_type !== 8);
              results.push({ name: name, path: itemPath, isDir: isDir, size: 0 });
            }
            offset += reclen || 1;
          } catch (e) { break; }
        }
      }
      try { fn.close_sys(fd); } catch (e) {}
    } catch (e) { log('scanDirectory error: ' + (e.message || e)); }
    results.sort(function (a, b) {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      var an = (a.name || '').toLowerCase(), bn = (b.name || '').toLowerCase();
      if (sortMode === 'alpha') return an < bn ? -1 : (an > bn ? 1 : 0);
      if (sortMode === 'alpha_rev') return an > bn ? -1 : (an < bn ? 1 : 0);
      return an < bn ? -1 : (an > bn ? 1 : 0);
    });
    return results;
  }
  function previewFile(path, callback) {
    try {
      var paddr = strToAddr(path);
      if (!paddr) return callback(new Error('Invalid path'));
      var fd = fn.open_sys(paddr, new BigInt(0, 0), new BigInt(0, 0));
      if (!fd || (fd.eq && fd.eq(new BigInt(0xffffffff, 0xffffffff)))) return callback(new Error('Cannot open file'));
      var maxRead = 64 * 1024;
      var _buf = mem.malloc(maxRead);
      if (!_buf) { fn.close_sys(fd); return callback(new Error('Out of memory')); }
      var read_len = fn.read_sys(fd, _buf, new BigInt(0, maxRead));
      try { fn.close_sys(fd); } catch (e) {}
      var len = safeBigIntToNumber(read_len);
      var textPreview = makePreviewFromBuffer(_buf, len);
      return callback(null, textPreview);
    } catch (e) { return callback(e); }
  }
  // --- build UI grid
  function buildGrid() {
    // hide any viewer and ensure grid is exclusive
    modalOverlay.visible = false; modal.visible = false; modal._open = false;
    modalHeader.alpha = 0; modalCloseBtn.visible = false; modalCloseText.visible = false; modalContentText.alpha = 0; modalControls.alpha = 0;
    // hide previous created elements
    hideCreated();
    clearCreated();
    buttons = []; buttonTexts = []; buttonIcons = []; buttonMarkers = []; buttonOrigPos = []; textOrigPos = [];
    // refresh entries
    try { entries = scanDirectory(currentPath); } catch (e) { entries = []; }
    filteredEntries = entries.filter(function (it) {
      if (!searchQuery) return true;
      return (it.name || '').toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1;
    });
    // layout: ensure alignment and consistent spacing
    for (var i = 0; i < filteredEntries.length; i++) {
      var it = filteredEntries[i];
      var row = Math.floor(i / buttonsPerRow);
      var col = i % buttonsPerRow;
      var bx = startX + col * xSpacing;
      var by = startY + row * ySpacing;
      // icon
      var iconUrl = it.isDir ? 'file:///assets/img/folder_icon.png' : 'file:///assets/img/file_icon.png';
      var icon;
      try {
        icon = new Image({ url: iconUrl, x: bx + 8, y: by + 10, width: 56, height: 56 });
        icon.alpha = 0; jsmaf.root.children.push(icon); pushCreated(icon);
      } catch (e) {
        try {
          icon = new Image({ url: 'file:///assets/img/file_icon.png', x: bx + 8, y: by + 10, width: 56, height: 56 });
          icon.alpha = 0; jsmaf.root.children.push(icon); pushCreated(icon);
        } catch (ex) {}
      }
      buttonIcons.push(icon);
      // button background
      var btn;
      try {
        btn = new Image({ url: 'file:///../download0/img/button_over_9.png', x: bx, y: by, width: buttonWidth, height: buttonHeight });
        btn.alpha = 0; btn.scaleX = 1; btn.scaleY = 1;
        jsmaf.root.children.push(btn); pushCreated(btn); buttons.push(btn);
      } catch (e) { buttons.push(null); pushCreated(null); }
      // orange dot marker
      var marker;
      try {
        marker = new Image({ url: 'file:///assets/img/ad_pod_marker.png', x: bx + buttonWidth - 50, y: by + 35, width: 12, height: 12, visible: false });
        marker.alpha = 0; marker.isOrangeDot = true;
        jsmaf.root.children.push(marker); pushCreated(marker); buttonMarkers.push(marker);
      } catch (e) { buttonMarkers.push(null); }
      // text
      var displayName = it.name || '';
      if (displayName.length > 36) displayName = displayName.substring(0, 33) + '...';
      var txt;
      try {
        txt = new jsmaf.Text(); txt.text = displayName; txt.x = bx + 80; txt.y = by + 28; txt.style = 'white'; txt.alpha = 0;
        jsmaf.root.children.push(txt); pushCreated(txt); buttonTexts.push(txt);
      } catch (e) { buttonTexts.push(null); }
      // attach metadata
      try { if (btn) { btn._item = it; btn._index = i; } } catch (e) {}
      buttonOrigPos.push({ x: bx, y: by });
      textOrigPos.push({ x: (txt ? txt.x : bx + 80), y: (txt ? txt.y : by + 28) });
      // entrance animation (staggered) - replaced jsmaf.setTimeout with _setTimeout
      (function (b, t, ix, byy) {
        _setTimeout(function () {
          try { if (b) animate(b, { alpha: 0, y: byy + 20 }, { alpha: 1, y: byy }, 360); } catch (e) {}
          try { if (t) animate(t, { alpha: 0, y: t.y + 20 }, { alpha: 1, y: t.y }, 360); } catch (e) {}
        }, 100 + ix * 30);
      })(btn, txt, i, by);
    }
    // Up button if not root (small Up button)
    if (currentPath !== startPath) {
      var upBtnX = 130; var upBtnY = 180;
      try {
        var upBtn = new Image({ url: 'file:///../download0/img/button_over_9.png', x: upBtnX, y: upBtnY, width: 180, height: 32 });
        upBtn.alpha = 0; jsmaf.root.children.push(upBtn); pushCreated(upBtn);
        var upTxt = new jsmaf.Text(); upTxt.text = '.. (Up)'; upTxt.x = upBtnX + 10; upTxt.y = upBtnY + 6; upTxt.style = 'white'; upTxt.alpha = 0; jsmaf.root.children.push(upTxt); pushCreated(upTxt);
        upBtn._isUp = true;
        buttons.unshift(upBtn);
        buttonTexts.unshift(upTxt);
        buttonIcons.unshift(null);
        buttonMarkers.unshift(null);
        buttonOrigPos.unshift({ x: upBtnX, y: upBtnY });
        textOrigPos.unshift({ x: upTxt.x, y: upTxt.y });
      } catch (e) {}
    }
    // ensure currentButton is valid
    currentButton = Math.max(0, Math.min(currentButton, buttons.length - 1));
    updateHighlight();
    startOrangeDotLoop();
    startLogoLoop();
    // *** NEW: start button idle loop here so buttons gently breathe/move (only addition) ***
    startButtonIdleLoop();
    breadcrumbText.text = currentPath;
    // ensure BGM running
    startBgm();
  }
  // --- viewer open/close with BGM fade
  function cleanupModalMedia() {
    try {
      if (modalVideo) {
        try { if (typeof modalVideo.stop === 'function') modalVideo.stop(); } catch (e) {}
        try { if (typeof modalVideo.pause === 'function') modalVideo.pause(); } catch (e) {}
        try { modalVideo.visible = false; } catch (e) {}
        modalVideo = null;
      }
    } catch (e) {}
    try {
      if (modalAudio) {
        try { if (typeof modalAudio.stop === 'function') modalAudio.stop(); } catch (e) {}
        try { if (typeof modalAudio.pause === 'function') modalAudio.pause(); } catch (e) {}
        modalAudio = null;
      }
    } catch (e) {}
    try { modalImage.visible = false; } catch (e) {}
    modalControls.text = '';
    modalContentText.text = '';
    modalJsScrollOffset = 0;
  }
  function showModalText(title, content) {
    cleanupModalMedia();
    // hide grid so only viewer is visible
    hideCreated();
    modalOverlay.visible = true; modal.visible = true; modal._open = true;
    modalHeader.text = title || ''; modalHeader.alpha = 1;
    modalCloseBtn.visible = true; modalCloseText.visible = true;
    modalContentText.text = content || ''; modalContentText.alpha = 1;
    modalImage.visible = false; modalControls.alpha = 0;
  }
  function openImageViewer(item) {
    cleanupModalMedia();
    hideCreated();
    try {
      if (!item || !item.path) return showModalText('Image error', 'Invalid image path');
      // ensure file:// prefix
      var url = item.path.indexOf('file://') === 0 ? item.path : ('file://' + item.path);
      modalImage.url = url;
      modalImage.visible = true;
      modalContentText.alpha = 0;
      modalHeader.text = item.name || 'Image';
      modalOverlay.visible = true; modal.visible = true; modal._open = true;
      modalCloseBtn.visible = true; modalCloseText.visible = true;
      modalControls.alpha = 0;
      fadeOutBgm(400);
      // small safety: if image fails to load, show fallback text after timeout
      _setTimeout(function () {
        try {
          if (!modalImage.visible) return;
          if (!modalImage.url || modalImage.url === '') {
            showModalText('Image error', 'Could not display image: invalid URL');
            fadeInBgm(400);
          }
        } catch (e) {}
      }, 800);
    } catch (e) {
      showModalText('Image error', 'Could not display image: ' + (e.message || e));
      fadeInBgm(400);
    }
  }
  function openVideoViewer(item) {
    cleanupModalMedia();
    hideCreated();
    modalContentText.alpha = 0;
    modalHeader.text = item.name || 'Video';
    modalOverlay.visible = true; modal.visible = true; modal._open = true;
    modalCloseBtn.visible = true; modalCloseText.visible = true;
    modalControls.alpha = 1;
    modalControls.text = 'Square: Play/Pause  Circle: Close';
    fadeOutBgm(500);
    try {
      if (typeof jsmaf.VideoClip === 'function') {
        var url = item.path.indexOf('file://') === 0 ? item.path : ('file://' + item.path);
        modalVideo = new jsmaf.VideoClip({ url: url, x: 240, y: 200, width: 1440, height: 720 });
        modalVideo.visible = true;
        try { modalVideo.play(); modalControls.text = 'Square: Play/Pause  Circle: Close'; } catch (e) { modalControls.text = 'Video loaded'; }
      } else {
        modalControls.text = 'Video playback not supported';
        showModalText(item.name || 'Video', 'Playback not supported in this environment.');
        fadeInBgm(400);
      }
    } catch (e) {
      modalControls.text = 'Video error';
      showModalText('Video error', 'Could not play video: ' + (e.message || e));
      fadeInBgm(400);
    }
  }
  function openAudioViewer(item) {
    cleanupModalMedia();
    hideCreated();
    modalContentText.alpha = 0;
    modalHeader.text = item.name || 'Audio';
    modalOverlay.visible = true; modal.visible = true; modal._open = true;
    modalCloseBtn.visible = true; modalCloseText.visible = true;
    modalControls.alpha = 1;
    modalControls.text = 'Square: Play/Pause  Circle: Close';
    fadeOutBgm(500);
    try {
      modalAudio = new jsmaf.AudioClip();
      var url = item.path.indexOf('file://') === 0 ? item.path : ('file://' + item.path);
      modalAudio.open(url);
      try { modalAudio.play(); modalAudio._isPlaying = true; modalControls.text = 'Square: Play/Pause  Circle: Close'; } catch (e) { modalControls.text = 'Audio loaded'; }
    } catch (e) {
      modalControls.text = 'Audio playback not supported';
      showModalText(item.name || 'Audio', 'Playback not supported in this environment.');
      fadeInBgm(400);
    }
  }
  function openJsViewer(item) {
    cleanupModalMedia();
    hideCreated();
    modalContentText.alpha = 1;
    modalHeader.text = item.name || 'JS File';
    modalOverlay.visible = true; modal.visible = true; modal._open = true;
    modalCloseBtn.visible = true; modalCloseText.visible = true;
    modalControls.alpha = 1;
    modalControls.text = 'Up/Down: L2 Up R3 down  Close: L2, might need 2 presses';
    fadeOutBgm(400);
    // read file and display full text (with safe preview)
    previewFile(item.path, function (err, txt) {
      if (err) {
        showModalText('JS error', 'Could not read file: ' + (err.message || err));
        fadeInBgm(400);
        return;
      }
      modalContentText.text = txt || '(empty)';
      modalJsScrollOffset = 0;
      // position text inside modal; we will adjust modalContentText.y for scrolling
      modalContentText.x = 200;
      modalContentText.y = 160;
      modalContentText.alpha = 1;
    });
  }
  function toggleModalPlayPause() {
    try {
      if (modalVideo) {
        if (typeof modalVideo.paused !== 'undefined') {
          if (modalVideo.paused) modalVideo.play(); else modalVideo.pause();
        } else {
          try { modalVideo.play(); } catch (e) {}
        }
        return;
      }
    } catch (e) {}
    try {
      if (modalAudio) {
        // some AudioClip implementations don't expose paused; attempt best-effort toggle
        try {
          if (modalAudio._isPlaying) {
            try { if (typeof modalAudio.pause === 'function') modalAudio.pause(); } catch (e) {}
            modalAudio._isPlaying = false;
          } else {
            try { if (typeof modalAudio.play === 'function') modalAudio.play(); } catch (e) {}
            modalAudio._isPlaying = true;
          }
        } catch (e) {
          try { modalAudio.play(); modalAudio._isPlaying = true; } catch (e) {}
        }
        return;
      }
    } catch (e) {}
  }
  function closeModalAndResumeBgm() {
    cleanupModalMedia();
    modalOverlay.visible = false; modal.visible = false; modal._open = false;
    modalHeader.alpha = 0; modalCloseBtn.visible = false; modalCloseText.visible = false; modalContentText.alpha = 0; modalControls.alpha = 0;
    fadeInBgm(600);
    // restore grid
    buildGrid();
    // show created elements again
    showCreated();
  }
  // --- highlight and marker updates
  var prevButton = -1;
  function updateHighlight() {
    if (!buttons || buttons.length === 0) return;
    if (currentButton < 0) currentButton = 0;
    if (currentButton >= buttons.length) currentButton = buttons.length - 1;
    // hide all markers first
    for (var mi = 0; mi < buttonMarkers.length; mi++) {
      try { if (buttonMarkers[mi]) { buttonMarkers[mi].visible = false; buttonMarkers[mi].alpha = 0; } } catch (e) {}
    }
    if (prevButton >= 0 && prevButton !== currentButton && buttons[prevButton]) {
      var pb = buttons[prevButton];
      try { pb.url = 'file:///../download0/img/button_over_9.png'; pb.alpha = 0.8; } catch (e) {}
      try { if (buttonTexts[prevButton]) { buttonTexts[prevButton].scaleX = 1; buttonTexts[prevButton].scaleY = 1; } } catch (e) {}
      try { if (buttonIcons[prevButton]) { buttonIcons[prevButton].scaleX = 1; buttonIcons[prevButton].scaleY = 1; } } catch (e) {}
    }
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (!b) continue;
      if (i === currentButton) {
        try { b.url = 'file:///../download0/img/button_over_9.png'; b.alpha = 1.0; b.borderColor = 'rgb(122, 91, 6)'; b.borderWidth = 3; } catch (e) {}
        try { if (buttonTexts[i]) { buttonTexts[i].scaleX = 1.06; buttonTexts[i].scaleY = 1.06; } } catch (e) {}
        try { if (buttonIcons[i]) { buttonIcons[i].scaleX = 1.06; buttonIcons[i].scaleY = 1.06; } } catch (e) {}
        try {
          if (buttonMarkers[i]) {
            // markers pulse for directory/file items if visible; small Up button has no marker
            if (buttonMarkers[i].isOrangeDot && buttonMarkers[i].visible) {
              animate(buttonMarkers[i], { alpha: buttonMarkers[i].alpha || 0 }, { alpha: 1 }, 200);
            }
          }
        } catch (e) {}
      } else {
        try { if (buttonTexts[i]) { buttonTexts[i].scaleX = 1; buttonTexts[i].scaleY = 1; } } catch (e) {}
        try { if (buttonIcons[i]) { buttonIcons[i].scaleX = 1; buttonIcons[i].scaleY = 1; } } catch (e) {}
        try { if (buttonMarkers[i]) { buttonMarkers[i].visible = false; buttonMarkers[i].alpha = 0; } } catch (e) {}
      }
      try { if (buttonTexts[i] && buttonTexts[i].constructor && buttonTexts[i].constructor.name === 'Text') buttonTexts[i].style = 'white'; } catch (e) {}
    }
    prevButton = currentButton;
  }
  // --- input handlers (PS4-first)
  var lastRealMouseTime = 0, mouseHideTimeout = null, mouseInactivityMs = 2000;
  function showCursor() {
    try {
      cursor.visible = true;
      lastRealMouseTime = Date.now();
      if (mouseHideTimeout) try { jsmaf.clearTimeout(mouseHideTimeout); } catch (e) {}
      mouseHideTimeout = jsmaf.setTimeout(function () {
        if (Date.now() - lastRealMouseTime >= mouseInactivityMs) cursor.visible = false;
        mouseHideTimeout = null;
      }, mouseInactivityMs);
    } catch (e) {}
  }
  function updateCursorPosition(x, y) {
    virtualMouse.x = x; virtualMouse.y = y;
    try { cursor.x = Math.round(virtualMouse.x - cursorSize.w/2); cursor.y = Math.round(virtualMouse.y - cursorSize.h/2); } catch (e) {}
    lastRealMouseTime = Date.now();
    if (!cursor.visible) cursor.visible = true;
  }
  jsmaf.onMouseMove = function (mx, my) {
    updateCursorPosition(mx, my);
    showCursor();
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (!b) continue;
      try {
        if (mx >= b.x && my >= b.y && mx <= b.x + b.width && my <= b.y + b.height) {
          if (currentButton !== i) { prevButton = currentButton; currentButton = i; updateHighlight(); }
          return;
        }
      } catch (e) {}
    }
  };
  jsmaf.onMouseDown = function (mx, my, btn) {
    updateCursorPosition(mx, my);
    showCursor();
    // if modal open and close clicked
    if (modal._open) {
      try {
        if (modalCloseBtn.visible && mx >= modalCloseBtn.x && my >= modalCloseBtn.y && mx <= modalCloseBtn.x + modalCloseBtn.width && my <= modalCloseBtn.y + modalCloseBtn.height) {
          closeModalAndResumeBgm();
          return;
        }
      } catch (e) {}
    }
    // search box click: show simple hint (we don't implement full text input here)
    try {
      if (mx >= searchBox.x && my >= searchBox.y && mx <= searchBox.x + searchBox.width && my <= searchBox.y + searchBox.height) {
        // show a small modal explaining how to clear search (Triangle) and that search is placeholder
        showModalText('Search', 'This is a placeholder search field. Press Triangle (gamepad) to clear the search filter. Use the UI to navigate files.');
        return;
      }
    } catch (e) {}
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i]; if (!b) continue;
      try {
        if (mx >= b.x && my >= b.y && mx <= b.x + b.width && my <= b.y + b.height) {
          currentButton = i; updateHighlight();
          handleButtonAction(i);
          return;
        }
      } catch (e) {}
    }
  };
  // central action handler for a button index
  function handleButtonAction(index) {
    try {
      var b = buttons[index];
      if (!b) return;
      // Up button
      if (b._isUp) {
        navigateUp();
        return;
      }
      // normal file/folder button
      var item = b._item;
      if (!item) return;
      if (item.isDir) {
        // push to stack and open (only push if different)
        try {
          if (pathStack.length === 0 || pathStack[pathStack.length - 1] !== item.path) {
            pathStack.push(item.path);
          }
          currentPath = item.path;
          currentButton = 0;
          buildGrid();
        } catch (e) {}
      } else {
        // file: choose viewer by extension
        var ext = extOf(item.name || '');
        if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') {
          openImageViewer(item);
        } else if (ext === 'mp4' || ext === 'mkv' || ext === 'webm') {
          openVideoViewer(item);
        } else if (ext === 'wav' || ext === 'mp3' || ext === 'ogg') {
          openAudioViewer(item);
        } else if (ext === 'js' || ext === 'json' || ext === 'txt') {
          openJsViewer(item);
        } else {
          // fallback: try text preview
          previewFile(item.path, function (err, txt) {
            if (err) showModalText('Preview error', 'Could not preview file: ' + (err.message || err));
            else showModalText(item.name || 'Preview', txt || '(empty)');
          });
        }
      }
    } catch (e) { log('handleButtonAction err: ' + (e.message || e)); }
  }
  // navigate up one folder or return to main menu if at root
  function navigateUp() {
    try {
      // If modal open, close it first
      if (modal._open) {
        closeModalAndResumeBgm();
        return;
      }
      if (!pathStack || pathStack.length <= 1 || currentPath === startPath) {
        // at root: return to main menu (include main-menu.js)
        try {
          fadeOutBgm(300, function () {
            try { fullUnload(); } catch (e) {}
            try { include('main-menu.js'); } catch (e) { log('Could not include main-menu.js: ' + (e.message || e)); }
            try { tryStartMainMenuBgm(); } catch (e) {}
          });
        } catch (e) {
          try { fullUnload(); } catch (ee) {}
          try { include('main-menu.js'); } catch (e) { log('navigateUp include error: ' + (e.message || e)); }
        }
      } else {
        // pop stack and rebuild
        try {
          pathStack.pop();
          currentPath = pathStack[pathStack.length - 1] || startPath;
          currentButton = 0;
          buildGrid();
        } catch (e) {}
      }
    } catch (e) { log('navigateUp err: ' + (e.message || e)); }
  }
  // keyboard/gamepad nav & actions
  jsmaf.onKeyDown = function (keyCode) {
    try {
      // Next / Right
      if (keyCode === 6 || keyCode === 5 || keyCode === 22) {
        currentButton = (currentButton + 1) % buttons.length; updateHighlight();
        return;
      }
      // Prev / Left
      if (keyCode === 4 || keyCode === 7 || keyCode === 21) {
        currentButton = (currentButton - 1 + buttons.length) % buttons.length; updateHighlight();
        return;
      }
      // Down (scroll or move)
      if (keyCode === 19 || keyCode === 20 || keyCode === 2) {
        if (modal._open && modalContentText && modalContentText.alpha === 1) {
          modalJsScrollOffset -= 28;
          modalContentText.y = 160 + modalJsScrollOffset;
          return;
        }
        var next = Math.min(buttons.length - 1, currentButton + buttonsPerRow);
        if (next !== currentButton) { currentButton = next; updateHighlight(); }
        return;
      }
      // Up (scroll or move)
      if (keyCode === 18 || keyCode === 17 || keyCode === 1) {
        if (modal._open && modalContentText && modalContentText.alpha === 1) {
          modalJsScrollOffset += 28;
          modalContentText.y = 160 + modalJsScrollOffset;
          return;
        }
        var prev = Math.max(0, currentButton - buttonsPerRow);
        if (prev !== currentButton) { currentButton = prev; updateHighlight(); }
        return;
      }
      // Confirm / Cross
      if (keyCode === 14) {
        if (modal._open && (modalAudio || modalVideo)) {
          toggleModalPlayPause();
          return;
        }
        handleButtonAction(currentButton);
        return;
      }
      // Circle / Back
      if (keyCode === 1 || keyCode === 3 || keyCode === 8) {
        navigateUp();
        return;
      }
      // Triangle (clear search)
      if (keyCode === 3 || keyCode === 12) {
        searchQuery = '';
        searchText.text = 'Search: (Triangle to clear)';
        buildGrid();
        return;
      }
      // Escape
      if (keyCode === 27) {
        if (modal._open) closeModalAndResumeBgm();
        return;
      }
    } catch (e) {}
  };
  // PS4 controller -> mouse emulation & button mapping
  (function startGamepadMouse() {
    var gpPollInterval = null;
    var gpSensitivity = 12.0;
    var gpDeadzone = 0.15;
    var lastGpButtons = [];
    var gpPollStepMs = 16; // ~60Hz
    try {
      gpPollInterval = jsmaf.setInterval(function () {
        try {
          if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
          var gps = navigator.getGamepads();
          if (!gps) return;
          var gp = gps[0];
          if (!gp) return;
          // right stick for cursor
          var ax = (gp.axes && gp.axes.length > 2) ? gp.axes[2] : 0;
          var ay = (gp.axes && gp.axes.length > 3) ? gp.axes[3] : 0;
          ax = Math.abs(ax) < gpDeadzone ? 0 : ax;
          ay = Math.abs(ay) < gpDeadzone ? 0 : ay;
          var dt = gpPollStepMs / 1000.0;
          var dx = ax * gpSensitivity * dt * 60;
          var dy = ay * gpSensitivity * dt * 60;
          virtualMouse.x += dx;
          virtualMouse.y += dy;
          virtualMouse.x = Math.max(0, Math.min(1920, virtualMouse.x));
          virtualMouse.y = Math.max(0, Math.min(1080, virtualMouse.y));
          updateCursorPosition(Math.round(virtualMouse.x), Math.round(virtualMouse.y));
          try { jsmaf.onMouseMove(Math.round(virtualMouse.x), Math.round(virtualMouse.y)); } catch (e) {}
          // map common buttons:
          var btnCount = gp.buttons ? gp.buttons.length : 0;
          var pressed0 = (btnCount > 0) ? !!(gp.buttons[0] && (gp.buttons[0].pressed || gp.buttons[0].value > 0.5)) : false;
          var pressed1 = (btnCount > 1) ? !!(gp.buttons[1] && (gp.buttons[1].pressed || gp.buttons[1].value > 0.5)) : false;
          var pressed2 = (btnCount > 2) ? !!(gp.buttons[2] && (gp.buttons[2].pressed || gp.buttons[2].value > 0.5)) : false;
          var pressed3 = (btnCount > 3) ? !!(gp.buttons[3] && (gp.buttons[3].pressed || gp.buttons[3].value > 0.5)) : false;
          // emulate click on Cross (0)
          if (pressed0 && !lastGpButtons[0]) {
            try { jsmaf.onMouseDown(Math.round(virtualMouse.x), Math.round(virtualMouse.y), 0); } catch (e) {}
          }
          // Circle (1)
          if (pressed1 && !lastGpButtons[1]) {
            try { navigateUp(); } catch (e) {}
          }
          // Square (2)
          if (pressed2 && !lastGpButtons[2]) {
            try { if (modal._open && (modalAudio || modalVideo)) toggleModalPlayPause(); } catch (e) {}
          }
          // Triangle (3)
          if (pressed3 && !lastGpButtons[3]) {
            try {
              searchQuery = '';
              searchText.text = 'Search: (Triangle to clear)';
              buildGrid();
            } catch (e) {}
          }
          // L2 -> button index 6 (PS4) — at root, treat as "quit to main menu" offload
          var pressedL2 = (btnCount > 6) ? !!(gp.buttons[6] && (gp.buttons[6].pressed || gp.buttons[6].value > 0.5)) : false;
          if (pressedL2 && !lastGpButtons[6]) {
            try {
              if (currentPath === startPath) {
                // fade, fully unload explorer, then include main menu
                fadeOutBgm(250, function () {
                  try { fullUnload(); } catch (e) {}
                  try { include('main-menu.js'); } catch (e) {}
                });
              } else {
                // otherwise use Circle/Back behavior to go up
                navigateUp();
              }
            } catch (e) {}
          }
          // Dpad / left stick navigation
          var lax = (gp.axes && gp.axes.length > 0) ? gp.axes[0] : 0;
          var lay = (gp.axes && gp.axes.length > 1) ? gp.axes[1] : 0;
          var navThreshold = 0.75;
          if (lax > navThreshold) { currentButton = Math.min(buttons.length - 1, currentButton + 1); updateHighlight(); }
          else if (lax < -navThreshold) { currentButton = Math.max(0, currentButton - 1); updateHighlight(); }
          else if (lay > navThreshold) { currentButton = (currentButton + buttonsPerRow) % buttons.length; updateHighlight(); }
          else if (lay < -navThreshold) { currentButton = Math.max(0, currentButton - buttonsPerRow); updateHighlight(); }
          lastGpButtons[0] = pressed0;
          lastGpButtons[1] = pressed1;
          lastGpButtons[2] = pressed2;
          lastGpButtons[3] = pressed3;
          lastGpButtons[6] = pressedL2;
        } catch (e) {}
      }, gpPollStepMs);
      _intervals.push(gpPollInterval);
    } catch (e) {}
  })();
  // ensure text objects keep the white style after reloads or re-initialization
  function enforceTextWhite() {
    for (var i = 0; i < buttonTexts.length; i++) {
      try {
        var t = buttonTexts[i];
        if (t && typeof t === 'object' && t.constructor && t.constructor.name === 'Text') {
          t.style = 'white';
        }
      } catch (e) {}
    }
  }
  // *** NEW: button idle subtle movement (only additions below) ***
  function startButtonIdleLoop() {
    try {
      if (typeof _buttonIdleInterval !== 'undefined' && _buttonIdleInterval) try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {}
      var phase = 0;
      _buttonIdleInterval = jsmaf.setInterval(function () {
        try {
          phase += 0.03;
          for (var i = 0; i < buttons.length; i++) {
            try {
              var b = buttons[i];
              var t = buttonTexts[i];
              var ic = buttonIcons[i];
              if (!b) continue;
              var base = buttonOrigPos[i] || { x: b.x, y: b.y };
              var offset = (i % 7) * 0.9;
              var p = phase + offset;
              var isSelected = (i === currentButton);
              var ampX = isSelected ? 6 : 3;
              var ampY = isSelected ? 4 : 2;
              var breath = isSelected ? 0.015 : 0.008;
              var speed = isSelected ? 1.1 : 1.0;
              try {
                b.x = base.x + Math.sin(p * 0.9 * speed) * ampX;
                b.y = base.y + Math.sin(p * 0.6 * speed) * ampY;
                var sx = 1 + Math.sin(p * 1.1 * speed) * breath;
                var sy = 1 - Math.sin(p * 1.1 * speed) * breath * 0.5;
                b.scaleX = sx; b.scaleY = sy;
                if (t) {
                  t.x = Math.round(b.x + 80);
                  t.y = Math.round(b.y + 28);
                }
                if (ic) {
                  ic.x = Math.round(b.x + 8);
                  ic.y = Math.round(b.y + 10);
                }
              } catch (e) {}
            } catch (e) {}
          }
        } catch (e) {}
      }, 16);
      _intervals.push(_buttonIdleInterval);
    } catch (e) { log('startButtonIdleLoop error: ' + (e.message || e)); }
  }
  // *** END additions ***
  // start entrance (background, title, then grid)
  function entrance() {
    animate(background, { alpha: 0 }, { alpha: 1 }, 800);
    try { if (titleText) animate(titleText, { alpha: 0 }, { alpha: 1 }, 900); } catch (e) {}
    try { if (logo) animate(logo, { alpha: 0, scaleX: 0.95, scaleY: 0.95 }, { alpha: 1, scaleX: 1.0, scaleY: 1.0 }, 900); } catch (e) {}
    _setTimeout(function () {
      buildGrid();
      enforceTextWhite();
    }, 300);
  }
  // --- FULL UNLOAD: clears intervals/timeouts, stops audio, removes visuals & handlers
  function fullUnload() {
    try {
      if (typeof window !== 'undefined' && window.__explorerUnloading) return;
      if (typeof global !== 'undefined' && global.__explorerUnloading) return;
      if (typeof window !== 'undefined') window.__explorerUnloading = true;
      if (typeof global !== 'undefined') global.__explorerUnloading = true;
    } catch (e) {}
    try {
      // clear intervals & timeouts
      try { _clearAllIntervals(); } catch (e) {}
      try { _clearAllTimeouts(); } catch (e) {}
      // clear bgm fade interval
      try { if (_bgmFadeInterval) jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}
      // stop and release bgm
      try {
        if (bgm) {
          try { if (typeof bgm.pause === 'function') bgm.pause(); } catch (e) {}
          try { if (typeof bgm.stop === 'function') bgm.stop(); } catch (e) {}
          try { bgm._isPlaying = false; } catch (e) {}
        }
      } catch (e) {}
      // delete global explorer bgm pointer
      try { if (typeof global !== 'undefined' && global.__explorerBgm) delete global.__explorerBgm; } catch (e) {}
      try { if (typeof window !== 'undefined' && window.__explorerBgm) delete window.__explorerBgm; } catch (e) {}
      // cleanup modal media
      try { cleanupModalMedia(); } catch (e) {}
      // stop any modal video/audio explicitly
      try { if (modalVideo && typeof modalVideo.stop === 'function') modalVideo.stop(); } catch (e) {}
      try { if (modalAudio && typeof modalAudio.stop === 'function') modalAudio.stop(); } catch (e) {}
      // remove visuals from root (fast)
      try { if (jsmaf && jsmaf.root && Array.isArray(jsmaf.root.children)) jsmaf.root.children.length = 0; } catch (e) {}
      // drop local references to let GC collect
      try {
        createdElements = []; buttons = []; buttonTexts = []; buttonIcons = []; buttonMarkers = [];
        buttonOrigPos = []; textOrigPos = [];
        bgm = null;
        modal = modalOverlay = modalHeader = modalCloseBtn = modalCloseText = modalContentText = modalImage = modalVideo = modalAudio = modalControls = null;
        cursor = background = logo = titleText = null;
      } catch (e) {}
      // remove event handlers (no-op handlers)
      try { jsmaf.onMouseMove = function(){}; } catch (e) {}
      try { jsmaf.onMouseDown = function(){}; } catch (e) {}
      try { jsmaf.onKeyDown = function(){}; } catch (e) {}
      // minor: reset mouse hide timer var
      try { mouseHideTimeout = null; } catch (e) {}
      // attempt to restart main-menu bgm if present
      try { tryStartMainMenuBgm(); } catch (e) {}
    } catch (e) { log('fullUnload error: ' + (e.message || e)); }
  }
  // start BGM and entrance
  startBgm();
  entrance();
})();
