(function () {
  if (typeof libc_addr === 'undefined') {
    include('userland.js');
  }
  if (typeof lang === 'undefined') {
    include('languages.js');
  }

  var GLOBAL_KEY = '__configMenuState_v1';
  var prev = (typeof window !== 'undefined' && window[GLOBAL_KEY]) || null;
  if (prev && typeof prev.cleanup === 'function') {
    try { prev.cleanup(); } catch (e) {}
  }

  // ---------- Layout / constants ----------
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var ASSET_PATH = 'file:///../download0/themes/Artemis/data/';

  var ICON_X = 50;
  var ICON_Y = 50;
  var ICON_W = 130;
  var ICON_H = 138;

  var LINE_X = ICON_X + ICON_W + 20;
  var LINE_Y = 100;
  var LINE_TARGET_W = 1600;
  var LINE_H = 4;

  var TITLE_LEFT_X = LINE_X + 20;
  var TITLE_Y = LINE_Y - 40;

  var TEXT_X = 200;
  var STATE_IMG_X = 1500;
  var STATE_IMG_W = 36;
  var STATE_IMG_H = 50;

  var SWITCH_TEXT_X = STATE_IMG_X - 40; 
  var SWITCH_TEXT_CENTER_OFFSET = 60;

  var LIST_START_Y = 200;
  var ITEM_HEIGHT = 70;
  var VISIBLE_TOP = 150;
  var VISIBLE_BOTTOM = 900;

  var SEL_BAR_HEIGHT = 60;
  var SEL_BAR_X = 0;
  var SEL_BAR_WIDTH = SCREEN_W;

  var FOOTER_Y = SCREEN_H - 100;
  var FOOTER_ICON_SIZE = 32;
  var FOOTER_TEXT_SIZE = 36;
  var FOOTER_GAP_ICON_TEXT = 10;
  var FOOTER_GAP_SELECT_BACK = 200; // gap between footer items

  // Approximate text widths for footer items (used for positioning)
  var SELECT_TEXT_WIDTH = 100;   // "Select"
  var SAFE_TEXT_WIDTH = 120;     // "Safe Back"
  var BACK_TEXT_WIDTH = 80;      // "Back"

  // ---------- Line timing ----------
  var lineExpandDelaySec = 0.5;
  var lineExpandDurationSec = 1.5;
  var lineExpandDelayMs = Math.round(lineExpandDelaySec * 1000);
  var lineExpandDurationMs = Math.round(lineExpandDurationSec * 1000);

  // ---------- Option definitions ----------
  var configOptions = [
    { key: 'autolapse', label: lang.autoLapse || 'Auto Lapse', type: 'toggle' },
    { key: 'autopoop',  label: lang.autoPoop  || 'Auto Poop',  type: 'toggle' },
    { key: 'autoclose', label: lang.autoClose || 'Auto Close', type: 'toggle' },
    { key: 'jb_behavior', label: lang.jbBehavior || 'JB Behavior', type: 'cycle' },
    { key: 'theme',     label: lang.theme      || 'Theme',      type: 'cycle' }
  ];

  // ---------- JB Behavior labels ----------
  var jbBehaviorLabels = [];
  if (typeof lang !== 'undefined' && lang.jbBehaviorAuto) {
    jbBehaviorLabels = [lang.jbBehaviorAuto, lang.jbBehaviorNetctrl, lang.jbBehaviorLapse];
  } else {
    jbBehaviorLabels = ['Auto', 'Netctrl', 'Lapse'];
  }

  // ---------- Theme discovery ----------
  var availableThemes = [];
  var themeLabels = [];

  function scanThemes() {
    var themes = [];
    try {
      fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
      fn.register(0x06, 'close_sys', ['bigint'], 'bigint');
      fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint');

      var themesDir = '/download0/themes';
      var path_addr = mem.malloc(256);
      var buf = mem.malloc(4096);

      for (var i = 0; i < themesDir.length; i++) {
        mem.view(path_addr).setUint8(i, themesDir.charCodeAt(i));
      }
      mem.view(path_addr).setUint8(themesDir.length, 0);

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
            for (var _i = 0; _i < d_namlen; _i++) {
              name += String.fromCharCode(mem.view(buf.add(new BigInt(0, offset + 8 + _i))).getUint8(0));
            }
            if (d_type === 4 && name !== '.' && name !== '..') {
              themes.push(name);
            }
            offset += d_reclen;
          }
        }
        fn.close_sys(fd);
      }
    } catch (e) {
      try { log('Theme scan failed: ' + e.message); } catch (ee) {}
    }
    var idx = themes.indexOf('default');
    if (idx > 0) {
      themes.splice(idx, 1);
      themes.unshift('default');
    } else if (idx < 0) {
      themes.unshift('default');
    }
    return themes;
  }

  availableThemes = scanThemes();
  themeLabels = availableThemes.map(theme => theme.charAt(0).toUpperCase() + theme.slice(1));
  try { log('Discovered themes: ' + availableThemes.join(', ')); } catch (e) {}

  // ---------- Runtime state ----------
  var currentConfig = {
    autolapse: false,
    autopoop: false,
    autoclose: false,
    autoclose_delay: 0,
    jb_behavior: 0,
    theme: availableThemes[0] || 'default'
  };

  var userPayloads = [];
  var configLoaded = false;

  var currentIndex = 0;
  var scrollOffset = 0;
  var optionTexts = [];
  var stateElements = [];
  var lineImg = null;
  var iconImg = null;
  var titleLeft = null;
  var selBarImg = null;
  // Footer elements
  var footerSelectIcon = null;
  var footerSelectText = null;
  var footerSafeIcon = null;    // new for Safe Back
  var footerSafeText = null;    // new for Safe Back
  var footerBackIcon = null;
  var footerBackText = null;
  var fadeElements = [];
  var fadeInterval = null;
  var fadeTimeout = null;
  var fadingIn = true;
  var pressedKeys = {};
  var TEXT_HEIGHT = 38;

  // ---------- Background music ----------
  if (typeof jsmaf.bgm === 'undefined') {
    jsmaf.bgm = null;
  }
  var bgm = jsmaf.bgm;

  // ---------- Simple filesystem wrapper ----------
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

  // ---------- Load config from config.json ----------
  function loadConfig() {
    fs.read('config.json', function (err, data) {
      if (err) {
        try { log('Config not found, using defaults'); } catch (e) {}
        configLoaded = true;
        return;
      }
      try {
        var configData = JSON.parse(data || '{}');
        if (configData.config) {
          var cfg = configData.config;
          currentConfig.autolapse = !!cfg.autolapse;
          currentConfig.autopoop = !!cfg.autopoop;
          currentConfig.autoclose = !!cfg.autoclose;
          currentConfig.autoclose_delay = cfg.autoclose_delay || 0;
          currentConfig.jb_behavior = typeof cfg.jb_behavior === 'number' ? cfg.jb_behavior : 0;

          if (cfg.theme && availableThemes.includes(cfg.theme)) {
            currentConfig.theme = cfg.theme;
          } else {
            try { log('WARNING: Theme "' + (cfg.theme || 'undefined') + '" not found, using default'); } catch (e) {}
            currentConfig.theme = availableThemes[0] || 'default';
          }

          if (configData.payloads && Array.isArray(configData.payloads)) {
            userPayloads = configData.payloads.slice();
          } else {
            userPayloads = [];
          }
        }
        configLoaded = true;
      } catch (e) {
        try { log('Error parsing config: ' + e.message); } catch (ee) {}
        configLoaded = true;
      }
      updateAllStateImages();
    });
  }

  // ---------- Save config ----------
  var savePending = false;
  function saveConfig() {
    if (!configLoaded) {
      try { log('Config not loaded yet, skipping save'); } catch (e) {}
      return;
    }
    if (savePending) {
      try { log('Save already in progress, debouncing'); } catch (e) {}
      return;
    }
    savePending = true;
    try {
      var safePayloads = Array.isArray(userPayloads) ? userPayloads.slice() : [];

      var configData = {
        config: {
          autolapse: !!currentConfig.autolapse,
          autopoop: !!currentConfig.autopoop,
          autoclose: !!currentConfig.autoclose,
          autoclose_delay: currentConfig.autoclose_delay || 0,
          jb_behavior: Number(currentConfig.jb_behavior) || 0,
          theme: currentConfig.theme
        },
        payloads: safePayloads
      };
      var content = JSON.stringify(configData, null, 2);
      fs.write('config.json', content, function (err) {
        savePending = false;
        if (err) {
          try { log('Failed to save config: ' + (err.message || err)); } catch (e) {}
        } else {
          try { log('Config saved'); } catch (e) {}
        }
      });
    } catch (e) {
      savePending = false;
      try { log('saveConfig error: ' + e.message); } catch (ee) {}
    }
  }

  // ---------- Update a single state element ----------
  function updateValueText(index) {
    if (index < 0 || index >= stateElements.length) return;
    var el = stateElements[index];
    var opt = configOptions[index];
    if (!el || !opt) return;

    if (opt.type === 'toggle') {
      var value = !!currentConfig[opt.key];
      var url = value ? ASSET_PATH + 'opt_on.png' : ASSET_PATH + 'opt_off.png';
      try {
        if (el.img) {
          if (typeof el.img.setURL === 'function') el.img.setURL(url);
          else if ('url' in el.img) el.img.url = url;
        }
      } catch (e) {}
      // Note: toggles intentionally do NOT show '< ON >' text — only the image.
    } else {
      var txtVal = '';
      if (opt.key === 'jb_behavior') {
        txtVal = jbBehaviorLabels[currentConfig.jb_behavior] || jbBehaviorLabels[0];
      } else if (opt.key === 'theme') {
        var themeIdx = availableThemes.indexOf(currentConfig.theme);
        if (themeIdx < 0) themeIdx = 0;
        txtVal = themeLabels[themeIdx] || currentConfig.theme;
      }
      try {
        if (el.text) el.text.text = '< ' + txtVal + ' >';
      } catch (e) {}
    }
  }

  function updateAllStateImages() {
    for (var i = 0; i < configOptions.length; i++) updateValueText(i);
  }

  // ---------- Handle button press ----------
  function handleButtonPress() {
    if (fadingIn) return;
    if (currentIndex >= configOptions.length) return;
    var option = configOptions[currentIndex];
    var key = option.key;

    if (option.type === 'cycle') {
      if (key === 'jb_behavior') {
        currentConfig.jb_behavior = (currentConfig.jb_behavior + 1) % jbBehaviorLabels.length;
        try { log(key + ' = ' + jbBehaviorLabels[currentConfig.jb_behavior]); } catch (e) {}
      } else if (key === 'theme') {
        var curIdx = availableThemes.indexOf(currentConfig.theme);
        if (curIdx < 0) curIdx = 0;
        var nextIdx = (curIdx + 1) % availableThemes.length;
        currentConfig.theme = availableThemes[nextIdx];
        try { log(key + ' = ' + currentConfig.theme); } catch (e) {}
      }
    } else {
      // toggle
      currentConfig[key] = !currentConfig[key];
      // Mutual exclusion
      if (key === 'autolapse' && currentConfig.autolapse) {
        currentConfig.autopoop = false;
        updateValueText(getIndexByKey('autopoop'));
      } else if (key === 'autopoop' && currentConfig.autopoop) {
        currentConfig.autolapse = false;
        updateValueText(getIndexByKey('autolapse'));
      }
      try { log(key + ' = ' + currentConfig[key]); } catch (e) {}
    }
    updateValueText(currentIndex);
    saveConfig();
  }

  function getIndexByKey(key) {
    for (var i = 0; i < configOptions.length; i++) if (configOptions[i].key === key) return i;
    return -1;
  }

  // ---------- Styles ----------
  try { new Style({ name: 'title', color: 'black', size: 32 }); } catch (e) {}
  try { new Style({ name: 'listText', color: 'black', size: 36, bold: true }); } catch (e) {}
  try { new Style({ name: 'footerText', color: 'black', size: 36, bold: true }); } catch (e) {}

  function setVisible(el, vis) {
    if (!el) return;
    try { if ('visible' in el) el.visible = !!vis; } catch (e) {}
  }

  // ---------- Safe Back action (key code 12) ----------
  function goToMain() {
    try { log('Safe Back: loading main.js...'); } catch (e) {}
    cleanup(); // clear UI, keep music
    // Use exact path with capital 'A' in Artemis
    var mainPath = 'file:///../download0/themes/Artemis/main.js';
    try {
      include(mainPath);
    } catch (e) {
      try { log('Failed to load main.js: ' + e.message); } catch (ee) {}
    }
    // Stop further execution of this script
    return;
  }

  // ---------- Build UI ----------
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

    // ---------- Restart background music cleanly ----------
    try {
      if (jsmaf.bgm && typeof jsmaf.bgm.stop === 'function') {
        try { jsmaf.bgm.stop(); } catch (e) {}
      }
    } catch (e) {}
    try {
      jsmaf.bgm = new jsmaf.AudioClip();
      jsmaf.bgm.open(ASSET_PATH + 'bg.wav');
      jsmaf.bgm.volume = 0.5;
      try { jsmaf.bgm.play(true); } catch (e) {}
    } catch (e) {
      try { jsmaf.bgm = null; } catch (ee) {}
    }
    bgm = jsmaf.bgm;

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
      titleLeft.text = lang.config || 'Options';
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
      // Label
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

      // State element (object { img?, text? })
      try {
        var stateObj = { img: null, text: null };

        if (opt.type === 'toggle') {
          // Image only for toggles (no '< ON >' text)
          var img = new Image({
            url: currentConfig[opt.key] ? ASSET_PATH + 'opt_on.png' : ASSET_PATH + 'opt_off.png',
            // position the image so its CENTER aligns with the visual center of the switch text
            x: SWITCH_TEXT_X + SWITCH_TEXT_CENTER_OFFSET - (STATE_IMG_W / 2),
            y: LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - STATE_IMG_H) / 2,
            width: STATE_IMG_W,
            height: STATE_IMG_H,
            alpha: 0.0
          });
          stateObj.img = img;
          jsmaf.root.children.push(img); fadeElements.push(img);
        } else {
          // cycle: show as "< value >"
          var cycleText = new jsmaf.Text();
          var val = '';
          if (opt.key === 'jb_behavior') {
            val = jbBehaviorLabels[currentConfig.jb_behavior] || jbBehaviorLabels[0];
          } else if (opt.key === 'theme') {
            var themeIdx = availableThemes.indexOf(currentConfig.theme);
            if (themeIdx < 0) themeIdx = 0;
            val = themeLabels[themeIdx] || currentConfig.theme;
          }
          cycleText.text = '< ' + val + ' >';
          cycleText.style = 'listText';
          cycleText.x = SWITCH_TEXT_X; // use SWITCH_TEXT_X for cycle text position
          cycleText.y = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2;
          cycleText.alpha = 0.0;
          stateObj.text = cycleText;
          jsmaf.root.children.push(cycleText); fadeElements.push(cycleText);
        }

        stateElements.push(stateObj);
      } catch (e) {
        try { stateElements.push({}); } catch (ee) {}
      }
    }

    // ---------- Footer with Select, Safe Back, Back ----------
    try {
      // Calculate widths for each section based on estimated text widths
      var selectSectionWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + SELECT_TEXT_WIDTH;
      var safeSectionWidth   = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + SAFE_TEXT_WIDTH;
      var backSectionWidth   = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + BACK_TEXT_WIDTH;

      var totalWidth = selectSectionWidth + FOOTER_GAP_SELECT_BACK + safeSectionWidth + FOOTER_GAP_SELECT_BACK + backSectionWidth;
      var startX = (SCREEN_W - totalWidth) / 2;

      // Select (cross)
      var selectIconX = startX;
      var selectTextX = selectIconX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;

      footerSelectIcon = new Image({ url: ASSET_PATH + 'footer_ico_cross.png', x: selectIconX, y: FOOTER_Y - FOOTER_ICON_SIZE / 2, width: FOOTER_ICON_SIZE, height: FOOTER_ICON_SIZE, alpha: 0.0 });
      jsmaf.root.children.push(footerSelectIcon); fadeElements.push(footerSelectIcon);

      footerSelectText = new jsmaf.Text();
      footerSelectText.text = 'Select';
      footerSelectText.style = 'footerText';
      footerSelectText.x = selectTextX;
      footerSelectText.y = FOOTER_Y - 18;
      footerSelectText.alpha = 0.0;
      jsmaf.root.children.push(footerSelectText); fadeElements.push(footerSelectText);

      // Safe Back (triangle) - placed between Select and Back
      var safeIconX = startX + selectSectionWidth + FOOTER_GAP_SELECT_BACK;
      var safeTextX = safeIconX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;

      footerSafeIcon = new Image({ url: ASSET_PATH + 'footer_ico_triangle.png', x: safeIconX, y: FOOTER_Y - FOOTER_ICON_SIZE / 2, width: FOOTER_ICON_SIZE, height: FOOTER_ICON_SIZE, alpha: 0.0 });
      jsmaf.root.children.push(footerSafeIcon); fadeElements.push(footerSafeIcon);

      footerSafeText = new jsmaf.Text();
      footerSafeText.text = 'Safe Back';
      footerSafeText.style = 'footerText';
      footerSafeText.x = safeTextX;
      footerSafeText.y = FOOTER_Y - 18;
      footerSafeText.alpha = 0.0;
      jsmaf.root.children.push(footerSafeText); fadeElements.push(footerSafeText);

      // Back (circle)
      var backIconX = startX + selectSectionWidth + FOOTER_GAP_SELECT_BACK + safeSectionWidth + FOOTER_GAP_SELECT_BACK;
      var backTextX = backIconX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;

      footerBackIcon = new Image({ url: ASSET_PATH + 'footer_ico_circle.png', x: backIconX, y: FOOTER_Y - FOOTER_ICON_SIZE / 2, width: FOOTER_ICON_SIZE, height: FOOTER_ICON_SIZE, alpha: 0.0 });
      jsmaf.root.children.push(footerBackIcon); fadeElements.push(footerBackIcon);

      footerBackText = new jsmaf.Text();
      footerBackText.text = 'Back';
      footerBackText.style = 'footerText';
      footerBackText.x = backTextX;
      footerBackText.y = FOOTER_Y - 18;
      footerBackText.alpha = 0.0;
      jsmaf.root.children.push(footerBackText); fadeElements.push(footerBackText);
    } catch (e) {}

    updateListPositions();
    startFadeIn();
  }

  // ---------- Fade-in and line expand animation ----------
  function startFadeIn() {
    var startTime = Date.now();
    var fadeDuration = 5000;
    var lineExpandDelay = lineExpandDelayMs;
    var lineExpandDuration = lineExpandDurationMs;

    try { if (fadeInterval) jsmaf.clearInterval(fadeInterval); } catch (e) {}
    fadeInterval = jsmaf.setInterval(function () {
      var elapsed = Date.now() - startTime;
      var t = Math.min(elapsed / fadeDuration, 1);

      var lineElapsed = Math.max(0, elapsed - lineExpandDelay);
      var lineT = Math.min(lineElapsed / lineExpandDuration, 1);

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
        var stateObj = stateElements[i];
        if (stateObj) {
          var stateBaseY;
          try {
            if (configOptions[i].type === 'toggle') stateBaseY = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - STATE_IMG_H) / 2;
            else stateBaseY = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2;
          } catch (e) { stateBaseY = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2; }
          var stateY = stateBaseY - scrollOffset;

          // image
          try {
            if (stateObj.img) {
              stateObj.img.y = stateY;
              // Align image center to SWITCH_TEXT_X + SWITCH_TEXT_CENTER_OFFSET
              stateObj.img.x = SWITCH_TEXT_X + SWITCH_TEXT_CENTER_OFFSET - (STATE_IMG_W / 2);
              var topCheck = VISIBLE_TOP - STATE_IMG_H;
              setVisible(stateObj.img, (stateY >= topCheck && stateY <= VISIBLE_BOTTOM));
            }
          } catch (e) {}

          // text (only for cycle items)
          try {
            if (stateObj.text) {
              stateObj.text.x = SWITCH_TEXT_X;
              stateObj.text.y = stateY;
              var topCheck2 = VISIBLE_TOP - TEXT_HEIGHT;
              setVisible(stateObj.text, (stateY >= topCheck2 && stateY <= VISIBLE_BOTTOM));
            }
          } catch (e) {}
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

  // ---------- Key handling ----------
  var confirmKey = jsmaf.circleIsAdvanceButton ? 13 : 14;
  var backKey = jsmaf.circleIsAdvanceButton ? 14 : 13;

  jsmaf.onKeyDown = function (keyCode) {
    if (fadingIn) return;
    if (pressedKeys[keyCode]) return;
    pressedKeys[keyCode] = true;

    // Modified: removed keyCode 7 from the up movement
    if (keyCode === 4 || keyCode === 55) moveUp();
    else if (keyCode === 6 || keyCode === 57) moveDown();
    else if (keyCode === confirmKey) handleButtonPress();
    else if (keyCode === backKey || keyCode === 27) {
      try { log('Restarting...'); } catch (e) {}
      saveConfig();
      jsmaf.setTimeout(function () {
        debugging.restart();
      }, 100);
    }
    // New Safe Back key
    else if (keyCode === 12) {
      goToMain();
    }
  };

  jsmaf.onKeyUp = function (keyCode) { try { delete pressedKeys[keyCode]; } catch (e) {} };

  // ---------- Cleanup function (clears UI, keeps music playing) ----------
  function cleanup() {
    // Music is NOT stopped – it persists across script instances
    try { if (fadeInterval) jsmaf.clearInterval(fadeInterval); } catch (e) {}
    fadeInterval = null;
    try { if (fadeTimeout) jsmaf.clearTimeout(fadeTimeout); } catch (e) {}
    fadeTimeout = null;
    try { if (jsmaf) { jsmaf.onKeyDown = null; jsmaf.onKeyUp = null; } } catch (e) {}
    try { if (jsmaf && jsmaf.root && jsmaf.root.children) jsmaf.root.children.length = 0; } catch (e) {}
    try {
      optionTexts = []; stateElements = []; fadeElements = []; pressedKeys = {};
      lineImg = iconImg = titleLeft = selBarImg = footerSelectIcon = footerSelectText = footerSafeIcon = footerSafeText = footerBackIcon = footerBackText = null;
    } catch (e) {}
  }

  var stateObj = {
    cleanup: cleanup,
    instanceActive: true
  };
  try { if (typeof window !== 'undefined') window[GLOBAL_KEY] = stateObj; } catch (e) {}

  // ---------- Initialize ----------
  try {
    buildUI();
    loadConfig();
    try { log('Config menu loaded – ' + configOptions.length + ' options (themes: ' + availableThemes.join(', ') + ')'); } catch (e) {}
  } catch (e) {
    try { log('Initialization error: ' + e.message); } catch (ee) {}
  }
})();