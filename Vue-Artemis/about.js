(function () {
  // ---------- Configuration ----------
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var CENTER_X = SCREEN_W / 2;
  var ASSET_PATH = 'file:///../download0/data/';

  // UI dimensions (icon and line remain from config_ui)
  var ICON_X = 50;
  var ICON_Y = 50;
  var ICON_W = 130;
  var ICON_H = 138;

  var LINE_X = ICON_X + ICON_W + 20;   // 200
  var LINE_Y = 100;
  var LINE_TARGET_W = 1600;             // from x=200 to x=1800
  var LINE_H = 4;

  // Title "About" above the line (like config_ui)
  var TITLE_LEFT_X = LINE_X + 20;        // "About" on left
  var TITLE_Y = LINE_Y - 40;             // above line

  // Footer (only Back button now)
  var FOOTER_Y = SCREEN_H - 100;
  var FOOTER_ICON_SIZE = 32;
  var FOOTER_GAP_ICON_TEXT = 10;
  var BACK_TEXT_WIDTH = 80;               // approximate width of "Back" text

  // ---------- Global Variables ----------
  var lineImg = null;
  var iconImg = null;
  var titleAbout = null;                 // "About" title
  var footerBackIcon = null;
  var footerBackText = null;
  var fadeElements = [];                 // all elements that fade in (except background)
  var fadeInterval = null;
  var fadingIn = true;
  var pressedKeys = {};

  // ---------- Styles ----------
  new Style({ name: 'bigText', color: 'black', size: 48 });      // main thank you
  new Style({ name: 'subtitle', color: 'black', size: 24 });     // cross platform
  new Style({ name: 'creditHeader', color: 'black', size: 32 }); // headers
  new Style({ name: 'creditName', color: 'black', size: 24 });   // names
  new Style({ name: 'title', color: 'black', size: 32 });        // for "About"
  new Style({ name: 'footerText', color: 'black', size: 36, bold: true });

  // ---------- Audio ----------
  var bgm = new jsmaf.AudioClip();
  bgm.volume = 0.5;
  bgm.open(ASSET_PATH + 'bg.wav');
  bgm.play(true);

  // ---------- Build UI ----------
  function buildUI() {
    jsmaf.root.children.length = 0;

    // Background
    var bg = new Image({
      url: ASSET_PATH + 'bgimg.png',
      x: 0, y: 0,
      width: SCREEN_W, height: SCREEN_H
    });
    jsmaf.root.children.push(bg);

    // Icon (top‑left) – using about icon
    iconImg = new Image({
      url: ASSET_PATH + 'titlescr_ico_abt-ico.png',
      x: ICON_X,
      y: ICON_Y,
      width: ICON_W,
      height: ICON_H,
      alpha: 0.0
    });
    jsmaf.root.children.push(iconImg);
    fadeElements.push(iconImg);

    // Black line (starts with width 0)
    lineImg = new Image({
      url: ASSET_PATH + 'black.png',
      x: LINE_X,
      y: LINE_Y,
      width: 0,
      height: LINE_H,
      alpha: 0.0
    });
    jsmaf.root.children.push(lineImg);
    fadeElements.push(lineImg);

    // "About" title (left side, above line)
    titleAbout = new jsmaf.Text();
    titleAbout.text = 'About';
    titleAbout.style = 'title';
    titleAbout.x = TITLE_LEFT_X;
    titleAbout.y = TITLE_Y;
    titleAbout.alpha = 0.0;
    jsmaf.root.children.push(titleAbout);
    fadeElements.push(titleAbout);

    // ---------- Centered text content ----------
    var contentStartY = LINE_Y + 60; // a little below the line

    // Big thank you
    var thankYou = new jsmaf.Text();
    thankYou.text = 'Thank you for using Artemis!';
    thankYou.style = 'bigText';
    thankYou.x = CENTER_X - 300; // approximate centering
    thankYou.y = contentStartY;
    thankYou.alpha = 0.0;
    jsmaf.root.children.push(thankYou);
    fadeElements.push(thankYou);

    // Subtitle
    var subtitle = new jsmaf.Text();
    subtitle.text = 'cross   platform   hacking   system';
    subtitle.style = 'subtitle';
    subtitle.x = CENTER_X - 200;
    subtitle.y = thankYou.y + 60;
    subtitle.alpha = 0.0;
    jsmaf.root.children.push(subtitle);
    fadeElements.push(subtitle);

    // PlayStation 4 Port header
    var ps4Header = new jsmaf.Text();
    ps4Header.text = 'PlayStation 4 Port:';
    ps4Header.style = 'creditHeader';
    ps4Header.x = CENTER_X - 200;
    ps4Header.y = subtitle.y + 80;
    ps4Header.alpha = 0.0;
    jsmaf.root.children.push(ps4Header);
    fadeElements.push(ps4Header);

    // hey look its me
    var ps4Names = ['MexrlDev'];
    var y = ps4Header.y + 40;
    for (var i = 0; i < ps4Names.length; i++) {
      var name = new jsmaf.Text();
      name.text = ps4Names[i];
      name.style = 'creditName';
      name.x = CENTER_X - 180;
      name.y = y;
      name.alpha = 0.0;
      jsmaf.root.children.push(name);
      fadeElements.push(name);
      y += 30;
    }

    // PsVue Credits header
    var psVueHeader = new jsmaf.Text();
    psVueHeader.text = 'PsVue After Free Credits:';
    psVueHeader.style = 'creditHeader';
    psVueHeader.x = CENTER_X - 200;
    psVueHeader.y = y + 30;
    psVueHeader.alpha = 0.0;
    jsmaf.root.children.push(psVueHeader);
    fadeElements.push(psVueHeader);

    // PsVue names
    var psVueNames = [
      'ufm42', 'c0w-ar', 'earthonion', 'HelloYunho', 'Gezine',
      'D-Link Turtle', 'Dr.YenYen', 'Thefl0w', 'abc'
    ];
    y = psVueHeader.y + 40;
    for (var i = 0; i < psVueNames.length; i++) {
      var name = new jsmaf.Text();
      name.text = psVueNames[i];
      name.style = 'creditName';
      name.x = CENTER_X - 180;
      name.y = y;
      name.alpha = 0.0;
      jsmaf.root.children.push(name);
      fadeElements.push(name);
      y += 30;
    }

    // PlayStation 3 Port header
    var ps3Header = new jsmaf.Text();
    ps3Header.text = 'PlayStation 3 Port:';
    ps3Header.style = 'creditHeader';
    ps3Header.x = CENTER_X - 200;
    ps3Header.y = y + 30;
    ps3Header.alpha = 0.0;
    jsmaf.root.children.push(ps3Header);
    fadeElements.push(ps3Header);

    // PS3 names
    var ps3Names = ['DNAWRKSHP', 'BERION'];
    y = ps3Header.y + 40;
    for (var i = 0; i < ps3Names.length; i++) {
      var name = new jsmaf.Text();
      name.text = ps3Names[i];
      name.style = 'creditName';
      name.x = CENTER_X - 180;
      name.y = y;
      name.alpha = 0.0;
      jsmaf.root.children.push(name);
      fadeElements.push(name);
      y += 30;
    }

    // ---------- Footer ----------
    var backSectionWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + BACK_TEXT_WIDTH;
    var startX = (SCREEN_W - backSectionWidth) / 2;

    footerBackIcon = new Image({
      url: ASSET_PATH + 'footer_ico_circle.png',
      x: startX,
      y: FOOTER_Y - FOOTER_ICON_SIZE / 2,
      width: FOOTER_ICON_SIZE,
      height: FOOTER_ICON_SIZE,
      alpha: 0.0
    });
    jsmaf.root.children.push(footerBackIcon);
    fadeElements.push(footerBackIcon);

    footerBackText = new jsmaf.Text();
    footerBackText.text = 'Back';
    footerBackText.style = 'footerText';
    footerBackText.x = startX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerBackText.y = FOOTER_Y - 18;
    footerBackText.alpha = 0.0;
    jsmaf.root.children.push(footerBackText);
    fadeElements.push(footerBackText);

    // Start fade‑in and line expansion
    startFadeIn();
  }

  // ---------- Fade‑in and line animation ----------
  function startFadeIn() {
    var startTime = Date.now();
    var fadeDuration = 5000;
    var lineExpandDuration = 1000;

    fadeInterval = jsmaf.setInterval(function() {
      var elapsed = Date.now() - startTime;
      var t = Math.min(elapsed / fadeDuration, 1);
      var lineT = Math.min(elapsed / lineExpandDuration, 1);

      for (var i = 0; i < fadeElements.length; i++) {
        fadeElements[i].alpha = t;
      }
      lineImg.width = LINE_TARGET_W * lineT;

      if (t >= 1) {
        jsmaf.clearInterval(fadeInterval);
        fadeInterval = null;
        for (var i = 0; i < fadeElements.length; i++) {
          fadeElements[i].alpha = 1.0;
        }
        lineImg.width = LINE_TARGET_W;
        fadingIn = false;
      }
    }, 16);
  }

  // ---------- Go back to main menu ----------
  function goBack() {
    if (fadingIn) return;
    log('Returning to main menu...');
    try {
      include('main-menu.js');
    } catch (e) {
      log('ERROR loading main-menu.js: ' + e.message);
    }
  }

  // ---------- Keyboard Handling ----------
  jsmaf.onKeyDown = function (keyCode) {
    if (fadingIn) return;
    if (pressedKeys[keyCode]) return;
    pressedKeys[keyCode] = true;

    // Enter (14) and ESC (27) and Backspace (13) all go back
    if (keyCode === 14 || keyCode === 27 || keyCode === 13) {
      goBack();
    }
  };

  jsmaf.onKeyUp = function (keyCode) {
    delete pressedKeys[keyCode];
  };

  // ---------- Start ----------
  buildUI();
  log('About menu loaded');
})();
