// ==== constants ====
(function () {
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var CENTER_X = SCREEN_W / 2;
  var ASSET_PATH = 'file:///../download0/themes/Cheat Manger/data/';

  var ICON_X = 50;
  var ICON_Y = 50;
  var ICON_W = 130;
  var ICON_H = 138;

  var LINE_Y = 100;               // This one is removed, too lazy to remove it

  var TITLE_RIGHT_X = 1800;
  var TITLE_Y = LINE_Y - 40;       // keep for version text

  var FOOTER_Y = SCREEN_H - 100;
  var FOOTER_ICON_SIZE = 32;
  var FOOTER_GAP_ICON_TEXT = 10;
  var BACK_TEXT_WIDTH = 80;

  var IDLE_TIMEOUT = 2500;
  var IDLE_FADE_DURATION = 300;

  // ----- New offsets -----
  var ICON_TEXT_OFFSET_X = 0;
  var ICON_TEXT_OFFSET_Y = 0;
  var VERSION_OFFSET_X = 0;
  var VERSION_OFFSET_Y = 0;

  // ----- Logo scaling and offset -----
  var LOGO_WIDTH_OVERRIDE = 300;
  var LOGO_HEIGHT_OVERRIDE = 95;
  var LOGO_Y_OFFSET = 46;

  // ----- Help image scaling -----
  var HELP_IMG_WIDTH_OVERRIDE = 940;
  var HELP_IMG_HEIGHT_OVERRIDE = 70;
  var HELP_IMG_Y = 830;
  var TITLE_TEXT_HEIGHT = 48;

  // ==== global variables ====
  var iconImg = null;
  var titleAbout = null;
  var titleVersion = null;
  var logoImg = null;               // titlescr_logo.png
  var subtitleText = null;          // "PlayStation 4 Cheats Manager"
  var creditTexts = [];             // array of left/right text objects
  var helpImg = null;                // help.png stretched at bottom
  var sineText = null;               // scrolling text at bottom
  var footerBackIcon = null;
  var footerBackText = null;
  var fadeElements = [];
  var idleElements = [];
  var fadeInterval = null;
  var fadingIn = true;
  var pressedKeys = {};

  var idleTimer = null;
  var idleFadeInterval = null;
  var idleFadeTarget = 1;

  var sineX = SCREEN_W + 200;        // start off-screen right
  var sineInterval = null;

  // ==== styles ====
  new Style({ name: 'bigText', color: 'black', size: 48 });
  new Style({ name: 'subtitle', color: 'black', size: 30 });
  new Style({ name: 'creditLeft', color: 'black', size: 26 });
  new Style({ name: 'creditRight', color: 'black', size: 26 });
  new Style({ name: 'title', color: 'black', size: 48, bold: true });
  new Style({ name: 'footerText', color: 'black', size: 36, bold: true });
  new Style({ name: 'sineText', color: 'black', size: 32 });

  // ==== audio ====
  var bgm = new jsmaf.AudioClip();
  bgm.volume = 0.5;
  bgm.open(ASSET_PATH + 'bg.wav');
  bgm.play(true);

  // ==== ( credits list ) ====
  var creditPairs = [
    "MexrlDev", "Created The Theme",
    "", "",
    "Bucanero", "(PS4 Cheats Manager)",
    "", "",
    "Ctn123", "Cheat Engine",
    "Shiningami", "Cheat Engine",
    "illusion", "Patch Engine",
    "SiSTRo", "GoldHEN, Cheat Menu",
    "Kameleon", "QA Support",
    "", "",
    "PsVAF Team", "(Vue After Free)",
    "", "",
    "PS3", "Credits",
    "Dnawrkshp (Artemis)", "Berion (GUI design)"
  ];

  // ==== helper functions ====
  function cancelIdleTimer() {
    if (idleTimer) {
      jsmaf.clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function startIdleTimer() {
    cancelIdleTimer();
    if (idleElements.length === 0) return;
    idleTimer = jsmaf.setTimeout(function() {
      if (idleElements.length > 0 && idleElements[0].alpha > 0.99) {
        fadeIdleElements(0);
      }
    }, IDLE_TIMEOUT);
  }

  function fadeIdleElements(targetAlpha) {
    if (idleElements.length === 0) return;
    if (idleFadeInterval) {
      jsmaf.clearInterval(idleFadeInterval);
      idleFadeInterval = null;
    }
    var startAlpha = idleElements[0].alpha;
    var startTime = Date.now();
    idleFadeTarget = targetAlpha;
    idleFadeInterval = jsmaf.setInterval(function() {
      var elapsed = Date.now() - startTime;
      var t = Math.min(elapsed / IDLE_FADE_DURATION, 1);
      var newAlpha = startAlpha + (targetAlpha - startAlpha) * t;
      for (var i = 0; i < idleElements.length; i++) {
        idleElements[i].alpha = newAlpha;
      }
      if (t >= 1) {
        jsmaf.clearInterval(idleFadeInterval);
        idleFadeInterval = null;
        for (var i = 0; i < idleElements.length; i++) {
          idleElements[i].alpha = targetAlpha;
        }
      }
    }, 16);
  }

  function resetIdle() {
    if (idleElements.length > 0 && idleElements[0].alpha < 0.99) {
      fadeIdleElements(1);
    }
    startIdleTimer();
  }

  function cleanup() {
    if (fadeInterval) jsmaf.clearInterval(fadeInterval);
    if (idleTimer) jsmaf.clearTimeout(idleTimer);
    if (idleFadeInterval) jsmaf.clearInterval(idleFadeInterval);
    if (sineInterval) jsmaf.clearInterval(sineInterval);
    fadeInterval = null;
    idleTimer = null;
    idleFadeInterval = null;
    sineInterval = null;
  }

  // ==== UI building ====
  function buildUI() {
    jsmaf.root.children.length = 0;

    // Background
    var bg = new Image({
      url: ASSET_PATH + 'bgimg.png',
      x: 0, y: 0,
      width: SCREEN_W, height: SCREEN_H
    });
    jsmaf.root.children.push(bg);

    // ---- Icon with group offset ----
    var iconX = ICON_X + ICON_TEXT_OFFSET_X;
    var iconY = ICON_Y + ICON_TEXT_OFFSET_Y;
    iconImg = new Image({
      url: ASSET_PATH + 'titlescr_ico_abt-ico.png',
      x: iconX,
      y: iconY,
      width: ICON_W,
      height: ICON_H,
      alpha: 0.0
    });
    jsmaf.root.children.push(iconImg);
    fadeElements.push(iconImg);

    titleAbout = new jsmaf.Text();
    titleAbout.text = 'About';
    titleAbout.style = 'title';
    titleAbout.x = iconX + ICON_W;
    titleAbout.y = iconY + (ICON_H - TITLE_TEXT_HEIGHT) / 2;
    titleAbout.alpha = 0.0;
    jsmaf.root.children.push(titleAbout);
    fadeElements.push(titleAbout);

    // ---- Version text ----
    titleVersion = new jsmaf.Text();
    titleVersion.text = 'v.1.0';
    titleVersion.style = 'title';
    titleVersion.x = TITLE_RIGHT_X - 80 + VERSION_OFFSET_X;
    titleVersion.y = TITLE_Y + VERSION_OFFSET_Y;
    titleVersion.alpha = 0.0;
    jsmaf.root.children.push(titleVersion);
    fadeElements.push(titleVersion);

    var logoBaseW = 484;
    var logoBaseH = 154;
    var logoW = LOGO_WIDTH_OVERRIDE > 0 ? LOGO_WIDTH_OVERRIDE : logoBaseW;
    var logoH = LOGO_HEIGHT_OVERRIDE > 0 ? LOGO_HEIGHT_OVERRIDE : logoBaseH;
    var logoY = 110 + LOGO_Y_OFFSET;
    logoImg = new Image({
      url: ASSET_PATH + 'titlescr_logo.png',
      x: Math.round(CENTER_X - logoW/2),
      y: logoY,
      width: logoW,
      height: logoH,
      alpha: 0.0
    });
    jsmaf.root.children.push(logoImg);
    fadeElements.push(logoImg);

    subtitleText = new jsmaf.Text();
    subtitleText.text = 'PlayStation 4 Cheats Manager';
    subtitleText.style = 'bigText';
    subtitleText.x = CENTER_X;
    subtitleText.y = 250;
    subtitleText.alpha = 0.0;
    subtitleText.align = 'center';
    jsmaf.root.children.push(subtitleText);
    fadeElements.push(subtitleText);

    // ---- Credits list ----
    var startY = 350;
    var lineHeight = 25;
    for (var i = 0; i < creditPairs.length; i += 2) {
      var leftText = creditPairs[i];
      var rightText = creditPairs[i+1];
      var y = startY + (i/2) * lineHeight;

      if (leftText) {
        var left = new jsmaf.Text();
        left.text = leftText;
        left.style = 'creditLeft';
        left.x = CENTER_X - 20;
        left.y = y;
        left.alpha = 0.0;
        left.align = 'right';
        jsmaf.root.children.push(left);
        fadeElements.push(left);
        creditTexts.push(left);
      }

      if (rightText) {
        var right = new jsmaf.Text();
        right.text = rightText;
        right.style = 'creditRight';
        right.x = CENTER_X + 20;
        right.y = y;
        right.alpha = 0.0;
        right.align = 'left';
        jsmaf.root.children.push(right);
        fadeElements.push(right);
        creditTexts.push(right);
      }
    }

    var helpBaseW = SCREEN_W;
    var helpBaseH = 104;
    var helpW = HELP_IMG_WIDTH_OVERRIDE > 0 ? HELP_IMG_WIDTH_OVERRIDE : helpBaseW;
    var helpH = HELP_IMG_HEIGHT_OVERRIDE > 0 ? HELP_IMG_HEIGHT_OVERRIDE : helpBaseH;
    var helpX = Math.round((SCREEN_W - helpW) / 2);
    var helpY = HELP_IMG_Y;
    helpImg = new Image({
      url: ASSET_PATH + 'help.png',
      x: helpX,
      y: helpY,
      width: helpW,
      height: helpH,
      alpha: 0.0
    });
    jsmaf.root.children.push(helpImg);
    fadeElements.push(helpImg);

    sineText = new jsmaf.Text();
    sineText.text = "in memory of Leon & Luna";
    sineText.style = 'sineText';
    sineText.x = CENTER_X;
    sineText.y = 840;
    sineText.alpha = 0.0;
    sineText.align = 'center';
    jsmaf.root.children.push(sineText);
    fadeElements.push(sineText);

    // ---- Footer (Back button) ----
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
    idleElements.push(footerBackIcon);

    footerBackText = new jsmaf.Text();
    footerBackText.text = 'Back';
    footerBackText.style = 'footerText';
    footerBackText.x = startX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerBackText.y = FOOTER_Y - 18;
    footerBackText.alpha = 0.0;
    jsmaf.root.children.push(footerBackText);
    fadeElements.push(footerBackText);
    idleElements.push(footerBackText);

    startFadeIn();
  }

  // ==== animation ====
  function startFadeIn() {
    var startTime = Date.now();
    var fadeDuration = 5000;

    if (fadeInterval) {
      jsmaf.clearInterval(fadeInterval);
      fadeInterval = null;
    }

    fadeInterval = jsmaf.setInterval(function() {
      var elapsed = Date.now() - startTime;
      var t = Math.min(elapsed / fadeDuration, 1);

      for (var i = 0; i < fadeElements.length; i++) {
        fadeElements[i].alpha = t;
      }

      if (t >= 1) {
        jsmaf.clearInterval(fadeInterval);
        fadeInterval = null;
        for (var i = 0; i < fadeElements.length; i++) {
          fadeElements[i].alpha = 1.0;
        }
        fadingIn = false;
        startIdleTimer();
      }
    }, 16);
  }

  // Optional sine animation (I just placed this here if anyone wanted to use it, its like the original about animation)
  /*
  function startSineAnimation() {
    if (sineInterval) jsmaf.clearInterval(sineInterval);
    var step = -8;
    sineInterval = jsmaf.setInterval(function() {
      sineX += step;
      if (sineX + sineText.text.length * 32 < 0) { // approximate char width 32
        sineX = SCREEN_W;
      }
      if (sineText) {
        sineText.x = sineX;
      }
    }, 50);
  }
  */

  // ==== navigation ====
  function goBack() {
    if (fadingIn) return;
    cleanup();
    try {
      include('../download0/themes/Cheat Manger/main.js');
    } catch (e) {
      try {
        log('ERROR loading main.js: ' + (e && e.message ? e.message : e));
      } catch (ee) {}
    }
  }

  // ==== event handlers ====
  jsmaf.onKeyDown = function (keyCode) {
    resetIdle();
    if (fadingIn) return;
    if (pressedKeys[keyCode]) return;
    pressedKeys[keyCode] = true;
    if (keyCode === 14 || keyCode === 27 || keyCode === 13) {
      goBack();
    }
  };

  jsmaf.onKeyUp = function (keyCode) {
    delete pressedKeys[keyCode];
  };

  // ==== initialization ====
  buildUI();
  try {
    log('About menu loaded');
  } catch (e) {}

})();