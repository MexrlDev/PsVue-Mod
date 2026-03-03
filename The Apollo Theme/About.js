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

  var APOLLO_VERSION = '0.0.1';

  // ==================== KEY CODES ====================
  var KEY_UP = 4, KEY_DOWN = 6, KEY_LEFT = 7, KEY_RIGHT = 5;
  var KEY_CROSS = 13, KEY_CIRCLE = 14, KEY_L1 = 10, KEY_ESC = 41;
  var BACK_KEY = jsmaf.circleIsAdvanceButton ? KEY_CIRCLE : KEY_CROSS;

  // ==================== GLOBAL STATE ====================
  var state = 'ABOUT';
  var memorialInterval = null;
  var sx = SCREEN_WIDTH;

  // UI elements.. and whatever lol 
  var background, headerIcon, titleText, versionText;
  var logoText, ps4VersionText;
  var creditNames = [], creditValues = [];
  var helpImage, memorialLine, smallLeonLuna;
  var leonLunaImage, memorialHelp;
  var sinChars = [];
  var backHint;

  // Music
  var bgm = null;

  // ==================== STYLES ====================
  new Style({ name: 'headerTitle', color: 'white', size: 48, align: 'left' });
  new Style({ name: 'version', color: 'rgb(180,180,180)', size: 32, align: 'left' });
  new Style({ name: 'ps4Version', color: 'white', size: 36, align: 'center' });
  new Style({ name: 'creditLeft', color: 'white', size: 28, align: 'right' });
  new Style({ name: 'creditRight', color: 'white', size: 28, align: 'left' });
  new Style({ name: 'memorialText', color: 'white', size: 64, align: 'left' });

  // ==================== CONSOLE IDS ====================
  
  // this isnt used anymore lol, it was supposed to be in the about ui too but.. didnt fit so i kept it like this 
  var user_id = 0x12345678;
  var account_id = 0x123456789ABCDEF0;
  var psid_high = 0x1122334455667788;
  var psid_low = 0x99AABBCCDDEEFF00;

  function formatHex(val, digits) {
    var s = val.toString(16).toUpperCase();
    while (s.length < digits) s = '0' + s;
    return s;
  }

  var user_id_str = formatHex(user_id, 8);
  var account_id_str = formatHex(account_id, 16);
  var psid_str = formatHex(psid_high, 16) + ' ' + formatHex(psid_low, 16);

  // ==================== CREDIT STRINGS ====================
  // to add new credit you just add 'name', 'developer or something', under the older string
  var menu_about_strings = [
    'PsVue Theme', 'credits:',
    'Mexrldev', 'Developer',
    '', '',
    'Vue A-Free', 'credits:',
    'ufm42', 'Userland Exploit',
    'c0w-ar', 'Lapse and NetCtrl porting',
    'earthonion', 'Original UI, initial JS injection, NetCtrl Porting',
    'HelloYunho', 'TypeScript port',
    'Gezine', 'Local JS method and PSN bypass research',
    'D-Link Turtle', 'General support for userland exploition',
    'Dr.YenYen', 'Extensive testing, end‑user support/ideas',
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

  logoText = new Image({
    url: IMG_PATH + 'logo_text.png',
    x: (SCREEN_WIDTH - 600) / 2, y: 110,
    width: 600, height: 100
  });
  jsmaf.root.children.push(logoText);

  // ==================== HELP IMAGE ====================
  helpImage = new Image({
    url: IMG_PATH + 'help.png',
    x: 0, y: 200,
    width: SCREEN_WIDTH, height: 750
  });
  jsmaf.root.children.push(helpImage);

  // PlayStation Vue Version text, so you user can edit it snd whatever
  var centerX = SCREEN_WIDTH / 2;
  var colGap = 100;
  ps4VersionText = new jsmaf.Text();
  ps4VersionText.text = 'PlayStation Vue Version';
  ps4VersionText.style = 'ps4Version';
  ps4VersionText.x = centerX - colGap; // 
  ps4VersionText.y = 220;
  jsmaf.root.children.push(ps4VersionText);

  // ==================== CENTERED CREDITS BLOCK ====================
  var lineSpacing = 30;
  var headerBottom = 200;
  var memorialTop = 850;
  var contentHeight = memorialTop - headerBottom;
  var numRows = menu_about_strings.length / 2;
  var blockHeight = numRows * lineSpacing;
  var startY = headerBottom + (contentHeight - blockHeight) / 2 + 60; //

  // Credits config position
  for (var i = 0; i < menu_about_strings.length; i += 2) {
    var y = startY + (i / 2) * lineSpacing;

    var leftText = new jsmaf.Text();
    leftText.text = menu_about_strings[i];
    leftText.style = 'creditLeft';
    leftText.x = centerX - colGap;
    leftText.y = y;
    jsmaf.root.children.push(leftText);
    creditNames.push(leftText);

    var rightText = new jsmaf.Text();
    rightText.text = menu_about_strings[i + 1];
    rightText.style = 'creditRight';
    rightText.x = centerX + colGap;
    rightText.y = y;
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
    visible: true
  });
  jsmaf.root.children.push(smallLeonLuna);

  var textX = imageX;
  var textY = imageY - 40;
  memorialLine = new jsmaf.Text();
  memorialLine.text = 'in memory of Leon & Luna';
  memorialLine.style = 'version';
  memorialLine.x = textX;
  memorialLine.y = textY;
  jsmaf.root.children.push(memorialLine);

  // ==================== MEMORIAL SCREEN ELEMENTS ====================
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

  // Sine animation characters
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

  // ==================== MUSIC FUNCTIONS ====================
  function startMusic() {
    if (!bgm) {
      try {
        bgm = new jsmaf.AudioClip();
        bgm.open(SONG_PATH);
        bgm.volume = 0.5;
      } catch (e) {
        log('Error loading music: ' + e.message);
        return;
      }
    }
    bgm.play(true);
  }

  function stopMusic() {
    if (bgm && bgm.stop) {
      bgm.stop();
    }
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
    creditNames.forEach(t => t.visible = true);
    creditValues.forEach(t => t.visible = true);
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
    stopMusic();
    stopMemorialAnimation();
    var theme = 'default';
    if (typeof CONFIG !== 'undefined' && CONFIG.theme) {
      theme = CONFIG.theme;
    }
    try {
      include('themes/' + theme + '/main.js');
    } catch (e) {
      log('ERROR loading main menu: ' + e.message);
      include('themes/default/main.js');
    }
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

  // ==================== INIT ====================
  showNormal();
  startMusic();
  log('About menu loaded');
})();