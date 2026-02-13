(function () {
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

  var currentButton = 0;
  var buttons = [];
  var buttonTexts = [];
  var buttonMarkers = [];
  var buttonOrigPos = [];
  var textCenterPos = [];
  var idleParams = [];
  var fileList = [];

  var normalButtonImg = 'file:///../download0/img/button_over_9.png';
  var selectedButtonImg = 'file:///../download0/img/button_over_9.png';

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

  fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(0x06, 'close_sys', ['bigint'], 'bigint');
  fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(0x03, 'read_sys', ['bigint', 'bigint', 'bigint'], 'bigint');

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

  var startY = 200;
  var buttonSpacing = 90;
  var buttonsPerRow = 5;
  var buttonWidth = 300;
  var buttonHeight = 80;
  var startX = 130;
  var xSpacing = 340;

  // create buttons at final positions (no entrance animation)
  for (var idx = 0; idx < fileList.length; idx++) {
    (function (i) {
      var row = Math.floor(i / buttonsPerRow);
      var col = i % buttonsPerRow;
      var displayName = fileList[i].name;
      var finalX = startX + col * xSpacing;
      var finalY = startY + row * buttonSpacing;

      var button = new Image({
        url: normalButtonImg,
        x: finalX, y: finalY, width: buttonWidth, height: buttonHeight,
        alpha: 0.96, rotation: 0, scaleX: 1.0, scaleY: 1.0
      });
      button._entering = false;
      button._pressInterval = null;
      buttons.push(button);
      jsmaf.root.children.push(button);

      var marker = new Image({
        url: 'file:///assets/img/ad_pod_marker.png',
        x: finalX + buttonWidth - 50, y: finalY + 35, width: 12, height: 12,
        alpha: 1.0, scaleX: 1.0, scaleY: 1.0, visible: false
      });
      buttonMarkers.push(marker);
      jsmaf.root.children.push(marker);

      if (displayName.length > 30) displayName = displayName.substring(0, 27) + '...';
      var text = new jsmaf.Text();
      text.text = displayName;
      text.align = 'center';
      text.x = finalX + buttonWidth / 2;
      text.y = finalY + buttonHeight / 2 - 8;
      text.style = 'white';
      text.alpha = 0.96;
      buttonTexts.push(text);
      jsmaf.root.children.push(text);

      buttonOrigPos.push({ x: finalX, y: finalY });
      textCenterPos.push({ cx: finalX + buttonWidth / 2, cy: finalY + buttonHeight / 2 - 8 });

      idleParams.push({
        phase: 0,
        slowSpeed: 0,
        fastSpeed: 0,
        swayAmp: 0,
        bobAmp: 0,
        rotateAmp: 0
      });
    })(idx);
  }

  var exitX = 810;
  var exitY = 980;
  var exitButton = new Image({
    url: normalButtonImg,
    x: exitX, y: exitY, width: buttonWidth, height: buttonHeight,
    alpha: 0.96, scaleX: 1.0, scaleY: 1.0
  });
  exitButton._entering = false;
  exitButton._pressInterval = null;
  buttons.push(exitButton);
  jsmaf.root.children.push(exitButton);

  var exitMarker = new Image({
    url: 'file:///assets/img/ad_pod_marker.png',
    x: exitX + buttonWidth - 50, y: exitY + 35, width: 12, height: 12, visible: false, alpha: 1.0, scaleX: 1.0, scaleY: 1.0
  });
  buttonMarkers.push(exitMarker);
  jsmaf.root.children.push(exitMarker);

  var exitText = new jsmaf.Text();
  exitText.text = 'Back';
  exitText.align = 'center';
  exitText.x = exitX + buttonWidth / 2;
  exitText.y = exitY + buttonHeight / 2 - 8;
  exitText.style = 'white';
  exitText.alpha = 0.96;
  buttonTexts.push(exitText);
  jsmaf.root.children.push(exitText);

  buttonOrigPos.push({ x: exitX, y: exitY });
  textCenterPos.push({ cx: exitX + buttonWidth / 2, cy: exitY + buttonHeight / 2 - 8 });

  idleParams.push({
    phase: 0,
    slowSpeed: 0,
    fastSpeed: 0,
    swayAmp: 0,
    bobAmp: 0,
    rotateAmp: 0
  });

  // simplified press behavior: no animation, immediate action
  function handleButtonPress() {
    var btn = buttons[currentButton];
    var txt = buttonTexts[currentButton];
    if (btn && btn._entering) {
      btn._entering = false;
      btn.x = buttonOrigPos[currentButton].x;
      btn.y = buttonOrigPos[currentButton].y;
      if (txt) { txt.x = textCenterPos[currentButton].cx; txt.y = textCenterPos[currentButton].cy; }
      var mk = buttonMarkers[currentButton];
      if (mk) { mk.x = btn.x + buttonWidth - 50; mk.y = btn.y + 35; mk.visible = true; mk.scaleX = 1.0; mk.scaleY = 1.0; }
    }
    performButtonAction(currentButton);
  }

  function startMarkerBlink(marker) {
    if (!marker) return;
    marker.visible = true;
    marker.scaleX = 1.0;
    marker.scaleY = 1.0;
  }
  function stopMarkerBlink(marker) {
    if (!marker) return;
    marker.visible = false;
    marker.scaleX = 1.0;
    marker.scaleY = 1.0;
  }

  var flashingMode = false;
  var flashingInterval = null;
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
      stopMarkerBlink(mark);
      mark.visible = false;
      mark.scaleX = 1.0;
      mark.scaleY = 1.0;
    }
    var focusedMarker = buttonMarkers[currentButton];
    if (focusedMarker) focusedMarker.visible = true;
  }

  this.stopAdFlash = stopRandomFlashing;
  this.startAdFlash = startRandomFlashing;

  var prevButton = -1;
  function updateHighlight() {
    if (prevButton >= 0 && prevButton !== currentButton) {
      var prevBtn = buttons[prevButton];
      var prevTxt = buttonTexts[prevButton];
      var prevMark = buttonMarkers[prevButton];
      if (prevBtn && prevTxt) {
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
        b.scaleX = 1.0;
        b.scaleY = 1.0;
        if (m) {
          m.visible = true;
        }
      } else {
        b.url = normalButtonImg;
        b.alpha = 0.96;
        if (m && !flashingMode) {
          m.visible = false;
        }
      }
    }

    prevButton = currentButton;
  }

  // perform action for option
  function performButtonAction(index) {
    var exitIndex = buttons.length - 1;
    if (index === exitIndex) {
      log('Going back to main menu...');
      try {
        include('main-menu.js');
      } catch (e) {
        var err = e;
        log('ERROR loading main-menu.js: ' + (err && err.message ? err.message : err));
        if (err && err.stack) log(err.stack);
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
        log('ERROR: ' + (_err && _err.message ? _err.message : _err));
        if (_err && _err.stack) log(_err.stack);
      }
    }
  }

  jsmaf.onKeyDown = function (keyCode) {
    log('Key pressed: ' + keyCode);
    var fileButtonCount = fileList.length;
    var exitButtonIndex = buttons.length - 1;
    if (keyCode === 6) {
      if (currentButton === exitButtonIndex) return;
      var nextButton = currentButton + buttonsPerRow;
      if (nextButton >= fileButtonCount) {
        currentButton = exitButtonIndex;
      } else {
        currentButton = nextButton;
      }
      updateHighlight();
    } else if (keyCode === 4) {
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
    } else if (keyCode === 5) {
      if (currentButton === exitButtonIndex) return;
      var _row = Math.floor(currentButton / buttonsPerRow);
      var _col2 = currentButton % buttonsPerRow;
      if (_col2 < buttonsPerRow - 1) {
        var _nextButton2 = currentButton + 1;
        if (_nextButton2 < fileButtonCount) currentButton = _nextButton2;
      }
      updateHighlight();
    } else if (keyCode === 7) {
      if (currentButton === exitButtonIndex) {
        currentButton = fileButtonCount - 1;
      } else {
        var _col3 = currentButton % buttonsPerRow;
        if (_col3 > 0) currentButton = currentButton - 1;
      }
      updateHighlight();
    } else if (keyCode === 14) {
      handleButtonPress();
    } else if (keyCode === 13) {
      log('Going back to main menu...');
      try {
        include('main-menu.js');
      } catch (e) {
        var err = e;
        log('ERROR loading main-menu.js: ' + (err && err.message ? err.message : err));
        if (err && err.stack) log(err.stack);
      }
    }
  };

  jsmaf.onKeyUp = function (keyCode) {
    // intentionally empty
  };

  updateHighlight();
  log('Interactive UI loaded!');
  log('Total elements: ' + jsmaf.root.children.length);
  log('Buttons: ' + buttons.length);
})();
