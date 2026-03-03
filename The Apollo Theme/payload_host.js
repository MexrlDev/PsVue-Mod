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

  // Tag image dimensions. btw i like these tags so much
  var TAG_WIDTH = 60;
  var TAG_HEIGHT = 25;
  var TAG_GAP = 10;
  var RIGHT_MARGIN = 20;

  // X positions for tags
  var rightBoundary = WIDTH - SCROLLBAR_WIDTH - SCROLLBAR_RIGHT - RIGHT_MARGIN;
  var tagPs4X = rightBoundary - TAG_WIDTH;
  var dynamicTagX = tagPs4X - TAG_GAP - TAG_WIDTH;

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

  // Music
  var bgm = null;

  var CONFIRM_KEY = jsmaf.circleIsAdvanceButton ? 13 : 14;
  var BACK_KEY = jsmaf.circleIsAdvanceButton ? 14 : 13;

  // ==================== STYLES ====================
  new Style({ name: 'headerTitle', color: 'white', size: 48, align: 'left' });
  new Style({ name: 'headerSubtitle', color: 'white', size: 32, align: 'left' });
  new Style({ name: 'listItem', color: 'white', size: 36, align: 'left' });
  new Style({ name: 'backHint', color: 'white', size: 28, align: 'center' });

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
    alpha: 0.8
  });
  jsmaf.root.children.push(scrollbarCursor);

  // ==================== SLIDING SHADOW ====================
  shadow = new Image({ url: IMG_PATH + 'edit_shadow.png', x: WIDTH, y: 0, width: SHADOW_WIDTH, height: HEIGHT, alpha: 0.8 });
  jsmaf.root.children.push(shadow);

  // ==================== SELECTION BAR AND ARROW ====================
  selectionBar = new Image({
    url: IMG_PATH + 'mark_line.png',
    x: 0,
    y: LIST_START_Y,
    width: WIDTH,
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
    alpha: 0.9,
    visible: false
  });
  jsmaf.root.children.push(selectionArrow);

  // ==================== TAG IMAGES ====================
  // Permanent PS4 tag
  tagPs4 = new Image({
    url: IMG_PATH + 'tag_ps4.png',
    x: tagPs4X,
    y: LIST_START_Y,
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    alpha: 1.0,
    visible: false
  });
  jsmaf.root.children.push(tagPs4);

  // Dynamic type tags
  tagJs = new Image({
    url: IMG_PATH + 'tag_js.png',
    x: dynamicTagX,
    y: LIST_START_Y,
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    alpha: 1.0,
    visible: false
  });
  jsmaf.root.children.push(tagJs);

  tagBin = new Image({
    url: IMG_PATH + 'tag_bin.png',
    x: dynamicTagX,
    y: LIST_START_Y,
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    alpha: 1.0,
    visible: false
  });
  jsmaf.root.children.push(tagBin);

  tagElf = new Image({
    url: IMG_PATH + 'tag_elf.png',
    x: dynamicTagX,
    y: LIST_START_Y,
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    alpha: 1.0,
    visible: false
  });
  jsmaf.root.children.push(tagElf);

  // ==================== BACK HINT ====================
  backHint = new jsmaf.Text();
  backHint.text = jsmaf.circleIsAdvanceButton ? 'X to go back' : 'O to go back';
  backHint.style = 'backHint';
  backHint.x = 960;
  backHint.y = HEIGHT - 60;
  jsmaf.root.children.push(backHint);

  // ==================== CREATE LIST ITEMS FROM SCANNED FILES ====================
  for (var idx = 0; idx < fileList.length; idx++) {
    var displayName = fileList[idx].name;
    if (displayName.length > 40) {
      displayName = displayName.substring(0, 37) + '...';
    }
    var text = new jsmaf.Text();
    text.text = displayName;
    text.style = 'listItem';
    text.x = 100;
    text.y = LIST_START_Y + idx * LINE_HEIGHT + TEXT_OFFSET;
    jsmaf.root.children.push(text);
    itemTexts.push(text);
  }

  // If no payloads found, show a placeholder
  if (totalItems === 0) {
    var noPayloadsText = new jsmaf.Text();
    noPayloadsText.text = 'No payloads found';
    noPayloadsText.style = 'listItem';
    noPayloadsText.x = 100;
    noPayloadsText.y = LIST_START_Y + TEXT_OFFSET;
    jsmaf.root.children.push(noPayloadsText);
    itemTexts.push(noPayloadsText);
    totalItems = 1;
  }

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

  // ==================== ANIMATION: SLIDE IN ====================
  function startSlideIn() {
    animationStep = 0;
    if (animationInterval) jsmaf.clearInterval(animationInterval);
    animationInterval = jsmaf.setInterval(function() {
      animationStep++;
      var targetX = 300;
      var startX = WIDTH;
      var progress = animationStep / animationMax;
      if (progress > 1) progress = 1;
      var newX = startX + (targetX - startX) * progress;
      shadow.x = newX;
      if (progress >= 1) {
        jsmaf.clearInterval(animationInterval);
        animationInterval = null;
        shadow.x = targetX;
      }
    }, 16);
  }

  // ==================== UPDATE VISIBLE ITEMS ====================
  function updateUI() {
    for (var i = 0; i < itemTexts.length; i++) {
      var visible = (i >= scrollOffset && i < scrollOffset + VISIBLE_ITEMS);
      itemTexts[i].visible = visible;
      if (visible) {
        itemTexts[i].y = LIST_START_Y + (i - scrollOffset) * LINE_HEIGHT + TEXT_OFFSET;
      }
    }

    if (totalItems > 0 && selectedIndex >= scrollOffset && selectedIndex < scrollOffset + VISIBLE_ITEMS) {
      var barY = LIST_START_Y + (selectedIndex - scrollOffset) * LINE_HEIGHT;
      selectionBar.visible = true;
      selectionBar.y = barY;
      selectionArrow.visible = true;
      selectionArrow.y = barY + ARROW_OFFSET;

      var tagY = barY + (LINE_HEIGHT - TAG_HEIGHT) / 2;
      tagPs4.visible = true;
      tagPs4.y = tagY;

      var fileName = fileList[selectedIndex].name.toLowerCase();
      tagJs.visible = false;
      tagBin.visible = false;
      tagElf.visible = false;

      if (fileName.endsWith('.js')) {
        tagJs.visible = true;
        tagJs.y = tagY;
      } else if (fileName.endsWith('.bin')) {
        tagBin.visible = true;
        tagBin.y = tagY;
      } else if (fileName.endsWith('.elf')) {
        tagElf.visible = true;
        tagElf.y = tagY;
      }
    } else {
      selectionBar.visible = false;
      selectionArrow.visible = false;
      tagPs4.visible = false;
      tagJs.visible = false;
      tagBin.visible = false;
      tagElf.visible = false;
    }

    if (totalItems > VISIBLE_ITEMS) {
      var cursorHeight = Math.max(30, Math.floor((VISIBLE_ITEMS / totalItems) * (HEIGHT - LIST_START_Y - 100)));
      var cursorY = LIST_START_Y + Math.floor((scrollOffset / (totalItems - VISIBLE_ITEMS)) * (HEIGHT - LIST_START_Y - 100 - cursorHeight));
      scrollbarCursor.y = cursorY;
      scrollbarCursor.height = cursorHeight;
      scrollbarCursor.visible = true;
      scrollbarBg.visible = true;
    } else {
      scrollbarCursor.visible = false;
      scrollbarBg.visible = false;
    }
  }

  // ==================== NAVIGATION ====================
  function moveSelection(delta) {
    if (totalItems === 0) return;
    var newIdx = selectedIndex + delta;
    if (newIdx < 0) newIdx = totalItems - 1;
    else if (newIdx >= totalItems) newIdx = 0;
    if (newIdx === selectedIndex) return;
    selectedIndex = newIdx;
    if (selectedIndex < scrollOffset) {
      scrollOffset = selectedIndex;
    } else if (selectedIndex >= scrollOffset + VISIBLE_ITEMS) {
      scrollOffset = selectedIndex - VISIBLE_ITEMS + 1;
    }
    updateUI();
  }

  // ==================== GO BACK TO MAIN MENU ====================
  function goBack() {
    log('Returning to main menu...');
    stopMusic();
    try {
      include('themes/' + (typeof CONFIG !== 'undefined' && CONFIG.theme ? CONFIG.theme : 'default') + '/main.js');
    } catch (e) {
      log('ERROR loading main.js: ' + e.message);
    }
  }

  // ==================== HANDLE PAYLOAD EXECUTION ====================
  function handleButtonPress() {
    if (totalItems === 0 || fileList.length === 0) {
      log('No payloads to load.');
      return;
    }
    var selectedEntry = fileList[selectedIndex];
    if (!selectedEntry) return;
    var filePath = selectedEntry.path;
    var fileName = selectedEntry.name;
    log('Selected: ' + fileName + ' from ' + filePath);
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

  // ==================== KEYBOARD HANDLER ====================
  jsmaf.onKeyDown = function(keyCode) {
    if (keyCode === 4) moveSelection(-1);
    else if (keyCode === 6) moveSelection(1);
    else if (keyCode === 7 || keyCode === 58) moveSelection(-VISIBLE_ITEMS);
    else if (keyCode === 5 || keyCode === 56) moveSelection(VISIBLE_ITEMS);
    else if (keyCode === CONFIRM_KEY) handleButtonPress();
    else if (keyCode === BACK_KEY || keyCode === 13 || keyCode === 41) goBack();
  };

  // ==================== MOUSE CLICK (optional) ====================
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
  updateUI();
  startSlideIn();
  startMusic();
  log('Payload menu UI loaded');
})();