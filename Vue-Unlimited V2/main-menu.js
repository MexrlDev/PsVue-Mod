(function () {
  include('languages.js');
  log(lang.loadingMainMenu);

  // ---------- CONFIG (edit only these) ----------
  var listOffsetX = -560;        // move list left/right
  var listOffsetY = 30;          // move list up/down
  var listInsertIndex = 1;       // z-order (0 = first child)

  // Adjust the buttons
  var startY = 330;              // was 380
  var buttonSpacing = 90;        // was 100
  var buttonWidth = 600;
  var buttonHeight = 72;
  var textLeftPadding = 30;
  // ------------------------------------------------

  var currentButton = 0;
  var buttons = [];
  var buttonTexts = [];
  var buttonOrigPos = [];
  var textOrigPos = [];

  var normalButtonImg = '';
  var selectedButtonImg = '';

  // ----- Themes gallery -----
  var inGallery = false;
  var galleryElements = [];
  var galleryCurrentIndex = 0;
  var themes = [
    { file: 'theme1.png', name: 'Gold-Vue', script: '../download0/PxMod/Gold-Vue 1.2/main-menu.js' },
    { file: 'theme2.png', name: 'Vue-Mod', script: '../download0/PxMod/Vue-Mod 1.3/main-menu.js' },
    { file: 'theme3.png', name: 'Original-Vue (Coming Soon)', script: '../download0/PxMod/Vue/main-menu.js' }
  ];
  var themeImage = null;
  var infoText = null;
  var closeText = null;
  var oIcon = null;
  var applyText = null;
  var xIcon = null;

  // ----- Bg Themes gallery -----
  var inBgGallery = false;
  var bgGalleryElements = [];
  var bgGalleryCurrentIndex = 0;
  var bgThemes = [
    { file: 'bg1.png', name: 'Gta SA Cj' },
    { file: 'bg2.png', name: 'gta 4' },
    { file: 'bg3.png', name: 'Gta 5' },
    { file: 'bg4.png', name: 'Cat >:3' },
    { file: 'bg5.png', name: 'Background 5' },
    { file: 'bg6.png', name: 'Background 6' },
    { file: 'bg7.png', name: 'Background 7' }
  ];
  var bgImagePreview = null;
  var bgInfoText = null;
  var bgCloseText = null;
  var bgOIcon = null;
  var bgApplyText = null;
  var bgXIcon = null;

  // ----- Color gallery (new) -----
  var inColorGallery = false;
  var colorGalleryElements = [];
  // colorCurrentIndex will be initialized after loading saved config
  var colorCurrentIndex = 0;
  // A set of the colors, you can remove/add whatever youd like.
  var colors = [
    { name: 'Gold (Default)', color: 'rgb(160,130,61)' },
    { name: 'Red', color: 'rgb(255, 0, 0)' },
    { name: 'Green', color: 'rgb(0, 255, 0)' },
    { name: 'Blue', color: 'rgb(0, 0, 255)' },
    { name: 'Yellow', color: 'rgb(255, 255, 0)' },
    { name: 'Cyan', color: 'rgb(0, 255, 255)' },
    { name: 'Magenta', color: 'rgb(255, 0, 255)' },
    { name: 'White', color: 'rgb(255, 255, 255)' },
    { name: 'Black', color: 'rgb(0, 0, 0)' },
    { name: 'Orange', color: 'rgb(255, 165, 0)' },
    { name: 'Purple', color: 'rgb(128, 0, 128)' }
  ];
  var colorSampleText = null;      // preview text in selected color
  var colorInfoText = null;        // shows color name
  var colorCloseText = null;
  var colorOIcon = null;
  var colorApplyText = null;
  var colorXIcon = null;
  // colorPreviewStyle will be created after loading config so it uses saved color
  var colorPreviewStyle = null;

  // ------------------ Persistence helpers ------------------
  var savedConfig = {
    selectedColorIndex: 0,
    bgThemeFile: null,
    lastThemeScript: null
  };

  var CONFIG_JS_PATH = '../download0/PxMod/user-config.js';
  var CONFIG_JSON_PATH = '../download0/PxMod/user-config.json';

  function tryWriteFile(path, content) {
    try {
      if (typeof jsmaf !== 'undefined' && typeof jsmaf.writeFile === 'function') {
        jsmaf.writeFile(path, content);
        log('Saved config via jsmaf.writeFile -> ' + path);
        return true;
      }
    } catch (e) {}
    try {
      if (typeof fs !== 'undefined' && typeof fs.writeFileSync === 'function') {
        fs.writeFileSync(path, content, 'utf8');
        log('Saved config via fs.writeFileSync -> ' + path);
        return true;
      }
    } catch (e) {}
    try {
      if (typeof require === 'function') {
        var nodefs = require('fs');
        if (nodefs && typeof nodefs.writeFileSync === 'function') {
          nodefs.writeFileSync(path, content, 'utf8');
          log('Saved config via require("fs").writeFileSync -> ' + path);
          return true;
        }
      }
    } catch (e) {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pxmod_config', content);
        log('Saved config via localStorage (pxmod_config)');
        return true;
      }
    } catch (e) {}
    return false;
  }

  function tryReadFile(path) {
    try {
      if (typeof jsmaf !== 'undefined' && typeof jsmaf.readFile === 'function') {
        return jsmaf.readFile(path);
      }
    } catch (e) {}
    try {
      if (typeof fs !== 'undefined' && typeof fs.readFileSync === 'function') {
        return fs.readFileSync(path, 'utf8');
      }
    } catch (e) {}
    try {
      if (typeof require === 'function') {
        var nodefs = require('fs');
        if (nodefs && typeof nodefs.readFileSync === 'function') {
          return nodefs.readFileSync(path, 'utf8');
        }
      }
    } catch (e) {}
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('pxmod_config');
      }
    } catch (e) {}
    return null;
  }

  function loadConfig() {
    // 1) Try JS include first (so include() will work next time if we wrote JS)
    try {
      try { include(CONFIG_JS_PATH); } catch (e) {}
      if (typeof USER_CONFIG !== 'undefined' && USER_CONFIG !== null) {
        if (typeof USER_CONFIG.selectedColorIndex === 'number') savedConfig.selectedColorIndex = USER_CONFIG.selectedColorIndex;
        if (typeof USER_CONFIG.bgThemeFile === 'string') savedConfig.bgThemeFile = USER_CONFIG.bgThemeFile;
        if (typeof USER_CONFIG.lastThemeScript === 'string') savedConfig.lastThemeScript = USER_CONFIG.lastThemeScript;
        log('Loaded config from JS include -> ' + CONFIG_JS_PATH);
        return;
      }
    } catch (e) {}

    // 2) Try JSON file
    try {
      var txt = tryReadFile(CONFIG_JSON_PATH);
      if (txt) {
        try {
          var parsed = JSON.parse(txt);
          if (parsed) {
            if (typeof parsed.selectedColorIndex === 'number') savedConfig.selectedColorIndex = parsed.selectedColorIndex;
            if (typeof parsed.bgThemeFile === 'string') savedConfig.bgThemeFile = parsed.bgThemeFile;
            if (typeof parsed.lastThemeScript === 'string') savedConfig.lastThemeScript = parsed.lastThemeScript;
            log('Loaded config from JSON -> ' + CONFIG_JSON_PATH);
            return;
          }
        } catch (e) {}
      }
    } catch (e) {}

    // 3) Try localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem('pxmod_config');
        if (raw) {
          try {
            var p = JSON.parse(raw);
            if (p) {
              if (typeof p.selectedColorIndex === 'number') savedConfig.selectedColorIndex = p.selectedColorIndex;
              if (typeof p.bgThemeFile === 'string') savedConfig.bgThemeFile = p.bgThemeFile;
              if (typeof p.lastThemeScript === 'string') savedConfig.lastThemeScript = p.lastThemeScript;
              log('Loaded config from localStorage (pxmod_config)');
              return;
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    log('No config file found; using defaults.');
  }

  function saveConfig() {
    var toSave = {
      selectedColorIndex: savedConfig.selectedColorIndex,
      bgThemeFile: savedConfig.bgThemeFile,
      lastThemeScript: savedConfig.lastThemeScript
    };
    var json = JSON.stringify(toSave, null, 2);

    // Prefer writing JS file (so include() will load it next startup)
    var jsContent = 'var USER_CONFIG = ' + json + ';';
    var written = tryWriteFile(CONFIG_JS_PATH, jsContent);
    if (written) return true;

    // Fallback to JSON
    written = tryWriteFile(CONFIG_JSON_PATH, json);
    if (written) return true;

    // Fallback to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pxmod_config', json);
        log('Saved config to localStorage (pxmod_config)');
        return true;
      }
    } catch (e) {}

    log('WARNING: Could not save config automatically. To persist settings create a file at:');
    log('  ' + CONFIG_JS_PATH + '  with contents like:');
    log('  var USER_CONFIG = { selectedColorIndex: ' + savedConfig.selectedColorIndex + ', bgThemeFile: ' + (savedConfig.bgThemeFile ? "'" + savedConfig.bgThemeFile + "'" : 'null') + ', lastThemeScript: ' + (savedConfig.lastThemeScript ? "'" + savedConfig.lastThemeScript + "'" : 'null') + ' };');
    return false;
  }
  // ---------------- End persistence helpers ------------------

  // Load config immediately (before creating styles and UI)
  try {
    loadConfig();
  } catch (e) {
    log('Error loading saved config: ' + e.message);
  }

  // Ensure colorCurrentIndex uses saved value (clamped)
  if (typeof savedConfig.selectedColorIndex === 'number' && savedConfig.selectedColorIndex >= 0 && savedConfig.selectedColorIndex < colors.length) {
    colorCurrentIndex = savedConfig.selectedColorIndex;
  } else {
    colorCurrentIndex = 0;
  }

  jsmaf.root.children.length = 0;

  // Base styles
  new Style({
    name: 'white',
    color: 'white',
    size: 24
  });
  new Style({
    name: 'title',
    color: 'white',
    size: 32
  });
  // Create colorPreviewStyle using the saved color so previews reflect saved value
  colorPreviewStyle = new Style({
    name: 'colorPreview',
    color: colors[colorCurrentIndex].color,
    size: 72
  });

  // Store a reference to the selected-text style so we can change its color
  var selectedTextStyle = new Style({
    name: 'selectedText',
    color: colors[colorCurrentIndex].color,
    size: 24
  });

  // ------------------ Music (persistent) ------------------
  var audio = null;
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG.music) {
      if (typeof jsmaf !== 'undefined') {
        if (!jsmaf._pxmod_audio) {
          try {
            jsmaf._pxmod_audio = new jsmaf.AudioClip();
            jsmaf._pxmod_audio.volume = 0.5;
            try { jsmaf._pxmod_audio.open('file://../download0/sfx/bgm.wav'); } catch (e) { /* fallback path or ignore */ }
            jsmaf._pxmod_audio.loop = true;
            try { jsmaf._pxmod_audio.play(); } catch (e) {}
            log('Music: created persistent audio instance.');
          } catch (e) {
            log('Music: failed to create audio instance: ' + e.message);
          }
        } else {
          try {
            jsmaf._pxmod_audio.volume = jsmaf._pxmod_audio.volume || 0.5;
            jsmaf._pxmod_audio.loop = true;
            try { jsmaf._pxmod_audio.play(); } catch (e) {}
            log('Music: reused existing audio instance.');
          } catch (e) {
            log('Music: error while reusing audio instance: ' + e.message);
          }
        }
        audio = jsmaf._pxmod_audio;
      } else {
        if (typeof AudioClip !== 'undefined' && !window._pxmod_audio) {
          try {
            window._pxmod_audio = new AudioClip();
            window._pxmod_audio.volume = 0.5;
            try { window._pxmod_audio.open('file://../download0/sfx/bgm.wav'); } catch (e) {}
            window._pxmod_audio.loop = true;
            try { window._pxmod_audio.play(); } catch (e) {}
            audio = window._pxmod_audio;
            log('Music: created global audio instance.');
          } catch (e) {
            log('Music: failed to create global audio: ' + e.message);
          }
        } else if (typeof window !== 'undefined' && window._pxmod_audio) {
          audio = window._pxmod_audio;
          try { audio.play(); } catch (e) {}
          log('Music: reused global audio instance.');
        }
      }
    } else {
      log('Music disabled by CONFIG.music (or CONFIG undefined).');
    }
  } catch (e) {
    log('Music setup error: ' + e.message);
  }
  // ---------------- End music ------------------

  // Background
  var background = new Image({
    url: 'file:///../download0/img/multiview_bg_VAF.png',
    x: 0,
    y: 0,
    width: 1920,
    height: 1080
  });
  jsmaf.root.children.push(background);

  // If saved bg theme exists, apply it
  if (savedConfig.bgThemeFile) {
    try {
      background.url = 'file:///../download0/PxMod/Bg-Themes/' + savedConfig.bgThemeFile;
    } catch (e) {
      log('Failed to apply saved background: ' + e.message);
    }
  }

  var centerX = 960;

  // Menu options – added "Change Text Color" after "Bg Themes"
  var menuOptions = [{
    label: lang.jailbreak,
    script: 'loader.js',
    imgKey: 'jailbreak'
  }, {
    label: lang.payloadMenu,
    script: 'payload_host.js',
    imgKey: 'payloadMenu'
  }, {
    label: lang.config,
    script: 'config_ui.js',
    imgKey: 'config'
  }, {
    label: lang.themes || "Themes",
    script: 'Themes.js',
    imgKey: 'themes'
  }, {
    label: "Bg Themes",
    script: 'BgThemes.js',
    imgKey: 'bgThemes'
  }, {
    label: "Change Text Color",    // new option
    script: 'textColor',
    imgKey: 'textColor'
  }, {
    label: lang.fileExplorer || "File Explorer",
    script: 'file-explorer.js',
    imgKey: 'fileExplorer'
  }, {
    label: lang.exit,
    script: 'exit',
    imgKey: 'exit'
  }];

  // Insertion helper
  var clampIndex = function (idx) {
    if (typeof idx !== 'number' || isNaN(idx)) idx = jsmaf.root.children.length;
    idx = Math.max(0, Math.min(jsmaf.root.children.length, Math.floor(idx)));
    return idx;
  };
  var insertIndex = clampIndex(listInsertIndex);

  var insertChild = function (child) {
    if (Array.isArray(jsmaf.root.children)) {
      jsmaf.root.children.splice(insertIndex, 0, child);
      insertIndex++;
    } else {
      jsmaf.root.children.push(child);
    }
  };

  // PsVue image
  var psVueImage = new Image({
    url: 'file://../download0/PxMod/PsVue.png',
    x: 50,
    y: 50,
    width: 419,
    height: 130
  });
  insertChild(psVueImage);

  // Create buttons and texts
  for (var i = 0; i < menuOptions.length; i++) {
    var btnX = centerX - buttonWidth / 2 + listOffsetX;
    var btnY = startY + i * buttonSpacing + listOffsetY;

    var button = new Image({
      url: normalButtonImg,
      x: btnX,
      y: btnY,
      width: buttonWidth,
      height: buttonHeight
    });
    button.alpha = 0;
    buttons.push(button);
    insertChild(button);

    var btnText = new jsmaf.Text();
    btnText.text = menuOptions[i].label;
    btnText.x = btnX + textLeftPadding;
    btnText.y = btnY + (buttonHeight / 2 - 12);
    btnText.style = 'white';
    buttonTexts.push(btnText);
    insertChild(btnText);

    buttonOrigPos.push({ x: btnX, y: btnY });
    textOrigPos.push({ x: btnText.x, y: btnText.y });
  }

  // Selection indicator (X image)
  var xImage = new Image({
    url: 'file://../download0/PxMod/X.png',
    x: 0,
    y: 0,
    width: 30,
    height: 30
  });
  jsmaf.root.children.push(xImage);

  var prevButton = -1;

  function updateHighlight() {
    if (prevButton >= 0 && prevButton !== currentButton) {
      var prevText = buttonTexts[prevButton];
      if (prevText) prevText.style = 'white';
    }
    var curText = buttonTexts[currentButton];
    if (curText) curText.style = 'selectedText';

    var curButton = buttons[currentButton];
    if (curButton && curText && xImage) {
      var textWidth = curText.text.length * 15;
      xImage.x = curText.x + textWidth + 5;
      xImage.y = curButton.y + (buttonHeight / 2) - (xImage.height / 2);
    }
    prevButton = currentButton;
  }

  function moveSelection(delta) {
    currentButton = (currentButton + delta + buttons.length) % buttons.length;
    updateHighlight();
  }

  var keyIntervals = {};

  // ----- Themes gallery functions -----
  function enterGallery() {
    if (inGallery) return;
    inGallery = true;
    xImage.alpha = 0;

    var imageWidth = 700;
    var imageHeight = 400;
    var baseX = 960 - imageWidth / 2;
    var baseY = 200;
    var iconSize = 30;

    themeImage = new Image({
      url: 'file://../download0/PxMod/Themes/' + themes[0].file,
      x: baseX,
      y: baseY,
      width: imageWidth,
      height: imageHeight
    });
    galleryElements.push(themeImage);

    var labelY = baseY - 40;
    var prevText = new jsmaf.Text();
    prevText.text = 'Previous';
    prevText.x = baseX;
    prevText.y = labelY;
    prevText.style = 'white';
    galleryElements.push(prevText);

    var l2Icon = new Image({
      url: 'file://../download0/PxMod/L2.png',
      x: baseX + 100,
      y: labelY,
      width: iconSize,
      height: iconSize
    });
    galleryElements.push(l2Icon);

    var forwardText = new jsmaf.Text();
    forwardText.text = 'Forward';
    forwardText.style = 'white';
    var forwardTextWidth = 7 * 15;
    forwardText.x = baseX + imageWidth - (forwardTextWidth + iconSize + 15);
    forwardText.y = labelY;
    galleryElements.push(forwardText);

    var r2Icon = new Image({
      url: 'file://../download0/PxMod/R2.png',
      x: forwardText.x + forwardTextWidth + 5,
      y: labelY,
      width: iconSize,
      height: iconSize
    });
    galleryElements.push(r2Icon);

    infoText = new jsmaf.Text();
    infoText.text = themes[0].name;
    infoText.x = baseX;
    infoText.y = baseY + imageHeight + 30;
    infoText.style = 'white';
    galleryElements.push(infoText);

    var closeTextWidth = 5 * 15;
    closeText = new jsmaf.Text();
    closeText.text = 'Close';
    closeText.x = baseX + imageWidth - 300;
    closeText.y = baseY + imageHeight + 30;
    closeText.style = 'white';
    galleryElements.push(closeText);

    oIcon = new Image({
      url: 'file://../download0/PxMod/O.png',
      x: closeText.x + closeTextWidth + 5,
      y: closeText.y,
      width: iconSize,
      height: iconSize
    });
    galleryElements.push(oIcon);

    var applyTextWidth = 5 * 15;
    applyText = new jsmaf.Text();
    applyText.text = 'Apply';
    applyText.x = baseX + imageWidth - 150;
    applyText.y = baseY + imageHeight + 30;
    applyText.style = 'white';
    galleryElements.push(applyText);

    xIcon = new Image({
      url: 'file://../download0/PxMod/X.png',
      x: applyText.x + applyTextWidth + 5,
      y: applyText.y,
      width: iconSize,
      height: iconSize
    });
    galleryElements.push(xIcon);

    for (var i = 0; i < galleryElements.length; i++) {
      jsmaf.root.children.push(galleryElements[i]);
    }
    galleryCurrentIndex = 0;
  }

  function exitGallery() {
    if (!inGallery) return;
    inGallery = false;
    for (var i = 0; i < galleryElements.length; i++) {
      var idx = jsmaf.root.children.indexOf(galleryElements[i]);
      if (idx !== -1) jsmaf.root.children.splice(idx, 1);
    }
    galleryElements = [];
    xImage.alpha = 1;
    updateHighlight();
  }

  function scrollGallery(delta) {
    if (!inGallery) return;
    var newIndex = galleryCurrentIndex + delta;
    if (newIndex < 0) newIndex = themes.length - 1;
    if (newIndex >= themes.length) newIndex = 0;
    galleryCurrentIndex = newIndex;
    var theme = themes[galleryCurrentIndex];
    themeImage.url = 'file://../download0/PxMod/Themes/' + theme.file;
    infoText.text = theme.name;
  }

  function applyTheme() {
    if (!inGallery) return;
    var theme = themes[galleryCurrentIndex];
    exitGallery();
    try {
      include(theme.script);
      // persist last applied theme
      savedConfig.lastThemeScript = theme.script;
      saveConfig();
    } catch (e) {
      log('ERROR loading theme script: ' + e.message);
    }
  }

  // ----- Bg Themes gallery functions -----
  function enterBgGallery() {
    if (inBgGallery) return;
    inBgGallery = true;
    xImage.alpha = 0;

    var imageWidth = 700;
    var imageHeight = 400;
    var baseX = 960 - imageWidth / 2;
    var baseY = 200;
    var iconSize = 30;

    bgImagePreview = new Image({
      url: 'file://../download0//PxMod/Bg-Themes/' + bgThemes[0].file,
      x: baseX,
      y: baseY,
      width: imageWidth,
      height: imageHeight
    });
    bgGalleryElements.push(bgImagePreview);

    var labelY = baseY - 40;
    var prevText = new jsmaf.Text();
    prevText.text = 'Previous';
    prevText.x = baseX;
    prevText.y = labelY;
    prevText.style = 'white';
    bgGalleryElements.push(prevText);

    var l2Icon = new Image({
      url: 'file://../download0/PxMod/L2.png',
      x: baseX + 100,
      y: labelY,
      width: iconSize,
      height: iconSize
    });
    bgGalleryElements.push(l2Icon);

    var forwardText = new jsmaf.Text();
    forwardText.text = 'Forward';
    forwardText.style = 'white';
    var forwardTextWidth = 7 * 15;
    forwardText.x = baseX + imageWidth - (forwardTextWidth + iconSize + 15);
    forwardText.y = labelY;
    bgGalleryElements.push(forwardText);

    var r2Icon = new Image({
      url: 'file://../download0/PxMod/R2.png',
      x: forwardText.x + forwardTextWidth + 5,
      y: labelY,
      width: iconSize,
      height: iconSize
    });
    bgGalleryElements.push(r2Icon);

    bgInfoText = new jsmaf.Text();
    bgInfoText.text = bgThemes[0].name;
    bgInfoText.x = baseX;
    bgInfoText.y = baseY + imageHeight + 30;
    bgInfoText.style = 'white';
    bgGalleryElements.push(bgInfoText);

    var closeTextWidth = 5 * 15;
    bgCloseText = new jsmaf.Text();
    bgCloseText.text = 'Close';
    bgCloseText.x = baseX + imageWidth - 300;
    bgCloseText.y = baseY + imageHeight + 30;
    bgCloseText.style = 'white';
    bgGalleryElements.push(bgCloseText);

    bgOIcon = new Image({
      url: 'file://../download0/PxMod/O.png',
      x: bgCloseText.x + closeTextWidth + 5,
      y: bgCloseText.y,
      width: iconSize,
      height: iconSize
    });
    bgGalleryElements.push(bgOIcon);

    var applyTextWidth = 5 * 15;
    bgApplyText = new jsmaf.Text();
    bgApplyText.text = 'Apply';
    bgApplyText.x = baseX + imageWidth - 150;
    bgApplyText.y = baseY + imageHeight + 30;
    bgApplyText.style = 'white';
    bgGalleryElements.push(bgApplyText);

    bgXIcon = new Image({
      url: 'file://../download0/PxMod/X.png',
      x: bgApplyText.x + applyTextWidth + 5,
      y: bgApplyText.y,
      width: iconSize,
      height: iconSize
    });
    bgGalleryElements.push(bgXIcon);

    for (var i = 0; i < bgGalleryElements.length; i++) {
      jsmaf.root.children.push(bgGalleryElements[i]);
    }
    bgGalleryCurrentIndex = 0;
  }

  function exitBgGallery() {
    if (!inBgGallery) return;
    inBgGallery = false;
    for (var i = 0; i < bgGalleryElements.length; i++) {
      var idx = jsmaf.root.children.indexOf(bgGalleryElements[i]);
      if (idx !== -1) jsmaf.root.children.splice(idx, 1);
    }
    bgGalleryElements = [];
    xImage.alpha = 1;
    updateHighlight();
  }

  function scrollBgGallery(delta) {
    if (!inBgGallery) return;
    var newIndex = bgGalleryCurrentIndex + delta;
    if (newIndex < 0) newIndex = bgThemes.length - 1;
    if (newIndex >= bgThemes.length) newIndex = 0;
    bgGalleryCurrentIndex = newIndex;
    var bg = bgThemes[bgGalleryCurrentIndex];
    bgImagePreview.url = 'file://../download0/PxMod//Bg-Themes/' + bg.file;
    bgInfoText.text = bg.name;
  }

  function applyBgTheme() {
    if (!inBgGallery) return;
    var bg = bgThemes[bgGalleryCurrentIndex];
    background.url = 'file:///../download0/PxMod/Bg-Themes/' + bg.file;
    // persist chosen bg
    savedConfig.bgThemeFile = bg.file;
    saveConfig();
    exitBgGallery();
  }

  // ----- NEW Color gallery functions -----
  function enterColorGallery() {
    if (inColorGallery) return;
    inColorGallery = true;
    xImage.alpha = 0;

    var imageWidth = 700;      // not used for image but for layout consistency
    var imageHeight = 400;
    var baseX = 960 - imageWidth / 2;
    var baseY = 200;
    var iconSize = 30;

    // Large sample text that will change color
    colorSampleText = new jsmaf.Text();
    colorSampleText.text = 'Selected Text';
    colorSampleText.x = baseX;
    colorSampleText.y = baseY + 100;  // centered roughly
    colorSampleText.style = 'colorPreview';  // uses the preview style
    colorGalleryElements.push(colorSampleText);

    // Navigation indicators (same as in other galleries)
    var labelY = baseY - 40;
    var prevText = new jsmaf.Text();
    prevText.text = 'Previous';
    prevText.x = baseX;
    prevText.y = labelY;
    prevText.style = 'white';
    colorGalleryElements.push(prevText);

    var l2Icon = new Image({
      url: 'file://../download0/PxMod/L2.png',
      x: baseX + 100,
      y: labelY,
      width: iconSize,
      height: iconSize
    });
    colorGalleryElements.push(l2Icon);

    var forwardText = new jsmaf.Text();
    forwardText.text = 'Forward';
    forwardText.style = 'white';
    var forwardTextWidth = 7 * 15;
    forwardText.x = baseX + imageWidth - (forwardTextWidth + iconSize + 15);
    forwardText.y = labelY;
    colorGalleryElements.push(forwardText);

    var r2Icon = new Image({
      url: 'file://../download0/PxMod/R2.png',
      x: forwardText.x + forwardTextWidth + 5,
      y: labelY,
      width: iconSize,
      height: iconSize
    });
    colorGalleryElements.push(r2Icon);

    // Color name display
    colorInfoText = new jsmaf.Text();
    colorInfoText.text = colors[colorCurrentIndex].name;
    colorInfoText.x = baseX;
    colorInfoText.y = baseY + imageHeight + 30;
    colorInfoText.style = 'white';
    colorGalleryElements.push(colorInfoText);

    // Close button (O)
    var closeTextWidth = 5 * 15;
    colorCloseText = new jsmaf.Text();
    colorCloseText.text = 'Close';
    colorCloseText.x = baseX + imageWidth - 300;
    colorCloseText.y = baseY + imageHeight + 30;
    colorCloseText.style = 'white';
    colorGalleryElements.push(colorCloseText);

    colorOIcon = new Image({
      url: 'file://../download0/PxMod/O.png',
      x: colorCloseText.x + closeTextWidth + 5,
      y: colorCloseText.y,
      width: iconSize,
      height: iconSize
    });
    colorGalleryElements.push(colorOIcon);

    // Apply button (X)
    var applyTextWidth = 5 * 15;
    colorApplyText = new jsmaf.Text();
    colorApplyText.text = 'Apply';
    colorApplyText.x = baseX + imageWidth - 150;
    colorApplyText.y = baseY + imageHeight + 30;
    colorApplyText.style = 'white';
    colorGalleryElements.push(colorApplyText);

    colorXIcon = new Image({
      url: 'file://../download0/PxMod/X.png',
      x: colorApplyText.x + applyTextWidth + 5,
      y: colorApplyText.y,
      width: iconSize,
      height: iconSize
    });
    colorGalleryElements.push(colorXIcon);

    // Add all elements to root
    for (var i = 0; i < colorGalleryElements.length; i++) {
      jsmaf.root.children.push(colorGalleryElements[i]);
    }

    // Ensure preview style matches saved/current color
    if (colorPreviewStyle) colorPreviewStyle.color = colors[colorCurrentIndex].color;
    if (colorInfoText) colorInfoText.text = colors[colorCurrentIndex].name;
  }

  function exitColorGallery() {
    if (!inColorGallery) return;
    inColorGallery = false;
    for (var i = 0; i < colorGalleryElements.length; i++) {
      var idx = jsmaf.root.children.indexOf(colorGalleryElements[i]);
      if (idx !== -1) jsmaf.root.children.splice(idx, 1);
    }
    colorGalleryElements = [];
    xImage.alpha = 1;
    updateHighlight();
  }

  function scrollColorGallery(delta) {
    if (!inColorGallery) return;
    var newIndex = colorCurrentIndex + delta;
    if (newIndex < 0) newIndex = colors.length - 1;
    if (newIndex >= colors.length) newIndex = 0;
    colorCurrentIndex = newIndex;

    var col = colors[colorCurrentIndex];
    // Update the preview style – this changes the large sample text color
    if (colorPreviewStyle) colorPreviewStyle.color = col.color;
    // Update the displayed color name
    if (colorInfoText) colorInfoText.text = col.name;
  }

  function applyColor() {
    if (!inColorGallery) return;
    var col = colors[colorCurrentIndex];
    // Change the actual selected-text style used in the main menu
    selectedTextStyle.color = col.color;
    // Immediately update the currently highlighted button text
    if (buttonTexts[currentButton]) {
      // Re-applying the style name forces a refresh
      buttonTexts[currentButton].style = 'selectedText';
    }
    // persist chosen color index
    savedConfig.selectedColorIndex = colorCurrentIndex;
    saveConfig();

    exitColorGallery();
  }

  // ----- Key handling (updated for galleries) -----
  jsmaf.onKeyDown = function (keyCode) {
    if (inGallery) {
      if (keyCode === 9) scrollGallery(1);
      else if (keyCode === 8) scrollGallery(-1);
      else if (keyCode === 13) exitGallery();
      else if (keyCode === 14) applyTheme();
      return;
    }
    if (inBgGallery) {
      if (keyCode === 9) scrollBgGallery(1);
      else if (keyCode === 8) scrollBgGallery(-1);
      else if (keyCode === 13) exitBgGallery();
      else if (keyCode === 14) applyBgTheme();
      return;
    }
    if (inColorGallery) {
      if (keyCode === 9) scrollColorGallery(1);
      else if (keyCode === 8) scrollColorGallery(-1);
      else if (keyCode === 13) exitColorGallery();
      else if (keyCode === 14) applyColor();
      return;
    }

    // Normal menu navigation
    if (keyCode === 6 || keyCode === 5) {
      if (!keyIntervals[keyCode]) {
        moveSelection(1);
        keyIntervals[keyCode] = setInterval(function() {
          moveSelection(1);
        }, 150);
      }
    } else if (keyCode === 4 || keyCode === 7) {
      if (!keyIntervals[keyCode]) {
        moveSelection(-1);
        keyIntervals[keyCode] = setInterval(function() {
          moveSelection(-1);
        }, 150);
      }
    } else if (keyCode === 14) {
      handleButtonPress();
    }
  };

  jsmaf.onKeyUp = function (keyCode) {
    if (keyCode === 6 || keyCode === 5 || keyCode === 4 || keyCode === 7) {
      if (keyIntervals[keyCode]) {
        clearInterval(keyIntervals[keyCode]);
        delete keyIntervals[keyCode];
      }
    }
  };

  function handleButtonPress() {
    var selectedOption = menuOptions[currentButton];
    if (!selectedOption) return;

    if (selectedOption.script === 'exit') {
      log('Exiting application...');
      try {
        if (typeof libc_addr === 'undefined') {
          include('userland.js');
        }
        fn.register(0x14, 'getpid', [], 'bigint');
        fn.register(0x25, 'kill', ['bigint', 'bigint'], 'bigint');
        var pid = fn.getpid();
        var pid_num = pid instanceof BigInt ? pid.lo : pid;
        fn.kill(pid, new BigInt(0, 9));
      } catch (e) {
        log('ERROR during exit: ' + e.message);
      }
      jsmaf.exit();
      return;
    }
    if (selectedOption.script === 'Themes.js') {
      enterGallery();
      return;
    }
    if (selectedOption.script === 'BgThemes.js') {
      enterBgGallery();
      return;
    }
    if (selectedOption.script === 'textColor') {
      enterColorGallery();
      return;
    }

    if (selectedOption.script === 'loader.js') {
      jsmaf.onKeyDown = function () {};
    }
    log('Loading ' + selectedOption.script + '...');
    try {
      include(selectedOption.script);
    } catch (e) {
      log('ERROR loading ' + selectedOption.script + ': ' + e.message);
    }
  }

  updateHighlight();
  log(lang.mainMenuLoaded);
})();
