(function () {
  // ==================== INITIALIZATION ====================
  include('languages.js');
  log(lang.loadingMainMenu);

  // ==================== GLOBAL VARIABLES ====================
  var currentButton = 0;
  var prevButton = -1;
  var buttonTexts = [];
  var highlightImages = [];
  var textOrigPos = [];
  var highlightOrigPos = [];
  var textSizes = [];

  // Highlight image settings (now dynamic)
  var highlightSize = {
    width: 450,
    height: 65
  };
  var hoverBase = 'file:///../download0/themes/RE9/Data/Over11/Over_Hover_';
  var availableHoverIndices = [];
  var desiredHoverIndex = 1;
  var currentHoverIndexPos = 0;

  // Zoom variables
  var zoomInInterval = null;
  var zoomOutInterval = null;

  // ==================== CONFIGURATION MANAGEMENT ====================
  var configPath = 'file://../download0/config.json';
  var configData = {
    config: {
      music: true,
      background: 1,
      logo: 1,
      hover: 1,
      // new fields for auto BG
      auto_bg: false,
      bg_delay: 10
    },
    payloads: []
  };
  var configLoaded = false;

  // File I/O using jsmaf.XMLHttpRequest (uses configPath)
  var fs = {
    write: function (filename, content, callback) {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && callback) {
          callback(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed'));
        }
      };
      xhr.open('POST', filename, true);
      xhr.send(content);
    },
    read: function (filename, callback) {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && callback) {
          callback(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed'), xhr.responseText);
        }
      };
      xhr.open('GET', filename, true);
      xhr.send();
    }
  };

  function ensureConfigFields(cfg) {
    var changed = false;
    if (cfg.config.background === undefined) {
      cfg.config.background = 1; changed = true;
    }
    if (cfg.config.logo === undefined) {
      cfg.config.logo = 1; changed = true;
    }
    if (cfg.config.music === undefined) {
      cfg.config.music = true; changed = true;
    }
    if (cfg.config.hover === undefined) {
      cfg.config.hover = 1; changed = true;
    }
    if (cfg.config.auto_bg === undefined) {
      cfg.config.auto_bg = false; changed = true;
    }
    if (cfg.config.bg_delay === undefined) {
      cfg.config.bg_delay = 10; changed = true;
    }
    // validate bg_delay into allowed list
    var allowed = [1,2,3,5,10,20,25,30,45,60];
    if (typeof cfg.config.bg_delay !== 'number' || allowed.indexOf(cfg.config.bg_delay) === -1) {
      cfg.config.bg_delay = 10;
      changed = true;
    }
  }

  function loadConfig(callback) {
    fs.read(configPath, function (err, data) {
      if (err) {
        log('Config not found, using defaults.');
        ensureConfigFields(configData);
        if (callback) callback(configData);
        return;
      }
      try {
        var parsed = JSON.parse(data || '{}');
        if (parsed.config) {
          configData.config = parsed.config;
          configData.payloads = parsed.payloads || [];
        }
        ensureConfigFields(configData);
        log('Config loaded successfully.');
      } catch (e) {
        log('Error parsing config: ' + e.message + ', using defaults.');
        ensureConfigFields(configData);
      }
      if (callback) callback(configData);
    });
  }

  function saveConfig() {
    if (!configLoaded) {
      log('Config not fully loaded yet, deferring save.');
      return;
    }
    var content = JSON.stringify(configData, null, 2);
    fs.write(configPath, content, function (err) {
      if (err) log('Error saving config: ' + err.message);
      else log('Config saved.');
    });
  }

  // ==================== ROBUST GLOBAL MUSIC (fixed & retrying) ====================
  if (typeof jsmaf.bgm === 'undefined') {
    jsmaf.bgm = null;
  }

  function createBgm() {
    try {
      jsmaf.bgm = new jsmaf.AudioClip();
      try { jsmaf.bgm.volume = 0.5; } catch (e) {}
      if (typeof jsmaf.bgm.open === 'function') {
        try {
          jsmaf.bgm.open('file:///../download0/themes/RE9/Data/Song/Song_Over8.wav');
          jsmaf.bgm.opened = true;
        } catch (e) {
          jsmaf.bgm.opened = false;
          log('bgm.open initial attempt failed: ' + e.message);
        }
      } else {
        jsmaf.bgm.opened = false;
      }
    } catch (e) {
      log('createBgm error: ' + e.message);
      jsmaf.bgm = null;
    }
    return jsmaf.bgm;
  }

  function tryPlayBgm(retries) {
    retries = retries || 0;
    var maxRetries = 8;
    try {
      if (!jsmaf.bgm) createBgm();
      var _bgm = jsmaf.bgm;
      if (!_bgm) return;
      if (typeof _bgm.volume !== 'undefined') {
        try { _bgm.volume = 0.5; } catch (e) {}
      }
      if (typeof _bgm.stop === 'function') {
        try { _bgm.stop(); } catch (e) {}
      }
      if (typeof _bgm.play === 'function') {
        try {
          _bgm.play(true);
          return;
        } catch (ePlay) {
          log('bgm.play attempt failed (try ' + retries + '): ' + ePlay.message);
        }
      } else {
        log('bgm.play not available on instance (try ' + retries + ')');
      }
    } catch (e) {
      log('tryPlayBgm unexpected error: ' + e.message);
    }

    if (retries < maxRetries) {
      jsmaf.setTimeout(function () {
        try {
          if (jsmaf.bgm && !jsmaf.bgm.opened && typeof jsmaf.bgm.open === 'function') {
            try {
              jsmaf.bgm.open('file:///../download0/themes/RE9/Data/Song/Song_Over8.wav');
              jsmaf.bgm.opened = true;
            } catch (eOpen) {
              log('bgm.open retry failed: ' + eOpen.message);
            }
          }
          if (!jsmaf.bgm || typeof jsmaf.bgm.play !== 'function') {
            createBgm();
          }
        } catch (e) {
          log('retry setup error: ' + e.message);
        }
        tryPlayBgm(retries + 1);
      }, 150);
    } else {
      log('bgm: reached max retries, giving up until next toggle.');
    }
  }

  function applyMusicSetting() {
    try {
      if (!configData.config.music) {
        if (jsmaf.bgm) {
          try { if (typeof jsmaf.bgm.stop === 'function') jsmaf.bgm.stop(); } catch (e) {}
          try { if (typeof jsmaf.bgm.close === 'function') jsmaf.bgm.close(); } catch (e) {}
          try { jsmaf.bgm.opened = false; } catch (e) {}
        }
        return;
      }
      // turn on
      if (!jsmaf.bgm || typeof jsmaf.bgm.play !== 'function') {
        createBgm();
      } else if (!jsmaf.bgm.opened && typeof jsmaf.bgm.open === 'function') {
        try { jsmaf.bgm.open('file:///../download0/themes/RE9/Data/Song/Song_Over8.wav'); jsmaf.bgm.opened = true; } catch (e) { log('applyMusicSetting reopen failed: ' + e.message); }
      }
      tryPlayBgm(0);
    } catch (e) {
      log('applyMusicSetting error: ' + e.message);
    }
  }

  // ==================== DYNAMIC BACKGROUND, LOGO & HOVER ====================
  var bgBase = 'file:///../download0/themes/RE9/Data/Bg/IMG_OVER_';
  var logoBase = 'file:///../download0/themes/RE9/Data/Logo/LOGO_';
  var availableBgIndices = [];
  var availableLogoIndices = [];
  var currentBgIndexPos = 0;
  var currentLogoIndexPos = 0;
  var bgImageObj = null;
  var logoImageObj = null;
  var MAX_CHECK = 200;

  // Preload images to know what's available for switching lol
  function preloadImages(base, ext, targetArray) {
    for (var i = 1; i <= MAX_CHECK; i++) {
      (function (idx) {
        var url = base + idx + ext;
        var img = new Image();
        img.onload = function () {
          if (targetArray.indexOf(idx) === -1) {
            targetArray.push(idx);
            targetArray.sort(function(a, b) { return a - b; });
          }
        };
        img.onerror = function () { };
        img.src = url;
      })(i);
    }
  }

  preloadImages(bgBase, '.jpeg', availableBgIndices);
  preloadImages(logoBase, '.png', availableLogoIndices);
  preloadImages(hoverBase, '.png', availableHoverIndices);

  var desiredBgIndex = 1;
  var desiredLogoIndex = 1;

  function setBackgroundImage(index) {
    var url = bgBase + index + '.jpeg';
    bgImageObj.url = url;
    bgImageObj.onerror = function() {
      if (availableBgIndices.length > 0) {
        bgImageObj.url = bgBase + availableBgIndices[0] + '.jpeg';
        configData.config.background = availableBgIndices[0];
        desiredBgIndex = availableBgIndices[0];
      } else {
        bgImageObj.url = bgBase + '1.jpeg';
      }
    };
  }

  function setLogoImage(index) {
    var url = logoBase + index + '.png';
    logoImageObj.url = url;
    logoImageObj.onerror = function() {
      if (availableLogoIndices.length > 0) {
        logoImageObj.url = logoBase + availableLogoIndices[0] + '.png';
        configData.config.logo = availableLogoIndices[0];
        desiredLogoIndex = availableLogoIndices[0];
      } else {
        logoImageObj.url = logoBase + '1.png';
      }
    };
  }

  function setHoverImage(index) {
    var url = hoverBase + index + '.png';
    for (var i = 0; i < highlightImages.length; i++) {
      highlightImages[i].url = url;
    }
    if (highlightImages.length > 0) {
      highlightImages[0].onerror = function() {
        if (availableHoverIndices.length > 0) {
          var fallbackIndex = availableHoverIndices[0];
          for (var j = 0; j < highlightImages.length; j++) {
            highlightImages[j].url = hoverBase + fallbackIndex + '.png';
          }
          configData.config.hover = fallbackIndex;
          desiredHoverIndex = fallbackIndex;
        }
      };
    }
  }

  // ==================== AUTO BG HANDLING ====================
  var autoBgInterval = null;
  var allowedBgDelays = [1,2,3,5,10,20,25,30,45,60];

  function waitForBgIndices(callback, maxWaitMs) {
    maxWaitMs = typeof maxWaitMs === 'number' ? maxWaitMs : 3000;
    var intervalMs = 150;
    var tries = Math.ceil(maxWaitMs / intervalMs);
    var attempts = 0;
    var waiter = jsmaf.setInterval(function () {
      attempts++;
      if (availableBgIndices && availableBgIndices.length > 0) {
        jsmaf.clearInterval(waiter);
        if (callback) callback(true);
        return;
      }
      if (attempts >= tries) {
        jsmaf.clearInterval(waiter);
        if (callback) callback(false);
      }
    }, intervalMs);
  }

  function startAutoBg() {
    stopAutoBg();
    if (!configData.config.auto_bg) return;
    var delay = allowedBgDelays.indexOf(configData.config.bg_delay) === -1 ? 10 : configData.config.bg_delay;

    function beginCycle() {
      if (!availableBgIndices || availableBgIndices.length === 0) {
        log('startAutoBg: no background images detected, auto-bg will not start.');
        return;
      }
      var idxList = availableBgIndices;
      var curIndex = idxList.indexOf(configData.config.background);
      if (curIndex === -1) {
        curIndex = 0;
        for (var i = 0; i < idxList.length; i++) {
          if (idxList[i] >= configData.config.background) { curIndex = i; break; }
        }
        configData.config.background = idxList[curIndex];
        setBackgroundImage(configData.config.background);
        saveConfig();
      }

      autoBgInterval = jsmaf.setInterval(function () {
        try {
          if (!idxList || idxList.length === 0) return;
          curIndex = (curIndex + 1) % idxList.length;
          configData.config.background = idxList[curIndex];
          setBackgroundImage(configData.config.background);
          saveConfig();
        } catch (e) {
          log('autoBgInterval error: ' + e.message);
        }
      }, delay * 1000);

      log('Auto BG started: cycling ' + idxList.length + ' images every ' + delay + ' seconds.');
    }

    if (availableBgIndices && availableBgIndices.length > 0) {
      beginCycle();
    } else {
      waitForBgIndices(function(found) {
        if (found) beginCycle();
        else log('startAutoBg: no backgrounds found after waiting');
      }, 4000);
    }
  }

  function stopAutoBg() {
    if (autoBgInterval) {
      jsmaf.clearInterval(autoBgInterval);
      autoBgInterval = null;
    }
  }

  // ==================== CLEAR EXISTING UI ====================
  jsmaf.root.children.length = 0;

  // ==================== STYLES ====================
  new Style({ name: 'menuText', color: 'white', size: 24 });

  // ==================== BACKGROUND IMAGE (initial) ====================
  bgImageObj = new Image({
    url: bgBase + '1.jpeg',
    x: 0, y: 0, width: 1920, height: 1080
  });
  jsmaf.root.children.push(bgImageObj);

  // ==================== MENU OPTIONS ====================
  var menuOptions = [
    { label: lang.jailbreak, script: 'loader.js', imgKey: 'jailbreak' },
    { label: lang.payloadMenu, script: 'payload_host.js', imgKey: 'payloadMenu' },
    { label: lang.config, script: 'config_ui.js', imgKey: 'config' },
    { label: lang.about || 'About', script: 'about.js', imgKey: 'about' }
  ];

  // ==================== POSITIONING ====================
  var listX = 230;
  var firstButtonY = 550;
  var lineHeight = 55;
  var fontSize = 24;

  function estimateTextWidth(text) {
    return text.length * fontSize * 0.6;
  }

  // ==================== CREATE BUTTONS ====================
  for (var i = 0; i < menuOptions.length; i++) {
    var label = menuOptions[i].label;
    var textX = listX;
    var textY = firstButtonY + i * lineHeight;

    var textObj = new jsmaf.Text();
    textObj.text = label;
    textObj.x = textX;
    textObj.y = textY;
    textObj.style = 'menuText';
    buttonTexts.push(textObj);

    var textWidth = estimateTextWidth(label);
    var textHeight = fontSize;
    textSizes.push({ width: textWidth, height: textHeight });

    var textCenterX = textX + textWidth / 2;
    var textCenterY = textY + textHeight / 2;

    var highlight = new Image({
      url: hoverBase + '1.png',
      x: textCenterX - highlightSize.width / 2,
      y: textCenterY - highlightSize.height / 2,
      width: highlightSize.width,
      height: highlightSize.height,
      visible: false
    });

    highlightImages.push(highlight);
    textOrigPos.push({ x: textX, y: textY });
    highlightOrigPos.push({ x: highlight.x, y: highlight.y });

    jsmaf.root.children.push(highlight);
    jsmaf.root.children.push(textObj);
  }

  // ==================== EXIT BUTTON ====================
  var exitLabel = lang.exit;
  var exitX = listX;
  var exitY = firstButtonY + menuOptions.length * lineHeight;

  var exitText = new jsmaf.Text();
  exitText.text = exitLabel;
  exitText.x = exitX;
  exitText.y = exitY;
  exitText.style = 'menuText';
  buttonTexts.push(exitText);

  var exitTextWidth = estimateTextWidth(exitLabel);
  var exitTextHeight = fontSize;
  textSizes.push({ width: exitTextWidth, height: exitTextHeight });

  var exitCenterX = exitX + exitTextWidth / 2;
  var exitCenterY = exitY + exitTextHeight / 2;

  var exitHighlight = new Image({
    url: hoverBase + '1.png',
    x: exitCenterX - highlightSize.width / 2,
    y: exitCenterY - highlightSize.height / 2,
    width: highlightSize.width,
    height: highlightSize.height,
    visible: false
  });
  highlightImages.push(exitHighlight);

  textOrigPos.push({ x: exitX, y: exitY });
  highlightOrigPos.push({ x: exitHighlight.x, y: exitHighlight.y });

  jsmaf.root.children.push(exitHighlight);
  jsmaf.root.children.push(exitText);

  // ==================== FIX ALL HIGHLIGHT X POSITIONS ====================
  var fixedHighlightX = exitHighlight.x + 120;
  for (var j = 0; j < highlightImages.length; j++) {
    var hl = highlightImages[j];
    hl.x = fixedHighlightX;
    highlightOrigPos[j].x = fixedHighlightX;
  }

  // ==================== LOGO ====================
  var logoWidth = 500;
  var logoHeight = 194;
  logoImageObj = new Image({
    url: logoBase + '1.png',
    x: 180,
    y: firstButtonY - logoHeight - 30,
    width: logoWidth,
    height: logoHeight
  });
  jsmaf.root.children.push(logoImageObj);

  // ==================== SYNC INDICES FROM CONFIG ====================
  function syncIndicesFromConfig() {
    desiredBgIndex = configData.config.background;
    desiredLogoIndex = configData.config.logo;
    desiredHoverIndex = configData.config.hover;

    setBackgroundImage(desiredBgIndex);
    setLogoImage(desiredLogoIndex);
    setHoverImage(desiredHoverIndex);

    var bgPos = availableBgIndices.indexOf(desiredBgIndex);
    currentBgIndexPos = bgPos !== -1 ? bgPos : 0;
    var logoPos = availableLogoIndices.indexOf(desiredLogoIndex);
    currentLogoIndexPos = logoPos !== -1 ? logoPos : 0;
    var hoverPos = availableHoverIndices.indexOf(desiredHoverIndex);
    currentHoverIndexPos = hoverPos !== -1 ? hoverPos : 0;
  }

  // ==================== APPLY CONFIG AFTER LOAD ====================
  function applyConfig() {
    syncIndicesFromConfig();
    applyMusicSetting();
    if (configData.config.auto_bg) startAutoBg();
    else stopAutoBg();

    configLoaded = true;
    saveConfig();
  }

  loadConfig(function (loadedConfig) {
    configData = loadedConfig;
    applyConfig();
  });

  // ==================== ANIMATION FUNCTIONS ====================
  function easeInOut(t) { return (1 - Math.cos(t * Math.PI)) / 2; }

  function animateZoomIn(text, highlight, textOrig, highlightOrig, textSize, hSize) {
    if (zoomInInterval) jsmaf.clearInterval(zoomInInterval);
    var startScale = text.scaleX || 1.0;
    var endScale = 1.1;
    var duration = 175;
    var elapsed = 0;
    var step = 16;

    zoomInInterval = jsmaf.setInterval(function () {
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeInOut(t);
      var scale = startScale + (endScale - startScale) * eased;
      text.scaleX = scale;
      text.scaleY = scale;
      text.x = textOrig.x - (textSize.width * (scale - 1)) / 2;
      text.y = textOrig.y - (textSize.height * (scale - 1)) / 2;
      highlight.scaleX = scale;
      highlight.scaleY = scale;
      highlight.x = highlightOrig.x - (hSize.width * (scale - 1)) / 2;
      highlight.y = highlightOrig.y - (hSize.height * (scale - 1)) / 2;
      if (t >= 1 && zoomInInterval) {
        jsmaf.clearInterval(zoomInInterval);
        zoomInInterval = null;
      }
    }, step);
  }

  function animateZoomOut(text, highlight, textOrig, highlightOrig, textSize, hSize) {
    if (zoomOutInterval) jsmaf.clearInterval(zoomOutInterval);
    var startScale = text.scaleX || 1.1;
    var endScale = 1.0;
    var duration = 175;
    var elapsed = 0;
    var step = 16;

    zoomOutInterval = jsmaf.setInterval(function () {
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeInOut(t);
      var scale = startScale + (endScale - startScale) * eased;
      text.scaleX = scale;
      text.scaleY = scale;
      text.x = textOrig.x - (textSize.width * (scale - 1)) / 2;
      text.y = textOrig.y - (textSize.height * (scale - 1)) / 2;
      highlight.scaleX = scale;
      highlight.scaleY = scale;
      highlight.x = highlightOrig.x - (hSize.width * (scale - 1)) / 2;
      highlight.y = highlightOrig.y - (hSize.height * (scale - 1)) / 2;
      if (t >= 1 && zoomOutInterval) {
        jsmaf.clearInterval(zoomOutInterval);
        zoomOutInterval = null;
      }
    }, step);
  }

  // ==================== HIGHLIGHT UPDATE ====================
  function updateHighlight() {
    if (prevButton >= 0 && prevButton !== currentButton) {
      var prevText = buttonTexts[prevButton];
      var prevHighlight = highlightImages[prevButton];
      var prevTextOrig = textOrigPos[prevButton];
      var prevHighlightOrig = highlightOrigPos[prevButton];
      var prevTextSize = textSizes[prevButton];
      if (prevText && prevHighlight && prevTextOrig && prevHighlightOrig && prevTextSize) {
        prevHighlight.visible = false;
        animateZoomOut(prevText, prevHighlight, prevTextOrig, prevHighlightOrig, prevTextSize, highlightSize);
      }
    }

    for (var i = 0; i < buttonTexts.length; i++) {
      var text = buttonTexts[i];
      var highlight = highlightImages[i];
      var textOrig = textOrigPos[i];
      var highlightOrig = highlightOrigPos[i];
      var textSize = textSizes[i];

      if (i === currentButton) {
        highlight.visible = true;
        text.x = textOrig.x;
        text.y = textOrig.y;
        highlight.x = highlightOrig.x;
        highlight.y = highlightOrig.y;
        animateZoomIn(text, highlight, textOrig, highlightOrig, textSize, highlightSize);
      } else if (i !== prevButton) {
        text.scaleX = 1.0;
        text.scaleY = 1.0;
        text.x = textOrig.x;
        text.y = textOrig.y;
        highlight.scaleX = 1.0;
        highlight.scaleY = 1.0;
        highlight.x = highlightOrig.x;
        highlight.y = highlightOrig.y;
        highlight.visible = false;
      }
    }
    prevButton = currentButton;
  }

  // ==================== BUTTON PRESS HANDLER ====================
  function handleButtonPress() {
    var lastIndex = buttonTexts.length - 1;
    if (currentButton === lastIndex) {
      // Exit button
      include('includes/kill_vue.js');
    } else if (currentButton < menuOptions.length) {
      var selectedOption = menuOptions[currentButton];
      if (!selectedOption) return;

      var scriptPath;
      if (selectedOption.script === 'loader.js') {
        scriptPath = selectedOption.script;
      } else if (selectedOption.script === 'payload_host.js' || selectedOption.script === 'config_ui.js' || selectedOption.script === 'about.js') {
        scriptPath = 'themes/RE9/' + selectedOption.script;
      } else {
        var theme = (typeof CONFIG !== 'undefined' && CONFIG.theme) ? CONFIG.theme : 'default';
        scriptPath = 'themes/' + theme + '/' + selectedOption.script;
      }

      log('Loading ' + scriptPath + '...');
      try {
        include(scriptPath);
      } catch (e) {
        log('ERROR loading ' + scriptPath + ': ' + e.message);
        if (e.stack) log(e.stack);
      }
    }
  }

  // ==================== DYNAMIC SWITCHING FUNCTIONS ====================
  function switchBackground(direction) {
    if (availableBgIndices.length === 0) return;
    currentBgIndexPos = (currentBgIndexPos + direction + availableBgIndices.length) % availableBgIndices.length;
    var newIndex = availableBgIndices[currentBgIndexPos];
    setBackgroundImage(newIndex);
    configData.config.background = newIndex;
    desiredBgIndex = newIndex;
    saveConfig();
  }

  function switchLogo(direction) {
    if (availableLogoIndices.length === 0) return;
    currentLogoIndexPos = (currentLogoIndexPos + direction + availableLogoIndices.length) % availableLogoIndices.length;
    var newIndex = availableLogoIndices[currentLogoIndexPos];
    setLogoImage(newIndex);
    configData.config.logo = newIndex;
    desiredLogoIndex = newIndex;
    saveConfig();
  }

  function switchHover(direction) {
    if (availableHoverIndices.length === 0) return;
    currentHoverIndexPos = (currentHoverIndexPos + direction + availableHoverIndices.length) % availableHoverIndices.length;
    var newIndex = availableHoverIndices[currentHoverIndexPos];
    setHoverImage(newIndex);
    configData.config.hover = newIndex;
    desiredHoverIndex = newIndex;
    saveConfig();
  }

  // ==================== INPUT HANDLING ====================
  jsmaf.onKeyDown = function (keyCode) {
    if (keyCode === 6 || keyCode === 5) {
      currentButton = (currentButton + 1) % buttonTexts.length;
      updateHighlight();
    } else if (keyCode === 4 || keyCode === 7) {
      currentButton = (currentButton - 1 + buttonTexts.length) % buttonTexts.length;
      updateHighlight();
    } else if (keyCode === 14) {
      handleButtonPress();
    }
    else if (keyCode === 10) {
      switchBackground(-1);
    } else if (keyCode === 11) {
      switchBackground(1);
    }
    else if (keyCode === 8) {
      switchLogo(-1);
    } else if (keyCode === 9) {
      switchLogo(1);
    }
    else if (keyCode === 12) {
      switchHover(-1);
    } else if (keyCode === 15) {
      switchHover(1);
    }
  };

  // ==================== INITIAL HIGHLIGHT ====================
  updateHighlight();
  log(lang.mainMenuLoaded);
})(); 