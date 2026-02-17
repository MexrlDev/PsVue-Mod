(function () {
  // ---------- Configuration ----------
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var CENTER_X = SCREEN_W / 2;
  var ASSET_PATH = 'file:///../download0/data/';

  // Menu options: label, script, and icon key
  var menuOptions = [
    { label: 'Start Jb', script: 'loader.js', icon: 'xmb' },
    { label: 'Cheat Menu', script: 'payload_host.js', icon: 'cht' },
    { label: 'Options',    script: 'config_ui.js', icon: 'opt' },
    { label: 'About',      script: 'about.js', icon: 'abt' }
  ];

  // Fine‑tune text centering (pixels to add to x for each label)
  var textOffsets = [5, 5, 0, 0];  // Start Game and Cheat Menu are moved to the right a bit

  // ---------- Global Variables ----------
  var currentButton = 0;        // index of selected button
  var buttons = [];             // icon Image objects
  var buttonTexts = [];         // text label objects
  var escCount = 0;             // for double‑escape exit
  var fadingIn = true;          // block input during fade‑in

  // Foreground elements that will fade in (excluding background)
  var fadeElements = [];

  // Fade‑in interval
  var fadeInterval = null;

  // Approximate character width for centering (pixels per character)
  var CHAR_WIDTH = 10;           // for font size 15 bold

  // Icon dimensions
  var iconW = 173;
  var iconH = 138;

  // ---------- Styles ----------
  new Style({ name: 'subtitle', color: 'black', size: 24 });
  new Style({ name: 'iconLabel', color: 'black', size: 15, bold: true });
  new Style({ name: 'bottomText', color: 'black', size: 14 });

  // ---------- Audio (global instance) ----------
  // Use a persistent global variable so music continues across script reloads
  if (typeof jsmaf.bgm === 'undefined') {
    jsmaf.bgm = new jsmaf.AudioClip();
    jsmaf.bgm.volume = 0.5;
    jsmaf.bgm.open(ASSET_PATH + 'bg.wav');
  }
  var bgm = jsmaf.bgm;

  // ---------- Helper: clear display list ----------
  function clearRoot() {
    jsmaf.root.children.length = 0;
  }

  // ---------- Build the main menu ----------
  function buildMenu() {
    clearRoot();

    // Background (always visible)
    var bg = new Image({
      url: ASSET_PATH + 'bgimg.png',
      x: 0, y: 0,
      width: SCREEN_W, height: SCREEN_H
    });
    jsmaf.root.children.push(bg);

    // Logo – 1158 x 204, positioned at y=250
    var logo = new Image({
      url: ASSET_PATH + 'titlescr_logo.png',
      x: CENTER_X - 579,   // 1158/2 = 579
      y: 250,
      width: 1158,
      height: 204,
      alpha: 0.0
    });
    jsmaf.root.children.push(logo);
    fadeElements.push(logo);

    // Subtitle – below logo
    var subtitle = new jsmaf.Text();
    subtitle.text = 'cross   platform   hacking   system';
    subtitle.style = 'subtitle';
    subtitle.x = CENTER_X - 200;
    subtitle.y = logo.y + logo.height + 30;
    subtitle.alpha = 0.0;
    jsmaf.root.children.push(subtitle);
    fadeElements.push(subtitle);

    // Icons and labels – using actual icon dimensions (173x138)
    var gap = 30;
    var totalWidth = menuOptions.length * iconW + (menuOptions.length - 1) * gap;
    var startX = (SCREEN_W - totalWidth) / 2;
    var iconY = 650;   // buttons pulled up

    for (var i = 0; i < menuOptions.length; i++) {
      // Icon image
      var icon = new Image({
        url: ASSET_PATH + 'titlescr_ico_' + menuOptions[i].icon + '.png',
        x: startX + i * (iconW + gap),
        y: iconY,
        width: iconW,
        height: iconH,
        alpha: 0.0
      });
      buttons.push(icon);
      jsmaf.root.children.push(icon);
      fadeElements.push(icon);

      // Text label – centered under icon with fine‑tuned offset
      var lbl = new jsmaf.Text();
      lbl.text = menuOptions[i].label;
      lbl.style = 'iconLabel';
      lbl.alpha = 0.0;
      var textWidth = lbl.text.length * CHAR_WIDTH;
      var baseX = icon.x + (iconW / 2) - (textWidth / 2);
      lbl.x = baseX + textOffsets[i];
      lbl.y = icon.y + iconH + 10;
      buttonTexts.push(lbl);
      jsmaf.root.children.push(lbl);
      fadeElements.push(lbl);
    }

    // Bottom text
    var bottom = new jsmaf.Text();
    bottom.text = 'www.gamehacking.org/artemis';
    bottom.style = 'bottomText';
    bottom.x = CENTER_X - 150;
    bottom.y = SCREEN_H - 40;
    bottom.alpha = 0.0;
    jsmaf.root.children.push(bottom);
    fadeElements.push(bottom);
  }

  // ---------- Fade‑in ----------
  function startFadeIn() {
    var duration = 5000;   // 5 sec
    var step = 50;         // update every 50 ms
    var elapsed = 0;

    fadeInterval = jsmaf.setInterval(function() {
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);  // 0 to 1

      // Set alpha for all fade elements
      for (var i = 0; i < fadeElements.length; i++) {
        fadeElements[i].alpha = t;
      }

      if (t >= 1) {
        jsmaf.clearInterval(fadeInterval);
        fadeInterval = null;
        fadingIn = false;   // enable input
        // Ensure selection highlighting is correct
        updateSelection();
      }
    }, step);
  }

  // ---------- Update selection ----------
  function updateSelection() {
    for (var i = 0; i < buttons.length; i++) {
      var baseAlpha = fadingIn ? fadeElements[0].alpha : 1.0;
      var targetAlpha = (i === currentButton) ? baseAlpha : baseAlpha * 0.4;
      buttons[i].alpha = targetAlpha;
      buttonTexts[i].alpha = targetAlpha;
    }
  }

  // ---------- Handle Button Press ----------
  function handleButtonPress() {
    if (fadingIn) return;   // ignore during fade‑in
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

  // ---------- Exit Routine ----------
  function exitApplication() {
    log('Exiting...');
    // Optionally stop the music
    if (jsmaf.bgm) {
      // Assuming there's a stop() method – if not, just ignore
      if (jsmaf.bgm.stop) jsmaf.bgm.stop();
    }
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

  // ---------- Controller Handling ----------
  jsmaf.onKeyDown = function (keyCode) {
    // Ignore all input during fade‑in
    if (fadingIn) return;

    // Left keys: 7 (arrow) and 58
    if (keyCode === 7 || keyCode === 58) {
      currentButton = (currentButton - 1 + buttons.length) % buttons.length;
      updateSelection();
    }
    // Right keys: 5 (arrow) and 56
    else if (keyCode === 5 || keyCode === 56) {
      currentButton = (currentButton + 1) % buttons.length;
      updateSelection();
    }
    // Enter: 14
    else if (keyCode === 14) {
      handleButtonPress();
    }
    // ESC: 27 (double‑press to exit)
    else if (keyCode === 27) {
      if (escCount === 0) {
        escCount = 1;
        log('Press ESC again to exit');
      } else {
        exitApplication();
      }
    }
    // Key code 13 – immediate exit
    else if (keyCode === 13) {
      exitApplication();
    }
  };

  // ---------- Start ----------
  function start() {
    buildMenu();
    // Music had a bug, i guess i fixed it
    bgm.play(true);  // true = loop
    startFadeIn();
    log('Main menu loaded – fading in foreground');
  }

  start();
})();