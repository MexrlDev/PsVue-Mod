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

  // runtime flag
  var __explorerRunning = true;

  // --- animation interval handles ---
  var logoAnimInterval = null;
  var buttonIdleInterval = null;

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
  var iconOrigPos = [];
  var markerOrigPos = [];
  var idleParams = [];
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
  var modalJsScrollOffset = 0;

  // BGM
  var bgm = null;
  try {
    if (typeof global !== 'undefined' && global.__explorerBgm && global.__explorerBgm._valid) {
      bgm = global.__explorerBgm;
    } else if (typeof window !== 'undefined' && window.__explorerBgm && window.__explorerBgm._valid) {
      bgm = window.__explorerBgm;
    } else {
      bgm = new jsmaf.AudioClip();
      try { bgm.open('file:///../download0/sfx/bgm.wav'); } catch (e) {}
      try { bgm.loop = true; } catch (e) {}
      bgm._valid = true;
      bgm._isPlaying = false;
      if (typeof global !== 'undefined') global.__explorerBgm = bgm;
      else if (typeof window !== 'undefined') window.__explorerBgm = bgm;
    }
  } catch (e) { log('bgm init error: ' + (e.message || e)); bgm = null; }

  var _bgmFadeInterval = null;

  // intervals / timeouts
  var _intervals = [];
  function _setInterval(fn, ms) { var id = jsmaf.setInterval(fn, ms); _intervals.push(id); return id; }
  function _clearAllIntervals() { for (var i = 0; i < _intervals.length; i++) try { jsmaf.clearInterval(_intervals[i]); } catch (e) {} } _intervals = [];

  var _timeouts = [];
  function _setTimeout(fn, ms) {
    try { var id = jsmaf.setTimeout(fn, ms); _timeouts.push(id); return id; } catch (e) { return null; }
  }
  function _clearAllTimeouts() { for (var i = 0; i < _timeouts.length; i++) try { jsmaf.clearTimeout(_timeouts[i]); } catch (e) {} _timeouts = []; }

  function pushCreated(el) { if (!el) return; createdElements.push(el); }
  function hideCreated() { for (var i = 0; i < createdElements.length; i++) { try { createdElements[i].visible = false; } catch (e) {} } }
  function showCreated() { for (var i = 0; i < createdElements.length; i++) { try { createdElements[i].visible = true; } catch (e) {} } }
  function clearCreated() { createdElements = []; }

  // --- visuals (clear root then recreate)
  try { jsmaf.root.children.length = 0; } catch (e) {}

  new Style({ name: 'white', color: 'white', size: 28 });
  new Style({ name: 'title', color: 'white', size: 40 });
  new Style({ name: 'small', color: 'white', size: 22 });

  // ----- SINGLE BACKGROUND IMAGE (multiview_bg_VAF.png) -----
  var background = new Image({
    url: 'file:///../download0/img/multiview_bg_VAF.png',
    x: 0, y: 0, width: 1920, height: 1080
  });
  jsmaf.root.children.push(background);

  // ==================== LOGO ====================
  var logo = new Image({
    url: 'file:///../download0/img/logo.png',
    x: 1620, y: 0, width: 300, height: 169,
    alpha: 1, scaleX: 1, scaleY: 1
  });
  jsmaf.root.children.push(logo);

  var logoBaseX = logo.x;
  var logoBaseY = logo.y;

  var titleText;
  if (typeof useImageText !== 'undefined' && useImageText) {
    try {
      var titleImg = new Image({ url: (typeof textImageBase !== 'undefined' ? textImageBase : '') + 'explorer.png', x: 760, y: 80, width: 420, height: 84 });
      titleImg.alpha = 1; jsmaf.root.children.push(titleImg);
    } catch (e) {}
  } else {
    titleText = new jsmaf.Text();
    titleText.text = (typeof lang !== 'undefined' ? (lang.fileExplorer || 'File Explorer') : 'File Explorer');
    titleText.x = 760; titleText.y = 80; titleText.style = 'title'; titleText.alpha = 1;
    jsmaf.root.children.push(titleText);
  }

  var searchBox = new Image({ url: 'file:///../download0/img/button_over_9.png', x: 130, y: 140, width: 420, height: 56 });
  searchBox.alpha = 0.95; jsmaf.root.children.push(searchBox);

  var searchText = new jsmaf.Text(); searchText.text = 'Search: (Triangle to clear)'; searchText.x = 140; searchText.y = 152; searchText.style = 'white'; jsmaf.root.children.push(searchText);

  var sortText = new jsmaf.Text(); sortText.text = 'Sort: ' + sortMode; sortText.x = 580; sortText.y = 152; sortText.style = 'white'; jsmaf.root.children.push(sortText);

  var breadcrumbText = new jsmaf.Text(); breadcrumbText.text = currentPath; breadcrumbText.x = 130; breadcrumbText.y = 190; breadcrumbText.style = 'small'; breadcrumbText.visible = false; breadcrumbText.alpha = 0; jsmaf.root.children.push(breadcrumbText);

  var pathTopLeft = new jsmaf.Text();
  pathTopLeft.text = currentPath;
  pathTopLeft.x = 20;
  pathTopLeft.y = 20;
  pathTopLeft.style = 'small';
  pathTopLeft.alpha = 1;
  pathTopLeft.visible = true;
  jsmaf.root.children.push(pathTopLeft);

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

  cursor = new Image({ url: 'file:///../download0/img/cursor.png', x: virtualMouse.x - cursorSize.w/2, y: virtualMouse.y - cursorSize.h/2, width: cursorSize.w, height: cursorSize.h });
  cursor.visible = false; jsmaf.root.children.push(cursor);

  // Transparent button background (replaces button_over_9.png)
  var TRANSPARENT_BUTTON_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  // Helpers (no tweens)
  function animate(obj, from, to, duration, onStep, done) {
    try {
      if (!obj || !to) {
        if (done) try { done(); } catch (e) {}
        return null;
      }
      for (var k in to) {
        try { obj[k] = to[k]; } catch (ex) {}
      }
      if (onStep) try { onStep(1); } catch (e) {}
      if (done) try { done(); } catch (e) {}
    } catch (e) {}
    return null;
  }

  function startOrangeDotLoop() {
    if (!__explorerRunning) return;
    for (var i = 0; i < buttonMarkers.length; i++) {
      var m = buttonMarkers[i];
      if (!m) continue;
      try {
        if (m.isOrangeDot && m.visible) {
          m.alpha = 1;
          m.scaleX = 1;
          m.scaleY = 1;
        } else {
          m.alpha = 0;
          m.scaleX = 1;
          m.scaleY = 1;
        }
      } catch (e) {}
    }
  }

  function startLogoLoop() {
    if (logoAnimInterval) jsmaf.clearInterval(logoAnimInterval);
    var startTime = Date.now();
    logoAnimInterval = jsmaf.setInterval(function () {
      if (!__explorerRunning) return;
      var t = (Date.now() - startTime) / 1000;
      var bob = Math.sin(t * 1.6) * 6;
      var sway = Math.sin(t * 0.9) * 4;
      var rot = Math.sin(t * 0.6) * 1.1;
      var breath = 1.0 + Math.sin(t * 1.2) * 0.02;
      try {
        logo.x = logoBaseX + sway;
        logo.y = logoBaseY + bob;
        logo.scaleX = breath;
        logo.scaleY = breath;
        logo.rotation = rot;
      } catch (e) {}
    }, 50);
  }

  function fadeOutBgm(duration, done) {
    if (!bgm) { if (done) done(); return; }
    try { if (typeof bgm.pause === 'function') bgm.pause(); } catch (e) {}
    try { if (typeof bgm.stop === 'function') bgm.stop(); } catch (e) {}
    try { bgm._isPlaying = false; } catch (e) {}
    try { if (typeof bgm.volume !== 'undefined') bgm.volume = 0; } catch (e) {}
    if (done) try { done(); } catch (e) {}
  }

  function fadeInBgm(duration, done) {
    if (!bgm) { if (done) done(); return; }
    try { if (typeof bgm.play === 'function') bgm.play(); } catch (e) {}
    try { bgm._isPlaying = true; } catch (e) {}
    try { if (typeof bgm.volume !== 'undefined') bgm.volume = 0.45; } catch (e) {}
    if (done) try { done(); } catch (e) {}
  }

  function startBgm() {
    try { if (bgm && typeof bgm.play === 'function') bgm.play(); } catch (e) {}
    fadeInBgm(1);
  }

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
            try { if (typeof obj.volume !== 'undefined') obj.volume = 0.65; } catch (e) {}
            try { obj.play(); } catch (e) {}
            log('tryStartMainMenuBgm: attempted to start main menu bgm via ' + name);
            break;
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  // filesystem scanning and preview
  function makePreviewFromBuffer(buf, len) {
    var maxChars = 2000;
    var s = '';
    for (var i = 0; i < Math.min(len, maxChars); i++) {
      try {
        var ch = mem.view(buf).getUint8(i);
        if (ch === 9 || ch === 10 || ch === 13 || (ch >= 32 && ch < 127)) s += String.fromCharCode(ch);
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
      var buf = mem.malloc(4096);
      if (!buf) { fn.close_sys(fd); return results; }
      var res = fn.getdents(fd, buf, new BigInt(0, 4096));
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
      var maxRead = 32 * 1024;
      var _buf = mem.malloc(maxRead);
      if (!_buf) { fn.close_sys(fd); return callback(new Error('Out of memory')); }
      var read_len = fn.read_sys(fd, _buf, new BigInt(0, maxRead));
      try { fn.close_sys(fd); } catch (e) {}
      var len = safeBigIntToNumber(read_len);
      var textPreview = makePreviewFromBuffer(_buf, len);
      return callback(null, textPreview);
    } catch (e) { return callback(e); }
  }

  // --- idle loop for buttons (dynamic animation) ---
  function startButtonIdleLoop() {
    if (buttonIdleInterval) jsmaf.clearInterval(buttonIdleInterval);
    var idleStart = Date.now();
    buttonIdleInterval = jsmaf.setInterval(function () {
      if (!__explorerRunning) return;
      var t = (Date.now() - idleStart) / 1000;
      for (var j = 0; j < buttons.length; j++) {
        var btn = buttons[j];
        var txt = buttonTexts[j];
        var icon = buttonIcons[j];
        var mark = buttonMarkers[j];
        var base = buttonOrigPos[j];
        var txtBase = textOrigPos[j];
        var iconBase = iconOrigPos[j];
        var markBase = markerOrigPos[j];
        var params = idleParams[j];
        if (!btn || !base || !params) continue;

        var slow = Math.sin(t * params.slowSpeed + params.phase);
        var fast = Math.sin(t * params.fastSpeed + params.phase * 1.3);
        var sway = slow * params.swayAmp;
        var bob = fast * params.bobAmp;
        var rotate = slow * params.rotateAmp;

        if (j === currentButton) {
          var baseBreath = 1.0 + 0.01 * Math.sin(t * params.fastSpeed + params.phase);
          var squash = 1 + Math.sin(t * 2.6 + params.phase) * 0.04;
          var finalScaleX = baseBreath * squash;
          var finalScaleY = baseBreath * (1 - (squash - 1) * 0.45);
          btn.scaleX = finalScaleX;
          btn.scaleY = finalScaleY;
          btn.rotation = rotate * 0.4;
          btn.x = base.x + sway * 0.75 - buttonWidth * (finalScaleX - 1) / 2;
          btn.y = base.y + bob * 0.9 - buttonHeight * (finalScaleY - 1) / 2;

          if (txt) {
            txt.scaleX = finalScaleX;
            txt.scaleY = finalScaleY;
            txt.x = txtBase.x + sway * 0.75 - buttonWidth * (finalScaleX - 1) / 2;
            txt.y = txtBase.y + bob * 0.9 - buttonHeight * (finalScaleY - 1) / 2;
          }
          if (icon) {
            icon.scaleX = finalScaleX;
            icon.scaleY = finalScaleY;
            icon.x = iconBase.x + sway * 0.75 - buttonWidth * (finalScaleX - 1) / 2;
            icon.y = iconBase.y + bob * 0.9 - buttonHeight * (finalScaleY - 1) / 2;
          }
          if (mark) {
            mark.x = btn.x + buttonWidth - 50 + Math.sin(t * 1.9 + params.phase) * 1.8;
            mark.y = btn.y + 35 + Math.cos(t * 1.7 + params.phase) * 1.2;
            mark.scaleX = 1.0 + 0.04 * Math.sin(t * 2.4);
            mark.scaleY = mark.scaleX;
          }
        } else {
          var finalScale = 1.0 + 0.01 * Math.sin(t * params.fastSpeed + params.phase);
          btn.scaleX = finalScale;
          btn.scaleY = finalScale;
          btn.rotation = rotate * 0.35;
          btn.x = base.x + sway * 0.6 - buttonWidth * (finalScale - 1) / 2;
          btn.y = base.y + bob * 0.6 - buttonHeight * (finalScale - 1) / 2;

          if (txt) {
            txt.scaleX = finalScale;
            txt.scaleY = finalScale;
            txt.x = txtBase.x + sway * 0.6 - buttonWidth * (finalScale - 1) / 2;
            txt.y = txtBase.y + bob * 0.6 - buttonHeight * (finalScale - 1) / 2;
          }
          if (icon) {
            icon.scaleX = finalScale;
            icon.scaleY = finalScale;
            icon.x = iconBase.x + sway * 0.6 - buttonWidth * (finalScale - 1) / 2;
            icon.y = iconBase.y + bob * 0.6 - buttonHeight * (finalScale - 1) / 2;
          }
          if (mark) {
            mark.x = btn.x + buttonWidth - 50 + Math.sin(t * 1.2 + params.phase) * 1.2;
            mark.y = btn.y + 35 + Math.cos(t * 1.1 + params.phase) * 1.0;
            mark.scaleX = 0.98 + 0.02 * Math.sin(t * 1.6 + params.phase);
            mark.scaleY = mark.scaleX;
          }
        }
      }
    }, 50);
  }

  // --- build UI grid with transparent buttons ---
  function buildGrid() {
    if (!__explorerRunning) return;

    modalOverlay.visible = false; modal.visible = false; modal._open = false;
    modalHeader.alpha = 0; modalCloseBtn.visible = false; modalCloseText.visible = false; modalContentText.alpha = 0; modalControls.alpha = 0;

    hideCreated();
    clearCreated();

    buttons = []; buttonTexts = []; buttonIcons = []; buttonMarkers = []; buttonOrigPos = []; textOrigPos = []; iconOrigPos = []; markerOrigPos = []; idleParams = [];

    try { entries = scanDirectory(currentPath); } catch (e) { entries = []; }

    filteredEntries = entries.filter(function (it) {
      if (!searchQuery) return true;
      return (it.name || '').toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1;
    });

    for (var i = 0; i < filteredEntries.length; i++) {
      var it = filteredEntries[i];
      var row = Math.floor(i / buttonsPerRow);
      var col = i % buttonsPerRow;
      var bx = startX + col * xSpacing;
      var by = startY + row * ySpacing;

      var iconUrl = it.isDir ? 'file:///assets/img/folder_icon.png' : 'file:///assets/img/file_icon.png';
      var icon = null;
      try {
        icon = new Image({ url: iconUrl, x: bx + 8, y: by + 10, width: 56, height: 56 });
        icon.alpha = 1; jsmaf.root.children.push(icon); pushCreated(icon);
      } catch (e) {
        try {
          icon = new Image({ url: 'file:///assets/img/file_icon.png', x: bx + 8, y: by + 10, width: 56, height: 56 });
          icon.alpha = 1; jsmaf.root.children.push(icon); pushCreated(icon);
        } catch (ex) {}
      }
      buttonIcons.push(icon);
      iconOrigPos.push({ x: bx + 8, y: by + 10 });

      // Button background: transparent image, only border will show
      var btn = null;
      try {
        btn = new Image({ url: TRANSPARENT_BUTTON_URL, x: bx, y: by, width: buttonWidth, height: buttonHeight });
        btn.alpha = 1; btn.scaleX = 1; btn.scaleY = 1;
        jsmaf.root.children.push(btn); pushCreated(btn); buttons.push(btn);
      } catch (e) { buttons.push(null); pushCreated(null); }

      var marker = null;
      try {
        marker = new Image({ url: 'file://../download0/img/ad_pod_marker.png', x: bx + buttonWidth - 50, y: by + 35, width: 12, height: 12, visible: false });
        marker.alpha = 0; marker.isOrangeDot = true;
        jsmaf.root.children.push(marker); pushCreated(marker); buttonMarkers.push(marker);
        markerOrigPos.push({ x: bx + buttonWidth - 50, y: by + 35 });
      } catch (e) { buttonMarkers.push(null); markerOrigPos.push(null); }

      var displayName = it.name || '';
      if (displayName.length > 36) displayName = displayName.substring(0, 33) + '...';

      var txt = null;
      try {
        txt = new jsmaf.Text(); txt.text = displayName; txt.x = bx + 80; txt.y = by + 28; txt.style = 'white'; txt.alpha = 1;
        jsmaf.root.children.push(txt); pushCreated(txt); buttonTexts.push(txt);
        textOrigPos.push({ x: bx + 80, y: by + 28 });
      } catch (e) { buttonTexts.push(null); textOrigPos.push(null); }

      try { if (btn) { btn._item = it; btn._index = i; } } catch (e) {}

      buttonOrigPos.push({ x: bx, y: by });

      idleParams.push({
        phase: Math.random() * Math.PI * 2,
        slowSpeed: 0.35 + Math.random() * 0.2,
        fastSpeed: 1.2 + Math.random() * 0.8,
        swayAmp: 4 + Math.random() * 4,
        bobAmp: 3 + Math.random() * 4,
        rotateAmp: 0.8 + Math.random() * 1.2
      });

      try { if (btn) { btn.alpha = 1; btn.y = by; } } catch (e) {}
      try { if (txt) { txt.alpha = 1; txt.y = by + 28; } } catch (e) {}
    }

    if (currentPath !== startPath) {
      var upBtnX = 130; var upBtnY = 180;
      try {
        var upBtn = new Image({ url: TRANSPARENT_BUTTON_URL, x: upBtnX, y: upBtnY, width: 180, height: 32 });
        upBtn.alpha = 1; jsmaf.root.children.push(upBtn); pushCreated(upBtn);
        var upTxt = new jsmaf.Text(); upTxt.text = '(Back Button)'; upTxt.x = upBtnX + 10; upTxt.y = upBtnY + 6; upTxt.style = 'white'; upTxt.alpha = 1; jsmaf.root.children.push(upTxt); pushCreated(upTxt);
        upBtn._isUp = true;
        buttons.unshift(upBtn);
        buttonTexts.unshift(upTxt);
        buttonIcons.unshift(null);
        buttonMarkers.unshift(null);
        buttonOrigPos.unshift({ x: upBtnX, y: upBtnY });
        textOrigPos.unshift({ x: upTxt.x, y: upTxt.y });
        iconOrigPos.unshift(null);
        markerOrigPos.unshift(null);
        idleParams.unshift({
          phase: Math.random() * Math.PI * 2,
          slowSpeed: 0.35 + Math.random() * 0.2,
          fastSpeed: 1.2 + Math.random() * 0.8,
          swayAmp: 2 + Math.random() * 2,
          bobAmp: 1 + Math.random() * 2,
          rotateAmp: 0.3 + Math.random() * 0.5
        });
      } catch (e) {}
    }

    currentButton = Math.max(0, Math.min(currentButton, buttons.length - 1));
    updateHighlight();
    startButtonIdleLoop();
    startOrangeDotLoop();
    startLogoLoop();

    breadcrumbText.visible = false;
    breadcrumbText.alpha = 0;
    try { pathTopLeft.text = currentPath; pathTopLeft.visible = true; } catch (e) {}

    startBgm();
  }

  // viewer functions (unchanged)
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
      var url = item.path.indexOf('file://') === 0 ? item.path : ('file://' + item.path);
      modalImage.url = url;
      modalImage.visible = true;
      modalContentText.alpha = 0;
      modalHeader.text = item.name || 'Image';
      modalOverlay.visible = true; modal.visible = true; modal._open = true;
      modalCloseBtn.visible = true; modalCloseText.visible = true;
      modalControls.alpha = 0;
      fadeOutBgm(1);
      _setTimeout(function () {
        try {
          if (!modalImage.visible) return;
          if (!modalImage.url || modalImage.url === '') {
            showModalText('Image error', 'Could not display image: invalid URL');
            fadeInBgm(1);
          }
        } catch (e) {}
      }, 800);
    } catch (e) {
      showModalText('Image error', 'Could not display image: ' + (e.message || e));
      fadeInBgm(1);
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
    fadeOutBgm(1);
    try {
      if (typeof jsmaf.VideoClip === 'function') {
        var url = item.path.indexOf('file://') === 0 ? item.path : ('file://' + item.path);
        modalVideo = new jsmaf.VideoClip({ url: url, x: 240, y: 200, width: 1440, height: 720 });
        modalVideo.visible = true;
        try { modalVideo.play(); modalControls.text = 'Square: Play/Pause  Circle: Close'; } catch (e) { modalControls.text = 'Video loaded'; }
      } else {
        modalControls.text = 'Video playback not supported';
        showModalText(item.name || 'Video', 'Playback not supported in this environment.');
        fadeInBgm(1);
      }
    } catch (e) {
      modalControls.text = 'Video error';
      showModalText('Video error', 'Could not play video: ' + (e.message || e));
      fadeInBgm(1);
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
    fadeOutBgm(1);
    try {
      modalAudio = new jsmaf.AudioClip();
      var url = item.path.indexOf('file://') === 0 ? item.path : ('file://' + item.path);
      modalAudio.open(url);
      try { modalAudio.play(); modalAudio._isPlaying = true; modalControls.text = 'Square: Play/Pause  Circle: Close'; } catch (e) { modalControls.text = 'Audio loaded'; }
    } catch (e) {
      modalControls.text = 'Audio playback not supported';
      showModalText(item.name || 'Audio', 'Playback not supported in this environment.');
      fadeInBgm(1);
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
    fadeOutBgm(1);
    previewFile(item.path, function (err, txt) {
      if (err) {
        showModalText('JS error', 'Could not read file: ' + (err.message || err));
        fadeInBgm(1);
        return;
      }
      modalContentText.text = txt || '(empty)';
      modalJsScrollOffset = 0;
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
    fadeInBgm(1);
    buildGrid();
    showCreated();
    try { pathTopLeft.visible = true; pathTopLeft.text = currentPath; } catch (e) {}
  }

  // --- highlight with transparent buttons and smaller RGB border ---
  var prevButton = -1;
  function updateHighlight() {
    if (!buttons || buttons.length === 0) return;
    if (currentButton < 0) currentButton = 0;
    if (currentButton >= buttons.length) currentButton = buttons.length - 1;

    // Reset all buttons to transparent background, no border
    for (var r = 0; r < buttons.length; r++) {
      try {
        var rb = buttons[r];
        if (!rb) continue;
        rb.url = TRANSPARENT_BUTTON_URL;
        rb.alpha = 0.95;
        rb.borderColor = 'transparent';
        rb.borderWidth = 0;
      } catch (e) {}
      try {
        if (buttonMarkers[r]) { buttonMarkers[r].visible = false; buttonMarkers[r].alpha = 0; }
      } catch (e) {}
    }

    // Apply selected visuals to current button: smaller RGB border (width 2)
    var i = currentButton;
    var b = buttons[i];
    if (b) {
      try {
        b.url = TRANSPARENT_BUTTON_URL;
        b.alpha = 1.0;
        b.borderColor = 'rgb(93, 93, 93)';
        b.borderWidth = 2; // reduced from 3 to 2
      } catch (e) {}
    }
    try {
      if (buttonMarkers[i]) { buttonMarkers[i].visible = true; buttonMarkers[i].alpha = 1; buttonMarkers[i].scaleX = 1; buttonMarkers[i].scaleY = 1; }
    } catch (e) {}

    prevButton = currentButton;
    try { pathTopLeft.visible = true; pathTopLeft.text = currentPath; } catch (e) {}
  }

  // --- input handlers (unchanged except minor adjustments) ---
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
    if (!__explorerRunning) return;
    updateCursorPosition(mx, my);
    showCursor();
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (!b) continue;
      try {
        if (mx >= b.x && my >= b.y && mx <= b.x + b.width && my <= b.y + b.height) {
          if (currentButton !== i) { currentButton = i; updateHighlight(); }
          return;
        }
      } catch (e) {}
    }
  };

  jsmaf.onMouseDown = function (mx, my, btn) {
    if (!__explorerRunning) return;
    updateCursorPosition(mx, my);
    showCursor();
    if (modal._open) {
      try {
        if (modalCloseBtn.visible && mx >= modalCloseBtn.x && my >= modalCloseBtn.y && mx <= modalCloseBtn.x + modalCloseBtn.width && my <= modalCloseBtn.y + modalCloseBtn.height) {
          closeModalAndResumeBgm();
          return;
        }
      } catch (e) {}
    }

    try {
      if (mx >= searchBox.x && my >= searchBox.y && mx <= searchBox.x + searchBox.width && my <= searchBox.y + searchBox.height) {
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

  function handleButtonAction(index) {
    if (!__explorerRunning) return;
    try {
      var b = buttons[index];
      if (!b) return;
      if (b._isUp) { navigateUp(); return; }
      var item = b._item;
      if (!item) return;
      if (item.isDir) {
        try {
          if (pathStack.length === 0 || pathStack[pathStack.length - 1] !== item.path) pathStack.push(item.path);
          currentPath = item.path;
          currentButton = 0;
          buildGrid();
        } catch (e) {}
      } else {
        var ext = extOf(item.name || '');
        if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') openImageViewer(item);
        else if (ext === 'mp4' || ext === 'mkv' || ext === 'webm') openVideoViewer(item);
        else if (ext === 'wav' || ext === 'mp3' || ext === 'ogg') openAudioViewer(item);
        else if (ext === 'js' || ext === 'json' || ext === 'txt') openJsViewer(item);
        else {
          previewFile(item.path, function (err, txt) {
            if (err) showModalText('Preview error', 'Could not preview file: ' + (err.message || err));
            else showModalText(item.name || 'Preview', txt || '(empty)');
          });
        }
      }
    } catch (e) { log('handleButtonAction err: ' + (e.message || e)); }
  }

  function navigateUp() {
    try {
      if (modal._open) { closeModalAndResumeBgm(); return; }
      if (!pathStack || pathStack.length <= 1 || currentPath === startPath) {
        try {
          try { fullUnload(); } catch (e) {}
          try { include('main-menu.js'); } catch (e) { log('Could not include main-menu.js: ' + (e.message || e)); }
          try { tryStartMainMenuBgm(); } catch (e) {}
          return;
        } catch (e) {
          try { fullUnload(); } catch (ee) {}
          try { include('main-menu.js'); } catch (e) { log('navigateUp include error: ' + (e.message || e)); }
          return;
        }
      } else {
        try {
          pathStack.pop();
          currentPath = pathStack[pathStack.length - 1] || startPath;
          currentButton = 0;
          buildGrid();
        } catch (e) {}
      }
    } catch (e) { log('navigateUp err: ' + (e.message || e)); }
  }

  jsmaf.onKeyDown = function (keyCode) {
    if (!__explorerRunning) return;
    try {
      if (keyCode === 6 || keyCode === 5 || keyCode === 22) { currentButton = (currentButton + 1) % buttons.length; updateHighlight(); return; }
      if (keyCode === 4 || keyCode === 7 || keyCode === 21) { currentButton = (currentButton - 1 + buttons.length) % buttons.length; updateHighlight(); return; }
      if (keyCode === 19 || keyCode === 20 || keyCode === 2) {
        if (modal._open && modalContentText && modalContentText.alpha === 1) { modalJsScrollOffset -= 28; modalContentText.y = 160 + modalJsScrollOffset; return; }
        var next = Math.min(buttons.length - 1, currentButton + buttonsPerRow);
        if (next !== currentButton) { currentButton = next; updateHighlight(); }
        return;
      }
      if (keyCode === 18 || keyCode === 17 || keyCode === 1) {
        if (modal._open && modalContentText && modalContentText.alpha === 1) { modalJsScrollOffset += 28; modalContentText.y = 160 + modalJsScrollOffset; return; }
        var prev = Math.max(0, currentButton - buttonsPerRow);
        if (prev !== currentButton) { currentButton = prev; updateHighlight(); }
        return;
      }
      if (keyCode === 14) {
        if (modal._open && (modalAudio || modalVideo)) { toggleModalPlayPause(); return; }
        handleButtonAction(currentButton);
        return;
      }
      if (keyCode === 1 || keyCode === 3 || keyCode === 8) { navigateUp(); return; }
      if (keyCode === 3 || keyCode === 12) { searchQuery = ''; searchText.text = 'Search: (Triangle to clear)'; buildGrid(); return; }
      if (keyCode === 27) { if (modal._open) closeModalAndResumeBgm(); return; }
    } catch (e) {}
  };

  (function startGamepadMouse() {
    var gpPollInterval = null;
    var gpSensitivity = 12.0;
    var gpDeadzone = 0.15;
    var lastGpButtons = [];
    var gpPollStepMs = 33;
    try {
      gpPollInterval = jsmaf.setInterval(function () {
        if (!__explorerRunning) { try { jsmaf.clearInterval(gpPollInterval); } catch (e) {} return; }
        try {
          if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
          var gps = navigator.getGamepads();
          if (!gps) return;
          var gp = gps[0];
          if (!gp) return;
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
          var btnCount = gp.buttons ? gp.buttons.length : 0;
          var pressed0 = (btnCount > 0) ? !!(gp.buttons[0] && (gp.buttons[0].pressed || gp.buttons[0].value > 0.5)) : false;
          var pressed1 = (btnCount > 1) ? !!(gp.buttons[1] && (gp.buttons[1].pressed || gp.buttons[1].value > 0.5)) : false;
          var pressed2 = (btnCount > 2) ? !!(gp.buttons[2] && (gp.buttons[2].pressed || gp.buttons[2].value > 0.5)) : false;
          var pressed3 = (btnCount > 3) ? !!(gp.buttons[3] && (gp.buttons[3].pressed || gp.buttons[3].value > 0.5)) : false;
          if (pressed0 && !lastGpButtons[0]) { try { jsmaf.onMouseDown(Math.round(virtualMouse.x), Math.round(virtualMouse.y), 0); } catch (e) {} }
          if (pressed1 && !lastGpButtons[1]) { try { navigateUp(); } catch (e) {} }
          if (pressed2 && !lastGpButtons[2]) { try { if (modal._open && (modalAudio || modalVideo)) toggleModalPlayPause(); } catch (e) {} }
          if (pressed3 && !lastGpButtons[3]) {
            try { searchQuery = ''; searchText.text = 'Search: (Triangle to clear)'; buildGrid(); } catch (e) {}
          }
          var pressedL2 = (btnCount > 6) ? !!(gp.buttons[6] && (gp.buttons[6].pressed || gp.buttons[6].value > 0.5)) : false;
          if (pressedL2 && !lastGpButtons[6]) {
            try {
              if (currentPath === startPath) {
                try { fullUnload(); } catch (e) {}
                try { include('main-menu.js'); } catch (e) {}
                try { tryStartMainMenuBgm(); } catch (e) {}
                return;
              } else {
                navigateUp();
              }
            } catch (e) {}
          }
          var lax = (gp.axes && gp.axes.length > 0) ? gp.axes[0] : 0;
          var lay = (gp.axes && gp.axes.length > 1) ? gp.axes[1] : 0;
          var navThreshold = 0.75;
          if (lax > navThreshold) { currentButton = Math.min(buttons.length - 1, currentButton + 1); updateHighlight(); }
          else if (lax < -navThreshold) { currentButton = Math.max(0, currentButton - 1); updateHighlight(); }
          else if (lay > navThreshold) { currentButton = Math.min(buttons.length - 1, currentButton + buttonsPerRow); updateHighlight(); }
          else if (lay < -navThreshold) { currentButton = Math.max(0, currentButton - buttonsPerRow); updateHighlight(); }
          lastGpButtons[0] = pressed0; lastGpButtons[1] = pressed1; lastGpButtons[2] = pressed2; lastGpButtons[3] = pressed3; lastGpButtons[6] = pressedL2;
        } catch (e) {}
      }, gpPollStepMs);
      _intervals.push(gpPollInterval);
    } catch (e) {}
  })();

  function enforceTextWhite() {
    for (var i = 0; i < buttonTexts.length; i++) {
      try {
        var t = buttonTexts[i];
        if (t && typeof t === 'object' && t.constructor && t.constructor.name === 'Text') t.style = 'white';
      } catch (e) {}
    }
    try { if (pathTopLeft && pathTopLeft.constructor && pathTopLeft.constructor.name === 'Text') pathTopLeft.style = 'small'; } catch (e) {}
  }

  function fullUnload() {
    try {
      if (!__explorerRunning) return;
      __explorerRunning = false;
    } catch (e) {}
    try {
      try { _clearAllIntervals(); } catch (e) {}
      try { _clearAllTimeouts(); } catch (e) {}
      try { if (_bgmFadeInterval) jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}
      if (logoAnimInterval) { jsmaf.clearInterval(logoAnimInterval); logoAnimInterval = null; }
      if (buttonIdleInterval) { jsmaf.clearInterval(buttonIdleInterval); buttonIdleInterval = null; }
      try {
        if (bgm) {
          try { if (typeof bgm.pause === 'function') bgm.pause(); } catch (e) {}
          try { if (typeof bgm.stop === 'function') bgm.stop(); } catch (e) {}
          try { bgm._isPlaying = false; } catch (e) {}
        }
      } catch (e) {}
      try { if (typeof global !== 'undefined' && global.__explorerBgm) delete global.__explorerBgm; } catch (e) {}
      try { if (typeof window !== 'undefined' && window.__explorerBgm) delete window.__explorerBgm; } catch (e) {}
      try { cleanupModalMedia(); } catch (e) {}
      try { if (modalVideo && typeof modalVideo.stop === 'function') modalVideo.stop(); } catch (e) {}
      try { if (modalAudio && typeof modalAudio.stop === 'function') modalAudio.stop(); } catch (e) {}
      try {
        if (jsmaf && jsmaf.root && Array.isArray(jsmaf.root.children)) {
          var preserved = null;
          try { if (pathTopLeft) preserved = pathTopLeft; } catch (e) {}
          jsmaf.root.children.length = 0;
          if (preserved) {
            try { jsmaf.root.children.push(preserved); } catch (e) {}
          }
        }
      } catch (e) {}
      try {
        createdElements = []; buttons = []; buttonTexts = []; buttonIcons = []; buttonMarkers = [];
        buttonOrigPos = []; textOrigPos = []; iconOrigPos = []; markerOrigPos = []; idleParams = [];
        bgm = null;
        modal = modalOverlay = modalHeader = modalCloseBtn = modalCloseText = modalContentText = modalImage = modalVideo = modalAudio = modalControls = null;
        cursor = background = logo = titleText = null;
      } catch (e) {}
      try { jsmaf.onMouseMove = function(){}; } catch (e) {}
      try { jsmaf.onMouseDown = function(){}; } catch (e) {}
      try { jsmaf.onKeyDown = function(){}; } catch (e) {}
      try { jsmaf.onKeyUp = function(){}; } catch (e) {}
      try { mouseHideTimeout = null; } catch (e) {}
      try { tryStartMainMenuBgm(); } catch (e) {}
    } catch (e) { log('fullUnload error: ' + (e.message || e)); }
  }

  // start
  try { startBgm(); } catch (e) {}
  try { buildGrid(); enforceTextWhite(); } catch (e) {}

})();