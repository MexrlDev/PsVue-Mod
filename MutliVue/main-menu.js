//hello



(function () {



  include('languages.js');



  log(lang.loadingMainMenu);



  // small global flag used to stop callbacks once exit begins, stops animations in general

  var __appExiting = false;



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



  jsmaf.root.children.length = 0;



  new Style({ name: 'white', color: 'white', size: 24 });

  new Style({ name: 'title', color: 'white', size: 32 });



  // persistent audio if available (bgm) - open but DO NOT play until after buttons finish loading

  var audio = null;

  if (typeof CONFIG !== 'undefined' && CONFIG.music) {

    try {

      audio = new jsmaf.AudioClip();

      audio.volume = 0.5;

      audio.open('file://../download0/sfx/bgm.wav');

      // DO NOT auto-play here; will start after entrance completes and will seek to 1.5s

    } catch (e) {}

  }



  // --- Background + logo

  var background = new Image({

    url: 'file:///../download0/img/multiview_bg_VAF.png',

    x: 0,

    y: 0,

    width: 1920,

    height: 1080

  });

  background._baseX = background.x;

  jsmaf.root.children.push(background);



  var centerX = 960;

  var centerY = 540;

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

  var menuOptions = [{

    label: lang.jailbreak,

    script: 'loader.js',

    imgKey: 'jailbreak'

  }, {

    label: lang.payloadMenu,

    script: 'payload_host.js',

    imgKey: 'payloadMenu'

  }, {

    label: lang.config,

    script: 'config_ui.js',

    imgKey: 'config'

  }, {

    label: (typeof lang !== 'undefined' && lang.fileExplorer) ? lang.fileExplorer : 'File Explorer',

    script: 'file-explorer.js',

    imgKey: 'fileExplorer'

  }];



  var startY = 450;

  var buttonSpacing = 120;

  var buttonWidth = 400;

  var buttonHeight = 80;



  // defensive defaults

  if (typeof useImageText === 'undefined') useImageText = false;

  if (typeof textImageBase === 'undefined') textImageBase = '';



  // --- Layout config for two-column grid

  var smallGap = 10; // small gap between the two buttons in a row

  var pairTotalWidth = buttonWidth * 2 + smallGap;

  var pairStartX = centerX - pairTotalWidth / 2;



  // build two-column menu (2 buttons per row)

  for (var i = 0; i < menuOptions.length; i++) {

    var row = Math.floor(i / 2);

    var col = i % 2;

    var btnX = pairStartX + col * (buttonWidth + smallGap);

    var btnY = startY + row * buttonSpacing;



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

      url: 'file:///../download0/img/ad_pod_marker.png',

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


// button

  var menuRows = Math.ceil(menuOptions.length / 2);

  var trioY = startY + menuRows * buttonSpacing + 40; // reduced from +100 to +40



  var pairTotalWidth = buttonWidth * 2 + smallGap;

  var pairStartX = centerX - pairTotalWidth / 2;



  var fileEditorIndex = -1;

  var reloadAnimIndex = -1;

  var exitIndex = -1;



// messgae on left

  var fileEditorX = pairStartX;

  var fileEditorY = trioY;

  var fileEditorButton = new Image({

    url: normalButtonImg,

    x: fileEditorX,

    y: fileEditorY,

    width: buttonWidth,

    height: buttonHeight

  });

  fileEditorButton.alpha = 0;

  buttons.push(fileEditorButton);

  jsmaf.root.children.push(fileEditorButton);

  fileEditorIndex = buttons.length - 1;

  var fileEditorMarker = new Image({

    url: 'file:///../download0/img/ad_pod_marker.png',

    x: fileEditorX + buttonWidth - 50,

    y: fileEditorY + 35,

    width: 12,

    height: 12,

    visible: false

  });

  buttonMarkers.push(fileEditorMarker);

  jsmaf.root.children.push(fileEditorMarker);

  var MessageText;

  if (useImageText) {

    MessageText = new Image({

      url: textImageBase + 'Message.png',

      x: fileEditorX + 20,

      y: fileEditorY + 15,

      width: 300,

      height: 50

    });

  } else {

    MessageText = new jsmaf.Text();

    MessageText.text = 'Message';

    MessageText.x = fileEditorX + buttonWidth / 2 - 60;

    MessageText.y = fileEditorY + buttonHeight / 2 - 12;

    MessageText.style = 'white';

  }

  buttonTexts.push(MessageText);

  jsmaf.root.children.push(MessageText);

  buttonOrigPos.push({ x: fileEditorX, y: fileEditorY });

  textOrigPos.push({ x: MessageText.x, y: MessageText.y });

  idleOffsets.push({ x: 0, y: 0 });

  idlePhases.push(Math.random() * Math.PI * 2);

  clickAnimHandles.push(null);

  idleAnimHandles.push(null);

  valueTexts.push(null);



  // Reload-Anim 

  var reloadAnimX = pairStartX + buttonWidth + smallGap;

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

  reloadAnimIndex = buttons.length - 1;

  var reloadAnimMarker = new Image({

    url: 'file:///../download0/img/ad_pod_marker.png',

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



  // Exit (kept in code but hidden). Place it off to the right so it doesn't affect the centered pair.

  var exitX = pairStartX + pairTotalWidth + 60; // offset to the right of the centered pair

  var exitY = trioY;

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

  exitIndex = buttons.length - 1;

  var exitMarker = new Image({

    url: 'file:///../download0/img/ad_pod_marker.png',

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



  // Hide Exit visuals from UI but keep the object and index for logic

  var HIDDEN_UI_INDEX_EXIT = -1;

  try {

    HIDDEN_UI_INDEX_EXIT = exitIndex;

    if (exitButton) { exitButton.visible = false; exitButton.alpha = 0; }

    if (exitText) { exitText.visible = false; exitText.alpha = 0; }

    if (exitMarker) { exitMarker.visible = false; exitMarker.alpha = 0; }

  } catch (e) {}



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

    // defensive: if exiting, don't schedule new animation

    if (__appExiting) { if (done) try { done(); } catch (_) {} return null; }



    var elapsed = 0; var step = 16;

    var id = _setInterval(function () {

      // if exit started, stop this interval immediately

      if (__appExiting) {

        try { jsmaf.clearInterval(id); } catch (ee) {}

        if (done) try { done(); } catch (ee2) {}

        return;

      }

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



  // --- BGM fade helpers (kept; used elsewhere if desired)

  function fadeOutBgm(durationMs, done) {

    if (!audio) { if (done) done(); return; }

    try {

      var steps = Math.max(1, Math.floor(durationMs / 50));

      var current = (typeof audio.volume === 'number') ? audio.volume : 0.5;

      var step = 0;

      if (_bgmFadeInterval) try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}

      _bgmFadeInterval = jsmaf.setInterval(function () {

        step++;

        try {

          var v = Math.max(0, current * (1 - step / steps));

          audio.volume = v;

        } catch (e) {}

        if (step >= steps) {

          try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}

          _bgmFadeInterval = null;

          try { if (typeof audio.stop === 'function') audio.stop(); } catch (e) {}

          try { if (typeof audio.pause === 'function') audio.pause(); } catch (e) {}

          if (done) done();

        }

      }, 50);

      _intervals.push(_bgmFadeInterval);

    } catch (e) { if (done) done(); }

  }



  function fadeInBgm(durationMs, targetVolume, done) {

    if (!audio) {

      try {

        audio = new jsmaf.AudioClip();

        audio.open('file://../download0/sfx/bgm.wav');

        audio.volume = 0;

      } catch (e) { if (done) done(); return; }

    }

    try {

      var steps = Math.max(1, Math.floor(durationMs / 50));

      var start = (typeof audio.volume === 'number') ? audio.volume : 0;

      targetVolume = (typeof targetVolume === 'number') ? targetVolume : 0.5;

      var step = 0;

      try { if (typeof audio.play === 'function') audio.play(); } catch (e) {}

      if (_bgmFadeInterval) try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}

      _bgmFadeInterval = jsmaf.setInterval(function () {

        step++;

        try {

          var v = start + (targetVolume - start) * (step / steps);

          audio.volume = Math.max(0, Math.min(targetVolume, v));

        } catch (e) {}

        if (step >= steps) {

          try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}

          _bgmFadeInterval = null;

          if (done) done();

        }

      }, 50);

      _intervals.push(_bgmFadeInterval);

    } catch (e) { if (done) done(); }

  }



  // --- Idle breathing loop (buttons + text move together)

  function startButtonIdleLoop() {

    try {

      if (_buttonIdleInterval) try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {}

      var phase = 0;

      _buttonIdleInterval = jsmaf.setInterval(function () {

        if (__appExiting) { try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {} _buttonIdleInterval = null; return; }

        phase += 0.04;

        for (var i = 0; i < buttons.length; i++) {

          try {

            // skip hidden exit index

            if (i === HIDDEN_UI_INDEX_EXIT) continue;



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

      if (__appExiting) { try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {} _markerPulseInterval = null; return; }

      phase += 0.06;

      for (var i = 0; i < buttonMarkers.length; i++) {

        // skip hidden exit index

        if (i === HIDDEN_UI_INDEX_EXIT) continue;

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



  // --- Logo gentle loop (parallax background)

  function startLogoLoop() {

    var phase = 0;

    if (_logoAnimInterval) try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}

    _logoAnimInterval = jsmaf.setInterval(function () {

      if (__appExiting) { try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {} _logoAnimInterval = null; return; }

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



  // --- Entrance animation (buttons, text, markers, valueTexts move together)

  // Modified: left buttons start off-screen left, right buttons start off-screen right,

  // then slide in toward their final positions while scaling up and fading in.

  var markerOrigPos = [];

  function entrance() {

    try {

      animate(background, { alpha: background.alpha || 0 }, { alpha: 1 }, 800);

      animate(logo, { alpha: logo.alpha || 0, scaleX: logo.scaleX || 0.95, scaleY: logo.scaleY || 0.95 }, { alpha: 1, scaleX: 1.0, scaleY: 1.0 }, 900);

    } catch (e) {}



    var btnDelayBase = 220;

    var btnDelayStep = 140;

    var btnDuration = 1200;



    // off-screen start X positions

    var offLeftX = -buttonWidth - 80;

    var offRightX = 1920 + 80;



    for (var idx = 0; idx < buttons.length; idx++) {

      (function (i) {

        var b = buttons[i]; var t = buttonTexts[i]; var m = buttonMarkers[i]; var v = valueTexts[i];

        var delay = btnDelayBase + i * btnDelayStep;



        (function (ii, cbDelay) {

          jsmaf.setTimeout(function () {

            if (__appExiting) return;



            // skip entrance animation for hidden exit index

            if (ii === HIDDEN_UI_INDEX_EXIT) {

              try {

                if (b) { b.visible = false; b.alpha = 0; }

                if (t) { t.visible = false; t.alpha = 0; }

                if (m) { m.visible = false; m.alpha = 0; }

              } catch (e) {}

              return;

            }



            try {

              var targetBtnPos = buttonOrigPos[ii] || { x: 0, y: 0 };

              var targetTextPos = textOrigPos[ii] || { x: 0, y: 0 };



              // Decide side by comparing final x to centerX: left-side -> start off left, right-side -> start off right

              var startX = (targetBtnPos.x < centerX) ? offLeftX : offRightX;



              // Prepare initial states for "meet in the middle" slide-in

              if (b) {

                b.alpha = 0;

                // start off-screen horizontally & slightly lower vertically for a gentle lift

                b.x = startX;

                b.y = (targetBtnPos.y || 0) + 40;

                b.scaleX = 0.6;

                b.scaleY = 0.6;

                // keep rotation neutral for a cleaner slide effect (no spin)

                try { b.rotation = 0; } catch (e) {}

              }



              if (t) {

                t.alpha = 0;

                // text mirrors button horizontal start so it slides with button

                t.x = startX + (buttonWidth / 2 - 60);

                t.y = (targetTextPos.y || 0) + 40;

                t.scaleX = 0.6;

                t.scaleY = 0.6;

              }



              if (v) {

                v.alpha = v.alpha || 1;

                v.scaleX = 0.6;

                v.scaleY = 0.6;

                v.y = (targetBtnPos.y ? targetBtnPos.y + 20 : 0) + 40;

                v.x = startX + 320;

              }



              if (m) {

                var mo = { x: (targetBtnPos.x ? targetBtnPos.x + buttonWidth - 50 : 0), y: (targetBtnPos.y ? targetBtnPos.y + 35 : 0) };

                markerOrigPos[ii] = mo;

                try { m.x = mo.x; m.y = mo.y + 40; } catch (e) {}

              }



              // animate button sliding in from side -> center

              animate(b,

                { alpha: 0, x: startX, y: (targetBtnPos.y || 0) + 40, scaleX: 0.6, scaleY: 0.6 },

                { alpha: 1, x: (targetBtnPos.x || 0), y: (targetBtnPos.y || 0), scaleX: 1.08, scaleY: 0.92 },

                btnDuration,

                null,

                function () {

                  // settle scale overshoot like before

                  animate(b, { scaleX: 1.08, scaleY: 0.92 }, { scaleX: 0.96, scaleY: 1.06 }, 160, null, function () {

                    animate(b, { scaleX: 0.96, scaleY: 1.06 }, { scaleX: 1.02, scaleY: 0.98 }, 140, null, function () {

                      animate(b, { scaleX: 1.02, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 120);

                    });

                  });

                }

              );



              // animate text sliding in with the button

              animate(t,

                { alpha: 0, x: (startX + (buttonWidth / 2 - 60)), y: (targetTextPos.y || 0) + 40, scaleX: 0.6, scaleY: 0.6 },

                { alpha: 1, x: (targetTextPos.x || 0), y: (targetTextPos.y || 0), scaleX: 1.02, scaleY: 0.98 },

                btnDuration + 80,

                null,

                function () {

                  animate(t, { scaleX: 1.02, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 160);

                }

              );



              if (v) {

                animate(v,

                  { scaleX: 0.6, scaleY: 0.6, x: startX + 320, y: (targetBtnPos.y ? targetBtnPos.y + 20 + 40 : 0) },

                  { scaleX: 1.0, scaleY: 1.0, x: (targetBtnPos.x || 0) + 320, y: (targetBtnPos.y ? targetBtnPos.y + 20 : 0) },

                  btnDuration + 80

                );

              }



              if (m) {

                animate(m,

                  { alpha: 0, y: (markerOrigPos[ii] ? markerOrigPos[ii].y + 40 : 0) },

                  { alpha: 1, y: (markerOrigPos[ii] ? markerOrigPos[ii].y : 0) },

                  btnDuration + 40

                );

              }



            } catch (e) {}

          }, cbDelay);

        })(i, delay);

      })(idx);

    }



    var totalButtons = buttons.length;

    var lastDelay = btnDelayBase + (Math.max(0, totalButtons - 1)) * btnDelayStep;

    var startAfter = lastDelay + btnDuration + 600;

    jsmaf.setTimeout(function () {

      if (__appExiting) return;

      startOrangeDotLoop();

      startLogoLoop();

      startButtonIdleLoop();



      // Start background music now that buttons and animations are loaded

      // Seek to 1.5 seconds into the track before playing so playback begins from 1.5s.

      try {

        if (audio) {

          try {

            if (typeof audio.setPosition === 'function') {

              audio.setPosition(1.5);

            } else if (typeof audio.seek === 'function') {

              audio.seek(1.5);

            } else if ('currentTime' in audio) {

              audio.currentTime = 1.5;

            }

          } catch (seekErr) {}

          try { if (typeof audio.play === 'function') audio.play(); } catch (playErr) {}

          try { audio.volume = 0.5; } catch (e) {}

        }

      } catch (e) {}

    }, startAfter);

  }



  // --- Zoom in/out (squishy) and click animations

  var zoomInInterval = null;

  var zoomOutInterval = null;



  function animateZoomIn(btn, text, btnOrigX, btnOrigY, textOrigX, textOrigY, valueObj) {

    if (zoomInInterval) try { jsmaf.clearInterval(zoomInInterval); } catch (e) {}

    if (__appExiting) return;

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

      if (__appExiting) { try { jsmaf.clearInterval(zoomInInterval); } catch (e) {} zoomInInterval = null; return; }

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

    if (zoomOutInterval) try { jsmaf.clearInterval(zoomOutInterval); } catch (e) {}

    if (__appExiting) return;

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

      if (__appExiting) { try { jsmaf.clearInterval(zoomOutInterval); } catch (e) {} zoomOutInterval = null; return; }

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



  // --- Click animation (shrink -> overshoot -> settle)

  var clickSfx = null;

  try { clickSfx = new jsmaf.AudioClip(); clickSfx.open('file://../download0/sfx/click.wav'); } catch (e) {}



  function animateClick(btn, txt, btnOrigX, btnOrigY, textOrigX, textOrigY, valueObj, done) {

    if (__appExiting) { if (done) try { done(); } catch (_) {} return; }

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

        if (__appExiting) return;

        animate(txt, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140);

        jsmaf.setTimeout(function () { if (!__appExiting) animate(txt, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120); }, 140);

      }, 80);

    }

    if (valueObj) {

      animate(valueObj, { scaleX: valueObj.scaleX || 1.0, scaleY: valueObj.scaleY || 1.0 }, { scaleX: 0.92, scaleY: 0.92 }, 80);

      jsmaf.setTimeout(function () {

        if (__appExiting) return;

        animate(valueObj, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140);

        jsmaf.setTimeout(function () { if (!__appExiting) animate(valueObj, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120); }, 140);

      }, 80);

    }

  }



  // --- Update highlight (wires zoom in/out and markers)

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

      // skip hidden exit index

      if (i === HIDDEN_UI_INDEX_EXIT) continue;



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

        _button.borderColor = 'rgb(53, 53, 53)';

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



  // --- Input handling: keep controls unchanged but ensure scrolling works like old script

  // Debounce to prevent rapid repeats

  var _inputLocked = false;

  var _inputLockMs = 160; // short lock to avoid double-steps



  function _lockInput() {

    _inputLocked = true;

    jsmaf.setTimeout(function () { _inputLocked = false; }, _inputLockMs);

  }



  // Wrap helper that skips hidden exit index

  function _advanceSelection(delta) {

    if (_inputLocked) return;

    var total = buttons.length;

    if (total === 0) return;

    var next = currentButton;

    for (var attempts = 0; attempts < total; attempts++) {

      next = (next + delta + total) % total;

      if (next === HIDDEN_UI_INDEX_EXIT) continue;

      break;

    }

    currentButton = next;

    updateHighlight();

    _lockInput();

  }



  // --- New: reload animations (buttons + dynamic logo) without reloading the entire app

  // Modified so Reload-Anim actually restarts the entrance animation like the app was just opened

  function reloadAnimations() {

    if (__appExiting) return;

    try {

      // stop loops & intervals

      _clearAllIntervals();



      // reset logo to base/restored position

      try {

        logo.x = _logoOriginal.x;

        logo.y = _logoOriginal.y;

        logo.width = _logoOriginal.width;

        logo.height = _logoOriginal.height;

        logo.scaleX = 1;

        logo.scaleY = 1;

        logoIdle.baseX = logo.x;

        logoIdle.baseY = logo.y;

        if (background) background.x = background._baseX;

      } catch (e) {}



      // compute off-screen positions like entrance

      var offLeftX = -buttonWidth - 80;

      var offRightX = 1920 + 80;



      // reset all buttons/text/markers to their entrance initial state (off-screen, small, invisible)

      for (var i = 0; i < buttons.length; i++) {

        try {

          if (i === HIDDEN_UI_INDEX_EXIT) {

            if (buttons[i]) { buttons[i].visible = false; buttons[i].alpha = 0; }

            if (buttonTexts[i]) { buttonTexts[i].visible = false; buttonTexts[i].alpha = 0; }

            if (buttonMarkers[i]) { buttonMarkers[i].visible = false; buttonMarkers[i].alpha = 0; }

            continue;

          }

          var b = buttons[i];

          var t = buttonTexts[i];

          var m = buttonMarkers[i];

          var target = buttonOrigPos[i] || { x: 0, y: 0 };

          var targetText = textOrigPos[i] || { x: 0, y: 0 };

          var startX = (target.x < centerX) ? offLeftX : offRightX;



          if (b) {

            b.visible = true;

            b.alpha = 0;

            b.scaleX = 0.6;

            b.scaleY = 0.6;

            b.x = startX;

            b.y = (target.y || 0) + 40;

            b.url = normalButtonImg;

            b.borderColor = 'transparent';

            b.borderWidth = 0;

          }

          if (t) {

            t.visible = true;

            t.alpha = 0;

            t.scaleX = 0.6;

            t.scaleY = 0.6;

            t.x = startX + (buttonWidth / 2 - 60);

            t.y = (targetText.y || 0) + 40;

            try { if (t.constructor && t.constructor.name === 'Text') t.style = 'white'; } catch (e) {}

          }

          if (m) {

            m.visible = false;

            m.alpha = 0;

            if (markerOrigPos[i]) { try { m.x = markerOrigPos[i].x; m.y = markerOrigPos[i].y + 40; } catch (ee) {} }

          }

          if (valueTexts[i]) {

            try { valueTexts[i].visible = true; valueTexts[i].alpha = 0; valueTexts[i].scaleX = 0.6; valueTexts[i].scaleY = 0.6; valueTexts[i].x = startX + 320; valueTexts[i].y = (target.y ? target.y + 20 + 40 : 0); } catch (ee) {}

          }

        } catch (e) {}

      }



      // make sure bgm is stopped/volume reset so entrance() will restart it

      try {

        if (audio) {

          try { if (typeof audio.stop === 'function') audio.stop(); } catch (e) {}

          try { if (typeof audio.pause === 'function') audio.pause(); } catch (e) {}

          try { audio.volume = 0; } catch (e) {}

        }

      } catch (e) {}



      // small feedback: pulse logo quickly so user sees reload

      try {

        animate(logo, { scaleX: 1.0, scaleY: 1.0 }, { scaleX: 1.06, scaleY: 1.06 }, 220, null, function () {

          animate(logo, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 220);

        });

      } catch (e) {}



      // restart the entrance (this will animate buttons from sides again)

      try {

        entrance();

      } catch (e) {}



    } catch (e) {

      try { log('reloadAnimations error: ' + e); } catch (ee) {}

    }

  }



  // Call the action for the current button (preserve your original behavior)

  function handleButtonPress() {

    // Play click anim

    try { animateClick(buttons[currentButton], buttonTexts[currentButton], buttonOrigPos[currentButton].x, buttonOrigPos[currentButton].y, textOrigPos[currentButton].x, textOrigPos[currentButton].y, valueTexts[currentButton]); } catch (e) {}



    // Special-case our added buttons

    try {

      if (currentButton === reloadAnimIndex) {

        // reload all animations & loops (will restart entrance)

        try { reloadAnimations(); } catch (e) { try { log('reloadAnimations failed: '+e); } catch (ee) {} }

        return;

      }

      if (currentButton === fileEditorIndex) {

        // open Message.js

        try {

          if (typeof include === 'function') {

            include('Message.js');

            return;

          } else if (typeof jsmaf !== 'undefined' && typeof jsmaf.loadScript === 'function') {

            jsmaf.loadScript('Message.js');

            return;

          } else {

            log('Would load script: Message.js');

            return;

          }

        } catch (e) {

          try { log('Error loading Message.js: ' + e); } catch (ee) {}

          return;

        }

      }

    } catch (e) {}



    // Load the script associated with the selected menu item

    try {

      if (menuOptions && menuOptions[currentButton] && menuOptions[currentButton].script) {

        var scriptToLoad = menuOptions[currentButton].script;

        try {

          // Use include if available in environment

          if (typeof include === 'function') {

            include(scriptToLoad);

          } else {

            // Fallback: attempt to load via jsmaf or other loader if present

            if (typeof jsmaf !== 'undefined' && typeof jsmaf.loadScript === 'function') {

              jsmaf.loadScript(scriptToLoad);

            } else {

              // If no loader is available, log the intended script

              log('Would load script: ' + scriptToLoad);

            }

          }

        } catch (incErr) {

          try { log('Error loading script ' + scriptToLoad + ': ' + incErr); } catch (e) {}

        }

      }

    } catch (e) {}

  }



  // Map key codes: 6/5 forward (down/right), 4/7 backward (up/left), 14 confirm

  jsmaf.onKeyDown = function (keyCode) {

    try {

      if (_inputLocked) return;



      // Forward: D-pad down/right

      if (keyCode === 6 || keyCode === 5) {

        _advanceSelection(1);

        return;

      }



      // Backward: D-pad up/left

      if (keyCode === 4 || keyCode === 7) {

        _advanceSelection(-1);

        return;

      }



      // Confirm/select

      if (keyCode === 14) {

        _lockInput();

        handleButtonPress();

        return;

      }



    } catch (e) {}

  };



  // --- STARTUP: show only big centered logo + intro.wav for exactly 5 seconds,

  // then load buttons and start normal animations + bgm.

  // This intro should only ever run once per script lifetime.

  var _introPlayed = false;



  // Save original logo properties so we can restore them after intro

  var _logoOriginal = { x: logo.x, y: logo.y, width: logo.width, height: logo.height };

  // Startup logo size (big, centered)

  var _startupLogoWidth = Math.round(logoWidth * 1.5);

  var _startupLogoHeight = Math.round(logoHeight * 1.5);



  // Intro audio clip

  var introSfx = null;

  try { introSfx = new jsmaf.AudioClip(); introSfx.open('file://../download0/sfx/intro.wav'); } catch (e) {}



  // Helper to hide all button-related visuals initially

  function _hideAllButtonsVisuals() {

    for (var i = 0; i < buttons.length; i++) {

      try {

        if (i === HIDDEN_UI_INDEX_EXIT) {

          if (buttons[i]) { buttons[i].visible = false; buttons[i].alpha = 0; }

          if (buttonTexts[i]) { buttonTexts[i].visible = false; buttonTexts[i].alpha = 0; }

          if (buttonMarkers[i]) { buttonMarkers[i].visible = false; buttonMarkers[i].alpha = 0; }

          continue;

        }

        if (buttons[i]) { buttons[i].visible = false; buttons[i].alpha = 0; }

        if (buttonTexts[i]) { buttonTexts[i].visible = false; buttonTexts[i].alpha = 0; }

        if (buttonMarkers[i]) { buttonMarkers[i].visible = false; buttonMarkers[i].alpha = 0; }

        if (valueTexts[i]) { valueTexts[i].visible = false; valueTexts[i].alpha = 0; }

      } catch (e) {}

    }

  }



  // Helper to show all button visuals (before entrance we set them visible so entrance anims run)

  function _showAllButtonsVisuals() {

    for (var i = 0; i < buttons.length; i++) {

      try {

        if (i === HIDDEN_UI_INDEX_EXIT) {

          if (buttons[i]) { buttons[i].visible = false; buttons[i].alpha = 0; }

          if (buttonTexts[i]) { buttonTexts[i].visible = false; buttonTexts[i].alpha = 0; }

          if (buttonMarkers[i]) { buttonMarkers[i].visible = false; buttonMarkers[i].alpha = 0; }

          continue;

        }

        if (buttons[i]) { buttons[i].visible = true; /* alpha will be animated by entrance */ }

        if (buttonTexts[i]) { buttonTexts[i].visible = true; }

        if (buttonMarkers[i]) { buttonMarkers[i].visible = true; buttonMarkers[i].alpha = 0; }

        if (valueTexts[i]) { valueTexts[i].visible = true; }

      } catch (e) {}

    }

  }



  // Main startup sequence: runs intro only once; subsequent calls skip it.

  function showLogoOnlyStartup() {

    try {

      // If intro already played, skip the 5s intro and show the main menu immediately.

      if (_introPlayed) {

        try {

          // restore logo to original size/position for entrance animation

          logo.width = _logoOriginal.width;

          logo.height = _logoOriginal.height;

          logo.x = _logoOriginal.x;

          logo.y = _logoOriginal.y;

          logoIdle.baseX = logo.x;

          logoIdle.baseY = logo.y;

        } catch (e) {}

        _showAllButtonsVisuals();

        entrance();

        return;

      }



      // Hide everything button-related

      _hideAllButtonsVisuals();



      // Position and scale logo to be big and centered

      logo.width = _startupLogoWidth;

      logo.height = _startupLogoHeight;

      logo.x = Math.round(centerX - logo.width / 2);

      logo.y = Math.round(centerY - logo.height / 2);

      logo.alpha = 1;

      logo.scaleX = 1;

      logo.scaleY = 1;



      // Update logoIdle base so logo loop (when started later) uses correct base

      logoIdle.baseX = logo.x;

      logoIdle.baseY = logo.y;



      // Play intro sound (if available)

      try { if (introSfx && typeof introSfx.play === 'function') introSfx.play(); } catch (e) {}



      // After exactly 5 seconds, stop intro, restore logo to original position/size, show buttons and run entrance

      jsmaf.setTimeout(function () {

        if (__appExiting) return;



        // stop intro if possible (some APIs may not support stop; attempt)

        try { if (introSfx && typeof introSfx.stop === 'function') introSfx.stop(); } catch (e) {}

        // release introSfx reference (prevent accidental reuse)

        try { introSfx = null; } catch (e) {}



        // mark intro as played so it never runs again in this script lifetime

        _introPlayed = true;



        // restore logo to original size/position for entrance animation

        logo.width = _logoOriginal.width;

        logo.height = _logoOriginal.height;

        logo.x = _logoOriginal.x;

        logo.y = _logoOriginal.y;



        // update idle base to the restored position (entrance will animate from here)

        logoIdle.baseX = logo.x;

        logoIdle.baseY = logo.y;



        // Make button visuals visible so entrance() can animate them in

        _showAllButtonsVisuals();



        // Start entrance sequence (this will also start logo loop, orange dot loop, and button idle loop after entrance)

        entrance();



        // DO NOT start audio here — it will be started inside entrance() after buttons finish loading

      }, 5000);



    } catch (e) {}

  }



  // --- Initialize visuals and start the intro

  try {

    // set initial visual defaults for buttons so entrance anims behave consistently

    for (var i = 0; i < buttons.length; i++) {

      try {

        if (i === HIDDEN_UI_INDEX_EXIT) continue;

        var b = buttons[i];

        var t = buttonTexts[i];

        if (b) { b.alpha = 0.7; b.url = normalButtonImg; b.scaleX = 1; b.scaleY = 1; }

        if (t) { t.scaleX = 1; t.scaleY = 1; }

      } catch (e) {}

    }



    // Kick off the logo-only intro then entrance (will only actually play once)

    showLogoOnlyStartup();

  } catch (e) {}



})();

