// ==== constants ====
(function () {
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var CENTER_X = SCREEN_W / 2;
  var ASSET_PATH = 'file:///../download0/themes/Artemis/data/';

  var ICON_X = 50;
  var ICON_Y = 50;
  var ICON_W = 130;
  var ICON_H = 138;

  var LINE_X = ICON_X + ICON_W + 20;
  var LINE_Y = 100;
  var LINE_TARGET_W = 1600;
  var LINE_H = 4;

  var TITLE_RIGHT_X = 1800;
  var TITLE_LEFT_X = LINE_X + 20;
  var TITLE_Y = LINE_Y - 40;

  var FOOTER_Y = SCREEN_H - 100;
  var FOOTER_ICON_SIZE = 32;
  var FOOTER_GAP_ICON_TEXT = 10;
  var BACK_TEXT_WIDTH = 80;

  var IDLE_TIMEOUT = 2500;
  var IDLE_FADE_DURATION = 300;

  var BIG_TEXT_SIZE = 48;
  var SUBTITLE_SIZE = 30;
  var THANK_EXTRA_GAP = 24; 

  // ==== global variables ====
  var lineImg = null;
  var iconImg = null;
  var titleAbout = null;
  var titleVersion = null;
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

  // ==== styles ====
  new Style({ name: 'bigText', color: 'black', size: BIG_TEXT_SIZE });
  new Style({ name: 'subtitle', color: 'black', size: SUBTITLE_SIZE });
  new Style({ name: 'helpHeader', color: 'black', size: 26 });
  new Style({ name: 'creditHeader', color: 'black', size: 32 });
  new Style({ name: 'creditName', color: 'black', size: 24 });
  new Style({ name: 'title', color: 'black', size: 32 });
  new Style({ name: 'footerText', color: 'black', size: 36, bold: true });

  // ==== audio ====
  var bgm = new jsmaf.AudioClip();
  bgm.volume = 0.5;
  bgm.open(ASSET_PATH + 'bg.wav');
  bgm.play(true);

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

  // ==== UI building ====
  function buildUI() {
    jsmaf.root.children.length = 0;

    var bg = new Image({
      url: ASSET_PATH + 'bgimg.png',
      x: 0, y: 0,
      width: SCREEN_W, height: SCREEN_H
    });
    jsmaf.root.children.push(bg);

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

    titleAbout = new jsmaf.Text();
    titleAbout.text = 'About';
    titleAbout.style = 'title';
    titleAbout.x = TITLE_LEFT_X;
    titleAbout.y = TITLE_Y;
    titleAbout.alpha = 0.0;
    jsmaf.root.children.push(titleAbout);
    fadeElements.push(titleAbout);

    titleVersion = new jsmaf.Text();
    titleVersion.text = 'v.3.0';
    titleVersion.style = 'title';
    titleVersion.x = TITLE_RIGHT_X - 80;
    titleVersion.y = TITLE_Y;
    titleVersion.alpha = 0.0;
    jsmaf.root.children.push(titleVersion);
    fadeElements.push(titleVersion);

    var contentStartY = LINE_Y + 60;

    var helpHeader = new jsmaf.Text();
    helpHeader.text = '====== Special Thanks From Mexrl To You =====';
    helpHeader.style = 'helpHeader';
    helpHeader.x = CENTER_X;
    helpHeader.y = contentStartY - 40;
    helpHeader.alpha = 0.0;
    helpHeader.align = 'center';
    jsmaf.root.children.push(helpHeader);
    fadeElements.push(helpHeader);

    var thankYou = new jsmaf.Text();
    thankYou.text = 'Thank you for using Artemis!';
    thankYou.style = 'bigText';
    thankYou.x = CENTER_X;
    thankYou.y = contentStartY;
    thankYou.alpha = 0.0;
    thankYou.align = 'center';
    jsmaf.root.children.push(thankYou);
    fadeElements.push(thankYou);

    var estimatedThankHeight = Math.round(BIG_TEXT_SIZE * 1.15);
    var subtitle = new jsmaf.Text();
    subtitle.text = 'cross   platform   hacking   system';
    subtitle.style = 'subtitle';
    subtitle.x = CENTER_X;
    subtitle.y = thankYou.y + estimatedThankHeight + THANK_EXTRA_GAP; // gap applied here
    subtitle.alpha = 0.0;
    subtitle.align = 'center';
    jsmaf.root.children.push(subtitle);
    fadeElements.push(subtitle);

    var ps4Header = new jsmaf.Text();
    ps4Header.text = 'PlayStation 4 Port:';
    ps4Header.style = 'creditHeader';
    ps4Header.x = CENTER_X - 200;
    ps4Header.y = subtitle.y + 80;
    ps4Header.alpha = 0.0;
    jsmaf.root.children.push(ps4Header);
    fadeElements.push(ps4Header);

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

    var psVueHeader = new jsmaf.Text();
    psVueHeader.text = 'PsVue After Free Credits:';
    psVueHeader.style = 'creditHeader';
    psVueHeader.x = CENTER_X - 200;
    psVueHeader.y = y + 30;
    psVueHeader.alpha = 0.0;
    jsmaf.root.children.push(psVueHeader);
    fadeElements.push(psVueHeader);

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

    var ps3Header = new jsmaf.Text();
    ps3Header.text = 'PlayStation 3 Port:';
    ps3Header.style = 'creditHeader';
    ps3Header.x = CENTER_X - 200;
    ps3Header.y = y + 30;
    ps3Header.alpha = 0.0;
    jsmaf.root.children.push(ps3Header);
    fadeElements.push(ps3Header);

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
    var lineExpandDuration = 1000;

    if (fadeInterval) {
      jsmaf.clearInterval(fadeInterval);
      fadeInterval = null;
    }

    fadeInterval = jsmaf.setInterval(function() {
      var elapsed = Date.now() - startTime;
      var t = Math.min(elapsed / fadeDuration, 1);
      var lineT = Math.min(elapsed / lineExpandDuration, 1);

      for (var i = 0; i < fadeElements.length; i++) {
        fadeElements[i].alpha = t;
      }
      if (lineImg) {
        lineImg.width = LINE_TARGET_W * lineT;
      }

      if (t >= 1) {
        jsmaf.clearInterval(fadeInterval);
        fadeInterval = null;
        for (var i = 0; i < fadeElements.length; i++) {
          fadeElements[i].alpha = 1.0;
        }
        if (lineImg) lineImg.width = LINE_TARGET_W;
        fadingIn = false;
        startIdleTimer();
      }
    }, 16);
  }

  // ==== navigation ====
  function goBack() {
    if (fadingIn) return;
    try {
      include('../download0/themes/Artemis/main.js');
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