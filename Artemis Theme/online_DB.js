(function () {
  // ---------- Configuration ----------
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var CENTER_X = SCREEN_W / 2;
  var ASSET_PATH = 'file:///../download0/themes/Artemis/data/';

  // JSON list URL
  var PAYLOAD_LIST_URL = 'https://mexrldev.github.io/Webkit/Artemis-Theme/payload-list.json';
  var DB_BASE_URL = null;
  if (!DB_BASE_URL) {
    var idxSlash = PAYLOAD_LIST_URL.lastIndexOf('/');
    DB_BASE_URL = idxSlash >= 0 ? PAYLOAD_LIST_URL.substr(0, idxSlash + 1) : (PAYLOAD_LIST_URL + '/');
  }

  // Loading images
  var LOADING_BG = ASSET_PATH + 'circle_loading_bg.png';
  var LOADING_SEEK = ASSET_PATH + 'circle_loading_seek.png';
  var LOADING_ERROR = ASSET_PATH + 'circle_error_light.png';
  var LOADING_SIZE = 178;

  // UI dimensions
  var ICON_X = 50, ICON_Y = 50, ICON_W = 130, ICON_H = 138;
  var LINE_X = ICON_X + ICON_W + 20;
  var LINE_Y = 100;
  var LINE_TARGET_W = 1600;
  var LINE_H = 4;

  var TITLE_LEFT_X = LINE_X + 20;
  var TITLE_Y = LINE_Y - 40;
  var TITLE_RIGHT_X_INSIDE_LINE = LINE_X + LINE_TARGET_W - 320;
  var TITLE_RIGHT_EXTRA_DELAY_MS = 2000;

  var LIST_HORIZONTAL_OFFSET = -150;
  var LIST_CENTER_X = CENTER_X + LIST_HORIZONTAL_OFFSET;

  var ARROW_W = 52, ARROW_H = 42;
  var GAP_BETWEEN_ARROW_AND_TEXT = 300;
  var TEXT_WIDTH = 600;
  var ARROW_X_BASE = LIST_CENTER_X - TEXT_WIDTH / 2 - ARROW_W - GAP_BETWEEN_ARROW_AND_TEXT;
  var ARROW_X_OFFSET = -20;
  var ARROW_X = ARROW_X_BASE + ARROW_X_OFFSET;
  var ARROW_Y_OFFSET = 4; // vertical nudge
  var SMALL_TEXT_GAP = 12;
  var TEXT_X = ARROW_X + ARROW_W + SMALL_TEXT_GAP;

  var LIST_START_Y = 550;
  var ITEM_HEIGHT = 55;
  var VISIBLE_TOP = 200;
  var VISIBLE_BOTTOM = 900;

  var SEL_BAR_HEIGHT = 50, SEL_BAR_X = 0, SEL_BAR_WIDTH = SCREEN_W;

  var FOOTER_Y = SCREEN_H - 100;
  var FOOTER_ICON_SIZE = 32;
  var FOOTER_GAP_ICON_TEXT = 10;
  var FOOTER_GAP_SELECT_BACK = 200;

  var SCROLLBAR_GAP = 30;
  var SCROLLBAR_X = SCREEN_W - SCROLLBAR_GAP - 10;
  var SCROLLBAR_Y = VISIBLE_TOP;
  var SCROLLBAR_HEIGHT = VISIBLE_BOTTOM - VISIBLE_TOP;

  var TEXT_OFFSET = (ITEM_HEIGHT - 38) / 2;
  var FIXED_SELECTION_Y = LIST_START_Y + TEXT_OFFSET;

  // metadata layout defaults
  var META_GAP = 18;
  var META_SHIFT_X = 450;
  var CODE_EST_WIDTH = 200;
  var META_CODE_VER_GAP = 20;
  var META_VER_SHIFT = 80;

  // Line expanding time
  var lineExpandDelaySec = 0.5;
  var lineExpandDurationSec = 1.5;
  var lineExpandDelayMs = Math.round(lineExpandDelaySec * 1000);
  var lineExpandDurationMs = Math.round(lineExpandDurationSec * 1000);

  // Loading spinner rotation speed (didnt work)
  var SPIN_SPEED_DEG_PER_SEC = 360 * 1.2; // 1.2 rps

  // Idle fade-in after fetching
  var ALLOW_INPUT_AFTER_MS = 2000;

  // Allowed payload extensions
  var ALLOWED_EXT = ['.js', '.elf', '.bin'];

  // Explicit font sizes... didnt work... but kept
  var FONT_TITLE = 'bold 42px "Roboto", Arial, sans-serif';
  var FONT_LIST = '28px "Roboto", Arial, sans-serif';
  var FONT_META_CODE = '24px "Roboto Mono", monospace';
  var FONT_META_VER = '24px "Roboto Mono", monospace';
  var FONT_FOOTER = '26px "Roboto", Arial, sans-serif';

  // ---------- State ----------
  var fileList = []; // array of { name, url, code, version }
  var payloadTexts = [], codeTexts = [], verTexts = [];
  var currentIndex = 0, scrollOffset = 0;
  var arrowImg = null, lineImg = null, iconImg = null, titleRight = null, titleLeft = null;
  var selBarImg = null, footerSelectIcon = null, footerSelectText = null, footerBackIcon = null, footerBackText = null;
  var scrollBg = null, scrollLock = null;
  var fadeElements = [], fadeInterval = null;
  var fadingIn = true;
  var pressedKeys = {};
  var loadingBgImg = null, loadingSeekImg = null;
  var loadingSpinInterval = null;
  var loadingFailed = false;

  var TEXT_HEIGHT = 38;

  // ---------- Utilities ----------
  function endsWithAny(s, arr) {
    if (!s) return false;
    var lower = s.toLowerCase();
    for (var i = 0; i < arr.length; i++) {
      if (lower.indexOf(arr[i], lower.length - arr[i].length) !== -1) return true;
    }
    return false;
  }

  function safeLog() { try { log.apply(null, arguments); } catch (e) {} }

  function writeFileLocal(filepath, content, cb) {
    try {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (cb) cb(xhr.status === 0 || xhr.status === 200 ? null : new Error('write failed'));
        }
      };
      xhr.open('POST', 'file://../download0/' + filepath, true);
      try { xhr.send(content); } catch (e) { if (cb) cb(e); }
    } catch (e) {
      if (cb) cb(e);
    }
  }

  // ---------- Loading UI ----------
  function showLoadingScreen() {
    try { jsmaf.root.children.length = 0; } catch (e) {}
    // Background
    var bg = new Image({ url: ASSET_PATH + 'bgimg.png', x: 0, y: 0, width: SCREEN_W, height: SCREEN_H });
    jsmaf.root.children.push(bg);

    // Loading background image
    loadingBgImg = new Image({
      url: LOADING_BG,
      x: Math.round(CENTER_X - LOADING_SIZE / 2),
      y: Math.round(SCREEN_H / 2 - LOADING_SIZE / 2),
      width: LOADING_SIZE, height: LOADING_SIZE,
      alpha: 1.0
    });
    jsmaf.root.children.push(loadingBgImg);

    // Spinner on top – set origin to centre
    loadingSeekImg = new Image({
      url: LOADING_SEEK,
      x: Math.round(CENTER_X - LOADING_SIZE / 2),
      y: Math.round(SCREEN_H / 2 - LOADING_SIZE / 2),
      width: LOADING_SIZE, height: LOADING_SIZE,
      alpha: 1.0
    });
    // Set rotation origin to centre of the image
    try { loadingSeekImg.originX = LOADING_SIZE / 2; loadingSeekImg.originY = LOADING_SIZE / 2; } catch (e) {}
    try { loadingSeekImg.setOrigin && loadingSeekImg.setOrigin(LOADING_SIZE / 2, LOADING_SIZE / 2); } catch (e) {}
    jsmaf.root.children.push(loadingSeekImg);
  }

  function startSpinner() {
    var angle = 0;
    var last = Date.now();
    if (loadingSpinInterval) jsmaf.clearInterval(loadingSpinInterval);
    loadingSpinInterval = jsmaf.setInterval(function () {
      var now = Date.now();
      var dt = (now - last) / 1000;
      last = now;
      angle += SPIN_SPEED_DEG_PER_SEC * dt;
      angle = angle % 360;

      try { loadingSeekImg.rotation = angle; } catch (e) {}
      try { loadingSeekImg.angle = angle; } catch (e) {}
      try { loadingSeekImg.transform = 'rotate(' + angle + 'deg)'; } catch (e) {}
      try {
        if (loadingSeekImg.style) {
          loadingSeekImg.style.transform = 'rotate(' + angle + 'deg)';
          loadingSeekImg.style.transformOrigin = '50% 50%';
        }
      } catch (e) {}
    }, 16);
  }

  function stopSpinner() {
    try { if (loadingSpinInterval) jsmaf.clearInterval(loadingSpinInterval); } catch (e) {}
    loadingSpinInterval = null;
  }

  function showLoadingErrorAndQuit() {
    loadingFailed = true;
    try { if (loadingSeekImg) loadingSeekImg.url = LOADING_ERROR; } catch (e) {}
    stopSpinner();
    jsmaf.setTimeout(function () {
      try { include('../download0/themes/Artemis/main.js'); } catch (e) { safeLog('error returning to main:', e && e.message); }
    }, 3000);
  }

  // ---------- Parse plain text format ----------
  function parsePayloadListText(txt) {
    var blocks = txt.split(/\r?\n\r?\n/);
    var out = [];
    for (var b = 0; b < blocks.length; b++) {
      var lines = blocks[b].split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      if (lines.length === 0) continue;
      var code = null, version = null, name = null;
      for (var i = 0; i < lines.length; i++) {
        if (endsWithAny(lines[i], ALLOWED_EXT)) {
          name = lines[i];
          if (i >= 1) code = lines[0];
          if (i >= 2) version = lines[1];
          break;
        }
      }
      if (!name && lines.length > 0) {
        var last = lines[lines.length - 1];
        if (endsWithAny(last, ALLOWED_EXT)) {
          name = last;
          if (lines.length >= 2) code = lines[0];
          if (lines.length >= 3) version = lines[1];
        }
      }
      if (!name) continue;
      var payloadUrl = DB_BASE_URL + encodeURIComponent(name);
      out.push({ name: name, url: payloadUrl, code: code || '', version: version || '' });
    }
    return out;
  }

  // ---------- Fetch JSON list ----------
  function fetchPayloadListFlexible(onDone) {
    try {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200 || xhr.status === 0) {
          var raw = xhr.responseText || '';
          // check JSON first
          try {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              onDone && onDone(null, parsed);
              return;
            } else {
              var out = parsePayloadListText(raw);
              onDone && onDone(null, out);
              return;
            }
          } catch (je) {
            try {
              var out2 = parsePayloadListText(raw);
              onDone && onDone(null, out2);
              return;
            } catch (pe) {
              onDone && onDone(pe);
              return;
            }
          }
        } else {
          onDone && onDone(new Error('HTTP ' + xhr.status));
        }
      };
      xhr.open('GET', PAYLOAD_LIST_URL, true);
      xhr.send();
    } catch (e) {
      onDone && onDone(e);
    }
  }

  // ---------- Process array entries sequentially ----------
  function processListSequentially(arr, onDone) {
    fileList = [];
    var i = 0;
    function next() {
      if (i >= arr.length) {
        onDone && onDone(null, fileList);
        return;
      }
      var it = arr[i++] || {};
      if (typeof it === 'string') {
        var s = it.trim();
        if (!s) { jsmaf.setTimeout(next, 0); return; }
        if (endsWithAny(s, ALLOWED_EXT)) {
          fileList.push({ name: s, url: DB_BASE_URL + encodeURIComponent(s), code: '', version: '' });
        }
        jsmaf.setTimeout(next, 0);
        return;
      }
      if (typeof it === 'object' && it !== null) {
        var name = (it.name || '').toString().trim();
        var code = (it.code || '').toString();
        var version = (it.version || '').toString();
        if (!name) { jsmaf.setTimeout(next, 0); return; }
        var ok = false;
        var lower = name.toLowerCase();
        for (var e = 0; e < ALLOWED_EXT.length; e++) {
          if (lower.indexOf(ALLOWED_EXT[e], lower.length - ALLOWED_EXT[e].length) !== -1) { ok = true; break; }
        }
        if (!ok) { jsmaf.setTimeout(next, 0); return; }
        var url = DB_BASE_URL + encodeURIComponent(name);
        fileList.push({ name: name, url: url, code: code, version: version });
        jsmaf.setTimeout(next, 0);
        return;
      }
      jsmaf.setTimeout(next, 0);
    }
    next();
  }

  // ---------- Robust setTextFont ----------
  function setTextFont(txt, fontString) {
    if (!txt) return;
    try { txt.font = fontString; } catch (e) {}
    // Attempt to set family safely
    try { txt.fontFamily = 'Roboto, Arial, sans-serif'; } catch (e) {}
    // Extract "<number>px" if present and only then set numeric fontSize
    try {
      if (fontString && typeof fontString === 'string') {
        var m = fontString.match(/(\d+(?:\.\d+)?)px/i);
        if (m && m[1]) {
          var sz = Number(m[1]);
          if (!Number.isNaN(sz) && isFinite(sz)) {
            try { txt.fontSize = sz; } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }

  // ---------- Build UI (after list loaded ofc) ----------
  function buildUIFromList() {
    try { jsmaf.root.children.length = 0; } catch (e) {}

    // Re-declare styles used by this menu to ensure sane sizes (defensive).
    try {
      new Style({ name: 'title', color: 'black', size: 32, bold: true });
      new Style({ name: 'listText', color: 'black', size: 36, bold: true });
      new Style({ name: 'metaCode', color: 'black', size: 34 });
      new Style({ name: 'metaVer', color: 'black', size: 34 });
      new Style({ name: 'footerText', color: 'black', size: 36, bold: true });
    } catch (e) {}

    var bg = new Image({ url: ASSET_PATH + 'bgimg.png', x: 0, y: 0, width: SCREEN_W, height: SCREEN_H });
    jsmaf.root.children.push(bg);

    // Icon (Online icon)
    iconImg = new Image({ url: ASSET_PATH + 'titlescr_ico_onl-ico.png', x: ICON_X, y: ICON_Y, width: ICON_W, height: ICON_H, alpha: 0.0 });
    jsmaf.root.children.push(iconImg);
    fadeElements = [];
    fadeElements.push(iconImg);

    // Line
    lineImg = new Image({ url: ASSET_PATH + 'black.png', x: LINE_X, y: LINE_Y, width: 0, height: LINE_H, alpha: 0.0 });
    jsmaf.root.children.push(lineImg);
    fadeElements.push(lineImg);

    // Titles
    titleLeft = new jsmaf.Text();
    titleLeft.text = 'Online DB';
    titleLeft.style = 'title';          // keep original style for compatibility
    setTextFont(titleLeft, FONT_TITLE);
    titleLeft.x = TITLE_LEFT_X;
    titleLeft.y = TITLE_Y;
    titleLeft.alpha = 0.0;
    jsmaf.root.children.push(titleLeft);
    fadeElements.push(titleLeft);

    titleRight = new jsmaf.Text();
    titleRight.text = 'Online Payload Menu';
    titleRight.style = 'title';
    setTextFont(titleRight, FONT_TITLE);
    titleRight.x = TITLE_RIGHT_X_INSIDE_LINE;
    titleRight.y = TITLE_Y;
    titleRight.alpha = 0.0;
    jsmaf.root.children.push(titleRight);
    fadeElements.push(titleRight);

    // Selection bar
    selBarImg = new Image({ url: ASSET_PATH + 'sel_bar1.png', x: SEL_BAR_X, y: LIST_START_Y, width: SEL_BAR_WIDTH, height: SEL_BAR_HEIGHT, alpha: 0.0 });
    jsmaf.root.children.push(selBarImg);
    fadeElements.push(selBarImg);

    // Arrow
    arrowImg = new Image({ url: ASSET_PATH + 'arrow.png', x: ARROW_X, y: LIST_START_Y + ARROW_Y_OFFSET, width: ARROW_W, height: ARROW_H, alpha: 0.0 });
    jsmaf.root.children.push(arrowImg);
    fadeElements.push(arrowImg);

    // Create rows
    payloadTexts = []; codeTexts = []; verTexts = [];
    if (fileList.length === 0) {
      var noPayloads = new jsmaf.Text();
      noPayloads.text = 'No payloads found';
      noPayloads.style = 'listText';
      setTextFont(noPayloads, FONT_LIST);
      noPayloads.x = TEXT_X;
      noPayloads.y = LIST_START_Y + TEXT_OFFSET;
      noPayloads.alpha = 0.0;
      payloadTexts.push(noPayloads);
      jsmaf.root.children.push(noPayloads);
      fadeElements.push(noPayloads);

      var codeP = new jsmaf.Text();
      codeP.text = '';
      codeP.style = 'metaCode';
      setTextFont(codeP, FONT_META_CODE);
      codeP.x = TEXT_X + TEXT_WIDTH + META_GAP + META_SHIFT_X;
      codeP.y = noPayloads.y;
      codeP.alpha = 0.0;
      codeTexts.push(codeP);
      jsmaf.root.children.push(codeP);
      fadeElements.push(codeP);

      var verP = new jsmaf.Text();
      verP.text = '';
      verP.style = 'metaVer';
      setTextFont(verP, FONT_META_VER);
      verP.x = codeP.x + CODE_EST_WIDTH + META_CODE_VER_GAP + META_VER_SHIFT;
      verP.y = noPayloads.y;
      verP.alpha = 0.0;
      verTexts.push(verP);
      jsmaf.root.children.push(verP);
      fadeElements.push(verP);
    } else {
      for (var i = 0; i < fileList.length; i++) {
        var p = fileList[i];

        var txt = new jsmaf.Text();
        txt.text = p.name;
        txt.style = 'listText';
        setTextFont(txt, FONT_LIST);
        txt.x = TEXT_X;
        txt.y = LIST_START_Y + i * ITEM_HEIGHT + TEXT_OFFSET;
        txt.alpha = 0.0;
        payloadTexts.push(txt);
        jsmaf.root.children.push(txt);
        fadeElements.push(txt);

        var codeTxt = new jsmaf.Text();
        codeTxt.text = p.code || '';
        codeTxt.style = 'metaCode';
        setTextFont(codeTxt, FONT_META_CODE);
        codeTxt.x = TEXT_X + TEXT_WIDTH + META_GAP + META_SHIFT_X;
        codeTxt.y = txt.y;
        codeTxt.alpha = 0.0;
        codeTexts.push(codeTxt);
        jsmaf.root.children.push(codeTxt);
        fadeElements.push(codeTxt);

        var verTxt = new jsmaf.Text();
        verTxt.text = p.version || '';
        verTxt.style = 'metaVer';
        setTextFont(verTxt, FONT_META_VER);
        verTxt.x = codeTxt.x + CODE_EST_WIDTH + META_CODE_VER_GAP + META_VER_SHIFT;
        verTxt.y = txt.y;
        verTxt.alpha = 0.0;
        verTexts.push(verTxt);
        jsmaf.root.children.push(verTxt);
        fadeElements.push(verTxt);
      }
    }

    // Scrollbar
    scrollBg = new Image({ url: ASSET_PATH + 'scroll_bg.png', x: SCROLLBAR_X, y: SCROLLBAR_Y, width: 10, height: SCROLLBAR_HEIGHT, alpha: 0.0 });
    jsmaf.root.children.push(scrollBg); fadeElements.push(scrollBg);
    scrollLock = new Image({ url: ASSET_PATH + 'scroll_lock.png', x: SCROLLBAR_X, y: SCROLLBAR_Y, width: 10, height: 74, alpha: 0.0 });
    jsmaf.root.children.push(scrollLock); fadeElements.push(scrollLock);

    // Footer
    var selectSectionWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 100;
    var backSectionWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 80;
    var totalWidth = selectSectionWidth + FOOTER_GAP_SELECT_BACK + backSectionWidth;
    var startX = (SCREEN_W - totalWidth) / 2;

    footerSelectIcon = new Image({ url: ASSET_PATH + 'footer_ico_cross.png', x: startX, y: FOOTER_Y - FOOTER_ICON_SIZE / 2, width: FOOTER_ICON_SIZE, height: FOOTER_ICON_SIZE, alpha: 0.0 });
    jsmaf.root.children.push(footerSelectIcon); fadeElements.push(footerSelectIcon);
    footerSelectText = new jsmaf.Text();
    footerSelectText.text = 'Select';
    footerSelectText.style = 'footerText';
    setTextFont(footerSelectText, FONT_FOOTER);
    footerSelectText.x = startX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerSelectText.y = FOOTER_Y - 18;
    footerSelectText.alpha = 0.0;
    jsmaf.root.children.push(footerSelectText);
    fadeElements.push(footerSelectText);

    var backStartX = startX + selectSectionWidth + FOOTER_GAP_SELECT_BACK;
    footerBackIcon = new Image({ url: ASSET_PATH + 'footer_ico_circle.png', x: backStartX, y: FOOTER_Y - FOOTER_ICON_SIZE / 2, width: FOOTER_ICON_SIZE, height: FOOTER_ICON_SIZE, alpha: 0.0 });
    jsmaf.root.children.push(footerBackIcon); fadeElements.push(footerBackIcon);
    footerBackText = new jsmaf.Text();
    footerBackText.text = 'Back';
    footerBackText.style = 'footerText';
    setTextFont(footerBackText, FONT_FOOTER);
    footerBackText.x = backStartX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerBackText.y = FOOTER_Y - 18;
    footerBackText.alpha = 0.0;
    jsmaf.root.children.push(footerBackText);
    fadeElements.push(footerBackText);

    updateListPositions();
    startFadeIn();
    jsmaf.setTimeout(function () { fadingIn = false; }, ALLOW_INPUT_AFTER_MS);
  }

  // ---------- Fade & line animation ----------
  function startFadeIn() {
    var startTime = Date.now();
    var fadeDuration = 5000;
    var lineExpandDelay = lineExpandDelayMs;
    var lineExpandDuration = lineExpandDurationMs;
    var extraTitleDelay = TITLE_RIGHT_EXTRA_DELAY_MS;

    if (fadeInterval) try { jsmaf.clearInterval(fadeInterval); } catch (e) {}
    fadeInterval = jsmaf.setInterval(function () {
      var elapsed = Date.now() - startTime;
      var t = Math.min(elapsed / fadeDuration, 1);

      // line progress with delay
      var lineElapsed = Math.max(0, elapsed - lineExpandDelay);
      var lineT = Math.min(lineElapsed / Math.max(1, lineExpandDuration), 1);
      
      var tTitleRight = Math.min(Math.max(0, (elapsed - extraTitleDelay) / fadeDuration), 1);

      for (var i = 0; i < fadeElements.length; i++) {
        try {
          var el = fadeElements[i];
          if (el === titleRight) {
            el.alpha = tTitleRight;
          } else {
            el.alpha = t;
          }
        } catch (e) {}
      }

      try { if (lineImg) lineImg.width = LINE_TARGET_W * lineT; } catch (e) {}

      if (t >= 1 && lineT >= 1 && tTitleRight >= 1) {
        try { jsmaf.clearInterval(fadeInterval); } catch (e) {}
        fadeInterval = null;
        for (var j = 0; j < fadeElements.length; j++) try { fadeElements[j].alpha = 1.0; } catch (ee) {}
        try { if (lineImg) lineImg.width = LINE_TARGET_W; } catch (e) {}

        // Re-declare styles again after animation finishes to make sure the global style table is sane.
        try {
          new Style({ name: 'title', color: 'black', size: 32, bold: true });
          new Style({ name: 'listText', color: 'black', size: 36, bold: true });
          new Style({ name: 'metaCode', color: 'black', size: 34 });
          new Style({ name: 'metaVer', color: 'black', size: 34 });
          new Style({ name: 'footerText', color: 'black', size: 36, bold: true });
        } catch (e) {}
      }
    }, 16);
  }

  // ---------- Update positions ----------
  function updateListPositions() {
    if (scrollOffset < 0) scrollOffset = 0;

    for (var i = 0; i < payloadTexts.length; i++) {
      var baseY = LIST_START_Y + i * ITEM_HEIGHT + TEXT_OFFSET;
      var y = baseY - scrollOffset;
      var txt = payloadTexts[i];
      try { txt.y = y; } catch (e) {}

      var codeX = TEXT_X + TEXT_WIDTH + META_GAP + META_SHIFT_X;
      var versionX = codeX + CODE_EST_WIDTH + META_CODE_VER_GAP + META_VER_SHIFT;
      if (codeTexts[i]) { codeTexts[i].x = codeX; codeTexts[i].y = y; }
      if (verTexts[i]) { verTexts[i].x = versionX; verTexts[i].y = y; }

      var visible = !(y < VISIBLE_TOP - TEXT_HEIGHT || y > VISIBLE_BOTTOM);
      try { txt.visible = visible; } catch (e) {}
      try { if (codeTexts[i]) codeTexts[i].visible = visible; } catch (e) {}
      try { if (verTexts[i]) verTexts[i].visible = visible; } catch (e) {}
    }

    // arrow position
    if (fileList.length > 0 && arrowImg) {
      var arrowBaseY = LIST_START_Y + currentIndex * ITEM_HEIGHT;
      arrowImg.y = arrowBaseY - scrollOffset + (ITEM_HEIGHT - ARROW_H) / 2 + ARROW_Y_OFFSET;
      arrowImg.visible = !(arrowImg.y < VISIBLE_TOP - ARROW_H || arrowImg.y > VISIBLE_BOTTOM);
    }

    // selection bar
    if (fileList.length > 0 && selBarImg) {
      var selectedTextY = LIST_START_Y + currentIndex * ITEM_HEIGHT + TEXT_OFFSET - scrollOffset;
      selBarImg.y = selectedTextY - (SEL_BAR_HEIGHT - TEXT_HEIGHT) / 2;
      selBarImg.visible = !(selBarImg.y < VISIBLE_TOP - SEL_BAR_HEIGHT || selBarImg.y > VISIBLE_BOTTOM);
    }

    // scrollbar
    if (fileList.length > 0 && scrollBg && scrollLock) {
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
    }
  }

  // ---------- Navigation ----------
  function moveUp() {
    if (fileList.length === 0) return;
    currentIndex = (currentIndex === 0) ? fileList.length - 1 : currentIndex - 1;
    scrollOffset = currentIndex * ITEM_HEIGHT;
    updateListPositions();
  }
  function moveDown() {
    if (fileList.length === 0) return;
    currentIndex = (currentIndex === fileList.length - 1) ? 0 : currentIndex + 1;
    scrollOffset = currentIndex * ITEM_HEIGHT;
    updateListPositions();
  }

  // ---------- Selection: fetch & run ----------
  function handleSelect() {
    if (fadingIn) return;
    if (!fileList[currentIndex]) return;
    var entry = fileList[currentIndex];
    var name = entry.name || '';
    var url = entry.url;
    if (!name || !url) return;
    safeLog('Remote selection:', name, url);

    if (name.toLowerCase().endsWith('.js')) {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200 || xhr.status === 0) {
          try {
            var script = xhr.responseText || '';
            safeLog('Evaluating remote JS: ' + name);
            eval(script);
          } catch (e) {
            safeLog('ERROR executing remote JS:', e && e.message);
          }
        } else {
          safeLog('ERROR fetching remote JS (' + xhr.status + ')');
        }
      };
      xhr.open('GET', url, true);
      xhr.send();
    } else {
      var xhr2 = new jsmaf.XMLHttpRequest();
      xhr2.onreadystatechange = function () {
        if (xhr2.readyState !== 4) return;
        if (xhr2.status === 200 || xhr2.status === 0) {
          var remoteData = xhr2.responseText || '';
          var localPath = 'payloads/' + name;
          writeFileLocal(localPath, remoteData, function (err) {
            if (err) {
              safeLog('Failed to write payload to local storage:', err && err.message);
              return;
            }
            try {
              include('binloader.js');
              var init = binloader_init();
              if (init && typeof init.bl_load_from_file === 'function') {
                safeLog('Loading local bin from', '/download0/' + localPath);
                init.bl_load_from_file('/download0/' + localPath);
              } else {
                safeLog('binloader_init failed to return loader');
              }
            } catch (e) {
              safeLog('ERROR loading binloader or payload:', e && e.message);
            }
          });
        } else {
          safeLog('Failed to download remote binary: HTTP ' + xhr2.status);
        }
      };
      xhr2.open('GET', url, true);
      xhr2.send();
    }
  }

  // ---------- Go back ----------
  function goBack() {
    if (fadingIn) return;
    try { include('../download0/themes/Artemis/main.js'); } catch (e) { safeLog('return main error', e && e.message); }
  }

  // ---------- Input ----------
  jsmaf.onKeyDown = function (keyCode) {
    if (fadingIn) return;
    if (pressedKeys[keyCode]) return;
    pressedKeys[keyCode] = true;

    if (keyCode === 4 || keyCode === 7 || keyCode === 55) moveUp();
    else if (keyCode === 6 || keyCode === 57) moveDown();
    else if (keyCode === 14) handleSelect();
    else if (keyCode === 27 || keyCode === 13) goBack();
  };
  jsmaf.onKeyUp = function (k) { delete pressedKeys[k]; };

  if (typeof jsmaf.onMouseDown === 'function') {
    jsmaf.onMouseDown = function (button, x, y) {
      for (var i = 0; i < payloadTexts.length; i++) {
        var itemY = LIST_START_Y + i * ITEM_HEIGHT - scrollOffset;
        if (y >= itemY && y <= itemY + ITEM_HEIGHT) {
          currentIndex = i;
          updateListPositions();
          safeLog('clicked item', i);
          break;
        }
      }
    };
  }

  // ---------- Start flow ----------
  function start() {
    try {
      if (window.__artemis_stop_all_bgm) window.__artemis_stop_all_bgm();
    } catch (e) {}
    try {
      jsmaf.bgm = new jsmaf.AudioClip();
      jsmaf.bgm.volume = 0.5;
      jsmaf.bgm.open(ASSET_PATH + 'bg.wav');
      try { jsmaf.bgm.play(true); } catch (e) {}
    } catch (e) {
      safeLog('bgm start failed:', e && e.message);
      jsmaf.bgm = null;
    }

    showLoadingScreen();
    startSpinner();

    fetchPayloadListFlexible(function (err, rawList) {
      if (err) {
        safeLog('Failed to fetch payload list:', err && err.message);
        showLoadingErrorAndQuit();
        return;
      }

      processListSequentially(rawList || [], function (pe, list) {
        stopSpinner();
        fileList = list || fileList;
        buildUIFromList();
        safeLog('Loaded online payloads: ' + fileList.length);
      });
    });
  }

  // init
  start();

  try {
    window.__online_payload_menu = {
      reloadList: function () { start(); },
      getList: function () { return fileList.slice(); }
    };
  } catch (e) {}

  safeLog('Online payload menu started (loading)...');
})();