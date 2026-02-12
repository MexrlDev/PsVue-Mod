if (typeof libc_addr === 'undefined') {
  include('userland.js');
}
if (typeof lang === 'undefined') {
  include('languages.js');
}
(function () {
  log(lang.loadingConfig);

  var fs = {
    write: function (filename, content, callback) {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && callback) {
          callback(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed'));
        }
      };
      xhr.open('POST', 'file://../download0/' + filename, true);
      xhr.send(content);
    },
    read: function (filename, callback) {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && callback) {
          callback(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed'), xhr.responseText);
        }
      };
      xhr.open('GET', 'file://../download0/' + filename, true);
      xhr.send();
    }
  };

  var currentConfig = {
    autolapse: false,
    autopoop: false,
    autoclose: false,
    music: true,
    jb_behavior: 0
  };

  // Store user's payloads so we don't overwrite them
  var userPayloads = [];
  var jbBehaviorLabels = [lang.jbBehaviorAuto, lang.jbBehaviorNetctrl, lang.jbBehaviorLapse];
  var jbBehaviorImgKeys = ['jbBehaviorAuto', 'jbBehaviorNetctrl', 'jbBehaviorLapse'];

  var currentButton = 0;
  var buttons = [];
  var buttonTexts = [];
  var buttonMarkers = [];
  var buttonOrigPos = [];
  var textOrigPos = [];
  var valueTexts = [];

  var normalButtonImg = 'file:///../download0/img/button_over_9.png';
  var selectedButtonImg = 'file:///../download0/img/button_over_9.png';

  jsmaf.root.children.length = 0;

  new Style({ name: 'white', color: 'white', size: 24 });
  new Style({ name: 'title', color: 'white', size: 32 });

  // Use persistent bgm if available; config UI should not create its own bgm instance.
  var __globalRoot = (typeof global !== 'undefined') ? global : ((typeof window !== 'undefined') ? window : ((typeof self !== 'undefined') ? self : this || {}));

  // click SFX for button press animation
  var clickSfx = new jsmaf.AudioClip();
  try { clickSfx.open('file://../download0/sfx/click.wav'); } catch (e) {}

  // background + logo
  var background = new Image({
    url: 'file:///../download0/img/multiview_bg_VAF.png',
    x: 0,
    y: 0,
    width: 1920,
    height: 1080
  });
  background._baseX = background.x;
  jsmaf.root.children.push(background);

  var logo = new Image({
    url: 'file:///../download0/img/logo.png',
    x: 1620,
    y: 0,
    width: 300,
    height: 169
  });
  jsmaf.root.children.push(logo);

  if (useImageText) {
    var title = new Image({
      url: textImageBase + 'config.png',
      x: 860,
      y: 100,
      width: 200,
      height: 60
    });
    jsmaf.root.children.push(title);
  } else {
    var _title = new jsmaf.Text();
    _title.text = lang.config;
    _title.x = 910;
    _title.y = 120;
    _title.style = 'title';
    jsmaf.root.children.push(_title);
  }

  // Include the stats tracker
  include('stats-tracker.js');

  // Load and display stats
  stats.load();
  var statsData = stats.get();

  // Create text elements for each stat
  var statsImgKeys = ['totalAttempts', 'successes', 'failures', 'successRate', 'failureRate'];
  var statsValues = [statsData.total, statsData.success, statsData.failures, statsData.successRate, statsData.failureRate];
  var statsLabels = [lang.totalAttempts, lang.successes, lang.failures, lang.successRate, lang.failureRate];

  for (var i = 0; i < statsImgKeys.length; i++) {
    var yPos = 120 + i * 25;
    if (useImageText) {
      var labelImg = new Image({
        url: textImageBase + statsImgKeys[i] + '.png',
        x: 20,
        y: yPos,
        width: 180,
        height: 25
      });
      jsmaf.root.children.push(labelImg);
      var valueText = new jsmaf.Text();
      valueText.text = String(statsValues[i]);
      valueText.x = 210;
      valueText.y = yPos;
      valueText.style = 'white';
      jsmaf.root.children.push(valueText);
    } else {
      var lineText = new jsmaf.Text();
      lineText.text = statsLabels[i] + statsValues[i];
      lineText.x = 20;
      lineText.y = yPos;
      lineText.style = 'white';
      jsmaf.root.children.push(lineText);
    }
  }

  var configOptions = [
    { key: 'autolapse', label: lang.autoLapse, imgKey: 'autoLapse', type: 'toggle' },
    { key: 'autopoop', label: lang.autoPoop, imgKey: 'autoPoop', type: 'toggle' },
    { key: 'autoclose', label: lang.autoClose, imgKey: 'autoClose', type: 'toggle' },
    { key: 'music', label: lang.music, imgKey: 'music', type: 'toggle' },
    { key: 'jb_behavior', label: lang.jbBehavior, imgKey: 'jbBehavior', type: 'cycle' }
  ];

  var centerX = 960;
  var startY = 300;
  var buttonSpacing = 120;
  var buttonWidth = 400;
  var buttonHeight = 80;

  // keep value/check label inside button: compute once from buttonWidth
  var valueXOffset = Math.floor(buttonWidth / 2) + 30; // safe inside-right area in button

  for (var _i = 0; _i < configOptions.length; _i++) {
    var configOption = configOptions[_i];
    var btnX = centerX - buttonWidth / 2;
    var btnY = startY + _i * buttonSpacing;

    var button = new Image({
      url: normalButtonImg,
      x: btnX,
      y: btnY,
      width: buttonWidth,
      height: buttonHeight
    });
    buttons.push(button);
    jsmaf.root.children.push(button);

    // placeholder for marker (not used for config toggles but kept for consistency)
    buttonMarkers.push(null);

    var btnText;
    if (useImageText) {
      btnText = new Image({
        url: textImageBase + configOption.imgKey + '.png',
        x: btnX + 20,
        y: btnY + 15,
        width: 200,
        height: 50
      });
    } else {
      btnText = new jsmaf.Text();
      btnText.text = configOption.label;
      btnText.x = btnX + 30;
      btnText.y = btnY + 28;
      btnText.style = 'white';
    }
    buttonTexts.push(btnText);
    jsmaf.root.children.push(btnText);

    if (configOption.type === 'toggle') {
      var checkmark = new Image({
        url: currentConfig[configOption.key] ? 'file:///../download0/img/check_small_on.png' : 'file:///../download0/img/check_small_off.png',
        x: btnX + valueXOffset - 20,
        y: btnY + 20,
        width: 40,
        height: 40
      });
      valueTexts.push(checkmark);
      jsmaf.root.children.push(checkmark);
    } else {
      var valueLabel;
      if (useImageText) {
        valueLabel = new Image({
          url: textImageBase + jbBehaviorImgKeys[currentConfig.jb_behavior] + '.png',
          x: btnX + valueXOffset,
          y: btnY + 15,
          width: 150,
          height: 50
        });
      } else {
        valueLabel = new jsmaf.Text();
        valueLabel.text = jbBehaviorLabels[currentConfig.jb_behavior] || jbBehaviorLabels[0];
        // place inside button's right half so it doesn't overflow
        valueLabel.x = btnX + valueXOffset;
        valueLabel.y = btnY + 28;
        valueLabel.style = 'white';
      }
      valueTexts.push(valueLabel);
      jsmaf.root.children.push(valueLabel);
    }

    buttonOrigPos.push({ x: btnX, y: btnY });
    textOrigPos.push({ x: btnText.x, y: btnText.y });
  }

  // back button (raised a bit)
  var backX = centerX - buttonWidth / 2;
  var backY = startY + configOptions.length * buttonSpacing + 60; // raised from +100 to +60
  var backButton = new Image({
    url: normalButtonImg,
    x: backX,
    y: backY,
    width: buttonWidth,
    height: buttonHeight
  });
  buttons.push(backButton);
  jsmaf.root.children.push(backButton);

  var backMarker = new Image({
    url: 'file:///assets/img/ad_pod_marker.png',
    x: backX + buttonWidth - 50,
    y: backY + 35,
    width: 12,
    height: 12,
    visible: false
  });
  buttonMarkers.push(backMarker);
  jsmaf.root.children.push(backMarker);

  var backText;
  if (useImageText) {
    backText = new Image({
      url: textImageBase + 'back.png',
      x: backX + 20,
      y: backY + 15,
      width: 200,
      height: 50
    });
  } else {
    backText = new jsmaf.Text();
    backText.text = lang.back;
    backText.x = backX + buttonWidth / 2 - 20;
    backText.y = backY + buttonHeight / 2 - 12;
    backText.style = 'white';
  }
  buttonTexts.push(backText);
  jsmaf.root.children.push(backText);

  buttonOrigPos.push({ x: backX, y: backY });
  textOrigPos.push({ x: backText.x, y: backText.y });

  // animation state
  var zoomInInterval = null;
  var zoomOutInterval = null;
  var prevButton = -1;

  function easeInOut(t) {
    return (1 - Math.cos(t * Math.PI)) / 2;
  }

  // --- Reusable animate helper and interval management
  var _intervals = [];
  var _markerPulseInterval = null;
  var _logoAnimInterval = null;
  var _buttonIdleInterval = null;
  var _bgmFadeInterval = null;

  function _setInterval(fn, ms) { var id = jsmaf.setInterval(fn, ms); _intervals.push(id); return id; }
  function _clearAllIntervals() { for (var i = 0; i < _intervals.length; i++) { try { jsmaf.clearInterval(_intervals[i]); } catch (e) {} } _intervals = []; if (_markerPulseInterval) { try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {} _markerPulseInterval = null; } if (_logoAnimInterval) { try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {} _logoAnimInterval = null; } if (_bgmFadeInterval) { try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {} _bgmFadeInterval = null; } if (_buttonIdleInterval) { try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {} _buttonIdleInterval = null; } }

  function animate(obj, from, to, duration, onStep, done) {
    var elapsed = 0; var step = 16;
    var id = _setInterval(function () {
      elapsed += step; var t = Math.min(elapsed / duration, 1); var e = easeInOut(t);
      for (var k in to) { try { var f = (from && from[k] !== undefined) ? from[k] : (obj[k] || 0); obj[k] = f + (to[k] - f) * e; } catch (ex) {} }
      if (onStep) onStep(e);
      if (t >= 1) { try { jsmaf.clearInterval(id); } catch (e2) {} if (done) done(); }
    }, step);
    return id;
  }

  // --- Idle breathing loop (buttons + text + valueTexts move together)
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
              if (t) { t.scaleX = sx; t.scaleY = sy; t.y = (textOrigPos[i] ? textOrigPos[i].y : t.y) + dy; t.x = (textOrigPos[i] ? textOrigPos[i].x : t.x) - buttonWidth * (sx - 1) / 2; }
              if (v) { v.scaleX = sx; v.scaleY = sy; v.y = (buttonOrigPos[i] ? buttonOrigPos[i].y + 20 : v.y) + dy; v.x = (buttonOrigPos[i] ? buttonOrigPos[i].x + valueXOffset : v.x) - buttonWidth * (sx - 1) / 2; }
            } else {
              b.scaleX = 1 + Math.sin(p) * 0.01;
              b.scaleY = 1 - Math.sin(p) * 0.01;
              b.x = buttonOrigPos[i] ? buttonOrigPos[i].x : b.x;
              b.y = buttonOrigPos[i] ? buttonOrigPos[i].y : b.y;
              if (t) { t.scaleX = b.scaleX; t.scaleY = b.scaleY; t.x = textOrigPos[i] ? textOrigPos[i].x : t.x; t.y = textOrigPos[i] ? textOrigPos[i].y : t.y; }
              if (v) { v.scaleX = b.scaleX; v.scaleY = b.scaleY; v.x = buttonOrigPos[i] ? buttonOrigPos[i].x + valueXOffset : v.x; v.y = buttonOrigPos[i] ? buttonOrigPos[i].y + 20 : v.y; }
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

  // --- Orange marker pulse (not heavily used here but kept)
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

  // --- Logo gentle loop (only move the logo in a loop)
  function startLogoLoop() {
    var phase = 0;
    if (_logoAnimInterval) try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}
    _logoAnimInterval = jsmaf.setInterval(function () {
      phase += 0.02;
      try {
        // Only animate the logo (vertical bob and subtle scale)
        logo.y = 0 + Math.sin(phase) * 4;
        logo.scaleX = 0.99 + Math.sin(phase * 0.9) * 0.01;
        logo.scaleY = logo.scaleX;
        // Intentionally do not modify background.x here so only the logo moves
      } catch (e) {}
    }, 16);
    _intervals.push(_logoAnimInterval);
  }

  // --- Entrance animation (buttons, text, markers, valueTexts move together)
  var markerOrigPos = [];
  function entrance() {
    try {
      animate(background, { alpha: background.alpha || 0 }, { alpha: 1 }, 800);
      animate(logo, { alpha: logo.alpha || 0, scaleX: logo.scaleX || 0.95, scaleY: logo.scaleY || 0.95 }, { alpha: 1, scaleX: 1.0, scaleY: 1.0 }, 900);
    } catch (e) {}
    var btnDelayBase = 220;
    var btnDelayStep = 140;
    var btnDuration = 1200;
    for (var i = 0; i < buttons.length; i++) {
      (function (idx) {
        var b = buttons[idx]; var t = buttonTexts[idx]; var m = buttonMarkers[idx]; var v = valueTexts[idx];
        var delay = btnDelayBase + idx * btnDelayStep;
        jsmaf.setTimeout(function () {
          try {
            if (b) {
              b.alpha = 0;
              b.rotation = 360;
              b.scaleX = 0.6;
              b.scaleY = 0.6;
              b.y = buttonOrigPos[idx].y + 40;
            }
            if (t) {
              t.alpha = 0;
              t.scaleX = 0.6;
              t.scaleY = 0.6;
              t.y = textOrigPos[idx].y + 40;
            }
            if (v) {
              v.alpha = v.alpha || 1;
              v.scaleX = 0.6;
              v.scaleY = 0.6;
              v.y = (buttonOrigPos[idx] ? buttonOrigPos[idx].y + 20 : 0) + 40;
              v.x = (buttonOrigPos[idx] ? buttonOrigPos[idx].x + valueXOffset : 0);
            }
            animate(b, { alpha: 0, rotation: 360, y: (buttonOrigPos[idx] ? buttonOrigPos[idx].y + 40 : 0), scaleX: 0.6, scaleY: 0.6 }, { alpha: 1, rotation: 0, y: (buttonOrigPos[idx] ? buttonOrigPos[idx].y : 0), scaleX: 1.08, scaleY: 0.92 }, btnDuration, null, function () {
              animate(b, { scaleX: 1.08, scaleY: 0.92 }, { scaleX: 0.96, scaleY: 1.06 }, 160, null, function () {
                animate(b, { scaleX: 0.96, scaleY: 1.06 }, { scaleX: 1.02, scaleY: 0.98 }, 140, null, function () {
                  animate(b, { scaleX: 1.02, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 120);
                });
              });
            });
            animate(t, { alpha: 0, rotation: 360, y: (textOrigPos[idx] ? textOrigPos[idx].y + 40 : 0), scaleX: 0.6, scaleY: 0.6 }, { alpha: 1, rotation: 0, y: (textOrigPos[idx] ? textOrigPos[idx].y : 0), scaleX: 1.02, scaleY: 0.98 }, btnDuration + 80, null, function () {
              animate(t, { scaleX: 1.02, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 160);
            });
            if (v) {
              animate(v, { scaleX: 0.6, scaleY: 0.6, y: (buttonOrigPos[idx] ? buttonOrigPos[idx].y + 20 + 40 : 0) }, { scaleX: 1.0, scaleY: 1.0, y: (buttonOrigPos[idx] ? buttonOrigPos[idx].y + 20 : 0) }, btnDuration + 80);
            }
            if (m) {
              var mo = { x: (buttonOrigPos[idx] ? buttonOrigPos[idx].x + buttonWidth - 50 : 0), y: (buttonOrigPos[idx] ? buttonOrigPos[idx].y + 35 : 0) };
              markerOrigPos[idx] = mo;
              try { m.x = mo.x; m.y = mo.y + 40; } catch (e) {}
              animate(m, { alpha: 0, y: mo.y + 40 }, { alpha: 1, y: mo.y }, btnDuration + 40);
            }
          } catch (e) {}
        }, delay);
      })(i);
    }
    var totalButtons = buttons.length;
    var lastDelay = btnDelayBase + (Math.max(0, totalButtons - 1)) * btnDelayStep;
    var startAfter = lastDelay + btnDuration + 600;
    jsmaf.setTimeout(function () {
      startOrangeDotLoop();
      startLogoLoop();
      startButtonIdleLoop();
      // start bgm if music is enabled in config (use global setter if available)
      try {
        if (currentConfig.music) {
          if (typeof __globalRoot.__setMusicEnabled === 'function') __globalRoot.__setMusicEnabled(true);
          else if (__globalRoot.__persistentBgm && __globalRoot.__persistentBgm._valid && typeof __globalRoot.__persistentBgm.play === 'function') try { __globalRoot.__persistentBgm.play(); __globalRoot.__persistentBgm._isPlaying = true; } catch (e) {}
        } else {
          if (typeof __globalRoot.__setMusicEnabled === 'function') __globalRoot.__setMusicEnabled(false);
          else if (__globalRoot.__persistentBgm && __globalRoot.__persistentBgm._valid) try { __globalRoot.__persistentBgm.stop(); __globalRoot.__persistentBgm._isPlaying = false; } catch (e) {}
        }
      } catch (e) {}
    }, startAfter);
  }

  // --- Zoom in/out (squishy) updated to move valueTexts with button
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
    zoomInInterval = jsmaf.setInterval(function () {
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeInOut(t);
      var sx = startScale + (endScaleX - startScale) * eased;
      var sy = startScale + (endScaleY - startScale) * eased;
      btn.scaleX = sx;
      btn.scaleY = sy;
      btn.x = btnOrigX - btnW * (sx - 1) / 2;
      btn.y = btnOrigY - btnH * (sy - 1) / 2;
      if (text) {
        text.scaleX = sx;
        text.scaleY = sy;
        text.x = textOrigX - btnW * (sx - 1) / 2;
        text.y = textOrigY - btnH * (sy - 1) / 2;
      }
      if (valueObj) {
        valueObj.scaleX = sx;
        valueObj.scaleY = sy;
        valueObj.x = (btnOrigX + valueXOffset) - btnW * (sx - 1) / 2;
        valueObj.y = (btnOrigY + 20) - btnH * (sy - 1) / 2;
      }
      if (t >= 1) {
        try { jsmaf.clearInterval(zoomInInterval); } catch (ex) {}
        zoomInInterval = null;
        // settle chain
        animate(btn, { scaleX: endScaleX, scaleY: endScaleY }, { scaleX: 1.04, scaleY: 0.98 }, 120, null, function () {
          animate(btn, { scaleX: 1.04, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 120);
        });
        if (text) {
          animate(text, { scaleX: endScaleX, scaleY: endScaleY }, { scaleX: 1.04, scaleY: 0.98 }, 120, null, function () {
            animate(text, { scaleX: 1.04, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 120);
          });
        }
        if (valueObj) {
          animate(valueObj, { scaleX: endScaleX, scaleY: endScaleY }, { scaleX: 1.04, scaleY: 0.98 }, 120, null, function () {
            animate(valueObj, { scaleX: 1.04, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 120);
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
    zoomOutInterval = jsmaf.setInterval(function () {
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeInOut(t);
      var sx = startScaleX + (endScaleX - startScaleX) * eased;
      var sy = startScaleY + (endScaleY - startScaleY) * eased;
      btn.scaleX = sx;
      btn.scaleY = sy;
      btn.x = btnOrigX - btnW * (sx - 1) / 2;
      btn.y = btnOrigY - btnH * (sy - 1) / 2;
      if (text) {
        text.scaleX = sx;
        text.scaleY = sy;
        text.x = textOrigX - btnW * (sx - 1) / 2;
        text.y = textOrigY - btnH * (sy - 1) / 2;
      }
      if (valueObj) {
        valueObj.scaleX = sx;
        valueObj.scaleY = sy;
        valueObj.x = (btnOrigX + valueXOffset) - btnW * (sx - 1) / 2;
        valueObj.y = (btnOrigY + 20) - btnH * (sy - 1) / 2;
      }
      if (t >= 1) {
        try { jsmaf.clearInterval(zoomOutInterval); } catch (ex) {}
        zoomOutInterval = null;
      }
    }, step);
  }

  // --- Click animation (shrink -> overshoot -> settle) and ensure valueTexts move with it
  function animateClick(btn, txt, btnOrigX, btnOrigY, textOrigX, textOrigY, valueObj, done) {
    try { if (clickSfx && typeof clickSfx.play === 'function') clickSfx.play(); } catch (e) {}
    // quick shrink
    animate(btn, { scaleX: btn.scaleX || 1.0, scaleY: btn.scaleY || 1.0 }, { scaleX: 0.92, scaleY: 0.92 }, 80, null, function () {
      // overshoot
      animate(btn, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140, null, function () {
        // settle
        animate(btn, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120, null, function () {
          if (done) done();
        });
      });
    });
    // mirror for text and valueObj (no rotation)
    if (txt) {
      animate(txt, { scaleX: txt.scaleX || 1.0, scaleY: txt.scaleY || 1.0 }, { scaleX: 0.92, scaleY: 0.92 }, 80);
      jsmaf.setTimeout(function () {
        animate(txt, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140);
        jsmaf.setTimeout(function () { animate(txt, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120); }, 140);
      }, 80);
    }
    if (valueObj) {
      animate(valueObj, { scaleX: valueObj.scaleX || 1.0, scaleY: valueObj.scaleY || 1.0 }, { scaleX: 0.92, scaleY: 0.92 }, 80);
      jsmaf.setTimeout(function () {
        animate(valueObj, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140);
        jsmaf.setTimeout(function () { animate(valueObj, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120); }, 140);
      }, 80);
    }
  }

  // --- updateHighlight wires valueTexts into zoom in/out and ensures markers are handled
  function updateHighlight() {
    // Animate out the previous button
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

    // Set styles for all buttons
    for (var _i2 = 0; _i2 < buttons.length; _i2++) {
      var _button = buttons[_i2];
      var _buttonMarker = buttonMarkers[_i2];
      var buttonText = buttonTexts[_i2];
      var buttonOrigPos_ = buttonOrigPos[_i2];
      var textOrigPos_ = textOrigPos[_i2];
      var valueObj = valueTexts[_i2];
      if (_button === undefined || buttonText === undefined || buttonOrigPos_ === undefined || textOrigPos_ === undefined) continue;
      if (_i2 === currentButton) {
        _button.url = selectedButtonImg;
        _button.alpha = 1.0;
        _button.borderColor = 'rgb(122, 91, 6)';
        _button.borderWidth = 3;
        if (_buttonMarker) _buttonMarker.visible = true;
        animateZoomIn(_button, buttonText, buttonOrigPos_.x, buttonOrigPos_.y, textOrigPos_.x, textOrigPos_.y, valueObj);
      } else if (_i2 !== prevButton) {
        _button.url = normalButtonImg;
        _button.alpha = 0.7;
        _button.borderColor = 'transparent';
        _button.borderWidth = 0;
        _button.scaleX = 1.0;
        _button.scaleY = 1.0;
        _button.x = buttonOrigPos_.x;
        _button.y = buttonOrigPos_.y;
        buttonText.scaleX = 1.0;
        buttonText.scaleY = 1.0;
        buttonText.x = textOrigPos_.x;
        buttonText.y = textOrigPos_.y;
        if (valueObj) {
          valueObj.scaleX = 1.0;
          valueObj.scaleY = 1.0;
          valueObj.x = buttonOrigPos_.x + valueXOffset;
          valueObj.y = buttonOrigPos_.y + 20;
        }
        if (_buttonMarker) _buttonMarker.visible = false;
      }
      try { if (buttonText && buttonText.constructor && buttonText.constructor.name === 'Text') buttonText.style = 'white'; } catch (e) {}
    }
    prevButton = currentButton;
  }

  function updateValueText(index) {
    var options = configOptions[index];
    var valueText = valueTexts[index];
    if (!options || !valueText) return;
    var key = options.key;
    if (options.type === 'toggle') {
      var value = currentConfig[key];
      valueText.url = value ? 'file:///../download0/img/check_small_on.png' : 'file:///../download0/img/check_small_off.png';
    } else {
      if (useImageText) {
        valueText.url = textImageBase + jbBehaviorImgKeys[currentConfig.jb_behavior] + '.png';
      } else {
        valueText.text = jbBehaviorLabels[currentConfig.jb_behavior] || jbBehaviorLabels[0];
      }
    }
  }

  function saveConfig() {
    var configContent = 'const CONFIG = {\n';
    configContent += '    autolapse: ' + currentConfig.autolapse + ',\n';
    configContent += '    autopoop: ' + currentConfig.autopoop + ',\n';
    configContent += '    autoclose: ' + currentConfig.autoclose + ',\n';
    configContent += '    music: ' + currentConfig.music + ',\n';
    configContent += '    jb_behavior: ' + currentConfig.jb_behavior + '\n';
    configContent += '};\n\n';
    configContent += 'const payloads = [ //to be ran after jailbroken\n';
    for (var _i3 = 0; _i3 < userPayloads.length; _i3++) {
      configContent += '    "' + userPayloads[_i3] + '"';
      if (_i3 < userPayloads.length - 1) {
        configContent += ',';
      }
      configContent += '\n';
    }
    configContent += '];\n';
    fs.write('config.js', configContent, function (err) {
      if (err) {
        log('ERROR: Failed to save config: ' + err.message);
      } else {
        log('Config saved successfully');
      }
    });
  }

  function loadConfig() {
    fs.read('config.js', function (err, data) {
      if (err) {
        log('ERROR: Failed to read config: ' + err.message);
        return;
      }
      try {
        eval(data || ''); // eslint-disable-line no-eval
        if (typeof CONFIG !== 'undefined') {
          currentConfig.autolapse = CONFIG.autolapse || false;
          currentConfig.autopoop = CONFIG.autopoop || false;
          currentConfig.autoclose = CONFIG.autoclose || false;
          currentConfig.music = CONFIG.music !== false;
          currentConfig.jb_behavior = CONFIG.jb_behavior || 0;

          // Preserve user's payloads
          if (typeof payloads !== 'undefined' && Array.isArray(payloads)) {
            userPayloads = payloads.slice();
          }
          for (var _i4 = 0; _i4 < configOptions.length; _i4++) {
            updateValueText(_i4);
          }
          log('Config loaded successfully');

          // Ensure music state matches config after loading
          try {
            if (currentConfig.music) {
              if (typeof __globalRoot.__setMusicEnabled === 'function') __globalRoot.__setMusicEnabled(true);
            } else {
              if (typeof __globalRoot.__setMusicEnabled === 'function') __globalRoot.__setMusicEnabled(false);
            }
          } catch (e) {}
        }
      } catch (e) {
        log('ERROR: Failed to parse config: ' + e.message);
      }
    });
  }

  // --- handleButtonPress triggers click animation first, then performs action
  function handleButtonPress() {
    var btnIndex = currentButton;
    var btn = buttons[btnIndex];
    var txt = buttonTexts[btnIndex];
    var val = valueTexts[btnIndex];
    var bx = buttonOrigPos[btnIndex] ? buttonOrigPos[btnIndex].x : (btn.x || 0);
    var by = buttonOrigPos[btnIndex] ? buttonOrigPos[btnIndex].y : (btn.y || 0);
    animateClick(btn, txt, bx, by, textOrigPos[btnIndex] ? textOrigPos[btnIndex].x : (txt.x || 0), textOrigPos[btnIndex] ? textOrigPos[btnIndex].y : (txt.y || 0), val, function () {
      // After click animation completes, perform the original logic
      if (btnIndex === buttons.length - 1) {
        // back button -> restart (preserve original behavior)
        log('Restarting...');
        debugging.restart();
        return;
      }
      if (btnIndex < configOptions.length) {
        var option = configOptions[btnIndex];
        var key = option.key;
        if (option.type === 'cycle') {
          currentConfig.jb_behavior = (currentConfig.jb_behavior + 1) % jbBehaviorLabels.length;
          log(key + ' = ' + jbBehaviorLabels[currentConfig.jb_behavior]);
        } else {
          var boolKey = key;
          currentConfig[boolKey] = !currentConfig[boolKey];
          if (key === 'autolapse' && currentConfig.autolapse === true) {
            currentConfig.autopoop = false;
            for (var _i5 = 0; _i5 < configOptions.length; _i5++) {
              if (configOptions[_i5].key === 'autopoop') {
                updateValueText(_i5);
                break;
              }
            }
            log('autopoop disabled (autolapse enabled)');
          } else if (key === 'autopoop' && currentConfig.autopoop === true) {
            currentConfig.autolapse = false;
            for (var _i6 = 0; _i6 < configOptions.length; _i6++) {
              if (configOptions[_i6].key === 'autolapse') {
                updateValueText(_i6);
                break;
              }
            }
            log('autolapse disabled (autopoop enabled)');
          }
          log(key + ' = ' + currentConfig[boolKey]);

          // Special handling: if music toggle changed, propagate to global persistent bgm
          if (key === 'music') {
            try {
              // prefer global setter if available
              if (typeof __globalRoot.__setMusicEnabled === 'function') {
                __globalRoot.__setMusicEnabled(!!currentConfig.music);
              } else {
                // fallback: try to control persistent bgm directly
                var g = __globalRoot.__persistentBgm;
                if (g && g._valid) {
                  if (currentConfig.music) {
                    try { if (typeof g.play === 'function') g.play(); g._isPlaying = true; } catch (e) {}
                    // fade in if possible
                    try {
                      if (_bgmFadeInterval) try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}
                      var elapsed = 0; var dur = 900; var step = 50;
                      _bgmFadeInterval = jsmaf.setInterval(function () { elapsed += step; var t = Math.min(elapsed / dur, 1); try { g.volume = 0.45 * t; } catch (e) {} if (t >= 1) { try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {} _bgmFadeInterval = null; } }, step);
                    } catch (e) {}
                  } else {
                    try { if (typeof g.stop === 'function') g.stop(); g._isPlaying = false; } catch (e) {}
                    try { g.volume = 0; } catch (e) {}
                  }
                }
              }
            } catch (e) { log('Error toggling global music: ' + (e.message || e)); }
          }
        }
        updateValueText(btnIndex);
        saveConfig();
      }
    });
  }

  // input handling
  jsmaf.onKeyDown = function (keyCode) {
    if (keyCode === 6 || keyCode === 5) {
      currentButton = (currentButton + 1) % buttons.length;
      updateHighlight();
    } else if (keyCode === 4 || keyCode === 7) {
      currentButton = (currentButton - 1 + buttons.length) % buttons.length;
      updateHighlight();
    } else if (keyCode === 14) {
      handleButtonPress();
    } else if (keyCode === 13) {
      log('Restarting...');
      debugging.restart();
    }
  };

  // initial highlight + load config
  updateHighlight();
  loadConfig();
  entrance();
  log(lang.configLoaded);

})();
