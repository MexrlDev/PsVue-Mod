(function () {
  // ---------- Configuration ----------
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
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

  var TITLE_LEFT_X = LINE_X + 20;        // "Options" on left
  var TITLE_Y = LINE_Y - 40;             // above line

  // List – left‑aligned, near top
  var TEXT_X = 200;                       // left margin for text
  var STATE_IMG_X = 1500;                  // right side for on/off image or cycle text
  var STATE_IMG_W = 36;                     // width of on/off image
  var STATE_IMG_H = 50;                     // height of on/off image
  var LIST_START_Y = 200;                   // close to line
  var ITEM_HEIGHT = 70;                      // spacing between items
  var VISIBLE_TOP = 150;
  var VISIBLE_BOTTOM = 900;

  // Selection bar
  var SEL_BAR_HEIGHT = 60;                  // a bit bigger than text
  var SEL_BAR_X = 0;
  var SEL_BAR_WIDTH = SCREEN_W;

  // Footer
  var FOOTER_Y = SCREEN_H - 100;
  var FOOTER_ICON_SIZE = 32;
  var FOOTER_TEXT_SIZE = 36;
  var FOOTER_GAP_ICON_TEXT = 10;
  var FOOTER_GAP_SELECT_BACK = 200;

  // ---------- Config Data (from original, i removed music.. original music is pretty calm) ----------
  var configOptions = [
    { key: 'autolapse', label: 'Auto Lapse', type: 'toggle' },
    { key: 'autopoop', label: 'Auto Poop', type: 'toggle' },
    { key: 'autoclose', label: 'Auto Close', type: 'toggle' },
    { key: 'jb_behavior', label: 'JB Behavior', type: 'cycle', cycleValues: ['Auto', 'Netctrl', 'Lapse'] }
  ];

  // Current config state
  var currentConfig = {
    autolapse: false,
    autopoop: false,
    autoclose: false,
    jb_behavior: 0
  };

  // User payloads (to preserve when saving)
  var userPayloads = [];

  // ---------- Global Variables ----------
  var currentIndex = 0;
  var scrollOffset = 0;
  var optionTexts = [];                // Text objects for option names
  var stateElements = [];               // Either Image (for toggles) or Text (for cycle)
  var lineImg = null;
  var iconImg = null;
  var titleLeft = null;                 // "Options" title
  var selBarImg = null;
  var footerSelectIcon = null;
  var footerSelectText = null;
  var footerBackIcon = null;
  var footerBackText = null;
  var fadeElements = [];                 // all fade-in elements
  var fadeInterval = null;
  var fadingIn = true;
  var pressedKeys = {};

  // Estimated text height (for vertical centering)
  var TEXT_HEIGHT = 38; // size 36 approx

  // ---------- File On/Off ----------
  var fs = {
    write: function (filename, content, callback) {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && callback) {
          callback(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed'));
        }
      };
      xhr.open('POST', 'file://../download0/' + filename, true);
      xhr.send(content);
    },
    read: function (filename, callback) {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && callback) {
          callback(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed'), xhr.responseText);
        }
      };
      xhr.open('GET', 'file://../download0/' + filename, true);
      xhr.send();
    }
  };

  // ---------- Load/Save Config ----------
  function loadConfig() {
    fs.read('config.js', function (err, data) {
      if (err) {
        log('Config not found, using defaults');
        // Use defaults
        return;
      }
      try {
        eval(data || ''); // eslint-disable-line no-eval
        if (typeof CONFIG !== 'undefined') {
          currentConfig.autolapse = CONFIG.autolapse || false;
          currentConfig.autopoop = CONFIG.autopoop || false;
          currentConfig.autoclose = CONFIG.autoclose || false;
          currentConfig.jb_behavior = CONFIG.jb_behavior || 0;

          // Preserve user's payloads
          if (typeof payloads !== 'undefined' && Array.isArray(payloads)) {
            userPayloads = payloads.slice();
          }
        }
      } catch (e) {
        log('Error parsing config: ' + e.message);
      }
      // Update UI after load
      updateAllStateImages();
    });
  }

  function saveConfig() {
    var configContent = 'const CONFIG = {\n';
    configContent += '    autolapse: ' + currentConfig.autolapse + ',\n';
    configContent += '    autopoop: ' + currentConfig.autopoop + ',\n';
    configContent += '    autoclose: ' + currentConfig.autoclose + ',\n';
    configContent += '    jb_behavior: ' + currentConfig.jb_behavior + '\n';
    configContent += '};\n\n';
    configContent += 'const payloads = [ //to be ran after jailbroken\n';
    for (var i = 0; i < userPayloads.length; i++) {
      configContent += '    "' + userPayloads[i] + '"';
      if (i < userPayloads.length - 1) configContent += ',';
      configContent += '\n';
    }
    configContent += '];\n';
    fs.write('config.js', configContent, function (err) {
      if (err) log('Failed to save config: ' + err.message);
      else log('Config saved');
    });
  }

  // Toggle or cycle option at given index
  function toggleOption(index) {
    var opt = configOptions[index];
    if (opt.type === 'toggle') {
      var key = opt.key;
      currentConfig[key] = !currentConfig[key];
      // Special mutual exclusion for autolapse/autopoop
      if (key === 'autolapse' && currentConfig.autolapse) {
        currentConfig.autopoop = false;
        updateStateImage(getIndexByKey('autopoop'));
      } else if (key === 'autopoop' && currentConfig.autopoop) {
        currentConfig.autolapse = false;
        updateStateImage(getIndexByKey('autolapse'));
      }
    } else if (opt.type === 'cycle') {
      currentConfig.jb_behavior = (currentConfig.jb_behavior + 1) % opt.cycleValues.length;
    }
    updateStateImage(index);
    saveConfig();
  }

  function getIndexByKey(key) {
    for (var i = 0; i < configOptions.length; i++) {
      if (configOptions[i].key === key) return i;
    }
    return -1;
  }

  function updateStateImage(index) {
    if (index < 0 || index >= stateElements.length) return;
    var el = stateElements[index];
    var opt = configOptions[index];
    if (opt.type === 'toggle') {
      var value = currentConfig[opt.key];
      el.url = value ? ASSET_PATH + 'opt_on.png' : ASSET_PATH + 'opt_off.png';
    } else {
      // cycle: update text
      el.text = opt.cycleValues[currentConfig.jb_behavior];
    }
  }

  function updateAllStateImages() {
    for (var i = 0; i < configOptions.length; i++) {
      updateStateImage(i);
    }
  }

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
      url: ASSET_PATH + 'titlescr_ico_opt-ico.png',
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

    // Left title: "Options"
    titleLeft = new jsmaf.Text();
    titleLeft.text = 'Options';
    titleLeft.style = 'title';
    titleLeft.x = TITLE_LEFT_X;
    titleLeft.y = TITLE_Y;
    titleLeft.alpha = 0.0;
    jsmaf.root.children.push(titleLeft);
    fadeElements.push(titleLeft);

    // Selection bar (full width, behind everything)
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

    // Option texts and state elements
    for (var i = 0; i < configOptions.length; i++) {
      var opt = configOptions[i];

      // Text label
      var txt = new jsmaf.Text();
      txt.text = opt.label;
      txt.style = 'listText';
      txt.x = TEXT_X;
      txt.y = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2;
      txt.alpha = 0.0;
      optionTexts.push(txt);
      jsmaf.root.children.push(txt);
      fadeElements.push(txt);

      // State element (image for toggle, text for cycle)
      if (opt.type === 'toggle') {
        var img = new Image({
          url: currentConfig[opt.key] ? ASSET_PATH + 'opt_on.png' : ASSET_PATH + 'opt_off.png',
          x: STATE_IMG_X - STATE_IMG_W / 2, // center the image at that x
          y: LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - STATE_IMG_H) / 2,
          width: STATE_IMG_W,
          height: STATE_IMG_H,
          alpha: 0.0
        });
        stateElements.push(img);
        jsmaf.root.children.push(img);
        fadeElements.push(img);
      } else {
        var cycleText = new jsmaf.Text();
        cycleText.text = opt.cycleValues[currentConfig.jb_behavior];
        cycleText.style = 'listText'; // same style
        cycleText.x = STATE_IMG_X - 40; // rough center
        cycleText.y = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2;
        cycleText.alpha = 0.0;
        stateElements.push(cycleText);
        jsmaf.root.children.push(cycleText);
        fadeElements.push(cycleText);
      }
    }

    // ---------- Footer ----------
    var selectSectionWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 100;
    var backSectionWidth = FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT + 80;
    var totalWidth = selectSectionWidth + FOOTER_GAP_SELECT_BACK + backSectionWidth;
    var startX = (SCREEN_W - totalWidth) / 2;

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

    footerSelectText = new jsmaf.Text();
    footerSelectText.text = 'Select';
    footerSelectText.style = 'footerText';
    footerSelectText.x = startX + FOOTER_ICON_SIZE + FOOTER_GAP_ICON_TEXT;
    footerSelectText.y = FOOTER_Y - 18;
    footerSelectText.alpha = 0.0;
    jsmaf.root.children.push(footerSelectText);
    fadeElements.push(footerSelectText);

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
    var fadeDuration = 5000;
    var lineExpandDuration = 1000;

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
        for (var i = 0; i < fadeElements.length; i++) {
          fadeElements[i].alpha = 1.0;
        }
        lineImg.width = LINE_TARGET_W;
      }
    }, 16);

    jsmaf.setTimeout(function() {
      fadingIn = false;
      updateSelection();
    }, 2000);
  }

  // ---------- Update positions based on scroll ----------
  function updateListPositions() {
    var maxScroll = Math.max(0, configOptions.length * ITEM_HEIGHT - (VISIBLE_BOTTOM - VISIBLE_TOP));
    if (scrollOffset > maxScroll) scrollOffset = maxScroll;
    if (scrollOffset < 0) scrollOffset = 0;

    for (var i = 0; i < optionTexts.length; i++) {
      var baseY = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2;
      var y = baseY - scrollOffset;
      optionTexts[i].y = y;
      optionTexts[i].visible = (y >= VISIBLE_TOP - TEXT_HEIGHT && y <= VISIBLE_BOTTOM);

      // State element
      var stateEl = stateElements[i];
      if (stateEl) {
        var stateBaseY;
        if (configOptions[i].type === 'toggle') {
          stateBaseY = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - STATE_IMG_H) / 2;
        } else {
          stateBaseY = LIST_START_Y + i * ITEM_HEIGHT + (ITEM_HEIGHT - TEXT_HEIGHT) / 2;
        }
        var stateY = stateBaseY - scrollOffset;
        stateEl.y = stateY;
        stateEl.visible = (stateY >= VISIBLE_TOP - (configOptions[i].type === 'toggle' ? STATE_IMG_H : TEXT_HEIGHT) && stateY <= VISIBLE_BOTTOM);
      }
    }

    // Selection bar
    if (configOptions.length > 0) {
      var selectedBaseY = LIST_START_Y + currentIndex * ITEM_HEIGHT;
      var selY = selectedBaseY - scrollOffset + (ITEM_HEIGHT - SEL_BAR_HEIGHT) / 2;
      selBarImg.y = selY;
      selBarImg.visible = (selY >= VISIBLE_TOP - SEL_BAR_HEIGHT && selY <= VISIBLE_BOTTOM);
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

  function updateSelection() {
    ensureVisible();
    updateListPositions();
  }

  // ---------- Navigation with wrap-around ----------
  function moveUp() {
    if (configOptions.length === 0) return;
    if (currentIndex === 0) {
      currentIndex = configOptions.length - 1;
      scrollOffset = Math.max(0, configOptions.length * ITEM_HEIGHT - (VISIBLE_BOTTOM - VISIBLE_TOP));
    } else {
      currentIndex--;
    }
    updateSelection();
  }

  function moveDown() {
    if (configOptions.length === 0) return;
    if (currentIndex === configOptions.length - 1) {
      currentIndex = 0;
      scrollOffset = 0;
    } else {
      currentIndex++;
    }
    updateSelection();
  }

  // ---------- Handle Enter (toggle/cycle) ----------
  function handleSelect() {
    if (fadingIn) return;
    if (configOptions.length === 0) return;
    toggleOption(currentIndex);
  }

  // ---------- Go back to main menu ----------
  function goBack() {
    if (fadingIn) return;
    log('Returning to main menu...');
    try {
      include('main-menu.js');
    } catch (e) {
      log('ERROR loading main-menu.js: ' + e.message);
    }
  }

  // ---------- Keyboard Handling ----------
  jsmaf.onKeyDown = function (keyCode) {
    if (fadingIn) return;
    if (pressedKeys[keyCode]) return;
    pressedKeys[keyCode] = true;

    if (keyCode === 4 || keyCode === 7 || keyCode === 55) { // up
      moveUp();
    } else if (keyCode === 6 || keyCode === 57) { // down
      moveDown();
    } else if (keyCode === 14) { // enter
      handleSelect();
    } else if (keyCode === 27 || keyCode === 13) { // esc or backspace
      goBack();
    }
  };

  jsmaf.onKeyUp = function (keyCode) {
    delete pressedKeys[keyCode];
  };

  // ---------- Initialisation ----------
  loadConfig();
  buildUI();
  log('Config menu loaded – ' + configOptions.length + ' options');
})();