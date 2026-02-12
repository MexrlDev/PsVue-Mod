(function () {
  include('languages.js');
  log(lang.loadingMainMenu);

  // small global flag used to stop callbacks once exit begins, stops animations in general
  var __appExiting = false;

  // protect against concurrent main-menu reloads
  var __reloadingMainMenu = false;

  // --- Core state
  var currentButton = 0;
  var buttons = [];
  var buttonTexts = [];
  var buttonMarkers = [];
  var buttonOrigPos = [];
  var textOrigPos = [];
  var valueTexts = []; // kept for anims
  var idleOffsets = [];
  var idlePhases = [];
  var clickAnimHandles = [];
  var idleAnimHandles = [];

  var normalButtonImg = 'file:///../download0/img/button_over_9.png';
  var selectedButtonImg = 'file:///../download0/img/button_over_9.png';

  jsmaf.root.children.length = 0;

  new Style({ name: 'white', color: 'white', size: 24 });
  new Style({ name: 'title', color: 'white', size: 32 });

  // persistent audio if available
  var audio = null;
  if (typeof CONFIG !== 'undefined' && CONFIG.music) {
    try {
      audio = new jsmaf.AudioClip();
      audio.volume = 0.5;
      audio.open('file://../download0/sfx/bgm.wav');
      try { if (typeof audio.play === 'function') audio.play(); } catch (e) {}
    } catch (e) {}
  }

  // --- Background + logo
  var background = new Image({
    url: 'file:///../download0/img/multiview_bg_VAF.png',
    x: 0,
    y: 0,
    width: 1920,
    height: 1080
  });
  background._baseX = background.x;
  jsmaf.root.children.push(background);

  var centerX = 960;
  var logoWidth = 600;
  var logoHeight = 338;
  var logo = new Image({
    url: 'file:///../download0/img/logo.png',
    x: centerX - logoWidth / 2,
    y: 50,
    width: logoWidth,
    height: logoHeight
  });
  jsmaf.root.children.push(logo);

  // logo idle state
  var logoIdle = {
    baseX: logo.x,
    baseY: logo.y,
    offsetX: 0,
    offsetY: 0,
    phase: 0,
    handle: null
  };

  // --- Menu options
  var menuOptions = [{
    label: lang.jailbreak,
    script: 'loader.js',
    imgKey: 'jailbreak'
  }, {
    label: lang.payloadMenu,
    script: 'payload_host.js',
    imgKey: 'payloadMenu'
  }, {
    label: lang.config,
    script: 'config_ui.js',
    imgKey: 'config'
  }, {
    label: (typeof lang !== 'undefined' && lang.fileExplorer) ? lang.fileExplorer : 'File Explorer',
    script: 'file-explorer.js',
    imgKey: 'fileExplorer'
  }];

  var startY = 450;
  var buttonSpacing = 120;
  var buttonWidth = 400;
  var buttonHeight = 80;

  // defensive defaults
  if (typeof useImageText === 'undefined') useImageText = false;
  if (typeof textImageBase === 'undefined') textImageBase = '';

  // build vertical menu
  for (var i = 0; i < menuOptions.length; i++) {
    var btnX = centerX - buttonWidth / 2;
    var btnY = startY + i * buttonSpacing;
    var button = new Image({
      url: normalButtonImg,
      x: btnX,
      y: btnY,
      width: buttonWidth,
      height: buttonHeight
    });
    // start hidden until entrance runs
    button.visible = false; button.alpha = 0;
    buttons.push(button);
    jsmaf.root.children.push(button);

    var marker = new Image({
      url: 'file:///assets/img/ad_pod_marker.png',
      x: btnX + buttonWidth - 50,
      y: btnY + 35,
      width: 12,
      height: 12,
      visible: false
    });
    buttonMarkers.push(marker);
    jsmaf.root.children.push(marker);

    var btnText;
    if (useImageText) {
      btnText = new Image({
        url: textImageBase + menuOptions[i].imgKey + '.png',
        x: btnX + 20,
        y: btnY + 15,
        width: 300,
        height: 50
      });
      btnText.visible = false; btnText.alpha = 0;
    } else {
      btnText = new jsmaf.Text();
      btnText.text = menuOptions[i].label;
      btnText.x = btnX + buttonWidth / 2 - 60;
      btnText.y = btnY + buttonHeight / 2 - 12;
      btnText.style = 'white';
      btnText.visible = false; btnText.alpha = 0;
    }
    buttonTexts.push(btnText);
    jsmaf.root.children.push(btnText);

    buttonOrigPos.push({ x: btnX, y: btnY });
    textOrigPos.push({ x: btnText.x, y: btnText.y });

    idleOffsets.push({ x: 0, y: 0 });
    idlePhases.push(Math.random() * Math.PI * 2);
    clickAnimHandles.push(null);
    idleAnimHandles.push(null);
    valueTexts.push(null);
  }

  // places for buttons like.. reload-anim and reload-js and exit.
  var trioY = startY + menuOptions.length * buttonSpacing + 40; // reduced from +100 to +40
  var smallGap = 10; // small gap between the two buttons
  var pairTotalWidth = buttonWidth * 2 + smallGap;
  var pairStartX = centerX - pairTotalWidth / 2;

  var reloadAnimIndex = -1;
  var exitIndex = -1;
  var reloadJsIndex = -1;

  // Reload-Anim (left)
  var reloadAnimX = pairStartX;
  var reloadAnimY = trioY;
  var reloadAnimButton = new Image({
    url: normalButtonImg,
    x: reloadAnimX,
    y: reloadAnimY,
    width: buttonWidth,
    height: buttonHeight
  });
  reloadAnimButton.visible = false; reloadAnimButton.alpha = 0;
  buttons.push(reloadAnimButton);
  jsmaf.root.children.push(reloadAnimButton);
  reloadAnimIndex = buttons.length - 1;
  var reloadAnimMarker = new Image({
    url: 'file:///assets/img/ad_pod_marker.png',
    x: reloadAnimX + buttonWidth - 50,
    y: reloadAnimY + 35,
    width: 12,
    height: 12,
    visible: false
  });
  buttonMarkers.push(reloadAnimMarker);
  jsmaf.root.children.push(reloadAnimMarker);
  var reloadAnimText;
  if (useImageText) {
    reloadAnimText = new Image({
      url: textImageBase + 'reload-anim.png',
      x: reloadAnimX + 20,
      y: reloadAnimY + 15,
      width: 300,
      height: 50
    });
    reloadAnimText.visible = false; reloadAnimText.alpha = 0;
  } else {
    reloadAnimText = new jsmaf.Text();
    reloadAnimText.text = 'Reload-Anim';
    reloadAnimText.x = reloadAnimX + buttonWidth / 2 - 60;
    reloadAnimText.y = reloadAnimY + buttonHeight / 2 - 12;
    reloadAnimText.style = 'white';
    reloadAnimText.visible = false; reloadAnimText.alpha = 0;
  }
  buttonTexts.push(reloadAnimText);
  jsmaf.root.children.push(reloadAnimText);
  buttonOrigPos.push({ x: reloadAnimX, y: reloadAnimY });
  textOrigPos.push({ x: reloadAnimText.x, y: reloadAnimText.y });
  idleOffsets.push({ x: 0, y: 0 });
  idlePhases.push(Math.random() * Math.PI * 2);
  clickAnimHandles.push(null);
  idleAnimHandles.push(null);
  valueTexts.push(null);

  // Reload-Js (right) -- renamed from Reload-App
  var reloadJsX = pairStartX + buttonWidth + smallGap;
  var reloadJsY = trioY;
  var reloadJsButton = new Image({
    url: normalButtonImg,
    x: reloadJsX,
    y: reloadJsY,
    width: buttonWidth,
    height: buttonHeight
  });
  reloadJsButton.visible = false; reloadJsButton.alpha = 0;
  buttons.push(reloadJsButton);
  jsmaf.root.children.push(reloadJsButton);
  reloadJsIndex = buttons.length - 1;
  var reloadJsMarker = new Image({
    url: 'file:///assets/img/ad_pod_marker.png',
    x: reloadJsX + buttonWidth - 50,
    y: reloadJsY + 35,
    width: 12,
    height: 12,
    visible: false
  });
  buttonMarkers.push(reloadJsMarker);
  jsmaf.root.children.push(reloadJsMarker);
  var reloadJsText;
  if (useImageText) {
    reloadJsText = new Image({
      url: textImageBase + 'reload-js.png',
      x: reloadJsX + 20,
      y: reloadJsY + 15,
      width: 300,
      height: 50
    });
    reloadJsText.visible = false; reloadJsText.alpha = 0;
  } else {
    reloadJsText = new jsmaf.Text();
    reloadJsText.text = 'Reload-Js';
    reloadJsText.x = reloadJsX + buttonWidth / 2 - 60;
    reloadJsText.y = reloadJsY + buttonHeight / 2 - 12;
    reloadJsText.style = 'white';
    reloadJsText.visible = false; reloadJsText.alpha = 0;
  }
  buttonTexts.push(reloadJsText);
  jsmaf.root.children.push(reloadJsText);
  buttonOrigPos.push({ x: reloadJsX, y: reloadJsY });
  textOrigPos.push({ x: reloadJsText.x, y: reloadJsText.y });
  idleOffsets.push({ x: 0, y: 0 });
  idlePhases.push(Math.random() * Math.PI * 2);
  clickAnimHandles.push(null);
  idleAnimHandles.push(null);
  valueTexts.push(null);

  // Exit (kept in code but hidden). Place it off to the right so it doesn't affect the centered pair.
  var exitX = pairStartX + pairTotalWidth + 60; // offset to the right of the centered pair
  var exitY = trioY;
  var exitButton = new Image({
    url: normalButtonImg,
    x: exitX,
    y: exitY,
    width: buttonWidth,
    height: buttonHeight
  });
  exitButton.visible = false; exitButton.alpha = 0;
  buttons.push(exitButton);
  jsmaf.root.children.push(exitButton);
  exitIndex = buttons.length - 1;
  var exitMarker = new Image({
    url: 'file:///assets/img/ad_pod_marker.png',
    x: exitX + buttonWidth - 50,
    y: exitY + 35,
    width: 12,
    height: 12,
    visible: false
  });
  buttonMarkers.push(exitMarker);
  jsmaf.root.children.push(exitMarker);
  var exitText;
  if (useImageText) {
    exitText = new Image({
      url: textImageBase + 'exit.png',
      x: exitX + 20,
      y: exitY + 15,
      width: 300,
      height: 50
    });
    exitText.visible = false; exitText.alpha = 0;
  } else {
    exitText = new jsmaf.Text();
    exitText.text = lang.exit;
    exitText.x = exitX + buttonWidth / 2 - 20;
    exitText.y = exitY + buttonHeight / 2 - 12;
    exitText.style = 'white';
    exitText.visible = false; exitText.alpha = 0;
  }
  buttonTexts.push(exitText);
  jsmaf.root.children.push(exitText);
  buttonOrigPos.push({ x: exitX, y: exitY });
  textOrigPos.push({ x: exitText.x, y: exitText.y });
  idleOffsets.push({ x: 0, y: 0 });
  idlePhases.push(Math.random() * Math.PI * 2);
  clickAnimHandles.push(null);
  idleAnimHandles.push(null);
  valueTexts.push(null);

  // Hide Exit visuals from UI but keep the object and index for logic
  var HIDDEN_UI_INDEX_EXIT = -1;
  try {
    HIDDEN_UI_INDEX_EXIT = exitIndex;
    if (exitButton) { exitButton.visible = false; exitButton.alpha = 0; }
    if (exitText) { exitText.visible = false; exitText.alpha = 0; }
    if (exitMarker) { exitMarker.visible = false; exitMarker.alpha = 0; }
  } catch (e) {}

  // --- Animation helpers and interval management
  var _intervals = [];
  var _markerPulseInterval = null;
  var _logoAnimInterval = null;
  var _buttonIdleInterval = null;
  var _bgmFadeInterval = null;

  function _setInterval(fn, ms) { var id = jsmaf.setInterval(fn, ms); _intervals.push(id); return id; }
  function _clearAllIntervals() {
    for (var i = 0; i < _intervals.length; i++) {
      try { jsmaf.clearInterval(_intervals[i]); } catch (e) {}
    }
    _intervals = [];
    if (_markerPulseInterval) try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {}
    _markerPulseInterval = null;
    if (_logoAnimInterval) try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}
    _logoAnimInterval = null;
    if (_bgmFadeInterval) try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}
    _bgmFadeInterval = null;
    if (_buttonIdleInterval) try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {}
    _buttonIdleInterval = null;
  }

  function easeInOut(t) {
    return (1 - Math.cos(t * Math.PI)) / 2;
  }

  function animate(obj, from, to, duration, onStep, done) {
    if (__appExiting) { if (done) try { done(); } catch (_) {} return null; }

    var elapsed = 0; var step = 16;
    var id = _setInterval(function () {
      if (__appExiting) {
        try { jsmaf.clearInterval(id); } catch (ee) {}
        if (done) try { done(); } catch (ee2) {}
        return;
      }
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var e = easeInOut(t);
      for (var k in to) {
        try {
          var f = (from && from[k] !== undefined) ? from[k] : (obj[k] || 0);
          obj[k] = f + (to[k] - f) * e;
        } catch (ex) {}
      }
      if (onStep) {
        try { onStep(e); } catch (ex2) {}
      }
      if (t >= 1) {
        try { jsmaf.clearInterval(id); } catch (e2) {}
        if (done) done();
      }
    }, step);
    return id;
  }

  // --- Idle breathing loop (buttons + text move together)
  function startButtonIdleLoop() {
    try {
      if (_buttonIdleInterval) try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {}
      var phase = 0;
      _buttonIdleInterval = jsmaf.setInterval(function () {
        if (__appExiting) { try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {} _buttonIdleInterval = null; return; }
        phase += 0.04;
        for (var i = 0; i < buttons.length; i++) {
          try {
            if (i === HIDDEN_UI_INDEX_EXIT) continue;
            var b = buttons[i];
            var t = buttonTexts[i];
            var v = valueTexts[i];
            if (!b) continue;
            var p = phase + i * 0.3;
            var sx = 1 + Math.sin(p) * 0.02;
            var sy = 1 - Math.sin(p) * 0.02;
            var dy = Math.sin(p * 0.9) * 1.5;
            if (i !== currentButton) {
              b.scaleX = sx;
              b.scaleY = sy;
              b.y = (buttonOrigPos[i] ? buttonOrigPos[i].y : b.y) + dy;
              if (t) {
                t.scaleX = sx;
                t.scaleY = sy;
                t.y = (textOrigPos[i] ? textOrigPos[i].y : t.y) + dy;
                t.x = (textOrigPos[i] ? textOrigPos[i].x : t.x) - buttonWidth * (sx - 1) / 2;
              }
              if (v) {
                v.scaleX = sx;
                v.scaleY = sy;
                v.y = (buttonOrigPos[i] ? buttonOrigPos[i].y + 20 : v.y) + dy;
                v.x = (buttonOrigPos[i] ? buttonOrigPos[i].x + 320 : v.x) - buttonWidth * (sx - 1) / 2;
              }
            } else {
              b.scaleX = 1 + Math.sin(p) * 0.01;
              b.scaleY = 1 - Math.sin(p) * 0.01;
              b.x = buttonOrigPos[i] ? buttonOrigPos[i].x : b.x;
              b.y = buttonOrigPos[i] ? buttonOrigPos[i].y : b.y;
              if (t) { t.scaleX = b.scaleX; t.scaleY = b.scaleY; t.x = textOrigPos[i] ? textOrigPos[i].x : t.x; t.y = textOrigPos[i] ? textOrigPos[i].y : t.y; }
              if (v) { v.scaleX = b.scaleX; v.scaleY = b.scaleY; v.x = buttonOrigPos[i] ? buttonOrigPos[i].x + 320 : v.x; v.y = buttonOrigPos[i] ? buttonOrigPos[i].y + 20 : v.y; }
            }
          } catch (e) {}
        }
      }, 16);
      _intervals.push(_buttonIdleInterval);
    } catch (e) {}
  }

  function stopButtonIdleLoop() {
    if (_buttonIdleInterval) try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {}
    _buttonIdleInterval = null;
  }

  // --- Orange marker pulse
  function startOrangeDotLoop() {
    if (_markerPulseInterval) try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {}
    var phase = 0;
    _markerPulseInterval = jsmaf.setInterval(function () {
      if (__appExiting) { try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {} _markerPulseInterval = null; return; }
      phase += 0.06;
      for (var i = 0; i < buttonMarkers.length; i++) {
        if (i === HIDDEN_UI_INDEX_EXIT) continue;
        var m = buttonMarkers[i];
        if (!m) continue;
        if (m.isOrangeDot || (m.url && m.url.indexOf('ad_pod_marker') !== -1)) {
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

  // --- Logo idle loop (more dynamic)
  function startLogoLoop() {
    var phase = 0;
    if (_logoAnimInterval) try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}
    _logoAnimInterval = jsmaf.setInterval(function () {
      if (__appExiting) { try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {} _logoAnimInterval = null; return; }
      phase += 0.02;
      try {
        logo.y = logoIdle.baseY + Math.sin(phase * 1.1) * 6 + Math.sin(phase * 0.33) * 2;
        logo.x = logoIdle.baseX + Math.sin(phase * 0.6) * 6;
        var s = 0.985 + Math.sin(phase * 0.9) * 0.015;
        logo.scaleX = s;
        logo.scaleY = s;
        try { logo.rotation = Math.sin(phase * 0.7) * 2; } catch (e) {}
        if (background) { background.x = background._baseX + Math.sin(phase * 0.4) * 12; }
      } catch (e) {}
    }, 16);
    _intervals.push(_logoAnimInterval);
  }

  // --- Entrance animation (buttons, text, markers, valueTexts move together)
  var markerOrigPos = [];
  // entrance accepts a flag whether to start loops immediately after buttons finish
  function entrance(startLoopsImmediately) {
    try {
      animate(background, { alpha: background.alpha || 0 }, { alpha: 1 }, 800);
      animate(logo, { alpha: logo.alpha || 0, scaleX: logo.scaleX || 0.95, scaleY: logo.scaleY || 0.95 }, { alpha: 1, scaleX: 1.0, scaleY: 1.0 }, 900);
    } catch (e) {}
    var btnDelayBase = 220;
    var btnDelayStep = 140;
    var btnDuration = 1200;
    for (var idx = 0; idx < buttons.length; idx++) {
      (function (i) {
        var b = buttons[i]; var t = buttonTexts[i]; var m = buttonMarkers[i]; var v = valueTexts[i];
        var delay = btnDelayBase + i * btnDelayStep;
        (function (ii, cbDelay) {
          jsmaf.setTimeout(function () {
            if (__appExiting) return;
            if (ii === HIDDEN_UI_INDEX_EXIT) {
              try {
                if (b) { b.visible = false; b.alpha = 0; }
                if (t) { t.visible = false; t.alpha = 0; }
                if (m) { m.visible = false; m.alpha = 0; }
              } catch (e) {}
              return;
            }
            try {
              // reveal visuals now (they were hidden during logo center/hide)
              if (b) { b.visible = true; b.alpha = 0; }
              if (t) { t.visible = true; t.alpha = 0; }
              if (m) { m.visible = true; m.alpha = 0; }

              if (b) {
                b.rotation = 360;
                b.scaleX = 0.6;
                b.scaleY = 0.6;
                b.y = buttonOrigPos[ii].y + 40;
              }
              if (t) {
                t.scaleX = 0.6;
                t.scaleY = 0.6;
                t.y = textOrigPos[ii].y + 40;
              }
              if (v) {
                v.alpha = v.alpha || 1;
                v.scaleX = 0.6;
                v.scaleY = 0.6;
                v.y = (buttonOrigPos[ii] ? buttonOrigPos[ii].y + 20 : 0) + 40;
                v.x = (buttonOrigPos[ii] ? buttonOrigPos[ii].x + 320 : 0);
              }
              if (m) {
                var mo = { x: (buttonOrigPos[ii] ? buttonOrigPos[ii].x + buttonWidth - 50 : 0), y: (buttonOrigPos[ii] ? buttonOrigPos[ii].y + 35 : 0) };
                markerOrigPos[ii] = mo;
                try { m.x = mo.x; m.y = mo.y + 40; } catch (e) {}
              }
              animate(b, { alpha: 0, rotation: 360, y: (buttonOrigPos[ii] ? buttonOrigPos[ii].y + 40 : 0), scaleX: 0.6, scaleY: 0.6 }, { alpha: 1, rotation: 0, y: (buttonOrigPos[ii] ? buttonOrigPos[ii].y : 0), scaleX: 1.08, scaleY: 0.92 }, btnDuration, null, function () {
                animate(b, { scaleX: 1.08, scaleY: 0.92 }, { scaleX: 0.96, scaleY: 1.06 }, 160, null, function () {
                  animate(b, { scaleX: 0.96, scaleY: 1.06 }, { scaleX: 1.02, scaleY: 0.98 }, 140, null, function () {
                    animate(b, { scaleX: 1.02, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 120);
                  });
                });
              });
              animate(t, { alpha: 0, rotation: 360, y: (textOrigPos[ii] ? textOrigPos[ii].y + 40 : 0), scaleX: 0.6, scaleY: 0.6 }, { alpha: 1, rotation: 0, y: (textOrigPos[ii] ? textOrigPos[ii].y : 0), scaleX: 1.02, scaleY: 0.98 }, btnDuration + 80, null, function () {
                animate(t, { scaleX: 1.02, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 160);
              });
              if (v) {
                animate(v, { scaleX: 0.6, scaleY: 0.6, y: (buttonOrigPos[ii] ? buttonOrigPos[ii].y + 20 + 40 : 0) }, { scaleX: 1.0, scaleY: 1.0, y: (buttonOrigPos[ii] ? buttonOrigPos[ii].y + 20 : 0) }, btnDuration + 80);
              }
              if (m) {
                animate(m, { alpha: 0, y: (markerOrigPos[ii] ? markerOrigPos[ii].y + 40 : 0) }, { alpha: 1, y: (markerOrigPos[ii] ? markerOrigPos[ii].y : 0) }, btnDuration + 40);
              }
            } catch (e) {}
          }, cbDelay);
        })(i, delay);
      })(idx);
    }
    var totalButtons = buttons.length;
    var lastDelay = btnDelayBase + (Math.max(0, totalButtons - 1)) * btnDelayStep;
    var startAfter = lastDelay + btnDuration + 600;

    // Start loops when buttons finished (we always start after buttons finish)
    jsmaf.setTimeout(function () {
      if (__appExiting) return;

      // ---------- ALIGNMENT: ensure final transforms match stored "orig" values BEFORE idle loops ----------
      // This prevents a visible cut when the idle loops take control.
      try {
        // Ensure logo idle base matches current logo transform
        try { logoIdle.baseX = (typeof logo.x === 'number') ? logo.x : logoIdle.baseX; } catch (e) {}
        try { logoIdle.baseY = (typeof logo.y === 'number') ? logo.y : logoIdle.baseY; } catch (e) {}
        try { logo.scaleX = logo.scaleX || 1.0; logo.scaleY = logo.scaleY || 1.0; logo.rotation = logo.rotation || 0; } catch (e) {}

        // Align each visible button/text/marker to the canonical orig positions and final scale
        for (var i = 0; i < buttons.length; i++) {
          try {
            if (i === HIDDEN_UI_INDEX_EXIT) {
              // keep hidden
              if (buttons[i]) { buttons[i].visible = false; buttons[i].alpha = 0; }
              if (buttonTexts[i]) { buttonTexts[i].visible = false; buttonTexts[i].alpha = 0; }
              if (buttonMarkers[i]) { buttonMarkers[i].visible = false; buttonMarkers[i].alpha = 0; }
              continue;
            }
            var b = buttons[i];
            var t = buttonTexts[i];
            var m = buttonMarkers[i];
            var orig = buttonOrigPos[i];
            var torig = textOrigPos[i];

            if (b && orig) {
              // snap to final canonical values that other systems expect
              b.x = orig.x;
              b.y = orig.y;
              b.scaleX = 1.0;
              b.scaleY = 1.0;
              b.rotation = 0;
              b.alpha = 1;
              b.visible = true;
            }
            if (t && torig) {
              t.x = torig.x;
              t.y = torig.y;
              t.scaleX = 1.0;
              t.scaleY = 1.0;
              t.alpha = 1;
              t.visible = true;
              try { if (t.constructor && t.constructor.name === 'Text') t.style = 'white'; } catch (e) {}
            }
            if (m) {
              if (markerOrigPos[i]) {
                m.x = markerOrigPos[i].x;
                m.y = markerOrigPos[i].y;
              }
              m.alpha = 1;
              m.visible = true;
              try { m.scaleX = 1; m.scaleY = 1; } catch (e) {}
            }
            // ensure any valueTexts align too
            if (valueTexts[i] && orig) {
              try { valueTexts[i].x = orig.x + 320; valueTexts[i].y = orig.y + 20; valueTexts[i].scaleX = 1; valueTexts[i].scaleY = 1; } catch (e) {}
            }
          } catch (e) {}
        }
      } catch (e) {}

      // now start loops (they will pick up the canonical positions)
      startOrangeDotLoop();
      startLogoLoop();
      startButtonIdleLoop();
    }, startAfter);
  }

  // --- Zoom in/out (squishy) and click animations
  var zoomInInterval = null;
  var zoomOutInterval = null;

  function animateZoomIn(btn, text, btnOrigX, btnOrigY, textOrigX, textOrigY, valueObj) {
    if (zoomInInterval) try { jsmaf.clearInterval(zoomInInterval); } catch (e) {}
    if (__appExiting) return;
    var btnW = buttonWidth;
    var btnH = buttonHeight;
    var startScale = btn.scaleX || 1.0;
    var endScaleX = 1.12;
    var endScaleY = 0.92;
    var duration = 180;
    var elapsed = 0;
    var step = 16;
    var origX = btnOrigX;
    var origY = btnOrigY;
    var tOrigX = textOrigX;
    var tOrigY = textOrigY;
    zoomInInterval = jsmaf.setInterval(function () {
      if (__appExiting) { try { jsmaf.clearInterval(zoomInInterval); } catch (e) {} zoomInInterval = null; return; }
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeInOut(t);
      var sx = startScale + (endScaleX - startScale) * eased;
      var sy = startScale + (endScaleY - startScale) * eased;
      btn.scaleX = sx;
      btn.scaleY = sy;
      btn.x = origX - btnW * (sx - 1) / 2;
      btn.y = origY - btnH * (sy - 1) / 2;
      if (text) {
        text.scaleX = sx;
        text.scaleY = sy;
        text.x = tOrigX - btnW * (sx - 1) / 2;
        text.y = tOrigY - btnH * (sy - 1) / 2;
      }
      if (t >= 1) {
        try { jsmaf.clearInterval(zoomInInterval); } catch (ex) {}
        zoomInInterval = null;
        animate(btn, { scaleX: endScaleX, scaleY: endScaleY }, { scaleX: 1.04, scaleY: 0.98 }, 120, null, function () {
          animate(btn, { scaleX: 1.04, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 120);
        });
        if (text) {
          animate(text, { scaleX: endScaleX, scaleY: endScaleY }, { scaleX: 1.04, scaleY: 0.98 }, 120, null, function () {
            animate(text, { scaleX: 1.04, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 120);
          });
        }
      }
    }, step);
  }

  function animateZoomOut(btn, text, btnOrigX, btnOrigY, textOrigX, textOrigY, valueObj) {
    if (zoomOutInterval) try { jsmaf.clearInterval(zoomOutInterval); } catch (e) {}
    if (__appExiting) return;
    var btnW = buttonWidth;
    var btnH = buttonHeight;
    var startScaleX = btn.scaleX || 1.0;
    var startScaleY = btn.scaleY || 1.0;
    var endScaleX = 1.0;
    var endScaleY = 1.0;
    var duration = 160;
    var elapsed = 0;
    var step = 16;
    var origX = btnOrigX;
    var origY = btnOrigY;
    var tOrigX = textOrigX;
    var tOrigY = textOrigY;
    zoomOutInterval = jsmaf.setInterval(function () {
      if (__appExiting) { try { jsmaf.clearInterval(zoomOutInterval); } catch (e) {} zoomOutInterval = null; return; }
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeInOut(t);
      var sx = startScaleX + (endScaleX - startScaleX) * eased;
      var sy = startScaleY + (endScaleY - startScaleY) * eased;
      btn.scaleX = sx;
      btn.scaleY = sy;
      btn.x = origX - btnW * (sx - 1) / 2;
      btn.y = origY - btnH * (sy - 1) / 2;
      if (text) {
        text.scaleX = sx;
        text.scaleY = sy;
        text.x = tOrigX - btnW * (sx - 1) / 2;
        text.y = tOrigY - btnH * (sy - 1) / 2;
      }
      if (t >= 1) {
        try { jsmaf.clearInterval(zoomOutInterval); } catch (ex) {}
        zoomOutInterval = null;
      }
    }, step);
  }

  // --- Click animation (shrink -> overshoot -> settle)
  var clickSfx = null;
  try { clickSfx = new jsmaf.AudioClip(); clickSfx.open('file://../download0/sfx/click.wav'); } catch (e) {}

  function animateClick(btn, txt, btnOrigX, btnOrigY, textOrigX, textOrigY, valueObj, done) {
    if (__appExiting) { if (done) try { done(); } catch (_) {} return; }
    try { if (clickSfx && typeof clickSfx.play === 'function') clickSfx.play(); } catch (e) {}
    animate(btn, { scaleX: btn.scaleX || 1.0, scaleY: btn.scaleY || 1.0 }, { scaleX: 0.92, scaleY: 0.92 }, 80, null, function () {
      animate(btn, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140, null, function () {
        animate(btn, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120, null, function () {
          if (done) done();
        });
      });
    });
    if (txt) {
      animate(txt, { scaleX: txt.scaleX || 1.0, scaleY: txt.scaleY || 1.0 }, { scaleX: 0.92, scaleY: 0.92 }, 80);
      jsmaf.setTimeout(function () {
        if (__appExiting) return;
        animate(txt, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140);
        jsmaf.setTimeout(function () { if (!__appExiting) animate(txt, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120); }, 140);
      }, 80);
    }
    if (valueObj) {
      animate(valueObj, { scaleX: valueObj.scaleX || 1.0, scaleY: valueObj.scaleY || 1.0 }, { scaleX: 0.92, scaleY: 0.92 }, 80);
      jsmaf.setTimeout(function () {
        if (__appExiting) return;
        animate(valueObj, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140);
        jsmaf.setTimeout(function () { if (!__appExiting) animate(valueObj, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120); }, 140);
      }, 80);
    }
  }

  // --- Update highlight (wires zoom in/out and markers)
  var prevButton = -1;
  function updateHighlight() {
    var prevButtonObj = buttons[prevButton];
    var buttonMarker = buttonMarkers[prevButton];
    if (prevButton >= 0 && prevButton !== currentButton && prevButtonObj) {
      prevButtonObj.url = normalButtonImg;
      prevButtonObj.alpha = 0.7;
      prevButtonObj.borderColor = 'transparent';
      prevButtonObj.borderWidth = 0;
      if (buttonMarker) buttonMarker.visible = false;
      animateZoomOut(prevButtonObj, buttonTexts[prevButton], buttonOrigPos[prevButton].x, buttonOrigPos[prevButton].y, textOrigPos[prevButton].x, textOrigPos[prevButton].y, valueTexts[prevButton]);
    }

    for (var i = 0; i < buttons.length; i++) {
      if (i === HIDDEN_UI_INDEX_EXIT) continue;
      var _button = buttons[i];
      var _buttonMarker = buttonMarkers[i];
      var buttonText = buttonTexts[i];
      var buttonOrig = buttonOrigPos[i];
      var textOrig = textOrigPos[i];
      var valueObj = valueTexts[i];
      if (_button === undefined || buttonText === undefined || buttonOrig === undefined || textOrig === undefined) continue;
      if (i === currentButton) {
        _button.url = selectedButtonImg;
        _button.alpha = 1.0;
        _button.borderColor = 'rgb(122, 91, 6)';
        _button.borderWidth = 3;
        if (_buttonMarker) _buttonMarker.visible = true;
        animateZoomIn(_button, buttonText, buttonOrig.x, buttonOrig.y, textOrig.x, textOrig.y, valueObj);
      } else if (i !== prevButton) {
        _button.url = normalButtonImg;
        _button.alpha = 0.7;
        _button.borderColor = 'transparent';
        _button.borderWidth = 0;
        _button.scaleX = 1.0;
        _button.scaleY = 1.0;
        _button.x = buttonOrig.x;
        _button.y = buttonOrig.y;
        buttonText.scaleX = 1.0;
        buttonText.scaleY = 1.0;
        buttonText.x = textOrig.x;
        buttonText.y = textOrig.y;
        if (valueObj) {
          valueObj.scaleX = 1.0;
          valueObj.scaleY = 1.0;
          valueObj.x = buttonOrig.x + 320;
          valueObj.y = buttonOrig.y + 20;
        }
        if (_buttonMarker) _buttonMarker.visible = false;
      }
      try { if (buttonText && buttonText.constructor && buttonText.constructor.name === 'Text') buttonText.style = 'white'; } catch (e) {}
    }
    prevButton = currentButton;
  }

  // --- Reload animations function (resets and restarts all UI animations as if fresh startup)
  function reloadAnimations() {
    try {
      log('Reloading animations...');
      // stop all intervals and loops
      _clearAllIntervals();

      // reset background and logo to initial states
      try {
        background.alpha = 0;
        background.x = background._baseX || 0;
        background.y = background._baseY || 0;
      } catch (e) {}
      try {
        logo.alpha = 0;
        logo.scaleX = 0.98;
        logo.scaleY = 0.98;
        logo.x = logoIdle.baseX || (centerX - logoWidth / 2);
        logo.y = logoIdle.baseY || 50;
      } catch (e) {}

      // reset each button, text, marker to original positions and base transforms (and hide them until entrance)
      for (var i = 0; i < buttons.length; i++) {
        try {
          var b = buttons[i];
          var t = buttonTexts[i];
          var m = buttonMarkers[i];
          var orig = buttonOrigPos[i];
          var torig = textOrigPos[i];
          if (b && orig) {
            b.x = orig.x;
            b.y = orig.y;
            b.scaleX = 1.0;
            b.scaleY = 1.0;
            b.rotation = 0;
            b.alpha = 0;
            b.visible = false;
            b.url = normalButtonImg;
            b.borderColor = 'transparent';
            b.borderWidth = 0;
          }
          if (t && torig) {
            t.x = torig.x;
            t.y = torig.y;
            t.scaleX = 1.0;
            t.scaleY = 1.0;
            t.alpha = 0;
            t.visible = false;
            try { if (t.constructor && t.constructor.name === 'Text') t.style = 'white'; } catch (e) {}
          }
          if (m) {
            m.visible = false;
            m.alpha = 0;
            try { m.scaleX = 1; m.scaleY = 1; } catch (e) {}
            if (markerOrigPos[i]) { try { m.x = markerOrigPos[i].x; m.y = markerOrigPos[i].y; } catch (e) {} }
          }
        } catch (e) {}
      }

      // ensure hidden exit visuals remain hidden after reset
      try {
        if (HIDDEN_UI_INDEX_EXIT >= 0 && HIDDEN_UI_INDEX_EXIT < buttons.length) {
          try { if (buttons[HIDDEN_UI_INDEX_EXIT]) { buttons[HIDDEN_UI_INDEX_EXIT].visible = false; buttons[HIDDEN_UI_INDEX_EXIT].alpha = 0; } } catch (e) {}
          try { if (buttonTexts[HIDDEN_UI_INDEX_EXIT]) { buttonTexts[HIDDEN_UI_INDEX_EXIT].visible = false; buttonTexts[HIDDEN_UI_INDEX_EXIT].alpha = 0; } } catch (e) {}
          try { if (buttonMarkers[HIDDEN_UI_INDEX_EXIT]) { buttonMarkers[HIDDEN_UI_INDEX_EXIT].visible = false; buttonMarkers[HIDDEN_UI_INDEX_EXIT].alpha = 0; } } catch (e) {}
        }
      } catch (e) {}

      // reset highlight state
      prevButton = -1;
      currentButton = 0;

      // run the new staged intro, then entrance which will reveal buttons and start loops when done
      jsmaf.setTimeout(function () {
        introSequence(function () {
          // nothing extra here — introSequence will call entrance(true)
        });
        // ensure highlight is set after a short delay so first button anim completes
        jsmaf.setTimeout(function () {
          updateHighlight();
        }, 600);
      }, 80);
    } catch (e) {
      log('ERROR reloading animations: ' + (e && e.message ? e.message : e));
    }
  }

  // --- Soft unload main-menu (stops loops and clears UI but does NOT exit the whole app)
  function _softUnloadMainMenu() {
    if (__reloadingMainMenu) return;
    __reloadingMainMenu = true;

    try {
      log('Soft unloading main menu (safe unload)...');

      // disable input immediately to avoid reentry
      try { jsmaf.onKeyDown = function () {}; } catch (e) {}
      try { jsmaf.onMouseMove = function () {}; } catch (e) {}
      try { jsmaf.onMouseDown = function () {}; } catch (e) {}

      // stop all tracked intervals and loops (but DO NOT call jsmaf.exit)
      try { _clearAllIntervals(); } catch (e) {}

      // clear individual animation handles
      try {
        if (zoomInInterval) { try { jsmaf.clearInterval(zoomInInterval); } catch (e) {} zoomInInterval = null; }
        if (zoomOutInterval) { try { jsmaf.clearInterval(zoomOutInterval); } catch (e) {} zoomOutInterval = null; }
      } catch (e) {}

      try {
        for (var ci = 0; ci < clickAnimHandles.length; ci++) {
          try { if (clickAnimHandles[ci]) jsmaf.clearInterval(clickAnimHandles[ci]); } catch (e) {}
          clickAnimHandles[ci] = null;
        }
      } catch (e) {}
      try {
        for (var ii = 0; ii < idleAnimHandles.length; ii++) {
          try { if (idleAnimHandles[ii]) jsmaf.clearInterval(idleAnimHandles[ii]); } catch (e) {}
          idleAnimHandles[ii] = null;
        }
      } catch (e) {}

      // stop any active audio (bgm and click), defensively, but don't attempt global kills
      try {
        if (clickSfx && typeof clickSfx.stop === 'function') {
          try { clickSfx.stop(); } catch (e) {}
        }
      } catch (e) {}
      try {
        if (typeof loadSfx !== 'undefined' && loadSfx && typeof loadSfx.stop === 'function') {
          try { loadSfx.stop(); } catch (e) {}
        }
      } catch (e) {}
      try {
        if (audio) {
          try { if (typeof audio.pause === 'function') audio.pause(); } catch (e) {}
          try { if (typeof audio.stop === 'function') audio.stop(); } catch (e) {}
          try { if (typeof audio.close === 'function') audio.close(); } catch (e) {}
          try { audio._isPlaying = false; } catch (e) {}
          audio = null;
        }
      } catch (e) {}

      // Do NOT call jsmaf.exit or debugging.restart here. We only clear UI for a fresh main-menu include.
      try { jsmaf.root.children.length = 0; } catch (e) {}

    } catch (e) {
      log('ERROR during soft unload: ' + (e && e.message ? e.message : e));
    }
  }

  // --- Reload main menu JS only (safe)
  function reloadMainMenu() {
    if (__reloadingMainMenu) {
      log('Main menu reload already in progress, ignoring duplicate request.');
      return;
    }

    _softUnloadMainMenu();

    var candidates = [
      'main_menu.js',
      'main-menu.js',
      'mainmenu.js',
      'menu.js',
      'index.js',
      'app_menu.js'
    ];

    var loaded = false;
    for (var i = 0; i < candidates.length; i++) {
      var name = candidates[i];
      try {
        log('Attempting to include ' + name + ' ...');
        include(name);
        loaded = true;
        log('Included ' + name + ' successfully (main menu reload).');
        break;
      } catch (e) {
        log('Include failed for ' + name + ': ' + (e && e.message ? e.message : e));
      }
    }

    if (!loaded) {
      log('ERROR: Could not reload main menu. None of the candidate files loaded. Aborting reloadMainMenu().');
      try {
        __reloadingMainMenu = false;
        reloadAnimations();
      } catch (e) {
        log('Attempt to recover by reloadAnimations() failed: ' + (e && e.message ? e.message : e));
      }
      return;
    }

    jsmaf.setTimeout(function () {
      __reloadingMainMenu = false;
    }, 500);
  }

  // --- Graceful shutdown helper
  function _gracefulShutdownAndExit() {
    if (__appExiting) return;
    __appExiting = true;
    try {
      log('Performing FULL graceful shutdown...');

      // disable input immediately to avoid reentry
      try { jsmaf.onKeyDown = function () {}; } catch (e) {}
      try { jsmaf.onMouseMove = function () {}; } catch (e) {}
      try { jsmaf.onMouseDown = function () {}; } catch (e) {}

      // stop all tracked intervals and loops
      try { _clearAllIntervals(); } catch (e) {}

      
      try {
        if (zoomInInterval) { try { jsmaf.clearInterval(zoomInInterval); } catch (e) {} zoomInInterval = null; }
        if (zoomOutInterval) { try { jsmaf.clearInterval(zoomOutInterval); } catch (e) {} zoomOutInterval = null; }
      } catch (e) {}

      
      try {
        for (var ci = 0; ci < clickAnimHandles.length; ci++) {
          try { if (clickAnimHandles[ci]) jsmaf.clearInterval(clickAnimHandles[ci]); } catch (e) {}
          clickAnimHandles[ci] = null;
        }
      } catch (e) {}
      try {
        for (var ii = 0; ii < idleAnimHandles.length; ii++) {
          try { if (idleAnimHandles[ii]) jsmaf.clearInterval(idleAnimHandles[ii]); } catch (e) {}
          idleAnimHandles[ii] = null;
        }
      } catch (e) {}

      
      try {
        if (clickSfx && typeof clickSfx.stop === 'function') {
          try { clickSfx.stop(); } catch (e) {}
        }
      } catch (e) {}
      try {
        if (typeof loadSfx !== 'undefined' && loadSfx && typeof loadSfx.stop === 'function') {
          try { loadSfx.stop(); } catch (e) {}
        }
      } catch (e) {}
      try {
        if (audio) {
          try { if (typeof audio.pause === 'function') audio.pause(); } catch (e) {}
          try { if (typeof audio.stop === 'function') audio.stop(); } catch (e) {}
          try { if (typeof audio.close === 'function') audio.close(); } catch (e) {}
          try { audio._isPlaying = false; } catch (e) {}
          audio = null;
        }
      } catch (e) {}

      // defensive attempt to stop any global/persistent bgm 
      try {
        var globalRoot = (typeof global !== 'undefined') ? global : ((typeof window !== 'undefined') ? window : ((typeof self !== 'undefined') ? self : {}));
        if (globalRoot && globalRoot.__persistentBgm) {
          try {
            var pbgm = globalRoot.__persistentBgm;
            try { if (typeof pbgm.pause === 'function') pbgm.pause(); } catch (e) {}
            try { if (typeof pbgm.stop === 'function') pbgm.stop(); } catch (e) {}
            try { if (typeof pbgm.close === 'function') pbgm.close(); } catch (e) {}
            try { pbgm._isPlaying = false; } catch (e) {}
          } catch (e) {}
          try { delete globalRoot.__persistentBgm; } catch (e) {}
        }
      } catch (e) {}

      // clear UI children so nothing continues rendering (try/catch)
      try { jsmaf.root.children.length = 0; } catch (e) {}

      // Best-effort low-level kill attempt (defensive, swallow errors)
      try {
        if (typeof fn !== 'undefined' && typeof fn.getpid === 'function' && typeof fn.kill === 'function') {
          try {
            var pid = fn.getpid();
            var sig9 = (typeof BigInt !== 'undefined') ? BigInt(9) : 9;
            try { fn.kill(pid, sig9); log('fn.kill invoked.'); } catch (ke) { log('fn.kill failed: ' + (ke && ke.message ? ke.message : ke)); }
          } catch (ke2) { log('low-level kill attempt failed: ' + (ke2 && ke2.message ? ke2.message : ke)); }
        } else {
          try { include('userland.js'); } catch (ie) {}
        }
      } catch (e) {
        log('Low-level kill attempt threw: ' + (e && e.message ? e.message : e));
      }

      // Final exit: call jsmaf.exit synchronously wrapped in fallbacks.
      var doExitNow = function () {
        try {
          if (typeof jsmaf.exit === 'function') {
            try { jsmaf.exit(); } catch (ee) { log('jsmaf.exit threw: ' + (ee && ee.message ? ee.message : ee)); }
          } else {
            // fallback: try debugging.restart
            try { if (typeof debugging !== 'undefined' && typeof debugging.restart === 'function') debugging.restart(); } catch (e) {}
          }
        } catch (e) {
          // last resort: attempt again but swallow errors
          try { if (typeof jsmaf.exit === 'function') jsmaf.exit(); } catch (e2) {}
        }
      };

      // Attempt a tiny fade to give user feedback; but if animate will early-return due to __appExiting,
      // call exit immediately. We attempt animate but then call doExitNow synchronously so there's no long window.
      try {
        try {
          if (background) {
            // If animate runs, it will immediately stop because __appExiting === true.
            animate(background, { alpha: background.alpha || 1 }, { alpha: 0 }, 120);
          }
          if (logo) {
            animate(logo, { alpha: logo.alpha || 1 }, { alpha: 0 }, 120);
          }
        } catch (e) {}
        // Call exit immediately (no long wait). This avoids callbacks firing while teardown happens.
        doExitNow();
      } catch (e) {
        try { doExitNow(); } catch (e2) {}
      }
    } catch (e) {
      log('ERROR during graceful shutdown: ' + (e && e.message ? e.message : e));
      try { if (typeof jsmaf.exit === 'function') jsmaf.exit(); } catch (e2) {}
    }
  }

  // click handle
  function handleButtonPress() {
    if (__appExiting) return; // avoid double-entry while shutting down

    var btnIndex = currentButton;
    var btn = buttons[btnIndex];
    var txt = buttonTexts[btnIndex];
    var val = valueTexts[btnIndex];
    var bx = buttonOrigPos[btnIndex] ? buttonOrigPos[btnIndex].x : (btn.x || 0);
    var by = buttonOrigPos[btnIndex] ? buttonOrigPos[btnIndex].y : (btn.y || 0);
    var tx = textOrigPos[btnIndex] ? textOrigPos[btnIndex].x : (txt.x || 0);
    var ty = textOrigPos[btnIndex] ? textOrigPos[btnIndex].y : (txt.y || 0);

    animateClick(btn, txt, bx, by, tx, ty, val, function () {
      // Determine special trio indices (re-evaluate in case of dynamic changes)
      var rAnimIndex = buttons.indexOf(reloadAnimButton);
      var exIndex = buttons.indexOf(exitButton);
      var rJsIndex = buttons.indexOf(reloadJsButton);

      if (btnIndex === exIndex) {
        log('Exiting application (graceful)...');
        try {
          _gracefulShutdownAndExit();
        } catch (e) {
          log('ERROR during exit attempt: ' + (e && e.message ? e.message : e));
          if (e && e.stack) log(e.stack);
        }
      } else if (btnIndex === rAnimIndex) {
        // NEW: Reload-Anim should reset and restart all UI animations as if the app just started
        reloadAnimations();
      } else if (btnIndex === rJsIndex) {
        // SAFE CHANGE: Reload only the main menu JS (do NOT restart the whole app).
        try {
          log('Reloading main menu (safe) ...');
          reloadMainMenu();
        } catch (e) {
          log('ERROR while reloading main menu: ' + (e && e.message ? e.message : e));
        }
      } else if (btnIndex < menuOptions.length) {
        var selectedOption = menuOptions[btnIndex];
        if (!selectedOption) return;
        log('Loading ' + selectedOption.script + '...');
        try {
          include(selectedOption.script);
        } catch (e) {
          log('ERROR loading ' + selectedOption.script + ': ' + (e && e.message ? e.message : e));
          if (e && e.stack) log(e.stack);
        }
      }
    });
  }

  // --- Input handling
  var lastKeyTime = 0;
  jsmaf.onKeyDown = function (keyCode) {
    var now = Date.now();
    if (now - lastKeyTime < 80) return; // small debounce
    lastKeyTime = now;
    if (keyCode === 6 || keyCode === 5) {
      // move forward but skip hidden exit index if it becomes current
      do {
        currentButton = (currentButton + 1) % buttons.length;
      } while (currentButton === HIDDEN_UI_INDEX_EXIT);
      updateHighlight();
    } else if (keyCode === 4 || keyCode === 7) {
      // move backward but skip hidden exit index
      do {
        currentButton = (currentButton - 1 + buttons.length) % buttons.length;
      } while (currentButton === HIDDEN_UI_INDEX_EXIT);
      updateHighlight();
    } else if (keyCode === 14) {
      handleButtonPress();
    } else if (keyCode === 13) {
      // circle / back pressed — IGNORE on main menu to avoid accidental full app restart
      try { log('Back/circle button pressed — ignored on main menu.'); } catch (e) {}
    }
  };

  // --- Intro sequence as requested:
  // 1) logo appears centered and fades in slowly for 1s
  // 2) logo moves straight-line to final top position while scaling to normal (over a longer, more dynamic 1400ms)
  // 3) buttons animate in (same behavior as before)
  // 4) idle loops start immediately when buttons finish
  function introSequence(done) {
    try {
      var fadeMs = 1000; // fade in for 1 second as requested
      var moveMs = 1400;  // moved from 900 -> 1400 to slow it down a bit

      // compute center position for logo appearance
      var logoCenterX = centerX - logoWidth / 2;
      var logoCenterY = (1080 / 2) - (logoHeight / 2) - 60; // slightly above absolute center (adjustable)

      // prepare initial states for dramatic center appear
      try {
        // set background faded slightly to emphasize logo
        if (background) {
          background._baseX = background._baseX || background.x;
          background.alpha = 0.6;
          background.x = background._baseX - 40;
        }

        // set logo into center, slightly larger and invisible -> slow fade in
        logo.x = logoCenterX;
        logo.y = logoCenterY;
        logo.scaleX = 1.15;
        logo.scaleY = 1.15;
        logo.rotation = 0;
        logo.alpha = 0;

        // slow fade-in at center for fadeMs (1s)
        animate(logo, { alpha: 0, scaleX: 1.15, scaleY: 1.15 }, { alpha: 1, scaleX: 1.15, scaleY: 1.15 }, fadeMs, null, function () {
          // tiny beat after fade so the eye perceives the change before moving (50ms)
          jsmaf.setTimeout(function () {
            if (__appExiting) { if (done) done(); return; }

            // now move the logo to its final spot while scaling down to 1.0
            var fromX = logo.x, fromY = logo.y;
            var toX = logoIdle.baseX || (centerX - logoWidth / 2);
            var toY = logoIdle.baseY || 50;

            // use a longer duration and an onStep to add a little curve/overshoot for a more dynamic feel
            animate(
              logo,
              { x: fromX, y: fromY, scaleX: 1.15, scaleY: 1.15 },
              { x: toX, y: toY, scaleX: 1.0, scaleY: 1.0 },
              moveMs,
              function (e) {
                // e is eased progress (0..1). add a subtle arc/overshoot during the move
                try {
                  var arcX = Math.sin(e * Math.PI) * 18; // horizontal subtle swing
                  var arcY = Math.sin(e * Math.PI * 1.4) * 8; // vertical subtle lift then settle
                  // base linear interpolation (animate already sets values; we override to add the arc)
                  var baseX = fromX + (toX - fromX) * e;
                  var baseY = fromY + (toY - fromY) * e;
                  logo.x = baseX + arcX;
                  logo.y = baseY - arcY;
                } catch (err) {}
              },
              function () {
                // ensure final exact values and update idle-base so loops don't jump
                try { logo.rotation = 0; logo.scaleX = 1.0; logo.scaleY = 1.0; logo.x = toX; logo.y = toY; } catch (e) {}
                try { logoIdle.baseX = logo.x; logoIdle.baseY = logo.y; } catch (e) {}

                // Now trigger the button entrance; buttons were hidden — entrance will reveal them and start loops when done.
                try {
                  entrance(true);
                } catch (e) {}

                if (done && typeof done === 'function') done();
              }
            );
          }, 50);
        });
      } catch (e) {
        log('Intro sequence error: ' + (e && e.message ? e.message : e));
        if (done && typeof done === 'function') done();
      }
    } catch (e) {
      log('Intro sequence outer error: ' + (e && e.message ? e.message : e));
      if (done && typeof done === 'function') done();
    }
  }

  // Start the new intro sequence 
  introSequence(function () {
    // highlight after short wait so first button animation completes
    jsmaf.setTimeout(function () {
      if (currentButton === HIDDEN_UI_INDEX_EXIT) currentButton = 0;
      updateHighlight();
    }, 600);
  });

  log(lang.mainMenuLoaded);
})();
