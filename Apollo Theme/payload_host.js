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
  if (typeof startBgmIfEnabled === 'function') {
    startBgmIfEnabled();
  }
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
  var SONG_PATH = BASE_PATH + 'themes/apollo/song/bg.wav'; // music file

  var HEADER_ICON_WIDTH = 100;
  var HEADER_ICON_HEIGHT = 100;
  var HEADER_Y = 50;
  var LIST_START_Y = 200;
  var LINE_HEIGHT = 70;
  var VISIBLE_ITEMS = Math.floor((HEIGHT - LIST_START_Y - 100) / LINE_HEIGHT);
  var SCROLLBAR_WIDTH = 20;
  var SCROLLBAR_RIGHT = 70;
  var SCROLL_CURSOR_WIDTH = 16;
  var SHADOW_WIDTH = 80;
  var TEXT_OFFSET = 15;
  var ARROW_OFFSET = 9;

  // Tag image dimensions
  var TAG_WIDTH = 60;
  var TAG_HEIGHT = 25;
  var TAG_GAP = 10;
  var RIGHT_MARGIN = 20;

  // Tag shift: change this single value (x only) to nudge both tag groups together.
  var TAG_SHIFT_X = 250;

  // X positions for tags (base positions before shift)
  var rightBoundary = WIDTH - SCROLLBAR_WIDTH - SCROLLBAR_RIGHT - RIGHT_MARGIN;
  var baseTagPs4X = rightBoundary - TAG_WIDTH;
  var baseDynamicTagX = baseTagPs4X - TAG_GAP - TAG_WIDTH;

  // Scrollbar cursor X
  var scrollbarBgX = WIDTH - SCROLLBAR_WIDTH - SCROLLBAR_RIGHT;
  var scrollCursorX = scrollbarBgX + (SCROLLBAR_WIDTH - SCROLL_CURSOR_WIDTH) / 2;

  // ==================== GLOBAL UI VARIABLES ====================
  var selectedIndex = 0;
  var scrollOffset = 0;
  var totalItems = fileList.length;
  var itemTexts = [];
  var animationInterval = null;
  var animationStep = 0;
  var animationMax = 20;

  // UI elements
  var background, headerIcon, titleText, subtitleText, backHint;
  var scrollbarBg, scrollbarCursor;
  var selectionBar, selectionArrow;
  var tagPs4;
  var tagJs, tagBin, tagElf;
  var shadow;

  // store computed positions
  var computedTagPs4X = baseTagPs4X - TAG_SHIFT_X;
  var computedDynamicTagX = baseDynamicTagX - TAG_SHIFT_X;

  // White overlay for initial fade
  var whiteOverlay = null;
  var whiteFadeInterval = null;

  // Shadow & tag animation controls
  var shadowAnimInterval = null;
  var shadowAnimRunning = false;
  var SHADOW_ANIM_DURATION_MS = 2300; // 2.3 seconds as requested
  var TAG_FADE_DURATION_MS = 400;

  // tags states
  var tagsAllowed = false;    // true after tag fade completes
  var tagFading = false;      // true while fade running

  // Music
  var bgm = null;

  var CONFIRM_KEY = jsmaf.circleIsAdvanceButton ? 13 : 14;
  var BACK_KEY = jsmaf.circleIsAdvanceButton ? 14 : 13;

  // ==================== STYLES ====================
  new Style({ name: 'headerTitle', color: 'white', size: 48, align: 'left' });
  new Style({ name: 'headerSubtitle', color: 'white', size: 32, align: 'left' });
  new Style({ name: 'listItem', color: 'white', size: 36, align: 'left' });
  new Style({ name: 'backHint', color: 'white', size: 28, align: 'center' });

  // ==================== Global helper: robust stop for any bgm instances ====================
  // Expose a global helper so any included theme/main scripts or other menus can be reliably stopped.
  (function createGlobalStopper() {
    try {
      // prefer a single global name to avoid clobbering
      if (!window.__apollo_stop_all_bgm) {
        window.__apollo_stop_all_bgm = function() {
          try { if (bgm && bgm.stop) { try { bgm.stop(); } catch (e) {} } } catch (e) {}
          try { if (window.bgm && window.bgm.stop) { try { window.bgm.stop(); } catch (e) {} } } catch (e) {}
          try { if (window._apollo_bgm && window._apollo_bgm.stop) { try { window._apollo_bgm.stop(); } catch (e) {} } } catch (e) {}
          // clear known references
          try { window._apollo_bgm = null; } catch (e) {}
          try { window.bgm = null; } catch (e) {}
          try { bgm = null; } catch (e) {}
        };
      }
    } catch (e) {
      // ignore
    }
  })();

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
  scrollbarBg = new Image({
    url: IMG_PATH + 'scroll_bg.png',
    x: scrollbarBgX,
    y: LIST_START_Y,
    width: SCROLLBAR_WIDTH,
    height: HEIGHT - LIST_START_Y - 100,
    alpha: 0.5
  });
  jsmaf.root.children.push(scrollbarBg);

  scrollbarCursor = new Image({
    url: IMG_PATH + 'scroll_lock.png',
    x: scrollCursorX,
    y: LIST_START_Y,
    width: SCROLL_CURSOR_WIDTH,
    height: 50,
    alpha: 0.8,
    visible: false
  });
  jsmaf.root.children.push(scrollbarCursor);

  // ==================== SLIDING SHADOW ====================
  // start off-screen left collapsed
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
    y: LIST_START_Y,
    width: rightBoundary - 10,
    height: LINE_HEIGHT,
    alpha: 0.6,
    visible: false
  });
  jsmaf.root.children.push(selectionBar);

  selectionArrow = new Image({
    url: IMG_PATH + 'mark_arrow.png',
    x: 30,
    y: LIST_START_Y,
    width: 40,
    height: 50,
    alpha: 0.95,
    visible: false
  });
  jsmaf.root.children.push(selectionArrow);

  // ==================== TAG IMAGES (load & position early, hidden via alpha=0) ====================
  tagPs4 = new Image({
    url: IMG_PATH + 'tag_ps4.png',
    x: computedTagPs4X,
    y: LIST_START_Y,
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    alpha: 0.0,   // hidden but loaded
    visible: true // visible so texture is ready; alpha controls actual visibility
  });
  jsmaf.root.children.push(tagPs4);

  tagJs = new Image({
    url: IMG_PATH + 'tag_js.png',
    x: computedDynamicTagX,
    y: LIST_START_Y,
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    alpha: 0.0,
    visible: true
  });
  jsmaf.root.children.push(tagJs);

  tagBin = new Image({
    url: IMG_PATH + 'tag_bin.png',
    x: computedDynamicTagX,
    y: LIST_START_Y,
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    alpha: 0.0,
    visible: true
  });
  jsmaf.root.children.push(tagBin);

  tagElf = new Image({
    url: IMG_PATH + 'tag_elf.png',
    x: computedDynamicTagX,
    y: LIST_START_Y,
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    alpha: 0.0,
    visible: true
  });
  jsmaf.root.children.push(tagElf);

  // applyTagShift helper
  function applyTagShift() {
    computedTagPs4X = baseTagPs4X - TAG_SHIFT_X;
    computedDynamicTagX = baseDynamicTagX - TAG_SHIFT_X;
    if (tagPs4) tagPs4.x = computedTagPs4X;
    if (tagJs) tagJs.x = computedDynamicTagX;
    if (tagBin) tagBin.x = computedDynamicTagX;
    if (tagElf) tagElf.x = computedDynamicTagX;
  }
  function setTagShift(px) { TAG_SHIFT_X = Number(px) || 0; applyTagShift(); updateUI && updateUI(); }
  try { window.setTagShift = setTagShift; } catch (e) { /* ignore */ }

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
    text.y = LIST_START_Y + (idx) * LINE_HEIGHT + TEXT_OFFSET;
    text.visible = false;
    jsmaf.root.children.push(text);
    itemTexts.push(text);
  }
  if (totalItems === 0) {
    var noPayloadsText = new jsmaf.Text();
    noPayloadsText.text = 'No payloads found';
    noPayloadsText.style = 'listItem';
    noPayloadsText.x = 100;
    noPayloadsText.y = LIST_START_Y + TEXT_OFFSET;
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
    var duration = 1500;
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

  // ==================== MUSIC ====================
  function startMusic() {
    // Always (re)open the bgm file when starting the UI so reopening the script restarts music reliably.
    try {
      // robustly stop any bgm instances (global or local)
      try { if (window.__apollo_stop_all_bgm) window.__apollo_stop_all_bgm(); } catch (e) {}
    } catch (e) {}

    // create a fresh clip for this menu and also expose a global ref for other scripts to find/stop
    try {
      bgm = new jsmaf.AudioClip();
      bgm.open(SONG_PATH); // themes/apollo/song/bg.wav
      bgm.volume = 0.5;
      try { bgm.play(true); } catch (e) { /* ignore play errors */ }
      // store global pointer so other included scripts can stop it if needed
      try { window._apollo_bgm = bgm; window.bgm = bgm; } catch (e) {}
    } catch (e) {
      log('Error loading music: ' + (e && e.message ? e.message : e));
      bgm = null;
    }
  }
  function stopMusic() {
    // stop local and attempt to stop any known global references too
    try {
      if (bgm && bgm.stop) {
        try { bgm.stop(); } catch (e) {}
      }
    } catch (e) {}
    try {
      if (window._apollo_bgm && window._apollo_bgm.stop) {
        try { window._apollo_bgm.stop(); } catch (e) {}
      }
    } catch (e) {}
    try {
      if (window.bgm && window.bgm.stop) {
        try { window.bgm.stop(); } catch (e) {}
      }
    } catch (e) {}
    // clear references
    try { window._apollo_bgm = null; } catch (e) {}
    try { window.bgm = null; } catch (e) {}
    bgm = null;
    // also call global stopper if present
    try { if (window.__apollo_stop_all_bgm) window.__apollo_stop_all_bgm(); } catch (e) {}
  }

  // ==================== SHADOW ANIMATION (from left and expand) ====================
  function startShadowAndTagsSequence() {
    if (shadowAnimRunning) return;
    shadowAnimRunning = true;
    tagsAllowed = false;
    tagFading = false;

    // make sure tags are loaded/positioned and hidden via alpha=0 (not visibility)
    applyTagShift();
    updateUI(); // positions will be applied by updateUI

    // ensure tags are visible in the scene so textures are ready, but alpha=0 so invisible
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
      // ease-out cubic
      var progress = 1 - Math.pow(1 - t, 3);

      var newX = Math.round(startX + (targetX - startX) * progress);
      var newW = Math.round(startW + (targetW - startW) * progress);

      shadow.x = newX;
      shadow.width = Math.max(1, newW);

      // keep tags positioned relative to selection during animation
      updateUI();

      if (t >= 1) {
        jsmaf.clearInterval(shadowAnimInterval);
        shadowAnimInterval = null;
        shadowAnimRunning = false;
        shadow.x = targetX;
        shadow.width = targetW;
        // start tag fade in
        fadeInTags(TAG_FADE_DURATION_MS);
      }
    }, 16);
  }

  // fade only the correct tag for the current selection; others remain alpha=0
  function fadeInTags(durationMs) {
    tagFading = true;
    tagsAllowed = false;
    var start = Date.now();
    var interval = jsmaf.setInterval(function() {
      var elapsed = Date.now() - start;
      var p = Math.min(1, elapsed / durationMs);

      // ensure positions are fresh
      updateUI();

      // determine which tag should be shown for current selectedIndex
      var fileName = (fileList[selectedIndex] && fileList[selectedIndex].name || '').toLowerCase();
      var showJs = fileName.endsWith('.js');
      var showBin = fileName.endsWith('.bin');
      var showElf = fileName.endsWith('.elf');

      // tag alpha logic: only the active tag gets alpha = p, PS4 tag also fades in with active tag
      if (tagPs4) tagPs4.alpha = p;
      if (tagJs) tagJs.alpha = showJs ? p : 0.0;
      if (tagBin) tagBin.alpha = showBin ? p : 0.0;
      if (tagElf) tagElf.alpha = showElf ? p : 0.0;

      if (p >= 1) {
        jsmaf.clearInterval(interval);
        tagFading = false;
        tagsAllowed = true;
        // ensure final alphas are exact
        if (tagPs4) tagPs4.alpha = 1.0;
        if (tagJs) tagJs.alpha = (showJs ? 1.0 : 0.0);
        if (tagBin) tagBin.alpha = (showBin ? 1.0 : 0.0);
        if (tagElf) tagElf.alpha = (showElf ? 1.0 : 0.0);
        updateUI();
      }
    }, 16);
  }

  // ==================== UPDATE VISIBLE ITEMS ====================
  function updateUI() {
    subtitleText.text = (fileList.length) + ' payloads';

    if (scrollOffset < 0) scrollOffset = 0;
    if (scrollOffset > Math.max(0, fileList.length - VISIBLE_ITEMS)) scrollOffset = Math.max(0, fileList.length - VISIBLE_ITEMS);

    for (var i = 0; i < itemTexts.length; i++) {
      var visible = (i >= scrollOffset && i < scrollOffset + VISIBLE_ITEMS);
      itemTexts[i].visible = visible;
      if (visible) itemTexts[i].y = LIST_START_Y + (i - scrollOffset) * LINE_HEIGHT + TEXT_OFFSET;
    }

    if (fileList.length > 0 && selectedIndex >= scrollOffset && selectedIndex < scrollOffset + VISIBLE_ITEMS) {
      var barY = LIST_START_Y + (selectedIndex - scrollOffset) * LINE_HEIGHT;
      selectionBar.visible = true;
      selectionBar.y = barY;
      selectionArrow.visible = true;
      selectionArrow.y = barY + ARROW_OFFSET;
      selectionArrow.x = 30;

      var tagY = barY + Math.round((LINE_HEIGHT - TAG_HEIGHT) / 2);

      // If tag fade is in progress, the fade routine controls alpha, so only update positions.
      if (tagFading) {
        if (tagPs4) { tagPs4.y = tagY; tagPs4.visible = true; }
        if (tagJs) { tagJs.y = tagY; tagJs.visible = true; }
        if (tagBin) { tagBin.y = tagY; tagBin.visible = true; }
        if (tagElf) { tagElf.y = tagY; tagElf.visible = true; }
      } else if (tagsAllowed) {
        // normal behavior: show the correct tag with alpha=1
        if (tagPs4) { tagPs4.visible = true; tagPs4.y = tagY; tagPs4.alpha = 1.0; }
        var fileName = (fileList[selectedIndex] && fileList[selectedIndex].name || '').toLowerCase();
        if (tagJs) { tagJs.visible = true; tagJs.y = tagY; tagJs.alpha = fileName.endsWith('.js') ? 1.0 : 0.0; }
        if (tagBin) { tagBin.visible = true; tagBin.y = tagY; tagBin.alpha = fileName.endsWith('.bin') ? 1.0 : 0.0; }
        if (tagElf) { tagElf.visible = true; tagElf.y = tagY; tagElf.alpha = fileName.endsWith('.elf') ? 1.0 : 0.0; }
      } else {
        // tags not allowed yet: keep them invisible (alpha=0) but positioned correctly so textures stay aligned
        if (tagPs4) { tagPs4.visible = true; tagPs4.y = tagY; tagPs4.alpha = 0.0; }
        if (tagJs) { tagJs.visible = true; tagJs.y = tagY; tagJs.alpha = 0.0; }
        if (tagBin) { tagBin.visible = true; tagBin.y = tagY; tagBin.alpha = 0.0; }
        if (tagElf) { tagElf.visible = true; tagElf.y = tagY; tagElf.alpha = 0.0; }
      }
    } else {
      selectionBar.visible = false;
      selectionArrow.visible = false;
      // keep tags invisible if not in selection area
      if (!tagsAllowed && !tagFading) {
        if (tagPs4) tagPs4.alpha = 0.0;
        if (tagJs) tagJs.alpha = 0.0;
        if (tagBin) tagBin.alpha = 0.0;
        if (tagElf) tagElf.alpha = 0.0;
      } else if (!tagsAllowed && tagFading) {
        // during fading, positions will be updated above; keep them hidden if not selected slot
      } else if (tagsAllowed) {
        // tags allowed but no selection visible: hide alphas
        if (tagPs4) tagPs4.alpha = 0.0;
        if (tagJs) tagJs.alpha = 0.0;
        if (tagBin) tagBin.alpha = 0.0;
        if (tagElf) tagElf.alpha = 0.0;
      }
    }

    // scrollbar
    if (fileList.length > VISIBLE_ITEMS) {
      var scrollAreaHeight = HEIGHT - LIST_START_Y - 100;
      var cursorHeight = Math.max(30, Math.floor((VISIBLE_ITEMS / fileList.length) * scrollAreaHeight));
      var denom = (fileList.length - VISIBLE_ITEMS);
      var cursorY;
      if (denom <= 0) cursorY = LIST_START_Y;
      else cursorY = LIST_START_Y + Math.floor((scrollOffset / denom) * (scrollAreaHeight - cursorHeight));
      scrollbarCursor.y = cursorY;
      scrollbarCursor.height = cursorHeight;
      scrollbarCursor.visible = true;
      scrollbarBg.visible = true;
    } else {
      scrollbarCursor.visible = false;
      scrollbarBg.visible = false;
    }
  }

  // ==================== NAVIGATION (mirror C behavior) ====================
  function moveSelection(delta) {
    if (fileList.length === 0) return;
    var newIdx = selectedIndex + delta;
    if (Math.abs(delta) === 1) {
      if (newIdx < 0) newIdx = fileList.length - 1;
      else if (newIdx >= fileList.length) newIdx = 0;
    } else {
      if (newIdx < 0) newIdx = 0;
      else if (newIdx >= fileList.length) newIdx = fileList.length - 1;
    }
    if (newIdx === selectedIndex) return;
    selectedIndex = newIdx;
    if (selectedIndex < scrollOffset) scrollOffset = selectedIndex;
    else if (selectedIndex >= scrollOffset + VISIBLE_ITEMS) scrollOffset = selectedIndex - VISIBLE_ITEMS + 1;
    updateUI();
  }
  function jumpToFirst() { selectedIndex = 0; scrollOffset = 0; updateUI(); }
  function jumpToLast() { selectedIndex = fileList.length - 1; scrollOffset = Math.max(0, fileList.length - VISIBLE_ITEMS); updateUI(); }
  function jumpPage(deltaPages) {
    var delta = deltaPages * VISIBLE_ITEMS;
    var newIdx = selectedIndex + delta;
    if (newIdx < 0) newIdx = 0;
    if (newIdx >= fileList.length) newIdx = fileList.length - 1;
    selectedIndex = newIdx;
    if (selectedIndex < scrollOffset) scrollOffset = selectedIndex;
    else if (selectedIndex >= scrollOffset + VISIBLE_ITEMS) scrollOffset = selectedIndex - VISIBLE_ITEMS + 1;
    updateUI();
  }
  function skipBlock(blockSize) {
    var delta = blockSize;
    var newIdx = selectedIndex + delta;
    if (Math.abs(delta) === 1) {
      if (newIdx < 0) newIdx = fileList.length - 1;
      if (newIdx >= fileList.length) newIdx = 0;
    } else {
      if (newIdx < 0) newIdx = 0;
      if (newIdx >= fileList.length) newIdx = fileList.length - 1;
    }
    if (newIdx !== selectedIndex) {
      selectedIndex = newIdx;
      if (selectedIndex < scrollOffset) scrollOffset = selectedIndex;
      else if (selectedIndex >= scrollOffset + VISIBLE_ITEMS) scrollOffset = selectedIndex - VISIBLE_ITEMS + 1;
      updateUI();
    }
  }

  // ==================== GO BACK / EXECUTE PAYLOAD ====================
  function goBack() {
    log('Returning to main menu...');
    // robustly stop all bgm before leaving
    try { if (window.__apollo_stop_all_bgm) window.__apollo_stop_all_bgm(); } catch (e) {}
    // Also stop local references
    stopMusic();
    try {
      include('themes/' + (typeof CONFIG !== 'undefined' && CONFIG.theme ? CONFIG.theme : 'default') + '/main.js');
    } catch (e) {
      log('ERROR loading main.js: ' + e.message);
    }
  }

  function handleButtonPress() {
    if (!fileList || fileList.length === 0) { log('No payloads to load.'); return; }
    var selectedEntry = fileList[selectedIndex];
    if (!selectedEntry) return;
    var filePath = selectedEntry.path;
    var fileName = selectedEntry.name;
    log('Selected: ' + fileName + ' from ' + filePath);

    // Stop music before loading payload so audio doesn't overlap / persist
    try { if (window.__apollo_stop_all_bgm) window.__apollo_stop_all_bgm(); } catch (e) {}
    stopMusic();

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
            var buf = mem.malloc(buf_size);
            var read_len = fn.read_sys(fd, buf, new BigInt(0, buf_size));
            fn.close_sys(fd);
            var scriptContent = '';
            var len = read_len instanceof BigInt ? read_len.lo : read_len;
            log('File read size: ' + len + ' bytes');
            for (var j = 0; j < len; j++) {
              scriptContent += String.fromCharCode(mem.view(buf).getUint8(j));
            }
            log('Executing via eval()...');
            eval(scriptContent);
          } else {
            log('ERROR: Could not open file for reading!');
          }
        }
      } else {
        log('Loading binloader.js...');
        include('binloader.js');
        log('binloader.js loaded successfully');
        log('Initializing binloader...');
        var { bl_load_from_file } = binloader_init();
        log('Loading payload from: ' + filePath);
        bl_load_from_file(filePath);
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
      // Confirm key may map to 13 or 14 depending on controller; handle both by stopping music first
      handleButtonPress();
    } else if (keyCode === BACK_KEY || keyCode === 13 || keyCode === 41) {
      // explicit requirement: reset/stop song on keycode 13 as well — handle here
      try { if (window.__apollo_stop_all_bgm) window.__apollo_stop_all_bgm(); } catch (e) {}
      stopMusic();
      goBack();
    }
  };

  if (typeof jsmaf.onMouseDown === 'function') {
    jsmaf.onMouseDown = function(button, x, y) {
      if (button !== 1) return;
      for (var i = scrollOffset; i < scrollOffset + VISIBLE_ITEMS && i < itemTexts.length; i++) {
        var itemY = LIST_START_Y + (i - scrollOffset) * LINE_HEIGHT;
        if (y >= itemY && y <= itemY + LINE_HEIGHT) {
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
  if (scrollOffset > Math.max(0, fileList.length - VISIBLE_ITEMS)) scrollOffset = Math.max(0, fileList.length - VISIBLE_ITEMS);

  // position tags & items, then start animations
  applyTagShift();
  updateUI();

  // Start white fade (1.5s) and shadow animation (2.3s) in parallel
  startWhiteFade();
  startShadowAndTagsSequence();
  // start music (this will re-open themes/apollo/song/bg.wav and ensure previous clips are stopped)
  startMusic();

  log('Payload menu UI loaded (tags preloaded & hidden; shadow animation + tag fade queued).');
})();
