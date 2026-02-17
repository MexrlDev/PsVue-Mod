(function () {
  // ---------- Configuration ----------
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var CENTER_X = SCREEN_W / 2;
  var ASSET_PATH = 'file:///../download0/data/';

  // Menu options: label, script, and icon key
  var menuOptions = [
    { label: 'Start Game', script: 'loader.js', icon: 'xmb' },
    { label: 'Cheat Menu', script: 'payload_host.js', icon: 'cht' },
    { label: 'Options',    script: 'config_ui.js', icon: 'opt' },
    { label: 'About',      script: 'about.js', icon: 'abt' }
  ];

  // ---------- Global Variables ----------
  var currentButton = 0;        // index of selected button
  var buttons = [];             // icon Image objects
  var buttonTexts = [];         // text label objects
  var escCount = 0;             // for double‑escape exit

  // ---------- Styles ----------
  new Style({ name: 'subtitle', color: 'black', size: 24 });
  new Style({ name: 'iconLabel', color: 'black', size: 15, bold: true });
  new Style({ name: 'bottomText', color: 'black', size: 14 });

  // ---------- Audio ----------
  var bgm = new jsmaf.AudioClip();
  bgm.volume = 0.5;
  bgm.open(ASSET_PATH + 'bg.wav');   // changed to .wav

  // ---------- Helper: clear display list ----------
  function clearRoot() {
    jsmaf.root.children.length = 0;
  }

  // ---------- Build the main menu ----------
  function buildMenu() {
    clearRoot();

    // Background
    var bg = new Image({
      url: ASSET_PATH + 'bgimg.png',
      x: 0, y: 0,
      width: SCREEN_W, height: SCREEN_H
    });
    jsmaf.root.children.push(bg);

    // Logo
    var logo = new Image({
      url: ASSET_PATH + 'titlescr_logo.png',
      x: CENTER_X - 384,   // 768/2
      y: 100,
      width: 768,
      height: 338
    });
    jsmaf.root.children.push(logo);

    // Subtitle
    var subtitle = new jsmaf.Text();
    subtitle.text = 'cross   platform   hacking   system';
    subtitle.style = 'subtitle';
    subtitle.x = CENTER_X - 200;
    subtitle.y = logo.y + logo.height + 20;
    jsmaf.root.children.push(subtitle);

    // Icons and labels (positioned like Python original)
    var iconW = 150, iconH = 150;
    var gap = 30;
    var totalWidth = menuOptions.length * iconW + (menuOptions.length - 1) * gap;
    var startX = (SCREEN_W - totalWidth) / 2;
    var iconY = SCREEN_H - iconH - 200;   // same offset as Python

    for (var i = 0; i < menuOptions.length; i++) {
      // Icon image
      var icon = new Image({
        url: ASSET_PATH + 'titlescr_ico_' + menuOptions[i].icon + '.png',
        x: startX + i * (iconW + gap),
        y: iconY,
        width: iconW,
        height: iconH,
        alpha: 0.4          // dimmed by default
        // no border properties
      });
      buttons.push(icon);
      jsmaf.root.children.push(icon);

      // Text label
      var lbl = new jsmaf.Text();
      lbl.text = menuOptions[i].label;
      lbl.style = 'iconLabel';
      lbl.alpha = 0.4;
      // Center under icon (roughly)
      lbl.x = icon.x + (iconW / 2) - 40;
      lbl.y = icon.y + iconH + 10;
      buttonTexts.push(lbl);
      jsmaf.root.children.push(lbl);
    }

    // Bottom text
    var bottom = new jsmaf.Text();
    bottom.text = 'www.gamehacking.org/artemis';
    bottom.style = 'bottomText';
    bottom.x = CENTER_X - 150;
    bottom.y = SCREEN_H - 40;
    jsmaf.root.children.push(bottom);

    // Set initial selection (first button highlighted)
    updateSelection();
  }

  // ---------- Update selection (alpha only) ----------
  function updateSelection() {
    for (var i = 0; i < buttons.length; i++) {
      var alpha = (i === currentButton) ? 1.0 : 0.4;
      buttons[i].alpha = alpha;
      buttonTexts[i].alpha = alpha;
    }
  }

  // ---------- Handle Button Press (Enter) ----------
  function handleButtonPress() {
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

  // ---------- Exit Routine (double ESC) ----------
  function exitApplication() {
    log('Exiting...');
    try {
      if (typeof libc_addr === 'undefined') {
        include('userland.js');
      }
      fn.register(0x14, 'getpid', [], 'bigint');
      fn.register(0x25, 'kill', ['bigint', 'bigint'], 'bigint');
      var pid = fn.getpid();
      var pid_num = pid instanceof BigInt ? pid.lo : pid;
      fn.kill(pid, new BigInt(0, 9));
    } catch (e) {
      log('ERROR during exit: ' + e.message);
    }
    jsmaf.exit();
  }

  // ---------- Keyboard Handling ----------
  jsmaf.onKeyDown = function (keyCode) {
    // Left arrow (code 7) / Right arrow (code 6)
    if (keyCode === 7) { // left
      currentButton = (currentButton - 1 + buttons.length) % buttons.length;
      updateSelection();
    } else if (keyCode === 6) { // right
      currentButton = (currentButton + 1) % buttons.length;
      updateSelection();
    } else if (keyCode === 14) { // Enter
      handleButtonPress();
    } else if (keyCode === 27) { // ESC
      if (escCount === 0) {
        escCount = 1;
        log('Press ESC again to exit');
      } else {
        exitApplication();
      }
    }
    // F and W keys ignored
  };

  // ---------- Intro Sequence ----------
  function runIntro() {
    // Clear screen (black)
    clearRoot();
    // After 2 seconds, start music and show menu
    jsmaf.setTimeout(function() {
      bgm.play(true); // loop
      buildMenu();
      log('Main menu loaded');
    }, 2000);
  }

  // ---------- Start ----------
  runIntro();
})();
