(function () {
  // ---------- Configuration ----------
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var CENTER_X = SCREEN_W / 2;
  var ASSET_PATH = 'file:///../download0/themes/Artemis/data/';

  // Menu options: label, script, and icon key
  var menuOptions = [
    { label: 'Start Jb', script: 'loader.js', icon: 'xmb' },
    { label: 'Cheat Menu', script: 'themes/Artemis/payload_host.js', icon: 'cht' },
    { label: 'Online DB', script: 'themes/Artemis/online_DB.js', icon: 'onl' },
    { label: 'Options',    script: 'themes/Artemis/config_ui.js', icon: 'opt' },
    { label: 'About',      script: 'themes/Artemis/about.js', icon: 'abt' }
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

  // Character width approximation for centering
  var CHAR_WIDTH = 18;
  var BOTTOM_CHAR_WIDTH = 18;

  // Icon dimensions
  var iconW = 140;
  var iconH = 112;

  // gap between icons
  var ICON_GAP = 70;

  // Bottom text (The url)  adjustable offsets
  var bottomYOffset = 105;
  var bottomXOffset = 0;

  // you guessed it, the animation timings
  var FADE_DURATION = 5000;
  var UNLOCK_TIME = 3000;
  var DIM_START = 2000;
  var DIM_END = 3000;

  // ---------- Styles ----------
  new Style({ name: 'subtitle', color: 'black', size: 36, bold: true });
  new Style({ name: 'iconLabel', color: 'black', size: 32, bold: true });
  new Style({ name: 'bottomText', color: 'black', size: 28, bold: true });

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
    var logo = new Image({
      url: ASSET_PATH + 'titlescr_logo.png',
      x: CENTER_X - 579,
      y: 230,
      width: 1158,
      height: 204,
      alpha: 0
    });

    jsmaf.root.children.push(logo);
    fadeElements.push(logo);

    // Logo Text
    var subtitle = new jsmaf.Text();
    subtitle.text = 'cross   platform   hacking   system';
    subtitle.style = 'subtitle';

    var subtitleWidth = subtitle.text.length * CHAR_WIDTH;

    subtitle.x = CENTER_X - (subtitleWidth / 2);
    subtitle.y = logo.y + logo.height + 24;
    subtitle.alpha = 0;

    jsmaf.root.children.push(subtitle);
    fadeElements.push(subtitle);

    // Icons
    var totalWidth = menuOptions.length * iconW + (menuOptions.length - 1) * ICON_GAP;
    var startX = (SCREEN_W - totalWidth) / 2;

    var iconY = 650;

    for (var i = 0; i < menuOptions.length; i++) {

      var icon = new Image({
        url: ASSET_PATH + 'titlescr_ico_' + menuOptions[i].icon + '.png',
        x: startX + i * (iconW + ICON_GAP),
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

      lbl.x = (icon.x + iconW / 2) - (textWidth / 2);

      lbl.y = icon.y + iconH + 8;

      buttonTexts.push(lbl);

      jsmaf.root.children.push(lbl);
      fadeElements.push(lbl);

    }

   // link.. url.. whatever. its a text
    var bottom = new jsmaf.Text();

    bottom.text = 'www.gamehacking.org/artemis';
    bottom.style = 'bottomText';

    var bottomTextWidth = bottom.text.length * BOTTOM_CHAR_WIDTH;

    bottom.x = CENTER_X - (bottomTextWidth / 2) + bottomXOffset;
    
    bottom.y = SCREEN_H - bottomYOffset;
    bottom.alpha = 0;

    jsmaf.root.children.push(bottom);
    fadeElements.push(bottom);

  }

  // ---------- Button Press ----------
  function handleButtonPress() {

    if (!inputEnabled) return;

    var selected = menuOptions[currentButton];

    if (!selected) return;

    log('Loading ' + selected.script + '...');

    try {
      include(selected.script);
    }
    catch (e) {
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

    }
    catch (e) {
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
    }

    else if (keyCode === 5 || keyCode === 56) {
      currentButton = (currentButton + 1) % buttons.length;
      updateButtonAlphas();
    }

    else if (keyCode === 14) {
      handleButtonPress();
    }

    else if (keyCode === 27) {
      if (escCount === 0) {
        escCount = 1;
        log('Press ESC again to exit');
      }
      else {
        exitApplication();
      }
    }

    else if (keyCode === 13) {
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