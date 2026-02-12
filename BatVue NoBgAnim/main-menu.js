//
(function () {
  include('languages.js');
  log(lang.loadingMainMenu);

  var currentButton = 0;
  var buttons = [];
  var buttonTexts = [];
  var buttonMarkers = [];
  var buttonOrigPos = [];
  var textCenterPos = []; // center coords for text
  var idleParams = []; // per-button idle parameters
  var normalButtonImg = 'file:///../download0/img/button_over_9.png';
  var selectedButtonImg = 'file:///../download0/img/button_over_9.png';
  jsmaf.root.children.length = 0;

  new Style({ name: 'white', color: 'white', size: 24 });
  new Style({ name: 'title', color: 'white', size: 32 });

  if (typeof CONFIG !== 'undefined' && CONFIG.music) {
    var audio = new jsmaf.AudioClip();
    audio.volume = 0.5;
    audio.open('file://../download0/sfx/bgm.wav');
  }

  var background = new Image({
    url: 'file:///../download0/img/multiview_bg_VAF.png',
    x: 0, y: 0, width: 1920, height: 1080
  });
  jsmaf.root.children.push(background);

  var centerX = 960;
  // Logo made much smaller and positioned top-right
  var logoWidth = 240; // smaller width
  var logoHeight = 135; // smaller height (maintain aspect ratio)
  var logoMargin = 20; // margin from top-right

  // --- Logo (top-right) created before Batman image
  var logo = new Image({
    url: 'file:///../download0/img/logo.png',
    x: 1920 - logoMargin - logoWidth, // top-right X
    y: logoMargin,                     // top margin Y
    width: logoWidth,
    height: logoHeight,
    alpha: 0.0,
    scaleX: 1.0,
    scaleY: 1.0
  });
  jsmaf.root.children.push(logo);

  // --- Single central Batman image manager ---
  var _batmanUrl = 'file:///../download0/img/Batman.png';
  var _batman = null;
  var _batmanBaseX = centerX; // center X (logical center)
  var _batmanBaseY = 540; // center Y (logical center)
  var _batmanWidth = 800; // default large size
  var _batmanHeight = 800;
  var _batmanAlpha = 1.0;

  // idle params for batman animation
  var _batmanIdle = {
    phase: Math.random() * Math.PI * 2,
    slowSpeed: 0.25 + Math.random() * 0.25, // slow drift
    fastSpeed: 1.0 + Math.random() * 0.8,   // micro-breath
    swayAmp: 6 + Math.random() * 6,         // horizontal sway px
    bobAmp: 6 + Math.random() * 6,          // vertical bob px
    scaleAmp: 0.03 + Math.random() * 0.03   // scale pulse ±%
  };
  var _batmanIdleStart = Date.now();

  function _createCentralBatman() {
    _batman = new Image({
      url: _batmanUrl,
      x: _batmanBaseX - Math.round(_batmanWidth / 2),
      y: _batmanBaseY - Math.round(_batmanHeight / 2),
      width: _batmanWidth,
      height: _batmanHeight,
      alpha: _batmanAlpha,
      scaleX: 1.0,
      scaleY: 1.0
    });
    // Insert Batman after the logo so Batman renders on top of the logo
    jsmaf.root.children.splice(2, 0, _batman);
  }

  function _updateBatmanPosition() {
    if (!_batman) return;
    // Keep the image positioned by its center; scale is applied separately in idle loop
    _batman.x = _batmanBaseX - Math.round(_batman.width / 2);
    _batman.y = _batmanBaseY - Math.round(_batman.height / 2);
  }

  // Public API to set Batman center position (global)
  this.setBatmanPosition = function (centerXVal, centerYVal) {
    _batmanBaseX = centerXVal;
    _batmanBaseY = centerYVal;
    _updateBatmanPosition();
  };

  // Public API to set Batman X only
  this.setBatmanX = function (xVal) {
    _batmanBaseX = xVal;
    _updateBatmanPosition();
  };

  // Public API to set Batman size
  this.setBatmanSize = function (w, h) {
    if (!_batman) return;
    _batman.width = w;
    _batman.height = h;
    _updateBatmanPosition();
  };

  // Public API to set Batman alpha
  this.setBatmanAlpha = function (a) {
    if (!_batman) return;
    _batman.alpha = a;
  };

  // Create the central Batman now (keeps only one instance)
  _createCentralBatman();
  // Ensure initial position is correct
  _updateBatmanPosition();
  // End Batman manager
  // --------------------------------------------------------------------

  // Full-screen black overlay for the 2s slow fade-out intro
  var introOverlay = new Image({
    url: 'file:///assets/img/black.png',
    x: 0, y: 0, width: 1920, height: 1080,
    alpha: 1.0
  });
  jsmaf.root.children.push(introOverlay);

  // Menu options: File Explorer inserted before exit (so it sits with the rest)
  var menuOptions = [
    { label: lang.jailbreak, script: 'loader.js', imgKey: 'jailbreak' },
    { label: lang.payloadMenu, script: 'payload_host.js', imgKey: 'payloadMenu' },
    { label: lang.config, script: 'config_ui.js', imgKey: 'config' },
    { label: lang.fileExplorer || 'File Explorer', script: 'file-explorer.js', imgKey: 'file_explorer' },
    { label: lang.exit, script: 'exit', imgKey: 'exit' }
  ];

  // grid: 2 columns
  var cols = 2;
  var buttonSpacingX = 36;
  var buttonSpacingY = 22;
  var buttonWidth = 420;
  var buttonHeight = 84;
  var startY = 440; // moved up slightly to allow larger logo motion

  var gridWidth = cols * buttonWidth + (cols - 1) * buttonSpacingX;
  var startX = centerX - gridWidth / 2;

  // helper easing
  function easeInOut(t) { return (1 - Math.cos(t * Math.PI)) / 2; }
  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

  // entrance duration: long 3 seconds for buttons, overlay fade is 2 seconds
  var ENTER_DUR = 3000;
  var OVERLAY_FADE = 2000;

  for (var i = 0; i < menuOptions.length; i++) {
    (function (i) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      var finalX = startX + col * (buttonWidth + buttonSpacingX);
      var finalY = startY + row * (buttonHeight + buttonSpacingY);

      // Choose off-screen start X: left col from left off-screen; right col from right off-screen
      var offLeftX = -buttonWidth - 260;
      var offRightX = 1920 + 260;
      var startXpos = (col === 0) ? offLeftX : offRightX;
      // start slightly above/below for a subtle vertical meet feel:
      var startYpos = finalY + ((row % 2 === 0) ? -160 : 160);

      // create button at start pos (off-screen) — start with alpha 0 (fade in)
      var button = new Image({
        url: normalButtonImg,
        x: startXpos,
        y: startYpos,
        width: buttonWidth,
        height: buttonHeight,
        alpha: 0.0,
        rotation: 0,
        scaleX: 1.0,
        scaleY: 1.0
      });
      // mark it as entering so idle doesn't apply until finished
      button._entering = true;
      button._enterStart = Date.now();
      button._enterDelay = i * 80; // slightly larger stagger for nicer wave
      button._enterFromX = startXpos;
      button._enterFromY = startYpos;
      button._enterToX = finalX;
      button._enterToY = finalY;
      button._enterFromAlpha = 0.0;
      button._enterToAlpha = 0.96;
      button._enterDur = ENTER_DUR;
      button._pressInterval = null;
      buttons.push(button);
      jsmaf.root.children.push(button);

      // marker now participates in entrance + idle — start invisible/ tiny scale
      var marker = new Image({
        url: 'file:///assets/img/ad_pod_marker.png',
        x: finalX + buttonWidth - 50,
        y: finalY + 35,
        width: 12,
        height: 12,
        alpha: 0.0,
        scaleX: 0.6,
        scaleY: 0.6,
        visible: true
      });
      marker._blinkInterval = null;
      marker._entering = true;
      marker._enterDelay = button._enterDelay + 80; // slightly after button
      marker._enterFromAlpha = 0.0;
      marker._enterToAlpha = 1.0;
      marker._enterFromScale = 0.6;
      marker._enterToScale = 1.0;
      buttonMarkers.push(marker);
      jsmaf.root.children.push(marker);

      var btnText;
      if (typeof useImageText !== 'undefined' && useImageText) {
        btnText = new Image({
          url: (typeof textImageBase !== 'undefined' ? textImageBase : '') + menuOptions[i].imgKey + '.png',
          x: startXpos + buttonWidth / 2,
          y: startYpos + buttonHeight / 2,
          width: 300,
          height: 50,
          alpha: 0.0,
          visible: true
        });
      } else {
        btnText = new jsmaf.Text();
        btnText.text = menuOptions[i].label;
        // center the text inside the button.
        btnText.align = 'center';
        btnText.x = startXpos + buttonWidth / 2;
        btnText.y = startYpos + buttonHeight / 2 - 8; // slight vertical tweak for baseline
        btnText.style = 'white';
        btnText.alpha = 0.0;
      }
      buttonTexts.push(btnText);
      jsmaf.root.children.push(btnText);

      buttonOrigPos.push({ x: finalX, y: finalY });
      // store the center coordinates we want the text to sit at (keeps centering during scale)
      textCenterPos.push({ cx: finalX + buttonWidth / 2, cy: finalY + buttonHeight / 2 - 8 });

      // per-button idle params for richer motion
      idleParams.push({
        phase: Math.random() * Math.PI * 2,
        slowSpeed: 0.35 + Math.random() * 0.2,   // slow drift speed per button
        fastSpeed: 1.2 + Math.random() * 0.8,    // micro-breath speed
        swayAmp: 4 + Math.random() * 4,          // horizontal sway amplitude (px)
        bobAmp: 3 + Math.random() * 4,           // vertical bob amplitude (px)
        rotateAmp: 0.8 + Math.random() * 1.2     // subtle rotation amplitude (deg)
      });

      // start entrance animation for this button (3s)
      (function startEntrance(btn, text, marker, idx) {
        var delay = btn._enterDelay;
        var sTime = Date.now() + delay;
        var dur = btn._enterDur;
        // we will animate in small steps (16ms)
        var interval = jsmaf.setInterval(function () {
          var now = Date.now();
          if (now < sTime) return;
          var elapsed = now - sTime;
          var t = Math.min(elapsed / dur, 1);
          var eased = easeInOut(t);
          // lerp from fromX/fromY to toX/toY with an overshoot (slight easeOutQuad on position for solidity)
          var posEased = easeOutQuad(eased);
          btn.x = btn._enterFromX + (btn._enterToX - btn._enterFromX) * posEased;
          btn.y = btn._enterFromY + (btn._enterToY - btn._enterFromY) * posEased;
          // alpha fade-in
          btn.alpha = btn._enterFromAlpha + (btn._enterToAlpha - btn._enterFromAlpha) * eased;

          // text center moves similarly from the text's start center to final center
          var txtFromCx = btn._enterFromX + buttonWidth / 2;
          var txtFromCy = btn._enterFromY + buttonHeight / 2 - 8;
          var txtToCx = textCenterPos[idx].cx;
          var txtToCy = textCenterPos[idx].cy;
          // text uses slightly faster easing so it settles a touch earlier (feels snappy)
          var textEased = easeInOut(Math.min(1, (elapsed + dur * 0.08) / dur));
          text.x = txtFromCx + (txtToCx - txtFromCx) * textEased;
          text.y = txtFromCy + (txtToCy - txtFromCy) * textEased;
          text.alpha = btn.alpha;

          // marker enter: scale & alpha from small to normal and follow button tail
          marker.x = btn._enterToX + buttonWidth - 50;
          marker.y = btn._enterToY + 35;
          var mElapsed = Math.max(0, elapsed - marker._enterDelay + btn._enterDelay);
          var mT = Math.min(mElapsed / (dur * 0.5), 1); // quicker marker pop
          var mEased = easeOutQuad(mT);
          marker.alpha = marker._enterFromAlpha + (marker._enterToAlpha - marker._enterFromAlpha) * mEased;
          var mScale = marker._enterFromScale + (marker._enterToScale - marker._enterFromScale) * mEased;
          marker.scaleX = mScale;
          marker.scaleY = mScale;

          if (t >= 1) {
            jsmaf.clearInterval(interval);
            btn._entering = false;
            marker._entering = false;
            // ensure exact final
            btn.x = btn._enterToX;
            btn.y = btn._enterToY;
            btn.alpha = btn._enterToAlpha;
            text.x = textCenterPos[idx].cx;
            text.y = textCenterPos[idx].cy;
            text.alpha = btn.alpha;
            marker.x = btn._enterToX + buttonWidth - 50;
            marker.y = btn._enterToY + 35;
            marker.alpha = marker._enterToAlpha;
            marker.scaleX = marker._enterToScale;
            marker.scaleY = marker._enterToScale;
          }
        }, 16);
      })(button, btnText, marker, i);
    })(i);
  }

  // small press animation (snappy but light) — uses center coords so text stays centered visually
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
      // keep button center consistent while scaling:
      btn.x = btnOrigX - buttonWidth * (scale - 1) / 2;
      btn.y = btnOrigY - buttonHeight * (scale - 1) / 2;

      // text scale and centered position:
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

  var prevButton = -1;

  // helper to start slow blink for a marker (when focused), stores interval on the marker
  function startMarkerBlink(marker) {
    if (!marker) return;
    if (marker._blinkInterval) return; // already blinking
    // also add subtle scale pulse when blinking
    marker._blinkInterval = jsmaf.setInterval(function () {
      marker.visible = !marker.visible;
      // subtle pulse when visible
      if (marker.visible) {
        // quick scale pop
        var start = Date.now();
        var pdur = 350;
        var baseScale = marker.scaleX || 1.0;
        var intv = jsmaf.setInterval(function () {
          var now = Date.now();
          var t = Math.min((now - start) / pdur, 1);
          // ease out
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
    // keep marker visible state consistent
    marker.visible = false;
  }

  // flashing mode (random markers) state — still supported via API calls but NOT bound to key 7 any more
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
        // quick random scale pop for visible ones
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
      var mark = buttonMarkers[mm];
      if (!mark) continue;
      stopMarkerBlink(mark);
      mark.visible = false;
      mark.scaleX = 1.0;
      mark.scaleY = 1.0;
    }
    var focusedMarker = buttonMarkers[currentButton];
    if (focusedMarker) startMarkerBlink(focusedMarker);
  }

  function updateHighlight() {
    // reset previous if changed
    if (prevButton >= 0 && prevButton !== currentButton) {
      var prevBtn = buttons[prevButton];
      var prevTxt = buttonTexts[prevButton];
      var prevMark = buttonMarkers[prevButton];
      if (prevBtn && prevTxt && prevMark) {
        prevBtn.url = normalButtonImg;
        prevBtn.alpha = 0.96;
        prevBtn.borderColor = 'transparent';
        prevBtn.borderWidth = 0;
        stopMarkerBlink(prevMark);
        prevBtn.scaleX = 1.0;
        prevBtn.scaleY = 1.0;
        prevBtn.rotation = 0;
        prevBtn.x = buttonOrigPos[prevButton].x;
        prevBtn.y = buttonOrigPos[prevButton].y;
        prevTxt.scaleX = 1.0;
        prevTxt.scaleY = 1.0;
        prevTxt.x = textCenterPos[prevButton].cx;
        prevTxt.y = textCenterPos[prevButton].cy;
      }
    }

    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var m = buttonMarkers[i];
      var t = buttonTexts[i];
      if (!b || t === undefined) continue;
      if (i === currentButton) {
        b.url = selectedButtonImg;
        b.alpha = 1.0;
        b.borderColor = 'rgb(102, 102, 102)';
        b.borderWidth = 3;
        if (m) {
          if (!flashingMode) {
            m.visible = true;
            startMarkerBlink(m);
          }
        }
      } else {
        b.url = normalButtonImg;
        b.alpha = 0.96;
        if (m && !flashingMode) {
          stopMarkerBlink(m);
          m.visible = false;
        }
      }
    }

    prevButton = currentButton;
  }

  // Idle loop: layered motion (slow sway + micro-breath + bob + tiny rotation)
  // Focused button now uses a squashy loop but overall stays the same size as idle
  var idleStart = Date.now();
  var idleLoop = jsmaf.setInterval(function () {
    var t = (Date.now() - idleStart) / 1000; // seconds
    for (var j = 0; j < buttons.length; j++) {
      var btn = buttons[j];
      var txt = buttonTexts[j];
      var mark = buttonMarkers[j];
      var base = buttonOrigPos[j];
      var txtBase = textCenterPos[j];
      var params = idleParams[j];
      if (!btn || txtBase === undefined || !params) continue;
      // skip idle while entering animation is active for that button
      if (btn._entering || (mark && mark._entering)) {
        if (mark) {
          mark.x = btn._enterToX + buttonWidth - 50;
          mark.y = btn._enterToY + 35;
        }
        continue;
      }

      // slow drift (long period) + faster micro-breath
      var slow = Math.sin(t * params.slowSpeed + params.phase);
      var fast = Math.sin(t * params.fastSpeed + params.phase * 1.3);
      var sway = slow * params.swayAmp; // horizontal
      var bob = fast * params.bobAmp;   // vertical micro bob
      var rotate = slow * params.rotateAmp; // degrees

      if (j === currentButton) {
        // FOCUSED: keep same size envelope as idle + add a gentle "squash" loop
        var baseBreath = 1.0 + 0.01 * Math.sin(t * params.fastSpeed + params.phase); // same magnitude as idle
        // squash loop: small horizontal squeeze/expand (±4%)
        var squash = 1 + Math.sin(t * 2.6 + params.phase) * 0.04;
        // compensate vertical so area feels consistent (reduce/increase slightly)
        var finalScaleX = baseBreath * squash;
        var finalScaleY = baseBreath * (1 - (squash - 1) * 0.45);

        btn.scaleX = finalScaleX;
        btn.scaleY = finalScaleY;
        btn.rotation = rotate * 0.4; // very subtle rotation
        btn.x = base.x + sway * 0.75 - buttonWidth * (finalScaleX - 1) / 2;
        btn.y = base.y + bob * 0.9 - buttonHeight * (finalScaleY - 1) / 2;

        txt.scaleX = finalScaleX;
        txt.scaleY = finalScaleY;
        txt.x = txtBase.cx + sway * 0.75 - buttonWidth * (finalScaleX - 1) / 2;
        txt.y = txtBase.cy + bob * 0.9 - buttonHeight * (finalScaleY - 1) / 2;

        // marker follows and gives a tiny oscillating offset so it feels attached
        if (mark) {
          mark.x = btn.x + buttonWidth - 50 + Math.sin(t * 1.9 + params.phase) * 1.8;
          mark.y = btn.y + 35 + Math.cos(t * 1.7 + params.phase) * 1.2;
          // focused marker subtle pulse (scale)
          mark.scaleX = 1.0 + 0.04 * Math.sin(t * 2.4);
          mark.scaleY = mark.scaleX;
        }
      } else {
        // not selected: breathing only (same as before; small amplitude)
        var finalScale = 1.0 + 0.01 * Math.sin(t * params.fastSpeed + params.phase);
        btn.scaleX = finalScale;
        btn.scaleY = finalScale;
        btn.rotation = rotate * 0.35;
        btn.x = base.x + sway * 0.6 - buttonWidth * (finalScale - 1) / 2;
        btn.y = base.y + bob * 0.6 - buttonHeight * (finalScale - 1) / 2;

        txt.scaleX = finalScale;
        txt.scaleY = finalScale;
        txt.x = txtBase.cx + sway * 0.6 - buttonWidth * (finalScale - 1) / 2;
        txt.y = txtBase.cy + bob * 0.6 - buttonHeight * (finalScale - 1) / 2;

        if (mark) {
          mark.x = btn.x + buttonWidth - 50 + Math.sin(t * 1.2 + params.phase) * 1.2;
          mark.y = btn.y + 35 + Math.cos(t * 1.1 + params.phase) * 1.0;
          mark.scaleX = 0.98 + 0.02 * Math.sin(t * 1.6 + params.phase);
          mark.scaleY = mark.scaleX;
        }
      }
    }

    // --- Batman idle animation update (keeps single Batman gently moving/pulsing) ---
    if (_batman) {
      var bt = (Date.now() - _batmanIdleStart) / 1000;
      var slow = Math.sin(bt * _batmanIdle.slowSpeed + _batmanIdle.phase);
      var fast = Math.sin(bt * _batmanIdle.fastSpeed + _batmanIdle.phase * 1.2);
      var sway = slow * _batmanIdle.swayAmp;
      var bob = fast * _batmanIdle.bobAmp;
      var scalePulse = 1 + Math.sin(bt * 0.9 + _batmanIdle.phase) * _batmanIdle.scaleAmp;

      // apply uniform scale (keeps aspect ratio)
      _batman.scaleX = scalePulse;
      _batman.scaleY = scalePulse;

      // compute position so the visual center remains at _batmanBaseX/_batmanBaseY
      var scaledW = _batman.width * scalePulse;
      var scaledH = _batman.height * scalePulse;
      _batman.x = Math.round(_batmanBaseX + sway - scaledW / 2);
      _batman.y = Math.round(_batmanBaseY + bob - scaledH / 2);
    }
    // --- end Batman idle update ---

  }, 50); // smooth and responsive

  // perform action for option; exit handled when script === 'exit'
  function performButtonAction(index) {
    var opt = menuOptions[index];
    if (!opt) return;
    if (opt.script === 'exit') {
      log('Exiting application...');
      try {
        if (typeof libc_addr === 'undefined') {
          log('Loading userland.js...');
          include('userland.js');
        }
        fn.register(0x14, 'getpid', [], 'bigint');
        fn.register(0x25, 'kill', ['bigint', 'bigint'], 'bigint');
        var pid = fn.getpid();
        var pid_num = pid instanceof BigInt ? pid.lo : pid;
        log('Current PID: ' + pid_num);
        log('Sending SIGKILL to PID ' + pid_num);
        fn.kill(pid, new BigInt(0, 9));
      } catch (e) {
        log('ERROR during exit: ' + e.message);
        if (e.stack) log(e.stack);
      }
      jsmaf.exit();
    } else {
      if (opt.script === 'loader.js') {
        jsmaf.onKeyDown = function () {};
      }
      log('Loading ' + opt.script + '...');
      try {
        include(opt.script);
      } catch (e) {
        log('ERROR loading ' + opt.script + ': ' + e.message);
        if (e.stack) log(e.stack);
      }
    }
  }

  // handle confirm: subtle press animation then action
  function handleButtonPress() {
    var btn = buttons[currentButton];
    var txt = buttonTexts[currentButton];
    if (!btn || !txt) {
      performButtonAction(currentButton);
      return;
    }
    // ensure not interrupting entrance animation
    if (btn._entering) {
      // if entering, force finalize instantly before action (so the press behaves predictably)
      btn._entering = false;
      btn.x = buttonOrigPos[currentButton].x;
      btn.y = buttonOrigPos[currentButton].y;
      txt.x = textCenterPos[currentButton].cx;
      txt.y = textCenterPos[currentButton].cy;
      var mk = buttonMarkers[currentButton];
      if (mk) { mk.x = btn.x + buttonWidth - 50; mk.y = btn.y + 35; mk.alpha = 1.0; mk.scaleX = 1.0; mk.scaleY = 1.0; }
    }
    var origBtnX = buttonOrigPos[currentButton].x;
    var origBtnY = buttonOrigPos[currentButton].y;
    var origTxtCX = textCenterPos[currentButton].cx;
    var origTxtCY = textCenterPos[currentButton].cy;

    animatePress(btn, txt, origBtnX, origBtnY, origTxtCX, origTxtCY, function () {
      performButtonAction(currentButton);
    });
  }

  // key handling: onKeyDown and onKeyUp (key 7 now only moves left; it NO LONGER starts flashing)
  jsmaf.onKeyDown = function (keyCode) {
    if (keyCode === 6 || keyCode === 5) {
      // next
      currentButton = (currentButton + 1) % buttons.length;
      updateHighlight();
    } else if (keyCode === 4 || keyCode === 7) {
      // prev (key 7 now only moves left, no flashing activation)
      currentButton = (currentButton - 1 + buttons.length) % buttons.length;
      updateHighlight();
    } else if (keyCode === 14) {
      // confirm
      handleButtonPress();
    }
  };

  // key up handler — removed key-7 stop trigger so holding 7 does not cause flashing behavior
  jsmaf.onKeyUp = function (keyCode) {
    // intentionally empty for key-based flashing removal
  };

  // Also support external callers of "stop flashing" if needed:
  this.stopAdFlash = stopRandomFlashing;
  this.startAdFlash = startRandomFlashing;

  updateHighlight();
  log(lang.mainMenuLoaded);

  // --- Logo continuous, more dynamic idle animation + intro fade overlay handling ---
  (function logoAndIntro() {
    var baseX = logo.x;
    var baseY = logo.y;
    var start = Date.now();

    // Start overlay fade-first: 2 seconds slow fade out (alpha 1 -> 0)
    var overlayStart = Date.now();
    var overlayInterval = jsmaf.setInterval(function () {
      var now = Date.now();
      var elapsed = now - overlayStart;
      var t = Math.min(elapsed / OVERLAY_FADE, 1);
      // ease out for natural reveal
      introOverlay.alpha = 1 - easeInOut(t);
      if (t >= 1) {
        jsmaf.clearInterval(overlayInterval);
        // remove overlay from display after faded out to avoid blocking interactions
        introOverlay.alpha = 0;
      }
    }, 16);

    // Make sure logo fades in gracefully synchronized with overlay fade (slightly after overlay starts)
    var logoFadeStart = Date.now() + 150; // slight offset
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

    // Logo continuous idle movement (small drift while staying near top-right)
    jsmaf.setInterval(function () {
      var tt = (Date.now() - start) / 1000;
      var yOffset = Math.sin(tt * 0.6) * 4;      // small vertical drift ±4 px
      var xOffset = Math.sin(tt * 0.28 + 0.7) * 3; // small horizontal drift ±3 px
      var scale = 1 + Math.sin(tt * 0.9 + 0.3) * 0.02; // subtle scale pulse ±2%
      logo.y = baseY + yOffset;
      logo.x = baseX + xOffset;
      logo.scaleX = scale;
      logo.scaleY = scale;
    }, 60);
  })();

})();
