(function () {
  // ==================== LOAD DEPENDENCIES ====================
  if (typeof libc_addr === 'undefined') {
    include('userland.js');
  }
  if (typeof lang === 'undefined') {
    include('languages.js');
  }

  // ==================== CONSTANTS ====================
  var SCREEN_WIDTH = 1920;
  var SCREEN_HEIGHT = 1080;
  var BASE_PATH = 'file:///../download0/';
  var IMG_PATH = BASE_PATH + 'themes/apollo/static/images/';
  var SONG_PATH = BASE_PATH + 'themes/apollo/song/bg.wav';

  var APOLLO_VERSION = '0.2.0';

  // ==================== KEY CODES ====================
  var KEY_UP = 4, KEY_DOWN = 6, KEY_LEFT = 7, KEY_RIGHT = 5;
  var KEY_CROSS = 13, KEY_CIRCLE = 14, KEY_L1 = 10, KEY_ESC = 41;
  var BACK_KEY = jsmaf.circleIsAdvanceButton ? KEY_CIRCLE : KEY_CROSS;

  // ==================== GLOBAL STATE ====================
  var state = 'ABOUT';
  var memorialInterval = null;
  var sx = SCREEN_WIDTH;

  // UI elements
  var background, headerIcon, titleText, versionText;
  var logoText, ps4VersionText;
  var creditNames = [], creditValues = [];
  var helpImage, memorialLine, smallLeonLuna;
  var leonLunaImage, memorialHelp;
  var sinChars = [];
  var backHint;

  // Music (local reference)
  var bgm = null;

  // ==================== STYLES ====================
  new Style({ name: 'headerTitle', color: 'white', size: 48, align: 'left' });
  new Style({ name: 'version', color: 'rgb(180,180,180)', size: 32, align: 'left' });
  new Style({ name: 'ps4Version', color: 'white', size: 36, align: 'center' });
  new Style({ name: 'creditLeft', color: 'white', size: 28, align: 'right' });
  new Style({ name: 'creditRight', color: 'white', size: 28, align: 'left' });
  new Style({ name: 'memorialText', color: 'white', size: 64, align: 'left' });

  // ==================== CREDIT STRINGS ====================
  var menu_about_strings = [
    'PsVue Theme', 'credits:',
    'Mexrldev', 'Developer',
    '', '',
    'PsVue After Free', 'credits:',
    'ufm42', 'Userland Exploit',
    'c0w-ar', 'Lapse and NetCtrl porting',
    'earthonion', 'Original UI, initial JS injection, NetCtrl Porting',
    'HelloYunho', 'TypeScript port',
    'Gezine', 'Local JS method and PSN bypass research',
    'D-Link Turtle', 'General support for userland exploition',
    'Dr.YenYen', 'Extensive testing, end-user support/ideas',
    'TheFl0w', 'NetCtrl',
    'abc', 'lapse',
    '', '',
    'PS4', 'credits:',
    'Bucanero', 'Developer',
    '', '',
    'PS3', 'credits:',
    'Berion', 'GUI design',
    'Dnawrkshp', 'Artemis code',
    'aldostools', 'Bruteforce Save Data'
  ];

  // ==================== UI BUILD ====================
  jsmaf.root.children.length = 0;

  // Background
  background = new Image({
    url: IMG_PATH + 'apollo.jpg',
    x: 0, y: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT
  });
  jsmaf.root.children.push(background);

  // Header
  headerIcon = new Image({
    url: IMG_PATH + 'cat_about.png',
    x: 50, y: 50, width: 100, height: 100
  });
  jsmaf.root.children.push(headerIcon);

  titleText = new jsmaf.Text();
  titleText.text = (lang && lang.about) ? lang.about : 'About';
  titleText.style = 'headerTitle';
  titleText.x = 170;
  titleText.y = 60;
  jsmaf.root.children.push(titleText);

  versionText = new jsmaf.Text();
  versionText.text = 'v' + APOLLO_VERSION;
  versionText.style = 'version';
  versionText.x = 170;
  versionText.y = 110;
  jsmaf.root.children.push(versionText);

  // logo_text (kept as-is)
  logoText = new Image({
    url: IMG_PATH + 'logo_text.png',
    x: (SCREEN_WIDTH - 600) / 2, y: 110,
    width: 600, height: 100
  });
  jsmaf.root.children.push(logoText);

  // ==================== HELP IMAGE (start SMALL, expand to final) ====================
  var HELP_FINAL_X = 0;
  var HELP_FINAL_Y = 200;
  var HELP_FINAL_WIDTH = SCREEN_WIDTH;
  var HELP_FINAL_HEIGHT = 750;

  // start small (scale)
  var HELP_START_SCALE = 0.20; // 20% of final size to start from
  var helpStartW = Math.max(64, Math.floor(HELP_FINAL_WIDTH * HELP_START_SCALE));
  var helpStartH = Math.max(64, Math.floor(HELP_FINAL_HEIGHT * HELP_START_SCALE));
  var helpStartX = Math.floor((SCREEN_WIDTH - helpStartW) / 2); // start centered
  var helpStartY = HELP_FINAL_Y + Math.floor((HELP_FINAL_HEIGHT - helpStartH) / 2);

  helpImage = new Image({
    url: IMG_PATH + 'help.png',
    x: helpStartX, y: helpStartY,
    width: helpStartW, height: helpStartH,
    alpha: 1.0,
    visible: true
  });
  jsmaf.root.children.push(helpImage);

  // PlayStation Vue Version text
  var centerX = SCREEN_WIDTH / 2;
  var colGap = 100;
  ps4VersionText = new jsmaf.Text();
  ps4VersionText.text = 'PlayStation Vue Version';
  ps4VersionText.style = 'ps4Version';
  ps4VersionText.x = centerX - colGap;
  ps4VersionText.y = 220;
  jsmaf.root.children.push(ps4VersionText);

  // ==================== CENTERED CREDITS BLOCK ====================
  var lineSpacing = 30;
  var headerBottom = 200;
  var memorialTop = 850;
  var contentHeight = memorialTop - headerBottom;
  var numRows = menu_about_strings.length / 2;
  var blockHeight = numRows * lineSpacing;
  var startY = headerBottom + (contentHeight - blockHeight) / 2 + 60;

  for (var i = 0; i < menu_about_strings.length; i += 2) {
    var y = startY + (i / 2) * lineSpacing;

    var leftText = new jsmaf.Text();
    leftText.text = menu_about_strings[i];
    leftText.style = 'creditLeft';
    leftText.x = centerX - colGap;
    leftText.y = y;
    leftText.alpha = 0.0; // hidden until fade-in
    leftText.visible = true; // loaded so texture ready
    jsmaf.root.children.push(leftText);
    creditNames.push(leftText);

    var rightText = new jsmaf.Text();
    rightText.text = menu_about_strings[i + 1];
    rightText.style = 'creditRight';
    rightText.x = centerX + colGap;
    rightText.y = y;
    rightText.alpha = 0.0;
    rightText.visible = true;
    jsmaf.root.children.push(rightText);
    creditValues.push(rightText);
  }

  // ==================== MEMORIAL SECTION ====================
  var smallImageWidth = 300;
  var smallImageHeight = 169;
  var imageX = 50;
  var imageY = 740;
  smallLeonLuna = new Image({
    url: IMG_PATH + 'leon_luna.jpg',
    x: imageX,
    y: imageY,
    width: smallImageWidth,
    height: smallImageHeight,
    visible: true,
    alpha: 0.0 // hidden until fade-in
  });
  jsmaf.root.children.push(smallLeonLuna);

  var textX = imageX;
  var textY = imageY - 40;
  memorialLine = new jsmaf.Text();
  memorialLine.text = 'in memory of Leon & Luna';
  memorialLine.style = 'version';
  memorialLine.x = textX;
  memorialLine.y = textY;
  memorialLine.alpha = 0.0;
  memorialLine.visible = true;
  jsmaf.root.children.push(memorialLine);

  // ==================== MEMORIAL SCREEN ELEMENTS (kept) ====================
  leonLunaImage = new Image({
    url: IMG_PATH + 'leon_luna.jpg',
    x: 0, y: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT,
    visible: false
  });
  jsmaf.root.children.push(leonLunaImage);

  memorialHelp = new Image({
    url: IMG_PATH + 'help.png',
    x: 0, y: 200,
    width: SCREEN_WIDTH, height: 750,
    visible: false
  });
  jsmaf.root.children.push(memorialHelp);

  // Sine animation characters (hidden until memorial)
  var memorialText = "... in memory of Leon & Luna - may your days be filled with eternal joy ...";
  for (var k = 0; k < memorialText.length; k++) {
    var ch = new jsmaf.Text();
    ch.text = memorialText[k];
    ch.style = 'memorialText';
    ch.visible = false;
    jsmaf.root.children.push(ch);
    sinChars.push(ch);
  }

  // Back hint
  backHint = new jsmaf.Text();
  backHint.text = jsmaf.circleIsAdvanceButton ? 'X to go back' : 'O to go back';
  backHint.style = 'version';
  backHint.x = 20;
  backHint.y = SCREEN_HEIGHT - 60;
  jsmaf.root.children.push(backHint);

  // ==================== GLOBAL BGM STOPPER (robust for cross-menu) ====================
  // create a global stopper once (keeps function across menu reloads)
  (function createGlobalStopper() {
    try {
      if (!window.__apollo_stop_all_bgm) {
        window.__apollo_stop_all_bgm = function () {
          try { if (window._apollo_bgm && window._apollo_bgm.stop) { try { window._apollo_bgm.stop(); } catch(e) {} } } catch(e) {}
          try { if (window.bgm && window.bgm.stop) { try { window.bgm.stop(); } catch(e) {} } } catch(e) {}
          try { if (bgm && bgm.stop) { try { bgm.stop(); } catch(e) {} } } catch(e) {}
          // clear global references but keep stopper function itself
          try { window._apollo_bgm = null; } catch (e) {}
          try { window.bgm = null; } catch (e) {}
          try { bgm = null; } catch (e) {}
        };
      }
    } catch (e) {
      // ignore
    }
  })();

  // ==================== MUSIC FUNCTIONS (idempotent & robust) ====================
  function startMusic() {
    // stop any previously created apollo bgm instances first to avoid duplicates
    try { if (window.__apollo_stop_all_bgm) window.__apollo_stop_all_bgm(); } catch (e) {}

    try {
      // create new AudioClip and play looped
      bgm = new jsmaf.AudioClip();
      bgm.open(SONG_PATH);
      bgm.volume = 0.5;
      try { bgm.play(true); } catch (e) { /* ignore play errors */ }
      // export references so other modules can stop it
      try { window._apollo_bgm = bgm; window.bgm = bgm; } catch (e) {}
    } catch (e) {
      log('Error loading music: ' + (e && e.message ? e.message : e));
      bgm = null;
    }
  }

  function stopMusic() {
    // stop local and any global references but do not delete the global stopper function
    try { if (bgm && bgm.stop) { try { bgm.stop(); } catch (e) {} } } catch (e) {}
    try { if (window._apollo_bgm && window._apollo_bgm.stop) { try { window._apollo_bgm.stop(); } catch (e) {} } } catch (e) {}
    try { if (window.bgm && window.bgm.stop) { try { window.bgm.stop(); } catch (e) {} } } catch (e) {}
    try { window._apollo_bgm = null; } catch (e) {}
    try { window.bgm = null; } catch (e) {}
    bgm = null;
  }

  // ==================== MEMORIAL ANIMATION ====================
  function startMemorialAnimation() {
    if (memorialInterval) jsmaf.clearInterval(memorialInterval);
    sx = SCREEN_WIDTH;

    memorialInterval = jsmaf.setInterval(function () {
      var x = sx;
      for (var i = 0; i < sinChars.length; i++) {
        var ch = sinChars[i];
        if (!ch.visible) continue;

        var amp = Math.sin(x * 0.01) * 10;
        ch.y = 860 + amp;
        ch.x = x;
        x += 64;
      }
      sx += -4;
      if (sx + (sinChars.length * 64) < 0) {
        sx = SCREEN_WIDTH + 64;
      }
    }, 16);
  }

  function stopMemorialAnimation() {
    if (memorialInterval) {
      jsmaf.clearInterval(memorialInterval);
      memorialInterval = null;
    }
  }

  // ==================== VIEW SWITCHING ====================
  function showNormal() {
    state = 'ABOUT';
    logoText.visible = true;
    ps4VersionText.visible = true;
    // credits & memorial remain present but their alphas controlled by animation
    helpImage.visible = true;
    smallLeonLuna.visible = true;
    memorialLine.visible = true;

    leonLunaImage.visible = false;
    memorialHelp.visible = false;
    sinChars.forEach(ch => ch.visible = false);

    stopMemorialAnimation();
  }

  function showMemorial() {
    state = 'MEMORIAL';
    logoText.visible = false;
    ps4VersionText.visible = false;
    creditNames.forEach(t => t.visible = false);
    creditValues.forEach(t => t.visible = false);
    helpImage.visible = false;
    smallLeonLuna.visible = false;
    memorialLine.visible = false;

    leonLunaImage.visible = true;
    memorialHelp.visible = true;
    sinChars.forEach(ch => ch.visible = true);

    startMemorialAnimation();
  }

  // ==================== GO BACK TO MAIN MENU ====================
  function goBack() {
    // stop music and clear global audio refs so the main menu can start fresh without conflicts.
    try { if (window.__apollo_stop_all_bgm) window.__apollo_stop_all_bgm(); } catch (e) {}
    stopMusic();
    stopMemorialAnimation();

    // small delay before loading main to give the platform a moment to tear down audio resources
    var theme = 'default';
    if (typeof CONFIG !== 'undefined' && CONFIG.theme) {
      theme = CONFIG.theme;
    }
    jsmaf.setTimeout(function () {
      try {
        include('themes/' + theme + '/main.js');
      } catch (e) {
        log('ERROR loading main menu: ' + (e && e.message ? e.message : e));
        try { include('themes/default/main.js'); } catch (e2) {}
      }
    }, 80);
  }

  // ==================== KEYBOARD HANDLER ====================
  jsmaf.onKeyDown = function (keyCode) {
    if (keyCode === BACK_KEY || keyCode === KEY_ESC) {
      goBack();
    }
    else if (keyCode === KEY_L1) {
      if (state === 'ABOUT') {
        showMemorial();
      } else {
        showNormal();
      }
    }
  };

  // ==================== WHITE FADE (1.5s) ====================
  var whiteOverlay = new Image({
    url: IMG_PATH + 'white.png',
    x: 0,
    y: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alpha: 1.0,
    visible: true
  });
  jsmaf.root.children.push(whiteOverlay);

  var whiteFadeInterval = null;
  function startWhiteFade() {
    var duration = 1500; // 1.5 seconds
    var start = Date.now();
    if (whiteFadeInterval) jsmaf.clearInterval(whiteFadeInterval);
    whiteFadeInterval = jsmaf.setInterval(function() {
      var elapsed = Date.now() - start;
      var progress = elapsed / duration;
      if (progress >= 1) {
        whiteOverlay.alpha = 0.0;
        whiteOverlay.visible = false;
        var idx = jsmaf.root.children.indexOf(whiteOverlay);
        if (idx !== -1) jsmaf.root.children.splice(idx, 1);
        jsmaf.clearInterval(whiteFadeInterval);
        whiteFadeInterval = null;
      } else {
        whiteOverlay.alpha = 1.0 - progress;
      }
    }, 16);
  }

  // ==================== HELP IMAGE EXPAND ANIMATION ====================
  var helpExpandInterval = null;
  function startHelpExpand(onComplete) {
    var duration = 800; // expand duration in ms
    var start = Date.now();

    var sx0 = helpImage.x, sy0 = helpImage.y, sw0 = helpImage.width, sh0 = helpImage.height;
    var tx = HELP_FINAL_X, ty = HELP_FINAL_Y, tw = HELP_FINAL_WIDTH, th = HELP_FINAL_HEIGHT;

    if (helpExpandInterval) jsmaf.clearInterval(helpExpandInterval);

    helpExpandInterval = jsmaf.setInterval(function() {
      var t = Math.min(1, (Date.now() - start) / duration);
      // easeOutCubic
      var p = 1 - Math.pow(1 - t, 3);

      // interpolate bounds
      var newW = Math.round(sw0 + (tw - sw0) * p);
      var newH = Math.round(sh0 + (th - sh0) * p);
      // center scaling so it appears to grow from center to final position
      var centerStartX = sx0 + sw0 / 2;
      var centerStartY = sy0 + sh0 / 2;
      var centerTargetX = tx + tw / 2;
      var centerTargetY = ty + th / 2;
      var centerX = centerStartX + (centerTargetX - centerStartX) * p;
      var centerY = centerStartY + (centerTargetY - centerStartY) * p;
      var newX = Math.round(centerX - newW / 2);
      var newY = Math.round(centerY - newH / 2);

      helpImage.x = newX;
      helpImage.y = newY;
      helpImage.width = newW;
      helpImage.height = newH;

      if (t >= 1) {
        jsmaf.clearInterval(helpExpandInterval);
        helpExpandInterval = null;
        // ensure exact final
        helpImage.x = tx;
        helpImage.y = ty;
        helpImage.width = tw;
        helpImage.height = th;
        if (typeof onComplete === 'function') onComplete();
      }
    }, 16);
  }

  // ==================== CREDITS & MEMORIAL FADE-IN (2s) ====================
  var creditsFadeInterval = null;
  function fadeInCreditsAndMemorial(durationMs) {
    // elements to fade: creditNames, creditValues, memorialLine, smallLeonLuna
    var start = Date.now();
    if (creditsFadeInterval) jsmaf.clearInterval(creditsFadeInterval);
    creditsFadeInterval = jsmaf.setInterval(function() {
      var t = Math.min(1, (Date.now() - start) / durationMs);
      // slight ease-in
      var p = Math.pow(t, 0.9);

      for (var i = 0; i < creditNames.length; i++) {
        creditNames[i].alpha = p;
      }
      for (var j = 0; j < creditValues.length; j++) {
        creditValues[j].alpha = p;
      }
      memorialLine.alpha = p;
      smallLeonLuna.alpha = p;

      if (t >= 1) {
        jsmaf.clearInterval(creditsFadeInterval);
        creditsFadeInterval = null;
        // ensure final alphas
        for (var k = 0; k < creditNames.length; k++) creditNames[k].alpha = 1.0;
        for (var m = 0; m < creditValues.length; m++) creditValues[m].alpha = 1.0;
        memorialLine.alpha = 1.0;
        smallLeonLuna.alpha = 1.0;
      }
    }, 16);
  }

  // ==================== INIT SEQUENCE ====================
  showNormal();

  // start white fade (1.5s) and simultaneously expand helpImage.
  // After expand completes, fade in credits & memorial for 2s.
  startWhiteFade();
  startHelpExpand(function() {
    fadeInCreditsAndMemorial(2000);
  });

  // Start music using robust global pattern so re-enter and exit across menus behave correctly
  startMusic();

  log('About menu loaded with animations and robust music handling');
})();
