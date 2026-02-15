(function () {
  include('languages.js');
  log(lang.loadingMainMenu);

  // Base relative path to the mod's root directory
  var baseRelative = '../download0/PxMod/Gold-Vue 1.2';
  var imgPath = 'file:///' + baseRelative + '/img/';
  var sfxPath = 'file:///' + baseRelative + '/sfx/';

  var currentButton = 0;
  var buttons = [];
  var buttonTexts = [];
  var buttonMarkers = [];
  var buttonOrigPos = [];
  var textCenterPos = []; // center coords for text
  var idleParams = []; // per-button idle parameters
  var normalButtonImg = imgPath + 'button_over_9.png';
  var selectedButtonImg = imgPath + 'button_over_9.png';
  jsmaf.root.children.length = 0;

  new Style({ name: 'white', color: 'white', size: 24 });
  new Style({ name: 'title', color: 'white', size: 32 });

  if (typeof CONFIG !== 'undefined' && CONFIG.music) {
    var audio = new jsmaf.AudioClip();
    audio.volume = 0.5;
    audio.open(sfxPath + 'bgm.wav');
  }

  var background = new Image({
    url: imgPath + 'multiview_bg_VAF.png',
    x: 0, y: 0, width: 1920, height: 1080
  });
  jsmaf.root.children.push(background);

  var centerX = 960;
  var logoWidth = 600;
  var logoHeight = 338;

  // --- LOGO: start centered (visible) for the intro ---
  var logoStartX = centerX - logoWidth / 2;
  var logoStartY = (1080 - logoHeight) / 2; // middle vertically
  var logoBaseX = centerX - logoWidth / 2;
  var logoBaseY = 50; // original place (where logo should land)
  var logo = new Image({
    url: imgPath + 'logo.png',
    x: logoStartX,
    y: logoStartY,
    width: logoWidth,
    height: logoHeight,
    alpha: 1.0,        // visible during overlay fade
    scaleX: 1.12,      // slightly bigger while centered
    scaleY: 1.12
  });
  jsmaf.root.children.push(logo);

  // Full-screen black overlay for the intro fade (background fade from black -> image)
  var introOverlay = new Image({
    url: imgPath + 'black.png',
    x: 0, y: 0, width: 1920, height: 1080,
    alpha: 1.0
  });
  jsmaf.root.children.push(introOverlay);

  // Menu options: File Explorer inserted before exit; Message Tester added before exit
  var menuOptions = [
    { label: lang.jailbreak, script: 'loader.js', imgKey: 'jailbreak' },
    { label: lang.payloadMenu, script: 'payload_host_gold.js', imgKey: 'payloadMenu' },
    { label: lang.config, script: 'config_ui_gold.js', imgKey: 'config' },
    { label: lang.fileExplorer || 'File Explorer', script: 'file-explorer_gold.js', imgKey: 'file_explorer' },
    { label: 'Message Tester', script: 'Message-test.js', imgKey: 'message_tester' },
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

  // entrance duration: long 3 seconds for buttons, overlay fade is 3 seconds now per request
  var ENTER_DUR = 3000;
  var OVERLAY_FADE = 3000; // changed to 3s (user asked for background fade for 3 seconds)

  // We'll hold entrance starters here and only run them after the intro completes
  var entranceStarters = [];

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

      // create button at start pos (off-screen) — start invisible/alpha 0
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
      button._enterDelay = i * 80; // stagger
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
      // Use the specific asset path for the marker as requested
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
        btnText.y = startYpos + buttonHeight / 2 - 8;
        btnText.style = 'white';
        btnText.alpha = 0.0;
      }
      buttonTexts.push(btnText);
      jsmaf.root.children.push(btnText);

      buttonOrigPos.push({ x: finalX, y: finalY });
      textCenterPos.push({ cx: finalX + buttonWidth / 2, cy: finalY + buttonHeight / 2 - 8 });

      idleParams.push({
        phase: Math.random() * Math.PI * 2,
        slowSpeed: 0.35 + Math.random() * 0.2,   // slow drift speed per button
        fastSpeed: 1.2 + Math.random() * 0.8,    // micro-breath speed
        swayAmp: 4 + Math.random() * 4,          // horizontal sway amplitude (px)
        bobAmp: 3 + Math.random() * 4,           // vertical bob amplitude (px)
        rotateAmp: 0.8 + Math.random() * 1.2     // subtle rotation amplitude (deg)
      });

      // Prepare the entrance starter for this button, but DO NOT start it yet.
      entranceStarters.push((function startEntranceFactory(btn, text, marker, idx) {
        return function () {
          var delay = btn._enterDelay;
          var sTime = Date.now() + delay;
          var dur = btn._enterDur;
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
        };
      })(button, btnText, marker, i));
    })(i);
  }

  // function to start all button entrances (called after intro)
  function startButtonsEntrance() {
    for (var s = 0; s < entranceStarters.length; s++) {
      try {
        entranceStarters[s]();
      } catch (e) {
        log('Entrance starter error: ' + e.message);
      }
    }
    // once entrance runs, allow highlight/update etc
    updateHighlight();
    log(lang.mainMenuLoaded);
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
        b.borderColor = 'rgb(122, 91, 6)';
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
        var baseBreath = 1.0 + 0.01 * Math.sin(t * params.fastSpeed + params.phase); // same magnitude as idle
        var squash = 1 + Math.sin(t * 2.6 + params.phase) * 0.04;
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

  // INPUT: block input until the intro sequence finishes
  var introPlaying = true;
  // temporary no-op while introPlaying
  jsmaf.onKeyDown = function () { /* ignored during intro */ };
  jsmaf.onKeyUp = function () { /* ignored during intro */ };


  function realOnKeyDown(keyCode) {
    if (keyCode === 6 || keyCode === 5) {
      // next
      currentButton = (currentButton + 1) % buttons.length;
      updateHighlight();
    } else if (keyCode === 4 || keyCode === 7) {

      currentButton = (currentButton - 1 + buttons.length) % buttons.length;
      updateHighlight();
    } else if (keyCode === 14) {
      // confirm
      handleButtonPress();
    }
  }
  // leave onKeyUp empty (as before)
  function realOnKeyUp(keyCode) {}

  // Also support external callers of "stop flashing" if needed:
  this.stopAdFlash = stopRandomFlashing;
  this.startAdFlash = startRandomFlashing;

  // --- Logo + overlay intro timeline ---
  (function logoAndIntro() {
    var overlayStart = Date.now();

    // 1) Start overlay fade (alpha 1 -> 0) over OVERLAY_FADE ms (3s)
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

    // 2) Logo stays centered & visible for 2s while overlay fades.
    // After 2000ms, start the 1s animation that moves the logo to base position and scales it to normal size.
    var logoMoveDelay = 2000; // ms to wait before moving logo (user asked for 2 sec in middle)
    var logoMoveDur = 1000; // 1 second to move + shrink
    var logoMoveStartTime = Date.now() + logoMoveDelay;
    var logoMoveInterval = jsmaf.setInterval(function () {
      var now = Date.now();
      var elapsed = now - logoMoveStartTime;
      if (elapsed < 0) return;
      var t = Math.min(elapsed / logoMoveDur, 1);
      var eased = easeInOut(t);
      // move linear/eased from center start -> base position
      logo.x = logoStartX + (logoBaseX - logoStartX) * eased;
      logo.y = logoStartY + (logoBaseY - logoStartY) * eased;
      // scale from initial bigger to 1.0
      var startScale = 1.12;
      var targetScale = 1.0;
      var curScale = startScale + (targetScale - startScale) * eased;
      logo.scaleX = curScale;
      logo.scaleY = curScale;

      // also gently adjust alpha to remain fully visible (keep at 1)
      logo.alpha = 1.0;

      if (t >= 1) {
        jsmaf.clearInterval(logoMoveInterval);
        // ensure exact final
        logo.x = logoBaseX;
        logo.y = logoBaseY;
        logo.scaleX = 1.0;
        logo.scaleY = 1.0;

        // Intro 
        // So now it's safe to start buttons and enable input.
        introPlaying = false;
        // Install the real key handlers now that intro is over
        jsmaf.onKeyDown = realOnKeyDown;
        jsmaf.onKeyUp = realOnKeyUp;

        // start the button entrances now
        startButtonsEntrance();
      }
    }, 16);
  })();

  // Note:  DO NOT call updateHighlight() earlier; it's called when start button entrances.

})();