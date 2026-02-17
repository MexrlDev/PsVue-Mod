(function () {
  // Include language file if needed (here we use hardcoded English strings)
  // include('languages.js');  // not used, we'll define our own strings

  // Log start
  log('Loading main menu...');

  // ---------- Configuration ----------
  var SCREEN_W = 1920;   // Assume full HD (as in original jsmaf script)
  var SCREEN_H = 1080;
  var CENTER_X = SCREEN_W / 2;

  // Paths – all assets are in download0/data/
  var ASSET_PATH = 'file:///../download0/data/';

  // ---------- Global Variables ----------
  var currentButton = 0;          // for keyboard navigation
  var buttons = [];               // icon images
  var buttonLabels = [];          // text labels for icons
  var buttonRects = [];           // {x, y, w, h} for hit testing
  var buttonAlpha = [];           // current alpha for each icon
  var helpMode = false;           // true when showing help screen
  var escCount = 0;               // for double‑escape exit
  var animating = false;          // prevents input during transitions
  var mouseInside = false;        // track if mouse is over any button

  // Icon definitions (match Python version)
  var iconFiles = [
    'titlescr_ico_xmb.png',
    'titlescr_ico_cht.png',
    'titlescr_ico_opt.png',
    'titlescr_ico_abt.png'
  ];
  var iconLabels = ['Start Game', 'Cheat Menu', 'Options', 'About'];

  // ---------- Styles ----------
  new Style({ name: 'subtitle', color: 'black', size: 24 });
  new Style({ name: 'iconLabel', color: 'black', size: 15, bold: true });
  new Style({ name: 'bottomText', color: 'black', size: 14 });
  new Style({ name: 'helpText', color: 'white', size: 24, bold: true });

  // ---------- Audio ----------
  var bgm = new jsmaf.AudioClip();
  bgm.volume = 0.5;
  bgm.open(ASSET_PATH + 'bg.mp3');
  // Will be played after intro

  // ---------- Helper Functions ----------
  function clearRoot() {
    jsmaf.root.children.length = 0;
  }

  // Scale an image to fit within max dimensions while preserving aspect ratio
  function createScaledImage(url, maxW, maxH) {
    // Note: In jsmaf we cannot get original image dimensions easily.
    // We assume the images are roughly square and set both dimensions to maxW/maxH.
    // For a more accurate port, you would need the original aspect ratios.
    // Here we use a fixed size of 150x150 for all icons.
    return new Image({
      url: url,
      x: 0, y: 0,  // temporary, will be positioned later
      width: maxW,
      height: maxH
    });
  }

  // Compute icon layout based on current screen (fixed 1920x1080)
  function layoutIcons() {
    var iconW = 150, iconH = 150;          // icon display size
    var gap = 30;
    var totalWidth = iconFiles.length * iconW + (iconFiles.length - 1) * gap;
    var startX = (SCREEN_W - totalWidth) / 2;
    var y = SCREEN_H - iconH - 200;         // ICON_OFFSET_Y = -200 in Python version
    return { startX, y, iconW, iconH, gap };
  }

  // Update button positions and store rects
  function positionButtons() {
    var layout = layoutIcons();
    var x = layout.startX;
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      btn.x = x;
      btn.y = layout.y;
      btn.width = layout.iconW;
      btn.height = layout.iconH;
      // Store rect for hit testing
      buttonRects[i] = { x: btn.x, y: btn.y, w: btn.width, h: btn.height };
      // Position label below icon
      var lbl = buttonLabels[i];
      lbl.x = btn.x + (btn.width / 2) - 40;  // rough centering
      lbl.y = btn.y + btn.height + 10;
      x += btn.width + layout.gap;
    }
  }

  // Update alpha of icons based on mouse position (if mouse available)
  function updateHover(mx, my) {
    if (helpMode || animating) return;
    var anyHover = false;
    for (var i = 0; i < buttons.length; i++) {
      var r = buttonRects[i];
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        buttons[i].alpha = 1.0;
        buttonLabels[i].alpha = 1.0;
        anyHover = true;
      } else {
        buttons[i].alpha = 0.4;      // 100/255 ≈ 0.4
        buttonLabels[i].alpha = 0.4;
      }
    }
    mouseInside = anyHover;
  }

  // Reset all icons to default (semi‑transparent) – used after leaving help
  function resetIcons() {
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].alpha = 0.4;
      buttonLabels[i].alpha = 0.4;
    }
  }

  // ---------- Screen Drawing Functions ----------
  function buildMenuScreen() {
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
      x: CENTER_X - 384,   // 40% of 1920 = 768/2 = 384
      y: 100,               // LOGO_OFFSET_Y = 100
      width: 768,
      height: 338           // approximate, maintain aspect
    });
    jsmaf.root.children.push(logo);

    // Subtitle
    var subtitle = new jsmaf.Text();
    subtitle.text = 'cross   platform   hacking   system';
    subtitle.style = 'subtitle';
    subtitle.x = CENTER_X - 200;
    subtitle.y = logo.y + logo.height + 20;
    jsmaf.root.children.push(subtitle);

    // Icons and labels
    buttons = [];
    buttonLabels = [];
    buttonRects = [];
    for (var i = 0; i < iconFiles.length; i++) {
      var icon = new Image({
        url: ASSET_PATH + iconFiles[i],
        x: 0, y: 0,
        width: 150, height: 150,
        alpha: 0.4
      });
      buttons.push(icon);
      jsmaf.root.children.push(icon);

      var lbl = new jsmaf.Text();
      lbl.text = iconLabels[i];
      lbl.style = 'iconLabel';
      lbl.alpha = 0.4;
      buttonLabels.push(lbl);
      jsmaf.root.children.push(lbl);
    }
    positionButtons();

    // Bottom text
    var bottom = new jsmaf.Text();
    bottom.text = 'www.gamehacking.org/artemis';
    bottom.style = 'bottomText';
    bottom.x = CENTER_X - 150;
    bottom.y = SCREEN_H - 40;
    jsmaf.root.children.push(bottom);
  }

  function buildHelpScreen() {
    clearRoot();

    // Background (same as menu)
    var bg = new Image({
      url: ASSET_PATH + 'bgimg.png',
      x: 0, y: 0,
      width: SCREEN_W, height: SCREEN_H
    });
    jsmaf.root.children.push(bg);

    // Help overlay image
    var helpImg = new Image({
      url: ASSET_PATH + 'help.png',
      x: 0, y: 0,
      width: SCREEN_W, height: SCREEN_H
    });
    jsmaf.root.children.push(helpImg);

    // Help text
    var line1 = new jsmaf.Text();
    line1.text = 'This is a PC copy of a PS3 Artemis made with Python.';
    line1.style = 'helpText';
    line1.x = CENTER_X - 400;
    line1.y = SCREEN_H / 2 - 30;
    jsmaf.root.children.push(line1);

    var line2 = new jsmaf.Text();
    line2.text = '(Made by MexrlDev)';
    line2.style = 'helpText';
    line2.x = CENTER_X - 120;
    line2.y = SCREEN_H / 2 + 20;
    jsmaf.root.children.push(line2);
  }

  // ---------- Animations ----------
  function fadeToMenu(durationSec) {
    if (animating) return;
    animating = true;

    // Create a white overlay
    var whiteOverlay = new Image({
      url: '',  // empty url – we'll use a colored rectangle via border? 
      // Alternatively, create a solid color Image. jsmaf might support color fills.
      // Since we can't create a colored rectangle easily, we'll use a workaround:
      // Create an Image with a white pixel and scale it.
      // For simplicity, we assume we have a white image asset, or we use a border hack.
      // In this port, we'll skip the fade and just switch immediately.
      // A real implementation would need a way to draw a colored rectangle.
    });
    // For now, just set menu directly.
    buildMenuScreen();
    animating = false;
  }

  function closingAnimation() {
    if (animating) return;
    animating = true;

    // Create white background (using a white image or colored rect)
    // Again, we simplify: just exit after a delay.
    log('Exiting...');
    // Call the exit routine from original script
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

  // Intro sequence: black screen 2 sec, then fade from white 4 sec
  function runIntro() {
    // First, clear screen to black
    clearRoot();
    // We can't easily draw black, but assume screen is black by default.
    // After 2 seconds, start fade.
    jsmaf.setTimeout(function() {
      // Start playing music
      bgm.play(true); // loop

      // Now fade from white to menu over 4 seconds
      // For simplicity, just show menu immediately.
      buildMenuScreen();
    }, 2000);
  }

  // ---------- Input Handlers ----------
  // Mouse events (if supported by jsmaf)
  if (typeof jsmaf.onMouseMove !== 'undefined') {
    jsmaf.onMouseMove = function(x, y) {
      if (helpMode || animating) return;
      updateHover(x, y);
    };
  }

  if (typeof jsmaf.onMouseDown !== 'undefined') {
    jsmaf.onMouseDown = function(button, x, y) {
      if (helpMode || animating) return;
      if (button !== 0) return; // left click only
      for (var i = 0; i < buttonRects.length; i++) {
        var r = buttonRects[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          if (i === 3) { // About
            helpMode = true;
            buildHelpScreen();
            escCount = 0;
          }
          break;
        }
      }
    };
  }

  // Keyboard navigation (as in original jsmaf script)
  jsmaf.onKeyDown = function(keyCode) {
    if (animating) return;

    // Map keys: left/right for horizontal menu
    if (keyCode === 4 || keyCode === 7) { // left/up? In original, 4/7 are up/down. We'll use left/right.
      // Use left/right arrows – typical codes? We'll assume left=4, right=5.
      // For simplicity, we'll use the same codes as original but interpret differently.
      // In original, 6=down,5=up? Actually they used 6 and 5 for down/up. We'll map left/right to 4/5.
      // Let's define: left = 4, right = 5.
      if (keyCode === 4) {
        currentButton = (currentButton - 1 + buttons.length) % buttons.length;
      } else if (keyCode === 5) {
        currentButton = (currentButton + 1) % buttons.length;
      }
      // Highlight the current button visually (simulate hover)
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].alpha = (i === currentButton) ? 1.0 : 0.4;
        buttonLabels[i].alpha = (i === currentButton) ? 1.0 : 0.4;
      }
    } else if (keyCode === 14) { // Enter / select
      if (helpMode) {
        // In help screen, Enter returns to menu (like ESC in Python)
        helpMode = false;
        buildMenuScreen();
        resetIcons();
        escCount = 1; // So next ESC exits
      } else {
        if (currentButton === 3) { // About
          helpMode = true;
          buildHelpScreen();
          escCount = 0;
        }
        // Other icons would load scripts – not implemented in Python version
      }
    } else if (keyCode === 27) { // ESC key (if available)
      if (helpMode) {
        helpMode = false;
        buildMenuScreen();
        resetIcons();
        escCount = 1;
      } else {
        if (escCount === 0) {
          escCount = 1;
          log('Press ESC again to exit');
        } else {
          closingAnimation();
        }
      }
    } else if (keyCode === 70) { // F key – fullscreen (ignore in jsmaf)
      // Not supported
    } else if (keyCode === 87) { // W key – windowed (ignore)
    }
  };

  // ---------- Start ----------
  runIntro();

  log('Main menu loaded');
})();
