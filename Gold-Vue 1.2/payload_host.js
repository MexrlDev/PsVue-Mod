// payload-menu-animated-final-leftroot-exit-fixed.js
(function () {
  // --- bootstrap and existing initialization ---
  if (typeof libc_addr === 'undefined') {
    log('Loading userland.js...');
    include('userland.js');
    log('userland.js loaded');
  } else {
    log('userland.js already loaded (libc_addr defined)');
  }
  log('Loading check-jailbroken.js...');
  include('check-jailbroken.js');
  if (typeof CONFIG !== 'undefined' && CONFIG.music) {
    var audio = new jsmaf.AudioClip();
    audio.volume = 0.5;
    audio.open('file://../download0/sfx/bgm.wav');
  }
  is_jailbroken = checkJailbroken();
  jsmaf.root.children.length = 0;

  new Style({ name: 'white', color: 'white', size: 24 });
  new Style({ name: 'title', color: 'white', size: 32 });
  new Style({ name: 'small', color: 'white', size: 18 });

  // --- UI state arrays (extended for animations) ---
  var currentButton = 0;
  var buttons = [];
  var buttonTexts = [];
  var buttonMarkers = [];
  var buttonOrigPos = [];
  var textCenterPos = []; // center coords for text (so text is part of button)
  var idleParams = []; // per-button idle parameters
  var fileList = [];

  var normalButtonImg = 'file://../download0/img/button_over_9.png';
  var selectedButtonImg = 'file://../download0/img/button_over_9.png';

  // --- background and logo ---
  var background = new Image({
    url: 'file:///../download0/img/multiview_bg_VAF.png',
    x: 0, y: 0, width: 1920, height: 1080
  });
  jsmaf.root.children.push(background);

  var logo = new Image({
    url: 'file:///../download0/img/logo.png',
    x: 1620, y: 0, width: 300, height: 169,
    alpha: 1.0, scaleX: 1.0, scaleY: 1.0
  });
  jsmaf.root.children.push(logo);

  // --- title ---
  var titleX = 830;
  var titleY = 100;
  if (useImageText) {
    var title = new Image({
      url: textImageBase + 'payloadMenu.png',
      x: titleX, y: titleY, width: 250, height: 60
    });
    jsmaf.root.children.push(title);
  } else {
    var _title = new jsmaf.Text();
    _title.text = lang.payloadMenu;
    _title.x = titleX + 50;
    _title.y = titleY + 20;
    _title.style = 'title';
    jsmaf.root.children.push(_title);
  }

  // --- left-side root info (static) ---
  var rootInfo = new jsmaf.Text();
  rootInfo.text = 'Root: /';
  rootInfo.x = 24;
  rootInfo.y = 28;
  rootInfo.style = 'small';
  rootInfo.align = 'left';
  jsmaf.root.children.push(rootInfo);

  var scriptsInfo = new jsmaf.Text();
  scriptsInfo.text = 'Script paths: /download0/payloads' + (is_jailbroken ? '; /data/payloads; /mnt/usb0..7/payloads' : '');
  scriptsInfo.x = 24;
  scriptsInfo.y = 52;
  scriptsInfo.style = 'small';
  scriptsInfo.align = 'left';
  jsmaf.root.children.push(scriptsInfo);

  // --- low-level syscalls registration (unchanged) ---
  fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(0x06, 'close_sys', ['bigint'], 'bigint');
  fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(0x03, 'read_sys', ['bigint', 'bigint', 'bigint'], 'bigint');

  // --- scan for payload files (unchanged) ---
  var scanPaths = ['/download0/payloads'];
  if (is_jailbroken) {
    scanPaths.push('/data/payloads');
    for (var i = 0; i <= 7; i++) {
      scanPaths.push('/mnt/usb' + i + '/payloads');
    }
  }
  log('Scanning paths: ' + scanPaths.join(', '));
  var path_addr = mem.malloc(256);
  var buf = mem.malloc(4096);
  for (var currentPath of scanPaths) {
    log('Scanning ' + currentPath + ' for files...');
    for (var _i = 0; _i < currentPath.length; _i++) {
      mem.view(path_addr).setUint8(_i, currentPath.charCodeAt(_i));
    }
    mem.view(path_addr).setUint8(currentPath.length, 0);
    var fd = fn.open_sys(path_addr, new BigInt(0, 0), new BigInt(0, 0));
    if (!fd.eq(new BigInt(0xffffffff, 0xffffffff))) {
      var count = fn.getdents(fd, buf, new BigInt(0, 4096));
      if (!count.eq(new BigInt(0xffffffff, 0xffffffff)) && count.lo > 0) {
        var offset = 0;
        while (offset < count.lo) {
          var d_reclen = mem.view(buf.add(new BigInt(0, offset + 4))).getUint16(0, true);
          var d_type = mem.view(buf.add(new BigInt(0, offset + 6))).getUint8(0);
          var d_namlen = mem.view(buf.add(new BigInt(0, offset + 7))).getUint8(0);
          var name = '';
          for (var _i2 = 0; _i2 < d_namlen; _i2++) {
            name += String.fromCharCode(mem.view(buf.add(new BigInt(0, offset + 8 + _i2))).getUint8(0));
          }
          if (d_type === 8 && name !== '.' && name !== '..') {
            var lowerName = name.toLowerCase();
            if (lowerName.endsWith('.elf') || lowerName.endsWith('.bin') || lowerName.endsWith('.js')) {
              fileList.push({ name, path: currentPath + '/' + name });
              log('Added file: ' + name + ' from ' + currentPath);
            }
          }
          offset += d_reclen;
        }
      }
      fn.close_sys(fd);
    } else {
      log('Failed to open ' + currentPath);
    }
  }
  log('Total files found: ' + fileList.length);

  // --- layout parameters ---
  var startY = 200;
  var buttonSpacing = 90;
  var buttonsPerRow = 5;
  var buttonWidth = 300;
  var buttonHeight = 80;
  var startX = 130;
  var xSpacing = 340;

  // --- animation helpers ---
  function easeInOut(t) { return (1 - Math.cos(t * Math.PI)) / 2; }
  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

  var ENTER_DUR = 3000;

  // --- create buttons with entrance params, markers, text, and idle params ---
  for (var idx = 0; idx < fileList.length; idx++) {
    (function (i) {
      var row = Math.floor(i / buttonsPerRow);
      var col = i % buttonsPerRow;
      var displayName = fileList[i].name;
      var finalX = startX + col * xSpacing;
      var finalY = startY + row * buttonSpacing;

      // off-screen starts for entrance
      var offLeftX = -buttonWidth - 260;
      var offRightX = 1920 + 260;
      var startXpos = (col === 0) ? offLeftX : offRightX;
      var startYpos = finalY + ((row % 2 === 0) ? -160 : 160);

      var button = new Image({
        url: normalButtonImg,
        x: startXpos, y: startYpos, width: buttonWidth, height: buttonHeight,
        alpha: 0.0, rotation: 0, scaleX: 1.0, scaleY: 1.0
      });
      // entrance metadata
      button._entering = true;
      button._enterStart = Date.now();
      button._enterDelay = i * 80;
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

      // marker
      var marker = new Image({
        url: 'file:///assets/img/ad_pod_marker.png',
        x: finalX + buttonWidth - 50, y: finalY + 35, width: 12, height: 12,
        alpha: 0.0, scaleX: 0.6, scaleY: 0.6, visible: false
      });
      marker._blinkInterval = null;
      marker._entering = true;
      marker._enterDelay = button._enterDelay + 80;
      marker._enterFromAlpha = 0.0;
      marker._enterToAlpha = 1.0;
      marker._enterFromScale = 0.6;
      marker._enterToScale = 1.0;
      buttonMarkers.push(marker);
      jsmaf.root.children.push(marker);

      // text as part of button: use center coords so it stays visually attached
      if (displayName.length > 30) displayName = displayName.substring(0, 27) + '...';
      var text = new jsmaf.Text();
      text.text = displayName;
      text.align = 'center';
      // start text centered relative to start pos
      text.x = startXpos + buttonWidth / 2;
      text.y = startYpos + buttonHeight / 2 - 8;
      text.style = 'white';
      text.alpha = 0.0;
      buttonTexts.push(text);
      jsmaf.root.children.push(text);

      // store final centers for text so it remains centered during scale/transform
      buttonOrigPos.push({ x: finalX, y: finalY });
      textCenterPos.push({ cx: finalX + buttonWidth / 2, cy: finalY + buttonHeight / 2 - 8 });

      // per-button idle params
      idleParams.push({
        phase: Math.random() * Math.PI * 2,
        slowSpeed: 0.35 + Math.random() * 0.2,
        fastSpeed: 1.2 + Math.random() * 0.8,
        swayAmp: 4 + Math.random() * 4,
        bobAmp: 3 + Math.random() * 4,
        rotateAmp: 0.8 + Math.random() * 1.2
      });

      // entrance animation loop for this button
      (function startEntrance(btn, txt, mark, idxLocal) {
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

          // text moves from start center to final center and fades with button
          var txtFromCx = btn._enterFromX + buttonWidth / 2;
          var txtFromCy = btn._enterFromY + buttonHeight / 2 - 8;
          var txtToCx = textCenterPos[idxLocal].cx;
          var txtToCy = textCenterPos[idxLocal].cy;
          var textEased = easeInOut(Math.min(1, (elapsed + dur * 0.08) / dur));
          txt.x = txtFromCx + (txtToCx - txtFromCx) * textEased;
          txt.y = txtFromCy + (txtToCy - txtFromCy) * textEased;
          txt.alpha = btn.alpha;

          // marker enter
          mark.x = btn._enterToX + buttonWidth - 50;
          mark.y = btn._enterToY + 35;
          var mElapsed = Math.max(0, elapsed - mark._enterDelay + btn._enterDelay);
          var mT = Math.min(mElapsed / (dur * 0.5), 1);
          var mEased = easeOutQuad(mT);
          mark.alpha = mark._enterFromAlpha + (mark._enterToAlpha - mark._enterFromAlpha) * mEased;
          var mScale = mark._enterFromScale + (mark._enterToScale - mark._enterFromScale) * mEased;
          mark.scaleX = mScale;
          mark.scaleY = mScale;

          if (t >= 1) {
            jsmaf.clearInterval(interval);
            btn._entering = false;
            mark._entering = false;
            btn.x = btn._enterToX;
            btn.y = btn._enterToY;
            btn.alpha = btn._enterToAlpha;
            txt.x = textCenterPos[idxLocal].cx;
            txt.y = textCenterPos[idxLocal].cy;
            txt.alpha = btn.alpha;
            mark.x = btn._enterToX + buttonWidth - 50;
            mark.y = btn._enterToY + 35;
            mark.alpha = mark._enterToAlpha;
            mark.scaleX = mark._enterToScale;
            mark.scaleY = mark._enterToScale;
            // keep marker hidden until focus to avoid duplicate visible markers
            mark.visible = false;
          }
        }, 16);
      })(button, text, marker, i);
    })(idx);
  }

  // --- add Exit button (Back) with same entrance/idle metadata and marker/text integrated ---
  var exitX = 810;
  var exitY = 980;
  var exitButton = new Image({
    url: normalButtonImg,
    x: exitX, y: exitY, width: buttonWidth, height: buttonHeight,
    alpha: 0.0, scaleX: 1.0, scaleY: 1.0
  });
  exitButton._entering = true;
  exitButton._enterDelay = fileList.length * 80;
  exitButton._enterFromX = 1920 + 260;
  exitButton._enterFromY = exitY + 160;
  exitButton._enterToX = exitX;
  exitButton._enterToY = exitY;
  exitButton._enterFromAlpha = 0.0;
  exitButton._enterToAlpha = 0.96;
  exitButton._enterDur = ENTER_DUR;
  exitButton._pressInterval = null;
  buttons.push(exitButton);
  jsmaf.root.children.push(exitButton);

  var exitMarker = new Image({
    url: 'file:///assets/img/ad_pod_marker.png',
    x: exitX + buttonWidth - 50, y: exitY + 35, width: 12, height: 12, visible: false, alpha: 0.0, scaleX: 0.6, scaleY: 0.6
  });
  exitMarker._entering = true;
  exitMarker._enterDelay = exitButton._enterDelay + 80;
  exitMarker._enterFromAlpha = 0.0;
  exitMarker._enterToAlpha = 1.0;
  exitMarker._enterFromScale = 0.6;
  exitMarker._enterToScale = 1.0;
  buttonMarkers.push(exitMarker);
  jsmaf.root.children.push(exitMarker);

  var exitText = new jsmaf.Text();
  exitText.text = 'Back';
  exitText.align = 'center';
  exitText.x = exitX + buttonWidth / 2;
  exitText.y = exitY + buttonHeight / 2 - 8;
  exitText.style = 'white';
  exitText.alpha = 0.0;
  buttonTexts.push(exitText);
  jsmaf.root.children.push(exitText);

  buttonOrigPos.push({ x: exitX, y: exitY });
  textCenterPos.push({ cx: exitX + buttonWidth / 2, cy: exitY + buttonHeight / 2 - 8 });

  idleParams.push({
    phase: Math.random() * Math.PI * 2,
    slowSpeed: 0.35 + Math.random() * 0.2,
    fastSpeed: 1.2 + Math.random() * 0.8,
    swayAmp: 4 + Math.random() * 4,
    bobAmp: 3 + Math.random() * 4,
    rotateAmp: 0.8 + Math.random() * 1.2
  });

  // Entrance animation for exit button (same pattern as file buttons)
  (function startExitEntrance(btn, txt, mark, idxLocal) {
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

      // text moves from start center to final center and fades with button
      var txtFromCx = btn._enterFromX + buttonWidth / 2;
      var txtFromCy = btn._enterFromY + buttonHeight / 2 - 8;
      var txtToCx = textCenterPos[idxLocal].cx;
      var txtToCy = textCenterPos[idxLocal].cy;
      var textEased = easeInOut(Math.min(1, (elapsed + dur * 0.08) / dur));
      txt.x = txtFromCx + (txtToCx - txtFromCx) * textEased;
      txt.y = txtFromCy + (txtToCy - txtFromCy) * textEased;
      txt.alpha = btn.alpha;

      // marker enter
      mark.x = btn._enterToX + buttonWidth - 50;
      mark.y = btn._enterToY + 35;
      var mElapsed = Math.max(0, elapsed - mark._enterDelay + btn._enterDelay);
      var mT = Math.min(mElapsed / (dur * 0.5), 1);
      var mEased = easeOutQuad(mT);
      mark.alpha = mark._enterFromAlpha + (mark._enterToAlpha - mark._enterFromAlpha) * mEased;
      var mScale = mark._enterFromScale + (mark._enterToScale - mark._enterFromScale) * mEased;
      mark.scaleX = mScale;
      mark.scaleY = mScale;

      if (t >= 1) {
        jsmaf.clearInterval(interval);
        btn._entering = false;
        mark._entering = false;
        btn.x = btn._enterToX;
        btn.y = btn._enterToY;
        btn.alpha = btn._enterToAlpha;
        txt.x = textCenterPos[idxLocal].cx;
        txt.y = textCenterPos[idxLocal].cy;
        txt.alpha = btn.alpha;
        mark.x = btn._enterToX + buttonWidth - 50;
        mark.y = btn._enterToY + 35;
        mark.alpha = mark._enterToAlpha;
        mark.scaleX = mark._enterToScale;
        mark.scaleY = mark._enterToScale;
        mark.visible = false;
      }
    }, 16);
  })(exitButton, exitText, exitMarker, fileList.length);

  // --- press animation (snappy three-step) ---
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

  // --- marker blink helpers (fixed: immediate visible on focus, stop clears interval and hides) ---
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

  // --- random flashing mode (optional API) ---
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

  // expose API
  this.stopAdFlash = stopRandomFlashing;
  this.startAdFlash = startRandomFlashing;

  // --- highlight update (ensures previous marker is stopped and hidden before starting current) ---
  var prevButton = -1;
  var zoomInInterval = null;
  var zoomOutInterval = null;

  function animateZoomIn(btn, text, btnOrigX, btnOrigY, txtCenterX, txtCenterY) {
    if (zoomInInterval) jsmaf.clearInterval(zoomInInterval);
    var btnW = buttonWidth;
    var btnH = buttonHeight;
    var startScale = btn.scaleX || 1.0;
    var endScale = 1.1;
    var duration = 175;
    var elapsed = 0;
    var step = 16;
    zoomInInterval = jsmaf.setInterval(function () {
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeInOut(t);
      var scale = startScale + (endScale - startScale) * eased;
      btn.scaleX = scale;
      btn.scaleY = scale;
      btn.x = btnOrigX - btnW * (scale - 1) / 2;
      btn.y = btnOrigY - btnH * (scale - 1) / 2;
      text.scaleX = scale;
      text.scaleY = scale;
      text.x = txtCenterX - btnW * (scale - 1) / 2;
      text.y = txtCenterY - btnH * (scale - 1) / 2;
      if (t >= 1) {
        jsmaf.clearInterval(zoomInInterval !== null && zoomInInterval !== void 0 ? zoomInInterval : -1);
        zoomInInterval = null;
      }
    }, step);
  }
  function animateZoomOut(btn, text, btnOrigX, btnOrigY, txtCenterX, txtCenterY) {
    if (zoomOutInterval) jsmaf.clearInterval(zoomOutInterval);
    var btnW = buttonWidth;
    var btnH = buttonHeight;
    var startScale = btn.scaleX || 1.1;
    var endScale = 1.0;
    var duration = 175;
    var elapsed = 0;
    var step = 16;
    zoomOutInterval = jsmaf.setInterval(function () {
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeInOut(t);
      var scale = startScale + (endScale - startScale) * eased;
      btn.scaleX = scale;
      btn.scaleY = scale;
      btn.x = btnOrigX - btnW * (scale - 1) / 2;
      btn.y = btnOrigY - btnH * (scale - 1) / 2;
      text.scaleX = scale;
      text.scaleY = scale;
      text.x = txtCenterX - btnW * (scale - 1) / 2;
      text.y = txtCenterY - btnH * (scale - 1) / 2;
      if (t >= 1) {
        jsmaf.clearInterval(zoomOutInterval !== null && zoomOutInterval !== void 0 ? zoomOutInterval : -1);
        zoomOutInterval = null;
      }
    }, step);
  }

  function updateHighlight() {
    // ensure previous marker is stopped and hidden before any new focus
    if (prevButton >= 0 && prevButton !== currentButton) {
      var prevBtn = buttons[prevButton];
      var prevTxt = buttonTexts[prevButton];
      var prevMark = buttonMarkers[prevButton];
      if (prevBtn && prevTxt) {
        prevBtn.url = normalButtonImg;
        prevBtn.alpha = 0.7;
        prevBtn.borderColor = 'transparent';
        prevBtn.borderWidth = 0;
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
      if (prevMark) {
        stopMarkerBlink(prevMark);
        prevMark.visible = false;
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
          stopMarkerBlink(m);
          m.visible = true;
          startMarkerBlink(m);
        }
      } else {
        b.url = normalButtonImg;
        b.alpha = 0.7;
        if (m) {
          stopMarkerBlink(m);
          m.visible = false;
        }
      }
    }

    prevButton = currentButton;
  }

  // --- idle loop: layered motion for all buttons (focused squash for current) ---
  var idleStart = Date.now();
  var idleLoop = jsmaf.setInterval(function () {
    var t = (Date.now() - idleStart) / 1000;
    for (var j = 0; j < buttons.length; j++) {
      var btn = buttons[j];
      var txt = buttonTexts[j];
      var mark = buttonMarkers[j];
      var base = buttonOrigPos[j];
      var txtCenter = textCenterPos[j];
      var params = idleParams[j];
      if (!btn || txtCenter === undefined || !params) continue;
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
        btn.rotation = rotate * 0.4;
        btn.x = base.x + sway * 0.75 - buttonWidth * (finalScaleX - 1) / 2;
        btn.y = base.y + bob * 0.9 - buttonHeight * (finalScaleY - 1) / 2;
        txt.scaleX = finalScaleX;
        txt.scaleY = finalScaleY;
        txt.x = txtCenter.cx + sway * 0.75 - buttonWidth * (finalScaleX - 1) / 2;
        txt.y = txtCenter.cy + bob * 0.9 - buttonHeight * (finalScaleY - 1) / 2;
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
        txt.x = txtCenter.cx + sway * 0.6 - buttonWidth * (finalScale - 1) / 2;
        txt.y = txtCenter.cy + bob * 0.6 - buttonHeight * (finalScale - 1) / 2;
        if (mark) {
          mark.x = btn.x + buttonWidth - 50 + Math.sin(t * 1.2 + params.phase) * 1.2;
          mark.y = btn.y + 35 + Math.cos(t * 1.1 + params.phase) * 1.0;
          mark.scaleX = 0.98 + 0.02 * Math.sin(t * 1.6 + params.phase);
          mark.scaleY = mark.scaleX;
        }
      }
    }
  }, 50);

  // --- logo continuous dynamic loop (in-place) ---
  (function logoIdle() {
    var baseX = logo.x;
    var baseY = logo.y;
    var start = Date.now();
    jsmaf.setInterval(function () {
      var tt = (Date.now() - start) / 1000;
      var yOffset = Math.sin(tt * 0.5) * 8;
      var xOffset = Math.sin(tt * 0.22 + 0.7) * 4;
      var scale = 1 + Math.sin(tt * 0.85 + 0.3) * 0.035;
      logo.y = baseY + yOffset;
      logo.x = baseX + xOffset;
      logo.scaleX = scale;
      logo.scaleY = scale;
    }, 60);
  })();

  // --- perform action for option (unchanged logic) ---
  function performButtonAction(index) {
    var exitIndex = buttons.length - 1;
    if (index === exitIndex) {
      log('Going back to main menu...');
      try {
        include('main-menu.js');
      } catch (e) {
        var err = e;
        log('ERROR loading main-menu.js: ' + err.message);
        if (err.stack) log(err.stack);
      }
      return;
    }
    if (index < fileList.length) {
      var selectedEntry = fileList[index];
      if (!selectedEntry) {
        log('No file selected!');
        return;
      }
      var filePath = selectedEntry.path;
      var fileName = selectedEntry.name;
      log('Selected: ' + fileName + ' from ' + filePath);
      try {
        if (fileName.toLowerCase().endsWith('.js')) {
          if (filePath.startsWith('/download0/')) {
            log('Including JavaScript file: ' + fileName);
            include('payloads/' + fileName);
          } else {
            log('Reading external JavaScript file: ' + filePath);
            var p_addr = mem.malloc(256);
            for (var _i5 = 0; _i5 < filePath.length; _i5++) {
              mem.view(p_addr).setUint8(_i5, filePath.charCodeAt(_i5));
            }
            mem.view(p_addr).setUint8(filePath.length, 0);
            var _fd = fn.open_sys(p_addr, new BigInt(0, 0), new BigInt(0, 0));
            if (!_fd.eq(new BigInt(0xffffffff, 0xffffffff))) {
              var buf_size = 1024 * 1024 * 1;
              var _buf = mem.malloc(buf_size);
              var read_len = fn.read_sys(_fd, _buf, new BigInt(0, buf_size));
              fn.close_sys(_fd);
              var scriptContent = '';
              var len = read_len instanceof BigInt ? read_len.lo : read_len;
              log('File read size: ' + len + ' bytes');
              for (var _i6 = 0; _i6 < len; _i6++) {
                scriptContent += String.fromCharCode(mem.view(_buf).getUint8(_i6));
              }
              log('Executing via eval()...');
              // eslint-disable-next-line no-eval
              eval(scriptContent);
            } else {
              log('ERROR: Could not open file for reading!');
            }
          }
        } else {
          log('Loading binloader.js...');
          include('binloader.js');
          log('binloader.js loaded successfully');
          log('Initializing binloader...');
          var { bl_load_from_file } = binloader_init();
          log('Loading payload from: ' + filePath);
          bl_load_from_file(filePath);
        }
      } catch (e) {
        var _err = e;
        log('ERROR: ' + _err.message);
        if (_err.stack) log(_err.stack);
      }
    }
  }

  // --- handle confirm with press animation then action ---
  function handleButtonPress() {
    var btn = buttons[currentButton];
    var txt = buttonTexts[currentButton];
    if (!btn || !txt) {
      performButtonAction(currentButton);
      return;
    }
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

  // --- key handling (navigation + confirm/back) ---
  jsmaf.onKeyDown = function (keyCode) {
    log('Key pressed: ' + keyCode);
    var fileButtonCount = fileList.length;
    var exitButtonIndex = buttons.length - 1;
    if (keyCode === 6) { // down
      if (currentButton === exitButtonIndex) return;
      var nextButton = currentButton + buttonsPerRow;
      if (nextButton >= fileButtonCount) {
        currentButton = exitButtonIndex;
      } else {
        currentButton = nextButton;
      }
      updateHighlight();
    } else if (keyCode === 4) { // up
      if (currentButton === exitButtonIndex) {
        var lastRow = Math.floor((fileButtonCount - 1) / buttonsPerRow);
        var firstInLastRow = lastRow * buttonsPerRow;
        var _col = 0;
        if (fileButtonCount > 0) {
          _col = Math.min(buttonsPerRow - 1, (fileButtonCount - 1) % buttonsPerRow);
        }
        currentButton = Math.min(firstInLastRow + _col, fileButtonCount - 1);
      } else {
        var _nextButton = currentButton - buttonsPerRow;
        if (_nextButton >= 0) currentButton = _nextButton;
      }
      updateHighlight();
    } else if (keyCode === 5) { // right
      if (currentButton === exitButtonIndex) return;
      var _row = Math.floor(currentButton / buttonsPerRow);
      var _col2 = currentButton % buttonsPerRow;
      if (_col2 < buttonsPerRow - 1) {
        var _nextButton2 = currentButton + 1;
        if (_nextButton2 < fileButtonCount) currentButton = _nextButton2;
      }
      updateHighlight();
    } else if (keyCode === 7) { // left
      if (currentButton === exitButtonIndex) {
        currentButton = fileButtonCount - 1;
      } else {
        var _col3 = currentButton % buttonsPerRow;
        if (_col3 > 0) currentButton = currentButton - 1;
      }
      updateHighlight();
    } else if (keyCode === 14) { // confirm
      handleButtonPress();
    } else if (keyCode === 13) { // back
      log('Going back to main menu...');
      try {
        include('main-menu.js');
      } catch (e) {
        var err = e;
        log('ERROR loading main-menu.js: ' + err.message);
        if (err.stack) log(err.stack);
      }
    }
  };

  jsmaf.onKeyUp = function (keyCode) {
    // intentionally empty to avoid key-based flashing toggles
  };

  // --- finalize UI state and start with highlight ---
  updateHighlight();
  log('Interactive UI loaded!');
  log('Total elements: ' + jsmaf.root.children.length);
  log('Buttons: ' + buttons.length);
  log('Use arrow keys to navigate, Enter/X to select');

})();
