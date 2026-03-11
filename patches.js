// I dont know if this will work or not, it should take frok USB, it checks for a folder called Cheats_VUE and inside it itll expext elf bin or js.

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

  // ----- Top group offset -----
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

  var ARROW_TO_TEXT_GAP = 12;
  var TEXT_X_BASE = ARROW_X + ARROW_W + ARROW_TO_TEXT_GAP;
  var PAYLOAD_TEXT_OFFSET_X = 0;
  var TEXT_X = TEXT_X_BASE + PAYLOAD_TEXT_OFFSET_X;

  var META_GAP = 18;
  var META_CODE_VER_GAP = 20;
  var META_SHIFT_X = 450;
  var META_VER_SHIFT = 80;
  var CODE_EST_WIDTH = 200;

  // Tag image
  var TAG_W = 58;
  var TAG_H = 28;
  var TAG_GAP = -80;

  var LIST_START_Y = 550;
  var ITEM_HEIGHT = 55;
  var VISIBLE_TOP = 200;
  var VISIBLE_BOTTOM = 900;

  // Help image
  var HELP_IMG_PADDING = 20;
  var HELP_IMG_DEFAULT_X = 0;
  var HELP_IMG_DEFAULT_Y = VISIBLE_TOP - HELP_IMG_PADDING;
  var HELP_IMG_DEFAULT_WIDTH = SCREEN_W;
  var HELP_IMG_DEFAULT_HEIGHT = (VISIBLE_BOTTOM - VISIBLE_TOP) + 2 * HELP_IMG_PADDING;
  var HELP_IMG_WIDTH_OVERRIDE = 1760;
  var HELP_IMG_HEIGHT_OVERRIDE = 0;
  var HELP_IMG_BOTTOM_EXPAND = 50;

  // Fade
  var FADE_DISTANCE = 200;

  // Selection bar
  var SEL_BAR_HEIGHT = 50;
  var SEL_BAR_X = 0;
  var SEL_BAR_WIDTH = SCREEN_W;

  // Footer
  var FOOTER_Y = SCREEN_H - 100;
  var FOOTER_ICON_SIZE = 32;
  var FOOTER_GAP_ICON_TEXT = 10;
  var FOOTER_GAP_SELECT_BACK = 100;
  var FOOTER_GAP_BACK_FILTER = 100;
  var FOOTER_GAP_FILTER_REFRESH = 100;
  var FOOTER_Y_OFFSET = 20;

  // Scrollbar
  var SCROLLBAR_GAP = 30;
  var SCROLLBAR_X = SCREEN_W - SCROLLBAR_GAP - 10;
  var SCROLLBAR_Y = VISIBLE_TOP;
  var SCROLLBAR_HEIGHT = VISIBLE_BOTTOM - VISIBLE_TOP;

  var TEXT_OFFSET = (ITEM_HEIGHT - 38) / 2;

  var lineExpandDelaySec = 0.5;
  var lineExpandDurationSec = 1.5;
  var lineExpandDelayMs = Math.round(lineExpandDelaySec * 1000);
  var lineExpandDurationMs = Math.round(lineExpandDurationSec * 1000);

  // Filter modes
  var filterMode = 0;
  var filterModeNames = ['All', 'BIN', 'ELF', 'JS'];
  var ALLOWED_EXT = ['.js', '.elf', '.bin'];

  // USB search paths
  var USB_MOUNTS = ['/mnt/usb0', '/mnt/usb1', '/mnt/usb2', '/mnt/usb3', '/mnt/usb4'];
  var USB_FOLDER = 'Cheats_VUE'; // folder on USB root containing payloads

  // ----- Loading text X offset (user adjustable) -----
  var LOADING_TEXT_OFFSET_X = 50; // default 0; positive moves right, negative left

  // ---------- Global Variables ----------
  var currentIndex = 0;
  var scrollOffset = 0;
  var fileListFull = [];
  var fileList = [];
  var payloadTexts = [];
  var codeTexts = [];
  var verTexts = [];
  var arrowImg = null;
  var lineImg = null;
  var iconImg = null;
  var titleRight = null;
  var titleLeft = null;
  var selBarImg = null;
  var footerSelectIcon = null;
  var footerSelectText = null;
  var footerBackIcon = null;
  var footerBackText = null;
  var footerFilterIcon = null;
  var footerFilterText = null;
  var footerRefreshIcon = null;
  var footerRefreshText = null;
  var scrollBg = null;
  var scrollLock = null;
  var helpBgImg = null;
  var tagImg = null;
  var fadeElements = [];
  var fadeInterval = null;
  var fadingIn = true;
  var currentT = 0;
  var pressedKeys = {};

  // Loading screen elements
  var LOADING_BG = ASSET_PATH + 'circle_loading_bg.png';
  var LOADING_SEEK = ASSET_PATH + 'circle_loading_seek.png';
  var LOADING_ERROR = ASSET_PATH + 'circle_error_light.png';
  var LOADING_SIZE = 178;
  var loadingBgImg = null, loadingSeekImg = null, loadingStatusText = null;
  var loadingSpinInterval = null;
  var CHAR_WIDTH = 20;

  var TEXT_HEIGHT = 38;
  var actualLineTargetW = 1600;

  // ---------- Helper utilities ----------
  function bl_alloc_string(str) {
    var addr = mem.malloc(str.length + 1);
    for (var i = 0; i < str.length; i++) {
      mem.view(addr).setUint8(i, str.charCodeAt(i));
    }
    mem.view(addr).setUint8(str.length, 0);
    return addr;
  }

  function bl_is_error(val) {
    if (val instanceof BigInt) {
      return val.hi === 0xffffffff;
    }
    return val === -1 || val === 0xffffffff;
  }

  function bl_file_exists(path) {
    var path_addr = bl_alloc_string(path);
    var stat_buf = mem.malloc(0x78);
    try {
      var ret = fn.stat_sys(path_addr, stat_buf);
      if (bl_is_error(ret)) return -1;
      var size = mem.view(stat_buf).getBigInt(0x48, true);
      return size.lo + size.hi * 0x100000000;
    } catch (e) {
      return -1;
    }
  }

  // Read entire file into memory buffer
  function bl_read_file(path) {
    var size = bl_file_exists(path);
    if (size <= 0) return null;
    var path_addr = bl_alloc_string(path);
    var fd = fn.open_sys(path_addr, new BigInt(0, 0), new BigInt(0, 0));
    if (bl_is_error(fd)) return null;
    var fd_num = fd instanceof BigInt ? fd.lo : fd;
    var buf = mem.malloc(size);
    var total_read = 0;
    var READ_CHUNK = 32768;
    while (total_read < size) {
      var chunk = size - total_read > READ_CHUNK ? READ_CHUNK : size - total_read;
      var bytes_read = fn.read_sys(new BigInt(0, fd_num), buf.add(new BigInt(0, total_read)), new BigInt(0, chunk));
      if (bl_is_error(bytes_read) || bytes_read.eq(0)) break;
      total_read += bytes_read.lo;
    }
    fn.close_sys(fd_num);
    if (total_read !== size) return null;
    return { buf: buf, size: size };
  }

  // Jailbreak check (from Check if jailbroken in the root of vue after free)
  function checkJailbroken() {
    fn.register(24, 'getuid', [], 'bigint');
    fn.register(23, 'setuid', ['number'], 'bigint');
    var uidBefore = fn.getuid();
    var uidBeforeVal = uidBefore instanceof BigInt ? uidBefore.lo : uidBefore;
    log('UID before setuid: ' + uidBeforeVal);
    log('Attempting setuid(0)...');
    try {
      var setuidResult = fn.setuid(0);
      var setuidRet = setuidResult instanceof BigInt ? setuidResult.lo : setuidResult;
      log('setuid returned: ' + setuidRet);
    } catch (e) {
      log('setuid threw exception: ' + e.toString());
    }
    var uidAfter = fn.getuid();
    var uidAfterVal = uidAfter instanceof BigInt ? uidAfter.lo : uidAfter;
    log('UID after setuid: ' + uidAfterVal);
    var jailbroken = uidAfterVal === 0;
    log(jailbroken ? 'Already jailbroken' : 'Not jailbroken');
    return jailbroken;
  }

  // ---------- USB Scanning ----------
  function scanUSBPayloads() {
    var results = [];
    for (var m = 0; m < USB_MOUNTS.length; m++) {
      var base = USB_MOUNTS[m];
      var folderPath = base + '/' + USB_FOLDER;
      var sizeOrErr = bl_file_exists(folderPath);
      if (sizeOrErr < 0) continue;

      var path_addr = bl_alloc_string(folderPath);
      var fd = fn.open_sys(path_addr, new BigInt(0, 0), new BigInt(0, 0));
      if (bl_is_error(fd)) continue;
      var fd_num = fd instanceof BigInt ? fd.lo : fd;
      var buf = mem.malloc(4096);
      var count = fn.getdents(fd, buf, new BigInt(0, 4096));
      if (!bl_is_error(count) && count.lo > 0) {
        var offset = 0;
        var maxCount = count.lo;
        while (offset < maxCount) {
          if (offset + 8 > maxCount) break;
          var reclenAddr = buf.add(new BigInt(0, offset + 4));
          var d_reclen = mem.view(reclenAddr).getUint16(0, true);
          if (!d_reclen || d_reclen <= 0) break;
          if (offset + d_reclen > maxCount) break;
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
            } catch (e) { break; }
          }
          if (d_type === 8 && name !== '.' && name !== '..') {
            var lower = name.toLowerCase();
            if (lower.endsWith('.elf') || lower.endsWith('.bin') || lower.endsWith('.js')) {
              var fullPath = folderPath + '/' + name;
              results.push({ name: name, path: fullPath, ext: lower.split('.').pop() });
              log('Found USB payload: ' + fullPath);
            }
          }
          offset += d_reclen;
        }
      }
      fn.close_sys(fd);
    }
    return results;
  }

  // ---------- Filter function ----------
  function applyFilter() {
    var filtered = [];
    for (var i = 0; i < fileListFull.length; i++) {
      var f = fileListFull[i];
      if (filterMode === 0) filtered.push(f);
      else if (filterMode === 1 && f.ext === 'bin') filtered.push(f);
      else if (filterMode === 2 && f.ext === 'elf') filtered.push(f);
      else if (filterMode === 3 && f.ext === 'js') filtered.push(f);
    }
    fileList = filtered;
    currentIndex = 0;
    scrollOffset = 0;
    if (titleRight) {
      titleRight.text = 'Payloads: ' + fileList.length;
    }
    rebuildListTexts();
    updateListPositions();
  }

  // ---------- Rebuild list texts ----------
  function rebuildListTexts() {
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

    for (var i = 0; i < fileList.length; i++) {
      var entry = fileList[i];
      var txt = new jsmaf.Text();
      txt.text = entry.name;
      txt.style = 'listText';
      txt.x = TEXT_X;
      txt.y = LIST_START_Y + i * ITEM_HEIGHT + TEXT_OFFSET;
      txt.alpha = currentT;
      payloadTexts.push(txt);
      jsmaf.root.children.push(txt);
      
      var codeTxt = new jsmaf.Text();
      codeTxt.text = '';
      codeTxt.style = 'metaCode';
      codeTxt.x = TEXT_X + TEXT_WIDTH + META_GAP + META_SHIFT_X;
      codeTxt.y = txt.y;
      codeTxt.alpha = currentT;
      codeTexts.push(codeTxt);
      jsmaf.root.children.push(codeTxt);

      var versionTxt = new jsmaf.Text();
      versionTxt.text = '';
      versionTxt.style = 'metaCode';
      versionTxt.x = codeTxt.x + CODE_EST_WIDTH + META_CODE_VER_GAP + META_VER_SHIFT;
      versionTxt.y = txt.y;
      versionTxt.alpha = currentT;
      verTexts.push(versionTxt);
      jsmaf.root.children.push(versionTxt);
    }

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
      codeTxt.text = '';
      codeTxt.style = 'metaCode';
      codeTxt.x = TEXT_X + TEXT_WIDTH + META_GAP + META_SHIFT_X;
      codeTxt.y = noPayloads.y;
      codeTxt.alpha = currentT;
      codeTexts.push(codeTxt);
      jsmaf.root.children.push(codeTxt);

      var versionTxt = new jsmaf.Text();
      versionTxt.text = '';
      versionTxt.style = 'metaCode';
      versionTxt.x = codeTxt.x + CODE_EST_WIDTH + META_CODE_VER_GAP + META_VER_SHIFT;
      versionTxt.y = noPayloads.y;
      versionTxt.alpha = currentT;
      verTexts.push(versionTxt);
      jsmaf.root.children.push(versionTxt);
    }
  }

  // ---------- Loading Screen ----------
  function showLoadingScreen() {
    try { jsmaf.root.children.length = 0; } catch (e) {}
    var bg = new Image({ url: ASSET_PATH + 'bglist.png', x: 0, y: 0, width: SCREEN_W, height: SCREEN_H });
    jsmaf.root.children.push(bg);

    loadingBgImg = new Image({
      url: LOADING_BG,
      x: Math.round(CENTER_X - LOADING_SIZE / 2),
      y: Math.round(SCREEN_H / 2 - LOADING_SIZE / 2 - 40),
      width: LOADING_SIZE, height: LOADING_SIZE,
      alpha: 1.0
    });
    jsmaf.root.children.push(loadingBgImg);

    loadingSeekImg = new Image({
      url: LOADING_SEEK,
      x: Math.round(CENTER_X - LOADING_SIZE / 2),
      y: Math.round(SCREEN_H / 2 - LOADING_SIZE / 2 - 40),
      width: LOADING_SIZE, height: LOADING_SIZE,
      alpha: 1.0
    });
    try { loadingSeekImg.originX = LOADING_SIZE / 2; loadingSeekImg.originY = LOADING_SIZE / 2; } catch (e) {}
    jsmaf.root.children.push(loadingSeekImg);

    try {
      new Style({ name: 'loadingStatus', color: 'black', size: 28, bold: false });
    } catch (e) {}
    loadingStatusText = new jsmaf.Text();
    loadingStatusText.text = 'Loading...';
    loadingStatusText.style = 'loadingStatus';
    var textWidth = loadingStatusText.text.length * CHAR_WIDTH;
    // Apply X offset
    loadingStatusText.x = Math.round(CENTER_X - textWidth / 2) + LOADING_TEXT_OFFSET_X;
    loadingStatusText.y = SCREEN_H / 2 + LOADING_SIZE / 2 + 10;
    loadingStatusText.alpha = 1.0;
    jsmaf.root.children.push(loadingStatusText);
  }

  function updateLoadingStatus(msg) {
    try {
      if (loadingStatusText) {
        loadingStatusText.text = msg;
        var textWidth = loadingStatusText.text.length * CHAR_WIDTH;
        loadingStatusText.x = Math.round(CENTER_X - textWidth / 2) + LOADING_TEXT_OFFSET_X;
      }
    } catch (e) {}
  }

  function startSpinner() {
    var angle = 0;
    var last = Date.now();
    if (loadingSpinInterval) jsmaf.clearInterval(loadingSpinInterval);
    loadingSpinInterval = jsmaf.setInterval(function () {
      var now = Date.now();
      var dt = (now - last) / 1000;
      last = now;
      angle += 360 * 1.2 * dt;
      angle = angle % 360;
      try { loadingSeekImg.rotation = angle; } catch (e) {}
    }, 16);
  }

  function stopSpinner() {
    try { if (loadingSpinInterval) jsmaf.clearInterval(loadingSpinInterval); } catch (e) {}
    loadingSpinInterval = null;
  }

  function showErrorAndQuit(errorMsg) {
    try { if (loadingSeekImg) loadingSeekImg.url = LOADING_ERROR; } catch (e) {}
    updateLoadingStatus('Error: ' + errorMsg);
    stopSpinner();
    jsmaf.setTimeout(function () {
      try { include('../download0/themes/Cheat Manger/main.js'); } catch (e) { log('error returning to main:', e && e.message); }
    }, 3000);
  }

  // ---------- Build Main UI ----------
  function buildUI() {
    try { jsmaf.root.children.length = 0; } catch (e) {}

    new Style({ name: 'title', color: 'black', size: 48, bold: true });
    new Style({ name: 'listText', color: 'white', size: 36, bold: true });
    new Style({ name: 'metaCode', color: 'white', size: 34 });
    new Style({ name: 'metaVer', color: 'white', size: 34 });
    new Style({ name: 'footerText', color: 'black', size: 36, bold: true });

    var bg = new Image({ url: ASSET_PATH + 'bglist.png', x: 0, y: 0, width: SCREEN_W, height: SCREEN_H });
    jsmaf.root.children.push(bg);

    // Help image
    var helpWidth = HELP_IMG_WIDTH_OVERRIDE > 0 ? HELP_IMG_WIDTH_OVERRIDE : HELP_IMG_DEFAULT_WIDTH;
    var helpHeight = (HELP_IMG_HEIGHT_OVERRIDE > 0 ? HELP_IMG_HEIGHT_OVERRIDE : HELP_IMG_DEFAULT_HEIGHT) + HELP_IMG_BOTTOM_EXPAND;
    var helpX = Math.round(HELP_IMG_DEFAULT_X + (HELP_IMG_DEFAULT_WIDTH - helpWidth) / 2);
    var helpY = HELP_IMG_DEFAULT_Y;
    helpBgImg = new Image({ url: ASSET_PATH + 'help.png', x: helpX, y: helpY, width: helpWidth, height: helpHeight, alpha: 0.0 });
    jsmaf.root.children.push(helpBgImg);
    fadeElements.push(helpBgImg);

    // Top group
    var adjustedLineX = LINE_X + TOP_GROUP_OFFSET_X;
    actualLineTargetW = SCREEN_W - adjustedLineX;

    iconImg = new Image({
      url: ASSET_PATH + 'titlescr_ico_pat-ico.png',
      x: ICON_X + ICON_OFFSET_X + TOP_GROUP_OFFSET_X,
      y: ICON_Y + ICON_OFFSET_Y,
      width: ICON_W, height: ICON_H,
      alpha: 0.0
    });
    jsmaf.root.children.push(iconImg);
    fadeElements.push(iconImg);

    lineImg = new Image({ url: ASSET_PATH + 'black.png', x: adjustedLineX, y: LINE_Y, width: 0, height: LINE_H, alpha: 0.0 });
    jsmaf.root.children.push(lineImg);
    fadeElements.push(lineImg);

    titleLeft = new jsmaf.Text();
    titleLeft.text = 'Patches';
    titleLeft.style = 'title';
    titleLeft.x = TITLE_LEFT_X + TOP_GROUP_OFFSET_X;
    titleLeft.y = TITLE_Y;
    titleLeft.alpha = 0.0;
    jsmaf.root.children.push(titleLeft);
    fadeElements.push(titleLeft);

    titleRight = new jsmaf.Text();
    titleRight.text = 'Payloads: ' + fileList.length;
    titleRight.style = 'title';
    titleRight.x = TITLE_RIGHT_X - 200 + PAYLOAD_COUNTER_OFFSET_X + TOP_GROUP_OFFSET_X;
    titleRight.y = TITLE_Y;
    titleRight.alpha = 0.0;
    jsmaf.root.children.push(titleRight);
    fadeElements.push(titleRight);

    selBarImg = new Image({ url: ASSET_PATH + 'sel_bar1.png', x: SEL_BAR_X, y: LIST_START_Y, width: SEL_BAR_WIDTH, height: SEL_BAR_HEIGHT, alpha: 0.0 });
    jsmaf.root.children.push(selBarImg);
    fadeElements.push(selBarImg);

    arrowImg = new Image({ url: ASSET_PATH + 'arrow.png', x: ARROW_X, y: LIST_START_Y, width: ARROW_W, height: ARROW_H, alpha: 0.0 });
    jsmaf.root.children.push(arrowImg);
    fadeElements.push(arrowImg);

    tagImg = new Image({ url: '', x: 0, y: 0, width: TAG_W, height: TAG_H, alpha: 0.0, visible: false });
    jsmaf.root.children.push(tagImg);

    rebuildListTexts();

    scrollBg = new Image({ url: ASSET_PATH + 'scroll_bg.png', x: SCROLLBAR_X, y: SCROLLBAR_Y, width: 10, height: SCROLLBAR_HEIGHT, alpha: 0.0 });
    jsmaf.root.children.push(scrollBg); fadeElements.push(scrollBg);
    scrollLock = new Image({ url: ASSET_PATH + 'scroll_lock.png', x: SCROLLBAR_X, y: SCROLLBAR_Y, width: 10, height: 74, alpha: 0.0 });
    jsmaf.root.children.push(scrollLock); fadeElements.push(scrollLock);

    // Footer
    var selectWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 100;
    var backWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 80;
    var filterWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 120;
    var refreshWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 100;
    var totalWidth = selectWidth + FOOTER_GAP_SELECT_BACK + backWidth + FOOTER_GAP_BACK_FILTER + filterWidth + FOOTER_GAP_FILTER_REFRESH + refreshWidth;
    var startX = (SCREEN_W - totalWidth) / 2;
    var footerIconY = FOOTER_Y - FOOTER_ICON_SIZE / 2 + FOOTER_Y_OFFSET;
    var footerTextY = FOOTER_Y - 18 + FOOTER_Y_OFFSET;

    footerSelectIcon = new Image({ url: ASSET_PATH + 'footer_ico_cross.png', x: startX, y: footerIconY, width: FOOTER_ICON_SIZE, height: FOOTER_ICON_SIZE, alpha: 0.0 });
    jsmaf.root.children.push(footerSelectIcon); fadeElements.push(footerSelectIcon);
    footerSelectText = new jsmaf.Text();
    footerSelectText.text = 'Select';
    footerSelectText.style = 'footerText';
    footerSelectText.x = startX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerSelectText.y = footerTextY;
    footerSelectText.alpha = 0.0;
    jsmaf.root.children.push(footerSelectText); fadeElements.push(footerSelectText);

    var backStartX = startX + selectWidth + FOOTER_GAP_SELECT_BACK;
    footerBackIcon = new Image({ url: ASSET_PATH + 'footer_ico_circle.png', x: backStartX, y: footerIconY, width: FOOTER_ICON_SIZE, height: FOOTER_ICON_SIZE, alpha: 0.0 });
    jsmaf.root.children.push(footerBackIcon); fadeElements.push(footerBackIcon);
    footerBackText = new jsmaf.Text();
    footerBackText.text = 'Back';
    footerBackText.style = 'footerText';
    footerBackText.x = backStartX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerBackText.y = footerTextY;
    footerBackText.alpha = 0.0;
    jsmaf.root.children.push(footerBackText); fadeElements.push(footerBackText);

    var filterStartX = backStartX + backWidth + FOOTER_GAP_BACK_FILTER;
    footerFilterIcon = new Image({ url: ASSET_PATH + 'footer_ico_triangle.png', x: filterStartX, y: footerIconY, width: FOOTER_ICON_SIZE, height: FOOTER_ICON_SIZE, alpha: 0.0 });
    jsmaf.root.children.push(footerFilterIcon); fadeElements.push(footerFilterIcon);
    footerFilterText = new jsmaf.Text();
    footerFilterText.text = 'Filter [' + filterModeNames[filterMode] + ']';
    footerFilterText.style = 'footerText';
    footerFilterText.x = filterStartX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerFilterText.y = footerTextY;
    footerFilterText.alpha = 0.0;
    jsmaf.root.children.push(footerFilterText); fadeElements.push(footerFilterText);

    var refreshStartX = filterStartX + filterWidth + FOOTER_GAP_FILTER_REFRESH;
    footerRefreshIcon = new Image({ url: ASSET_PATH + 'footer_ico_square.png', x: refreshStartX, y: footerIconY, width: FOOTER_ICON_SIZE, height: FOOTER_ICON_SIZE, alpha: 0.0 });
    jsmaf.root.children.push(footerRefreshIcon); fadeElements.push(footerRefreshIcon);
    footerRefreshText = new jsmaf.Text();
    footerRefreshText.text = 'Refresh';
    footerRefreshText.style = 'footerText';
    footerRefreshText.x = refreshStartX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerRefreshText.y = footerTextY;
    footerRefreshText.alpha = 0.0;
    jsmaf.root.children.push(footerRefreshText); fadeElements.push(footerRefreshText);

    updateListPositions();
    startFadeIn();
    jsmaf.setTimeout(function () { fadingIn = false; }, 2000);
  }

  // ---------- Fade and animation ----------
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
        for (var i = 0; i < fadeElements.length; i++) fadeElements[i].alpha = 1.0;
        lineImg.width = actualLineTargetW;
        updateTextAlphas();
        if (tagImg) tagImg.alpha = 1.0;
      }
    }, 16);
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

  // ---------- Update positions ----------
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
      var visible = !(y < VISIBLE_TOP - TEXT_HEIGHT || y > VISIBLE_BOTTOM);
      payloadTexts[i].visible = visible;
      if (codeTexts[i]) codeTexts[i].visible = visible;
      if (verTexts[i]) verTexts[i].visible = visible;
    }

    if (fileList.length > 0) {
      var arrowBaseY = LIST_START_Y + currentIndex * ITEM_HEIGHT;
      arrowImg.y = arrowBaseY - scrollOffset + (ITEM_HEIGHT - ARROW_H) / 2;
      arrowImg.visible = !(arrowImg.y < VISIBLE_TOP - ARROW_H || arrowImg.y > VISIBLE_BOTTOM);

      var selectedTextY = LIST_START_Y + currentIndex * ITEM_HEIGHT + TEXT_OFFSET - scrollOffset;
      selBarImg.y = selectedTextY - (SEL_BAR_HEIGHT - TEXT_HEIGHT) / 2;
      selBarImg.visible = !(selBarImg.y < VISIBLE_TOP - SEL_BAR_HEIGHT || selBarImg.y > VISIBLE_BOTTOM);

      // Update tag image
      if (tagImg) {
        var ext = fileList[currentIndex].ext;
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
          } else tagImg.visible = false;
        } else tagImg.visible = false;
      }
    } else {
      selBarImg.visible = false;
      if (tagImg) tagImg.visible = false;
    }

    // Scrollbar
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

  // ---------- Handle Selection ----------
  function handleSelect() {
    if (fadingIn) return;
    if (fileList.length === 0) return;
    var entry = fileList[currentIndex];
    var filePath = entry.path;
    var ext = entry.ext;

    log('Selected: ' + filePath);

    if (ext === 'js') {
      var data = bl_read_file(filePath);
      if (!data) {
        log('Failed to read JS payload');
        return;
      }
      try {
        var script = '';
        for (var i = 0; i < data.size; i++) {
          script += String.fromCharCode(mem.view(data.buf).getUint8(i));
        }
        log('Evaluating JS: ' + entry.name);
        eval(script);
      } catch (e) {
        log('ERROR executing JS: ' + e.message);
      }
    } else {
      try {
        if (typeof binloader_init !== 'function') {
          include('binloader.js');
        }
        var loader = binloader_init();
        if (loader && typeof loader.bl_load_from_file === 'function') {
          log('Loading binary from ' + filePath);
          loader.bl_load_from_file(filePath, false);
        } else {
          log('binloader_init failed to return loader');
        }
      } catch (e) {
        log('ERROR loading binary: ' + e.message);
      }
    }
  }

  // ---------- Filter handler ----------
  function handleFilter() {
    if (fadingIn) return;
    filterMode = (filterMode + 1) % 4;
    if (footerFilterText) {
      footerFilterText.text = 'Filter [' + filterModeNames[filterMode] + ']';
    }
    applyFilter();
  }

  // ---------- Refresh handler ----------
  function handleRefresh() {
    if (fadingIn) return;
    log('Refreshing USB payload list...');
    showLoadingScreen();
    startSpinner();
    updateLoadingStatus('Scanning USB...');

    jsmaf.setTimeout(function () {
      var newList = scanUSBPayloads();
      fileListFull = newList;
      stopSpinner();
      updateLoadingStatus('Loading complete');
      jsmaf.setTimeout(function () {
        buildUI();
        log('Refresh complete – ' + fileList.length + ' payloads');
      }, 500);
    }, 100);
  }

  // ---------- Go back ----------
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

    if (keyCode === 4 || keyCode === 7 || keyCode === 55) moveUp();
    else if (keyCode === 6 || keyCode === 57) moveDown();
    else if (keyCode === 14) handleSelect();
    else if (keyCode === 12) handleFilter();
    else if (keyCode === 15) handleRefresh();
    else if (keyCode === 27 || keyCode === 13) goBack();
  };
  jsmaf.onKeyUp = function (k) { delete pressedKeys[k]; };

  // ---------- Start ----------
  function start() {
    if (typeof libc_addr === 'undefined') {
      log('Loading userland.js...');
      include('userland.js');
    }
    try {
      fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
      fn.register(0x06, 'close_sys', ['bigint'], 'bigint');
      fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint');
      fn.register(0x03, 'read_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
      fn.register(0xBC, 'stat_sys', ['bigint', 'bigint'], 'bigint');
    } catch (e) {
      log('Syscall registration failed (maybe already registered): ' + e.message);
    }

    // Load binloader for binary loading
    if (typeof binloader_init === 'undefined') {
      include('binloader.js');
    }

    // Start loading screen
    showLoadingScreen();
    startSpinner();
    updateLoadingStatus('Checking jailbreak...');

    // Check jailbreak first
    jsmaf.setTimeout(function () {
      var jailbroken = checkJailbroken();
      if (!jailbroken) {
        log('Not jailbroken – aborting');
        showErrorAndQuit('Not jailbroken');
        return;
      }

      updateLoadingStatus('Scanning USB...');
      // Scan USB
      var usbPayloads = scanUSBPayloads();
      fileListFull = usbPayloads;
      fileList = usbPayloads.slice(); // initial filter all

      stopSpinner();
      updateLoadingStatus('Loading complete');

      jsmaf.setTimeout(function () {
        buildUI();
        log('Patches menu loaded – ' + fileList.length + ' payloads');
      }, 1000);
    }, 500);
  }

  start();
})();