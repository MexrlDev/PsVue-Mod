if (typeof libc_addr === 'undefined') {
  include('userland.js');
}
if (typeof lang === 'undefined') {
  include('languages.js');
}
(function () {
  log(lang.loadingConfig);

  // Animation interval handles (for cleanup)
  var bgAnimInterval = null;
  var bgPreloadChecker = null;
  var logoAnimInterval = null;

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
  var configLoaded = false;
  var jbBehaviorLabels = [lang.jbBehaviorAuto, lang.jbBehaviorNetctrl, lang.jbBehaviorLapse];
  var jbBehaviorImgKeys = ['jbBehaviorAuto', 'jbBehaviorNetctrl', 'jbBehaviorLapse'];

  var currentButton = 0;
  var buttons = [];
  var buttonTexts = [];
  var buttonMarkers = [];
  var buttonOrigPos = [];
  var textCenterPos = [];
  var valueTexts = []; // holds either Images (checkmarks) or Text (jb label)
  var valueOrigPos = [];

  var idleParams = [];

  var normalButtonImg = 'file://../download0/img/button_over_9.png';
  var selectedButtonImg = 'file://../download0/img/button_over_9.png';
  jsmaf.root.children.length = 0;

  new Style({ name: 'white', color: 'white', size: 24 });
  new Style({ name: 'title', color: 'white', size: 32 });
  new Style({ name: 'small', color: 'white', size: 18 });

  // audio handler (create/close dynamically when music setting changes)
  var audio = null;
  function startBackgroundAudio() {
    try {
      if (!audio) {
        audio = new jsmaf.AudioClip();
        audio.volume = 0.5;
        try { audio.open('file://../download0/sfx/bgm.wav'); } catch (e) { log('Audio open error: ' + (e.message || e)); }
        // try to play if API exists
        try { if (typeof audio.play === 'function') audio.play(); } catch (e) {}
      } else {
        try { if (typeof audio.play === 'function') audio.play(); } catch (e) {}
      }
    } catch (e) { log('Audio start error: ' + e.message); }
  }
  function stopBackgroundAudio() {
    try {
      if (audio) {
        try { if (typeof audio.stop === 'function') audio.stop(); } catch (e) {}
        try { if (typeof audio.close === 'function') audio.close(); } catch (e) {}
        audio = null;
      }
    } catch (e) { log('Audio stop error: ' + e.message); }
  }

  // ==================== ANIMATED BACKGROUND ====================
  var bgBase = 'file:///../download0/BgAnim/Theme-Ps1-';
  var bgExt = '.png';
  var bgFramesTotal = 27;          // 27 frames total
  var bgFPS = 20;                  // playback fps
  var bgFrameIntervalMs = Math.round(1000 / bgFPS);
  var bgFrameIndex = 0;
  var bgUrls = [];
  for (var bi = 0; bi < bgFramesTotal; bi++) {
    bgUrls.push(bgBase + bi + bgExt);
  }

  // Visible background shown to the user
  var background = new Image({
    url: bgUrls[0],
    x: 0, y: 0, width: 1920, height: 1080
  });
  jsmaf.root.children.push(background);

  // Preload hidden images (placed offscreen and invisible) to ensure frames are loaded before animation
  var bgPreloads = [];
  for (var p = 0; p < bgUrls.length; p++) {
    try {
      var pr = new Image({
        url: bgUrls[p],
        x: -9999, y: -9999,
        width: 1, height: 1,
        alpha: 0,
        visible: false
      });
      pr._loaded = false;
      bgPreloads.push(pr);
      jsmaf.root.children.push(pr);
    } catch (e) { }
  }

  function countLoadedPreloads() {
    var cnt = 0;
    for (var i = 0; i < bgPreloads.length; i++) {
      var pimg = bgPreloads[i];
      if (!pimg) continue;
      if (pimg._loaded) {
        cnt++;
        continue;
      }
      try {
        if ((pimg.width && pimg.width > 0) || (pimg.height && pimg.height > 0)) {
          pimg._loaded = true;
          cnt++;
        }
      } catch (e) { }
    }
    return cnt;
  }

  function startBgAnimation() {
    if (bgAnimInterval) return;
    bgFrameIndex = 0;
    try { background.url = bgUrls[0]; } catch (e) { }
    bgAnimInterval = jsmaf.setInterval(function () {
      bgFrameIndex = (bgFrameIndex + 1) % bgUrls.length;
      try {
        background.url = bgUrls[bgFrameIndex];
      } catch (e) { }
    }, bgFrameIntervalMs);
  }

  var bgPreloadStart = Date.now();
  var BG_MIN_LOADED_TO_START = 20;   // start when at least 20 frames loaded
  var BG_FALLBACK_MS = 3000;         // fallback start after 3s

  bgPreloadChecker = jsmaf.setInterval(function () {
    var loaded = countLoadedPreloads();
    var elapsed = Date.now() - bgPreloadStart;
    if (loaded >= BG_MIN_LOADED_TO_START || loaded === bgFramesTotal || elapsed >= BG_FALLBACK_MS) {
      try { startBgAnimation(); } catch (e) { }
      if (bgPreloadChecker) { jsmaf.clearInterval(bgPreloadChecker); bgPreloadChecker = null; }
    }
  }, 120);

  // ==================== LOGO (with fade-in and dynamic idle) ====================
  var logo = new Image({
    url: 'file:///../download0/img/logo.png',
    x: 1620,
    y: 0,
    width: 300,
    height: 169,
    alpha: 0.0
  });
  jsmaf.root.children.push(logo);

  // Title (config)
  if (useImageText) {
    var title = new Image({
      url: textImageBase + 'config.png',
      x: 860,
      y: 100,
      width: 200,
      height: 60,
      alpha: 0.0
    });
    jsmaf.root.children.push(title);
  } else {
    var _title = new jsmaf.Text();
    _title.text = lang.config;
    _title.x = 910;
    _title.y = 120;
    _title.style = 'title';
    _title.alpha = 0.0;
    jsmaf.root.children.push(_title);
  }

  // --- LEFT-SIDE root info (static, fixed on left) ---
  var rootInfo = new jsmaf.Text();
  rootInfo.text = 'Root: /';
  rootInfo.x = 24; // left margin
  rootInfo.y = 28;
  rootInfo.style = 'small';
  rootInfo.align = 'left';
  jsmaf.root.children.push(rootInfo);

  var scriptsInfo = new jsmaf.Text();
  scriptsInfo.text = 'Script paths: /download0/config_ui.js' + (typeof checkJailbroken === 'function' && checkJailbroken() ? '; /data/payloads; /mnt/usb0..7/payloads' : '');
  scriptsInfo.x = 24;
  scriptsInfo.y = 52;
  scriptsInfo.style = 'small';
  scriptsInfo.align = 'left';
  jsmaf.root.children.push(scriptsInfo);

  // Include the stats tracker
  include('stats-tracker.js');

  // Load and display stats
  stats.load();
  var statsData = stats.get();

  // Create text elements for each stat (these are static; fade them in with intro)
  var statsImgKeys = ['totalAttempts', 'successes', 'failures', 'successRate', 'failureRate'];
  var statsValues = [statsData.total, statsData.success, statsData.failures, statsData.successRate, statsData.failureRate];
  var statsLabels = [lang.totalAttempts, lang.successes, lang.failures, lang.successRate, lang.failureRate];

  for (var s = 0; s < statsImgKeys.length; s++) {
    var yPos = 120 + s * 25;
    if (useImageText) {
      var labelImg = new Image({
        url: textImageBase + statsImgKeys[s] + '.png',
        x: 20,
        y: yPos,
        width: 180,
        height: 25,
        alpha: 0.0
      });
      jsmaf.root.children.push(labelImg);
      var valueText = new jsmaf.Text();
      valueText.text = String(statsValues[s]);
      valueText.x = 210;
      valueText.y = yPos;
      valueText.style = 'white';
      valueText.alpha = 0.0;
      jsmaf.root.children.push(valueText);
    } else {
      var lineText = new jsmaf.Text();
      lineText.text = statsLabels[s] + statsValues[s];
      lineText.x = 20;
      lineText.y = yPos;
      lineText.style = 'white';
      lineText.alpha = 0.0;
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

  // Two-column layout: first three on left, last two on right, back button below right column
  var leftColumnX = 200;
  var rightColumnX = 1920 - 200 - 400; // 1320
  var startY = 300;
  var buttonSpacing = 120;
  var buttonWidth = 400;
  var buttonHeight = 80;

  // Full-screen black overlay for a 2s slow fade-out intro (buttons reveal after)
  var introOverlay = new Image({
    url: 'file:///assets/img/black.png',
    x: 0, y: 0, width: 1920, height: 1080,
    alpha: 1.0
  });
  jsmaf.root.children.push(introOverlay);

  // helper easing
  function easeInOut(t) { return (1 - Math.cos(t * Math.PI)) / 2; }
  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

  var ENTER_DUR = 2800;
  var OVERLAY_FADE = 2000;

  var offLeftX = -buttonWidth - 260;
  var offRightX = 1920 + 260;

  // Build buttons for the five config options
  for (var i = 0; i < configOptions.length; i++) {
    (function (i) {
      var configOption = configOptions[i];
      // Determine column and row
      var isLeft = (i < 3);
      var row = isLeft ? i : i - 3; // rows: 0,1,2 for left; 0,1 for right
      var btnX = isLeft ? leftColumnX : rightColumnX;
      var btnY = startY + row * buttonSpacing;

      // Entrance start position
      var startXpos = isLeft ? offLeftX : offRightX;
      var startYpos = btnY + ((i % 2 === 0) ? -80 : 80); // keep original parity variation

      var button = new Image({
        url: normalButtonImg,
        x: startXpos,
        y: startYpos,
        width: buttonWidth,
        height: buttonHeight,
        alpha: 0.0,
        scaleX: 1.0,
        scaleY: 1.0,
        rotation: 0
      });
      button._entering = true;
      button._enterDelay = i * 70;
      button._enterFromX = startXpos;
      button._enterFromY = startYpos;
      button._enterToX = btnX;
      button._enterToY = btnY;
      button._enterFromAlpha = 0.0;
      button._enterToAlpha = 1.0;
      button._enterDur = ENTER_DUR;
      buttons.push(button);
      jsmaf.root.children.push(button);

      // No ad marker for config buttons
      buttonMarkers.push(null);

      // button label/text (centered)
      var btnText;
      if (useImageText) {
        btnText = new Image({
          url: textImageBase + configOption.imgKey + '.png',
          x: startXpos + buttonWidth / 2,
          y: startYpos + buttonHeight / 2 - 6,
          width: 220,
          height: 48,
          alpha: 0.0
        });
      } else {
        btnText = new jsmaf.Text();
        btnText.text = configOption.label;
        btnText.align = 'center';
        btnText.x = startXpos + buttonWidth / 2;
        btnText.y = startYpos + buttonHeight / 2 - 8;
        btnText.style = 'white';
        btnText.alpha = 0.0;
      }
      buttonTexts.push(btnText);
      jsmaf.root.children.push(btnText);

      // value element
      var valueEl;
      if (configOption.type === 'toggle') {
        valueEl = new Image({
          url: currentConfig[configOption.key] ? 'file:///assets/img/check_small_on.png' : 'file:///assets/img/check_small_off.png',
          x: startXpos + buttonWidth - 60,
          y: startYpos + (buttonHeight / 2) - 20,
          width: 40,
          height: 40,
          alpha: 0.0
        });
      } else {
        if (useImageText) {
          valueEl = new Image({
            url: textImageBase + jbBehaviorImgKeys[currentConfig.jb_behavior] + '.png',
            x: startXpos + buttonWidth - 140,
            y: startYpos + 15,
            width: 150,
            height: 50,
            alpha: 0.0
          });
        } else {
          valueEl = new jsmaf.Text();
          valueEl.text = jbBehaviorLabels[currentConfig.jb_behavior] || jbBehaviorLabels[0];
          valueEl.align = 'right';
          valueEl.x = startXpos + buttonWidth - 20;
          valueEl.y = startYpos + (buttonHeight / 2) - 8;
          valueEl.style = 'white';
          valueEl.alpha = 0.0;
        }
      }
      valueTexts.push(valueEl);
      jsmaf.root.children.push(valueEl);

      // store final positions
      buttonOrigPos.push({ x: btnX, y: btnY });
      textCenterPos.push({ cx: btnX + buttonWidth / 2, cy: btnY + buttonHeight / 2 - 8 });
      valueOrigPos.push({
        x: btnX + (configOption.type === 'toggle' ? buttonWidth - 60 : buttonWidth - 20),
        y: btnY + (configOption.type === 'toggle' ? (buttonHeight / 2) - 20 : (buttonHeight / 2) - 8)
      });

      // per-button idle params
      idleParams.push({
        phase: Math.random() * Math.PI * 2,
        slowSpeed: 0.35 + Math.random() * 0.2,
        fastSpeed: 1.2 + Math.random() * 0.8,
        swayAmp: 3 + Math.random() * 3,
        bobAmp: 2 + Math.random() * 3,
        rotateAmp: 0.6 + Math.random() * 1.0
      });

      // entrance animation
      (function startEntrance(btn, txt, valueEl, marker, idx) {
        var delay = btn._enterDelay;
        var sTime = Date.now() + delay;
        var dur = btn._enterDur;
        var interval = jsmaf.setInterval(function () {
          var now = Date.now();
          if (now < sTime) return;
          var elapsed = now - sTime;
          var t = Math.min(elapsed / dur, 1);
          var eased = easeInOut(t);
          var posEased = easeOutQuad(eased);

          btn.x = btn._enterFromX + (btn._enterToX - btn._enterFromX) * posEased;
          btn.y = btn._enterFromY + (btn._enterToY - btn._enterFromY) * posEased;
          btn.alpha = btn._enterFromAlpha + (btn._enterToAlpha - btn._enterFromAlpha) * eased;

          var txtFromCx = btn._enterFromX + buttonWidth / 2;
          var txtFromCy = btn._enterFromY + buttonHeight / 2 - 8;
          var txtToCx = textCenterPos[idx].cx;
          var txtToCy = textCenterPos[idx].cy;
          var textEased = easeInOut(Math.min(1, (elapsed + dur * 0.06) / dur));
          if (typeof txt.x !== 'undefined') {
            txt.x = txtFromCx + (txtToCx - txtFromCx) * textEased;
            txt.y = txtFromCy + (txtToCy - txtFromCy) * textEased;
            txt.alpha = btn.alpha;
          }

          var valFromX = btn._enterFromX + (configOptions[idx].type === 'toggle' ? buttonWidth - 60 : buttonWidth - 20);
          var valFromY = btn._enterFromY + (configOptions[idx].type === 'toggle' ? (buttonHeight / 2) - 20 : (buttonHeight / 2) - 8);
          var valToX = valueOrigPos[idx].x;
          var valToY = valueOrigPos[idx].y;
          if (valueEl) {
            valueEl.x = valFromX + (valToX - valFromX) * textEased;
            valueEl.y = valFromY + (valToY - valFromY) * textEased;
            valueEl.alpha = btn.alpha;
          }

          if (t >= 1) {
            jsmaf.clearInterval(interval);
            btn._entering = false;
            btn.x = btn._enterToX;
            btn.y = btn._enterToY;
            btn.alpha = btn._enterToAlpha;
            txt.x = textCenterPos[idx].cx;
            txt.y = textCenterPos[idx].cy;
            txt.alpha = btn.alpha;
            if (valueEl) {
              valueEl.x = valueOrigPos[idx].x;
              valueEl.y = valueOrigPos[idx].y;
              valueEl.alpha = btn.alpha;
            }
          }
        }, 16);
      })(button, btnText, valueEl, null, i);
    })(i);
  }

  // --- BACK button: placed in right column, row 2 (same Y as third left button) ---
  var backIndex = 5; // overall index after the five config buttons
  var backRow = 2;
  var backX = rightColumnX;
  var backY = startY + backRow * buttonSpacing;

  (function () {
    var startXpos = offRightX;
    var startYpos = backY + 80; // i=5 is odd, so +80
    var backButton = new Image({
      url: normalButtonImg,
      x: startXpos,
      y: startYpos,
      width: buttonWidth,
      height: buttonHeight,
      alpha: 0.0,
      scaleX: 1.0,
      scaleY: 1.0
    });
    backButton._entering = true;
    backButton._enterDelay = 5 * 70; // i=5
    backButton._enterFromX = startXpos;
    backButton._enterFromY = startYpos;
    backButton._enterToX = backX;
    backButton._enterToY = backY;
    backButton._enterFromAlpha = 0.0;
    backButton._enterToAlpha = 1.0;
    backButton._enterDur = ENTER_DUR;
    backButton._pressInterval = null;
    buttons.push(backButton);
    jsmaf.root.children.push(backButton);

    var backMarker = new Image({
      url: 'file:///assets/img/ad_pod_marker.png',
      x: backX + buttonWidth - 50,
      y: backY + 35,
      width: 12,
      height: 12,
      alpha: 0.0,
      scaleX: 0.6,
      scaleY: 0.6,
      visible: false
    });
    backMarker._entering = true;
    backMarker._enterDelay = backButton._enterDelay + 60;
    backMarker._enterFromAlpha = 0.0;
    backMarker._enterToAlpha = 1.0;
    backMarker._enterFromScale = 0.6;
    backMarker._enterToScale = 1.0;
    buttonMarkers.push(backMarker);
    jsmaf.root.children.push(backMarker);

    var backText;
    if (useImageText) {
      backText = new Image({
        url: textImageBase + 'back.png',
        x: startXpos + buttonWidth / 2,
        y: startYpos + buttonHeight / 2 - 6,
        width: 220,
        height: 48,
        alpha: 0.0
      });
    } else {
      backText = new jsmaf.Text();
      backText.text = lang.back;
      backText.align = 'center';
      backText.x = startXpos + buttonWidth / 2;
      backText.y = startYpos + buttonHeight / 2 - 8;
      backText.style = 'white';
      backText.alpha = 0.0;
    }
    buttonTexts.push(backText);
    jsmaf.root.children.push(backText);

    valueTexts.push(null);
    valueOrigPos.push({ x: backX + 250, y: backY + 28 });

    buttonOrigPos.push({ x: backX, y: backY });
    textCenterPos.push({ cx: backX + buttonWidth / 2, cy: backY + buttonHeight / 2 - 8 });

    idleParams.push({
      phase: Math.random() * Math.PI * 2,
      slowSpeed: 0.35 + Math.random() * 0.2,
      fastSpeed: 1.2 + Math.random() * 0.8,
      swayAmp: 3 + Math.random() * 3,
      bobAmp: 2 + Math.random() * 3,
      rotateAmp: 0.6 + Math.random() * 1.0
    });

    // entrance animation for back button
    (function startEntrance(btn, txt, marker, idx) {
      var delay = btn._enterDelay;
      var sTime = Date.now() + delay;
      var dur = btn._enterDur;
      var interval = jsmaf.setInterval(function () {
        var now = Date.now();
        if (now < sTime) return;
        var elapsed = now - sTime;
        var t = Math.min(elapsed / dur, 1);
        var eased = easeInOut(t);
        var posEased = easeOutQuad(eased);

        btn.x = btn._enterFromX + (btn._enterToX - btn._enterFromX) * posEased;
        btn.y = btn._enterFromY + (btn._enterToY - btn._enterFromY) * posEased;
        btn.alpha = btn._enterFromAlpha + (btn._enterToAlpha - btn._enterFromAlpha) * eased;

        var txtFromCx = btn._enterFromX + buttonWidth / 2;
        var txtFromCy = btn._enterFromY + buttonHeight / 2 - 8;
        var txtToCx = textCenterPos[idx].cx;
        var txtToCy = textCenterPos[idx].cy;
        var textEased = easeInOut(Math.min(1, (elapsed + dur * 0.06) / dur));
        if (typeof txt.x !== 'undefined') {
          txt.x = txtFromCx + (txtToCx - txtFromCx) * textEased;
          txt.y = txtFromCy + (txtToCy - txtFromCy) * textEased;
          txt.alpha = btn.alpha;
        }

        marker.x = btn._enterToX + buttonWidth - 50;
        marker.y = btn._enterToY + 35;
        var mElapsed = Math.max(0, elapsed - marker._enterDelay + btn._enterDelay);
        var mT = Math.min(mElapsed / (dur * 0.5), 1);
        var mEased = easeOutQuad(mT);
        marker.alpha = marker._enterFromAlpha + (marker._enterToAlpha - marker._enterFromAlpha) * mEased;
        var mScale = marker._enterFromScale + (marker._enterToScale - marker._enterFromScale) * mEased;
        marker.scaleX = mScale;
        marker.scaleY = mScale;

        if (t >= 1) {
          jsmaf.clearInterval(interval);
          btn._entering = false;
          marker._entering = false;
          btn.x = btn._enterToX;
          btn.y = btn._enterToY;
          btn.alpha = btn._enterToAlpha;
          txt.x = textCenterPos[idx].cx;
          txt.y = textCenterPos[idx].cy;
          txt.alpha = btn.alpha;
          marker.x = btn._enterToX + buttonWidth - 50;
          marker.y = btn._enterToY + 35;
          marker.alpha = marker._enterToAlpha;
          marker.scaleX = marker._enterToScale;
          marker.scaleY = marker._enterToScale;
          marker.visible = false;
        }
      }, 16);
    })(backButton, backText, backMarker, 5);
  })();

  // Press animation (shared)
  function animatePress(btn, text, btnOrigX, btnOrigY, txtCenterX, txtCenterY, callback) {
    if (btn._pressInterval) jsmaf.clearInterval(btn._pressInterval);
    var timeline = [{ scale: 0.94, dur: 70 }, { scale: 1.08, dur: 110 }, { scale: 1.0, dur: 70 }];
    var idx = 0;
    var elapsed = 0;
    var step = 16;
    var startScale = btn.scaleX || 1.0;
    btn._pressInterval = jsmaf.setInterval(function () {
      elapsed += step;
      var phase = timeline[idx];
      var t = Math.min(elapsed / phase.dur, 1);
      var target = phase.scale;
      var scale = startScale + (target - startScale) * t;
      btn.scaleX = scale;
      btn.scaleY = scale;
      btn.x = btnOrigX - buttonWidth * (scale - 1) / 2;
      btn.y = btnOrigY - buttonHeight * (scale - 1) / 2;

      text.scaleX = scale;
      text.scaleY = scale;
      text.x = txtCenterX - buttonWidth * (scale - 1) / 2;
      text.y = txtCenterY - buttonHeight * (scale - 1) / 2;

      if (t >= 1) {
        idx++;
        if (idx >= timeline.length) {
          jsmaf.clearInterval(btn._pressInterval);
          btn._pressInterval = null;
          btn.scaleX = 1.0;
          btn.scaleY = 1.0;
          btn.x = btnOrigX;
          btn.y = btnOrigY;
          text.scaleX = 1.0;
          text.scaleY = 1.0;
          text.x = txtCenterX;
          text.y = txtCenterY;
          if (typeof callback === 'function') callback();
        } else {
          startScale = btn.scaleX;
          elapsed = 0;
        }
      }
    }, step);
  }

  // marker blink helper (fixed: immediate visible on focus, stop clears interval and hides)
  function startMarkerBlink(marker) {
    if (!marker) return;
    if (marker._blinkInterval) return;
    marker.visible = true;
    marker._blinkInterval = jsmaf.setInterval(function () {
      marker.visible = !marker.visible;
      if (marker.visible) {
        var start = Date.now();
        var pdur = 350;
        var baseScale = marker.scaleX || 1.0;
        var intv = jsmaf.setInterval(function () {
          var now = Date.now();
          var t = Math.min((now - start) / pdur, 1);
          var s = baseScale + (1.08 - baseScale) * Math.sin(t * Math.PI);
          marker.scaleX = s;
          marker.scaleY = s;
          if (t >= 1) jsmaf.clearInterval(intv);
        }, 16);
      }
    }, 700);
  }
  function stopMarkerBlink(marker) {
    if (!marker) return;
    if (marker._blinkInterval) {
      jsmaf.clearInterval(marker._blinkInterval);
      marker._blinkInterval = null;
    }
    marker.visible = false;
  }

  // flashing (API only; not bound to keys)
  var flashingMode = false;
  var flashingInterval = null;
  function startRandomFlashing() {
    if (flashingMode) return;
    flashingMode = true;
    flashingInterval = jsmaf.setInterval(function () {
      for (var m = 0; m < buttonMarkers.length; m++) {
        if (!buttonMarkers[m]) continue;
        var show = Math.random() > 0.5;
        buttonMarkers[m].visible = show;
        if (show) {
          buttonMarkers[m].scaleX = 1.0 + Math.random() * 0.18;
          buttonMarkers[m].scaleY = buttonMarkers[m].scaleX;
        } else {
          buttonMarkers[m].scaleX = 0.9;
          buttonMarkers[m].scaleY = 0.9;
        }
      }
    }, 120);
  }
  function stopRandomFlashing() {
    if (!flashingMode) return;
    flashingMode = false;
    if (flashingInterval) {
      jsmaf.clearInterval(flashingInterval);
      flashingInterval = null;
    }
    for (var mm = 0; mm < buttonMarkers.length; mm++) {
      if (!buttonMarkers[mm]) continue;
      stopMarkerBlink(buttonMarkers[mm]);
      buttonMarkers[mm].visible = false;
      buttonMarkers[mm].scaleX = 1.0;
      buttonMarkers[mm].scaleY = 1.0;
    }
    var focusedMarker = buttonMarkers[currentButton];
    if (focusedMarker) startMarkerBlink(focusedMarker);
  }

  // highlight update (ensures previous marker is stopped and hidden before starting current)
  var prevButton = -1;
  function updateHighlight() {
    if (prevButton >= 0 && prevButton !== currentButton) {
      var prevBtn = buttons[prevButton];
      var prevTxt = buttonTexts[prevButton];
      var prevVal = valueTexts[prevButton];
      var prevMark = buttonMarkers[prevButton];
      if (prevBtn) {
        prevBtn.url = normalButtonImg;
        // set to subdued alpha to match older script behavior
        prevBtn.alpha = 0.7;
        prevBtn.borderColor = 'transparent';
        prevBtn.borderWidth = 0;
        prevBtn.scaleX = 1.0;
        prevBtn.scaleY = 1.0;
        prevBtn.rotation = 0;
        prevBtn.x = buttonOrigPos[prevButton].x;
        prevBtn.y = buttonOrigPos[prevButton].y;
      }
      if (prevTxt) {
        prevTxt.scaleX = 1.0;
        prevTxt.scaleY = 1.0;
        prevTxt.x = textCenterPos[prevButton].cx;
        prevTxt.y = textCenterPos[prevButton].cy;
      }
      if (prevVal) {
        prevVal.x = valueOrigPos[prevButton].x;
        prevVal.y = valueOrigPos[prevButton].y;
        prevVal.scaleX = 1.0;
        prevVal.scaleY = 1.0;
      }
      if (prevMark) stopMarkerBlink(prevMark);
    }

    for (var ii = 0; ii < buttons.length; ii++) {
      var b = buttons[ii];
      var m = buttonMarkers[ii];
      var t = buttonTexts[ii];
      if (!b || t === undefined) continue;
      if (ii === currentButton) {
        b.url = selectedButtonImg;
        b.alpha = 1.0;
        b.borderColor = 'rgb(155,154,150)';
        b.borderWidth = 3;
        if (m) {
          stopMarkerBlink(m);
          m.visible = true;
          startMarkerBlink(m);
        }
      } else {
        b.url = normalButtonImg;
        b.alpha = 0.7;
        if (m && !flashingMode) {
          stopMarkerBlink(m);
          m.visible = false;
        }
      }
    }

    prevButton = currentButton;
  }

  // Idle loop: layered motion + squash on focus
  var idleStart = Date.now();
  var idleLoop = jsmaf.setInterval(function () {
    var t = (Date.now() - idleStart) / 1000;
    for (var j = 0; j < buttons.length; j++) {
      var btn = buttons[j];
      var txt = buttonTexts[j];
      var val = valueTexts[j];
      var mark = buttonMarkers[j];
      var base = buttonOrigPos[j];
      var txtBase = textCenterPos[j];
      var valBase = valueOrigPos[j];
      var params = idleParams[j];
      if (!btn || txtBase === undefined || !params) continue;
      if (btn._entering || (mark && mark._entering)) {
        if (mark) {
          mark.x = btn._enterToX + buttonWidth - 50;
          mark.y = btn._enterToY + 35;
        }
        continue;
      }

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
        btn.rotation = rotate * 0.35;
        btn.x = base.x + sway * 0.7 - buttonWidth * (finalScaleX - 1) / 2;
        btn.y = base.y + bob * 0.9 - buttonHeight * (finalScaleY - 1) / 2;

        txt.scaleX = finalScaleX;
        txt.scaleY = finalScaleY;
        txt.x = txtBase.cx + sway * 0.7 - buttonWidth * (finalScaleX - 1) / 2;
        txt.y = txtBase.cy + bob * 0.9 - buttonHeight * (finalScaleY - 1) / 2;

        if (val) {
          val.scaleX = finalScaleX;
          val.scaleY = finalScaleY;
          val.x = valBase.x + sway * 0.7 - buttonWidth * (finalScaleX - 1) / 2;
          val.y = valBase.y + bob * 0.9 - buttonHeight * (finalScaleY - 1) / 2;
        }

        if (mark) {
          mark.x = btn.x + buttonWidth - 50 + Math.sin(t * 1.9 + params.phase) * 1.6;
          mark.y = btn.y + 35 + Math.cos(t * 1.7 + params.phase) * 1.2;
          mark.scaleX = 1.0 + 0.04 * Math.sin(t * 2.4);
          mark.scaleY = mark.scaleX;
        }
      } else {
        var finalScale = 1.0 + 0.01 * Math.sin(t * params.fastSpeed + params.phase);
        btn.scaleX = finalScale;
        btn.scaleY = finalScale;
        btn.rotation = rotate * 0.25;
        btn.x = base.x + sway * 0.5 - buttonWidth * (finalScale - 1) / 2;
        btn.y = base.y + bob * 0.5 - buttonHeight * (finalScale - 1) / 2;

        txt.scaleX = finalScale;
        txt.scaleY = finalScale;
        txt.x = txtBase.cx + sway * 0.5 - buttonWidth * (finalScale - 1) / 2;
        txt.y = txtBase.cy + bob * 0.5 - buttonHeight * (finalScale - 1) / 2;

        if (val) {
          val.scaleX = finalScale;
          val.scaleY = finalScale;
          val.x = valBase.x + sway * 0.5 - buttonWidth * (finalScale - 1) / 2;
          val.y = valBase.y + bob * 0.5 - buttonHeight * (finalScale - 1) / 2;
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

  // --- LOGO fade-in + idle loop ---
  (function logoAndIntro() {
    // overlay fade
    var overlayStart = Date.now();
    var overlayInterval = jsmaf.setInterval(function () {
      var now = Date.now();
      var elapsed = now - overlayStart;
      var t = Math.min(elapsed / OVERLAY_FADE, 1);
      introOverlay.alpha = 1 - easeInOut(t);
      if (t >= 1) {
        jsmaf.clearInterval(overlayInterval);
        introOverlay.alpha = 0;
      }
    }, 16);

    // logo fade-in
    var logoFadeStart = Date.now() + 150;
    var logoFadeDur = 900;
    var logoFadeInterval = jsmaf.setInterval(function () {
      var now = Date.now();
      var elapsed = now - logoFadeStart;
      var t = Math.max(0, Math.min(elapsed / logoFadeDur, 1));
      logo.alpha = easeInOut(t);
      if (t >= 1) {
        jsmaf.clearInterval(logoFadeInterval);
      }
    }, 16);

    // Continuous idle movement for logo
    var logoBaseX = logo.x;
    var logoBaseY = logo.y;
    var logoAnimStart = Date.now();
    logoAnimInterval = jsmaf.setInterval(function () {
      var t = (Date.now() - logoAnimStart) / 1000;
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
  })();

  // perform action for option; exit/back handled here
  function performConfigAction(index) {
    if (index === buttons.length - 1) {
      // Clean up intervals before restart
      if (bgAnimInterval) { jsmaf.clearInterval(bgAnimInterval); bgAnimInterval = null; }
      if (bgPreloadChecker) { jsmaf.clearInterval(bgPreloadChecker); bgPreloadChecker = null; }
      if (logoAnimInterval) { jsmaf.clearInterval(logoAnimInterval); logoAnimInterval = null; }
      log('Restarting...');
      debugging.restart();
      return;
    }
    if (index < configOptions.length) {
      var option = configOptions[index];
      var key = option.key;
      if (option.type === 'cycle') {
        currentConfig.jb_behavior = (currentConfig.jb_behavior + 1) % jbBehaviorLabels.length;
        log(key + ' = ' + jbBehaviorLabels[currentConfig.jb_behavior]);
      } else {
        currentConfig[key] = !currentConfig[key];

        if (key === 'music') {
          // robust audio toggle: always stop then start if enabled to avoid duplicate audio objects
          try { stopBackgroundAudio(); } catch (e) {}
          if (currentConfig.music) {
            startBackgroundAudio();
          } else {
            // already stopped above
          }
        }

        if (key === 'autolapse' && currentConfig.autolapse === true) {
          currentConfig.autopoop = false;
          for (var z = 0; z < configOptions.length; z++) {
            if (configOptions[z].key === 'autopoop') { updateValueText(z); break; }
          }
          log('autopoop disabled (autolapse enabled)');
        } else if (key === 'autopoop' && currentConfig.autopoop === true) {
          currentConfig.autolapse = false;
          for (var zz = 0; zz < configOptions.length; zz++) {
            if (configOptions[zz].key === 'autolapse') { updateValueText(zz); break; }
          }
          log('autolapse disabled (autopoop enabled)');
        }
        log(key + ' = ' + currentConfig[key]);
      }
      updateValueText(index);
      saveConfig();
    }
  }

  function updateValueText(idx) {
    var opt = configOptions[idx];
    var valEl = valueTexts[idx];
    if (!opt || !valEl) return;
    if (opt.type === 'toggle') {
      try {
        valEl.url = currentConfig[opt.key] ? 'file:///assets/img/check_small_on.png' : 'file:///assets/img/check_small_off.png';
      } catch (e) {
        // if valEl is a Text element fallback
        try { valEl.text = currentConfig[opt.key] ? lang.on : lang.off; } catch (ee) {}
      }
    } else {
      if (useImageText) {
        valEl.url = textImageBase + jbBehaviorImgKeys[currentConfig.jb_behavior] + '.png';
      } else {
        valEl.text = jbBehaviorLabels[currentConfig.jb_behavior];
      }
    }
  }

  function handleConfirm() {
    var btn = buttons[currentButton];
    var txt = buttonTexts[currentButton];
    if (!btn || !txt) {
      performConfigAction(currentButton);
      return;
    }
    if (btn._entering) {
      btn._entering = false;
      btn.x = buttonOrigPos[currentButton].x;
      btn.y = buttonOrigPos[currentButton].y;
      txt.x = textCenterPos[currentButton].cx;
      txt.y = textCenterPos[currentButton].cy;
      var mk = buttonMarkers[currentButton];
      if (mk) { mk.x = btn.x + buttonWidth - 50; mk.y = btn.y + 35; mk.alpha = 1.0; mk.scaleX = 1.0; mk.scaleY = 1.0; mk.visible = true; }
    }
    var origBtnX = buttonOrigPos[currentButton].x;
    var origBtnY = buttonOrigPos[currentButton].y;
    var origTxtCX = textCenterPos[currentButton].cx;
    var origTxtCY = textCenterPos[currentButton].cy;
    animatePress(btn, txt, origBtnX, origBtnY, origTxtCX, origTxtCY, function () {
      performConfigAction(currentButton);
    });
  }

  function saveConfig() {
    if (!configLoaded) {
      log('Config not loaded yet, skipping save');
      return;
    }
    var configContent = 'const CONFIG = {\n';
    configContent += '    autolapse: ' + currentConfig.autolapse + ',\n';
    configContent += '    autopoop: ' + currentConfig.autopoop + ',\n';
    configContent += '    autoclose: ' + currentConfig.autoclose + ',\n';
    configContent += '    music: ' + currentConfig.music + ',\n';
    configContent += '    jb_behavior: ' + currentConfig.jb_behavior + '\n';
    configContent += '};\n\n';
    configContent += 'const payloads = [ //to be ran after jailbroken\n';
    for (var i = 0; i < userPayloads.length; i++) {
      configContent += '    "' + userPayloads[i] + '"';
      if (i < userPayloads.length - 1) configContent += ',';
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
        log('ERROR: Failed to read config: ' + (err && err.message ? err.message : err));
        configLoaded = true;
        if (currentConfig.music) startBackgroundAudio();
        return;
      }
      try {
        eval(data || '');
        if (typeof CONFIG !== 'undefined') {
          currentConfig.autolapse = CONFIG.autolapse || false;
          currentConfig.autopoop = CONFIG.autopoop || false;
          currentConfig.autoclose = CONFIG.autoclose || false;
          currentConfig.music = (typeof CONFIG.music === 'undefined') ? true : CONFIG.music;
          currentConfig.jb_behavior = CONFIG.jb_behavior || 0;

          if (typeof payloads !== 'undefined' && Array.isArray(payloads)) {
            userPayloads = payloads.slice();
          }
          for (var idx = 0; idx < configOptions.length; idx++) {
            updateValueText(idx);
          }
          configLoaded = true;
          log('Config loaded successfully');
          if (currentConfig.music) startBackgroundAudio();
        } else {
          configLoaded = true;
          if (currentConfig.music) startBackgroundAudio();
        }
      } catch (e) {
        log('ERROR: Failed to parse config: ' + e.message);
        configLoaded = true;
        if (currentConfig.music) startBackgroundAudio();
      }
    });
  }

  // key handling (linear navigation, but marker/update behavior now matches older script)
  jsmaf.onKeyDown = function (keyCode) {
    if (keyCode === 6 || keyCode === 5) {
      currentButton = (currentButton + 1) % buttons.length;
      updateHighlight();
    } else if (keyCode === 4 || keyCode === 7) {
      currentButton = (currentButton - 1 + buttons.length) % buttons.length;
      updateHighlight();
    } else if (keyCode === 14) {
      handleConfirm();
    } else if (keyCode === 13) {
      if (bgAnimInterval) { jsmaf.clearInterval(bgAnimInterval); bgAnimInterval = null; }
      if (bgPreloadChecker) { jsmaf.clearInterval(bgPreloadChecker); bgPreloadChecker = null; }
      if (logoAnimInterval) { jsmaf.clearInterval(logoAnimInterval); logoAnimInterval = null; }
      try { include('main-menu.js'); } catch (e) { log('ERROR loading main-menu.js: ' + e.message); }
    }
  };

  jsmaf.onKeyUp = function () {};

  // Expose flashing API (kept for parity)
  this.stopAdFlash = stopRandomFlashing;
  this.startAdFlash = startRandomFlashing;

  updateHighlight();
  loadConfig();

  log('Interactive Config UI loaded!');
  log('Total elements: ' + jsmaf.root.children.length);
})();
