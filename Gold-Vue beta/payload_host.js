(function () {

  if (typeof libc_addr === 'undefined') {
    log('Loading userland.js...');
    try { include('userland.js'); } catch (e) { log('include(userland.js) failed: ' + (e.message || e)); }
    log('userland.js attempted to load');
  } else {
    log('userland.js already loaded (libc_addr defined)');
  }

  // --- helpers to find
  function findChildByName(name) {
    try {
      for (var i = 0; i < jsmaf.root.children.length; i++) {
        var c = jsmaf.root.children[i];
        if (!c) continue;
        if (c._ourName === name) return c;
      }
    } catch (e) {}
    return null;
  }

  function createBackground() {
    var existing = findChildByName('payload_bg');
    if (existing) {
      background = existing;
      return existing;
    }
    try {
      background = new Image({ url: 'file:///../download0/img/multiview_bg_VAF.png', x: 0, y: 0, width: 1920, height: 1080 });
      background._ourName = 'payload_bg';
      background.alpha = 0;
      background._baseX = background.x;
      jsmaf.root.children.push(background);
      return background;
    } catch (e) {
      log('createBackground failed: ' + (e.message || e));
      background = null;
      return null;
    }
  }

  function createLogo() {
    var existing = findChildByName('payload_logo');
    if (existing) {
      logo = existing;
      return existing;
    }
    try {
      logo = new Image({ url: 'file:///../download0/img/logo.png', x: 1620, y: 0, width: 300, height: 169 });
      logo._ourName = 'payload_logo';
      logo.alpha = 0; logo.scaleX = 0.98; logo.scaleY = 0.98;
      jsmaf.root.children.push(logo);
      return logo;
    } catch (e) {
      log('createLogo failed: ' + (e.message || e));
      logo = null;
      return null;
    }
  }

  function createCursor() {
    var existing = findChildByName('payload_cursor');
    if (existing) {
      cursor = existing;
      return existing;
    }
    try {
      cursor = new Image({ url: 'file:///assets/img/cursor.png', x: virtualMouse.x - cursorSize.w/2, y: virtualMouse.y - cursorSize.h/2, width: cursorSize.w, height: cursorSize.h });
      cursor._ourName = 'payload_cursor';
      cursor.alpha = 1; cursor.visible = false; cursor._isCursor = true;
      jsmaf.root.children.push(cursor);
      return cursor;
    } catch (e) {
      log('createCursor failed: ' + (e.message || e));
      cursor = null;
      return null;
    }
  }

  // --- audio helper (create bgm safely) ---
  // Removed bgm creation so we don't interfere with main menu song
  var bgm = null;
  try { bgm.volume = 0; } catch (e) {}

  var clickSfx = null, loadSfx = null;
  try { clickSfx = new jsmaf.AudioClip(); clickSfx.open('file://../download0/sfx/click.wav'); } catch (e) { clickSfx = null; }
  try { loadSfx  = new jsmaf.AudioClip(); loadSfx.open('file://../download0/sfx/load.wav'); } catch (e) { loadSfx = null; }

  // --- jailbreak check (kept light & tolerant)
  function isJailbrokenCheck() {
    try {
      fn.register(24, 'getuid', [], 'bigint');
      fn.register(23, 'setuid', ['number'], 'bigint');
      var uid_before = fn.getuid();
      var val_before = uid_before instanceof BigInt ? uid_before.lo : uid_before;
      log('UID before setuid: ' + val_before);
      try { fn.setuid(0); } catch (e) { /* ignore */ }
      var uid_after = fn.getuid();
      var val_after = uid_after instanceof BigInt ? uid_after.lo : uid_after;
      log('UID after setuid: ' + val_after);
      return val_after === 0;
    } catch (e) {
      log('Jailbreak check failed: ' + (e.message || e));
      return false;
    }
  }
  var is_jailbroken = isJailbrokenCheck();

  // --- reset scene + styles (safe)
  try { jsmaf.root.children.length = jsmaf.root.children.length; } catch (e) {}
  new Style({ name: 'white', color: 'white', size: 24 });
  new Style({ name: 'title', color: 'white', size: 32 });
  new Style({ name: 'groupHeader', color: 'white', size: 20 });

  // --- helper: intervals + animation (reliable management)
  var _intervals = [];
  function _setInterval(fn, ms) { var id = jsmaf.setInterval(fn, ms); _intervals.push(id); return id; }
  function _clearAllIntervals() { for (var i = 0; i < _intervals.length; i++) { try { jsmaf.clearInterval(_intervals[i]); } catch (e) {} } _intervals = []; }
  function easeInOut(t) { return (1 - Math.cos(t * Math.PI)) / 2; }
  function animate(obj, from, to, duration, onStep, done) {
    var elapsed = 0, step = 16;
    var id = _setInterval(function () {
      try {
        elapsed += step;
        var t = Math.min(elapsed / duration, 1);
        var e = easeInOut(t);
        for (var k in to) {
          try {
            var f = (from && from[k] !== undefined) ? from[k] : (obj && obj[k] !== undefined ? obj[k] : 0);
            if (obj) obj[k] = f + (to[k] - f) * e;
          } catch (ex) {}
        }
        if (onStep) onStep(e);
        if (t >= 1) {
          try { jsmaf.clearInterval(id); } catch (ex) {}
          if (done) done();
        }
      } catch (ex) {
        try { jsmaf.clearInterval(id); } catch (ex2) {}
        if (done) done();
      }
    }, step);
    return id;
  }

  // --- visuals: ensure background + logo exist (use helpers)
  var background = createBackground();
  var logo = createLogo();

  // title (safe)
  var titleImg, titleText;
  if (typeof useImageText !== 'undefined' && useImageText) {
    try {
      titleImg = new Image({ url: (typeof textImageBase !== 'undefined' ? textImageBase : '') + 'payloadMenu.png', x: 830, y: 100, width: 250, height: 60 });
      titleImg._ourName = 'payload_titleimg';
      titleImg.alpha = 0;
      jsmaf.root.children.push(titleImg);
    } catch (e) { titleImg = undefined; }
  } else {
    titleText = new jsmaf.Text();
    titleText.text = (typeof lang !== 'undefined' ? lang.payloadMenu : 'Payload Menu');
    titleText.x = 880; titleText.y = 120; titleText.style = 'title'; titleText.alpha = 0;
    jsmaf.root.children.push(titleText);
  }

  // --- syscall registration (unchanged but tolerant)
  try {
    fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
    fn.register(0x06, 'close_sys', ['bigint'], 'bigint');
    fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint');
    fn.register(0x03, 'read_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
  } catch (e) { log('syscall register: ' + (e.message || e)); }

  // --- scan payload folders (preserve your logic + logs) ---
  var scanPaths = ['/download0/payloads'];
  if (is_jailbroken) {
    scanPaths.push('/data/payloads');
    for (var u = 0; u <= 7; u++) scanPaths.push('/mnt/usb' + u + '/payloads');
  }
  log('Scanning paths: ' + scanPaths.join(', '));

  // mem helpers (defensive)
  var path_addr = null; var buf = null;
  try { path_addr = mem.malloc(256); buf = mem.malloc(4096); } catch (e) { log('mem.malloc failed: ' + (e.message || e)); }

  var fileList = []; // files + spacer objects

  for (var sp = 0; sp < scanPaths.length; sp++) {
    var currentPath = scanPaths[sp];
    log('Scanning ' + currentPath + ' for files...');
    var localFiles = [];
    try {
      if (!path_addr) break;
      for (var c = 0; c < currentPath.length; c++) mem.view(path_addr).setUint8(c, currentPath.charCodeAt(c));
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
            for (var n = 0; n < d_namlen; n++) name += String.fromCharCode(mem.view(buf.add(new BigInt(0, offset + 8 + n))).getUint8(0));
            if (d_type === 8 && name !== '.' && name !== '..') {
              var lower = name.toLowerCase();
              if (lower.endsWith('.elf') || lower.endsWith('.bin') || lower.endsWith('.js')) {
                localFiles.push({ name: name, path: currentPath + '/' + name });
                log('Found file: ' + name + ' in ' + currentPath);
              }
            }
            offset += d_reclen || 1;
          }
        }
        try { fn.close_sys(fd); } catch (e) {}
      } else {
        log('Failed to open ' + currentPath);
      }
    } catch (e) {
      log('scan error for ' + currentPath + ': ' + (e.message || e));
    }

    if (localFiles.length > 0) {
      if (fileList.length > 0) {
        fileList.push({ spacer: true, group: currentPath });
      } else {
        fileList.push({ spacer: true, group: currentPath, firstGroup: true });
      }
      for (var lf of localFiles) fileList.push(lf);
    }
  }

  log('Total files (including spacers): ' + fileList.length);

  // --- build UI grid ---
  var currentButton = 0; // single declaration only
  var buttons = [];
  var buttonTexts = [];
  var buttonMarkers = [];
  var buttonOrigPos = [];
  var textOrigPos = [];
  var headerTexts = [];
  var buttonIndexToFileListIndex = [];

  var startY = 200;
  var baseButtonSpacing = 80;
  var baseButtonsPerRow = 5;
  var buttonWidth = 300;
  var buttonHeight = 80;
  var startX = 130;
  var baseXSpacing = 340;
  var horizontalGap = 20;
  var verticalGap = 10;
  var groupExtraRowGap = 40;
  var buttonSpacing = baseButtonSpacing + verticalGap;
  var buttonsPerRow = baseButtonsPerRow;
  var xSpacing = baseXSpacing + horizontalGap;
  var spacerRowsInserted = 0;
  var displayCount = 0;

  // Helper: truncate to a safe number of characters based on button width
  function truncateForButton(name, width) {
    try {
      var charEstimate = 10; // conservative average character width in pixels for the style used
      var maxChars = Math.max(6, Math.floor((width - 40) / charEstimate));
      if (name.length > maxChars) return name.substring(0, Math.max(3, maxChars - 3)) + '...';
      return name;
    } catch (e) { return name; }
  }

  for (var i = 0; i < fileList.length; i++) {
    var entry = fileList[i];
    if (entry && entry.spacer) {
      if (displayCount % buttonsPerRow !== 0) {
        var toNext = buttonsPerRow - (displayCount % buttonsPerRow);
        displayCount += toNext;
      }
      spacerRowsInserted++;
      entry._groupRowIndex = Math.floor(displayCount / buttonsPerRow) + spacerRowsInserted - 1;
      continue;
    }

    var prev = (i - 1 >= 0) ? fileList[i - 1] : null;
    if (prev && prev.spacer) {
      var groupName = prev.group || 'Group';
      var headerRow = Math.floor(displayCount / buttonsPerRow) + spacerRowsInserted;
      var extraGroupOffset = (spacerRowsInserted - 1) * groupExtraRowGap;
      var headerY = startY + headerRow * buttonSpacing + extraGroupOffset - 42;
      var groupHeader = new jsmaf.Text();
      groupHeader.text = groupName.replace(/^\/+/, '');
      groupHeader.x = startX;
      groupHeader.y = headerY;
      groupHeader.style = 'groupHeader';
      groupHeader.alpha = 0;
      groupHeader._ourName = 'group_header_' + spacerRowsInserted + '_' + headerRow;
      jsmaf.root.children.push(groupHeader);
      headerTexts.push(groupHeader);
      (function (h, hy) {
        jsmaf.setTimeout(function () {
          animate(h, { alpha: 0, y: hy + 8 }, { alpha: 1, y: hy }, 420);
        }, 80);
      })(groupHeader, headerY);
    }

    var row = Math.floor(displayCount / buttonsPerRow) + spacerRowsInserted;
    var col = displayCount % buttonsPerRow;
    var displayName = entry.name;

    var extraGroupOffset = spacerRowsInserted * groupExtraRowGap;
    var btnX = startX + col * xSpacing;
    var btnY = startY + row * buttonSpacing + extraGroupOffset;

    var button = new Image({ url: 'file:///../download0/img/button_over_9.png', x: btnX, y: btnY, width: buttonWidth, height: buttonHeight });
    button._ourName = 'payload_button_' + displayCount;
    button.alpha = 0; button.scaleX = 1; button.scaleY = 1;
    jsmaf.root.children.push(button); buttons.push(button);

    var marker = new Image({ url: 'file:///assets/img/ad_pod_marker.png', x: btnX + buttonWidth - 50, y: btnY + 35, width: 12, height: 12, visible: false });
    marker._ourName = 'payload_marker_' + displayCount;
    marker.alpha = 0; marker.isOrangeDot = true;
    jsmaf.root.children.push(marker); buttonMarkers.push(marker);

    // Truncate based on button width so it doesn't overflow
    displayName = truncateForButton(displayName, buttonWidth);

    // Create text: left-aligned inside button, vertically centered
    var text = new jsmaf.Text();
    text.text = displayName;
    text.x = btnX + 20; // left padding
    text.y = btnY + Math.round(buttonHeight / 2 - 12);
    text.style = 'white';
    text.alpha = 0;
    text._ourName = 'payload_text_' + displayCount;
    text._centered = false;
    try { text.align = 'left'; } catch (e) {}
    try { text.maxWidth = buttonWidth - 40; } catch (e) {}

    jsmaf.root.children.push(text); buttonTexts.push(text);

    buttonOrigPos.push({ x: btnX, y: btnY });
    textOrigPos.push({ x: text.x, y: text.y });

    (function (b, t, by, ty, dcount) {
      jsmaf.setTimeout(function () {
        animate(b, { alpha: 0, y: by + 20 }, { alpha: 1, y: by }, 360);
        animate(t, { alpha: 0, y: ty + 20 }, { alpha: 1, y: ty }, 360);
      }, 120 + dcount * 60);
    })(button, text, btnY, text.y, displayCount);

    buttonIndexToFileListIndex.push(i);
    displayCount++;
  }

  // Exit/back button (Back is last)
  var exitX = 810;
  var exitY = 980;
  var usedRows = Math.ceil(Math.max(0, displayCount) / buttonsPerRow) + spacerRowsInserted;
  if (usedRows < 0) usedRows = 0;
  var lastRowTop = startY + Math.max(0, usedRows - 1) * buttonSpacing + (spacerRowsInserted * groupExtraRowGap);
  var bottomMostY = lastRowTop + buttonHeight;
  var desiredGap = 24;
  var desiredExitTop = bottomMostY + desiredGap;
  if (desiredExitTop > exitY) exitY = desiredExitTop;
  var maxExitTop = 1080 - buttonHeight - 20;
  if (exitY > maxExitTop) exitY = maxExitTop;

  var exitButton = new Image({ url: 'file:///../download0/img/button_over_9.png', x: exitX, y: exitY, width: buttonWidth, height: buttonHeight });
  exitButton._ourName = 'payload_back';
  exitButton.alpha = 0; jsmaf.root.children.push(exitButton); buttons.push(exitButton);

  var exitMarker = new Image({ url: 'file:///assets/img/ad_pod_marker.png', x: exitX + buttonWidth - 50, y: exitY + 35, width: 12, height: 12, visible: false });
  exitMarker._ourName = 'payload_back_marker';
  exitMarker.alpha = 0; exitMarker.isOrangeDot = true; jsmaf.root.children.push(exitMarker); buttonMarkers.push(exitMarker);

  // Keep back text visually centered on the exit button
  var exitText = new jsmaf.Text();
  exitText.text = (typeof lang !== 'undefined' ? lang.back : 'Back');
  exitText.x = exitX + Math.round(buttonWidth / 2 - 20); // approximate center
  exitText.y = exitY + Math.round(buttonHeight / 2 - 12);
  exitText.style = 'white'; exitText.alpha = 0;
  exitText._ourName = 'payload_back_text';
  exitText._centered = true;
  try { exitText.align = 'center'; } catch (e) {}
  try { exitText.maxWidth = buttonWidth - 40; } catch (e) {}
  jsmaf.root.children.push(exitText); buttonTexts.push(exitText);
  buttonOrigPos.push({ x: exitX, y: exitY });
  textOrigPos.push({ x: exitText.x, y: exitText.y });

  // --- cursor support (mouse + gamepad emulated mouse) ---
  var virtualMouse = { x: 960, y: 540 };
  var lastRealMouseTime = 0;
  var mouseVisible = false;
  var mouseHideTimeout = null;
  var mouseInactivityMs = 2000;
  var cursorSize = { w: 28, h: 28 };
  var cursor = createCursor();

  // mouse mode toggled by pressing R3 (configurable index); while mouseMode true, right stick moves cursor
  var R3_BUTTON_INDEX = 11; // common mapping for R3
  var mouseModeEnabled = false;
  var lastR3State = false;
  var mouseActive = false; // set true when a real mouse is used (prevents controller from auto-clicking)

  function showCursor() {
    try {
      createCursor();
      mouseVisible = true; if (cursor) cursor.visible = true; lastRealMouseTime = Date.now();
      if (mouseHideTimeout) { try { jsmaf.clearTimeout(mouseHideTimeout); } catch (e) {} mouseHideTimeout = null; }
      mouseHideTimeout = jsmaf.setTimeout(function () {
        var now = Date.now();
        if (now - lastRealMouseTime >= mouseInactivityMs) { if (cursor) cursor.visible = false; mouseVisible = false; }
        mouseHideTimeout = null;
      }, mouseInactivityMs);
      mouseActive = true;
      try { jsmaf.clearTimeout(mouseActive._clearTO); } catch (e) {}
      mouseActive._clearTO = jsmaf.setTimeout(function () { mouseActive = false; }, 3000);
    } catch (e) { log('showCursor error: ' + (e.message || e)); }
  }

  function updateCursorPosition(x, y) {
    try {
      virtualMouse.x = x; virtualMouse.y = y;
      createCursor();
      if (cursor) { cursor.x = Math.round(virtualMouse.x - cursorSize.w / 2); cursor.y = Math.round(virtualMouse.y - cursorSize.h / 2); cursor.visible = true; }
      lastRealMouseTime = Date.now();
    } catch (e) {}
  }

  // --- animation loops ---
  var _markerPulseInterval = null;
  var _logoAnimInterval = null;
  var _bgmFadeInterval = null;
  var gpPollInterval = null;

  function startOrangeDotLoop() {
    if (_markerPulseInterval) try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {}
    var phase = 0;
    _markerPulseInterval = jsmaf.setInterval(function () {
      phase += 0.06;
      for (var i = 0; i < buttonMarkers.length; i++) {
        var m = buttonMarkers[i];
        if (!m) continue;
        if (m.isOrangeDot) {
          if (m.visible) {
            var a = 0.6 + Math.sin(phase) * 0.35;
            try { m.alpha = Math.max(0.25, Math.min(a, 1.0)); m.scaleX = 1 + Math.sin(phase * 1.2) * 0.06; m.scaleY = m.scaleX; } catch (e) {}
          } else {
            try { m.alpha = 0; m.scaleX = 1; m.scaleY = 1; } catch (e) {}
          }
        }
      }
    }, 16);
    _intervals.push(_markerPulseInterval);
  }

  function startLogoLoop() {
    var phase = 0;
    if (_logoAnimInterval) try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}
    _logoAnimInterval = jsmaf.setInterval(function () {
      phase += 0.02;
      var baseY = 0;
      try {
        logo = findChildByName('payload_logo') || logo;
        if (logo) { logo.y = baseY + Math.sin(phase) * 6; logo.scaleX = 0.99 + Math.sin(phase * 0.9) * 0.01; logo.scaleY = logo.scaleX; }
        background = findChildByName('payload_bg') || background;
        if (background) { background.x = background._baseX + Math.sin(phase * 0.4) * 6; }
      } catch (e) {}
    }, 16);
    _intervals.push(_logoAnimInterval);
  }

  // NEW: button idle subtle movement (matches previous script behavior)
  function startButtonIdleLoop() {
    try {
      if (typeof _buttonIdleInterval !== 'undefined' && _buttonIdleInterval) try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {}
      var phase = 0;
      _buttonIdleInterval = jsmaf.setInterval(function () {
        phase += 0.03;
        for (var i = 0; i < buttons.length; i++) {
          try {
            var b = buttons[i];
            var t = buttonTexts[i];
            if (!b) continue;
            var base = buttonOrigPos[i] || { x: b.x, y: b.y };
            var offset = (i % 7) * 0.9;
            var p = phase + offset;
            var isSelected = (i === currentButton);
            var ampX = isSelected ? 6 : 3;
            var ampY = isSelected ? 4 : 2;
            var breath = isSelected ? 0.015 : 0.008;
            var speed = isSelected ? 1.1 : 1.0;
            try {
              b.x = base.x + Math.sin(p * 0.9 * speed) * ampX;
              b.y = base.y + Math.sin(p * 0.6 * speed) * ampY;
              var sx = 1 + Math.sin(p * 1.1 * speed) * breath;
              var sy = 1 - Math.sin(p * 1.1 * speed) * breath * 0.5;
              b.scaleX = sx; b.scaleY = sy;
              if (t) {
                // Respect whether the text is centered (Back button) or left-aligned
                if (t._centered) {
                  t.x = Math.round(b.x + buttonWidth / 2 - 20);
                } else {
                  t.x = Math.round(b.x + 20);
                }
                t.y = Math.round(b.y + (buttonHeight / 2 - 12));
              }
            } catch (e) {}
          } catch (e) {}
        }
      }, 16);
      _intervals.push(_buttonIdleInterval);
    } catch (e) { log('startButtonIdleLoop error: ' + (e.message || e)); }
  }

  // --- entrance (background, logo, then buttons) ---
  function entrance() {
    try {
      background = createBackground();
      logo = createLogo();
      if (background) animate(background, { alpha: 0 }, { alpha: 1 }, 500);
      if (logo) animate(logo, { alpha: 0, scaleX: 0.95, scaleY: 0.95 }, { alpha: 1, scaleX: 1.0, scaleY: 1.0 }, 520);
      if (typeof titleImg !== 'undefined' && titleImg) animate(titleImg, { alpha: 0 }, { alpha: 1 }, 540);
      if (typeof titleText !== 'undefined' && titleText) animate(titleText, { alpha: 0 }, { alpha: 1 }, 540);
    } catch (e) {}
    // --- Do NOT play bgm here, since we want to keep main menu song playing ---
    // start looping animations
    try { startOrangeDotLoop(); } catch (e) {}
    try { startLogoLoop(); } catch (e) {}
    try { startButtonIdleLoop(); } catch (e) {}
  }

  // --- hover/selection animations ---
  var prevButton = -1;

  function animateSelectionIn(b, txt, origX, origY) {
    animate(b, { scaleX: b.scaleX || 1 }, { scaleX: 1.08, scaleY: 1.08, x: origX - (buttonWidth * (1.08 - 1)) / 2, y: origY - (buttonHeight * (1.08 - 1)) / 2 }, 160);
    animate(txt, { scaleX: txt.scaleX || 1, alpha: txt.alpha || 1 }, { scaleX: 1.06, scaleY: 1.06, alpha: 1 }, 160);
  }
  function animateSelectionOut(b, txt, origX, origY) {
    animate(b, { scaleX: b.scaleX || 1 }, { scaleX: 1.0, scaleY: 1.0, x: origX, y: origY }, 160);
    animate(txt, { scaleX: txt.scaleX || 1, alpha: txt.alpha || 1 }, { scaleX: 1.0, scaleY: 1.0, alpha: 1 }, 160);
  }

  function updateHighlight() {
    try {
      if (currentButton < 0) currentButton = 0;
      if (currentButton >= buttons.length) currentButton = buttons.length - 1;

      for (var i = 0; i < buttonMarkers.length; i++) { try { buttonMarkers[i].visible = false; buttonMarkers[i].alpha = 0; } catch (e) {} }

      if (prevButton >= 0 && prevButton !== currentButton) {
        var prev = buttons[prevButton]; var prevTxt = buttonTexts[prevButton];
        if (prev) { prev.url = 'file:///../download0/img/button_over_9.png'; prev.alpha = 0.7; prev.borderColor = 'transparent'; prev.borderWidth = 0; animateSelectionOut(prev, prevTxt, buttonOrigPos[prevButton].x, buttonOrigPos[prevButton].y); }
      }

      for (var j = 0; j < buttons.length; j++) {
        var b = buttons[j]; var t = buttonTexts[j]; var m = buttonMarkers[j];
        if (!b || !t) continue;
        if (j === currentButton) {
          b.url = 'file:///../download0/img/button_over_9.png';
          b.alpha = 1.0;
          b.borderColor = 'rgb(235, 147, 32)';
          b.borderWidth = 3;
          if (m) { m.visible = true; try { animate(m, { alpha: m.alpha || 0 }, { alpha: 1 }, 200); } catch (e) {} }
          animateSelectionIn(b, t, buttonOrigPos[j].x, buttonOrigPos[j].y);
        } else {
          if (j !== prevButton) {
            b.url = 'file:///../download0/img/button_over_9.png';
            b.alpha = 0.7;
            b.borderColor = 'transparent';
            b.borderWidth = 0;
            animateSelectionOut(b, t, buttonOrigPos[j].x, buttonOrigPos[j].y);
            if (m) { m.visible = false; m.alpha = 0; }
          }
        }
        try { if (t && t.constructor && t.constructor.name === 'Text') t.style = 'white'; } catch (e) {}
      }
      prevButton = currentButton;
    } catch (e) { log('updateHighlight error: ' + (e.message || e)); }
  }

  // --- robust overlay suppression helpers ---
  function _isLikelyFullscreenOverlay(child) {
    try {
      if (!child) return false;
      var w = child.width || 0;
      var h = child.height || 0;
      var x = child.x || 0;
      var y = child.y || 0;
      if (w >= 1400 && h >= 700) return true;
      if (Math.abs((x + w/2) - 960) < 220 && Math.abs((y + h/2) - 540) < 170 && w >= 300 && h >= 160) {
        if (typeof child.alpha === 'number' && child.alpha >= 0.7) return true;
        if (child.url && child.url.toLowerCase().indexOf('black') !== -1) return true;
        if (child.fillColor && typeof child.fillColor === 'string' && child.fillColor.toLowerCase().indexOf('000') !== -1) return true;
      }
    } catch (e) {}
    return false;
  }

  function hideExistingOverlays() {
    try {
      for (var c = 0; c < jsmaf.root.children.length; c++) {
        var ch = jsmaf.root.children[c];
        if (!ch) continue;
        if (ch._ourName && ch._ourName.indexOf('payload_') === 0) continue; // don't hide our own
        if (_isLikelyFullscreenOverlay(ch)) {
          try { ch.visible = false; ch._overlaySuppressed = true; log('Hidden overlay child at index ' + c); } catch (e) {}
        }
      }
    } catch (e) {}
  }

  function suppressTemporaryFullscreenOverlays(durationMs) {
    var stopAt = Date.now() + (durationMs || 900);
    var baseline = jsmaf.root.children.length;
    var interval = jsmaf.setInterval(function () {
      try {
        var start = Math.max(0, baseline - 3);
        for (var c = start; c < jsmaf.root.children.length; c++) {
          var ch = jsmaf.root.children[c];
          if (!ch || ch._overlaySuppressed) continue;
          if (ch._ourName && ch._ourName.indexOf('payload_') === 0) continue;
          if (_isLikelyFullscreenOverlay(ch)) {
            try { ch.visible = false; ch._overlaySuppressed = true; log('Suppressed overlay element at index ' + c); } catch (e) {}
          }
        }
        if (Date.now() % 3 === 0) hideExistingOverlays();
      } catch (e) {}
      if (Date.now() >= stopAt) {
        try { jsmaf.clearInterval(interval); } catch (e) {}
      }
    }, 60);
    _intervals.push(interval);
  }

  // --- stop/resume audio + loops (kept for lifecycle but not used during click) ---
  function _safeStopAudio(a) {
    try {
      if (!a) return;
      if (typeof a.stop === 'function') { a.stop(); }
      else if (typeof a.pause === 'function') { a.pause(); try { if (typeof a.currentTime !== 'undefined') a.currentTime = 0; } catch (e) {} }
      try { a.onended = null; } catch (e) {}
    } catch (e) {}
  }

  function stopAudioAndLoops() {
    try { _safeStopAudio(bgm); } catch (e) {}
    try { if (_bgmFadeInterval) jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}
    try { if (_markerPulseInterval) jsmaf.clearInterval(_markerPulseInterval); } catch (e) {}
    try { if (_logoAnimInterval) jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}
    try { if (gpPollInterval) jsmaf.clearInterval(gpPollInterval); } catch (e) {}
    _clearAllIntervals();
    try { if (cursor) cursor.visible = false; } catch (e) {}
    try { if (bgm && typeof bgm.close === 'function') { bgm.close(); } } catch (e) {}
    bgm = null;
    log('Audio and loops stopped/cleared.');
  }

  function resumeAudioAndLoops() {
    // Do NOT resume bgm here automatically
    try {
      var elapsed = 0; var dur = 900; var step = 50;
      if (_bgmFadeInterval) try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}
      _bgmFadeInterval = jsmaf.setInterval(function () {
        elapsed += step; var t = Math.min(elapsed / dur, 1);
        try { if (bgm) bgm.volume = 0.45 * t; } catch (e) {}
        if (t >= 1) { try { jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {} _bgmFadeInterval = null; }
      }, step);
    } catch (e) {}
    try { startOrangeDotLoop(); } catch (e) {}
    try { startLogoLoop(); } catch (e) {}
    try { startGamepadMouse(); } catch (e) {}
    try { createCursor(); if (cursor) cursor.visible = true; } catch (e) {}
    log('Audio and loops resumed.');
  }

  function enforceTextWhite() {
    for (var i = 0; i < buttonTexts.length; i++) {
      try {
        var t = buttonTexts[i];
        if (t && typeof t === 'object' && t.constructor && t.constructor.name === 'Text') {
          t.style = 'white';
        }
      } catch (e) {}
    }
    try { if (typeof titleText !== 'undefined' && titleText && titleText.constructor && titleText.constructor.name === 'Text') titleText.style = 'title'; } catch (e) {}
  }

  // --- button action (load payload / back)
  // NOTE: clicking a button no longer stops animation loops. Click is cosmetic only.
  function handleButtonPress() {
    var idx = currentButton;
    var exitIndex = buttons.length - 1;
    try { if (clickSfx && typeof clickSfx.play === 'function') clickSfx.play(); } catch (e) {}
    var btn = buttons[idx];
    if (!btn) return;

    // Play click animation, but DO NOT clear intervals or stop loops.
    animate(btn, { scaleX: btn.scaleX || 1, scaleY: btn.scaleY || 1 }, { scaleX: 0.92, scaleY: 0.92 }, 80, null, function () {
      animate(btn, { scaleX: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140, null, function () {
        animate(btn, { scaleX: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120);
        // After cosmetic animation completes, proceed to action. Animations continue throughout.

        if (idx === exitIndex) {
          log('Going back to main menu...');
          try {
            jsmaf.setTimeout(function () {
              try { include('main-menu.js'); } catch (e) { log('ERROR loading main-menu.js: ' + (e.message || e)); }
            }, 60);
          } catch (e) { log('ERROR switching to main-menu: ' + (e.message || e)); }
          return;
        }

        if (idx < 0 || idx >= buttonIndexToFileListIndex.length) { log('No file selected!'); return; }
        var fileListIndex = buttonIndexToFileListIndex[idx];
        if (fileListIndex === undefined || !fileList[fileListIndex]) { log('No file selected!'); return; }

        var entry = fileList[fileListIndex];
        var filePath = entry.path;
        var fileName = entry.name;
        log('Selected: ' + fileName + ' from ' + filePath);

        // Keep animations running. We'll still hide overlays so payload UI isn't blocked.
        hideExistingOverlays();
        suppressTemporaryFullscreenOverlays(1200);

        try {
          if (fileName.toLowerCase().endsWith('.js')) {
            if (filePath.startsWith('/download0/')) {
              log('Including JS payload: ' + fileName);
              try {
                include('payloads/' + fileName);
              } catch (e) {
                log('ERROR including internal JS payload: ' + (e.message || e));
              }
            } else {
              log('Reading external JS payload: ' + filePath);
              try {
                var p_addr = mem.malloc(256);
                for (var z = 0; z < filePath.length; z++) mem.view(p_addr).setUint8(z, filePath.charCodeAt(z));
                mem.view(p_addr).setUint8(filePath.length, 0);
                var _fd = fn.open_sys(p_addr, new BigInt(0, 0), new BigInt(0, 0));
                if (!_fd.eq(new BigInt(0xffffffff, 0xffffffff))) {
                  var buf_size = 1024 * 1024 * 1;
                  var _buf = mem.malloc(buf_size);
                  var read_len = fn.read_sys(_fd, _buf, new BigInt(0, buf_size));
                  try { fn.close_sys(_fd); } catch (e) {}
                  var scriptContent = '';
                  var len = read_len instanceof BigInt ? read_len.lo : read_len;
                  for (var b = 0; b < len; b++) scriptContent += String.fromCharCode(mem.view(_buf).getUint8(b));
                  log('Executing external JS via eval()...');
                  try { eval(scriptContent); } catch (e) { log('ERROR executing external JS: ' + (e.message || e)); }
                } else { log('ERROR: Could not open external file for reading!'); }
              } catch (e) {
                log('external js read error: ' + (e.message || e));
              }
            }
          } else {
            log('Loading binloader.js and running payload: ' + filePath);
            try {
              include('binloader.js');
              var loader = null;
              try { loader = binloader_init(); } catch (e) {}
              if (loader && typeof loader.bl_load_from_file === 'function') {
                try { loader.bl_load_from_file(filePath); } catch (e) { log('ERROR running bin payload: ' + (e.message || e)); }
              } else {
                log('binloader not available or invalid.');
              }
            } catch (e) {
              log('ERROR running bin payload: ' + (e.message || e));
            }
          }
        } catch (e) {
          log('ERROR running payload: ' + (e.message || e));
          if (e.stack) log(e.stack);
        }
      });
    });
  }

  // --- input handlers (mouse + keyboard) ---
  jsmaf.onMouseMove = function (mx, my) {
    try {
      updateCursorPosition(mx, my);
      showCursor();
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i]; if (!b) continue;
        if (mx >= b.x && my >= b.y && mx <= b.x + b.width && my <= b.y + b.height) {
          if (currentButton !== i) { prevButton = currentButton; currentButton = i; updateHighlight(); }
          return;
        }
      }
    } catch (e) {}
  };

  jsmaf.onMouseDown = function (mx, my, btn) {
    try {
      updateCursorPosition(mx, my);
      showCursor();
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i]; if (!b) continue;
        if (mx >= b.x && my >= b.y && mx <= b.x + b.width && my <= b.y + b.height) {
          currentButton = i; updateHighlight(); handleButtonPress(); return;
        }
      }
    } catch (e) {}
  };

  jsmaf.onKeyDown = function (k) {
    try {
      var exitIndex = buttons.length - 1;
      var maxIndex = Math.max(0, buttons.length - 2);
      if (k === 6) {
        if (currentButton + buttonsPerRow <= maxIndex) currentButton += buttonsPerRow; else currentButton = exitIndex;
      } else if (k === 4) {
        if (currentButton - buttonsPerRow >= 0) currentButton -= buttonsPerRow; else currentButton = 0;
      } else if (k === 5) {
        if (currentButton < maxIndex && (currentButton % buttonsPerRow) < (buttonsPerRow - 1)) currentButton++;
      } else if (k === 7) {
        if (currentButton > 0) currentButton--;
      } else if (k === 14) { handleButtonPress(); }
      else if (k === 13) {
        try {
          _safeStopAudio(bgm);
        } catch (e) {}
        _clearAllIntervals();
        try { include('main-menu.js'); } catch (e) { log('ERR include main-menu: ' + (e.message || e)); }
      }
      updateHighlight();
    } catch (e) {}
  };

  // --- PS4 controller -> mouse emulation with R3 toggle ---
  var gpSensitivity = 12.0;
  var gpDeadzone = 0.15;
  var lastGpButtons = [];
  var gpPollStepMs = 16;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function startGamepadMouse() {
    try {
      if (gpPollInterval) try { jsmaf.clearInterval(gpPollInterval); } catch (e) {}
      gpPollInterval = jsmaf.setInterval(function () {
        try {
          if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
          var gps = navigator.getGamepads();
          if (!gps) return;
          var gp = gps[0];
          if (!gp) return;

          // detect R3 press to toggle mouseModeEnabled
          var r3Pressed = false;
          if (gp.buttons && gp.buttons.length > R3_BUTTON_INDEX) {
            var r3b = gp.buttons[R3_BUTTON_INDEX];
            r3Pressed = !!(r3b && (r3b.pressed || r3b.value > 0.5));
          }
          if (r3Pressed && !lastR3State) {
            mouseModeEnabled = !mouseModeEnabled;
            log('Mouse mode ' + (mouseModeEnabled ? 'ENABLED' : 'DISABLED') + ' via R3');
            if (!mouseModeEnabled) { try { cursor.visible = false; } catch (e) {} } else { showCursor(); }
          }
          lastR3State = r3Pressed;

          var ax = (gp.axes && gp.axes.length > 2) ? gp.axes[2] : 0;
          var ay = (gp.axes && gp.axes.length > 3) ? gp.axes[3] : 0;
          ax = Math.abs(ax) < gpDeadzone ? 0 : ax;
          ay = Math.abs(ay) < gpDeadzone ? 0 : ay;

          if (mouseModeEnabled) {
            var dt = gpPollStepMs / 1000.0;
            var dx = ax * gpSensitivity * dt * 60;
            var dy = ay * gpSensitivity * dt * 60;
            virtualMouse.x += dx; virtualMouse.y += dy;
            virtualMouse.x = clamp(virtualMouse.x, 0, 1920); virtualMouse.y = clamp(virtualMouse.y, 0, 1080);
            updateCursorPosition(Math.round(virtualMouse.x), Math.round(virtualMouse.y));
            try { jsmaf.onMouseMove(Math.round(virtualMouse.x), Math.round(virtualMouse.y)); } catch (e) {}
          } else {
            if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) showCursor();
          }

          // Map primary face button (Cross / X -> index 0) to click when in mouseModeEnabled
          var btnIndex = 0;
          var pressed = false;
          if (gp.buttons && gp.buttons.length > btnIndex) {
            var b = gp.buttons[btnIndex];
            pressed = !!(b && (b.pressed || b.value > 0.5));
          }
          if (lastGpButtons[btnIndex] === undefined) lastGpButtons[btnIndex] = false;

          if (pressed && !lastGpButtons[btnIndex]) {
            if (mouseModeEnabled) {
              try { jsmaf.onMouseDown(Math.round(virtualMouse.x), Math.round(virtualMouse.y), 0); } catch (e) {}
            } else {
              try {
                var mx = Math.round(virtualMouse.x), my = Math.round(virtualMouse.y);
                var clicked = false;
                for (var i = 0; i < buttons.length; i++) {
                  var bb = buttons[i];
                  if (!bb) continue;
                  if (mx >= bb.x && my >= bb.y && mx <= bb.x + bb.width && my <= bb.y + bb.height) {
                    currentButton = i; updateHighlight(); handleButtonPress(); clicked = true; break;
                  }
                }
                if (!clicked) { handleButtonPress(); }
              } catch (e) { try { handleButtonPress(); } catch (ex) {} }
            }
          }
          lastGpButtons[btnIndex] = pressed;

          // D-pad/left stick navigation (non-mouse mode)
          var lax = (gp.axes && gp.axes.length > 0) ? gp.axes[0] : 0;
          var lay = (gp.axes && gp.axes.length > 1) ? gp.axes[1] : 0;
          var navThreshold = 0.75;
          if (!mouseModeEnabled) {
            if (lax > navThreshold) {
              var maxIndex = Math.max(0, buttons.length - 2);
              if (currentButton < maxIndex && (currentButton % buttonsPerRow) < (buttonsPerRow - 1)) currentButton++;
              updateHighlight();
            } else if (lax < -navThreshold) {
              if (currentButton > 0) currentButton--;
              updateHighlight();
            } else if (lay > navThreshold) {
              var maxIndex2 = Math.max(0, buttons.length - 2);
              if (currentButton + buttonsPerRow <= maxIndex2) currentButton += buttonsPerRow; else currentButton = buttons.length - 1;
              updateHighlight();
            } else if (lay < -navThreshold) {
              if (currentButton - buttonsPerRow >= 0) currentButton -= buttonsPerRow; else currentButton = 0;
              updateHighlight();
            }
          }
        } catch (e) {
          // tolerate polling errors silently
        }
      }, gpPollStepMs);
      _intervals.push(gpPollInterval);
    } catch (e) {
      log('startGamepadMouse error: ' + (e.message || e));
    }
  }

  startGamepadMouse();

  // --- start entrance + loops ---
  entrance();
  jsmaf.setTimeout(function () { enforceTextWhite(); updateHighlight(); }, 700);

  // --- lifecycle hooks ---
  try { jsmaf.onHide = function () { stopAudioAndLoops(); }; } catch (e) {}
  try { jsmaf.onShow = function () { resumeAudioAndLoops(); enforceTextWhite(); updateHighlight(); }; } catch (e) {}

  // --- cleanup on exit ---
  jsmaf.onExit = function () {
    try { _safeStopAudio(bgm); } catch (e) {}
    _clearAllIntervals();
    try { if (_markerPulseInterval) jsmaf.clearInterval(_markerPulseInterval); } catch (e) {}
    try { if (_logoAnimInterval) jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}
    try { if (_bgmFadeInterval) jsmaf.clearInterval(_bgmFadeInterval); } catch (e) {}
    try { if (gpPollInterval) jsmaf.clearInterval(gpPollInterval); } catch (e) {}
    try { if (mouseHideTimeout) jsmaf.clearTimeout(mouseHideTimeout); } catch (e) {}
  };

  log('Animated Payload Menu loaded. Payload buttons: ' + buttonIndexToFileListIndex.length + ', Total buttons (including Back): ' + buttons.length + ', Elements: ' + jsmaf.root.children.length);

})();
