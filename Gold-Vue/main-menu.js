(function () {

  include('languages.js');

  log(lang.loadingMainMenu);



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



  // ensure root is clean

  try { jsmaf.root.children.length = 0; } catch (e) {}



  new Style({ name: 'white', color: 'white', size: 24 });

  new Style({ name: 'title', color: 'white', size: 32 });



  // persistent audio if available

  var audio = null;

  if (typeof CONFIG !== 'undefined' && CONFIG.music) {

    try {

      audio = new jsmaf.AudioClip();

      audio.volume = 0.5;

      audio.open('file://../download0/sfx/bgm.wav');

      if (typeof audio.play === 'function') audio.play();

    } catch (e) {}

  }



  // --- Background + logo

  var background = new Image({

    url: 'file:///../download0/img/multiview_bg_VAF.png',

    x: 0, y: 0, width: 1920, height: 1080

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

  var menuOptions = [

    { label: lang.jailbreak, script: 'loader.js', imgKey: 'jailbreak' },

    { label: lang.payloadMenu, script: 'payload_host.js', imgKey: 'payloadMenu' },

    { label: lang.config, script: 'config_ui.js', imgKey: 'config' },

    { label: (typeof lang !== 'undefined' && lang.fileExplorer) ? lang.fileExplorer : 'File Explorer', script: 'file-explorer.js', imgKey: 'fileExplorer' }

  ];



  var startY = 450;

  var buttonSpacing = 120;

  var buttonWidth = 400;

  var buttonHeight = 80;



  // Defaults

  if (typeof useImageText === 'undefined') useImageText = false;

  if (typeof textImageBase === 'undefined') textImageBase = '';



  // Build vertical menu

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

    } else {

      btnText = new jsmaf.Text();

      btnText.text = menuOptions[i].label;

      btnText.x = btnX + buttonWidth / 2 - 60;

      btnText.y = btnY + buttonHeight / 2 - 12;

      btnText.style = 'white';

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





  var trioY = startY + menuOptions.length * buttonSpacing + 40;

  var trioGap = 30;

  var trioTotalWidth = buttonWidth * 3 + trioGap * 2;

  var trioStartX = centerX - trioTotalWidth / 2;



  // Reload-Anim

  var reloadAnimX = trioStartX;

  var reloadAnimY = trioY;

  var reloadAnimButton = new Image({

    url: normalButtonImg,

    x: reloadAnimX,

    y: reloadAnimY,

    width: buttonWidth,

    height: buttonHeight

  });

  reloadAnimButton.alpha = 0;

  buttons.push(reloadAnimButton);

  jsmaf.root.children.push(reloadAnimButton);

  var reloadAnimIndex = buttons.length - 1;



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

  } else {

    reloadAnimText = new jsmaf.Text();

    reloadAnimText.text = 'Reload-Anim';

    reloadAnimText.x = reloadAnimX + buttonWidth / 2 - 60;

    reloadAnimText.y = reloadAnimY + buttonHeight / 2 - 12;

    reloadAnimText.style = 'white';

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



  // Exit button

  var exitX = trioStartX + buttonWidth + trioGap;

  var exitY = trioY;

  var exitButton = new Image({

    url: normalButtonImg,

    x: exitX,

    y: exitY,

    width: buttonWidth,

    height: buttonHeight

  });

  // keep it hidden during setup/entrance; entrance() will animate alpha -> 1

  exitButton.alpha = 0;

  buttons.push(exitButton);

  jsmaf.root.children.push(exitButton);

  var exitIndex = buttons.length - 1;



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

  } else {

    exitText = new jsmaf.Text();

    exitText.text = lang.exit;

    exitText.x = exitX + buttonWidth / 2 - 20;

    exitText.y = exitY + buttonHeight / 2 - 12;

    exitText.style = 'white';

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



  // Reload-App button

  var reloadAppX = trioStartX + (buttonWidth + trioGap) * 2;

  var reloadAppY = trioY;

  var reloadAppButton = new Image({

    url: normalButtonImg,

    x: reloadAppX,

    y: reloadAppY,

    width: buttonWidth,

    height: buttonHeight

  });

  reloadAppButton.alpha = 0;

  buttons.push(reloadAppButton);

  jsmaf.root.children.push(reloadAppButton);

  var reloadAppIndex = buttons.length - 1;



  var reloadAppMarker = new Image({

    url: 'file:///assets/img/ad_pod_marker.png',

    x: reloadAppX + buttonWidth - 50,

    y: reloadAppY + 35,

    width: 12,

    height: 12,

    visible: false

  });

  buttonMarkers.push(reloadAppMarker);

  jsmaf.root.children.push(reloadAppMarker);



  var reloadAppText;

  if (useImageText) {

    reloadAppText = new Image({

      url: textImageBase + 'reload-app.png',

      x: reloadAppX + 20,

      y: reloadAppY + 15,

      width: 300,

      height: 50

    });

  } else {

    reloadAppText = new jsmaf.Text();

    reloadAppText.text = 'Reload-App';

    reloadAppText.x = reloadAppX + buttonWidth / 2 - 60;

    reloadAppText.y = reloadAppY + buttonHeight / 2 - 12;

    reloadAppText.style = 'white';

  }

  buttonTexts.push(reloadAppText);

  jsmaf.root.children.push(reloadAppText);

  buttonOrigPos.push({ x: reloadAppX, y: reloadAppY });

  textOrigPos.push({ x: reloadAppText.x, y: reloadAppText.y });

  idleOffsets.push({ x: 0, y: 0 });

  idlePhases.push(Math.random() * Math.PI * 2);

  clickAnimHandles.push(null);

  idleAnimHandles.push(null);

  valueTexts.push(null);



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

    var elapsed = 0; var step = 16;

    var id = _setInterval(function () {

      elapsed += step;

      var t = Math.min(elapsed / duration, 1);

      var e = easeInOut(t);

      for (var k in to) {

        try {

          var f = (from && from[k] !== undefined) ? from[k] : (obj[k] || 0);

          obj[k] = f + (to[k] - f) * e;

        } catch (ex) {}

      }

      if (onStep) onStep(e);

      if (t >= 1) {

        try { jsmaf.clearInterval(id); } catch (e2) {}

        if (done) done();

      }

    }, step);

    return id;

  }



  // --- Idle breathing loop

  function startButtonIdleLoop() {

    try {

      if (_buttonIdleInterval) try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {}

      var phase = 0;

      _buttonIdleInterval = jsmaf.setInterval(function () {

        phase += 0.04;

        for (var i = 0; i < buttons.length; i++) {

          try {

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

      phase += 0.06;

      for (var i = 0; i < buttonMarkers.length; i++) {

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



  // --- Logo gentle loop

  function startLogoLoop() {

    var phase = 0;

    if (_logoAnimInterval) try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}

    _logoAnimInterval = jsmaf.setInterval(function () {

      phase += 0.02;

      try {

        logo.y = logoIdle.baseY + Math.sin(phase) * 4;

        logo.scaleX = 0.99 + Math.sin(phase * 0.9) * 0.01;

        logo.scaleY = logo.scaleX;

        if (background) { background.x = background._baseX + Math.sin(phase * 0.4) * 6; }

      } catch (e) {}

    }, 16);

    _intervals.push(_logoAnimInterval);

  }



  // --- Entrance animation

  var markerOrigPos = [];

  function entrance() {

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

        jsmaf.setTimeout(function () {

          try {

            if (b) {

              b.alpha = 0;

              b.rotation = 360;

              b.scaleX = 0.6;

              b.scaleY = 0.6;

              b.y = buttonOrigPos[i].y + 40;

            }

            if (t) {

              t.alpha = 0;

              t.scaleX = 0.6;

              t.scaleY = 0.6;

              t.y = textOrigPos[i].y + 40;

            }

            if (v) {

              v.alpha = v.alpha || 1;

              v.scaleX = 0.6;

              v.scaleY = 0.6;

              v.y = (buttonOrigPos[i] ? buttonOrigPos[i].y + 20 : 0) + 40;

              v.x = (buttonOrigPos[i] ? buttonOrigPos[i].x + 320 : 0);

            }

            if (m) {

              var mo = { x: (buttonOrigPos[i] ? buttonOrigPos[i].x + buttonWidth - 50 : 0), y: (buttonOrigPos[i] ? buttonOrigPos[i].y + 35 : 0) };

              markerOrigPos[i] = mo;

              try { m.x = mo.x; m.y = mo.y + 40; } catch (e) {}

            }

            animate(b, { alpha: 0, rotation: 360, y: (buttonOrigPos[i] ? buttonOrigPos[i].y + 40 : 0), scaleX: 0.6, scaleY: 0.6 }, { alpha: 1, rotation: 0, y: (buttonOrigPos[i] ? buttonOrigPos[i].y : 0), scaleX: 1.08, scaleY: 0.92 }, btnDuration, null, function () {

              animate(b, { scaleX: 1.08, scaleY: 0.92 }, { scaleX: 0.96, scaleY: 1.06 }, 160, null, function () {

                animate(b, { scaleX: 0.96, scaleY: 1.06 }, { scaleX: 1.02, scaleY: 0.98 }, 140, null, function () {

                  animate(b, { scaleX: 1.02, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 120);

                });

              });

            });

            animate(t, { alpha: 0, rotation: 360, y: (textOrigPos[i] ? textOrigPos[i].y + 40 : 0), scaleX: 0.6, scaleY: 0.6 }, { alpha: 1, rotation: 0, y: (textOrigPos[i] ? textOrigPos[i].y : 0), scaleX: 1.02, scaleY: 0.98 }, btnDuration + 80, null, function () {

              animate(t, { scaleX: 1.02, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 160);

            });

            if (v) {

              animate(v, { scaleX: 0.6, scaleY: 0.6, y: (buttonOrigPos[i] ? buttonOrigPos[i].y + 20 + 40 : 0) }, { scaleX: 1.0, scaleY: 1.0, y: (buttonOrigPos[i] ? buttonOrigPos[i].y + 20 : 0) }, btnDuration + 80);

            }

            if (m) {

              animate(m, { alpha: 0, y: (markerOrigPos[i] ? markerOrigPos[i].y + 40 : 0) }, { alpha: 1, y: (markerOrigPos[i] ? markerOrigPos[i].y : 0) }, btnDuration + 40);

            }

          } catch (e) {}

        }, delay);

      })(idx);

    }

    var totalButtons = buttons.length;

    var lastDelay = btnDelayBase + (Math.max(0, totalButtons - 1)) * btnDelayStep;

    var startAfter = lastDelay + btnDuration + 600;

    jsmaf.setTimeout(function () {

      startOrangeDotLoop();

      startLogoLoop();

      startButtonIdleLoop();

    }, startAfter);

  }



  // --- Zoom in/out (squishy) and click animations

  var zoomInInterval = null;

  var zoomOutInterval = null;



  function animateZoomIn(btn, text, btnOrigX, btnOrigY, textOrigX, textOrigY, valueObj) {

    if (zoomInInterval) jsmaf.clearInterval(zoomInInterval);

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

    if (zoomOutInterval) jsmaf.clearInterval(zoomOutInterval);

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



  // --- Click animation

  var clickSfx = null;

  try { clickSfx = new jsmaf.AudioClip(); clickSfx.open('file://../download0/sfx/click.wav'); } catch (e) {}



  function animateClick(btn, txt, btnOrigX, btnOrigY, textOrigX, textOrigY, valueObj, done) {

    try { if (clickSfx && typeof clickSfx.play === 'function') clickSfx.play(); } catch (e) {}

    animate(btn, { scaleX: btn.scaleX || 1.0, scaleY: btn.scaleY || 1.0 }, { scaleX: 0.92, scaleY: 0.92 }, 80, null, function () {

      animate(btn, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140, null, function () {

        animate(btn, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120);

      });

    });

    if (txt) {

      animate(txt, { scaleX: txt.scaleX || 1.0, scaleY: txt.scaleY || 1.0 }, { scaleX: 0.92, scaleY: 0.92 }, 80);

      jsmaf.setTimeout(function () {

        animate(txt, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140);

        jsmaf.setTimeout(function () {

          animate(txt, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120);

        }, 140);

      }, 80);

    }

    if (valueObj) {

      animate(valueObj, { scaleX: valueObj.scaleX || 1.0, scaleY: valueObj.scaleY || 1.0 }, { scaleX: 0.92, scaleY: 0.92 }, 80);

      jsmaf.setTimeout(function () {

        animate(valueObj, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140);

        jsmaf.setTimeout(function () {

          animate(valueObj, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120);

        }, 140);

      }, 80);

    }

    if (done) {

      jsmaf.setTimeout(done, 10);

    }

  }



  // --- Update highlight

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



  // --- Reload animations

  function reloadAnimations() {

    try {

      log('Reloading animations...');

      _clearAllIntervals();

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

            b.alpha = 1.0;

            b.url = normalButtonImg;

            b.borderColor = 'transparent';

            b.borderWidth = 0;

          }

          if (t && torig) {

            t.x = torig.x;

            t.y = torig.y;

            t.scaleX = 1.0;

            t.scaleY = 1.0;

            t.alpha = 1.0;

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

      prevButton = -1;

      currentButton = 0;

      jsmaf.setTimeout(function () {

        entrance();

        jsmaf.setTimeout(function () {

          updateHighlight();

        }, 600);

      }, 80);

    } catch (e) {

      log('ERROR reloading animations: ' + (e && e.message ? e.message : e));

    }

  }



  // --- Graceful shutdown helper

  function _gracefulShutdownAndExit() {

    try {

      log('Performing graceful shutdown...');

      try { jsmaf.onKeyDown = function () {}; } catch (e) {}

      try { _clearAllIntervals(); } catch (e) {}

      try {

        if (clickSfx && typeof clickSfx.stop === 'function') {

          try { clickSfx.stop(); } catch (e) {}

        }

      } catch (e) {}

      try {

        if (audio) {

          try { if (typeof audio.pause === 'function') audio.pause(); } catch (e) {}

          try { if (typeof audio.stop === 'function') audio.stop(); } catch (e) {}

          try { if (typeof audio.close === 'function') audio.close(); } catch (e) {}

          audio = null;

        }

      } catch (e) {}

      try { jsmaf.root.children.length = 0; } catch (e) {}



      // Exit with fade

      try {

        var doExitNow = function () {

          try {

            if (typeof jsmaf.exit === 'function') {

              jsmaf.exit();

            } else {

              try { if (typeof debugging !== 'undefined' && typeof debugging.restart === 'function') debugging.restart(); } catch (e) {}

            }

          } catch (e) {

            try { jsmaf.exit(); } catch (e2) {}

          }

        };

        if (background) animate(background, { alpha: background.alpha || 1 }, { alpha: 0 }, 400);

        if (logo) animate(logo, { alpha: logo.alpha || 1 }, { alpha: 0 }, 400);

        jsmaf.setTimeout(doExitNow, 420);

      } catch (e) {

        doExitNow();

      }

    } catch (e) {

      log('ERROR during graceful shutdown: ' + (e && e.message ? e.message : e));

      try { jsmaf.exit(); } catch (e2) {}

    }

  }



  // --- Centralized  exit

  function performSafeExit() {

    try {

      log('performSafeExit() invoked');

      try { jsmaf.onKeyDown = function () {}; } catch (e) {}

      try { _clearAllIntervals(); } catch (e) {}

      try {

        if (clickSfx && typeof clickSfx.stop === 'function') {

          try { clickSfx.stop(); } catch (e) {}

        }

      } catch (e) {}

      try {

        if (audio) {

          try { if (typeof audio.pause === 'function') audio.pause(); } catch (e) {}

          try { if (typeof audio.stop === 'function') audio.stop(); } catch (e) {}

          try { if (typeof audio.close === 'function') audio.close(); } catch (e) {}

          audio = null;

        }

      } catch (e) {}

      try { jsmaf.root.children.length = 0; } catch (e) {}



      // Low-level platform API fallback

      try {

        try { include('userland.js'); } catch (e) {}

        if (typeof fn !== 'undefined') {

          try {

            if (typeof fn.register === 'function') { try { fn.register('exit_attempt'); } catch (e) {} }

            if (typeof fn.getpid === 'function' && typeof fn.kill === 'function') {

              try {

                var pid = fn.getpid();

                try { fn.kill(pid); } catch (e) {}

              } catch (e) {}

            }

          } catch (e) {}

        }

      } catch (e) {}

      // Final exit

      try { _gracefulShutdownAndExit(); } catch (e) {

        log('performSafeExit -> graceful exit failed: ' + (e && e.message ? e.message : e));

        try { if (typeof jsmaf !== 'undefined' && typeof jsmaf.exit === 'function') jsmaf.exit(); } catch (e2) {}

        try { if (typeof debugging !== 'undefined' && typeof debugging.restart === 'function') debugging.restart(); } catch (e3) {}

        try { include('app_entry.js'); } catch (e4) {}

      }

    } catch (e) {

      log('Unexpected error in performSafeExit(): ' + (e && e.message ? e.message : e));

      try { jsmaf.exit(); } catch (e2) {}

    }

  }



  // --- Button press handler

  function handleButtonPress() {

    var btnIndex = currentButton;

    var btn = buttons[btnIndex];

    var txt = buttonTexts[btnIndex];

    var val = valueTexts[btnIndex];

    var bx = buttonOrigPos[btnIndex] ? buttonOrigPos[btnIndex].x : (btn.x || 0);

    var by = buttonOrigPos[btnIndex] ? buttonOrigPos[btnIndex].y : (btn.y || 0);

    var tx = textOrigPos[btnIndex] ? textOrigPos[btnIndex].x : (txt.x || 0);

    var ty = textOrigPos[btnIndex] ? textOrigPos[btnIndex].y : (txt.y || 0);



    animateClick(btn, txt, bx, by, tx, ty, val, function () {

      var rAnimIndex = buttons.indexOf(reloadAnimButton);

      var exIndex = buttons.indexOf(exitButton);

      var rAppIndex = buttons.indexOf(reloadAppButton);



      if (btnIndex === exIndex) {

        log('Exiting application (safe)...');

        try {

          performSafeExit();

        } catch (e) {

          log('ERROR during performSafeExit: ' + (e && e.message ? e.message : e));

          try { _gracefulShutdownAndExit(); } catch (e2) { try { jsmaf.exit(); } catch (e3) {} }

        }

      } else if (btnIndex === rAnimIndex) {

        reloadAnimations();

      } else if (btnIndex === rAppIndex) {

        log('Restarting...');

        try {

          if (typeof debugging !== 'undefined' && typeof debugging.restart === 'function') {

            debugging.restart();

          } else {

            try { include('app_entry.js'); } catch (e) { log('app_entry.js include failed: ' + (e && e.message ? e.message : e)); }

          }

        } catch (e) {

          log('ERROR while restarting: ' + (e && e.message ? e.message : e));

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

    if (now - lastKeyTime < 80) return; // debounce

    lastKeyTime = now;



    if (keyCode === 6 || keyCode === 5) {

      currentButton = (currentButton + 1) % buttons.length;

      updateHighlight();

    } else if (keyCode === 4 || keyCode === 7) {

      currentButton = (currentButton - 1 + buttons.length) % buttons.length;

      updateHighlight();

    } else if (keyCode === 14) {

      handleButtonPress();

    } else if (keyCode === 13) {

      try {

        log('Restarting...');

        if (typeof debugging !== 'undefined' && typeof debugging.restart === 'function') {

          debugging.restart();

        } else {

          include('app_entry.js');

        }

      } catch (e) {

        log('ERROR while restarting via key: ' + (e && e.message ? e.message : e));

      }

    }

  };



  // --- Start entrance animation and highlight

  entrance();

  jsmaf.setTimeout(function () {

    updateHighlight();

  }, 600);

  log(lang.mainMenuLoaded);

})();