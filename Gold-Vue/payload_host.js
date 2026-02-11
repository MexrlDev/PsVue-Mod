// payload menu with animations, marker blink, and right-analog fast-blink

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

    audio.volume = 0.5; // 50% volume

    try { audio.open('file://../download0/sfx/bgm.wav'); } catch (e) {}

  }



  var is_jailbroken = checkJailbroken();



  jsmaf.root.children.length = 0;



  new Style({ name: 'white', color: 'white', size: 24 });

  new Style({ name: 'title', color: 'white', size: 32 });



  var currentButton = 0;

  var buttons = [];

  var buttonTexts = [];

  var buttonMarkers = [];

  var buttonOrigPos = [];

  var textOrigPos = [];

  var fileList = [];



  var normalButtonImg = 'file:///../download0/img/button_over_9.png';

  var selectedButtonImg = 'file:///../download0/img/button_over_9.png';



  var background = new Image({

    url: 'file:///../download0/img/multiview_bg_VAF.png',

    x: 0,

    y: 0,

    width: 1920,

    height: 1080

  });

  background.alpha = 0;

  background._baseX = background.x;

  background._baseY = background.y;

  jsmaf.root.children.push(background);



  // Keep logo in original place (as requested) but animate it gently

  var logo = new Image({

    url: 'file:///../download0/img/logo.png',

    x: 1620,

    y: 0,

    width: 300,

    height: 169

  });

  logo.alpha = 0;

  logo.scaleX = 0.98;

  logo.scaleY = 0.98;

  logo._baseX = logo.x;

  logo._baseY = logo.y;

  jsmaf.root.children.push(logo);



  if (useImageText) {

    var title = new Image({

      url: textImageBase + 'payloadMenu.png',

      x: 830,

      y: 100,

      width: 250,

      height: 60

    });

    jsmaf.root.children.push(title);

  } else {

    var _title = new jsmaf.Text();

    _title.text = lang.payloadMenu;

    _title.x = 880;

    _title.y = 120;

    _title.style = 'title';

    jsmaf.root.children.push(_title);

  }



  // syscall wrappers used to scan payloads

  try {

    fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint');

    fn.register(0x06, 'close_sys', ['bigint'], 'bigint');

    fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint');

    fn.register(0x03, 'read_sys', ['bigint', 'bigint', 'bigint'], 'bigint');

  } catch (e) {}



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

    for (var j = 0; j < currentPath.length; j++) {

      mem.view(path_addr).setUint8(j, currentPath.charCodeAt(j));

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

          for (var k = 0; k < d_namlen; k++) {

            name += String.fromCharCode(mem.view(buf.add(new BigInt(0, offset + 8 + k))).getUint8(0));

          }

          if (d_type === 8 && name !== '.' && name !== '..') {

            var lowerName = name.toLowerCase();

            if (lowerName.endsWith('.elf') || lowerName.endsWith('.bin') || lowerName.endsWith('.js')) {

              fileList.push({ name: name, path: currentPath + '/' + name });

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



  for (var idx = 0; idx < fileList.length; idx++) {

    var row = Math.floor(idx / buttonsPerRow);

    var col = idx % buttonsPerRow;

    var displayName = fileList[idx].name;

    var btnX = startX + col * xSpacing;

    var btnY = startY + row * buttonSpacing;



    var button = new Image({

      url: normalButtonImg,

      x: btnX,

      y: btnY,

      width: buttonWidth,

      height: buttonHeight

    });

    button.alpha = 0;

    button.scaleX = 1.0;

    button.scaleY = 1.0;

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

    marker.alpha = 0;

    marker._phase = Math.random() * Math.PI * 2;

    marker._isOrangeDot = true;

    buttonMarkers.push(marker);

    jsmaf.root.children.push(marker);



    if (displayName.length > 30) displayName = displayName.substring(0, 27) + '...';

    var text = new jsmaf.Text();

    text.text = displayName;

    text.x = btnX + 20;

    text.y = btnY + 30;

    text.style = 'white';

    text.alpha = 0;

    buttonTexts.push(text);

    jsmaf.root.children.push(text);



    buttonOrigPos.push({ x: btnX, y: btnY });

    textOrigPos.push({ x: text.x, y: text.y });

  }



  var exitX = 810;

  var exitY = 980;

  // ensure exit isn't off-screen

  if (exitY + buttonHeight > 1020) exitY = 980;



  var exitButton = new Image({

    url: normalButtonImg,

    x: exitX,

    y: exitY,

    width: buttonWidth,

    height: buttonHeight

  });

  exitButton.alpha = 0;

  buttons.push(exitButton);

  jsmaf.root.children.push(exitButton);



  var exitMarker = new Image({

    url: 'file:///assets/img/ad_pod_marker.png',

    x: exitX + buttonWidth - 50,

    y: exitY + 35,

    width: 12,

    height: 12,

    visible: false

  });

  exitMarker.alpha = 0;

  exitMarker._isOrangeDot = true;

  buttonMarkers.push(exitMarker);

  jsmaf.root.children.push(exitMarker);



  var exitText = new jsmaf.Text();

  exitText.text = 'Back';

  exitText.x = exitX + buttonWidth / 2 - 20;

  exitText.y = exitY + buttonHeight / 2 - 12;

  exitText.style = 'white';

  exitText.alpha = 0;

  buttonTexts.push(exitText);

  jsmaf.root.children.push(exitText);



  buttonOrigPos.push({ x: exitX, y: exitY });

  textOrigPos.push({ x: exitText.x, y: exitText.y });



  // animation state & helpers

  var _intervals = [];

  var _markerPulseInterval = null;

  var _logoAnimInterval = null;

  var _buttonIdleInterval = null;

  var _bgmFadeInterval = null;

  var prevButton = -1;



  function _setInterval(fn, ms) { var id = jsmaf.setInterval(fn, ms); _intervals.push(id); return id; }

  function _clearAllIntervals() { for (var i = 0; i < _intervals.length; i++) { try { jsmaf.clearInterval(_intervals[i]); } catch (e) {} } _intervals = []; if (_markerPulseInterval) { try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {} _markerPulseInterval = null; } if (_logoAnimInterval) { try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {} _logoAnimInterval = null; } if (_bgmFadeInterval) { try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {} _bgmFadeInterval = null; } if (_buttonIdleInterval) { try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {} _buttonIdleInterval = null; } }



  function easeInOut(t) { return (1 - Math.cos(t * Math.PI)) / 2; }



  function animate(obj, from, to, duration, onStep, done) {

    var elapsed = 0; var step = 16;

    var id = _setInterval(function () {

      elapsed += step; var t = Math.min(elapsed / duration, 1); var e = easeInOut(t);

      for (var k in to) {

        try {

          var f = (from && from[k] !== undefined) ? from[k] : (obj[k] || 0);

          obj[k] = f + (to[k] - f) * e;

        } catch (ex) {}

      }

      if (onStep) onStep(e);

      if (t >= 1) { try { jsmaf.clearInterval(id); } catch (e2) {} if (done) done(); }

    }, step);

    return id;

  }



  // --- Idle breathing loop for all buttons and their texts

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

            if (!b) continue;

            var p = phase + i * 0.25;

            var sx = 1 + Math.sin(p) * 0.02;

            var sy = 1 - Math.sin(p) * 0.02;

            var dy = Math.sin(p * 0.9) * 1.5;

            if (i !== currentButton) {

              b.scaleX = sx;

              b.scaleY = sy;

              b.y = (buttonOrigPos[i] ? buttonOrigPos[i].y : b.y) + dy;

              if (t) { t.scaleX = sx; t.scaleY = sy; t.y = (textOrigPos[i] ? textOrigPos[i].y : t.y) + dy; t.x = (textOrigPos[i] ? textOrigPos[i].x : t.x) - buttonWidth * (sx - 1) / 2; }

            } else {

              b.scaleX = 1 + Math.sin(p) * 0.01;

              b.scaleY = 1 - Math.sin(p) * 0.01;

              b.x = buttonOrigPos[i] ? buttonOrigPos[i].x : b.x;

              b.y = buttonOrigPos[i] ? buttonOrigPos[i].y : b.y;

              if (t) { t.scaleX = b.scaleX; t.scaleY = b.scaleY; t.x = textOrigPos[i] ? textOrigPos[i].x : t.x; t.y = textOrigPos[i] ? textOrigPos[i].y : t.y; }

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



  // --- Marker blink loop

  var markerBlinkSpeed = 0.06; // idle speed

  var markerFastBlinkSpeed = 0.25; // fast speed while analog is moving

  var markerRandomFlicker = false;

  function startMarkerPulseLoop() {

    if (_markerPulseInterval) try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {}

    var phase = 0;

    _markerPulseInterval = jsmaf.setInterval(function () {

      phase += markerBlinkSpeed;

      for (var i = 0; i < buttonMarkers.length; i++) {

        var m = buttonMarkers[i];

        if (!m) continue;

        if (m.isOrangeDot || (m.url && m.url.indexOf('ad_pod_marker') !== -1)) {

          if (m.visible) {

            var a = 0.55 + Math.sin(phase + (i * 0.6)) * 0.35;

            m.alpha = Math.max(0.15, Math.min(a, 1.0));

            m.scaleX = 1 + Math.sin((phase + i) * 1.2) * 0.06;

            m.scaleY = m.scaleX;

            if (markerRandomFlicker && Math.random() < 0.06) {

              m.alpha = Math.random() < 0.5 ? 0.0 : Math.min(1.0, m.alpha + 0.4);

            }

          } else {

            m.alpha = 0; m.scaleX = 1; m.scaleY = 1;

          }

        }

      }

    }, 16);

    _intervals.push(_markerPulseInterval);

  }



  function stopMarkerPulseLoop() {

    if (_markerPulseInterval) try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {}

    _markerPulseInterval = null;

  }



  // --- Logo gentle loop (keeps logo at original place but animates bob & scale)

  function startLogoLoop() {

    var phase = 0;

    if (_logoAnimInterval) try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}

    _logoAnimInterval = jsmaf.setInterval(function () {

      phase += 0.02;

      try {

        // keep base position but apply small bob and scale

        logo.y = logo._baseY + Math.sin(phase) * 4;

        logo.scaleX = 0.99 + Math.sin(phase * 0.9) * 0.01;

        logo.scaleY = logo.scaleX;

        if (background) { background.x = background._baseX + Math.sin(phase * 0.4) * 6; }

      } catch (e) {}

    }, 16);

    _intervals.push(_logoAnimInterval);

  }



  // --- Entrance animation (staggered)

  function entrance() {

    try {

      animate(background, { alpha: background.alpha || 0 }, { alpha: 1 }, 800);

      animate(logo, { alpha: logo.alpha || 0, scaleX: logo.scaleX || 0.95, scaleY: logo.scaleY || 0.95 }, { alpha: 1, scaleX: 1.0, scaleY: 1.0 }, 900);

    } catch (e) {}

    var btnDelayBase = 180;

    var btnDelayStep = 90;

    var btnDuration = 900;

    for (var i = 0; i < buttons.length; i++) {

      (function (idx) {

        var b = buttons[idx]; var t = buttonTexts[idx]; var m = buttonMarkers[idx];

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

            if (m) {

              try { m.x = (buttonOrigPos[idx] ? buttonOrigPos[idx].x + buttonWidth - 50 : 0); m.y = (buttonOrigPos[idx] ? buttonOrigPos[idx].y + 35 : 0) + 40; } catch (e) {}

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

            if (m) {

              var moX = (buttonOrigPos[idx] ? buttonOrigPos[idx].x + buttonWidth - 50 : 0);

              var moY = (buttonOrigPos[idx] ? buttonOrigPos[idx].y + 35 : 0);

              try { m.x = moX; m.y = moY + 40; } catch (e) {}

              animate(m, { alpha: 0, y: moY + 40 }, { alpha: 1, y: moY }, btnDuration + 40);

            }

          } catch (e) {}

        }, delay);

      })(i);

    }

    var totalButtons = buttons.length;

    var lastDelay = btnDelayBase + (Math.max(0, totalButtons - 1)) * btnDelayStep;

    var startAfter = lastDelay + btnDuration + 400;

    jsmaf.setTimeout(function () {

      startMarkerPulseLoop();

      startLogoLoop();

      startButtonIdleLoop();

    }, startAfter);

  }



  // --- Zoom in/out (squishy) for selection

  var _zoomInInterval = null;

  var _zoomOutInterval = null;

  function animateZoomIn(btn, text, btnOrigX, btnOrigY, textOrigX, textOrigY) {

    if (_zoomInInterval) try { jsmaf.clearInterval(_zoomInInterval); } catch (e) {}

    var btnW = buttonWidth;

    var btnH = buttonHeight;

    var startScaleX = btn.scaleX || 1.0;

    var startScaleY = btn.scaleY || 1.0;

    var endScaleX = 1.12;

    var endScaleY = 0.92;

    var duration = 180;

    var elapsed = 0;

    var step = 16;

    _zoomInInterval = jsmaf.setInterval(function () {

      elapsed += step;

      var t = Math.min(elapsed / duration, 1);

      var eased = easeInOut(t);

      var sx = startScaleX + (endScaleX - startScaleX) * eased;

      var sy = startScaleY + (endScaleY - startScaleY) * eased;

      btn.scaleX = sx; btn.scaleY = sy;

      btn.x = btnOrigX - btnW * (sx - 1) / 2;

      btn.y = btnOrigY - btnH * (sy - 1) / 2;

      if (text) {

        text.scaleX = sx; text.scaleY = sy;

        text.x = textOrigX - btnW * (sx - 1) / 2;

        text.y = textOrigY - btnH * (sy - 1) / 2;

      }

      if (t >= 1) {

        try { jsmaf.clearInterval(_zoomInInterval); } catch (ex) {}

        _zoomInInterval = null;

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



  function animateZoomOut(btn, text, btnOrigX, btnOrigY, textOrigX, textOrigY) {

    if (_zoomOutInterval) try { jsmaf.clearInterval(_zoomOutInterval); } catch (e) {}

    var btnW = buttonWidth;

    var btnH = buttonHeight;

    var startScaleX = btn.scaleX || 1.0;

    var startScaleY = btn.scaleY || 1.0;

    var endScaleX = 1.0;

    var endScaleY = 1.0;

    var duration = 160;

    var elapsed = 0;

    var step = 16;

    _zoomOutInterval = jsmaf.setInterval(function () {

      elapsed += step;

      var t = Math.min(elapsed / duration, 1);

      var eased = easeInOut(t);

      var sx = startScaleX + (endScaleX - startScaleX) * eased;

      var sy = startScaleY + (endScaleY - startScaleY) * eased;

      btn.scaleX = sx; btn.scaleY = sy;

      btn.x = btnOrigX - btnW * (sx - 1) / 2;

      btn.y = btnOrigY - btnH * (sy - 1) / 2;

      if (text) {

        text.scaleX = sx; text.scaleY = sy;

        text.x = textOrigX - btnW * (sx - 1) / 2;

        text.y = textOrigX ? textOrigY - btnH * (sy - 1) / 2 : textOrigY;

      }

      if (t >= 1) {

        try { jsmaf.clearInterval(_zoomOutInterval); } catch (ex) {}

        _zoomOutInterval = null;

      }

    }, step);

  }



  // --- Click animation (shrink -> overshoot -> settle)

  var clickSfx = new jsmaf.AudioClip();

  try { clickSfx.open('file://../download0/sfx/click.wav'); } catch (e) {}

  function animateClick(btn, txt, btnOrigX, btnOrigY, textOrigX, textOrigY, done) {

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

        animate(txt, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140);

        jsmaf.setTimeout(function () { animate(txt, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120); }, 140);

      }, 80);

    }

  }



  // --- updateHighlight: apply selection visuals and animate

  function updateHighlight() {

    var prevObj = buttons[prevButton];

    var prevMarker = buttonMarkers[prevButton];

    if (prevButton >= 0 && prevButton !== currentButton && prevObj) {

      prevObj.url = normalButtonImg;

      prevObj.alpha = 0.7;

      prevObj.borderColor = 'transparent';

      prevObj.borderWidth = 0;

      if (prevMarker) prevMarker.visible = false;

      animateZoomOut(prevObj, buttonTexts[prevButton], buttonOrigPos[prevButton].x, buttonOrigPos[prevButton].y, textOrigPos[prevButton].x, textOrigPos[prevButton].y);

    }



    for (var i = 0; i < buttons.length; i++) {

      var _button = buttons[i];

      var _marker = buttonMarkers[i];

      var _text = buttonTexts[i];

      var _orig = buttonOrigPos[i];

      var _tOrig = textOrigPos[i];

      if (!_button || !_text || !_orig || !_tOrig) continue;

      if (i === currentButton) {

        _button.url = selectedButtonImg;

        _button.alpha = 1.0;

        _button.borderColor = 'rgb(122, 91, 6)';

        _button.borderWidth = 3;

        if (_marker) { _marker.visible = true; _marker._phase = Math.random() * Math.PI * 2; }

        animateZoomIn(_button, _text, _orig.x, _orig.y, _tOrig.x, _tOrig.y);

      } else if (i !== prevButton) {

        _button.url = normalButtonImg;

        _button.alpha = 0.7;

        _button.borderColor = 'transparent';

        _button.borderWidth = 0;

        _button.scaleX = 1.0; _button.scaleY = 1.0;

        _button.x = _orig.x; _button.y = _orig.y;

        _text.scaleX = 1.0; _text.scaleY = 1.0;

        _text.x = _tOrig.x; _text.y = _tOrig.y;

        if (_marker) _marker.visible = false;

      }

    }

    prevButton = currentButton;

  }



  // --- Input handling (navigation)

  jsmaf.onKeyDown = function (keyCode) {

    log('Key pressed: ' + keyCode);

    var fileButtonCount = fileList.length;

    var exitButtonIndex = buttons.length - 1;

    if (keyCode === 6) { // down

      if (currentButton === exitButtonIndex) return;

      var nextButton = currentButton + buttonsPerRow;

      if (nextButton >= fileButtonCount) currentButton = exitButtonIndex;

      else currentButton = nextButton;

      updateHighlight();

    } else if (keyCode === 4) { // up

      if (currentButton === exitButtonIndex) {

        var lastRow = Math.floor((fileButtonCount - 1) / buttonsPerRow);

        var firstInLastRow = lastRow * buttonsPerRow;

        var col = 0;

        if (fileButtonCount > 0) col = Math.min(buttonsPerRow - 1, (fileButtonCount - 1) % buttonsPerRow);

        currentButton = Math.min(firstInLastRow + col, fileButtonCount - 1);

      } else {

        var prev = currentButton - buttonsPerRow;

        if (prev >= 0) currentButton = prev;

      }

      updateHighlight();

    } else if (keyCode === 5) { // right

      if (currentButton === exitButtonIndex) return;

      var col = currentButton % buttonsPerRow;

      if (col < buttonsPerRow - 1) {

        var next = currentButton + 1;

        if (next < fileButtonCount) currentButton = next;

      }

      updateHighlight();

    } else if (keyCode === 7) { // left

      if (currentButton === exitButtonIndex) {

        currentButton = fileButtonCount - 1;

      } else {

        var col2 = currentButton % buttonsPerRow;

        if (col2 > 0) currentButton = currentButton - 1;

      }

      updateHighlight();

    } else if (keyCode === 14) { // select

      handleButtonPress();

    } else if (keyCode === 13) { // special: go back to main menu

      log('Going back to main menu...');

      try { include('main-menu.js'); } catch (e) { log('ERROR loading main-menu.js: ' + (e && e.message ? e.message : e)); if (e.stack) log(e.stack); }

    }

  };



  // --- handleButtonPress: click animation then action

  function handleButtonPress() {

    var idx = currentButton;

    var btn = buttons[idx];

    var txt = buttonTexts[idx];

    var bx = buttonOrigPos[idx] ? buttonOrigPos[idx].x : (btn.x || 0);

    var by = buttonOrigPos[idx] ? buttonOrigPos[idx].y : (btn.y || 0);

    animateClick(btn, txt, bx, by, textOrigPos[idx] ? textOrigPos[idx].x : (txt.x || 0), textOrigPos[idx] ? textOrigPos[idx].y : (txt.y || 0), function () {

      if (idx === buttons.length - 1) {

        log('Going back to main menu...');

        try { include('main-menu.js'); } catch (e) { log('ERROR loading main-menu.js: ' + (e && e.message ? e.message : e)); if (e.stack) log(e.stack); }

        return;

      }

      if (idx < fileList.length) {

        var selectedEntry = fileList[idx];

        if (!selectedEntry) { log('No file selected!'); return; }

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

              for (var m = 0; m < filePath.length; m++) mem.view(p_addr).setUint8(m, filePath.charCodeAt(m));

              mem.view(p_addr).setUint8(filePath.length, 0);

              var fd = fn.open_sys(p_addr, new BigInt(0, 0), new BigInt(0, 0));

              if (!fd.eq(new BigInt(0xffffffff, 0xffffffff))) {

                var buf_size = 1024 * 1024 * 1;

                var _buf = mem.malloc(buf_size);

                var read_len = fn.read_sys(fd, _buf, new BigInt(0, buf_size));

                fn.close_sys(fd);

                var scriptContent = '';

                var len = read_len instanceof BigInt ? read_len.lo : read_len;

                log('File read size: ' + len + ' bytes');

                for (var r = 0; r < len; r++) scriptContent += String.fromCharCode(mem.view(_buf).getUint8(r));

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

            var { bl_load_from_file } = binloader_init();

            log('Loading payload from: ' + filePath);

            bl_load_from_file(filePath);

          }

        } catch (e) {

          log('ERROR: ' + (e && e.message ? e.message : e));

          if (e.stack) log(e.stack);

        }

      }

    });

  }



  // --- Right analog handling: fast blink while moving, idle blink when released

  var analogMoving = false;

  var analogMoveThreshold = 0.15;

  var analogPollInterval = null;

  function setMarkerFastBlinking(enabled) {

    if (enabled) {

      markerBlinkSpeed = markerFastBlinkSpeed;

      markerRandomFlicker = true;

    } else {

      markerBlinkSpeed = 0.06;

      markerRandomFlicker = false;

    }

  }



  try {

    if (typeof jsmaf.onAnalogRight === 'function') {

      jsmaf.onAnalogRight(function (x, y) {

        var mag = Math.sqrt(x * x + y * y);

        if (mag > analogMoveThreshold) {

          if (!analogMoving) { analogMoving = true; setMarkerFastBlinking(true); }

        } else {

          if (analogMoving) { analogMoving = false; setMarkerFastBlinking(false); }

        }

      });

    } else if (typeof jsmaf.onGamepadAxis === 'function') {

      jsmaf.onGamepadAxis(function (index, axis, value) {

        if (axis === 2 || axis === 3) {

          var mag = Math.abs(value);

          if (mag > analogMoveThreshold) {

            if (!analogMoving) { analogMoving = true; setMarkerFastBlinking(true); }

          } else {

            if (analogMoving) { analogMoving = false; setMarkerFastBlinking(false); }

          }

        }

      });

    } else if (typeof jsmaf.getGamepadState === 'function') {

      if (analogPollInterval) try { jsmaf.clearInterval(analogPollInterval); } catch (e) {}

      analogPollInterval = jsmaf.setInterval(function () {

        try {

          var state = jsmaf.getGamepadState(0);

          if (state && state.axes) {

            var rx = state.axes[2] || 0;

            var ry = state.axes[3] || 0;

            var mag = Math.sqrt(rx * rx + ry * ry);

            if (mag > analogMoveThreshold) {

              if (!analogMoving) { analogMoving = true; setMarkerFastBlinking(true); }

            } else {

              if (analogMoving) { analogMoving = false; setMarkerFastBlinking(false); }

            }

          }

        } catch (e) {}

      }, 80);

      _intervals.push(analogPollInterval);

    }

  } catch (e) {}



  // Start loops & entrance

  entrance();



  jsmaf.setTimeout(function () {

    updateHighlight();

  }, 600);



  log('Interactive UI loaded!');

  log('Total elements: ' + jsmaf.root.children.length);

  log('Buttons: ' + buttons.length);

  log('Use arrow keys to navigate, Enter/X to select');

})();

