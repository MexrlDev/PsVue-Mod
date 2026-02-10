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



  // --- NEW: animation + interval helpers + cursor + style (added, does not change logic) ---



  var _intervals = [];



  function _setInterval(fn, ms) { var id = jsmaf.setInterval(fn, ms); _intervals.push(id); return id; }



  function _clearAllIntervals() { for (var i = 0; i < _intervals.length; i++) { try { jsmaf.clearInterval(_intervals[i]); } catch (e) {} } _intervals = []; }



  function easeInOut(t) { return (1 - Math.cos(t * Math.PI)) / 2; }



  function animate(obj, from, to, duration, onStep, done) {



    var elapsed = 0; var step = 16;



    var id = _setInterval(function () {



      elapsed += step; var t = Math.min(elapsed / duration, 1); var e = easeInOut(t);



      for (var k in to) {



        var f = (from && from[k] !== undefined) ? from[k] : (obj[k] !== undefined ? obj[k] : 0);



        obj[k] = f + (to[k] - f) * e;



      }



      if (onStep) onStep(e);



      if (t >= 1) { try { jsmaf.clearInterval(id); } catch (ex) {} if (done) done(); }



    }, step);



    return id;



  }



  // --- UI base: clear and styles (unchanged logic) ---



  jsmaf.root.children.length = 0;



  new Style({ name: 'white', color: 'white', size: 24 });



  new Style({ name: 'title', color: 'white', size: 32 });



  new Style({ name: 'groupHeader', color: 'white', size: 20 }); // small header style for future use



  var background = new Image({



    url: 'file:///../download0/img/multiview_bg_VAF.png',



    x: 0,



    y: 0,



    width: 1920,



    height: 1080



  });

  background.alpha = 0;

  background._baseX = background.x;

  jsmaf.root.children.push(background);



  var logo = new Image({



    url: 'file:///../download0/img/logo.png',



    x: 1620,



    y: 0,



    width: 300,



    height: 169



  });

  logo.alpha = 0; logo.scaleX = 0.98; logo.scaleY = 0.98;

  jsmaf.root.children.push(logo);



  if (useImageText) {



    var title = new Image({



      url: textImageBase + 'config.png',



      x: 860,



      y: 100,



      width: 200,



      height: 60



    });

    title.alpha = 0;

    jsmaf.root.children.push(title);



  } else {



    var _title = new jsmaf.Text();

    _title.text = lang.config;

    _title.x = 910;

    _title.y = 120;

    _title.style = 'title';

    _title.alpha = 0;

    jsmaf.root.children.push(_title);



  }



  // Include the stats tracker

  try { include('stats-tracker.js'); } catch (e) { /* keep working even if missing */ }



  // Load and display stats (keep original behavior)

  try { stats.load(); } catch (e) {}



  var statsData = (typeof stats !== 'undefined' && typeof stats.get === 'function') ? stats.get() : { total: 0, success: 0, failures: 0, successRate: 0, failureRate: 0 };



  // Create text elements for each stat

  var statsImgKeys = ['totalAttempts', 'successes', 'failures', 'successRate', 'failureRate'];



  var statsValues = [statsData.total, statsData.success, statsData.failures, statsData.successRate, statsData.failureRate];



  var statsLabels = [lang.totalAttempts, lang.successes, lang.failures, lang.successRate, lang.failureRate];



  // Display each stat line (identical logic, only animate in)

  for (var i = 0; i < statsImgKeys.length; i++) {



    var yPos = 120 + i * 25;



    if (useImageText) {



      try {



        var labelImg = new Image({



          url: textImageBase + statsImgKeys[i] + '.png',



          x: 20,



          y: yPos,



          width: 180,



          height: 25



        });

        labelImg.alpha = 0; jsmaf.root.children.push(labelImg);

        animate(labelImg, { alpha: 0, y: yPos + 6 }, { alpha: 1, y: yPos }, 420);

      } catch (e) {}



      var valueText = new jsmaf.Text();

      valueText.text = String(statsValues[i]);

      valueText.x = 210;

      valueText.y = yPos;

      valueText.style = 'white';

      valueText.alpha = 0;

      jsmaf.root.children.push(valueText);

      animate(valueText, { alpha: 0, y: yPos + 6 }, { alpha: 1, y: yPos }, 420);



    } else {



      var lineText = new jsmaf.Text();

      lineText.text = statsLabels[i] + ': ' + statsValues[i];

      lineText.x = 20;

      lineText.y = yPos;

      lineText.style = 'white';

      lineText.alpha = 0;

      jsmaf.root.children.push(lineText);

      animate(lineText, { alpha: 0, y: yPos + 6 }, { alpha: 1, y: yPos }, 420);



    }



  }



  var configOptions = [{

    key: 'autolapse',

    label: lang.autoLapse,

    imgKey: 'autoLapse',

    type: 'toggle'

  }, {

    key: 'autopoop',

    label: lang.autoPoop,

    imgKey: 'autoPoop',

    type: 'toggle'

  }, {

    key: 'autoclose',

    label: lang.autoClose,

    imgKey: 'autoClose',

    type: 'toggle'

  }, {

    key: 'jb_behavior',

    label: lang.jbBehavior,

    imgKey: 'jbBehavior',

    type: 'cycle'

  }];



  var centerX = 960;

  var startY = 300;

  var buttonSpacing = 120;

  var buttonWidth = 400;

  var buttonHeight = 80;



  // --- NEW: cursor + mouse helpers (added, non-invasive) ---



  var virtualMouse = { x: 960, y: 540 };

  var cursorSize = { w: 28, h: 28 };

  var lastRealMouseTime = 0;

  var mouseHideTimeout = null;

  var mouseInactivityMs = 2000;

  var cursor = new Image({ url: 'file:///../download0/img/cursor.png', x: virtualMouse.x - cursorSize.w/2, y: virtualMouse.y - cursorSize.h/2, width: cursorSize.w, height: cursorSize.h });

  cursor.alpha = 1; cursor.visible = false; cursor._isCursor = true;

  jsmaf.root.children.push(cursor);



  function showCursor() {

    cursor.visible = true;

    lastRealMouseTime = Date.now();

    if (mouseHideTimeout) { try { jsmaf.clearTimeout(mouseHideTimeout); } catch (e) {} mouseHideTimeout = null; }

    mouseHideTimeout = jsmaf.setTimeout(function () {

      var now = Date.now();

      if (now - lastRealMouseTime >= mouseInactivityMs) {

        cursor.visible = false;

      }

      mouseHideTimeout = null;

    }, mouseInactivityMs);

  }



  function updateCursorPosition(x, y) {

    virtualMouse.x = x; virtualMouse.y = y;

    cursor.x = Math.round(virtualMouse.x - cursorSize.w / 2);

    cursor.y = Math.round(virtualMouse.y - cursorSize.h / 2);

    lastRealMouseTime = Date.now();

    if (!cursor.visible) cursor.visible = true;

  }



  // --- create config option buttons (same logic as before, with markers that will pulse) ---



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

    button.alpha = 0; button.scaleX = 1.0; button.scaleY = 1.0;

    buttons.push(button);

    jsmaf.root.children.push(button);



    // orange dot marker (hidden by default) — IMPORTANT: mark as non-pulsing for option buttons

    var marker = new Image({ url: 'file:///assets/img/ad_pod_marker.png', x: btnX + buttonWidth - 50, y: btnY + 35, width: 12, height: 12, visible: false });

    marker.alpha = 0; marker.isOrangeDot = false; // <-- ensure option markers do NOT pulse

    buttonMarkers.push(marker);

    jsmaf.root.children.push(marker);



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

    btnText.alpha = 0;

    buttonTexts.push(btnText);

    jsmaf.root.children.push(btnText);



    if (configOption.type === 'toggle') {

      var checkmark = new Image({

        url: currentConfig[configOption.key] ? 'file:///../download0/img/check_small_on.png' : 'file:///../download0/img/check_small_off.png',

        x: btnX + 320,

        y: btnY + 20,

        width: 40,

        height: 40

      });

      checkmark.alpha = 0; valueTexts.push(checkmark); jsmaf.root.children.push(checkmark);

    } else {

      var valueLabel;

      if (useImageText) {

        valueLabel = new Image({

          url: textImageBase + jbBehaviorImgKeys[currentConfig.jb_behavior] + '.png',

          x: btnX + 230,

          y: btnY + 15,

          width: 150,

          height: 50

        });

      } else {

        valueLabel = new jsmaf.Text();

        valueLabel.text = jbBehaviorLabels[currentConfig.jb_behavior] || jbBehaviorLabels[0];

        valueLabel.x = btnX + 250;

        valueLabel.y = btnY + 28;

        valueLabel.style = 'white';

      }

      valueLabel.alpha = 0; valueTexts.push(valueLabel); jsmaf.root.children.push(valueLabel);

    }



    buttonOrigPos.push({

      x: btnX,

      y: btnY

    });

    textOrigPos.push({

      x: btnText.x,

      y: btnText.y

    });



    // Make the button clickable by mouse (non-invasive addition)

    (function (idx, bx, by, bw, bh) {

      // nothing needed here because global mouse handlers added below will map clicks to currentButton

    })(_i, btnX, btnY, buttonWidth, buttonHeight);



  }



  // Back button (same as before, but animated later)

  var backX = centerX - buttonWidth / 2;

  var backY = startY + configOptions.length * buttonSpacing + 100;

  var backButton = new Image({

    url: normalButtonImg,

    x: backX,

    y: backY,

    width: buttonWidth,

    height: buttonHeight

  });

  backButton.alpha = 0; backButton.scaleX = 1.0; backButton.scaleY = 1.0;

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

  backMarker.isOrangeDot = true; // <-- only back marker pulses

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

  backText.alpha = 0;

  backText._centered = true; // <-- ADDED: ensure Back label follows its button center during idle movement

  buttonTexts.push(backText);

  jsmaf.root.children.push(backText);



  buttonOrigPos.push({

    x: backX,

    y: backY

  });

  textOrigPos.push({

    x: backText.x,

    y: backText.y

  });



  // --- hover/selection animations (kept your original zoom behavior) ---



  var zoomInInterval = null;

  var zoomOutInterval = null;

  var prevButton = -1;



  function animateZoomIn(btn, text, btnOrigX, btnOrigY, textOrigX, textOrigY) {

    if (zoomInInterval) try { jsmaf.clearInterval(zoomInInterval); } catch (e) {}

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

      text.x = textOrigX - btnW * (scale - 1) / 2;

      text.y = textOrigY - btnH * (scale - 1) / 2;

      if (t >= 1) {

        try { jsmaf.clearInterval(zoomInInterval !== null && zoomInInterval !== void 0 ? zoomInInterval : -1); } catch (e) {}

        zoomInInterval = null;

      }

    }, step);

  }



  function animateZoomOut(btn, text, btnOrigX, btnOrigY, textOrigX, textOrigY) {

    if (zoomOutInterval) try { jsmaf.clearInterval(zoomOutInterval); } catch (e) {}

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

      text.x = textOrigX - btnW * (scale - 1) / 2;

      text.y = textOrigY - btnH * (scale - 1) / 2;

      if (t >= 1) {

        try { jsmaf.clearInterval(zoomOutInterval !== null && zoomOutInterval !== void 0 ? zoomOutInterval : -1); } catch (e) {}

        zoomOutInterval = null;

      }

    }, step);

  }



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

      animateZoomOut(prevButtonObj, buttonTexts[prevButton], buttonOrigPos[prevButton].x, buttonOrigPos[prevButton].y, textOrigPos[prevButton].x, textOrigPos[prevButton].y);

    }



    // Set styles for all buttons

    for (var _i2 = 0; _i2 < buttons.length; _i2++) {

      var _button = buttons[_i2];

      var _buttonMarker = buttonMarkers[_i2];

      var buttonText = buttonTexts[_i2];

      var buttonOrigPos_ = buttonOrigPos[_i2];

      var textOrigPos_ = textOrigPos[_i2];

      if (_button === undefined || buttonText === undefined || buttonOrigPos_ === undefined || textOrigPos_ === undefined) continue;

      if (_i2 === currentButton) {

        _button.url = selectedButtonImg;

        _button.alpha = 1.0;

        _button.borderColor = 'rgb(235, 147, 32)';

        _button.borderWidth = 3;

        // Only show marker for the BACK button (last button)

        if (_buttonMarker) {

          if (_i2 === buttons.length - 1) {

            _buttonMarker.visible = true;

            // ensure marker is considered orange-dot for pulsing loop (we set isOrangeDot on backMarker earlier)

            try { animate(_buttonMarker, { alpha: _buttonMarker.alpha || 0 }, { alpha: 1 }, 200); } catch (e) {}

          } else {

            _buttonMarker.visible = false;

            _buttonMarker.alpha = 0;

          }

        }

        animateZoomIn(_button, buttonText, buttonOrigPos_.x, buttonOrigPos_.y, textOrigPos_.x, textOrigPos_.y);

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

        if (_buttonMarker) _buttonMarker.visible = false;

      }

    }

    prevButton = currentButton;

  }



  // --- updateValueText (keeps logic) ---



  function updateValueText(index) {

    var options = configOptions[index];

    var valueText = valueTexts[index];

    if (!options || !valueText) return;

    var key = options.key;

    if (options.type === 'toggle') {

      var value = currentConfig[key];

      try {

        valueText.url = value ? 'file:///assets/img/check_small_on.png' : 'file:///assets/img/check_small_off.png';

      } catch (e) {

        if (valueText && valueText.constructor && valueText.constructor.name === 'Text') valueText.text = value ? 'ON' : 'OFF';

      }

    } else {

      if (useImageText) {

        try { valueText.url = textImageBase + jbBehaviorImgKeys[currentConfig.jb_behavior] + '.png'; } catch (e) {}

      } else {

        try { valueText.text = jbBehaviorLabels[currentConfig.jb_behavior] || jbBehaviorLabels[0]; } catch (e) {}

      }

    }

  }



  // --- NEW: marker pulse (orange dot) ---



  var _markerPulseInterval = null;



  function startOrangeDotLoop() {



    if (_markerPulseInterval) try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {}

    var phase = 0;

    _markerPulseInterval = jsmaf.setInterval(function () {

      phase += 0.06;

      for (var iM = 0; iM < buttonMarkers.length; iM++) {

        var m = buttonMarkers[iM];

        if (!m) continue;

        if (m.isOrangeDot) {

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



  // --- NEW: logo loop (gentle bob + background parallax) ---



  var _logoAnimInterval = null;



  function startLogoLoop() {

    var phase = 0;

    if (_logoAnimInterval) try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}

    _logoAnimInterval = jsmaf.setInterval(function () {

      phase += 0.02;

      var baseY = 0;

      logo.y = baseY + Math.sin(phase) * 6;

      logo.scaleX = 0.99 + Math.sin(phase * 0.9) * 0.01;

      logo.scaleY = logo.scaleX;

      if (background) { background.x = background._baseX + Math.sin(phase * 0.4) * 6; }

    }, 16);

    _intervals.push(_logoAnimInterval);

  }



  // --- NEW: button idle subtle movement (new addition) ---

  var _buttonIdleInterval = null;

  function startButtonIdleLoop() {

    try {

      if (typeof _buttonIdleInterval !== 'undefined' && _buttonIdleInterval) try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {}

      var phase = 0;

      _buttonIdleInterval = jsmaf.setInterval(function () {

        phase += 0.03;

        for (var iB = 0; iB < buttons.length; iB++) {

          try {

            var b = buttons[iB];

            var t = buttonTexts[iB];

            if (!b) continue;

            var base = buttonOrigPos[iB] || { x: b.x, y: b.y };

            var offset = (iB % 7) * 0.9;

            var p = phase + offset;

            var isSelected = (iB === currentButton);

            var ampX = isSelected ? 6 : 3;

            var ampY = isSelected ? 4 : 2;

            var breath = isSelected ? 0.015 : 0.008;

            var speed = isSelected ? 1.1 : 1.0;

            try {

              b.x = base.x + Math.sin(p * 0.9 * speed) * ampX;

              b.y = base.y + Math.sin(p * 0.6 * speed) * ampY;

              var sx = 1 + Math.sin(p * 1.1 * speed) * breath;

              var sy = 1 - Math.sin(p * 1.1 * speed) * breath * 0.5;

              b.scaleX = sx; b.scaleY = sy;

              if (t) {

                // Respect whether the text is centered (Back button) or left-aligned

                if (t._centered) {

                  t.x = Math.round(b.x + buttonWidth / 2 - 20);

                } else {

                  t.x = Math.round(b.x + 30); // keep consistent left padding

                }

                t.y = Math.round(b.y + (buttonHeight / 2 - 12));

              }

            } catch (e) {}

          } catch (e) {}

        }

      }, 16);

      _intervals.push(_buttonIdleInterval);

    } catch (e) { log('startButtonIdleLoop error: ' + (e.message || e)); }

  }



  // --- entrance (background, logo, buttons) ---



  function entrance() {

    animate(background, { alpha: 0 }, { alpha: 1 }, 500);

    animate(logo, { alpha: 0, scaleX: 0.95, scaleY: 0.95 }, { alpha: 1, scaleX: 1.0, scaleY: 1.0 }, 520);

    if (typeof title !== 'undefined') animate(title, { alpha: 0 }, { alpha: 1 }, 540);

    if (typeof _title !== 'undefined') animate(_title, { alpha: 0 }, { alpha: 1 }, 540);



    // buttons and value visuals animate in staggered

    for (var bidx = 0; bidx < buttons.length; bidx++) {

      (function (idx) {

        var b = buttons[idx];

        var t = buttonTexts[idx];

        var vt = (idx < valueTexts.length) ? valueTexts[idx] : null;

        var delay = 140 + idx * 80;

        jsmaf.setTimeout(function () {

          try { if (b) animate(b, { alpha: 0, y: b.y + 20 }, { alpha: 1, y: b.y }, 380); } catch (e) {}

          try { if (t) animate(t, { alpha: 0, y: t.y + 20 }, { alpha: 1, y: t.y }, 380); } catch (e) {}

          try { if (vt) animate(vt, { alpha: 0, y: (vt.y || (b.y + 8)) + 20 }, { alpha: 1, y: vt.y || (b.y + 8) }, 380); } catch (e) {}

        }, delay);

      })(bidx);

    }



    // start loops after entrance

    jsmaf.setTimeout(function () {

      startOrangeDotLoop();

      startLogoLoop();

      startButtonIdleLoop(); // <-- start the button idle animation loop

    }, 900);

  }



  // --- update functions (keep existing logic) ---



  function saveConfig() {

    var configContent = 'const CONFIG = {\n';

    configContent += '    autolapse: ' + currentConfig.autolapse + ',\n';

    configContent += '    autopoop: ' + currentConfig.autopoop + ',\n';

    configContent += '    autoclose: ' + currentConfig.autoclose + ',\n';

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

        // don't spam error log on missing config first-run; keep original behavior but log lightly

        log('No config file found (first-run or missing) — using defaults.');

        // ensure visuals reflect defaults

        for (var ii = 0; ii < configOptions.length; ii++) {

          updateValueText(ii);

        }

        return;

      }

      try {

        eval(data || ''); // eslint-disable-line no-eval

        if (typeof CONFIG !== 'undefined') {

          currentConfig.autolapse = CONFIG.autolapse || false;

          currentConfig.autopoop = CONFIG.autopoop || false;

          currentConfig.autoclose = CONFIG.autoclose || false;

          currentConfig.jb_behavior = CONFIG.jb_behavior || 0;

          // Preserve user's payloads

          if (typeof payloads !== 'undefined' && Array.isArray(payloads)) {

            userPayloads = payloads.slice();

          }

          for (var _i4 = 0; _i4 < configOptions.length; _i4++) {

            updateValueText(_i4);

          }

          log('Config loaded successfully');

        }

      } catch (e) {

        log('ERROR: Failed to parse config: ' + e.message);

      }

    });

  }



  // --- user action handler (keeps your logic, only adds small click feedback) ---



  function handleButtonPress() {

    if (currentButton === buttons.length - 1) {

      log('Going back to main menu...');

      try {

        include('main-menu.js');

      } catch (e) {

        log('ERROR loading main-menu.js: ' + e.message);

      }

    } else if (currentButton < configOptions.length) {

      var option = configOptions[currentButton];

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

      }

      updateValueText(currentButton);

      // small click feedback animation (pulse)

      try {

        var btn = buttons[currentButton];

        if (btn) {

          animate(btn, { scaleX: btn.scaleX || 1, scaleY: btn.scaleY || 1 }, { scaleX: 0.94, scaleY: 0.94 }, 80, null, function () {

            animate(btn, { scaleX: 0.94 }, { scaleX: 1.06, scaleY: 1.06 }, 140, null, function () {

              animate(btn, { scaleX: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120);

            });

          });

        }

      } catch (e) {}

      saveConfig();

    }

  }



  // --- input handling (mouse + keyboard + gamepad) — added mouse support but logic unchanged ---



  jsmaf.onMouseMove = function (mx, my) {

    updateCursorPosition(mx, my);

    showCursor();

    for (var m = 0; m < buttons.length; m++) {

      var b = buttons[m];

      if (!b) continue;

      if (mx >= b.x && my >= b.y && mx <= b.x + b.width && my <= b.y + b.height) {

        if (currentButton !== m) { prevButton = currentButton; currentButton = m; updateHighlight(); }

        return;

      }

    }

  };

  jsmaf.onMouseDown = function (mx, my, btn) {

    updateCursorPosition(mx, my);

    showCursor();

    for (var n = 0; n < buttons.length; n++) {

      var bb = buttons[n];

      if (!bb) continue;

      if (mx >= bb.x && my >= bb.y && mx <= bb.x + bb.width && my <= bb.y + bb.height) {

        currentButton = n; updateHighlight(); handleButtonPress(); return;

      }

    }

  };



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

      log('Going back to main menu...');

      try {

        include('main-menu.js');

      } catch (e) {

        log('ERROR loading main-menu.js: ' + e.message);

      }

    }

  };



  // --- PS controller handling (non-destructive addition, right stick moves cursor if desired) ---



  (function startGamepadMouse() {

    var gpPollInterval = null;

    var gpSensitivity = 12.0;

    var gpDeadzone = 0.15;

    var lastGpButtons = [];

    var gpPollStepMs = 16;

    try {

      gpPollInterval = jsmaf.setInterval(function () {

        try {

          if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;

          var gps = navigator.getGamepads();

          if (!gps) return;

          var gp = gps[0];

          if (!gp) return;



          var ax = (gp.axes && gp.axes.length > 2) ? gp.axes[2] : 0;

          var ay = (gp.axes && gp.axes.length > 3) ? gp.axes[3] : 0;

          ax = Math.abs(ax) < gpDeadzone ? 0 : ax;

          ay = Math.abs(ay) < gpDeadzone ? 0 : ay;

          var dt = gpPollStepMs / 1000.0;

          var dx = ax * gpSensitivity * dt * 60;

          var dy = ay * gpSensitivity * dt * 60;

          virtualMouse.x += dx;

          virtualMouse.y += dy;

          virtualMouse.x = Math.max(0, Math.min(1920, virtualMouse.x));

          virtualMouse.y = Math.max(0, Math.min(1080, virtualMouse.y));

          updateCursorPosition(Math.round(virtualMouse.x), Math.round(virtualMouse.y));

          showCursor();

          try { jsmaf.onMouseMove(Math.round(virtualMouse.x), Math.round(virtualMouse.y)); } catch (e) {}



          var btnIndex = 0;

          var pressed = false;

          if (gp.buttons && gp.buttons.length > btnIndex) {

            var b = gp.buttons[btnIndex];

            pressed = !!(b && (b.pressed || b.value > 0.5));

          }

          if (lastGpButtons[btnIndex] === undefined) lastGpButtons[btnIndex] = false;

          if (pressed && !lastGpButtons[btnIndex]) {

            try { jsmaf.onMouseDown(Math.round(virtualMouse.x), Math.round(virtualMouse.y), 0); } catch (e) {}

          }

          lastGpButtons[btnIndex] = pressed;

        } catch (e) {}

      }, gpPollStepMs);

      _intervals.push(gpPollInterval);

    } catch (e) {}

  })();



  // --- initialization: entrance and update visuals ---



  for (var vi = 0; vi < valueTexts.length; vi++) {

    try { valueTexts[vi].alpha = 0; } catch (e) {}

  }



  // ensure values set from defaults

  for (var ui = 0; ui < configOptions.length; ui++) updateValueText(ui);



  // start entrance animations and loops

  entrance();



  // ensure highlight after entrance

  jsmaf.setTimeout(function () { enforceTextWhite(); updateHighlight(); }, 700);



  // --- enforce text style helper ---



  function enforceTextWhite() {

    for (var ti = 0; ti < buttonTexts.length; ti++) {

      try {

        var t = buttonTexts[ti];

        if (t && typeof t === 'object' && t.constructor && t.constructor.name === 'Text') {

          t.style = 'white';

        }

      } catch (e) {}

    }

    try { if (typeof _title !== 'undefined' && _title && _title.constructor && _title.constructor.name === 'Text') _title.style = 'title'; } catch (e) {}

  }



  // --- lifecycle hooks: cleanup intervals + loops on hide/exit ---



  try { jsmaf.onHide = function () { _clearAllIntervals(); try { if (_markerPulseInterval) jsmaf.clearInterval(_markerPulseInterval); } catch (e) {} try { if (_logoAnimInterval) jsmaf.clearInterval(_logoAnimInterval); } catch (e) {} }; } catch (e) {}



  try { jsmaf.onShow = function () { startOrangeDotLoop(); startLogoLoop(); startButtonIdleLoop(); enforceTextWhite(); updateHighlight(); }; } catch (e) {}



  jsmaf.onExit = function () {

    try { _clearAllIntervals(); } catch (e) {}

    try { if (mouseHideTimeout) jsmaf.clearTimeout(mouseHideTimeout); } catch (e) {}

    log(lang.configLoaded);

  };



  // --- final: load config and show loaded log (unchanged behavior) ---



  updateHighlight();

  loadConfig();

  log(lang.configLoaded);



})();

