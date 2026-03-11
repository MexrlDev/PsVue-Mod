(function () {
  // ---------- Configuration ----------
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var CENTER_X = SCREEN_W / 2;
  var ASSET_PATH = 'file:///../download0/themes/Cheat Manger/data/';

  // UI dimensions
  var ICON_X = 50;
  var ICON_Y = 50;
  var ICON_W = 130;
  var ICON_H = 138;

  // ----- Icon offsets -----
  var ICON_OFFSET_X = 49;
  var ICON_OFFSET_Y = 6;

  var TOP_GROUP_OFFSET_X = -50;

  var LINE_X = ICON_X + ICON_W + 20;
  var LINE_Y = 150;
  var LINE_H = 4;

  var TITLE_RIGHT_X = 1800;
  var TITLE_LEFT_X = LINE_X + 20;
  var TITLE_Y = LINE_Y - 60;

  var PAYLOAD_COUNTER_OFFSET_X = -54;

  var LIST_HORIZONTAL_OFFSET = -150;
  var LIST_CENTER_X = CENTER_X + LIST_HORIZONTAL_OFFSET;
  
  var ARROW_W = 52;
  var ARROW_H = 42;

  var GAP_BETWEEN_ARROW_AND_TEXT = 300;
  var TEXT_WIDTH = 600;
  var ARROW_X_BASE = LIST_CENTER_X - TEXT_WIDTH/2 - ARROW_W - GAP_BETWEEN_ARROW_AND_TEXT;

  var ARROW_X_OFFSET = -87;
  var ARROW_X = ARROW_X_BASE + ARROW_X_OFFSET;

  // ----- Gap between arrow and text -----
  var ARROW_TO_TEXT_GAP = 12;
  var TEXT_X_BASE = ARROW_X + ARROW_W + ARROW_TO_TEXT_GAP;

  // ----- Payload text X offset -----
  var PAYLOAD_TEXT_OFFSET_X = 0;
  var TEXT_X = TEXT_X_BASE + PAYLOAD_TEXT_OFFSET_X;
  
  var META_CODE = 'CUSA00960';
  var META_VERSION = 'v01.24';
  var META_GAP = 18;
  var META_CODE_VER_GAP = 20;
  var META_SHIFT_X = 450;
  var META_VER_SHIFT = 80;
  var CODE_EST_WIDTH = 200;

  // ----- Tag image -----
  var TAG_W = 58;
  var TAG_H = 28;
  var TAG_GAP = -80;

  var LIST_START_Y = 550;
  var ITEM_HEIGHT = 55;
  var VISIBLE_TOP = 200;
  var VISIBLE_BOTTOM = 900;

  // ----- Help image background -----
  var HELP_IMG_PADDING = 20;
  var HELP_IMG_DEFAULT_X = 0;
  var HELP_IMG_DEFAULT_Y = VISIBLE_TOP - HELP_IMG_PADDING;
  var HELP_IMG_DEFAULT_WIDTH = SCREEN_W;
  var HELP_IMG_DEFAULT_HEIGHT = (VISIBLE_BOTTOM - VISIBLE_TOP) + 2 * HELP_IMG_PADDING;
  
  var HELP_IMG_WIDTH_OVERRIDE = 1760;
  var HELP_IMG_HEIGHT_OVERRIDE = 0;
  var HELP_IMG_BOTTOM_EXPAND = 50;
  var FADE_DISTANCE = 200;
  
  // Selection bar
  var SEL_BAR_HEIGHT = 50;
  var SEL_BAR_X = 0;
  var SEL_BAR_WIDTH = SCREEN_W;

  // Footer
  var FOOTER_Y = SCREEN_H - 100;
  var FOOTER_ICON_SIZE = 32;
  var FOOTER_TEXT_SIZE = 36;
  var FOOTER_GAP_ICON_TEXT = 10;
  var FOOTER_GAP_SELECT_BACK = 100;
  var FOOTER_GAP_BACK_FILTER = 100;
  var FOOTER_GAP_FILTER_REFRESH = 100;
  var FOOTER_Y_OFFSET = 20;
  
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

  // ---------- Filter Modes ----------
  var filterMode = 0;
  var filterModeNames = ['All', 'BIN', 'ELF', 'JS'];

  // ---------- Global Variables ----------
  var currentIndex = 0;
  var scrollOffset = 0;
  var fileListFull = [];                   // all payloads from scan
  var fileList = [];                        // filtered list
  var payloadTexts = [];
  var codeTexts = [];
  var verTexts = [];                         // metadata version text objects
  var arrowImg = null;
  var lineImg = null;
  var iconImg = null;
  var titleRight = null;                      // "Payloads: X" text
  var titleLeft = null;                       // "Cheats" text
  var selBarImg = null;                        // selection bar image
  var footerSelectIcon = null;                 // cross icon
  var footerSelectText = null;                 // "Select" text
  var footerBackIcon = null;                   // circle icon
  var footerBackText = null;                   // "Back" text
  var footerFilterIcon = null;                 // triangle icon
  var footerFilterText = null;                 // "Filter" text
  var footerRefreshIcon = null;                // refresh icon (square)
  var footerRefreshText = null;                // "Refresh" text
  var scrollBg = null;                          // scroll track image
  var scrollLock = null;                        // scroll thumb image
  var helpBgImg = null;                         // help background image
  var tagImg = null;                             // tag image for current selection
  var fadeElements = [];                       // elements that fade globally (excluding list texts)
  var fadeInterval = null;
  var fadingIn = true;
  var currentT = 0;                             // global fade progress (0..1)
  var pressedKeys = {};                        // simple debounce
  // Computed line target width (set in buildUI)
  var actualLineTargetW = 1600;                  // fallback

  // Estimated text height for centering
  var TEXT_HEIGHT = 38;

  // ---------- Helper utilities ----------
  function writeStringToHeap(addr, s, maxLen) {
    var len = Math.min(s.length, maxLen ? maxLen - 1 : s.length);
    for (var i = 0; i < len; i++) {
      mem.view(addr).setUint8(i, s.charCodeAt(i));
    }
    mem.view(addr).setUint8(len, 0);
    return len;
  }

  function readBytesFromAddr(addr, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push(mem.view(addr.add(new BigInt(0, i))).getUint8(0));
    }
    return out;
  }

  function isElfMagic(bufferAddr) {
    try {
      var b0 = mem.view(bufferAddr).getUint8(0);
      var b1 = mem.view(bufferAddr.add(new BigInt(0,1))).getUint8(0);
      var b2 = mem.view(bufferAddr.add(new BigInt(0,2))).getUint8(0);
      var b3 = mem.view(bufferAddr.add(new BigInt(0,3))).getUint8(0);
      return (b0 === 0x7f && b1 === 0x45 && b2 === 0x4c && b3 === 0x46);
    } catch (e) {
      return false;
    }
  }

  // ---------- Scan payloads ----------
  function scanPayloads() {
    var newList = [];
    log('Scanning /download0/payloads for files...');
    var path_addr = mem.malloc(256);
    writeStringToHeap(path_addr, '/download0/payloads', 256);

    var fd = fn.open_sys(path_addr, new BigInt(0, 0), new BigInt(0, 0));
    if (!fd.eq(new BigInt(0xffffffff, 0xffffffff))) {
      var buf = mem.malloc(4096);
      var count = fn.getdents(fd, buf, new BigInt(0, 4096));
      if (!count.eq(new BigInt(0xffffffff, 0xffffffff)) && count.lo > 0) {
        var offset = 0;
        var maxCount = count.lo;
        while (offset < maxCount) {
          if (offset + 8 > maxCount) {
            log('getdents: insufficient bytes for dirent header; breaking');
            break;
          }
          var reclenAddr = buf.add(new BigInt(0, offset + 4));
          var d_reclen = mem.view(reclenAddr).getUint16(0, true);
          if (!d_reclen || d_reclen <= 0) {
            log('getdents: invalid d_reclen=' + d_reclen + ' at offset ' + offset + '; breaking');
            break;
          }
          if (offset + d_reclen > maxCount) {
            log('getdents: reclen extends past buffer; breaking');
            break;
          }
          var d_type = mem.view(buf.add(new BigInt(0, offset + 6))).getUint8(0);
          var d_namlen = mem.view(buf.add(new BigInt(0, offset + 7))).getUint8(0);
          if (d_namlen === 0 || d_namlen > d_reclen) {
            offset += d_reclen;
            continue;
          }
          var name = '';
          for (var j = 0; j < d_namlen; j++) {
            try {
              name += String.fromCharCode(mem.view(buf.add(new BigInt(0, offset + 8 + j))).getUint8(0));
            } catch (e) {
              break;
            }
          }
          if (d_type === 8 && name !== '.' && name !== '..') {
            var lower = name.toLowerCase();
            if (lower.endsWith('.elf') || lower.endsWith('.bin') || lower.endsWith('.js')) {
              newList.push(name);
              log('Found payload: ' + name);
            }
          }
          offset += d_reclen;
        }
      } else {
        log('getdents returned no entries or error: ' + count.toString());
      }
      fn.close_sys(fd);
    } else {
      log('Failed to open /download0/payloads (open_sys returned -1)');
    }
    mem.free && mem.free(path_addr);
    mem.free && mem.free(buf);
    return newList;
  }

  // ---------- Filter function ----------
  function applyFilter() {
    var filtered = [];
    for (var i = 0; i < fileListFull.length; i++) {
      var f = fileListFull[i];
      var ext = f.split('.').pop().toLowerCase();
      if (filterMode === 0) filtered.push(f);
      else if (filterMode === 1 && ext === 'bin') filtered.push(f);
      else if (filterMode === 2 && ext === 'elf') filtered.push(f);
      else if (filterMode === 3 && ext === 'js') filtered.push(f);
    }
    fileList = filtered;
    // Reset selection
    currentIndex = 0;
    scrollOffset = 0;
    // Update title text with new count
    if (titleRight) {
      titleRight.text = 'Payloads: ' + fileList.length;
    }
    // Rebuild list texts
    rebuildListTexts();
    updateListPositions();
  }

  // ---------- Rebuild list texts (after filter change or refresh) ----------
  function rebuildListTexts() {
    // Remove old text elements from root
    for (var i = 0; i < payloadTexts.length; i++) {
      var idx = jsmaf.root.children.indexOf(payloadTexts[i]);
      if (idx >= 0) jsmaf.root.children.splice(idx, 1);
    }
    for (var i = 0; i < codeTexts.length; i++) {
      var idx = jsmaf.root.children.indexOf(codeTexts[i]);
      if (idx >= 0) jsmaf.root.children.splice(idx, 1);
    }
    for (var i = 0; i < verTexts.length; i++) {
      var idx = jsmaf.root.children.indexOf(verTexts[i]);
      if (idx >= 0) jsmaf.root.children.splice(idx, 1);
    }

    payloadTexts = [];
    codeTexts = [];
    verTexts = [];

    // Create new texts for filtered list
    for (var i = 0; i < fileList.length; i++) {
      var txt = new jsmaf.Text();
      txt.text = fileList[i];
      txt.style = 'listText';
      txt.x = TEXT_X;
      txt.y = LIST_START_Y + i * ITEM_HEIGHT + TEXT_OFFSET;
      txt.alpha = currentT;
      payloadTexts.push(txt);
      jsmaf.root.children.push(txt);
      
      var codeTxt = new jsmaf.Text();
      codeTxt.text = META_CODE;
      codeTxt.style = 'metaCode';
      codeTxt.x = TEXT_X + TEXT_WIDTH + META_GAP + META_SHIFT_X;
      codeTxt.y = txt.y;
      codeTxt.alpha = currentT;
      codeTexts.push(codeTxt);
      jsmaf.root.children.push(codeTxt);

      var versionTxt = new jsmaf.Text();
      versionTxt.text = META_VERSION;
      versionTxt.style = 'metaCode';
      versionTxt.x = codeTxt.x + CODE_EST_WIDTH + META_CODE_VER_GAP + META_VER_SHIFT;
      versionTxt.y = txt.y;
      versionTxt.alpha = currentT;
      verTexts.push(versionTxt);
      jsmaf.root.children.push(versionTxt);
    }

    // If no payloads, show placeholder
    if (fileList.length === 0) {
      var noPayloads = new jsmaf.Text();
      noPayloads.text = 'No payloads found';
      noPayloads.style = 'listText';
      noPayloads.x = TEXT_X;
      noPayloads.y = LIST_START_Y + TEXT_OFFSET;
      noPayloads.alpha = currentT;
      payloadTexts.push(noPayloads);
      jsmaf.root.children.push(noPayloads);

      var codeTxt = new jsmaf.Text();
      codeTxt.text = META_CODE;
      codeTxt.style = 'metaCode';
      codeTxt.x = TEXT_X + TEXT_WIDTH + META_GAP + META_SHIFT_X;
      codeTxt.y = noPayloads.y;
      codeTxt.alpha = currentT;
      codeTexts.push(codeTxt);
      jsmaf.root.children.push(codeTxt);

      var versionTxt = new jsmaf.Text();
      versionTxt.text = META_VERSION;
      versionTxt.style = 'metaCode';
      versionTxt.x = codeTxt.x + CODE_EST_WIDTH + META_CODE_VER_GAP + META_VER_SHIFT;
      versionTxt.y = noPayloads.y;
      versionTxt.alpha = currentT;
      verTexts.push(versionTxt);
      jsmaf.root.children.push(versionTxt);
    }
  }

  // ---------- Jailbreak & File Scanning ----------
  if (typeof libc_addr === 'undefined') {
    log('Loading userland.js...');
    include('userland.js');
    log('userland.js loaded');
  } else {
    log('userland.js already loaded (libc_addr defined)');
  }

  fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(0x06, 'close_sys', ['bigint'], 'bigint');
  fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(0x03, 'read_sys', ['bigint', 'bigint', 'bigint'], 'bigint');

  fileListFull = scanPayloads();
  fileList = fileListFull.slice();

  // ---------- Styles ----------
  new Style({ name: 'title', color: 'black', size: 48, bold: true });
  new Style({ name: 'listText', color: 'white', size: 36, bold: true });
  new Style({ name: 'metaCode', color: 'white', size: 34 });
  new Style({ name: 'metaVer', color: 'white', size: 34 });
  new Style({ name: 'footerText', color: 'black', size: 36, bold: true });

  // ---------- Audio ----------
  try {
    var bgm = new jsmaf.AudioClip();
    bgm.volume = 0.5;
    bgm.open(ASSET_PATH + 'bg.wav');
    bgm.play(true);
  } catch (e) {
    log('Warning: bgm failed to play: ' + e.message);
  }

  // ---------- Build UI ----------
  function buildUI() {
    jsmaf.root.children.length = 0;

    // Background
    var bg = new Image({
      url: ASSET_PATH + 'bglist.png',
      x: 0, y: 0,
      width: SCREEN_W, height: SCREEN_H
    });
    jsmaf.root.children.push(bg);

    var helpWidth = HELP_IMG_WIDTH_OVERRIDE > 0 ? HELP_IMG_WIDTH_OVERRIDE : HELP_IMG_DEFAULT_WIDTH;
    var helpHeight = (HELP_IMG_HEIGHT_OVERRIDE > 0 ? HELP_IMG_HEIGHT_OVERRIDE : HELP_IMG_DEFAULT_HEIGHT) + HELP_IMG_BOTTOM_EXPAND;
    
    var helpX = Math.round(HELP_IMG_DEFAULT_X + (HELP_IMG_DEFAULT_WIDTH - helpWidth) / 2);
    var helpY = HELP_IMG_DEFAULT_Y;

    helpBgImg = new Image({
      url: ASSET_PATH + 'help.png',
      x: helpX,
      y: helpY,
      width: helpWidth,
      height: helpHeight,
      alpha: 0.0
    });
    jsmaf.root.children.push(helpBgImg);
    fadeElements.push(helpBgImg);

    // ----- Top group elements with X offset -----
    var adjustedLineX = LINE_X + TOP_GROUP_OFFSET_X;
    actualLineTargetW = SCREEN_W - adjustedLineX;
    iconImg = new Image({
      url: ASSET_PATH + 'titlescr_ico_cht-ico.png',
      x: ICON_X + ICON_OFFSET_X + TOP_GROUP_OFFSET_X,
      y: ICON_Y + ICON_OFFSET_Y,
      width: ICON_W,
      height: ICON_H,
      alpha: 0.0
    });
    jsmaf.root.children.push(iconImg);
    fadeElements.push(iconImg);

    lineImg = new Image({
      url: ASSET_PATH + 'black.png',
      x: adjustedLineX,
      y: LINE_Y,
      width: 0,
      height: LINE_H,
      alpha: 0.0
    });
    jsmaf.root.children.push(lineImg);
    fadeElements.push(lineImg);
    
    titleRight = new jsmaf.Text();
    titleRight.text = 'Payloads: ' + fileList.length;
    titleRight.style = 'title';
    titleRight.x = TITLE_RIGHT_X - 200 + PAYLOAD_COUNTER_OFFSET_X + TOP_GROUP_OFFSET_X;
    titleRight.y = TITLE_Y;
    titleRight.alpha = 0.0;
    jsmaf.root.children.push(titleRight);
    fadeElements.push(titleRight);


    titleLeft = new jsmaf.Text();
    titleLeft.text = 'Cheats';
    titleLeft.style = 'title';
    titleLeft.x = TITLE_LEFT_X + TOP_GROUP_OFFSET_X;
    titleLeft.y = TITLE_Y;
    titleLeft.alpha = 0.0;
    jsmaf.root.children.push(titleLeft);
    fadeElements.push(titleLeft);

    selBarImg = new Image({
      url: ASSET_PATH + 'sel_bar1.png',
      x: SEL_BAR_X,
      y: LIST_START_Y,
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

    // ----- Tag images -----
    tagImg = new Image({
      url: '',
      x: 0,
      y: 0,
      width: TAG_W,
      height: TAG_H,
      alpha: 0.0,
      visible: false
    });
    jsmaf.root.children.push(tagImg);

    // ----- List text items -----
    rebuildListTexts();

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

    var selectWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 100;
    var backWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 80;
    var filterWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 120;
    var refreshWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 100;
    var totalWidth = selectWidth + FOOTER_GAP_SELECT_BACK + backWidth + FOOTER_GAP_BACK_FILTER + filterWidth + FOOTER_GAP_FILTER_REFRESH + refreshWidth;
    var startX = (SCREEN_W - totalWidth) / 2;

    // Apply footer Y offset
    var footerIconY = FOOTER_Y - FOOTER_ICON_SIZE / 2 + FOOTER_Y_OFFSET;
    var footerTextY = FOOTER_Y - 18 + FOOTER_Y_OFFSET;

    // Select
    footerSelectIcon = new Image({
      url: ASSET_PATH + 'footer_ico_cross.png',
      x: startX,
      y: footerIconY,
      width: FOOTER_ICON_SIZE,
      height: FOOTER_ICON_SIZE,
      alpha: 0.0
    });
    jsmaf.root.children.push(footerSelectIcon);
    fadeElements.push(footerSelectIcon);

    footerSelectText = new jsmaf.Text();
    footerSelectText.text = 'Select';
    footerSelectText.style = 'footerText';
    footerSelectText.x = startX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerSelectText.y = footerTextY;
    footerSelectText.alpha = 0.0;
    jsmaf.root.children.push(footerSelectText);
    fadeElements.push(footerSelectText);

    // Back
    var backStartX = startX + selectWidth + FOOTER_GAP_SELECT_BACK;
    footerBackIcon = new Image({
      url: ASSET_PATH + 'footer_ico_circle.png',
      x: backStartX,
      y: footerIconY,
      width: FOOTER_ICON_SIZE,
      height: FOOTER_ICON_SIZE,
      alpha: 0.0
    });
    jsmaf.root.children.push(footerBackIcon);
    fadeElements.push(footerBackIcon);

    footerBackText = new jsmaf.Text();
    footerBackText.text = 'Back';
    footerBackText.style = 'footerText';
    footerBackText.x = backStartX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerBackText.y = footerTextY;
    footerBackText.alpha = 0.0;
    jsmaf.root.children.push(footerBackText);
    fadeElements.push(footerBackText);

    // Filter
    var filterStartX = backStartX + backWidth + FOOTER_GAP_BACK_FILTER;
    footerFilterIcon = new Image({
      url: ASSET_PATH + 'footer_ico_triangle.png',
      x: filterStartX,
      y: footerIconY,
      width: FOOTER_ICON_SIZE,
      height: FOOTER_ICON_SIZE,
      alpha: 0.0
    });
    jsmaf.root.children.push(footerFilterIcon);
    fadeElements.push(footerFilterIcon);

    footerFilterText = new jsmaf.Text();
    footerFilterText.text = 'Filter [' + filterModeNames[filterMode] + ']';
    footerFilterText.style = 'footerText';
    footerFilterText.x = filterStartX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerFilterText.y = footerTextY;
    footerFilterText.alpha = 0.0;
    jsmaf.root.children.push(footerFilterText);
    fadeElements.push(footerFilterText);

    // Refresh
    var refreshStartX = filterStartX + filterWidth + FOOTER_GAP_FILTER_REFRESH;
    footerRefreshIcon = new Image({
      url: ASSET_PATH + 'footer_ico_square.png',
      x: refreshStartX,
      y: footerIconY,
      width: FOOTER_ICON_SIZE,
      height: FOOTER_ICON_SIZE,
      alpha: 0.0
    });
    jsmaf.root.children.push(footerRefreshIcon);
    fadeElements.push(footerRefreshIcon);

    footerRefreshText = new jsmaf.Text();
    footerRefreshText.text = 'Refresh';
    footerRefreshText.style = 'footerText';
    footerRefreshText.x = refreshStartX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerRefreshText.y = footerTextY;
    footerRefreshText.alpha = 0.0;
    jsmaf.root.children.push(footerRefreshText);
    fadeElements.push(footerRefreshText);

    updateListPositions();
    startFadeIn();
  }

  // ---------- Fade-in and line animation ----------
  function startFadeIn() {
    var startTime = Date.now();
    var fadeDuration = 7500;

    var lineExpandDelay = lineExpandDelayMs;
    var lineExpandDuration = lineExpandDurationMs;

    fadeInterval = jsmaf.setInterval(function() {
      var elapsed = Date.now() - startTime;
      currentT = Math.min(elapsed / fadeDuration, 1);

      var lineElapsed = Math.max(0, elapsed - lineExpandDelay);
      var lineT = Math.min(lineElapsed / lineExpandDuration, 1);

      for (var i = 0; i < fadeElements.length; i++) {
        fadeElements[i].alpha = currentT;
      }

      lineImg.width = actualLineTargetW * lineT;

      updateTextAlphas();

      if (tagImg) tagImg.alpha = currentT;

      if (currentT >= 1) {
        jsmaf.clearInterval(fadeInterval);
        fadeInterval = null;
        for (var i = 0; i < fadeElements.length; i++) {
          fadeElements[i].alpha = 1.0;
        }
        lineImg.width = actualLineTargetW;
        updateTextAlphas();
        if (tagImg) tagImg.alpha = 1.0;
      }
    }, 16);

    jsmaf.setTimeout(function() {
      fadingIn = false;
      updateListPositions();
    }, 2000);
  }

  function updateTextAlphas() {
    if (fileList.length === 0) return;
    var selectedY = LIST_START_Y + currentIndex * ITEM_HEIGHT + TEXT_OFFSET - scrollOffset;
    for (var i = 0; i < payloadTexts.length; i++) {
      var y = payloadTexts[i].y;
      var distance = Math.abs(y - selectedY);
      var alpha = 1.0 - Math.min(1, distance / FADE_DISTANCE);
      alpha = Math.max(0, Math.min(1, alpha)) * currentT;

      payloadTexts[i].alpha = alpha;
      if (codeTexts[i]) codeTexts[i].alpha = alpha;
      if (verTexts[i]) verTexts[i].alpha = alpha;
    }
  }

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

    if (fileList.length > 0) {
      var arrowBaseY = LIST_START_Y + currentIndex * ITEM_HEIGHT;
      arrowImg.y = arrowBaseY - scrollOffset + (ITEM_HEIGHT - ARROW_H) / 2;
      if (arrowImg.y < VISIBLE_TOP - ARROW_H || arrowImg.y > VISIBLE_BOTTOM) {
        arrowImg.visible = false;
      } else {
        arrowImg.visible = true;
      }

      var selectedTextY = LIST_START_Y + currentIndex * ITEM_HEIGHT + TEXT_OFFSET - scrollOffset;
      selBarImg.y = selectedTextY - (SEL_BAR_HEIGHT - TEXT_HEIGHT) / 2;
      if (selBarImg.y < VISIBLE_TOP - SEL_BAR_HEIGHT || selBarImg.y > VISIBLE_BOTTOM) {
        selBarImg.visible = false;
      } else {
        selBarImg.visible = true;
      }

      if (tagImg) {
        var selectedFile = fileList[currentIndex];
        var ext = selectedFile.split('.').pop().toLowerCase();
        var tagUrl = '';
        if (ext === 'elf') tagUrl = ASSET_PATH + 'tag_elf.png';
        else if (ext === 'js') tagUrl = ASSET_PATH + 'tag_js.png';
        else if (ext === 'bin') tagUrl = ASSET_PATH + 'tag_bin.png';
        
        if (tagUrl) {
          tagImg.url = tagUrl;
          if (verTexts[currentIndex]) {
            var verX = verTexts[currentIndex].x;
            var verY = verTexts[currentIndex].y;
            tagImg.x = verX + CODE_EST_WIDTH + TAG_GAP;
            tagImg.y = verY - (TAG_H - TEXT_HEIGHT) / 2;
            tagImg.visible = true;
          } else {
            tagImg.visible = false;
          }
        } else {
          tagImg.visible = false;
        }
      }
    } else {
      selBarImg.visible = false;
      if (tagImg) tagImg.visible = false;
    }

    // Update scrollbar
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

    updateTextAlphas();
  }

  function moveUp() {
    if (fileList.length === 0) return;
    if (currentIndex === 0) currentIndex = fileList.length - 1;
    else currentIndex--;
    scrollOffset = currentIndex * ITEM_HEIGHT;
    updateListPositions();
  }

  function moveDown() {
    if (fileList.length === 0) return;
    if (currentIndex === fileList.length - 1) currentIndex = 0;
    else currentIndex++;
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
        return;
      }

      var p_addr = mem.malloc(512);
      writeStringToHeap(p_addr, filePath, 512);
      log('Attempting open_sys for: ' + filePath);
      var fd_check = fn.open_sys(p_addr, new BigInt(0, 0), new BigInt(0, 0));
      if (fd_check.eq(new BigInt(0xffffffff, 0xffffffff))) {
        log('ERROR: open_sys failed for ' + filePath + ' — file not accessible');
        mem.free && mem.free(p_addr);
        return;
      }

      var headBuf = mem.malloc(16);
      var readBytes = fn.read_sys(fd_check, headBuf, new BigInt(0, 16));
      if (readBytes.eq && !readBytes.eq(new BigInt(0xffffffff, 0xffffffff))) {
        var readLen = readBytes.lo !== undefined ? readBytes.lo : readBytes;
        if (readLen >= 4 && isElfMagic(headBuf)) {
          log('Detected ELF file (magic OK) for ' + selectedFile);
        } else {
          log('Warning: first bytes do not match ELF magic (read ' + readLen + ' bytes). For .bin this may be expected.');
        }
      } else {
        log('Warning: read_sys returned error on header read. Continuing to loader, but loader may fail.');
      }
      fn.close_sys(fd_check);

      if (mem.free) {
        mem.free(headBuf);
      }

      log('Loading binloader.js...');
      include('binloader.js');
      if (typeof binloader_init !== 'function') {
        log('ERROR: binloader_init not found after include(binloader.js)');
        mem.free && mem.free(p_addr);
        return;
      }

      var loader = null;
      try {
        loader = binloader_init();
      } catch (e) {
        log('ERROR: binloader_init threw: ' + e.message);
        if (e.stack) log(e.stack);
        mem.free && mem.free(p_addr);
        return;
      }

      if (!loader || typeof loader.bl_load_from_file !== 'function') {
        log('ERROR: bl_load_from_file function not available in binloader_init() return value');
        mem.free && mem.free(p_addr);
        return;
      }

      log('Invoking bl_load_from_file for ' + filePath);
      try {
        loader.bl_load_from_file(filePath);
        log('bl_load_from_file returned (loader should have transferred control if successful)');
      } catch (e) {
        log('ERROR: bl_load_from_file threw: ' + e.message);
        if (e.stack) log(e.stack);
      }

      mem.free && mem.free(p_addr);
    } catch (e) {
      log('ERROR loading payload: ' + (e && e.message ? e.message : String(e)));
      if (e && e.stack) log(e.stack);
    }
  }

  // ---------- Filter handler ----------
  function handleFilter() {
    if (fadingIn) return;
    filterMode = (filterMode + 1) % 4;
    log('Filter mode: ' + filterModeNames[filterMode]);
    if (footerFilterText) {
      footerFilterText.text = 'Filter [' + filterModeNames[filterMode] + ']';
    }
    applyFilter();
  }

  // ---------- Refresh handler ----------
  function handleRefresh() {
    if (fadingIn) return;
    log('Refreshing payload list...');
    fileListFull = scanPayloads();
    applyFilter();
    log('Refresh complete – ' + fileList.length + ' payloads');
  }

  // ---------- Go back to main menu ----------
  function goBack() {
    if (fadingIn) return;
    log('Returning to main menu...');
    try {
      include('../download0/themes/Cheat Manger/main.js');
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
    } else if (keyCode === 6 || keyCode === 57) {
      moveDown();
    } else if (keyCode === 14) {
      handleSelect();
    } else if (keyCode === 12) {
      handleFilter();
    } else if (keyCode === 15) {
      handleRefresh();
    } else if (keyCode === 27 || keyCode === 13) {
      goBack();
    }
  };

  jsmaf.onKeyUp = function (keyCode) {
    delete pressedKeys[keyCode];
  };

  // ---------- Start ----------
  buildUI();
  log('Payload menu loaded – ' + fileList.length + ' payloads (filtered)');
})();