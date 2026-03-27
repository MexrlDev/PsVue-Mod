(function () {
  // ==================== LOAD DEPENDENCIES ====================
  if (typeof libc_addr === 'undefined') {
    log('Loading userland.js...');
    include('userland.js');
    log('userland.js loaded');
  } else {
    log('userland.js already loaded (libc_addr defined)');
  }

  log('Loading check-jailbroken.js...');
  include('check-jailbroken.js');

  var is_jailbroken = checkJailbroken();
  log('Jailbroken: ' + is_jailbroken);

  // ==================== REGISTER SYSCALLS ====================
  fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(0x06, 'close_sys', ['bigint'], 'bigint');
  fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(0x03, 'read_sys', ['bigint', 'bigint', 'bigint'], 'bigint');

  // ==================== SCAN FOR PAYLOADS ====================
  var scanPaths = ['/download0/payloads'];
  if (is_jailbroken) {
    scanPaths.push('/data/payloads');
    for (var i = 0; i <= 7; i++) {
      scanPaths.push('/mnt/usb' + i + '/payloads');
    }
  }
  log('Scanning paths: ' + scanPaths.join(', '));

  var path_addr = mem.malloc(256);
  var buf = mem.malloc(4096);
  var fileList = [];

  for (var currentPath of scanPaths) {
    log('Scanning ' + currentPath + ' for files...');
    for (var j = 0; j < currentPath.length; j++) {
      mem.view(path_addr).setUint8(j, currentPath.charCodeAt(j));
    }
    mem.view(path_addr).setUint8(currentPath.length, 0);

    var fd = fn.open_sys(path_addr, new BigInt(0, 0), new BigInt(0, 0));
    if (!fd.eq(new BigInt(0xffffffff, 0xffffffff))) {
      var count = fn.getdents(fd, buf, new BigInt(0, 4096));
      if (!count.eq(new BigInt(0xffffffff, 0xffffffff)) && count.lo > 0) {
        var offset = 0;
        while (offset < count.lo) {
          var d_reclen = mem.view(buf.add(new BigInt(0, offset + 4))).getUint16(0, true);
          var d_type = mem.view(buf.add(new BigInt(0, offset + 6))).getUint8(0);
          var d_namlen = mem.view(buf.add(new BigInt(0, offset + 7))).getUint8(0);

          var name = '';
          for (var k = 0; k < d_namlen; k++) {
            name += String.fromCharCode(mem.view(buf.add(new BigInt(0, offset + 8 + k))).getUint8(0));
          }

          if (d_type === 8 && name !== '.' && name !== '..') {
            var lowerName = name.toLowerCase();
            if (lowerName.endsWith('.elf') || lowerName.endsWith('.bin') || lowerName.endsWith('.js')) {
              fileList.push({ name: name, path: currentPath + '/' + name });
              log('Added file: ' + name + ' from ' + currentPath);
            }
          }

          offset += d_reclen;
        }
      }
      fn.close_sys(fd);
    } else {
      log('Failed to open ' + currentPath);
    }
  }
  log('Total files found: ' + fileList.length);

  // ==================== UI CONFIGURATION ====================
  var WIDTH = 1920;
  var HEIGHT = 1080;
  var BASE_PATH = 'file:///../download0/';
  var IMG_PATH = BASE_PATH + 'themes/apollo/static/images/';
  var SONG_PATH = BASE_PATH + 'sfx/bgm.wav';

  var HEADER_ICON_WIDTH = 100;
  var HEADER_ICON_HEIGHT = 100;
  var HEADER_Y = 50;
  var LIST_START_Y = 200;
  var LINE_HEIGHT = 70;
  var VISIBLE_COUNT = 11;
  var HALF = Math.floor(VISIBLE_COUNT / 2);
  var CENTER_SLOT_Y = LIST_START_Y + HALF * LINE_HEIGHT;

  var SCROLLBAR_WIDTH = 20;
  var SCROLLBAR_RIGHT = 70;
  var SCROLL_CURSOR_WIDTH = 16;
  var SCROLL_CURSOR_HEIGHT = 38;
  var SHADOW_WIDTH = 80;
  var TEXT_OFFSET = 15;
  var ARROW_OFFSET = 9;

  var TAG_WIDTH = 60;
  var TAG_HEIGHT = 25;
  var TAG_GAP = 10;
  var RIGHT_MARGIN = 20;

  var TAG_SHIFT_X = 250;

  var rightBoundary = WIDTH - SCROLLBAR_WIDTH - SCROLLBAR_RIGHT - RIGHT_MARGIN;
  var baseTagPs4X = rightBoundary - TAG_WIDTH;
  var baseDynamicTagX = baseTagPs4X - TAG_GAP - TAG_WIDTH;

  var scrollbarBgX = WIDTH - SCROLLBAR_WIDTH - SCROLLBAR_RIGHT;
  var scrollCursorX = scrollbarBgX + (SCROLLBAR_WIDTH - SCROLL_CURSOR_WIDTH) / 2;

  // ==================== GLOBAL UI VARIABLES ====================
  var selectedIndex = 0;
  var scrollOffset = 0;
  var totalItems = fileList.length;
  var itemTexts = [];

  var background, headerIcon, titleText, subtitleText, backHint;
  var scrollbarBg, scrollbarCursor;
  var selectionBar, selectionArrow;
  var tagPs4;
  var tagJs, tagBin, tagElf;
  var shadow;

  var computedTagPs4X = baseTagPs4X - TAG_SHIFT_X;
  var computedDynamicTagX = baseDynamicTagX - TAG_SHIFT_X;

  var whiteOverlay = null;
  var whiteFadeInterval = null;

  var shadowAnimInterval = null;
  var shadowAnimRunning = false;
  var SHADOW_ANIM_DURATION_MS = 2300;
  var TAG_FADE_DURATION_MS = 400;

  var tagsAllowed = false;
  var tagFading = false;

  var bgm = null;
  var bgmStarted = false;

  var CONFIRM_KEY = jsmaf.circleIsAdvanceButton ? 13 : 14;
  var BACK_KEY = jsmaf.circleIsAdvanceButton ? 14 : 13;

  // ==================== STYLES ====================
  new Style({ name: 'headerTitle', color: 'white', size: 48, align: 'left' });
  new Style({ name: 'headerSubtitle', color: 'white', size: 32, align: 'left' });
  new Style({ name: 'listItem', color: 'white', size: 36, align: 'left' });
  new Style({ name: 'backHint', color: 'white', size: 28, align: 'center' });

  function cleanupIntervals() {
    try {
      if (whiteFadeInterval) {
        jsmaf.clearInterval(whiteFadeInterval);
        whiteFadeInterval = null;
      }
    } catch (e) {}
    try {
      if (shadowAnimInterval) {
        jsmaf.clearInterval(shadowAnimInterval);
        shadowAnimInterval = null;
      }
    } catch (e) {}
  }

  function stopMusic() {
    try {
      if (bgm && bgm.stop) bgm.stop();
    } catch (e) {}
    try {
      if (window._apollo_bgm && window._apollo_bgm.stop) window._apollo_bgm.stop();
    } catch (e) {}
    try {
      if (window.bgm && window.bgm.stop) window.bgm.stop();
    } catch (e) {}
    try { window._apollo_bgm = null; } catch (e) {}
    try { window.bgm = null; } catch (e) {}
    bgm = null;
    bgmStarted = false;
  }

  function startMusic() {
    if (bgmStarted) return;
    try {
      if (typeof startBgmIfEnabled === 'function') {
        startBgmIfEnabled();
      }
    } catch (e) {}

    try {
      if (window._apollo_bgm && typeof window._apollo_bgm.play === 'function') {
        bgm = window._apollo_bgm;
        bgmStarted = true;
        log('Background music attached from shared BGM object');
        return;
      }
      if (window.bgm && typeof window.bgm.play === 'function') {
        bgm = window.bgm;
        bgmStarted = true;
        log('Background music attached from global BGM object');
        return;
      }
    } catch (e) {}
    try {
      bgm = new jsmaf.AudioClip();
      bgm.open(SONG_PATH);
      bgm.volume = 0.5;

      var played = false;
      try {
        bgm.play(true);
        played = true;
      } catch (e1) {
        try {
          bgm.play();
          played = true;
        } catch (e2) {}
      }

      if (!played) {
        throw new Error('AudioClip play() failed');
      }

      try { window._apollo_bgm = bgm; } catch (e) {}
      try { window.bgm = bgm; } catch (e) {}
      bgmStarted = true;
      log('Background music started');
    } catch (e) {
      log('Error loading music: ' + (e && e.message ? e.message : e));
      stopMusic();
    }
  }

  function stopAllAndCleanup() {
    cleanupIntervals();
    stopMusic();
  }

  // ==================== CLEAR SCREEN ====================
  jsmaf.root.children.length = 0;

  // ==================== BACKGROUND ====================
  background = new Image({ url: IMG_PATH + 'apollo.jpg', x: 0, y: 0, width: WIDTH, height: HEIGHT });
  jsmaf.root.children.push(background);

  // ==================== HEADER ====================
  headerIcon = new Image({ url: IMG_PATH + 'cat_hdd.png', x: 50, y: HEADER_Y, width: HEADER_ICON_WIDTH, height: HEADER_ICON_HEIGHT });
  jsmaf.root.children.push(headerIcon);

  titleText = new jsmaf.Text();
  titleText.text = 'Payloads';
  titleText.style = 'headerTitle';
  titleText.x = 50 + HEADER_ICON_WIDTH + 20;
  titleText.y = HEADER_Y;
  jsmaf.root.children.push(titleText);

  subtitleText = new jsmaf.Text();
  subtitleText.text = totalItems + ' payloads';
  subtitleText.style = 'headerSubtitle';
  subtitleText.x = titleText.x;
  subtitleText.y = HEADER_Y + 60;
  jsmaf.root.children.push(subtitleText);

  // ==================== SCROLLBAR ====================
  var scrollAreaHeight = HEIGHT - LIST_START_Y - 100;
  scrollbarBg = new Image({
    url: IMG_PATH + 'scroll_bg.png',
    x: scrollbarBgX,
    y: LIST_START_Y,
    width: SCROLLBAR_WIDTH,
    height: scrollAreaHeight,
    alpha: 0.5
  });
  jsmaf.root.children.push(scrollbarBg);

  scrollbarCursor = new Image({
    url: IMG_PATH + 'scroll_lock.png',
    x: scrollCursorX,
    y: LIST_START_Y,
    width: SCROLL_CURSOR_WIDTH,
    height: SCROLL_CURSOR_HEIGHT,
    alpha: 0.8,
    visible: false
  });
  jsmaf.root.children.push(scrollbarCursor);

  // ==================== SLIDING SHADOW ====================
  shadow = new Image({
    url: IMG_PATH + 'edit_shadow.png',
    x: -SHADOW_WIDTH,
    y: 0,
    width: 0,
    height: HEIGHT,
    alpha: 0.9,
    visible: true
  });
  jsmaf.root.children.push(shadow);

  // ==================== SELECTION BAR AND ARROW ====================
  selectionBar = new Image({
    url: IMG_PATH + 'mark_line.png',
    x: 0,
    y: CENTER_SLOT_Y,
    width: rightBoundary - 10,
    height: LINE_HEIGHT,
    alpha: 0.6,
    visible: false
  });
  jsmaf.root.children.push(selectionBar);

  selectionArrow = new Image({
    url: IMG_PATH + 'mark_arrow.png',
    x: 30,
    y: CENTER_SLOT_Y + ARROW_OFFSET,
    width: 40,
    height: 50,
    alpha: 0.95,
    visible: false
  });
  jsmaf.root.children.push(selectionArrow);

  // ==================== TAG IMAGES ====================
  tagPs4 = new Image({
    url: IMG_PATH + 'tag_ps4.png',
    x: computedTagPs4X,
    y: CENTER_SLOT_Y,
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    alpha: 0.0,
    visible: true
  });
  jsmaf.root.children.push(tagPs4);

  tagJs = new Image({
    url: IMG_PATH + 'tag_js.png',
    x: computedDynamicTagX,
    y: CENTER_SLOT_Y,
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    alpha: 0.0,
    visible: true
  });
  jsmaf.root.children.push(tagJs);

  tagBin = new Image({
    url: IMG_PATH + 'tag_bin.png',
    x: computedDynamicTagX,
    y: CENTER_SLOT_Y,
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    alpha: 0.0,
    visible: true
  });
  jsmaf.root.children.push(tagBin);

  tagElf = new Image({
    url: IMG_PATH + 'tag_elf.png',
    x: computedDynamicTagX,
    y: CENTER_SLOT_Y,
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    alpha: 0.0,
    visible: true
  });
  jsmaf.root.children.push(tagElf);

  function applyTagShift() {
    computedTagPs4X = baseTagPs4X - TAG_SHIFT_X;
    computedDynamicTagX = baseDynamicTagX - TAG_SHIFT_X;
    if (tagPs4) tagPs4.x = computedTagPs4X;
    if (tagJs) tagJs.x = computedDynamicTagX;
    if (tagBin) tagBin.x = computedDynamicTagX;
    if (tagElf) tagElf.x = computedDynamicTagX;
  }

  function setTagShift(px) {
    TAG_SHIFT_X = Number(px) || 0;
    applyTagShift();
    updateUI && updateUI();
  }

  try { window.setTagShift = setTagShift; } catch (e) {}

  // ==================== BACK HINT ====================
  backHint = new jsmaf.Text();
  backHint.text = jsmaf.circleIsAdvanceButton ? 'X to go back' : 'O to go back';
  backHint.style = 'backHint';
  backHint.x = WIDTH / 2 - 100;
  backHint.y = HEIGHT - 60;
  jsmaf.root.children.push(backHint);

  // ==================== CREATE LIST ITEMS ====================
  for (var idx = 0; idx < fileList.length; idx++) {
    var displayName = fileList[idx].name;
    if (displayName.length > 40) displayName = displayName.substring(0, 37) + '...';
    var text = new jsmaf.Text();
    text.text = displayName;
    text.style = 'listItem';
    text.x = 100;
    text.y = 0;
    text.visible = false;
    jsmaf.root.children.push(text);
    itemTexts.push(text);
  }

  if (totalItems === 0) {
    var noPayloadsText = new jsmaf.Text();
    noPayloadsText.text = 'No payloads found';
    noPayloadsText.style = 'listItem';
    noPayloadsText.x = 100;
    noPayloadsText.y = 0;
    jsmaf.root.children.push(noPayloadsText);
    itemTexts.push(noPayloadsText);
    totalItems = 1;
    fileList = [{ name: 'No payloads found', path: '' }];
  }

  // ==================== WHITE FADE OVERLAY ====================
  whiteOverlay = new Image({
    url: IMG_PATH + 'white.png',
    x: 0,
    y: 0,
    width: WIDTH,
    height: HEIGHT,
    alpha: 1.0,
    visible: true
  });
  jsmaf.root.children.push(whiteOverlay);

  function startWhiteFade() {
    var duration = 3000;
    var start = Date.now();
    if (whiteFadeInterval) jsmaf.clearInterval(whiteFadeInterval);
    whiteFadeInterval = jsmaf.setInterval(function() {
      var elapsed = Date.now() - start;
      var progress = elapsed / duration;
      if (progress >= 1) {
        whiteOverlay.alpha = 0.0;
        whiteOverlay.visible = false;
        var idx = jsmaf.root.children.indexOf(whiteOverlay);
        if (idx !== -1) jsmaf.root.children.splice(idx, 1);
        jsmaf.clearInterval(whiteFadeInterval);
        whiteFadeInterval = null;
      } else {
        whiteOverlay.alpha = 1.0 - progress;
      }
    }, 16);
  }

  // ==================== SHADOW ANIMATION ====================
  function startShadowAndTagsSequence() {
    if (shadowAnimRunning) return;
    shadowAnimRunning = true;
    tagsAllowed = false;
    tagFading = false;

    applyTagShift();
    updateUI();

    if (tagPs4) { tagPs4.visible = true; tagPs4.alpha = 0.0; }
    if (tagJs) { tagJs.visible = true; tagJs.alpha = 0.0; }
    if (tagBin) { tagBin.visible = true; tagBin.alpha = 0.0; }
    if (tagElf) { tagElf.visible = true; tagElf.alpha = 0.0; }

    var duration = SHADOW_ANIM_DURATION_MS;
    var startTime = Date.now();

    var startX = -SHADOW_WIDTH;
    var startW = 0;
    var targetX = Math.round(WIDTH - SHADOW_WIDTH - 300);
    var targetW = SHADOW_WIDTH;

    if (shadowAnimInterval) jsmaf.clearInterval(shadowAnimInterval);
    shadowAnimInterval = jsmaf.setInterval(function() {
      var elapsed = Date.now() - startTime;
      var t = Math.min(1, elapsed / duration);
      var progress = 1 - Math.pow(1 - t, 3);

      var newX = Math.round(startX + (targetX - startX) * progress);
      var newW = Math.round(startW + (targetW - startW) * progress);

      shadow.x = newX;
      shadow.width = Math.max(1, newW);

      updateUI();

      if (t >= 1) {
        jsmaf.clearInterval(shadowAnimInterval);
        shadowAnimInterval = null;
        shadowAnimRunning = false;
        shadow.x = targetX;
        shadow.width = targetW;
        fadeInTags(TAG_FADE_DURATION_MS);
      }
    }, 16);
  }

  function fadeInTags(durationMs) {
    tagFading = true;
    tagsAllowed = false;
    var start = Date.now();
    var interval = jsmaf.setInterval(function() {
      var elapsed = Date.now() - start;
      var p = Math.min(1, elapsed / durationMs);
      updateUI();

      var fileName = (fileList[selectedIndex] && fileList[selectedIndex].name || '').toLowerCase();
      var showJs = fileName.endsWith('.js');
      var showBin = fileName.endsWith('.bin');
      var showElf = fileName.endsWith('.elf');

      if (tagPs4) tagPs4.alpha = p;
      if (tagJs) tagJs.alpha = showJs ? p : 0.0;
      if (tagBin) tagBin.alpha = showBin ? p : 0.0;
      if (tagElf) tagElf.alpha = showElf ? p : 0.0;

      if (p >= 1) {
        jsmaf.clearInterval(interval);
        tagFading = false;
        tagsAllowed = true;
        if (tagPs4) tagPs4.alpha = 1.0;
        if (tagJs) tagJs.alpha = (showJs ? 1.0 : 0.0);
        if (tagBin) tagBin.alpha = (showBin ? 1.0 : 0.0);
        if (tagElf) tagElf.alpha = (showElf ? 1.0 : 0.0);
        updateUI();
      }
    }, 16);
  }

  // ==================== CENTERED LIST UPDATE ====================
  function updateUI() {
    subtitleText.text = fileList.length + ' payloads';

    var half = HALF;
    var total = fileList.length;

    var start = Math.max(0, selectedIndex - half);
    var end = Math.min(total, selectedIndex + half + 1);

    if (total > VISIBLE_COUNT) {
      scrollOffset = Math.min(Math.max(0, selectedIndex - half), total - VISIBLE_COUNT);
    } else {
      scrollOffset = 0;
    }

    for (var i = 0; i < total; i++) {
      var text = itemTexts[i];
      if (i >= start && i < end) {
        var distance = Math.abs(i - selectedIndex);
        var maxDist = half;
        var alpha = 1.0 - (distance / maxDist) * 0.7;
        if (alpha < 0) alpha = 0;
        text.alpha = alpha;
        text.visible = true;
        var offsetY = (i - selectedIndex) * LINE_HEIGHT;
        text.y = CENTER_SLOT_Y + offsetY + TEXT_OFFSET;
      } else {
        text.visible = false;
      }
    }

    selectionBar.visible = (total > 0);
    selectionBar.y = CENTER_SLOT_Y;
    selectionArrow.visible = (total > 0);
    selectionArrow.y = CENTER_SLOT_Y + ARROW_OFFSET;

    var tagY = CENTER_SLOT_Y + Math.round((LINE_HEIGHT - TAG_HEIGHT) / 2);
    if (tagFading) {
      if (tagPs4) { tagPs4.y = tagY; tagPs4.visible = true; }
      if (tagJs) { tagJs.y = tagY; tagJs.visible = true; }
      if (tagBin) { tagBin.y = tagY; tagBin.visible = true; }
      if (tagElf) { tagElf.y = tagY; tagElf.visible = true; }
    } else if (tagsAllowed) {
      if (tagPs4) { tagPs4.visible = true; tagPs4.y = tagY; tagPs4.alpha = 1.0; }
      var fileName = (fileList[selectedIndex] && fileList[selectedIndex].name || '').toLowerCase();
      if (tagJs) { tagJs.visible = true; tagJs.y = tagY; tagJs.alpha = fileName.endsWith('.js') ? 1.0 : 0.0; }
      if (tagBin) { tagBin.visible = true; tagBin.y = tagY; tagBin.alpha = fileName.endsWith('.bin') ? 1.0 : 0.0; }
      if (tagElf) { tagElf.visible = true; tagElf.y = tagY; tagElf.alpha = fileName.endsWith('.elf') ? 1.0 : 0.0; }
    } else {
      if (tagPs4) { tagPs4.visible = true; tagPs4.y = tagY; tagPs4.alpha = 0.0; }
      if (tagJs) { tagJs.visible = true; tagJs.y = tagY; tagJs.alpha = 0.0; }
      if (tagBin) { tagBin.visible = true; tagBin.y = tagY; tagBin.alpha = 0.0; }
      if (tagElf) { tagElf.visible = true; tagElf.y = tagY; tagElf.alpha = 0.0; }
    }

    if (total > VISIBLE_COUNT) {
      var cursorY = LIST_START_Y + (scrollOffset / (total - VISIBLE_COUNT)) * (scrollAreaHeight - SCROLL_CURSOR_HEIGHT);
      scrollbarCursor.y = cursorY;
      scrollbarCursor.visible = true;
      scrollbarBg.visible = true;
    } else {
      scrollbarCursor.visible = false;
      scrollbarBg.visible = false;
    }
  }

  // ==================== NAVIGATION ====================
  function moveSelection(delta) {
    if (fileList.length === 0) return;
    var newIdx = selectedIndex + delta;
    if (newIdx < 0) newIdx = fileList.length - 1;
    if (newIdx >= fileList.length) newIdx = 0;
    if (newIdx === selectedIndex) return;
    selectedIndex = newIdx;
    updateUI();
  }

  function jumpToFirst() { selectedIndex = 0; updateUI(); }
  function jumpToLast() { selectedIndex = fileList.length - 1; updateUI(); }

  function jumpPage(deltaPages) {
    var delta = deltaPages * VISIBLE_COUNT;
    var newIdx = selectedIndex + delta;
    if (newIdx < 0) newIdx = 0;
    if (newIdx >= fileList.length) newIdx = fileList.length - 1;
    selectedIndex = newIdx;
    updateUI();
  }

  function skipBlock(blockSize) {
    var newIdx = selectedIndex + blockSize;
    if (newIdx < 0) newIdx = 0;
    if (newIdx >= fileList.length) newIdx = fileList.length - 1;
    if (newIdx !== selectedIndex) {
      selectedIndex = newIdx;
      updateUI();
    }
  }

  // ==================== GO BACK / EXECUTE PAYLOAD ====================
  function goBack() {
    log('Returning to main menu...');
    stopAllAndCleanup();
    try {
      include('themes/' + (typeof CONFIG !== 'undefined' && CONFIG.theme ? CONFIG.theme : 'default') + '/main.js');
    } catch (e) {
      log('ERROR loading main.js: ' + e.message);
    }
  }

  function handleButtonPress() {
    if (!fileList || fileList.length === 0) {
      log('No payloads to load.');
      return;
    }

    var selectedEntry = fileList[selectedIndex];
    if (!selectedEntry) return;

    var filePath = selectedEntry.path;
    var fileName = selectedEntry.name;
    log('Selected: ' + fileName + ' from ' + filePath);

    stopAllAndCleanup();

    try {
      if (fileName.toLowerCase().endsWith('.js')) {
        if (filePath.startsWith('/download0/')) {
          log('Including JavaScript file: ' + fileName);
          include('payloads/' + fileName);
        } else {
          log('Reading external JavaScript file: ' + filePath);
          var p_addr = mem.malloc(256);
          for (var i = 0; i < filePath.length; i++) {
            mem.view(p_addr).setUint8(i, filePath.charCodeAt(i));
          }
          mem.view(p_addr).setUint8(filePath.length, 0);

          var fd = fn.open_sys(p_addr, new BigInt(0, 0), new BigInt(0, 0));
          if (!fd.eq(new BigInt(0xffffffff, 0xffffffff))) {
            var buf_size = 1024 * 1024;
            var buf2 = mem.malloc(buf_size);
            var read_len = fn.read_sys(fd, buf2, new BigInt(0, buf_size));
            fn.close_sys(fd);

            var scriptContent = '';
            var len = read_len instanceof BigInt ? read_len.lo : read_len;
            log('File read size: ' + len + ' bytes');

            for (var j = 0; j < len; j++) {
              scriptContent += String.fromCharCode(mem.view(buf2).getUint8(j));
            }

            log('Executing via eval()...');
            eval(scriptContent);
          } else {
            log('ERROR: Could not open file for reading!');
          }
        }
      } else {
        log('Loading bin/elf payload with binloader...');
        if (typeof binloader_init !== 'function') {
          log('Loading binloader.js...');
          include('binloader.js');
        }
        if (typeof binloader_init !== 'function') {
          throw new Error('binloader_init not found after include');
        }
        var { bl_load_from_file } = binloader_init();
        log('Loading payload from: ' + filePath);
        bl_load_from_file(filePath, true);
        log('Payload execution started');
      }
    } catch (e) {
      log('ERROR: ' + e.message);
      if (e.stack) log(e.stack);
    }
  }

  // ==================== INPUT HANDLERS ====================
  jsmaf.onKeyDown = function(keyCode) {
    if (keyCode === 4) moveSelection(-1);
    else if (keyCode === 6) moveSelection(1);
    else if (keyCode === 7) jumpPage(-1);
    else if (keyCode === 5) jumpPage(1);
    else if (keyCode === 58) skipBlock(-5);
    else if (keyCode === 56) skipBlock(5);
    else if (keyCode === 57) skipBlock(-25);
    else if (keyCode === 55) skipBlock(25);
    else if (keyCode === 47) jumpToFirst();
    else if (keyCode === 59) jumpToLast();
    else if (keyCode === CONFIRM_KEY) {
      handleButtonPress();
    } else if (keyCode === BACK_KEY || keyCode === 13 || keyCode === 41) {
      goBack();
    }
  };

  if (typeof jsmaf.onMouseDown === 'function') {
    jsmaf.onMouseDown = function(button, x, y) {
      if (button !== 1) return;
      for (var i = 0; i < itemTexts.length; i++) {
        var text = itemTexts[i];
        if (text.visible && y >= text.y - TEXT_OFFSET && y <= text.y - TEXT_OFFSET + LINE_HEIGHT) {
          selectedIndex = i;
          updateUI();
          log('Clicked item ' + (i + 1));
          break;
        }
      }
    };
  }

  // ==================== INIT ====================
  if (selectedIndex >= fileList.length) selectedIndex = Math.max(0, fileList.length - 1);
  applyTagShift();
  updateUI();

  startMusic();
  startWhiteFade();
  startShadowAndTagsSequence();

  log('Payload menu UI loaded');
})();
