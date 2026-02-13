(function () {
  include('languages.js');
  log(lang.loadingMainMenu);

  var currentButton = 0;
  var buttons = [];
  var buttonTexts = [];
  var buttonMarkers = [];
  var buttonOrigPos = [];
  var textCenterPos = []; // center coords for text
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
  var logoWidth = 600;
  var logoHeight = 338;

  var logo = new Image({
    url: 'file:///../download0/img/logo.png',
    x: centerX - logoWidth / 2,
    y: 50,
    width: logoWidth,
    height: logoHeight,
    alpha: 1.0,
    scaleX: 1.0,
    scaleY: 1.0
  });
  jsmaf.root.children.push(logo);

  // Keep overlay but fully transparent so it doesn't block input
  var introOverlay = new Image({
    url: 'file:///assets/img/black.png',
    x: 0, y: 0, width: 1920, height: 1080,
    alpha: 0.0
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

  for (var i = 0; i < menuOptions.length; i++) {
    (function (i) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      var finalX = startX + col * (buttonWidth + buttonSpacingX);
      var finalY = startY + row * (buttonHeight + buttonSpacingY);

      // create button at final pos, no entrance animation
      var button = new Image({
        url: normalButtonImg,
        x: finalX,
        y: finalY,
        width: buttonWidth,
        height: buttonHeight,
        alpha: 0.96,
        rotation: 0,
        scaleX: 1.0,
        scaleY: 1.0
      });
      // not entering — animations removed
      button._entering = false;
      button._pressInterval = null;
      buttons.push(button);
      jsmaf.root.children.push(button);

      var marker = new Image({
        url: 'file:///assets/img/ad_pod_marker.png',
        x: finalX + buttonWidth - 50,
        y: finalY + 35,
        width: 12,
        height: 12,
        alpha: 1.0,
        scaleX: 1.0,
        scaleY: 1.0,
        visible: false
      });
      buttonMarkers.push(marker);
      jsmaf.root.children.push(marker);

      var btnText;
      if (typeof useImageText !== 'undefined' && useImageText) {
        btnText = new Image({
          url: (typeof textImageBase !== 'undefined' ? textImageBase : '') + menuOptions[i].imgKey + '.png',
          x: finalX + buttonWidth / 2,
          y: finalY + buttonHeight / 2,
          width: 300,
          height: 50,
          alpha: 0.96,
          visible: true
        });
      } else {
        btnText = new jsmaf.Text();
        btnText.text = menuOptions[i].label;
        btnText.align = 'center';
        btnText.x = finalX + buttonWidth / 2;
        btnText.y = finalY + buttonHeight / 2 - 8;
        btnText.style = 'white';
        btnText.alpha = 0.96;
      }
      buttonTexts.push(btnText);
      jsmaf.root.children.push(btnText);

      buttonOrigPos.push({ x: finalX, y: finalY });
      textCenterPos.push({ cx: finalX + buttonWidth / 2, cy: finalY + buttonHeight / 2 - 8 });
    })(i);
  }

  // No press animation — perform action immediately
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

  function handleButtonPress() {
    var btn = buttons[currentButton];
    var txt = buttonTexts[currentButton];
    if (!btn || !txt) {
      performButtonAction(currentButton);
      return;
    }
    // finalize any entering flags (none used) and perform action immediately
    btn._entering = false;
    btn.x = buttonOrigPos[currentButton].x;
    btn.y = buttonOrigPos[currentButton].y;
    txt.x = textCenterPos[currentButton].cx;
    txt.y = textCenterPos[currentButton].cy;
    var mk = buttonMarkers[currentButton];
    if (mk) { mk.x = btn.x + buttonWidth - 50; mk.y = btn.y + 35; mk.visible = true; mk.scaleX = 1.0; mk.scaleY = 1.0; }

    performButtonAction(currentButton);
  }

  // Simple start/stop flashing API without animations (instant toggle)
  var flashingMode = false;
  function startRandomFlashing() {
    flashingMode = true;
    for (var m = 0; m < buttonMarkers.length; m++) {
      if (!buttonMarkers[m]) continue;
      buttonMarkers[m].visible = true;
      buttonMarkers[m].scaleX = 1.0;
      buttonMarkers[m].scaleY = 1.0;
    }
  }

  function stopRandomFlashing() {
    flashingMode = false;
    for (var mm = 0; mm < buttonMarkers.length; mm++) {
      var mark = buttonMarkers[mm];
      if (!mark) continue;
      mark.visible = false;
      mark.scaleX = 1.0;
      mark.scaleY = 1.0;
    }
    var focusedMarker = buttonMarkers[currentButton];
    if (focusedMarker) focusedMarker.visible = true;
  }

  function updateHighlight() {
    // reset previous if changed
    var prevButton = -1;
    for (var p = 0; p < buttons.length; p++) {
      if (buttons[p] && buttons[p].borderWidth === 3) {
        prevButton = p;
        break;
      }
    }
    if (prevButton >= 0 && prevButton !== currentButton) {
      var prevBtn = buttons[prevButton];
      var prevTxt = buttonTexts[prevButton];
      var prevMark = buttonMarkers[prevButton];
      if (prevBtn && prevTxt && prevMark) {
        prevBtn.url = normalButtonImg;
        prevBtn.alpha = 0.96;
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
          if (!flashingMode) {
            m.visible = true;
          }
        }
      } else {
        b.url = normalButtonImg;
        b.alpha = 0.96;
        if (m && !flashingMode) {
          m.visible = false;
        }
      }
    }
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

  // key up handler — intentionally empty
  jsmaf.onKeyUp = function (keyCode) {};

  // Also support external callers of "stop flashing" if needed:
  this.stopAdFlash = stopRandomFlashing;
  this.startAdFlash = startRandomFlashing;

  updateHighlight();
  log(lang.mainMenuLoaded);

})();
