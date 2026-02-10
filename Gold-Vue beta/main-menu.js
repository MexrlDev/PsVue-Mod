(function () {

  include('languages.js');

  log(lang.loadingMainMenu);

  var currentButton = 0;
  var buttons = [];
  var buttonTexts = [];
  var buttonMarkers = [];
  var buttonOrigPos = [];
  var textOrigPos = [];
  var markerOrigPos = [];
  var normalButtonImg = 'file:///../download0/img/button_over_9.png';
  var selectedButtonImg = 'file:///../download0/img/button_over_9.png';

  // -- reset scene
  jsmaf.root.children.length = 0;

  new Style({ name: 'white', color: 'white', size: 24 });
  new Style({ name: 'title', color: 'white', size: 32 });

  // global root (for persistence across includes/pages)
  var __globalRoot = (typeof global !== 'undefined') ? global : ((typeof window !== 'undefined') ? window : ((typeof self !== 'undefined') ? self : this || {}));

  // persistent flags (survive includes/navigation)
  if (typeof __globalRoot.__musicEnabled === 'undefined') __globalRoot.__musicEnabled = true; // music ON by default
  if (typeof __globalRoot.__clickEnabled === 'undefined') __globalRoot.__clickEnabled = false; // click SFX OFF by default

  var musicEnabled = !!__globalRoot.__musicEnabled;
  var clickEnabled = !!__globalRoot.__clickEnabled;

  function persistFlags() {
    try { __globalRoot.__musicEnabled = !!musicEnabled; } catch (e) {}
    try { __globalRoot.__clickEnabled = !!clickEnabled; } catch (e) {}
  }

  // BGM management
  var bgm = null;
  var bgmReloadTimer = null;
  var _bgmFadeInterval = null;
  var defaultBgmReloadMs = 156000; // fallback 2:36

  function clearBgmReloadTimer() {
    try { if (bgmReloadTimer) jsmaf.clearTimeout(bgmReloadTimer); } catch (e) {}
    bgmReloadTimer = null;
  }

  function getBgmDurationMs() {
    try {
      if (!bgm) return defaultBgmReloadMs;
      if (typeof bgm.duration === 'number' && bgm.duration > 0) return Math.round(bgm.duration * 1000);
      if (typeof bgm.length === 'number' && bgm.length > 0) return Math.round(bgm.length * 1000);
      if (typeof bgm._duration === 'number' && bgm._duration > 0) return Math.round(bgm._duration * 1000);
      if (bgm.metadata && typeof bgm.metadata.duration === 'number' && bgm.metadata.duration > 0) return Math.round(bgm.metadata.duration * 1000);
    } catch (e) {}
    return defaultBgmReloadMs;
  }

  function scheduleBgmReload() {
    clearBgmReloadTimer();
    if (!musicEnabled || !bgm) return;
    try {
      var durMs = getBgmDurationMs();
      if (!isFinite(durMs) || durMs <= 1000) durMs = defaultBgmReloadMs;
      if (durMs > 10 * 60 * 1000) durMs = defaultBgmReloadMs;
      var scheduleMs = Math.max(1000, durMs - 500);
      bgmReloadTimer = jsmaf.setTimeout(function () {
        try { reloadSong(); } catch (e) {}
        try { scheduleBgmReload(); } catch (e) {}
      }, scheduleMs);
    } catch (e) { bgmReloadTimer = null; }
  }

  // Keep references to original play/stop on the instance so we can force-stop when user disables music.
  function protectBgmInstance(instance) {
    try {
      if (!instance) return;
      // store originals on the instance itself (avoid global confusion)
      try { if (!instance._originalStop && typeof instance.stop === 'function') instance._originalStop = instance.stop.bind(instance); } catch (e) {}
      try { if (!instance._originalPlay && typeof instance.play === 'function') instance._originalPlay = instance.play.bind(instance); } catch (e) {}
      instance._protected = true;

      // override stop to ignore external calls unless force === true
      instance.stop = function (force) {
        try {
          // if caller didn't pass force and instance is protected, ignore external stops
          if (!force && instance._protected) return;
          // otherwise call the original stop bound to this instance
          if (instance._originalStop) instance._originalStop();
        } catch (e) {}
      };

      // override play to ensure state is tracked
      instance.play = function () {
        try {
          if (instance._originalPlay) instance._originalPlay();
          instance._isPlaying = true;
        } catch (e) {}
      };
    } catch (e) {}
  }

  function reloadSong() {
    try {
      if (!bgm || !bgm._valid) return;
      if (!musicEnabled) return;
      // force stop using original stop if available, otherwise call stop with force
      try {
        if (bgm._originalStop) bgm._originalStop();
        else if (typeof bgm.stop === 'function') bgm.stop(true);
      } catch (e) {}
      try { bgm._isPlaying = false; } catch (e) {}
      try { if (typeof bgm.open === 'function') bgm.open('file://../download0/sfx/bgm.wav'); } catch (e) {}
      try { bgm.loop = true; } catch (e) {}
      try {
        var prevOnEnded = bgm.onended;
        bgm.onended = function () {
          try { if (prevOnEnded) prevOnEnded(); } catch (e) {}
          try { bgm._isPlaying = false; } catch (e) {}
          try { if (musicEnabled) { bgm.play(); bgm._isPlaying = true; } } catch (e) {}
        };
      } catch (e) {}
      try { if (musicEnabled && typeof bgm.play === 'function') { bgm.play(); bgm._isPlaying = true; } } catch (e) {}
      try { bgm._startedOnce = true; } catch (e) {}
    } catch (e) { log('bgm reload error: ' + (e.message || e)); }
  }

  function createPersistentBgm() {
    try {
      var inst = new jsmaf.AudioClip();
      // set a sane default volume for fade-in
      try { inst.volume = 0; } catch (e) {}
      try { if (typeof inst.open === 'function') inst.open('file://../download0/sfx/bgm.wav'); } catch (e) {}
      try { inst.loop = true; } catch (e) {}
      try {
        var prevOnEnded = inst.onended;
        inst.onended = function () {
          try { if (prevOnEnded) prevOnEnded(); } catch (e) {}
          try { inst._isPlaying = false; } catch (e) {}
          try { if (musicEnabled) { inst.play(); inst._isPlaying = true; } } catch (e) {}
        };
      } catch (e) {}
      inst._valid = true;
      inst._isPlaying = false;
      inst._startedOnce = false;
      protectBgmInstance(inst);
      try { __globalRoot.__persistentBgm = inst; } catch (e) {}
      return inst;
    } catch (e) { log('createPersistentBgm error: ' + (e.message || e)); return null; }
  }

  // initialize persistent bgm if present (do not recreate if user disabled music)
  if (__globalRoot.__persistentBgm && __globalRoot.__persistentBgm._valid) {
    bgm = __globalRoot.__persistentBgm;
    try { if (bgm._isPlaying) bgm._startedOnce = true; } catch (e) {}
    protectBgmInstance(bgm);
  } else {
    if (musicEnabled) {
      bgm = createPersistentBgm();
    } else {
      bgm = null;
    }
  }

  function startBgm() {
    try {
      if (!musicEnabled) return;
      if (!bgm) bgm = createPersistentBgm();
      if (!bgm || !bgm._valid) return;
      if (bgm._startedOnce) {
        if (bgm._isPlaying) {
          if (!bgmReloadTimer) scheduleBgmReload();
        } else {
          try { bgm.play(); bgm._isPlaying = true; } catch (e) {}
          if (!bgmReloadTimer) scheduleBgmReload();
        }
        return;
      }
      try { if (typeof bgm.play === 'function') { bgm.play(); bgm._isPlaying = true; } } catch (e) {}
      bgm._startedOnce = true;
      scheduleBgmReload();
    } catch (e) { log('startBgm error: ' + (e.message || e)); }
    if (_bgmFadeInterval) try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}
    var elapsed = 0; var dur = 300; var step = 50;
    _bgmFadeInterval = jsmaf.setInterval(function () { elapsed += step; var t = Math.min(elapsed / dur, 1); try { if (bgm) bgm.volume = 0.45 * t; } catch (e) {} if (t >= 1) { try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {} _bgmFadeInterval = null; } }, step);
  }

  // Force-stop and remove persistent bgm instance completely
  function stopBgmCompletely() {
    try {
      musicEnabled = false;
      persistFlags();
      clearBgmReloadTimer();
      if (bgm && bgm._valid) {
        try {
          // temporarily disable protection so we can stop and release the instance
          try { bgm._protected = false; } catch (e) {}
          // call original stop if available
          try { if (bgm._originalStop) bgm._originalStop(); } catch (e) {}
          // call stop with force to be certain
          try { if (typeof bgm.stop === 'function') bgm.stop(true); } catch (e) {}
          // if the object exposes close or release, attempt that too
          try { if (typeof bgm.close === 'function') bgm.close(); } catch (e) {}
          try { if (typeof bgm.unload === 'function') bgm.unload(); } catch (e) {}
        } catch (e) {}
        try { bgm._isPlaying = false; } catch (e) {}
        try { bgm._startedOnce = false; } catch (e) {}
        try { bgm._valid = false; } catch (e) {}
      }
      try { delete __globalRoot.__persistentBgm; } catch (e) {}
      try { bgm = null; } catch (e) {}
    } catch (e) { log('stopBgmCompletely error: ' + (e.message || e)); }
  }

  function enableBgm() {
    try {
      musicEnabled = true;
      persistFlags();
      if (!bgm) {
        bgm = createPersistentBgm();
      } else {
        // ensure the instance is fresh and valid
        try { if (typeof bgm.open === 'function') bgm.open('file://../download0/sfx/bgm.wav'); } catch (e) {}
        try { bgm.loop = true; } catch (e) {}
        try { bgm._valid = true; } catch (e) {}
        try { protectBgmInstance(bgm); } catch (e) {}
      }
      startBgm();
    } catch (e) { log('enableBgm error: ' + (e.message || e)); }
  }

  // A single toggle function that reliably mutes/unmutes and persists state.
  function toggleBgm() {
    try {
      if (musicEnabled) {
        // disable music immediately and ensure any persistent instance is stopped and released
        stopBgmCompletely();
        updateMusicStateTop();
        log('Music disabled by user.');
      } else {
        // enable music and start fresh
        enableBgm();
        updateMusicStateTop();
        log('Music enabled by user.');
      }
    } catch (e) { log('toggleBgm error: ' + (e.message || e)); }
  }

  // Click/load SFX: ephemeral instances so they never interfere with persistent bgm
  function playClick() {
    try {
      if (!clickEnabled) return;
      var s = new jsmaf.AudioClip();
      try { s.open('file://../download0/sfx/click.wav'); } catch (e) {}
      try { s._valid = true; } catch (e) {}
      try { if (typeof s.play === 'function') { s.play(); s._isPlaying = true; } } catch (e) {}
      jsmaf.setTimeout(function () {
        try { if (typeof s.stop === 'function') s.stop(); } catch (e) {}
        try { s._isPlaying = false; } catch (e) {}
      }, 220);
    } catch (e) { log('playClick error: ' + (e.message || e)); }
  }

  function playLoadBlip() {
    try {
      var s = new jsmaf.AudioClip();
      try { s.open('file://../download0/sfx/load.wav'); } catch (e) {}
      try { s._valid = true; } catch (e) {}
      try { if (typeof s.play === 'function') { s.play(); s._isPlaying = true; } } catch (e) {}
      jsmaf.setTimeout(function () {
        try { if (typeof s.stop === 'function') s.stop(); } catch (e) {}
        try { s._isPlaying = false; } catch (e) {}
      }, 220);
    } catch (e) { log('playLoadBlip error: ' + (e.message || e)); }
  }

  // visual elements
  var background = new Image({ url: 'file:///../download0/img/multiview_bg_VAF.png', x: 0, y: 0, width: 1920, height: 1080 });
  background.alpha = 0;
  background._baseX = background.x;
  background._baseY = background.y;
  jsmaf.root.children.push(background);

  var centerX = 960;
  var logoWidth = 600;
  var logoHeight = 338;

  var logo = new Image({ url: 'file:///../download0/img/logo.png', x: centerX - logoWidth / 2, y: 50, width: logoWidth, height: logoHeight });
  logo.alpha = 0; logo.scaleX = 0.98; logo.scaleY = 0.98;
  jsmaf.root.children.push(logo);

  var menuOptions = [
    { label: lang.jailbreak, script: 'loader.js', imgKey: 'jailbreak' },
    { label: lang.payloadMenu, script: 'payload_host.js', imgKey: 'payloadMenu' },
    { label: lang.config, script: 'config_ui.js', imgKey: 'config' },
    { label: (lang.fileExplorer || 'File Explorer'), script: 'file-explorer.js', imgKey: 'explorer' }
  ];

  var startY = 450;
  var buttonSpacing = 120;
  var buttonWidth = 400;
  var buttonHeight = 80;

  // create main menu option buttons with centered text
  for (var i = 0; i < menuOptions.length; i++) {
    var btnX = centerX - buttonWidth / 2;
    var btnY = startY + i * buttonSpacing;

    var shadow = new Image({ url: 'file:///assets/img/button_shadow.png', x: btnX + 6, y: btnY + 8, width: buttonWidth, height: buttonHeight });
    shadow.alpha = 0; jsmaf.root.children.push(shadow);

    var button = new Image({ url: normalButtonImg, x: btnX, y: btnY, width: buttonWidth, height: buttonHeight });
    button.alpha = 0; button.scaleX = 1.0; button.scaleY = 1.0; button.elevation = 2;
    buttons.push(button);
    jsmaf.root.children.push(button);

    var marker = new Image({ url: 'file:///assets/img/ad_pod_marker.png', x: btnX + buttonWidth - 50, y: btnY + 35, width: 12, height: 12, visible: false });
    marker.alpha = 0; marker._glowPhase = 0; marker.isOrangeDot = true;
    buttonMarkers.push(marker);
    jsmaf.root.children.push(marker);

    var btnText;
    if (typeof useImageText !== 'undefined' && useImageText) {
      btnText = new Image({ url: (typeof textImageBase !== 'undefined' ? textImageBase : '') + menuOptions[i].imgKey + '.png', x: btnX + 20, y: btnY + 15, width: 300, height: 50 });
    } else {
      btnText = new jsmaf.Text();
      btnText.text = menuOptions[i].label;
      btnText.x = btnX + buttonWidth / 2;
      btnText.y = btnY + buttonHeight / 2 - 12;
      try { btnText.align = 'center'; } catch (e) {}
      btnText.style = 'white';
    }
    btnText.alpha = 0;

    buttonTexts.push(btnText);
    jsmaf.root.children.push(btnText);

    buttonOrigPos.push({ x: btnX, y: btnY });
    textOrigPos.push({ x: btnText.x, y: btnText.y });
    markerOrigPos.push({ x: btnX + buttonWidth - 50, y: btnY + 35 });
  }

  // Controls row: Exit, Toggle Music, Toggle Click (no reload buttons in UI)
  var gap = 18;
  var controlCount = 3;
  var totalW = buttonWidth * controlCount + gap * (controlCount - 1);
  var leftX = centerX - totalW / 2;
  var exitX = leftX;
  var musicToggleX = leftX + (buttonWidth + gap) * 1;
  var clickToggleX = leftX + (buttonWidth + gap) * 2;
  var exitY = startY + menuOptions.length * buttonSpacing + 40;

  var exitIndex = -1;
  var musicToggleIndex = -1;
  var clickToggleIndex = -1;

  function createControlButton(x, y, label) {
    var shadow = new Image({ url: 'file:///assets/img/button_shadow.png', x: x + 6, y: y + 8, width: buttonWidth, height: buttonHeight });
    shadow.alpha = 0; jsmaf.root.children.push(shadow);
    var btn = new Image({ url: normalButtonImg, x: x, y: y, width: buttonWidth, height: buttonHeight });
    btn.alpha = 0; jsmaf.root.children.push(btn);
    var idx = buttons.length;
    buttons.push(btn);
    var marker = new Image({ url: 'file:///assets/img/ad_pod_marker.png', x: x + buttonWidth - 50, y: y + 35, width: 12, height: 12, visible: false });
    marker.alpha = 0; marker.isOrangeDot = true; buttonMarkers.push(marker); jsmaf.root.children.push(marker);
    var txt;
    if (typeof useImageText !== 'undefined' && useImageText) {
      txt = new Image({ url: (typeof textImageBase !== 'undefined' ? textImageBase : '') + label + '.png', x: x + 20, y: y + 15, width: 300, height: 50 });
    } else {
      txt = new jsmaf.Text();
      txt.text = label;
      txt.x = x + buttonWidth / 2;
      txt.y = y + buttonHeight / 2 - 12;
      try { txt.align = 'center'; } catch (e) {}
      txt.style = 'white';
    }
    txt.alpha = 0;
    jsmaf.root.children.push(txt);
    buttonTexts.push(txt);
    buttonOrigPos.push({ x: x, y: y });
    textOrigPos.push({ x: txt.x, y: txt.y });
    markerOrigPos.push({ x: x + buttonWidth - 50, y: y + 35 });
    return idx;
  }

  // create control buttons (no reload buttons)
  exitIndex = createControlButton(exitX, exitY, lang.exit || 'Exit');
  musicToggleIndex = createControlButton(musicToggleX, exitY, 'Toggle Music');
  clickToggleIndex = createControlButton(clickToggleX, exitY, 'Toggle Click');

  // Top-left state texts (visible)
  var musicStateTop = new jsmaf.Text();
  musicStateTop.text = musicEnabled ? 'Music: ON' : 'Music: OFF';
  musicStateTop.x = 20;
  musicStateTop.y = 20;
  try { musicStateTop.align = 'left'; } catch (e) {}
  musicStateTop.style = 'white';
  musicStateTop.alpha = 1;
  jsmaf.root.children.push(musicStateTop);

  var clickStateTop = new jsmaf.Text();
  clickStateTop.text = clickEnabled ? 'Click SFX: ON' : 'Click SFX: OFF';
  clickStateTop.x = 20;
  clickStateTop.y = 48;
  try { clickStateTop.align = 'left'; } catch (e) {}
  clickStateTop.style = 'white';
  clickStateTop.alpha = 1;
  jsmaf.root.children.push(clickStateTop);

  function updateMusicStateTop() {
    try {
      musicStateTop.text = musicEnabled ? 'Music: ON' : 'Music: OFF';
      musicStateTop.alpha = 1;
    } catch (e) {}
  }
  function updateClickStateTop() {
    try {
      clickStateTop.text = clickEnabled ? 'Click SFX: ON' : 'Click SFX: OFF';
      clickStateTop.alpha = 1;
    } catch (e) {}
  }

  // CURSOR SUPPORT
  var virtualMouse = { x: 960, y: 540 };
  var cursorSize = { w: 28, h: 28 };
  var lastRealMouseTime = 0;
  var mouseVisible = false;
  var mouseHideTimeout = null;
  var mouseInactivityMs = 2000;
  var mouseActive = false;
  var mouseActiveTimeout = null;

  var cursor = new Image({ url: 'file:///../download0/img/cursor.png', x: virtualMouse.x - cursorSize.w / 2, y: virtualMouse.y - cursorSize.h / 2, width: cursorSize.w, height: cursorSize.h });
  cursor.alpha = 1;
  cursor.visible = false;
  cursor._isCursor = true;
  jsmaf.root.children.push(cursor);

  function showCursor() {
    mouseVisible = true;
    cursor.visible = true;
    lastRealMouseTime = Date.now();
    if (mouseHideTimeout) { try { jsmaf.clearTimeout(mouseHideTimeout); } catch (e) {} mouseHideTimeout = null; }
    mouseHideTimeout = jsmaf.setTimeout(function () {
      var now = Date.now();
      if (now - lastRealMouseTime >= mouseInactivityMs) {
        cursor.visible = false;
        mouseVisible = false;
      }
      mouseHideTimeout = null;
    }, mouseInactivityMs);
    mouseActive = true;
    if (mouseActiveTimeout) try { jsmaf.clearTimeout(mouseActiveTimeout); } catch (e) {}
    mouseActiveTimeout = jsmaf.setTimeout(function () { mouseActive = false; mouseActiveTimeout = null; }, 3000);
  }

  function updateCursorPosition(x, y) {
    virtualMouse.x = x;
    virtualMouse.y = y;
    cursor.x = Math.round(virtualMouse.x - cursorSize.w / 2);
    cursor.y = Math.round(virtualMouse.y - cursorSize.h / 2);
    lastRealMouseTime = Date.now();
    if (!cursor.visible) cursor.visible = true;
  }

  // state & intervals
  var _intervals = [];
  var prevButton = -1;
  var _markerPulseInterval = null;
  var _logoAnimInterval = null;
  var _buttonIdleInterval = null;

  function _setInterval(fn, ms) { var id = jsmaf.setInterval(fn, ms); _intervals.push(id); return id; }
  function _clearAllIntervals() {
    for (var i = 0; i < _intervals.length; i++) { try { jsmaf.clearInterval(_intervals[i]); } catch (e) {} }
    _intervals = [];
    if (_markerPulseInterval) { try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {} _markerPulseInterval = null; }
    if (_logoAnimInterval) { try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {} _logoAnimInterval = null; }
    if (_bgmFadeInterval) { try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {} _bgmFadeInterval = null; }
    if (_buttonIdleInterval) { try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {} _buttonIdleInterval = null; }
  }

  // easing helper
  function easeInOut(t) { return (1 - Math.cos(t * Math.PI)) / 2; }

  // generic animate helper
  function animate(obj, from, to, duration, onStep, done) {
    var elapsed = 0; var step = 16;
    var id = _setInterval(function () {
      elapsed += step; var t = Math.min(elapsed / duration, 1); var e = easeInOut(t);
      for (var k in to) { var f = (from && from[k] !== undefined) ? from[k] : (obj[k] || 0); obj[k] = f + (to[k] - f) * e; }
      if (onStep) onStep(e);
      if (t >= 1) { try { jsmaf.clearInterval(id); } catch (e2) {} if (done) done(); }
    }, step);
    return id;
  }

  // logo loop
  function startLogoLoop() {
    var phase = 0;
    if (_logoAnimInterval) try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}
    _logoAnimInterval = jsmaf.setInterval(function () {
      phase += 0.02;
      logo.y = 50 + Math.sin(phase) * 4;
      logo.scaleX = 0.99 + Math.sin(phase * 0.9) * 0.01;
      logo.scaleY = logo.scaleX;
      if (background) { background.x = background._baseX + Math.sin(phase * 0.4) * 6; }
    }, 16);
    _intervals.push(_logoAnimInterval);
  }

  // button idle animation loop (subtle movement)
  function startButtonIdleLoop() {
    if (_buttonIdleInterval) try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {}
    var phase = 0;
    _buttonIdleInterval = jsmaf.setInterval(function () {
      phase += 0.03;
      for (var i = 0; i < buttons.length; i++) {
        try {
          var b = buttons[i];
          var t = buttonTexts[i];
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
            if (t) { t.x = Math.round(b.x + buttonWidth / 2); t.y = Math.round(b.y + buttonHeight / 2 - 12); }
          } catch (e) {}
        } catch (e) {}
      }
    }, 16);
    _intervals.push(_buttonIdleInterval);
  }

  // entrance sequence
  function entrance() {
    // Start BGM immediately when animations start so bgm is playing before any load SFX
    try { if (musicEnabled) enableBgm(); } catch (e) {}

    animate(background, { alpha: 0 }, { alpha: 1 }, 800);
    animate(logo, { alpha: 0, scaleX: 0.95, scaleY: 0.95 }, { alpha: 1, scaleX: 1.0, scaleY: 1.0 }, 900);

    var btnDelayBase = 220;
    var btnDelayStep = 140;
    var btnDuration = 1200;

    for (var i = 0; i < buttons.length; i++) {
      (function (idx) {
        var b = buttons[idx]; var t = buttonTexts[idx]; var m = buttonMarkers[idx];
        var delay = btnDelayBase + idx * btnDelayStep;
        jsmaf.setTimeout(function () {
          animate(b, { alpha: 0, y: buttonOrigPos[idx].y + 28 }, { alpha: 1, y: buttonOrigPos[idx].y }, btnDuration);
          var targetAlpha = (t.alpha > 0 && t.alpha < 1) ? t.alpha : 1;
          animate(t, { alpha: 0, y: textOrigPos[idx].y + 28 }, { alpha: targetAlpha, y: textOrigPos[idx].y }, btnDuration);
          if (m) {
            var mo = markerOrigPos[idx] || { x: (buttonOrigPos[idx] ? buttonOrigPos[idx].x + buttonWidth - 50 : 0), y: (buttonOrigPos[idx] ? buttonOrigPos[idx].y + 35 : 0) };
            try { m.x = mo.x; m.y = mo.y + 28; } catch (e) {}
            animate(m, { alpha: 0, y: mo.y + 28 }, { alpha: 1, y: mo.y }, btnDuration);
          }
        }, delay);
      })(i);
    }

    var totalButtons = buttons.length;
    var lastDelay = btnDelayBase + (Math.max(0, totalButtons - 1)) * btnDelayStep;
    var startAfter = lastDelay + btnDuration + 100;

    jsmaf.setTimeout(function () {
      startLogoLoop();
      startButtonIdleLoop();
      enforceTextWhite();
      updateMusicStateTop();
      updateClickStateTop();
    }, startAfter);
  }

  // selection animations
  function animateSelectionIn(b, txt, origX, origY) {
    animate(b, { scaleX: b.scaleX || 1 }, { scaleX: 1.08, scaleY: 1.08, x: origX - (buttonWidth * (1.08 - 1)) / 2, y: origY - (buttonHeight * (1.08 - 1)) / 2 }, 160);
    try { if (txt && txt.constructor && txt.constructor.name === 'Text') txt.style = 'white'; } catch (e) {}
    animate(txt, { scaleX: txt.scaleX || 1, alpha: txt.alpha || 1 }, { scaleX: 1.06, scaleY: 1.06, alpha: txt.alpha || 1 }, 160);
  }
  function animateSelectionOut(b, txt, origX, origY) {
    animate(b, { scaleX: b.scaleX || 1 }, { scaleX: 1.0, scaleY: 1.0, x: origX, y: origY }, 160);
    try { if (txt && txt.constructor && txt.constructor.name === 'Text') txt.style = 'white'; } catch (e) {}
    animate(txt, { scaleX: txt.scaleX || 1, alpha: txt.alpha || 1 }, { scaleX: 1.0, scaleY: 1.0, alpha: txt.alpha || 1 }, 160);
  }

  function updateHighlight() {
    for (var i = 0; i < buttonMarkers.length; i++) { try { buttonMarkers[i].visible = false; buttonMarkers[i].alpha = 0; } catch (e) {} }

    if (prevButton >= 0 && prevButton !== currentButton) {
      var prev = buttons[prevButton]; var prevTxt = buttonTexts[prevButton];
      if (prev) { prev.url = normalButtonImg; prev.alpha = 0.7; prev.borderColor = 'transparent'; prev.borderWidth = 0; animateSelectionOut(prev, prevTxt, buttonOrigPos[prevButton].x, buttonOrigPos[prevButton].y); }
    }

    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i]; var t = buttonTexts[i]; var m = buttonMarkers[i];
      if (!b || !t) continue;
      if (i === currentButton) {
        b.url = selectedButtonImg; b.alpha = 1.0; b.borderColor = 'rgb(235, 147, 32)'; b.borderWidth = 3;
        if (m) { m.visible = true; animate(m, { alpha: m.alpha || 0 }, { alpha: 1 }, 200); }
        animateSelectionIn(b, t, buttonOrigPos[i].x, buttonOrigPos[i].y);
      } else {
        if (i !== prevButton) { b.url = normalButtonImg; b.alpha = 0.7; b.borderColor = 'transparent'; b.borderWidth = 0; animateSelectionOut(b, t, buttonOrigPos[i].x, buttonOrigPos[i].y); if (m) { m.visible = false; m.alpha = 0; } }
      }
      try { if (t && t.constructor && t.constructor.name === 'Text') t.style = 'white'; } catch (e) {}
    }

    prevButton = currentButton;
  }

  // helper to play ephemeral SFX safely
  function playOneShotSfxPath(path, stopAfterMs) {
    try {
      var s = new jsmaf.AudioClip();
      try { s.open(path); } catch (e) {}
      try { s._valid = true; } catch (e) {}
      try { if (typeof s.play === 'function') { s.play(); s._isPlaying = true; } } catch (e) {}
      jsmaf.setTimeout(function () {
        try { if (typeof s.stop === 'function') s.stop(); } catch (e) {}
        try { s._isPlaying = false; } catch (e) {}
      }, stopAfterMs || 220);
    } catch (e) {}
  }

  // handle press with feedback and music handling
  function handleButtonPress() {
    var btn = buttons[currentButton]; var txt = buttonTexts[currentButton];

    // Decide which sound to play:
    // - For main menu options (indices 0..menuOptions.length-1) play load blip only.
    // - For control buttons (exit, music toggle, click toggle) play click.wav only if clickEnabled.
    var isMenuOption = (currentButton >= 0 && currentButton < menuOptions.length);
    if (!isMenuOption) {
      // control buttons: play click only if enabled
      try { playClick(); } catch (e) {}
    } else {
      // menu option: play load blip (separate sound) regardless of clickEnabled
      try { playLoadBlip(); } catch (e) {}
    }

    // press animation (unchanged)
    animate(btn, { scaleX: btn.scaleX || 1, scaleY: btn.scaleY || 1 }, { scaleX: 0.92, scaleY: 0.92 }, 80, null, function () {
      animate(btn, { scaleX: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140, null, function () {
        animate(btn, { scaleX: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120);

        var exitIdx = exitIndex;
        var musicIdx = musicToggleIndex;
        var clickIdx = clickToggleIndex;

        if (currentButton === exitIdx) {
          try {
            if (typeof libc_addr === 'undefined') { include('userland.js'); }
            fn.register(0x14, 'getpid', [], 'bigint'); fn.register(0x25, 'kill', ['bigint', 'bigint'], 'bigint'); var pid = fn.getpid(); var pid_num = pid instanceof BigInt ? pid.lo : pid; log('Current PID: ' + pid_num); fn.kill(pid, new BigInt(0, 9));
          } catch (e) { log('exit err: ' + (e.message || e)); }
          jsmaf.exit();
        } else if (currentButton === musicIdx) {
          try {
            // Use the unified toggle function which reliably stops/starts and persists the state
            toggleBgm();
          } catch (e) { log('Music toggle error: ' + (e.message || e)); }
        } else if (currentButton === clickIdx) {
          try {
            clickEnabled = !clickEnabled;
            persistFlags();
            updateClickStateTop();
            log('Click SFX toggled: ' + (clickEnabled ? 'ON' : 'OFF'));
          } catch (e) { log('Click toggle error: ' + (e.message || e)); }
        } else if (isMenuOption) {
          var selectedOption = menuOptions[currentButton]; if (!selectedOption) return;
          log('Loading ' + selectedOption.script + '...');
          try { include(selectedOption.script); } catch (e) { log('ERROR loading ' + selectedOption.script + ': ' + (e.message || e)); }
          // ensure persistent bgm continues across includes
          try { if (musicEnabled) { /* keep bgm running */ } } catch (e) {}
        }

      });
    });
  }

  // input: mouse
  jsmaf.onMouseMove = function (mx, my) {
    updateCursorPosition(mx, my);
    showCursor();
    mouseActive = true;
    if (mouseActiveTimeout) try { jsmaf.clearTimeout(mouseActiveTimeout); } catch (e) {}
    mouseActiveTimeout = jsmaf.setTimeout(function () { mouseActive = false; mouseActiveTimeout = null; }, 3000);

    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i]; if (!b) continue; var bx = b.x, by = b.y, bw = b.width, bh = b.height;
      if (mx >= bx && my >= by && mx <= bx + bw && my <= by + bh) { if (currentButton !== i) { prevButton = currentButton; currentButton = i; updateHighlight(); } return; }
    }
  };
  jsmaf.onMouseDown = function (mx, my, button) {
    updateCursorPosition(mx, my);
    showCursor();
    mouseActive = true;
    if (mouseActiveTimeout) try { jsmaf.clearTimeout(mouseActiveTimeout); } catch (e) {}
    mouseActiveTimeout = jsmaf.setTimeout(function () { mouseActive = false; mouseActiveTimeout = null; }, 3000);

    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i]; if (!b) continue; var bx = b.x, by = b.y, bw = b.width, bh = b.height;
      if (mx >= bx && my >= by && mx <= bx + bw && my <= by + bh) { currentButton = i; updateHighlight(); handleButtonPress(); return; }
    }
  };

  // keyboard/gamepad nav
  jsmaf.onKeyDown = function (keyCode) {
    if (keyCode === 6 || keyCode === 5) {
      currentButton = (currentButton + 1) % buttons.length; updateHighlight();
    } else if (keyCode === 4 || keyCode === 7) {
      currentButton = (currentButton - 1 + buttons.length) % buttons.length; updateHighlight();
    } else if (keyCode === 14) { handleButtonPress(); }
  };

  // PS4 controller -> mouse emulation
  (function startGamepadMouse() {
    var gpPollInterval = null;
    var gpSensitivity = 12.0;
    var gpDeadzone = 0.15;
    var lastGpButtons = [];
    var gpPollStepMs = 16;

    try {
      gpPollInterval = jsmaf.setInterval(function () {
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

          var btnIndex = 0;
          var pressed = false;
          if (gp.buttons && gp.buttons.length > btnIndex) {
            var b = gp.buttons[btnIndex];
            pressed = !!(b && (b.pressed || b.value > 0.5));
          }
          if (lastGpButtons[btnIndex] === undefined) lastGpButtons[btnIndex] = false;

          if (pressed && !lastGpButtons[btnIndex] && !mouseActive) {
            try { jsmaf.onMouseDown(Math.round(virtualMouse.x), Math.round(virtualMouse.y), 0); } catch (e) {}
          }
          lastGpButtons[btnIndex] = pressed;

          var lax = (gp.axes && gp.axes.length > 0) ? gp.axes[0] : 0;
          var lay = (gp.axes && gp.axes.length > 1) ? gp.axes[1] : 0;
          var navThreshold = 0.75;
          if (lax > navThreshold) { currentButton = Math.min(buttons.length - 1, currentButton + 1); updateHighlight(); }
          else if (lax < -navThreshold) { currentButton = Math.max(0, currentButton - 1); updateHighlight(); }
          else if (lay > navThreshold) { currentButton = (currentButton + 1) % buttons.length; updateHighlight(); }
          else if (lay < -navThreshold) { currentButton = (currentButton - 1 + buttons.length) % buttons.length; updateHighlight(); }

        } catch (e) {}
      }, gpPollStepMs);
      _intervals.push(gpPollInterval);
    } catch (e) {}
  })();

  // Ensure text objects keep the white style after reloads or re-initialization
  function enforceTextWhite() {
    for (var i = 0; i < buttonTexts.length; i++) {
      try {
        var t = buttonTexts[i];
        if (t && typeof t === 'object' && t.constructor && t.constructor.name === 'Text') {
          t.style = 'white';
          try { t.align = 'center'; } catch (e) {}
        }
      } catch (e) {}
    }
    try { if (musicStateTop && musicStateTop.constructor && musicStateTop.constructor.name === 'Text') { musicStateTop.style = 'white'; try { musicStateTop.align = 'left'; } catch (e) {} } } catch (e) {}
    try { if (clickStateTop && clickStateTop.constructor && clickStateTop.constructor.name === 'Text') { clickStateTop.style = 'white'; try { clickStateTop.align = 'left'; } catch (e) {} } } catch (e) {}
  }

  // read persistent flags on load (ensure defaults)
  try {
    if (typeof __globalRoot.__musicEnabled !== 'undefined') musicEnabled = !!__globalRoot.__musicEnabled;
    else { musicEnabled = true; persistFlags(); }
    if (typeof __globalRoot.__clickEnabled !== 'undefined') clickEnabled = !!__globalRoot.__clickEnabled;
    else { clickEnabled = false; persistFlags(); }
  } catch (e) {}

  // Ensure BGM is started quickly on script load so it persists across pages
  try { if (musicEnabled) enableBgm(); } catch (e) {}

  // start UI
  enforceTextWhite();
  updateMusicStateTop();
  updateClickStateTop();
  entrance();

})();
