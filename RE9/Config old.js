(function () {
  // ==================== INITIALIZATION ====================
  if (typeof libc_addr === 'undefined') {
    include('userland.js');
  }
  if (typeof lang === 'undefined') {
    include('languages.js');
  }
  log(lang.loadingConfig);

  // ==================== GLOBAL MUSIC (persistent) ====================
  if (typeof jsmaf.bgm === 'undefined') {
    jsmaf.bgm = new jsmaf.AudioClip();
    jsmaf.bgm.volume = 0.5;
    jsmaf.bgm.open('file:///../download0/themes/RE9/Data/Song/Song_Over8.wav');
  }
  var bgm = jsmaf.bgm;

  // ==================== CONFIGURATION MANAGEMENT ====================
  var configPath = 'file://../download0/config.json';
  var configData = {
    config: {
      autolapse: false,
      autopoop: false,
      autoclose: false,
      autoclose_delay: 0,
      music: true,
      jb_behavior: 0,
      theme: 'default',
      background: 1,
      logo: 1
    },
    payloads: []
  };
  var currentConfig = configData.config;
  var userPayloads = [];
  var configLoaded = false;

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

  function loadConfig(callback) {
    fs.read('config.json', function (err, data) {
      if (err) {
        log('Config not found, using defaults.');
        ensureConfigFields();
        if (callback) callback();
        return;
      }
      try {
        var parsed = JSON.parse(data || '{}');
        if (parsed.config) {
          var cfg = parsed.config;
          currentConfig.autolapse = cfg.autolapse || false;
          currentConfig.autopoop = cfg.autopoop || false;
          currentConfig.autoclose = cfg.autoclose || false;
          currentConfig.autoclose_delay = cfg.autoclose_delay || 0;
          currentConfig.music = cfg.music !== false;
          currentConfig.jb_behavior = cfg.jb_behavior || 0;
          currentConfig.theme = cfg.theme || 'default';
          currentConfig.background = cfg.background || 1;
          currentConfig.logo = cfg.logo || 1;
          userPayloads = parsed.payloads || [];
        }
        ensureConfigFields();
        log('Config loaded successfully.');
      } catch (e) {
        log('Error parsing config: ' + e.message + ', using defaults.');
        ensureConfigFields();
      }
      if (callback) callback();
    });
  }

  function ensureConfigFields() {}

  function saveConfig() {
    if (!configLoaded) {
      log('Config not loaded yet, skipping save');
      return;
    }
    var saveData = {
      config: {
        autolapse: currentConfig.autolapse,
        autopoop: currentConfig.autopoop,
        autoclose: currentConfig.autoclose,
        autoclose_delay: currentConfig.autoclose_delay,
        music: currentConfig.music,
        jb_behavior: currentConfig.jb_behavior,
        theme: currentConfig.theme,
        background: currentConfig.background,
        logo: currentConfig.logo
      },
      payloads: userPayloads
    };
    var content = JSON.stringify(saveData, null, 2);
    fs.write('config.json', content, function (err) {
      if (err) log('ERROR: Failed to save config: ' + err.message);
      else log('Config saved successfully');
    });
  }

  // ==================== MUSIC CONTROL ====================
  function applyMusicSetting() {
    if (currentConfig.music) {
      bgm.play(true);
    } else {
      if (bgm.stop) bgm.stop();
    }
  }

  // ==================== THEME SCANNING ====================
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
      log('Theme scan failed: ' + e.message);
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

  var availableThemes = scanThemes();
  log('Discovered themes: ' + availableThemes.join(', '));
  var themeLabels = availableThemes.map(theme => theme.charAt(0).toUpperCase() + theme.slice(1));
  var jbBehaviorLabels = [lang.jbBehaviorAuto, lang.jbBehaviorNetctrl, lang.jbBehaviorLapse];

  // ==================== BACKGROUND & LOGO AVAILABILITY ====================
  var bgBase = 'file:///../download0/themes/RE9/Data/Bg/IMG_OVER_';
  var logoBase = 'file:///../download0/themes/RE9/Data/Logo/LOGO_';
  var availableBgIndices = [];
  var availableLogoIndices = [];
  var MAX_CHECK = 20;

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

  // ==================== UI CONSTANTS ====================
  var highlightSize = {
    width: 600,
    height: 65
  };
  var highlightImgPath = 'file:///../download0/themes/RE9/Data/Over11/Over77.png';
  var markerImgPath = 'file:///../download0/themes/RE9/Data/Stuff/Marker.png';
  var listX = 230;
  var fixedHighlightX = 155;       // moved left a tiny bit more (from 160 to 155)
  var valueX = 600;
  var firstButtonY = 300;
  var lineHeight = 70;
  var fontSize = 24;
  var markerSize = 10;

  // ==================== CLEAR EXISTING UI ====================
  jsmaf.root.children.length = 0;

  // ==================== STYLES ====================
  new Style({
    name: 'menuText',
    color: 'white',
    size: 24
  });
  new Style({
    name: 'title',
    color: 'white',
    size: 32
  });

  // ==================== BACKGROUND IMAGE ====================
  var bgImageObj = new Image({
    url: bgBase + currentConfig.background + '.jpeg',
    x: 0,
    y: 0,
    width: 1920,
    height: 1080
  });
  jsmaf.root.children.push(bgImageObj);

  // ==================== LOGO ====================
  var logoWidth = 500;
  var logoHeight = 194;
  var logoImageObj = new Image({
    url: logoBase + currentConfig.logo + '.png',
    x: 180,
    y: 80,
    width: logoWidth,
    height: logoHeight
  });
  jsmaf.root.children.push(logoImageObj);

  // ==================== TITLE REMOVED ====================

  // ==================== CONFIG OPTIONS ====================
  var configOptions = [
    { key: 'autolapse', label: lang.autoLapse, type: 'toggle' },
    { key: 'autopoop', label: lang.autoPoop, type: 'toggle' },
    { key: 'autoclose', label: lang.autoClose, type: 'toggle' },
    { key: 'music', label: lang.music, type: 'toggle' },
    { key: 'jb_behavior', label: lang.jbBehavior, type: 'cycle', values: jbBehaviorLabels },
    { key: 'theme', label: lang.theme || 'Theme', type: 'cycle', values: themeLabels },
    { key: 'background', label: 'Background', type: 'cycle', values: [] },
    { key: 'logo', label: 'Logo', type: 'cycle', values: [] }
  ];

  var optionCount = configOptions.length;
  var buttonTexts = [];
  var highlightImages = [];
  var valueElements = [];
  var textOrigPos = [];
  var highlightOrigPos = [];
  var valueOrigPos = [];
  var textSizes = [];

  function estimateTextWidth(text) {
    return text.length * fontSize * 0.6;
  }

  for (var i = 0; i < optionCount; i++) {
    var opt = configOptions[i];
    var textY = firstButtonY + i * lineHeight;

    var textObj = new jsmaf.Text();
    textObj.text = opt.label;
    textObj.x = listX;
    textObj.y = textY;
    textObj.style = 'menuText';
    buttonTexts.push(textObj);
    textSizes.push({ width: estimateTextWidth(opt.label), height: fontSize });

    var highlight = new Image({
      url: highlightImgPath,
      x: fixedHighlightX,
      y: textY - (highlightSize.height - fontSize) / 2,
      width: highlightSize.width,
      height: highlightSize.height,
      visible: false
    });
    highlightImages.push(highlight);

    textOrigPos.push({ x: listX, y: textY });
    highlightOrigPos.push({ x: fixedHighlightX, y: highlight.y });

    if (opt.type === 'toggle') {
      var marker = new Image({
        url: markerImgPath,
        x: valueX - markerSize/2,
        y: textY + fontSize/2 - markerSize/2,
        width: markerSize,
        height: markerSize,
        visible: false
      });
      valueElements.push(marker);
      valueOrigPos.push({ x: marker.x, y: marker.y });
    } else {
      var valText = new jsmaf.Text();
      valText.text = '';
      valText.x = valueX;
      valText.y = textY;
      valText.style = 'menuText';
      valText.visible = false;
      valueElements.push(valText);
      valueOrigPos.push({ x: valueX, y: textY });
    }

    jsmaf.root.children.push(highlight);
    jsmaf.root.children.push(textObj);
    jsmaf.root.children.push(valueElements[i]);
  }

  // ==================== BACK HINT ====================
  var backHint = new jsmaf.Text();
  backHint.text = jsmaf.circleIsAdvanceButton ? 'X to go back' : 'O to go back';
  backHint.x = 890;
  backHint.y = 1000;
  backHint.style = 'white';
  jsmaf.root.children.push(backHint);

  // ==================== UPDATE VALUE ELEMENTS ====================
  function updateValueElement(index) {
    var opt = configOptions[index];
    var elem = valueElements[index];
    if (!elem) return;
    var key = opt.key;
    if (opt.type === 'toggle') {
      elem.visible = currentConfig[key];
    } else {
      var displayStr = '';
      if (key === 'jb_behavior') {
        displayStr = jbBehaviorLabels[currentConfig.jb_behavior];
      } else if (key === 'theme') {
        var themeIdx = availableThemes.indexOf(currentConfig.theme);
        if (themeIdx === -1) themeIdx = 0;
        displayStr = themeLabels[themeIdx];
      } else if (key === 'background') {
        displayStr = 'BG ' + currentConfig.background;
      } else if (key === 'logo') {
        displayStr = 'LOGO ' + currentConfig.logo;
      }
      elem.text = displayStr;
    }
  }

  for (var i = 0; i < optionCount; i++) {
    updateValueElement(i);
  }

  // ==================== ANIMATION ====================
  var zoomInInterval = null;
  var zoomOutInterval = null;
  var prevButton = -1;
  var currentButton = 0;

  function easeInOut(t) {
    return (1 - Math.cos(t * Math.PI)) / 2;
  }

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
      if (prevText && prevHighlight) {
        prevHighlight.visible = false;
        animateZoomOut(prevText, prevHighlight, prevTextOrig, prevHighlightOrig, prevTextSize, highlightSize);
      }
      var prevOpt = configOptions[prevButton];
      if (prevOpt.type === 'cycle') {
        valueElements[prevButton].visible = false;
      }
    }

    for (var i = 0; i < optionCount; i++) {
      var text = buttonTexts[i];
      var highlight = highlightImages[i];
      var textOrig = textOrigPos[i];
      var highlightOrig = highlightOrigPos[i];
      var textSize = textSizes[i];
      var opt = configOptions[i];
      var valElem = valueElements[i];

      if (i === currentButton) {
        highlight.visible = true;
        text.x = textOrig.x;
        text.y = textOrig.y;
        highlight.x = highlightOrig.x;
        highlight.y = highlightOrig.y;
        animateZoomIn(text, highlight, textOrig, highlightOrig, textSize, highlightSize);
        if (opt.type === 'cycle') {
          valElem.visible = true;
        }
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
        if (opt.type === 'cycle') {
          valElem.visible = false;
        }
      }
    }

    prevButton = currentButton;
  }

  // ==================== BUTTON PRESS HANDLER ====================
  function handleButtonPress() {
    var opt = configOptions[currentButton];
    var key = opt.key;
    if (opt.type === 'toggle') {
      currentConfig[key] = !currentConfig[key];
      if (key === 'autolapse' && currentConfig.autolapse) {
        currentConfig.autopoop = false;
        updateValueElement(configOptions.findIndex(o => o.key === 'autopoop'));
      } else if (key === 'autopoop' && currentConfig.autopoop) {
        currentConfig.autolapse = false;
        updateValueElement(configOptions.findIndex(o => o.key === 'autolapse'));
      }
      if (key === 'music') {
        applyMusicSetting();
      }
      updateValueElement(currentButton);
    } else {
      if (key === 'jb_behavior') {
        currentConfig.jb_behavior = (currentConfig.jb_behavior + 1) % jbBehaviorLabels.length;
      } else if (key === 'theme') {
        var themeIdx = availableThemes.indexOf(currentConfig.theme);
        themeIdx = (themeIdx + 1) % availableThemes.length;
        currentConfig.theme = availableThemes[themeIdx];
      } else if (key === 'background') {
        if (availableBgIndices.length > 0) {
          var bgIdx = availableBgIndices.indexOf(currentConfig.background);
          bgIdx = (bgIdx + 1) % availableBgIndices.length;
          currentConfig.background = availableBgIndices[bgIdx];
          bgImageObj.url = bgBase + currentConfig.background + '.jpeg';
        }
      } else if (key === 'logo') {
        if (availableLogoIndices.length > 0) {
          var logoIdx = availableLogoIndices.indexOf(currentConfig.logo);
          logoIdx = (logoIdx + 1) % availableLogoIndices.length;
          currentConfig.logo = availableLogoIndices[logoIdx];
          logoImageObj.url = logoBase + currentConfig.logo + '.png';
        }
      }
      updateValueElement(currentButton);
    }
    saveConfig();
  }

  // ==================== INPUT HANDLING ====================
  var confirmKey = jsmaf.circleIsAdvanceButton ? 13 : 14;
  var backKey = jsmaf.circleIsAdvanceButton ? 14 : 13;

  jsmaf.onKeyDown = function (keyCode) {
    log('Key pressed: ' + keyCode);
    if (keyCode === 4) {
      if (currentButton > 0) {
        currentButton--;
      } else {
        currentButton = optionCount - 1;
      }
      updateHighlight();
    } else if (keyCode === 6) {
      if (currentButton < optionCount - 1) {
        currentButton++;
      } else {
        currentButton = 0;
      }
      updateHighlight();
    } else if (keyCode === confirmKey) {
      handleButtonPress();
    } else if (keyCode === backKey) {
      log('Restarting...');
      saveConfig();
      jsmaf.setTimeout(function () {
        debugging.restart();
      }, 100);
    }
  };

  // ==================== INITIAL HIGHLIGHT ====================
  updateHighlight();

  // ==================== LOAD CONFIG ====================
  loadConfig(function () {
    for (var i = 0; i < optionCount; i++) {
      updateValueElement(i);
    }
    bgImageObj.url = bgBase + currentConfig.background + '.jpeg';
    logoImageObj.url = logoBase + currentConfig.logo + '.png';
    applyMusicSetting();
    configLoaded = true;
    saveConfig();
    log(lang.configLoaded);
  });

  setTimeout(function() {
    if (availableBgIndices.length > 0 && availableBgIndices.indexOf(currentConfig.background) === -1) {
      currentConfig.background = availableBgIndices[0];
      bgImageObj.url = bgBase + currentConfig.background + '.jpeg';
      updateValueElement(configOptions.findIndex(o => o.key === 'background'));
    }
    if (availableLogoIndices.length > 0 && availableLogoIndices.indexOf(currentConfig.logo) === -1) {
      currentConfig.logo = availableLogoIndices[0];
      logoImageObj.url = logoBase + currentConfig.logo + '.png';
      updateValueElement(configOptions.findIndex(o => o.key === 'logo'));
    }
  }, 500);
})();
