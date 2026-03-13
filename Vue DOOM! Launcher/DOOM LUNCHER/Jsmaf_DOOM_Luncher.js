/*
DOOM JSMAF Launcher

Copyright (c) 2026 MexrlDev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
*/

(function () {
  'use strict';

  // - - - CONFIG - - -
  var DISPLAY_W = 1920, DISPLAY_H = 1080;
  var MENU_ITEMS = ['Diagnostics', 'Load WAD (test)', 'Launch DOOM (full)', 'Toggle Music', 'Set WASM Path', 'Inject WAD to Engine', 'Console Mode', 'Exit'];
  var KEY_CONFIRM = 14; 
  var KEY_BACK   = 13;
  var KEY_DOWN   = 6;
  var KEY_UP     = 4;
  var KEY_CYCLE_BG = 15; 

  // Base path for all resources
  var BASE_PATH = 'file://../download0/payloads/DOOM/';
  var BG_BASE_PATH = BASE_PATH + 'bg/';

  var WAD_FILENAME = 'freedoom1.wad';
  var WAD_PATH = BASE_PATH + WAD_FILENAME;
  var WAD_PATH_SYSCALL = '/download0/payloads/DOOM/' + WAD_FILENAME; // for syscalls

  var ENGINE_JS_PATH = BASE_PATH + 'doom.js';
  var WASM_PATH = BASE_PATH + 'doom.wasm';
  var MUSIC_PATH = BASE_PATH + 'Main-Menu.wav';
  var MUSIC_PATH_FILEURL = MUSIC_PATH;
  var SAVE_FILE_PATH = BASE_PATH + 'save.json';
  var WAD_LOADED_JSON_PATH = BASE_PATH + 'wad_loaded.json';

  // - - - STATE - - -
  var layers = { background: [], ui: [] };
  var layerOrder = ['background', 'ui'];
  var selected = 0;
  var menuTexts = [];
  var wadLoaded = false;
  var loadedWadData = null;
  var doomModule = null;
  var isGameRunning = false;

  // music state
  var musicEnabled = true;
  if (typeof jsmaf !== 'undefined' && typeof jsmaf.bgm === 'undefined') {
    jsmaf.bgm = null;
  }
  var backgroundMusic = null;
  var BGM_MAX_RETRIES = 8;

// Just default lol
  var currentBgIndex = 0;
  var bgImageObject = null; // jsmaf.Image

  // --- Scrollable console ---
  var consoleMessages = [];
  var MAX_CONSOLE_LINES = 100;
  var consoleScroll = 0;
  var consoleActive = false;
  var consoleLines = [];
  var CONSOLE_VISIBLE_LINES = 10;
  var CONSOLE_X = 60;
  var CONSOLE_Y = 685;
  var CONSOLE_LINE_HEIGHT = 26;

  // --- Engine display objects ---
  var engineCanvas = null;
  var engineCtx = null;
  var engineImageData = null;
  var engineWidth = 0;
  var engineHeight = 0;

  // - - - HELPER: ensure jsmaf.root exists - - -
  function ensureRoot() {
    if (typeof jsmaf === 'undefined') return false;
    if (!jsmaf.root) try { jsmaf.root = { children: [] }; } catch (e) { return false; }
    if (!Array.isArray(jsmaf.root.children)) jsmaf.root.children = [];
    return true;
  }

  function rebuildRootChildren() {
    if (!ensureRoot()) return;
    var children = [];
    for (var i = 0; i < layerOrder.length; i++) {
      var arr = layers[layerOrder[i]] || [];
      for (var j = 0; j < arr.length; j++) if (arr[j]) children.push(arr[j]);
    }
    jsmaf.root.children.length = 0;
    for (var k = 0; k < children.length; k++) jsmaf.root.children.push(children[k]);
  }

  function clearLayers() {
    for (var k in layers) if (layers.hasOwnProperty(k)) layers[k].length = 0;
  }

  // - - - UI STYLES - - -
  function safeNewStyle(name, props) {
    try { new Style(Object.assign({ name: name }, props)); } catch (e) {}
  }

  // - - - CONSOLE MESSAGE HANDLING - - -
  function addConsoleMessage(msg) {
    var s = String(msg);
    consoleMessages.push(s);
    if (consoleMessages.length > MAX_CONSOLE_LINES) {
      consoleMessages.shift();
    }
    if (!consoleActive) {
      consoleScroll = 0;
    } else {
      if (consoleScroll === 0) {
      } else {
      }
    }
    updateConsoleDisplay();
    try { log('[DOOM] ' + s); } catch (e) {}
  }

  var appStatusSet = addConsoleMessage;

  function updateConsoleDisplay() {
    if (!consoleLines.length) return;
    var total = consoleMessages.length;
    var maxScroll = Math.max(0, total - CONSOLE_VISIBLE_LINES);
    if (consoleScroll > maxScroll) consoleScroll = maxScroll;
    if (consoleScroll < 0) consoleScroll = 0;

    var startIdx = total - CONSOLE_VISIBLE_LINES - consoleScroll;
    if (startIdx < 0) startIdx = 0;
    for (var i = 0; i < CONSOLE_VISIBLE_LINES; i++) {
      var lineObj = consoleLines[i];
      if (!lineObj) continue;
      var msgIdx = startIdx + i;
      if (msgIdx < total) {
        lineObj.text = consoleMessages[msgIdx];
      } else {
        lineObj.text = '';
      }
    }
  }

  // - - - VIEWPORT UTIL - - -
  function getViewportSize() {
    try {
      if (typeof window !== 'undefined') {
        var doc = document.documentElement || {};
        var w = window.innerWidth || doc.clientWidth || DISPLAY_W;
        var h = window.innerHeight || doc.clientHeight || DISPLAY_H;
        // Ensure numeric fallback
        w = (typeof w === 'number' && isFinite(w)) ? Math.max(1, Math.floor(w)) : DISPLAY_W;
        h = (typeof h === 'number' && isFinite(h)) ? Math.max(1, Math.floor(h)) : DISPLAY_H;
        return { width: w, height: h };
      }
    } catch (e) {}
    return { width: DISPLAY_W, height: DISPLAY_H };
  }

  // - - - BACKGROUND IMAGE HANDLING - - -
  function applyBackground() {
    // Remove old background image if any
    if (bgImageObject && layers.background.indexOf(bgImageObject) !== -1) {
      var idx = layers.background.indexOf(bgImageObject);
      if (idx !== -1) layers.background.splice(idx, 1);
      bgImageObject = null;
    }
    if (currentBgIndex === 0) {
      rebuildRootChildren();
      return;
    }
    var imgPath = BG_BASE_PATH + 'DOOM_' + currentBgIndex + '.jpg';
    try {
      var vp = getViewportSize();

      var img = new jsmaf.Image();
      img.x = 0;
      img.y = 0;
      img.width = vp.width;
      img.height = vp.height;
      img.src = imgPath;

      try { img.stretch = true; } catch (e) {}
      try { img.preserveAspect = false; } catch (e) {}
      try { img.scaleMode = 'stretch'; } catch (e) {}
      try { img.scaling = 'fill'; } catch (e) {}

      layers.background.push(img);
      bgImageObject = img;
      addConsoleMessage('Background set to ' + imgPath + ' (stretched to ' + vp.width + 'x' + vp.height + ')');
    } catch (e) {
      addConsoleMessage('Failed to load background image: ' + (e && e.message));
      currentBgIndex = 0;
    }
    rebuildRootChildren();
  }

  function cycleBackground() {
    currentBgIndex++;
    if (currentBgIndex > 2) currentBgIndex = 0;
    applyBackground();
    saveSettings(); 
  }

  try {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', function () {
        try {
          if (currentBgIndex !== 0) applyBackground();
          rebuildRootChildren();
        } catch (e) {}
      });
    }
  } catch (e) {}

  // - - - PERSISTENT SETTINGS (save.json) - - -
  function saveSettings() {
    var settings = {
      bgIndex: currentBgIndex,
      musicMuted: !musicEnabled
    };
    var jsonString = JSON.stringify(settings, null, 2);
    addConsoleMessage('Saving settings to ' + SAVE_FILE_PATH);
    writeFile(SAVE_FILE_PATH, jsonString, function (err) {
      if (err) addConsoleMessage('ERROR saving settings: ' + err.message);
      else addConsoleMessage('Settings saved.');
    });
  }

  function loadSettings(callback) {
    readFileViaSys('/download0/payloads/DOOM/save.json', function (err, data) {
      if (!err && data) {
        try {
          var text = String.fromCharCode.apply(null, new Uint8Array(data));
          var settings = JSON.parse(text);
          applyLoadedSettings(settings);
          if (callback) callback(true);
          return;
        } catch (e) {
          addConsoleMessage('Failed to parse syscall save.json: ' + e.message);
        }
      }
      readFileViaXHR('save.json', function (err2, data2, path) {
        if (!err2 && data2) {
          try {
            var text2 = String.fromCharCode.apply(null, new Uint8Array(data2));
            var settings2 = JSON.parse(text2);
            applyLoadedSettings(settings2);
          } catch (e2) {
            addConsoleMessage('Failed to parse XHR save.json: ' + e2.message);
          }
        } else {
          addConsoleMessage('No save.json found, using defaults.');
        }
        if (callback) callback();
      });
    });
  }

  function applyLoadedSettings(settings) {
    if (settings.hasOwnProperty('bgIndex')) {
      currentBgIndex = settings.bgIndex;
      applyBackground();
    }
    if (settings.hasOwnProperty('musicMuted')) {
      var shouldBeMuted = settings.musicMuted;
      if (shouldBeMuted && musicEnabled) {
        musicEnabled = false;
        stopBgm();
        addConsoleMessage('Music muted (from save)');
      } else if (!shouldBeMuted && !musicEnabled) {
        musicEnabled = true;
        playBackgroundMusic();
        addConsoleMessage('Music enabled (from save)');
      }
    }
    updateMenuHighlight();
  }

  // - - - BACKGROUND MUSIC - - -
  function createBgmInstance() {
    try {
      if (typeof jsmaf !== 'undefined') {
        if (!jsmaf.bgm) {
          try {
            jsmaf.bgm = new jsmaf.AudioClip();
            try { jsmaf.bgm.volume = 0.5; } catch (e) {}
            jsmaf.bgm.opened = false;
          } catch (e) {
            jsmaf.bgm = null;
            addConsoleMessage('createBgm: jsmaf.AudioClip constructor failed: ' + e.message);
          }
        }
        return jsmaf.bgm;
      }
    } catch (e) {
      addConsoleMessage('createBgm unexpected: ' + (e && e.message));
    }
    return null;
  }

  function _doPlayBgmClip(bgm) {
    try {
      if (!bgm) return false;
      if (typeof bgm.stop === 'function') {
        try { bgm.stop(); } catch (e) {}
      }
      if (typeof bgm.play === 'function') {
        try {
          bgm.play(true);
          return true;
        } catch (e) {
          try {
            bgm.play();
            if (typeof bgm.loop === 'boolean') bgm.loop = true;
            return true;
          } catch (e2) {
            addConsoleMessage('bgm.play failed: ' + (e2 && e2.message));
            return false;
          }
        }
      }
      return false;
    } catch (e) {
      addConsoleMessage('_doPlayBgmClip exception: ' + (e && e.message));
      return false;
    }
  }

  function tryPlayBgm(retries) {
    retries = typeof retries === 'number' ? retries : 0;
    var maxRetries = BGM_MAX_RETRIES;

    try {
      if (!musicEnabled) { addConsoleMessage('Music disabled by config'); return; }

      var bgm = createBgmInstance();
      if (bgm) {
        if (!bgm.opened && typeof bgm.open === 'function') {
          try {
            bgm.open(MUSIC_PATH_FILEURL);
            bgm.opened = true;
          } catch (e) {
            bgm.opened = false;
            addConsoleMessage('bgm.open failed: ' + (e && e.message));
          }
        }

        if (_doPlayBgmClip(bgm)) {
          addConsoleMessage('Background music started (jsmaf.AudioClip)');
          return;
        } else {
          addConsoleMessage('jsmaf.AudioClip present but play failed (try ' + retries + ')');
        }
      }

      if (typeof jsmaf !== 'undefined' && typeof jsmaf.Audio === 'function') {
        try {
          if (backgroundMusic) {
            try { backgroundMusic.pause && backgroundMusic.pause(); } catch (e) {}
            backgroundMusic = null;
          }
          backgroundMusic = new jsmaf.Audio(MUSIC_PATH);
          try { backgroundMusic.loop = true; } catch (e) {}
          try { backgroundMusic.volume = 0.5; } catch (e) {}
          if (typeof backgroundMusic.play === 'function') {
            backgroundMusic.play();
            addConsoleMessage('Background music started (jsmaf.Audio)');
            return;
          }
        } catch (e) {
          addConsoleMessage('jsmaf.Audio fallback failed: ' + (e && e.message));
        }
      }

      if (typeof Audio !== 'undefined') {
        try {
          if (backgroundMusic) {
            try { backgroundMusic.pause && backgroundMusic.pause(); } catch (e) {}
          }
          backgroundMusic = new Audio(MUSIC_PATH);
          backgroundMusic.loop = true;
          backgroundMusic.volume = 0.5;
          var p = backgroundMusic.play();
          if (p && typeof p.then === 'function') {
            p.then(function () {
              addConsoleMessage('Background music started (Audio)');
            }).catch(function (err) {
              addConsoleMessage('Audio play failed: ' + (err && err.message));
            });
          } else {
            addConsoleMessage('Background music started (Audio)');
          }
          return;
        } catch (e) {
          addConsoleMessage('Jsmaf Audio fallback failed: ' + (e && e.message));
        }
      }

      addConsoleMessage('No audio API available â music disabled');
    } catch (e) {
      addConsoleMessage('tryPlayBgm unexpected error: ' + (e && e.message));
    }

    if (retries < maxRetries) {
      var delay = (typeof jsmaf !== 'undefined' && typeof jsmaf.setTimeout === 'function') ? jsmaf.setTimeout : window.setTimeout;
      delay(function () {
        try {
          if (jsmaf && jsmaf.bgm && !jsmaf.bgm.opened && typeof jsmaf.bgm.open === 'function') {
            try { jsmaf.bgm.open(MUSIC_PATH_FILEURL); jsmaf.bgm.opened = true; } catch (e) { /* ignore */ }
          }
        } catch (e) {}
        tryPlayBgm(retries + 1);
      }, 150);
    } else {
      addConsoleMessage('bgm: reached max retries, giving up until next toggle.');
    }
  }

  function stopBgm() {
    try {
      if (jsmaf && jsmaf.bgm) {
        try { if (typeof jsmaf.bgm.stop === 'function') jsmaf.bgm.stop(); } catch (e) {}
        try { if (typeof jsmaf.bgm.close === 'function') jsmaf.bgm.close(); } catch (e) {}
        jsmaf.bgm.opened = false;
      }
    } catch (e) {}
    try {
      if (backgroundMusic) {
        try { backgroundMusic.pause && backgroundMusic.pause(); } catch (e) {}
        try { backgroundMusic.src = ''; } catch (e) {}
        backgroundMusic = null;
      }
    } catch (e) {}
  }

  function playBackgroundMusic() {
    try {
      tryPlayBgm(0);
    } catch (e) {
      addConsoleMessage('playBackgroundMusic error: ' + (e && e.message));
    }
  }

  function toggleMusic() {
    musicEnabled = !musicEnabled;
    if (musicEnabled) {
      playBackgroundMusic();
      addConsoleMessage('Music toggled ON');
    } else {
      stopBgm();
      addConsoleMessage('Music toggled OFF');
    }
    saveSettings();
    updateMenuHighlight();
  }

  // - - - BACKGROUND - - -
  function createBackground() {
    if (!layers.background) layers.background = [];
  }

  // - - - BUILD MENU UI - - -
  function buildMenuUI() {
    clearLayers();
    if (!ensureRoot()) return;

    safeNewStyle('titleStyle', { color: 'white', size: 52, bold: true, shadow: true });
    safeNewStyle('itemStyle', { color: 'white', size: 28, bold: false, shadow: true });
    safeNewStyle('consoleStyle', { color: 'white', size: 22, bold: false, shadow: false });

    createBackground();

    // Title
    var title = new jsmaf.Text();
    try { title.style = 'titleStyle'; } catch (e) {}
    title.x = DISPLAY_W / 2 - 300;
    title.y = 80;
    title.text = 'DOOM Launcher â v.Alpha Testing';
    layers.ui.push(title);

    // Menu items
    menuTexts = [];
    var startY = 220;
    for (var i = 0; i < MENU_ITEMS.length; i++) {
      var t = new jsmaf.Text();
      try { t.style = 'itemStyle'; } catch (e) {}
      t.x = DISPLAY_W / 2 - 180;
      t.y = startY + i * 60;
      var label = MENU_ITEMS[i];
      if (label === 'Toggle Music') label = label + ' (' + (musicEnabled ? 'On' : 'Off') + ')';
      if (label === 'Set WASM Path') label = label + ' [' + WASM_PATH.replace(BASE_PATH, './DOOM/') + ']';
      if (label === 'Inject WAD to Engine') {
        label = label + (loadedWadData ? ' (WAD loaded)' : ' (WAD missing)');
      }
      t.text = (i === selected ? '> ' : '  ') + label;
      layers.ui.push(t);
      menuTexts.push(t);
    }

    // Console area
    consoleLines = [];
    for (var j = 0; j < CONSOLE_VISIBLE_LINES; j++) {
      var line = new jsmaf.Text();
      try { line.style = 'consoleStyle'; } catch (e) {}
      line.x = CONSOLE_X;
      line.y = CONSOLE_Y + j * CONSOLE_LINE_HEIGHT;
      line.text = '';
      layers.ui.push(line);
      consoleLines.push(line);
    }

    // Apply current background
    applyBackground();

    rebuildRootChildren();
    updateConsoleDisplay();
    addConsoleMessage('Menu ready. Use D-pad, X to select. "Console Mode" to scroll logs. Triangle cycles background.');
  }

  function updateMenuHighlight() {
    for (var i = 0; i < menuTexts.length; i++) {
      try {
        var label = MENU_ITEMS[i];
        if (label === 'Toggle Music') label = label + ' (' + (musicEnabled ? 'On' : 'Off') + ')';
        if (label === 'Set WASM Path') label = label + ' [' + WASM_PATH.replace(BASE_PATH, './DOOM/') + ']';
        if (label === 'Inject WAD to Engine') label = label + (loadedWadData ? ' (WAD loaded)' : ' (WAD missing)');
        menuTexts[i].text = (i === selected ? '> ' : '  ') + label;
        menuTexts[i].color = (i === selected ? 'rgb(100,200,255)' : 'white');
      } catch (e) {}
    }
  }

  // - - - SYSCALL-BASED FILE READER - - -
  function readFileViaSys(path, callback) {
    if (typeof mem === 'undefined' || typeof fn === 'undefined' || typeof fn.open_sys !== 'function') {
      return callback(new Error('syscall API missing'));
    }
    try {
      var paddr = mem.malloc(path.length + 1);
      for (var i = 0; i < path.length; i++) mem.view(paddr).setUint8(i, path.charCodeAt(i));
      mem.view(paddr).setUint8(path.length, 0);

      var fd = fn.open_sys(paddr, new BigInt(0, 0), new BigInt(0, 0));
      var BAD_FD = new BigInt(0xffffffff, 0xffffffff);
      if (fd && fd.eq && fd.eq(BAD_FD)) {
        return callback(new Error('open_sys failed'));
      }
      var fdn = fd instanceof BigInt ? Number(fd.lo) : fd;

      var CHUNK = 64 * 1024;
      var chunks = [];
      var total = 0;
      var tmp = mem.malloc(CHUNK);
      while (true) {
        var r = fn.read_sys(new BigInt(0, fdn), tmp, new BigInt(0, CHUNK));
        var rnum = r instanceof BigInt ? Number(r.lo) : r;
        if (rnum <= 0) break;
        var arr = new Uint8Array(rnum);
        for (var t = 0; t < rnum; t++) arr[t] = mem.view(tmp).getUint8(t);
        chunks.push(arr);
        total += rnum;
        if (rnum < CHUNK) break;
      }
      try { fn.close_sys(fdn); } catch (e) {}

      var out = new ArrayBuffer(total);
      var outv = new Uint8Array(out);
      var pos = 0;
      for (var c = 0; c < chunks.length; c++) {
        outv.set(chunks[c], pos);
        pos += chunks[c].length;
      }
      callback(null, out, path);
    } catch (er) {
      callback(new Error('syscall exception: ' + (er && er.message)));
    }
  }

  // - - - XHR FALLBACK - - -
  function readFileViaXHR(filename, callback) {
    var fullPath = filename.indexOf('file://') === 0 ? filename : BASE_PATH + filename;
    var candidates = [
      fullPath,
      '/download0/payloads/DOOM/' + filename,
      'file://..' + '/download0/payloads/DOOM/' + filename,
      './payloads/DOOM/' + filename,
      '/payloads/DOOM/' + filename
    ];

    var XHR = (typeof jsmaf !== 'undefined' && typeof jsmaf.XMLHttpRequest === 'function')
              ? jsmaf.XMLHttpRequest
              : (typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest : null);
    if (!XHR) {
      return callback(new Error('XHR not available'));
    }

    var i = 0;
    function tryNext() {
      if (i >= candidates.length) {
        return callback(new Error('all XHR paths failed'));
      }
      var path = candidates[i++];
      var xhr = new XHR();
      var done = false;
      var timer = setTimeout(function () {
        if (!done) {
          try { xhr.abort(); } catch (e) {}
          addConsoleMessage('XHR timeout: ' + path);
          tryNext();
        }
      }, 3000);

      try { xhr.responseType = 'arraybuffer'; } catch (e) {}
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        done = true;
        clearTimeout(timer);
        if (xhr.status === 0 || xhr.status === 200) {
          var resp = xhr.response || xhr.responseText;
          if (resp instanceof ArrayBuffer) {
            callback(null, resp, path);
          } else if (typeof resp === 'string') {
            var ab = new ArrayBuffer(resp.length);
            var v = new Uint8Array(ab);
            for (var j = 0; j < resp.length; j++) v[j] = resp.charCodeAt(j) & 0xff;
            callback(null, ab, path);
          } else {
            callback(new Error('unexpected response type'));
          }
        } else {
          addConsoleMessage('XHR status ' + xhr.status + ' for ' + path);
          tryNext();
        }
      };
      try { xhr.overrideMimeType && xhr.overrideMimeType('text/plain; charset=x-user-defined'); } catch (e) {}
      try {
        xhr.open('GET', path, true);
        xhr.send();
      } catch (e) {
        clearTimeout(timer);
        addConsoleMessage('XHR exception: ' + path + ' -> ' + (e && e.message));
        tryNext();
      }
    }
    tryNext();
  }

  // - - - WRITE JSON FILE - - -
  function writeFile(path, content, callback) {
    var XHR = (typeof jsmaf !== 'undefined' && typeof jsmaf.XMLHttpRequest === 'function')
              ? jsmaf.XMLHttpRequest
              : (typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest : null);
    if (!XHR) {
      if (callback) callback(new Error('XHR not available for writing'));
      return;
    }
    var xhr = new XHR();
    var done = false;
    var timer = setTimeout(function () {
      if (!done) {
        try { xhr.abort(); } catch (e) {}
        if (callback) callback(new Error('write timeout'));
      }
    }, 3000);

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      done = true;
      clearTimeout(timer);
      if (xhr.status === 0 || xhr.status === 200) {
        if (callback) callback(null);
      } else {
        if (callback) callback(new Error('write failed, status=' + xhr.status));
      }
    };
    try {
      xhr.open('POST', path, true);
      xhr.send(content);
    } catch (e) {
      clearTimeout(timer);
      if (callback) callback(e);
    }
  }

  // - - - SAVE WAD LOADED STATE - - -
  function writeWadLoadedJson(loaded) {
    var dataObj = { loaded: loaded };
    var jsonString = JSON.stringify(dataObj, null, 2);
    addConsoleMessage('Updating wad_loaded.json to ' + loaded);
    writeFile(WAD_LOADED_JSON_PATH, jsonString, function (err) {
      if (err) addConsoleMessage('ERROR saving wad_loaded.json: ' + err.message);
      else addConsoleMessage('wad_loaded.json saved (loaded=' + loaded + ')');
    });
  }

  // - - - LOAD WAD TEST - - -
  function loadWadTest() {
    addConsoleMessage('Attempting to read ' + WAD_FILENAME + ' via syscalls...');
    readFileViaSys(WAD_PATH_SYSCALL, function (err, ab, usedPath) {
      if (!err && ab && ab.byteLength > 0) {
        wadLoaded = true;
        loadedWadData = ab;
        addConsoleMessage('SYSCALL SUCCESS: ' + usedPath + ' size=' + ab.byteLength + ' bytes. WAD is accessible.');
        writeWadLoadedJson(true);
        updateMenuHighlight();
        return;
      }
      addConsoleMessage('Syscall failed (' + (err ? err.message : 'unknown') + '). Trying XHR...');
      readFileViaXHR(WAD_FILENAME, function (err2, ab2, usedPath2) {
        if (!err2 && ab2 && ab2.byteLength > 0) {
          wadLoaded = true;
          loadedWadData = ab2;
          addConsoleMessage('XHR SUCCESS: ' + usedPath2 + ' size=' + ab2.byteLength + ' bytes.');
          writeWadLoadedJson(true);
          updateMenuHighlight();
        } else {
          wadLoaded = false;
          loadedWadData = null;
          addConsoleMessage('XHR also failed. Last error: ' + (err2 ? err2.message : 'unknown') + '. Check file location.');
          writeWadLoadedJson(false);
          updateMenuHighlight();
        }
      });
    });
  }

  // - - - RENDERING - - -
  function ensureEngineCanvas(width, height) {
    if (engineCanvas && engineWidth === width && engineHeight === height) return;
    if (engineCanvas) {
      try { engineCanvas.parentNode && engineCanvas.parentNode.removeChild(engineCanvas); } catch (e) {}
      engineCanvas = null;
      engineCtx = null;
      engineImageData = null;
    }
    engineWidth = width;
    engineHeight = height;
    try {
      var c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      var sx = Math.max(1, Math.floor(DISPLAY_W / width));
      var sy = Math.max(1, Math.floor(DISPLAY_H / height));
      var scale = Math.max(1, Math.min(sx, sy));
      c.style.width = (width * scale) + 'px';
      c.style.height = (height * scale) + 'px';
      c.style.position = 'fixed';
      c.style.left = '8px';
      c.style.top = '8px';
      c.style.zIndex = 999999;
      c.style.imageRendering = 'pixelated';
      c.title = 'DOOM (canvas)';
      document.body && document.body.appendChild(c);
      engineCanvas = c;
      engineCtx = c.getContext('2d');
      engineImageData = engineCtx.createImageData(width, height);
    } catch (e) {
      addConsoleMessage('Failed to create engine canvas: ' + (e && e.message));
      engineCanvas = null;
      engineCtx = null;
      engineImageData = null;
    }
  }

  function update_jsmaf_screen(pixelBuffer, width, height) {
    try {
      addConsoleMessage('Rendering frame ' + width + 'x' + height);
      if (!pixelBuffer) return;
      var bytes;
      if (pixelBuffer instanceof ArrayBuffer) bytes = new Uint8ClampedArray(pixelBuffer);
      else if (ArrayBuffer.isView(pixelBuffer)) bytes = new Uint8ClampedArray(pixelBuffer.buffer, pixelBuffer.byteOffset || 0, pixelBuffer.byteLength || (pixelBuffer.length));
      else if (pixelBuffer.buffer && pixelBuffer.byteLength !== undefined) bytes = new Uint8ClampedArray(pixelBuffer.buffer);
      else {
        addConsoleMessage('update_jsmaf_screen: unsupported buffer type');
        return;
      }

      if (bytes.length < width * height * 4) {
        addConsoleMessage('update_jsmaf_screen: buffer too small (' + bytes.length + ') for ' + width + 'x' + height);
        return;
      }

      ensureEngineCanvas(width, height);
      if (!engineCtx || !engineImageData) {
        addConsoleMessage('Rendering unavailable: no canvas');
        return;
      }

      engineImageData.data.set(bytes.subarray(0, width * height * 4));
      engineCtx.putImageData(engineImageData, 0, 0);
    } catch (e) {
      addConsoleMessage('update_jsmaf_screen exception: ' + (e && e.message));
    }
  }

  // - - - INJECT WAD TO ENGINE - - -
  function injectWadToEngine() {
    if (!loadedWadData) {
      addConsoleMessage('No WAD data loaded. Use Load WAD (test) first.');
      return;
    }
    if (!doomModule && (typeof window.Module !== 'undefined')) {
      doomModule = window.Module;
    }
    if (!doomModule) {
      addConsoleMessage('Engine not loaded. Launch engine first (Launch DOOM (full)).');
      return;
    }

    try {
      if (doomModule.FS && typeof doomModule.FS.writeFile === 'function') {
        var u8 = (loadedWadData instanceof ArrayBuffer) ? new Uint8Array(loadedWadData) : (loadedWadData instanceof Uint8Array ? loadedWadData : new Uint8Array(loadedWadData));
        doomModule.FS.writeFile(WAD_FILENAME, u8);
        addConsoleMessage('WAD written to engine FS at runtime (' + u8.length + ' bytes).');
        try {
          if (typeof doomModule.FS.listFiles === 'function') {
            addConsoleMessage('Engine FS files: ' + doomModule.FS.listFiles().join(', '));
          }
        } catch (ee) {}
        return;
      }

      var mod = doomModule || window.Module;
      var inst = (mod && mod.instance) ? mod.instance : (mod && mod.exports ? { exports: mod.exports } : null);
      if (inst && inst.exports && typeof inst.exports.receive_wad === 'function') {
        var recv = inst.exports.receive_wad;
      } else if (inst && inst.exports && typeof inst.exports.receiveWAD === 'function') {
        var recv = inst.exports.receiveWAD;
      } else {
        recv = null;
      }

      if (recv && inst.exports.malloc && inst.exports.free) {
        var bytes = (loadedWadData instanceof ArrayBuffer) ? new Uint8Array(loadedWadData) : new Uint8Array(loadedWadData);
        var len = bytes.length;
        var ptr = inst.exports.malloc(len);
        if (!ptr || ptr === 0) {
          addConsoleMessage('malloc failed in wasm to inject WAD');
          return;
        }
        try {
          var memBuf = (mod.wasmMemory && mod.wasmMemory.buffer) ? new Uint8Array(mod.wasmMemory.buffer) : null;
          if (!memBuf && inst.exports.memory) memBuf = new Uint8Array(inst.exports.memory.buffer);
          if (!memBuf) {
            addConsoleMessage('No accessible wasm memory to inject WAD');
            try { inst.exports.free(ptr); } catch (e) {}
            return;
          }
          memBuf.set(bytes, ptr);
          recv(ptr, len);
          addConsoleMessage('WAD injected via receive_wad(ptr,len).');
        } catch (e) {
          addConsoleMessage('Error while injecting WAD: ' + (e && e.message));
        } finally {
          try { inst.exports.free(ptr); } catch (e) {}
        }
        return;
      }

      addConsoleMessage('No supported runtime injection method available (no FS.writeFile, no receive_wad).');
    } catch (e) {
      addConsoleMessage('injectWadToEngine exception: ' + (e && e.message));
    }
  }

  // - - - LAUNCH DOOM - - -
  function launchDoomFull() {
    if (!wadLoaded) {
      addConsoleMessage('Cannot launch: WAD not loaded. Use Load WAD (test) first.');
      return;
    }
    if (!loadedWadData) {
      addConsoleMessage('Internal error: WAD data missing.');
      return;
    }

    addConsoleMessage('Loading DOOM engine from ' + ENGINE_JS_PATH + ' ...');

    try {
      window.Module = window.Module || {};
      (function(orig) {
        window.Module.locateFile = function(path) {
          if (typeof path === 'string' && path.toLowerCase().endsWith('.wasm')) {
            return WASM_PATH;
          }
          if (typeof orig === 'function') return orig(path);
          return path;
        };
      })(window.Module.locateFile);
    } catch (e) {
      addConsoleMessage('Could not set Module.locateFile: ' + (e && e.message));
    }

    try {
      var script = document.createElement('script');
      script.src = ENGINE_JS_PATH;
      script.async = true;
      var loaded = false;

      script.onload = function () {
        loaded = true;
        addConsoleMessage('Engine script loaded. Initializing...');
        if (typeof window.Module === 'undefined') {
          addConsoleMessage('ERROR: Engine did not define Module global.');
          wadLoaded = false;
          writeWadLoadedJson(false);
          return;
        }
        doomModule = window.Module;
        doomModule.update_jsmaf_screen = update_jsmaf_screen;

        try {
          if (!doomModule.FS || typeof doomModule.FS.writeFile !== 'function') {
            addConsoleMessage('ERROR: Engine FS.writeFile not available.');
            try { injectWadToEngine(); } catch (e2) {}
          } else {
            var u8 = (loadedWadData instanceof ArrayBuffer) ? new Uint8Array(loadedWadData) : (loadedWadData instanceof Uint8Array ? loadedWadData : new Uint8Array(loadedWadData));
            doomModule.FS.writeFile(WAD_FILENAME, u8);
            addConsoleMessage('WAD written to engine FS (' + u8.length + ' bytes).');
            try {
              if (typeof doomModule.FS.listFiles === 'function') {
                addConsoleMessage('Engine FS files: ' + doomModule.FS.listFiles().join(', '));
              } else if (doomModule.FS.files) {
                addConsoleMessage('Engine FS has ' + Object.keys(doomModule.FS.files).length + ' files');
              }
            } catch (e) { /* ignore */ }
          }
        } catch (e) {
          addConsoleMessage('ERROR writing WAD to engine FS: ' + (e && e.message));
        }

        wadLoaded = false;
        writeWadLoadedJson(false);
        updateMenuHighlight();
        isGameRunning = true;

        try {
          if (typeof doomModule.callMain !== 'function') {
            addConsoleMessage('ERROR: engine.callMain not found; trying Module.run...');
            if (typeof doomModule.run === 'function') {
              doomModule.run(['-iwad', WAD_FILENAME]);
              addConsoleMessage('Engine run() invoked.');
            } else {
              addConsoleMessage('ERROR: no callMain/run found on Module.');
              isGameRunning = false;
              return;
            }
          } else {
            doomModule.callMain(['-iwad', WAD_FILENAME]);
            addConsoleMessage('DOOM started via callMain.');
          }
        } catch (e) {
          addConsoleMessage('ERROR starting DOOM: ' + (e && e.message));
          isGameRunning = false;
        }
      };

      script.onerror = function () {
        if (loaded) return;
        addConsoleMessage('FATAL: Could not load engine script at ' + ENGINE_JS_PATH);
        wadLoaded = false;
        writeWadLoadedJson(false);
      };

      if (document && document.head) {
        document.head.appendChild(script);
      } else if (typeof include === 'function') {
        try {
          include(ENGINE_JS_PATH);
          if (typeof window.Module !== 'undefined') {
            doomModule = window.Module;
            doomModule.update_jsmaf_screen = update_jsmaf_screen;
            try {
              var u8 = (loadedWadData instanceof ArrayBuffer) ? new Uint8Array(loadedWadData) : (loadedWadData instanceof Uint8Array ? loadedWadData : new Uint8Array(loadedWadData));
              doomModule.FS.writeFile(WAD_FILENAME, u8);
              writeWadLoadedJson(false);
              if (typeof doomModule.callMain === 'function') doomModule.callMain(['-iwad', WAD_FILENAME]);
              else if (typeof doomModule.run === 'function') doomModule.run(['-iwad', WAD_FILENAME]);
            } catch (e) {
              addConsoleMessage('ERROR after include(): ' + (e && e.message));
            }
          } else {
            addConsoleMessage('include() did not set Module global.');
          }
        } catch (e) {
          addConsoleMessage('include() failed: ' + (e && e.message));
        }
      } else {
        addConsoleMessage('Cannot load engine script â no document.head or include().');
        wadLoaded = false;
        writeWadLoadedJson(false);
      }
    } catch (e) {
      addConsoleMessage('Exception while loading engine script: ' + (e && e.message));
    }
  }

  // - - - DIAGNOSTICS - - -
  function runDiagnostics() {
    var out = [];
    function push(k, v) { out.push(k + ': ' + v); }

    push('Date', new Date().toISOString());
    push('jsmaf', typeof jsmaf !== 'undefined' ? 'present' : 'missing');
    push('jsmaf.root', (typeof jsmaf !== 'undefined' && !!jsmaf.root) ? 'present' : 'missing');
    push('jsmaf.root.children', (typeof jsmaf !== 'undefined' && jsmaf.root && Array.isArray(jsmaf.root.children)) ? ('len=' + jsmaf.root.children.length) : 'n/a');
    push('XMLHttpRequest', (typeof jsmaf !== 'undefined' && typeof jsmaf.XMLHttpRequest === 'function') ? 'jsmaf.XMLHttpRequest' : (typeof XMLHttpRequest !== 'undefined' ? 'window.XMLHttpRequest' : 'missing'));
    push('document', typeof document !== 'undefined' ? 'present' : 'missing');
    push('include()', typeof include === 'function' ? 'present' : 'missing');
    push('log()', typeof log === 'function' ? 'present' : 'missing');
    push('fn (syscalls)', typeof fn !== 'undefined' ? 'present' : 'missing');
    push('mem (sysmem)', typeof mem !== 'undefined' ? 'present' : 'missing');
    push('debugging', typeof debugging !== 'undefined' ? 'present' : 'missing');
    push('WASM_PATH', WASM_PATH);
    push('musicEnabled', musicEnabled ? 'true' : 'false');
    push('bgIndex', currentBgIndex);

    if (typeof fn !== 'undefined' && typeof mem !== 'undefined' && typeof fn.open_sys === 'function') {
      try {
        var path = WAD_PATH_SYSCALL;
        var paddr = mem.malloc(path.length + 1);
        for (var i = 0; i < path.length; i++) mem.view(paddr).setUint8(i, path.charCodeAt(i));
        mem.view(paddr).setUint8(path.length, 0);
        var fd = fn.open_sys(paddr, new BigInt(0, 0), new BigInt(0, 0));
        var fdStr = String(fd);
        try { if (fd && !(fd instanceof BigInt && fd.hi === 0xffffffff)) fn.close_sys(fd); } catch (e) {}
        push('sys_open("' + WAD_PATH_SYSCALL + '")', fdStr);
      } catch (e) {
        push('sys_open exception', e && e.message);
      }
    } else {
      push('sys_open', 'not available');
    }

    for (var idx = 0; idx < out.length; idx++) {
      addConsoleMessage(out[idx]);
    }

    var candidates = [
      WAD_PATH,
      '/download0/payloads/DOOM/' + WAD_FILENAME,
      'file://..' + '/download0/payloads/DOOM/' + WAD_FILENAME,
      './payloads/DOOM/' + WAD_FILENAME,
      '/payloads/DOOM/' + WAD_FILENAME
    ];

    var XHR = (typeof jsmaf !== 'undefined' && typeof jsmaf.XMLHttpRequest === 'function')
              ? jsmaf.XMLHttpRequest
              : (typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest : null);
    if (!XHR) {
      addConsoleMessage('XHR unavailable â cannot probe paths.');
      return;
    }

    var results = [];
    function probeXhrList(list, idx) {
      if (idx >= list.length) {
        addConsoleMessage('--- XHR probe results ---');
        for (var r = 0; r < results.length; r++) {
          addConsoleMessage(results[r]);
        }
        return;
      }
      var p = list[idx];
      try {
        var xhr = new XHR();
        var timer = setTimeout(function () {
          try { xhr.abort && xhr.abort(); } catch (e) {}
          results.push(p + ' => TIMEOUT');
          probeXhrList(list, idx + 1);
        }, 2000);
        try { xhr.responseType = 'arraybuffer'; } catch (e) {}
        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 4) return;
          clearTimeout(timer);
          var st = xhr.status;
          var resp = xhr.response || xhr.responseText;
          var rtype = (resp instanceof ArrayBuffer) ? 'ArrayBuffer' : (typeof resp === 'string' ? 'string' : typeof resp);
          var len = resp && resp.byteLength ? resp.byteLength : (resp && resp.length ? resp.length : '0');
          results.push(p + ' => status=' + st + ' type=' + rtype + ' len=' + len);
          probeXhrList(list, idx + 1);
        };
        try { xhr.overrideMimeType && xhr.overrideMimeType('text/plain; charset=x-user-defined'); } catch (e) {}
        xhr.open('GET', p, true);
        xhr.send();
      } catch (e) {
        results.push(p + ' => XHR EXCEPTION: ' + (e && e.message));
        probeXhrList(list, idx + 1);
      }
    }
    probeXhrList(candidates, 0);
  }

  // - - - KEY HANDLING - - -
  function bindKeys() {
    jsmaf.onKeyDown = function (keyCode) {
      if (keyCode === KEY_CYCLE_BG) {
        cycleBackground();
        return;
      }

      if (consoleActive) {
        if (keyCode === KEY_UP) {
          consoleScroll++;
          updateConsoleDisplay();
          return;
        }
        if (keyCode === KEY_DOWN) {
          if (consoleScroll > 0) consoleScroll--;
          updateConsoleDisplay();
          return;
        }
        if (keyCode === KEY_BACK || keyCode === KEY_CONFIRM) {
          consoleActive = false;
          addConsoleMessage('Exited console mode. Use D-pad for menu.');
          updateMenuHighlight();
          return;
        }
      } else {
        // Menu mode
        if (keyCode === KEY_DOWN) {
          selected = (selected + 1) % MENU_ITEMS.length;
          updateMenuHighlight();
          return;
        }
        if (keyCode === KEY_UP) {
          selected = (selected - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
          updateMenuHighlight();
          return;
        }
        if (keyCode === KEY_CONFIRM) {
          var sel = MENU_ITEMS[selected];
          if (sel === 'Diagnostics') {
            addConsoleMessage('Running diagnostics...');
            runDiagnostics();
          } else if (sel === 'Load WAD (test)') {
            loadWadTest();
          } else if (sel === 'Launch DOOM (full)') {
            launchDoomFull();
          } else if (sel === 'Toggle Music') {
            toggleMusic();
          } else if (sel === 'Set WASM Path') {
            try {
              var newPath = null;
              if (typeof jsmaf !== 'undefined' && typeof jsmaf.prompt === 'function') {
                newPath = jsmaf.prompt('Enter WASM path', WASM_PATH);
              } else if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
                newPath = window.prompt('Enter WASM path for doom.wasm', WASM_PATH);
              }
              if (newPath && typeof newPath === 'string') {
                WASM_PATH = newPath;
                addConsoleMessage('WASM path set to: ' + WASM_PATH);
                updateMenuHighlight();
              } else {
                addConsoleMessage('WASM path unchanged.');
              }
            } catch (e) {
              addConsoleMessage('Set WASM Path failed: ' + (e && e.message));
            }
          } else if (sel === 'Inject WAD to Engine') {
            injectWadToEngine();
          } else if (sel === 'Console Mode') {
            consoleActive = true;
            addConsoleMessage('Console mode active. Use D-Pad Up/Down to scroll, O to exit.');
            consoleScroll = 0;
            updateConsoleDisplay();
          } else if (sel === 'Exit') {
            try { debugging.restart(); } catch (e) { addConsoleMessage('Exit requested'); }
          }
          return;
        }
        if (keyCode === KEY_BACK) {
          try { debugging.restart(); } catch (e) { addConsoleMessage('Back pressed'); }
        }
      }
    };
    jsmaf.onKeyUp = function () {};
  }

  // - - - INIT - - -
  function init() {
    if (!ensureRoot()) {
      try { log('jsmaf.root not available â aborting'); } catch (e) {}
      return;
    }
    safeNewStyle('titleStyle', { color: 'white', size: 48, bold: true, shadow: true });
    safeNewStyle('itemStyle', { color: 'white', size: 28, bold: false, shadow: true });
    buildMenuUI();
    bindKeys();
    updateMenuHighlight();

    loadSettings(function () {
      if (musicEnabled) {
        playBackgroundMusic();
      }
      addConsoleMessage('Menu live. Load WAD, then Launch DOOM (full).');
    });
  }

  init();

  // Expose for debugging......
  window.__jsmaf_doom_launcher = {
    init: init,
    runDiagnostics: runDiagnostics,
    loadWadTest: loadWadTest,
    launchDoomFull: launchDoomFull,
    wadLoaded: function() { return wadLoaded; },
    _update_jsmaf_screen: update_jsmaf_screen,
    stopBgm: stopBgm,
    playBgm: function() { playBackgroundMusic(); },
    toggleMusic: toggleMusic,
    setWasmPath: function(p) { WASM_PATH = p || WASM_PATH; updateMenuHighlight(); addConsoleMessage('WASM_PATH set to ' + WASM_PATH); },
    injectWad: injectWadToEngine,
    addConsoleMessage: addConsoleMessage,
    cycleBackground: cycleBackground
  };

})();
