(function () {
  // ---------- Configuration ----------
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var CENTER_X = SCREEN_W / 2;
  var ASSET_PATH = 'file:///../download0/themes/Artemis/data/';

  // UI dimensions
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
  var LIST_HORIZONTAL_OFFSET = -150;
  var LIST_CENTER_X = CENTER_X + LIST_HORIZONTAL_OFFSET;
  
  var ARROW_W = 52;
  var ARROW_H = 42;

  var GAP_BETWEEN_ARROW_AND_TEXT = 300;
  var TEXT_WIDTH = 600;
  var ARROW_X_BASE = LIST_CENTER_X - TEXT_WIDTH/2 - ARROW_W - GAP_BETWEEN_ARROW_AND_TEXT;
  var ARROW_X_OFFSET = -20;
  var ARROW_X = ARROW_X_BASE + ARROW_X_OFFSET;
  var SMALL_TEXT_GAP = 12;
  var TEXT_X = ARROW_X + ARROW_W + SMALL_TEXT_GAP;
  
  var META_CODE = 'CUSA00960';
  var META_VERSION = 'v01.24';
  var META_GAP = 18;
  var META_CODE_VER_GAP = 20;
  var META_SHIFT_X = 450;
  var META_VER_SHIFT = 80;
  var CODE_EST_WIDTH = 200;

  var LIST_START_Y = 550;
  var ITEM_HEIGHT = 55;
  var VISIBLE_TOP = 200;
  var VISIBLE_BOTTOM = 900;

  // Selection bar
  var SEL_BAR_HEIGHT = 50;
  var SEL_BAR_X = 0;
  var SEL_BAR_WIDTH = SCREEN_W;

  // Footer
  var FOOTER_Y = SCREEN_H - 100;
  var FOOTER_ICON_SIZE = 32;
  var FOOTER_TEXT_SIZE = 36;
  var FOOTER_GAP_ICON_TEXT = 10;
  var FOOTER_GAP_SELECT_BACK = 200;

  // Scrollbar positioning
  var SCROLLBAR_GAP = 30;
  var SCROLLBAR_X = SCREEN_W - SCROLLBAR_GAP - 10;
  var SCROLLBAR_Y = VISIBLE_TOP;
  var SCROLLBAR_HEIGHT = VISIBLE_BOTTOM - VISIBLE_TOP;

  var TEXT_OFFSET = (ITEM_HEIGHT - 38) / 2;
  var FIXED_SELECTION_Y = LIST_START_Y + TEXT_OFFSET;

  var lineExpandDelaySec = 0.5;
  var lineExpandDurationSec = 1.5;
  var lineExpandDelayMs = Math.round(lineExpandDelaySec * 1000);
  var lineExpandDurationMs = Math.round(lineExpandDurationSec * 1000);

  // ---------- Global Variables ----------
  var currentIndex = 0;
  var scrollOffset = 0;
  var fileList = [];
  var payloadTexts = [];
  var codeTexts = [];
  var verTexts = [];                     // metadata version text objects
  var arrowImg = null;
  var lineImg = null;
  var iconImg = null;
  var titleRight = null;                  // "Payload Menu" (right)
  var titleLeft = null;                   // "Cheats" (left)
  var selBarImg = null;                    // selection bar image
  var footerSelectIcon = null;             // cross icon
  var footerSelectText = null;             // "Select" text
  var footerBackIcon = null;               // circle icon
  var footerBackText = null;               // "Back" text
  var scrollBg = null;                      // scroll track image
  var scrollLock = null;                    // scroll thumb image
  var fadeElements = [];                   // all elements that fade
  var fadeInterval = null;
  var fadingIn = true;
  var pressedKeys = {};                    // simple debounce

  // Estimated text height for centering
  var TEXT_HEIGHT = 38;

  // ---------- Jailbreak & File Scanning ----------
  if (typeof libc_addr === 'undefined') {
    log('Loading userland.js...');
    include('userland.js');
  }

  fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(0x06, 'close_sys', ['bigint'], 'bigint');
  fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint');

  log('Scanning /download0/payloads for files...');
  var path_addr = mem.malloc(256);
  for (var i = 0; i < '/download0/payloads'.length; i++) {
    mem.view(path_addr).setUint8(i, '/download0/payloads'.charCodeAt(i));
  }
  mem.view(path_addr).setUint8('/download0/payloads'.length, 0);

  var fd = fn.open_sys(path_addr, new BigInt(0, 0), new BigInt(0, 0));
  if (!fd.eq(new BigInt(0xffffffff, 0xffffffff))) {
    var buf = mem.malloc(4096);
    var count = fn.getdents(fd, buf, new BigInt(0, 4096));
    if (!count.eq(new BigInt(0xffffffff, 0xffffffff)) && count.lo > 0) {
      var offset = 0;
      while (offset < count.lo) {
        var d_reclen = mem.view(buf.add(new BigInt(0, offset + 4))).getUint16(0, true);
        var d_type = mem.view(buf.add(new BigInt(0, offset + 6))).getUint8(0);
        var d_namlen = mem.view(buf.add(new BigInt(0, offset + 7))).getUint8(0);
        var name = '';
        for (var j = 0; j < d_namlen; j++) {
          name += String.fromCharCode(mem.view(buf.add(new BigInt(0, offset + 8 + j))).getUint8(0));
        }
        if (d_type === 8 && name !== '.' && name !== '..') {
          var lower = name.toLowerCase();
          if (lower.endsWith('.elf') || lower.endsWith('.bin') || lower.endsWith('.js')) {
            fileList.push(name);
          }
        }
        offset += d_reclen;
      }
    }
    fn.close_sys(fd);
  } else {
    log('Failed to open /download0/payloads');
  }
  log('Total payloads found: ' + fileList.length);

  // ---------- Styles ----------
  new Style({ name: 'title', color: 'black', size: 32 });
  new Style({ name: 'listText', color: 'black', size: 36, bold: true });
  new Style({ name: 'metaCode', color: 'black', size: 34 });
  // metaVer matches metaCode so both display identically
  new Style({ name: 'metaVer', color: 'black', size: 34 });
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

    // Icon
    iconImg = new Image({
      url: ASSET_PATH + 'titlescr_ico_cht-ico.png',
      x: ICON_X,
      y: ICON_Y,
      width: ICON_W,
      height: ICON_H,
      alpha: 0.0
    });
    jsmaf.root.children.push(iconImg);
    fadeElements.push(iconImg);

    // Black line
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

    // title: "Payload Menu"
    titleRight = new jsmaf.Text();
    titleRight.text = 'Payload Menu';
    titleRight.style = 'title';
    titleRight.x = TITLE_RIGHT_X - 200;
    titleRight.y = TITLE_Y;
    titleRight.alpha = 0.0;
    jsmaf.root.children.push(titleRight);
    fadeElements.push(titleRight);

    // title: "Cheats"
    titleLeft = new jsmaf.Text();
    titleLeft.text = 'Cheats';
    titleLeft.style = 'title';
    titleLeft.x = TITLE_LEFT_X;
    titleLeft.y = TITLE_Y;
    titleLeft.alpha = 0.0;
    jsmaf.root.children.push(titleLeft);
    fadeElements.push(titleLeft);

    // Selection bar
    selBarImg = new Image({
      url: ASSET_PATH + 'sel_bar1.png',
      x: SEL_BAR_X,
      y: LIST_START_Y, // temporary, will be updated
      width: SEL_BAR_WIDTH,
      height: SEL_BAR_HEIGHT,
      alpha: 0.0
    });
    jsmaf.root.children.push(selBarImg);
    fadeElements.push(selBarImg);

    arrowImg = new Image({
      url: ASSET_PATH + 'arrow.png',
      x: ARROW_X,
      y: LIST_START_Y,
      width: ARROW_W,
      height: ARROW_H,
      alpha: 0.0
    });
    jsmaf.root.children.push(arrowImg);
    fadeElements.push(arrowImg);

    for (var i = 0; i < fileList.length; i++) {
      var txt = new jsmaf.Text();
      txt.text = fileList[i];
      txt.style = 'listText';
      txt.x = TEXT_X;
      txt.y = LIST_START_Y + i * ITEM_HEIGHT + TEXT_OFFSET;
      txt.alpha = 0.0;
      payloadTexts.push(txt);
      jsmaf.root.children.push(txt);
      fadeElements.push(txt);
      
      var codeTxt = new jsmaf.Text();
      codeTxt.text = META_CODE;
      codeTxt.style = 'metaCode';
      codeTxt.x = TEXT_X + TEXT_WIDTH + META_GAP + META_SHIFT_X;
      codeTxt.y = txt.y;
      codeTxt.alpha = 0.0;
      codeTexts.push(codeTxt);
      jsmaf.root.children.push(codeTxt);
      fadeElements.push(codeTxt);

      var versionTxt = new jsmaf.Text();
      versionTxt.text = META_VERSION;
      versionTxt.style = 'metaCode';
      versionTxt.x = codeTxt.x + CODE_EST_WIDTH + META_CODE_VER_GAP + META_VER_SHIFT;
      versionTxt.y = txt.y;
      versionTxt.alpha = 0.0;
      verTexts.push(versionTxt);
      jsmaf.root.children.push(versionTxt);
      fadeElements.push(versionTxt);
    }

    // If no payloads, show a message (also add metadata placeholders)
    if (fileList.length === 0) {
      var noPayloads = new jsmaf.Text();
      noPayloads.text = 'No payloads found';
      noPayloads.style = 'listText';
      noPayloads.x = TEXT_X;
      noPayloads.y = LIST_START_Y + TEXT_OFFSET;
      noPayloads.alpha = 0.0;
      payloadTexts.push(noPayloads);
      jsmaf.root.children.push(noPayloads);
      fadeElements.push(noPayloads);

      var codeTxt = new jsmaf.Text();
      codeTxt.text = META_CODE;
      codeTxt.style = 'metaCode';
      codeTxt.x = TEXT_X + TEXT_WIDTH + META_GAP + META_SHIFT_X;
      codeTxt.y = noPayloads.y;
      codeTxt.alpha = 0.0;
      codeTexts.push(codeTxt);
      jsmaf.root.children.push(codeTxt);
      fadeElements.push(codeTxt);

      var versionTxt = new jsmaf.Text();
      versionTxt.text = META_VERSION;
      versionTxt.style = 'metaCode';
      versionTxt.x = codeTxt.x + CODE_EST_WIDTH + META_CODE_VER_GAP + META_VER_SHIFT;
      versionTxt.y = noPayloads.y;
      versionTxt.alpha = 0.0;
      verTexts.push(versionTxt);
      jsmaf.root.children.push(versionTxt);
      fadeElements.push(versionTxt);
    }

    // ---------- Scrollbar ----------
    scrollBg = new Image({
      url: ASSET_PATH + 'scroll_bg.png',
      x: SCROLLBAR_X,
      y: SCROLLBAR_Y,
      width: 10,
      height: SCROLLBAR_HEIGHT,
      alpha: 0.0
    });
    jsmaf.root.children.push(scrollBg);
    fadeElements.push(scrollBg);

    scrollLock = new Image({
      url: ASSET_PATH + 'scroll_lock.png',
      x: SCROLLBAR_X,
      y: SCROLLBAR_Y,
      width: 10,
      height: 74,
      alpha: 0.0
    });
    jsmaf.root.children.push(scrollLock);
    fadeElements.push(scrollLock);

    // ---------- Footer ----------
    var selectSectionWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 100;
    var backSectionWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 80;
    var totalWidth = selectSectionWidth + FOOTER_GAP_SELECT_BACK + backSectionWidth;
    var startX = (SCREEN_W - totalWidth) / 2;

    // Select icon
    footerSelectIcon = new Image({
      url: ASSET_PATH + 'footer_ico_cross.png',
      x: startX,
      y: FOOTER_Y - FOOTER_ICON_SIZE / 2,
      width: FOOTER_ICON_SIZE,
      height: FOOTER_ICON_SIZE,
      alpha: 0.0
    });
    jsmaf.root.children.push(footerSelectIcon);
    fadeElements.push(footerSelectIcon);

    // Select text
    footerSelectText = new jsmaf.Text();
    footerSelectText.text = 'Select';
    footerSelectText.style = 'footerText';
    footerSelectText.x = startX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerSelectText.y = FOOTER_Y - 18;
    footerSelectText.alpha = 0.0;
    jsmaf.root.children.push(footerSelectText);
    fadeElements.push(footerSelectText);

    // Back icon
    var backStartX = startX + selectSectionWidth + FOOTER_GAP_SELECT_BACK;
    footerBackIcon = new Image({
      url: ASSET_PATH + 'footer_ico_circle.png',
      x: backStartX,
      y: FOOTER_Y - FOOTER_ICON_SIZE / 2,
      width: FOOTER_ICON_SIZE,
      height: FOOTER_ICON_SIZE,
      alpha: 0.0
    });
    jsmaf.root.children.push(footerBackIcon);
    fadeElements.push(footerBackIcon);

    // Back text
    footerBackText = new jsmaf.Text();
    footerBackText.text = 'Back';
    footerBackText.style = 'footerText';
    footerBackText.x = backStartX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerBackText.y = FOOTER_Y - 18;
    footerBackText.alpha = 0.0;
    jsmaf.root.children.push(footerBackText);
    fadeElements.push(footerBackText);

    // Initial update of positions
    updateListPositions();

    // Start fade-in and line expansion
    startFadeIn();
  }

  // ---------- Fade-in and line animation ----------
  function startFadeIn() {
    var startTime = Date.now();
    var fadeDuration = 7500;

    // use editable ms variables for delay/duration
    var lineExpandDelay = lineExpandDelayMs; // ms
    var lineExpandDuration = lineExpandDurationMs; // ms

    fadeInterval = jsmaf.setInterval(function() {
      var elapsed = Date.now() - startTime;
      var t = Math.min(elapsed / fadeDuration, 1);

      // compute line progress with initial delay
      var lineElapsed = Math.max(0, elapsed - lineExpandDelay);
      var lineT = Math.min(lineElapsed / lineExpandDuration, 1);

      for (var i = 0; i < fadeElements.length; i++) {
        fadeElements[i].alpha = t;
      }

      lineImg.width = LINE_TARGET_W * lineT;

      if (t >= 1) {
        jsmaf.clearInterval(fadeInterval);
        fadeInterval = null;
        // Ensure final alpha is set
        for (var i = 0; i < fadeElements.length; i++) {
          fadeElements[i].alpha = 1.0;
        }
        lineImg.width = LINE_TARGET_W;
      }
    }, 16);

    jsmaf.setTimeout(function() {
      fadingIn = false;
      updateListPositions();
    }, 2000);
  }

  // ---------- Update list positions based on scroll ----------
  function updateListPositions() {
    if (scrollOffset < 0) scrollOffset = 0;

    for (var i = 0; i < payloadTexts.length; i++) {
      var baseY = LIST_START_Y + i * ITEM_HEIGHT + TEXT_OFFSET;
      var y = baseY - scrollOffset;
      payloadTexts[i].y = y;
      var codeX = TEXT_X + TEXT_WIDTH + META_GAP + META_SHIFT_X;
      var versionX = codeX + CODE_EST_WIDTH + META_CODE_VER_GAP + META_VER_SHIFT;
      if (codeTexts[i]) { codeTexts[i].x = codeX; codeTexts[i].y = y; }
      if (verTexts[i]) { verTexts[i].x = versionX; verTexts[i].y = y; }
      
      if (y < VISIBLE_TOP - TEXT_HEIGHT || y > VISIBLE_BOTTOM) {
        payloadTexts[i].visible = false;
        if (codeTexts[i]) codeTexts[i].visible = false;
        if (verTexts[i]) verTexts[i].visible = false;
      } else {
        payloadTexts[i].visible = true;
        if (codeTexts[i]) codeTexts[i].visible = true;
        if (verTexts[i]) verTexts[i].visible = true;
      }
    }

    // Update arrow position to current selection
    if (fileList.length > 0) {
      var arrowBaseY = LIST_START_Y + currentIndex * ITEM_HEIGHT;
      // Center arrow vertically within the item slot
      arrowImg.y = arrowBaseY - scrollOffset + (ITEM_HEIGHT - ARROW_H) / 2;
      // Ensure arrow is visible only if the item is visible
      if (arrowImg.y < VISIBLE_TOP - ARROW_H || arrowImg.y > VISIBLE_BOTTOM) {
        arrowImg.visible = false;
      } else {
        arrowImg.visible = true;
      }
    }

    // Update selection bar position
    if (fileList.length > 0) {
      var selectedTextY = LIST_START_Y + currentIndex * ITEM_HEIGHT + TEXT_OFFSET - scrollOffset;
   
      selBarImg.y = selectedTextY - (SEL_BAR_HEIGHT - TEXT_HEIGHT) / 2;
      if (selBarImg.y < VISIBLE_TOP - SEL_BAR_HEIGHT || selBarImg.y > VISIBLE_BOTTOM) {
        selBarImg.visible = false;
      } else {
        selBarImg.visible = true;
      }
    } else {
      selBarImg.visible = false;
    }

    if (fileList.length > 0) {
      scrollBg.visible = true;
      scrollLock.visible = true;

      var thumbHeight = 74;
      var trackHeight = SCROLLBAR_HEIGHT;

      if (fileList.length === 1) {
        scrollLock.y = SCROLLBAR_Y;
      } else {
        var progress = currentIndex / (fileList.length - 1);
        var thumbY = SCROLLBAR_Y + progress * (trackHeight - thumbHeight);
        thumbY = Math.max(SCROLLBAR_Y, Math.min(SCROLLBAR_Y + trackHeight - thumbHeight, thumbY));
        scrollLock.y = thumbY;
      }
    } else {
      scrollBg.visible = false;
      scrollLock.visible = false;
    }
  }

  function moveUp() {
    if (fileList.length === 0) return;

    // Update index with wrap
    if (currentIndex === 0) {
      currentIndex = fileList.length - 1;
    } else {
      currentIndex--;
    }

    scrollOffset = currentIndex * ITEM_HEIGHT;

    updateListPositions();
  }

  function moveDown() {
    if (fileList.length === 0) return;

    if (currentIndex === fileList.length - 1) {
      currentIndex = 0;
    } else {
      currentIndex++;
    }

    scrollOffset = currentIndex * ITEM_HEIGHT;

    updateListPositions();
  }

  // ---------- Handle payload selection ----------
  function handleSelect() {
    if (fadingIn) return;
    if (fileList.length === 0) return;
    var selectedFile = fileList[currentIndex];
    log('Selected: ' + selectedFile);
    var filePath = '/download0/payloads/' + selectedFile;
    try {
      if (selectedFile.toLowerCase().endsWith('.js')) {
        log('Including JavaScript payload: ' + selectedFile);
        include('payloads/' + selectedFile);
      } else {
        log('Loading binloader.js...');
        include('binloader.js');
        var { bl_load_from_file } = binloader_init();
        bl_load_from_file(filePath);
      }
    } catch (e) {
      log('ERROR loading payload: ' + e.message);
      if (e.stack) log(e.stack);
    }
  }

  // ---------- Go back to main menu ----------
  function goBack() {
    if (fadingIn) return;
    log('Returning to main menu...');
    try {
      include('../download0/themes/Artemis/main.js');
    } catch (e) {
      log('ERROR loading main.js: ' + e.message);
    }
  }

  // ---------- Keyboard Handling ----------
  jsmaf.onKeyDown = function (keyCode) {
    if (fadingIn) return;
    if (pressedKeys[keyCode]) return;
    pressedKeys[keyCode] = true;


    if (keyCode === 4 || keyCode === 7 || keyCode === 55) {
      moveUp();
    }

    else if (keyCode === 6 || keyCode === 57) {
      moveDown();
    }

    else if (keyCode === 14) {
      handleSelect();
    }

    else if (keyCode === 27) {
      goBack();
    }

    else if (keyCode === 13) {
      goBack();
    }
  };

  jsmaf.onKeyUp = function (keyCode) {
    delete pressedKeys[keyCode];
  };

  // ---------- Start ----------
  buildUI();
  log('Payload menu loaded – ' + fileList.length + ' payloads');
})();