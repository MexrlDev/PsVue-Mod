(function () {
  // GLOBAL GUARD: store a global reference so reopening the script can clean up previous instance.
  // This prevents duplicate intervals, audio clips, event handlers, and lingering UI elements.
  var GLOBAL_KEY = '__configMenuState_v1';
  var prev = (typeof window !== 'undefined' && window[GLOBAL_KEY]) || null;
  if (prev && typeof prev.cleanup === 'function') {
    try { prev.cleanup(); } catch (e) {}
  }

  // ---------- Layout / constants ----------
  // Screen and assets
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var ASSET_PATH = 'file:///../download0/data/';

  // Icon / header layout
  var ICON_X = 50;
  var ICON_Y = 50;
  var ICON_W = 130;
  var ICON_H = 138;

  // Decorative line under the title
  var LINE_X = ICON_X + ICON_W + 20;
  var LINE_Y = 100;
  var LINE_TARGET_W = 1600;
  var LINE_H = 4;

  // Title position
  var TITLE_LEFT_X = LINE_X + 20;
  var TITLE_Y = LINE_Y - 40;

  // List layout (left aligned)
  var TEXT_X = 200;
  var STATE_IMG_X = 1500;
  var STATE_IMG_W = 36;
  var STATE_IMG_H = 50;
  var LIST_START_Y = 200;
  var ITEM_HEIGHT = 70;
  var VISIBLE_TOP = 150;
  var VISIBLE_BOTTOM = 900;

  // Selection bar (highlight behind selected item)
  var SEL_BAR_HEIGHT = 60;
  var SEL_BAR_X = 0;
  var SEL_BAR_WIDTH = SCREEN_W;

  // Footer layout (icons and labels)
  var FOOTER_Y = SCREEN_H - 100;
  var FOOTER_ICON_SIZE = 32;
  var FOOTER_TEXT_SIZE = 36;
  var FOOTER_GAP_ICON_TEXT = 10;
  var FOOTER_GAP_SELECT_BACK = 200;

  // ---------- Option definitions ----------
  // Each option has a key to turn off/on
  var configOptions = [
    { key: 'autolapse', label: 'Auto Lapse', type: 'toggle' },
    { key: 'autopoop', label: 'Auto Poop', type: 'toggle' },
    { key: 'autoclose', label: 'Auto Close', type: 'toggle' },
    { key: 'jb_behavior', label: 'JB Behavior', type: 'cycle', cycleValues: ['Auto', 'Netctrl', 'Lapse'] }
  ];

  // ---------- Runtime state ----------
  // currentConfig stores runtime values for each option
  var currentConfig = {
    autolapse: false,
    autopoop: false,
    autoclose: false,
    jb_behavior: 0
  };

  // userPayloads: preserved payload array when saving config file
  var userPayloads = [];

  // UI runtime state
  var currentIndex = 0;            // currently selected list index
  var scrollOffset = 0;            // vertical scroll offset (pixels)
  var optionTexts = [];            // jsmaf.Text objects for labels
  var stateElements = [];          // jsmaf.Image or jsmaf.Text for state on right
  var lineImg = null;              // decorative line image object
  var iconImg = null;              // header icon
  var titleLeft = null;            // "Options" text object
  var selBarImg = null;            // selection highlight image
  var footerSelectIcon = null;     // footer "select" icon
  var footerSelectText = null;     // footer "select" label
  var footerBackIcon = null;       // footer "back" icon
  var footerBackText = null;       // footer "back" label
  var fadeElements = [];           // elements to fade-in at start
  var fadeInterval = null;         // interval id for fade animation
  var fadeTimeout = null;          // timeout id used for finishing fade-in
  var fadingIn = true;             // true while initial fade-in is running
  var pressedKeys = {};            // prevents repeated key handling while key held down
  var TEXT_HEIGHT = 38;            // approximate text height for vertical centering
  var bgm = null;                  // background audio clip

  // ---------- Simple filesystem wrapper ----------
  // fs.read and fs.write use jsmaf.XMLHttpRequest to access file:// paths.
  var fs = {
    write: function (filename, content, callback) {
      try {
        var xhr = new jsmaf.XMLHttpRequest();
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && callback) callback(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed'));
        };
        xhr.open('POST', 'file://../download0/' + filename, true);
        try { xhr.send(content); } catch (e) { if (callback) callback(e); }
      } catch (e) { if (callback) callback(e); }
    },
    read: function (filename, callback) {
      try {
        var xhr2 = new jsmaf.XMLHttpRequest();
        xhr2.onreadystatechange = function () {
          if (xhr2.readyState === 4 && callback) callback(xhr2.status === 0 || xhr2.status === 200 ? null : new Error('failed'), xhr2.responseText);
        };
        xhr2.open('GET', 'file://../download0/' + filename, true);
        try { xhr2.send(); } catch (e) { if (callback) callback(e); }
      } catch (e) { if (callback) callback(e); }
    }
  };

  // ---------- Load and apply saved config ----------
  // Reads config.js (if present) and applies values into currentConfig and userPayloads.
  function loadConfig() {
    fs.read('config.js', function (err, data) {
      if (err) {
        try { log('Config not found, using defaults'); } catch (e) {}
        return;
      }
      try {
        eval(data || '');
        if (typeof CONFIG !== 'undefined') {
          currentConfig.autolapse = !!CONFIG.autolapse;
          currentConfig.autopoop = !!CONFIG.autopoop;
          currentConfig.autoclose = !!CONFIG.autoclose;
          currentConfig.jb_behavior = typeof CONFIG.jb_behavior === 'number' ? CONFIG.jb_behavior : 0;
          if (typeof payloads !== 'undefined' && Array.isArray(payloads)) userPayloads = payloads.slice();
        }
      } catch (e) {
        try { log('Error parsing config: ' + e.message); } catch (ee) {}
      }
      updateAllStateImages();
    });
  }

  // ---------- Save current config ----------
  // Serializes currentConfig and userPayloads to config.js using JSON for stability.
  function saveConfig() {
    try {
      var cfg = {
        autolapse: !!currentConfig.autolapse,
        autopoop: !!currentConfig.autopoop,
        autoclose: !!currentConfig.autoclose,
        jb_behavior: Number(currentConfig.jb_behavior) || 0
      };
      var content = 'const CONFIG = ' + JSON.stringify(cfg, null, 4) + ';\n\n';
      content += 'const payloads = ' + JSON.stringify(userPayloads || [], null, 4) + ';\n';
      fs.write('config.js', content, function (err) {
        if (err) {
          try { log('Failed to save config: ' + (err.message || err)); } catch (e) {}
        } else {
          try { log('Config saved'); } catch (e) {}
        }
      });
    } catch (e) {
      try { log('saveConfig error: ' + e.message); } catch (ee) {}
    }
  }

  // ---------- Toggle / cycle option ----------
  // toggleOption flips toggles and advances cycle values, updates dependent options,
  // updates the visible state and persists via saveConfig.
  function toggleOption(index) {
    try {
      var opt = configOptions[index];
      if (!opt) return;
      if (opt.type === 'toggle') {
        var key = opt.key;
        currentConfig[key] = !currentConfig[key];
        if (key === 'autolapse' && currentConfig.autolapse) {
          currentConfig.autopoop = false;
          updateStateImage(getIndexByKey('autopoop'));
        } else if (key === 'autopoop' && currentConfig.autopoop) {
          currentConfig.autolapse = false;
          updateStateImage(getIndexByKey('autolapse'));
        }
      } else if (opt.type === 'cycle') {
        currentConfig.jb_behavior = (Number(currentConfig.jb_behavior) || 0) + 1;
        currentConfig.jb_behavior = currentConfig.jb_behavior % (opt.cycleValues ? opt.cycleValues.length : 1);
      }
      updateStateImage(index);
      saveConfig();
    } catch (e) {
      try { log('toggleOption error: ' + e.message); } catch (ee) {}
    }
  }

  // Returns configOptions index by key, or -1 if not found.
  function getIndexByKey(key) {
    for (var i = 0; i < configOptions.length; i++) if (configOptions[i].key === key) return i;
    return -1;
  }

  // Updates the right-side state element for an item (image or text).
  function updateStateImage(index) {
    if (index < 0 || index >= stateElements.length) return;
    var el = stateElements[index];
    var opt = configOptions[index];
    if (!el || !opt) return;
    if (opt.type === 'toggle') {
      var value = !!currentConfig[opt.key];
      var url = value ? ASSET_PATH + 'opt_on.png' : ASSET_PATH + 'opt_off.png';
      try { if (typeof el.setURL === 'function') el.setURL(url); else if ('url' in el) el.url = url; } catch (e) {}
    } else {
      var txt = (opt.cycleValues && opt.cycleValues[currentConfig.jb_behavior]) || '';
      try { if ('text' in el) el.text = txt; } catch (e) {}
    }
  }

  // Updates all state elements (called after loading config).
  function updateAllStateImages() {
    for (var i = 0; i < configOptions.length; i++) if (i < stateElements.length) updateStateImage(i);
  }

  // ---------- Styles ----------
  try { new Style({ name: 'title', color: 'black', size: 32 }); } catch (e) {}
  try { new Style({ name: 'listText', color: 'black', size: 36, bold: true }); } catch (e) {}
  try { new Style({ name: 'footerText', color: 'black', size: 36, bold: true }); } catch (e) {}

  // ---------- Background music (optional) ----------
  try {
    bgm = new jsmaf.AudioClip();
    bgm.volume = 0.5;
    bgm.open(ASSET_PATH + 'bg.wav');
    bgm.play(true);
  } catch (e) { bgm = null; }

  // Helper: safely set visible property
  function setVisible(el, vis) {
    if (!el) return;
    try { if ('visible' in el) el.visible = !!vis; } catch (e) {}
  }

  // ---------- Build UI ----------
  // Construct all visual elements (background, header, list items, footer).
  function buildUI() {
    optionTexts = [];
    stateElements = [];
    fadeElements = [];
    pressedKeys = {};

    try { if (jsmaf && jsmaf.root && jsmaf.root.children) jsmaf.root.children.length = 0; } catch (e) {}

    try {
      var bg = new Image({ url: ASSET_PATH + 'bgimg.png', x: 0, y: 0, width: SCREEN_W, height: SCREEN_H });
      jsmaf.root.children.push(bg);
    } catch (e) {}

    try {
      iconImg = new Image({ url: ASSET_PATH + 'titlescr_ico_opt-ico.png', x: ICON_X, y: ICON_Y, width: ICON_W, height: ICON_H, alpha: 0.0 });
      jsmaf.root.children.push(iconImg); fadeElements.push(iconImg);
    } catch (e) {}

    try {
      lineImg = new Image({ url: ASSET_PATH + 'black.png', x: LINE_X, y: LINE_Y, width: 0, height: LINE_H, alpha: 0.0 });
      jsmaf.root.children.push(lineImg); fadeElements.push(lineImg);
    } catch (e) {}

    try {
      titleLeft = new jsmaf.Text();
      titleLeft.text = 'Options';
      titleLeft.style = 'title';
      titleLeft.x = TITLE_LEFT_X;
      titleLeft.y = TITLE_Y;
      titleLeft.alpha = 0.0;
      jsmaf.root.children.push(titleLeft); fadeElements.push(titleLeft);
    } catch (e) {}

    try {
      selBarImg = new Image({ url: ASSET_PATH + 'sel_bar1.png', x: SEL_BAR_X, y: LIST_START_Y, width: SEL_BAR_WIDTH, height: SEL_BAR_HEIGHT, alpha: 0.0 });
      jsmaf.root.children.push(selBarImg); fadeElements.push(selBarImg);
    } catch (e) {}

    for (var i = 0; i < configOptions.length; i++) {
      var opt = configOptions[i];
      try {
        var txt = new jsmaf.Text();
        txt.text = opt.label;
        txt.style = 'listText';
        txt.x = TEXT_X;
        txt.y = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2;
        txt.alpha = 0.0;
        optionTexts.push(txt);
        jsmaf.root.children.push(txt); fadeElements.push(txt);
      } catch (e) {}
      if (opt.type === 'toggle') {
        try {
          var img = new Image({
            url: currentConfig[opt.key] ? ASSET_PATH + 'opt_on.png' : ASSET_PATH + 'opt_off.png',
            x: STATE_IMG_X - STATE_IMG_W / 2,
            y: LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - STATE_IMG_H) / 2,
            width: STATE_IMG_W,
            height: STATE_IMG_H,
            alpha: 0.0
          });
          stateElements.push(img);
          jsmaf.root.children.push(img); fadeElements.push(img);
        } catch (e) {}
      } else {
        try {
          var cycleText = new jsmaf.Text();
          cycleText.text = (opt.cycleValues && opt.cycleValues[currentConfig.jb_behavior]) || '';
          cycleText.style = 'listText';
          cycleText.x = STATE_IMG_X - 40;
          cycleText.y = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2;
          cycleText.alpha = 0.0;
          stateElements.push(cycleText);
          jsmaf.root.children.push(cycleText); fadeElements.push(cycleText);
        } catch (e) {}
      }
    }

    try {
      var selectSectionWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 100;
      var backSectionWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 80;
      var totalWidth = selectSectionWidth + FOOTER_GAP_SELECT_BACK + backSectionWidth;
      var startX = (SCREEN_W - totalWidth) / 2;

      footerSelectIcon = new Image({ url: ASSET_PATH + 'footer_ico_cross.png', x: startX, y: FOOTER_Y - FOOTER_ICON_SIZE / 2, width: FOOTER_ICON_SIZE, height: FOOTER_ICON_SIZE, alpha: 0.0 });
      jsmaf.root.children.push(footerSelectIcon); fadeElements.push(footerSelectIcon);

      footerSelectText = new jsmaf.Text();
      footerSelectText.text = 'Select';
      footerSelectText.style = 'footerText';
      footerSelectText.x = startX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
      footerSelectText.y = FOOTER_Y - 18;
      footerSelectText.alpha = 0.0;
      jsmaf.root.children.push(footerSelectText); fadeElements.push(footerSelectText);

      var backStartX = startX + selectSectionWidth + FOOTER_GAP_SELECT_BACK;
      footerBackIcon = new Image({ url: ASSET_PATH + 'footer_ico_circle.png', x: backStartX, y: FOOTER_Y - FOOTER_ICON_SIZE / 2, width: FOOTER_ICON_SIZE, height: FOOTER_ICON_SIZE, alpha: 0.0 });
      jsmaf.root.children.push(footerBackIcon); fadeElements.push(footerBackIcon);

      footerBackText = new jsmaf.Text();
      footerBackText.text = 'Back';
      footerBackText.style = 'footerText';
      footerBackText.x = backStartX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
      footerBackText.y = FOOTER_Y - 18;
      footerBackText.alpha = 0.0;
      jsmaf.root.children.push(footerBackText); fadeElements.push(footerBackText);
    } catch (e) {}

    updateListPositions();
    startFadeIn();
  }

  // ---------- Fade-in and line expand animation ----------
  // Gradually fades UI elements in and expands the decorative line.
  function startFadeIn() {
    var startTime = Date.now();
    var fadeDuration = 5000;
    var lineExpandDuration = 1000;
    try { if (fadeInterval) jsmaf.clearInterval(fadeInterval); } catch (e) {}
    fadeInterval = jsmaf.setInterval(function () {
      var elapsed = Date.now() - startTime;
      var t = Math.min(elapsed / fadeDuration, 1);
      var lineT = Math.min(elapsed / lineExpandDuration, 1);
      for (var i = 0; i < fadeElements.length; i++) {
        try { fadeElements[i].alpha = t; } catch (e) {}
      }
      try { if (lineImg) lineImg.width = LINE_TARGET_W * lineT; } catch (e) {}
      if (t >= 1) {
        try { jsmaf.clearInterval(fadeInterval); } catch (e) {}
        fadeInterval = null;
        for (var j = 0; j < fadeElements.length; j++) try { fadeElements[j].alpha = 1.0; } catch (ee) {}
        try { if (lineImg) lineImg.width = LINE_TARGET_W; } catch (e) {}
      }
    }, 16);
    try { if (fadeTimeout) jsmaf.clearTimeout(fadeTimeout); } catch (e) {}
    try {
      fadeTimeout = jsmaf.setTimeout(function () {
        fadingIn = false;
        updateSelection();
      }, 2000);
    } catch (e) {
      fadeTimeout = null;
      fadingIn = false;
      updateSelection();
    }
  }

  // ---------- Update list positions based on scroll ----------
  // Positions label and state elements, toggles visibility for performance.
  function updateListPositions() {
    try {
      var maxScroll = Math.max(0, configOptions.length * ITEM_HEIGHT - (VISIBLE_BOTTOM - VISIBLE_TOP));
      if (scrollOffset > maxScroll) scrollOffset = maxScroll;
      if (scrollOffset < 0) scrollOffset = 0;
      for (var i = 0; i < optionTexts.length; i++) {
        var baseY = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2;
        var y = baseY - scrollOffset;
        try { optionTexts[i].y = y; } catch (e) {}
        setVisible(optionTexts[i], (y >= VISIBLE_TOP - TEXT_HEIGHT && y <= VISIBLE_BOTTOM));
        var stateEl = stateElements[i];
        if (stateEl) {
          var stateBaseY;
          try {
            if (configOptions[i].type === 'toggle') stateBaseY = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - STATE_IMG_H) / 2;
            else stateBaseY = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2;
          } catch (e) { stateBaseY = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2; }
          var stateY = stateBaseY - scrollOffset;
          try { stateEl.y = stateY; } catch (e) {}
          var topCheck = VISIBLE_TOP - (configOptions[i].type === 'toggle' ? STATE_IMG_H : TEXT_HEIGHT);
          setVisible(stateEl, (stateY >= topCheck && stateY <= VISIBLE_BOTTOM));
        }
      }
      if (configOptions.length > 0 && selBarImg) {
        var selectedBaseY = LIST_START_Y + currentIndex * ITEM_HEIGHT;
        var selY = selectedBaseY - scrollOffset + (ITEM_HEIGHT - SEL_BAR_HEIGHT) / 2;
        try { selBarImg.y = selY; } catch (e) {}
        setVisible(selBarImg, (selY >= VISIBLE_TOP - SEL_BAR_HEIGHT && selY <= VISIBLE_BOTTOM));
      } else setVisible(selBarImg, false);
    } catch (e) {}
  }

  // ---------- Ensure selected item is visible ----------
  function ensureVisible() {
    try {
      var itemTop = LIST_START_Y + currentIndex * ITEM_HEIGHT - scrollOffset;
      var itemBottom = itemTop + ITEM_HEIGHT;
      if (itemTop < VISIBLE_TOP) scrollOffset = Math.max(0, LIST_START_Y + currentIndex * ITEM_HEIGHT - VISIBLE_TOP);
      else if (itemBottom > VISIBLE_BOTTOM) scrollOffset = LIST_START_Y + currentIndex * ITEM_HEIGHT + ITEM_HEIGHT - VISIBLE_BOTTOM;
    } catch (e) {}
  }

  function updateSelection() {
    ensureVisible();
    updateListPositions();
  }

  // ---------- Navigation (wrap-around) ----------
  function moveUp() {
    if (configOptions.length === 0) return;
    if (currentIndex === 0) {
      currentIndex = configOptions.length - 1;
      scrollOffset = Math.max(0, configOptions.length * ITEM_HEIGHT - (VISIBLE_BOTTOM - VISIBLE_TOP));
    } else currentIndex--;
    updateSelection();
  }

  function moveDown() {
    if (configOptions.length === 0) return;
    if (currentIndex === configOptions.length - 1) {
      currentIndex = 0; scrollOffset = 0;
    } else currentIndex++;
    updateSelection();
  }

  // ---------- Perform select action ----------
  function handleSelect() {
    if (fadingIn) return;
    if (configOptions.length === 0) return;
    try { toggleOption(currentIndex); } catch (e) {}
  }

  // ---------- Go back ----------
  function goBack() {
    if (fadingIn) return;
    // FIX: cleanup before leaving
    cleanup();
    try { log('Returning to main menu...'); } catch (e) {}
    try { include('main-menu.js'); } catch (e) { try { log('ERROR loading main-menu.js: ' + e.message); } catch (ee) {} }
  }

  // ---------- input handlers ----------
  // jsmaf.onKeyDown and onKeyUp are set to navigate and select/back.
  jsmaf.onKeyDown = function (keyCode) {
    if (fadingIn) return;
    if (pressedKeys[keyCode]) return;
    pressedKeys[keyCode] = true;
    if (keyCode === 4 || keyCode === 7 || keyCode === 55) moveUp();
    else if (keyCode === 6 || keyCode === 57) moveDown();
    else if (keyCode === 14) handleSelect();
    else if (keyCode === 27 || keyCode === 13) goBack();
  };

  jsmaf.onKeyUp = function (keyCode) { try { delete pressedKeys[keyCode]; } catch (e) {} };

  // ---------- Cleanup function ----------
  // Stops audio, clears intervals/timeouts, removes event handlers and UI children.
  function cleanup() {
    try { if (bgm && typeof bgm.stop === 'function') bgm.stop(); } catch (e) {}
    bgm = null;
    try { if (fadeInterval) jsmaf.clearInterval(fadeInterval); } catch (e) {}
    fadeInterval = null;
    try { if (fadeTimeout) jsmaf.clearTimeout(fadeTimeout); } catch (e) {}
    fadeTimeout = null;
    try { if (jsmaf) { jsmaf.onKeyDown = null; jsmaf.onKeyUp = null; } } catch (e) {}
    try { if (jsmaf && jsmaf.root && jsmaf.root.children) jsmaf.root.children.length = 0; } catch (e) {}
    try {
      optionTexts = []; stateElements = []; fadeElements = []; pressedKeys = {};
      lineImg = iconImg = titleLeft = selBarImg = footerSelectIcon = footerSelectText = footerBackIcon = footerBackText = null;
    } catch (e) {}
  }

  // Expose cleanup on a global so reopening the script can call it before reinitializing.
  var stateObj = {
    cleanup: cleanup,
    instanceActive: true
  };
  try { if (typeof window !== 'undefined') window[GLOBAL_KEY] = stateObj; } catch (e) {}

  // ---------- Initialize ----------
  try {
    buildUI();
    loadConfig();
    try { log('Config menu loaded – ' + configOptions.length + ' options'); } catch (e) {}
  } catch (e) {
    try { log('Initialization error: ' + e.message); } catch (ee) {}
  }
})();
