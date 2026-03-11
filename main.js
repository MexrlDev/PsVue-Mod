(function () {
  // ---------- Configuration ----------
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var CENTER_X = SCREEN_W / 2;
  var ASSET_PATH = 'file:///../download0/themes/Cheat Manger/data/';

// OFFSETS
  var LIST_OFFSET_X = 0;
  var LIST_OFFSET_Y = 100;
  
  var SUBTITLE_OFFSET_X = -100;
  var SUBTITLE_OFFSET_Y = 0;

  // Menu options
  var menuOptions = [
    { label: 'Start Jb',   script: 'loader.js',                                    icon: 'xmb' },
    { label: 'Cheat Menu', script: 'themes/Cheat Manger/payload_host.js',         icon: 'cht' },
    { label: 'Patches',    script: 'themes/Cheat Manger/patches.js',              icon: 'pat' },
    { label: 'Online DB',  script: 'themes/Cheat Manger/online_DB.js',            icon: 'onl' },
    { label: 'Options',    script: 'themes/Cheat Manger/config_ui.js',            icon: 'opt' },
    { label: 'About',      script: 'themes/Cheat Manger/about.js',                icon: 'abt' }
  ];

  // ---------- Global Variables ----------
  var currentButton = 0;
  var buttons = [];
  var buttonTexts = [];
  var escCount = 0;
  var inputEnabled = false;
  var fadeElements = [];
  var fadeInterval = null;
  var fadeStartTime = 0;
  var currentElapsed = 0;
  var currentT = 0;
  var currentDimFactor = 1.0;

  // char whatever
  var CHAR_WIDTH = 20;

  // Icon dimensions
  var iconW = 150;
  var iconH = 120;

  // Gap between icons
  var ICON_GAP = 50;

  // Animation timings
  var FADE_DURATION = 5000;
  var UNLOCK_TIME = 3000;
  var DIM_START = 2000;
  var DIM_END = 3000;

  // ---------- Styles ----------
  new Style({ name: 'subtitle', color: 'black', size: 56, bold: true });
  new Style({ name: 'iconLabel', color: 'black', size: 32, bold: true });

  // ---------- Audio ----------
  if (typeof jsmaf.bgm === 'undefined') {
    jsmaf.bgm = new jsmaf.AudioClip();
    jsmaf.bgm.volume = 0.5;
    jsmaf.bgm.open(ASSET_PATH + 'bg.wav');
  }
  var bgm = jsmaf.bgm;

  // ---------- Helper ----------
  function clearRoot() {
    jsmaf.root.children.length = 0;
  }

  // ---------- Update Button Alpha ----------
  function updateButtonAlphas() {
    if (currentElapsed < DIM_START) {
      currentDimFactor = 1.0;
    } else if (currentElapsed < DIM_END) {
      var progress = (currentElapsed - DIM_START) / (DIM_END - DIM_START);
      currentDimFactor = 1.0 - progress * 0.5;
    } else {
      currentDimFactor = 0.5;
    }

    for (var i = 0; i < buttons.length; i++) {
      var targetAlpha = currentT;
      if (i !== currentButton) {
        targetAlpha *= currentDimFactor;
      }
      buttons[i].alpha = targetAlpha;
      buttonTexts[i].alpha = targetAlpha;
    }
  }

  // ---------- Fade In ----------
  function startFadeIn() {
    fadeStartTime = Date.now();

    fadeInterval = jsmaf.setInterval(function() {
      var elapsed = Date.now() - fadeStartTime;

      currentElapsed = Math.min(elapsed, FADE_DURATION);
      currentT = currentElapsed / FADE_DURATION;

      for (var i = 0; i < fadeElements.length; i++) {
        fadeElements[i].alpha = currentT;
      }

      updateButtonAlphas();

      if (!inputEnabled && elapsed >= UNLOCK_TIME) {
        inputEnabled = true;
      }

      if (elapsed >= FADE_DURATION) {
        jsmaf.clearInterval(fadeInterval);
        fadeInterval = null;
        currentT = 1.0;
        currentElapsed = FADE_DURATION;
        updateButtonAlphas();
      }
    }, 16);
  }

  // ---------- Build Menu ----------
  function buildMenu() {
    clearRoot();

    // Background
    var bg = new Image({
      url: ASSET_PATH + 'bgimg.png',
      x: 0,
      y: 0,
      width: SCREEN_W,
      height: SCREEN_H
    });
    jsmaf.root.children.push(bg);

    // Logo
    var logoW = 484;
    var logoH = 154;
    var logoY = 240;
    var logo = new Image({
      url: ASSET_PATH + 'titlescr_logo.png',
      x: Math.round(CENTER_X - (logoW / 2)),
      y: logoY,
      width: logoW,
      height: logoH,
      alpha: 0
    });
    jsmaf.root.children.push(logo);
    fadeElements.push(logo);

    var subtitle = new jsmaf.Text();
    subtitle.text = 'PlayStation 4 Cheats Manger';
    subtitle.style = 'subtitle';

    var subtitleWidth = subtitle.text.length * CHAR_WIDTH;
    subtitle.x = Math.round(CENTER_X - (subtitleWidth / 2)) + SUBTITLE_OFFSET_X;
    subtitle.y = 452 + SUBTITLE_OFFSET_Y;   // base Y 452
    subtitle.alpha = 0;

    jsmaf.root.children.push(subtitle);
    fadeElements.push(subtitle);

    var baseIconY = subtitle.y + 90;

    var iconY = baseIconY + LIST_OFFSET_Y;

    var totalWidth = menuOptions.length * iconW + (menuOptions.length - 1) * ICON_GAP;
    var startX = Math.round((SCREEN_W - totalWidth) / 2);

    var iconStartX = startX + LIST_OFFSET_X;

    for (var i = 0; i < menuOptions.length; i++) {
      var iconX = iconStartX + i * (iconW + ICON_GAP);

      var icon = new Image({
        url: ASSET_PATH + 'titlescr_ico_' + menuOptions[i].icon + '.png',
        x: iconX,
        y: iconY,
        width: iconW,
        height: iconH,
        alpha: 0
      });
      buttons.push(icon);
      jsmaf.root.children.push(icon);
      fadeElements.push(icon);

      var lbl = new jsmaf.Text();
      lbl.text = menuOptions[i].label;
      lbl.style = 'iconLabel';
      lbl.alpha = 0;

      var textWidth = lbl.text.length * CHAR_WIDTH;
      var centerOfIcon = icon.x + (iconW / 2);
      lbl.x = Math.round(centerOfIcon - (textWidth / 2));
      lbl.y = icon.y + iconH + 34;

      buttonTexts.push(lbl);
      jsmaf.root.children.push(lbl);
      fadeElements.push(lbl);
    }
  }

  // ---------- Button Press ----------
  function handleButtonPress() {
    if (!inputEnabled) return;
    var selected = menuOptions[currentButton];
    if (!selected) return;

    log('Loading ' + selected.script + '...');
    try {
      include(selected.script);
    } catch (e) {
      log('ERROR loading ' + selected.script + ': ' + e.message);
      if (e.stack) log(e.stack);
    }
  }

  // ---------- Exit ----------
  function exitApplication() {
    log('Exiting...');
    if (jsmaf.bgm && jsmaf.bgm.stop) jsmaf.bgm.stop();

    try {
      if (typeof libc_addr === 'undefined') {
        include('userland.js');
      }
      fn.register(0x14, 'getpid', [], 'bigint');
      fn.register(0x25, 'kill', ['bigint', 'bigint'], 'bigint');
      var pid = fn.getpid();
      fn.kill(pid, new BigInt(0, 9));
    } catch (e) {
      log('ERROR during exit: ' + e.message);
    }
    jsmaf.exit();
  }

  // ---------- Controller ----------
  jsmaf.onKeyDown = function (keyCode) {
    if (!inputEnabled) return;

    if (keyCode === 7 || keyCode === 58) {
      currentButton = (currentButton - 1 + buttons.length) % buttons.length;
      updateButtonAlphas();
    } else if (keyCode === 5 || keyCode === 56) {
      currentButton = (currentButton + 1) % buttons.length;
      updateButtonAlphas();
    } else if (keyCode === 14) {
      handleButtonPress();
    } else if (keyCode === 27) {
      if (escCount === 0) {
        escCount = 1;
        log('Press ESC again to exit');
      } else {
        exitApplication();
      }
    } else if (keyCode === 13) {
      exitApplication();
    }
  };

  // ---------- Start ----------
  function start() {
    buildMenu();
    bgm.play(true);
    startFadeIn();
    log('Main menu loaded');
  }

  start();
})();