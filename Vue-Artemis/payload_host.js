(function () {
  // ---------- Configuration ----------
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var CENTER_X = SCREEN_W / 2;
  var ASSET_PATH = 'file:///../download0/data/';

  // UI dimensions
  var ICON_X = 50;
  var ICON_Y = 50;
  var ICON_W = 130;
  var ICON_H = 138;

  var LINE_X = ICON_X + ICON_W + 20;   // 200
  var LINE_Y = 100;
  var LINE_TARGET_W = 1600;             // from x=200 to x=1800
  var LINE_H = 4;

  var TITLE_RIGHT_X = 1800;              // right‑aligned title
  var TITLE_LEFT_X = LINE_X + 20;        // left‑aligned title (Cheats)
  var TITLE_Y = LINE_Y - 40;             // above line

  // List positioning – centered, shifted left, and moved far down
  var LIST_HORIZONTAL_OFFSET = -150;      // move left by 150px
  var LIST_CENTER_X = CENTER_X + LIST_HORIZONTAL_OFFSET;

  var ARROW_W = 42;
  var ARROW_H = 42;
  var GAP_BETWEEN_ARROW_AND_TEXT = 300;   // large gap
  var TEXT_WIDTH = 600;                   // approximate width for longest name
  var ARROW_X = LIST_CENTER_X - TEXT_WIDTH/2 - ARROW_W - GAP_BETWEEN_ARROW_AND_TEXT;
  var TEXT_X = LIST_CENTER_X - TEXT_WIDTH/2;
  var LIST_START_Y = 550;                  // moved far down
  var ITEM_HEIGHT = 55;                     // gap between items
  var VISIBLE_TOP = 200;
  var VISIBLE_BOTTOM = 900;

  // Selection bar
  var SEL_BAR_HEIGHT = 50;                  // height of the selection bar (bigger than text)
  var SEL_BAR_X = 0;
  var SEL_BAR_WIDTH = SCREEN_W;

  // Footer
  var FOOTER_Y = SCREEN_H - 100;            // vertical position of footer
  var FOOTER_ICON_SIZE = 32;
  var FOOTER_TEXT_SIZE = 36;                 // "Bigger text lol"
  var FOOTER_GAP_ICON_TEXT = 10;             // gap between icon and text
  var FOOTER_GAP_SELECT_BACK = 200;          // gap between Select and Back sections

  // ---------- Global Variables ----------
  var currentIndex = 0;
  var scrollOffset = 0;
  var fileList = [];
  var payloadTexts = [];                 // array of Text objects for payload names
  var arrowImg = null;
  var lineImg = null;
  var iconImg = null;
  var titleRight = null;                  // "Payload Menu" (right)
  var titleLeft = null;                    // "Cheats" (left)
  var selBarImg = null;                    // selection bar image
  var footerSelectIcon = null;             // cross icon
  var footerSelectText = null;             // "Select" text
  var footerBackIcon = null;               // circle icon
  var footerBackText = null;               // "Back" text
  var fadeElements = [];                   // all elements that fade in (except background)
  var fadeInterval = null;
  var fadingIn = true;
  var pressedKeys = {};                    // simple debounce

  // Estimated text height for centering
  var TEXT_HEIGHT = 38; // approximate for size 36

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

    // Icon (top‑left)
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

    // Right title: "Payload Menu"
    titleRight = new jsmaf.Text();
    titleRight.text = 'Payload Menu';
    titleRight.style = 'title';
    titleRight.x = TITLE_RIGHT_X - 200; // rough centering
    titleRight.y = TITLE_Y;
    titleRight.alpha = 0.0;
    jsmaf.root.children.push(titleRight);
    fadeElements.push(titleRight);

    // Left title: "Cheats"
    titleLeft = new jsmaf.Text();
    titleLeft.text = 'Cheats';
    titleLeft.style = 'title';
    titleLeft.x = TITLE_LEFT_X;
    titleLeft.y = TITLE_Y;
    titleLeft.alpha = 0.0;
    jsmaf.root.children.push(titleLeft);
    fadeElements.push(titleLeft);

    // Selection bar (full width, behind text)
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

    // Arrow
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

    // Payload text items – vertically centered within each slot
    for (var i = 0; i < fileList.length; i++) {
      var txt = new jsmaf.Text();
      txt.text = fileList[i];
      txt.style = 'listText';
      txt.x = TEXT_X;
      // Center vertically within the slot
      txt.y = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2;
      txt.alpha = 0.0;
      payloadTexts.push(txt);
      jsmaf.root.children.push(txt);
      fadeElements.push(txt);
    }

    // If no payloads, show a message
    if (fileList.length === 0) {
      var noPayloads = new jsmaf.Text();
      noPayloads.text = 'No payloads found';
      noPayloads.style = 'listText';
      noPayloads.x = TEXT_X;
      noPayloads.y = LIST_START_Y + (ITEM_HEIGHT - TEXT_HEIGHT) / 2;
      noPayloads.alpha = 0.0;
      payloadTexts.push(noPayloads);
      jsmaf.root.children.push(noPayloads);
      fadeElements.push(noPayloads);
    }

    // ---------- Footer ----------
    // Calculate positions
    var selectSectionWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 100; // approximate text width for "Select"
    var backSectionWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 80;   // approximate text width for "Back"
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
    footerSelectText.y = FOOTER_Y - 18; // approximate vertical center
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

    // Start fade‑in and line expansion
    startFadeIn();
  }

  // ---------- Fade‑in and line animation ----------
  function startFadeIn() {
    var startTime = Date.now();
    var fadeDuration = 5000;      // 5 seconds
    var lineExpandDuration = 1000; // line expands in first second

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
        // Ensure final alpha is set
        for (var i = 0; i < fadeElements.length; i++) {
          fadeElements[i].alpha = 1.0;
        }
        lineImg.width = LINE_TARGET_W;
      }
    }, 16);

    // Allow input after 2 seconds
    jsmaf.setTimeout(function() {
      fadingIn = false;
      updateSelection(); // update selection highlighting with full contrast
    }, 2000);
  }

  // ---------- Update list positions based on scroll ----------
  function updateListPositions() {
    var maxScroll = Math.max(0, fileList.length * ITEM_HEIGHT - (VISIBLE_BOTTOM - VISIBLE_TOP));
    if (scrollOffset > maxScroll) scrollOffset = maxScroll;
    if (scrollOffset < 0) scrollOffset = 0;

    for (var i = 0; i < payloadTexts.length; i++) {
      var baseY = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2;
      var y = baseY - scrollOffset;
      payloadTexts[i].y = y;
      // Hide if outside visible area
      if (y < VISIBLE_TOP - TEXT_HEIGHT || y > VISIBLE_BOTTOM) {
        payloadTexts[i].visible = false;
      } else {
        payloadTexts[i].visible = true;
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
      var selectedTextY = LIST_START_Y + currentIndex * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2 - scrollOffset;
      // Center bar vertically on the text
      selBarImg.y = selectedTextY - (SEL_BAR_HEIGHT - TEXT_HEIGHT) / 2;
      // Ensure bar is visible only if the item is visible
      if (selBarImg.y < VISIBLE_TOP - SEL_BAR_HEIGHT || selBarImg.y > VISIBLE_BOTTOM) {
        selBarImg.visible = false;
      } else {
        selBarImg.visible = true;
      }
    } else {
      selBarImg.visible = false;
    }
  }

  // ---------- Ensure current index is visible ----------
  function ensureVisible() {
    var itemTop = LIST_START_Y + currentIndex * ITEM_HEIGHT - scrollOffset;
    var itemBottom = itemTop + ITEM_HEIGHT;
    if (itemTop < VISIBLE_TOP) {
      scrollOffset = Math.max(0, LIST_START_Y + currentIndex * ITEM_HEIGHT - VISIBLE_TOP);
    } else if (itemBottom > VISIBLE_BOTTOM) {
      scrollOffset = LIST_START_Y + currentIndex * ITEM_HEIGHT + ITEM_HEIGHT - VISIBLE_BOTTOM;
    }
  }

  // ---------- Update selection (called after index change) ----------
  function updateSelection() {
    // When fadingIn is false, we still have alpha values; selection uses baseAlpha = 1.0 for contrast
    ensureVisible();
    updateListPositions();
  }

  // ---------- Navigation with wrap-around ----------
  function moveUp() {
    if (fileList.length === 0) return;
    if (currentIndex === 0) {
      // Wrap to last
      currentIndex = fileList.length - 1;
      // Scroll to bottom
      scrollOffset = Math.max(0, fileList.length * ITEM_HEIGHT - (VISIBLE_BOTTOM - VISIBLE_TOP));
    } else {
      currentIndex--;
    }
    updateSelection();
  }

  function moveDown() {
    if (fileList.length === 0) return;
    if (currentIndex === fileList.length - 1) {
      // Wrap to first
      currentIndex = 0;
      // Scroll to top
      scrollOffset = 0;
    } else {
      currentIndex++;
    }
    updateSelection();
  }

  // ---------- Handle payload selection (Enter) ----------
  function handleSelect() {
    if (fadingIn) return; // still ignore during first 2 seconds? user said "after just 2 seconds", so we keep check
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
      include('main-menu.js');  // This will load and execute the main menu script, replacing the current one
    } catch (e) {
      log('ERROR loading main-menu.js: ' + e.message);
    }
  }

  // ---------- Keyboard Handling ----------
  jsmaf.onKeyDown = function (keyCode) {
    if (fadingIn) return; // block during first 2 seconds
    if (pressedKeys[keyCode]) return;
    pressedKeys[keyCode] = true;

    // Up: 4, 7 (arrow up), 55
    if (keyCode === 4 || keyCode === 7 || keyCode === 55) {
      moveUp();
    }
    // Down: 6 (arrow down), 57
    else if (keyCode === 6 || keyCode === 57) {
      moveDown();
    }
    // Enter: 14
    else if (keyCode === 14) {
      handleSelect();
    }
    // ESC: 27 – go back
    else if (keyCode === 27) {
      goBack();
    }
    // Backspace (13) also goes back (from original)
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