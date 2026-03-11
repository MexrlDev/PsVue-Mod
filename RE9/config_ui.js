(function () {
  // ==================== INITIALIZATION ====================
  if (typeof libc_addr === 'undefined') {
    include('userland.js');
  }
  if (typeof lang === 'undefined') {
    include('languages.js');
  }
  log(lang.loadingConfig);

  // ==================== GLOBAL MUSIC ====================
  function createBgm() {
    try {
      jsmaf.bgm = new jsmaf.AudioClip();
      jsmaf.bgm.volume = 0.5;
      // attempt open (may throw or be async)
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
        try { _bgm.stop(); } catch (e) { /* ignore */ }
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

    // If failed, try re-open or recreate and retry after a short delay
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
      if (!currentConfig.music) {
        if (jsmaf.bgm) {
          try { if (typeof jsmaf.bgm.stop === 'function') jsmaf.bgm.stop(); } catch (e) {}
          try { if (typeof jsmaf.bgm.close === 'function') jsmaf.bgm.close(); } catch (e) {}
          try { jsmaf.bgm.opened = false; } catch (e) {}
        }
        return;
      }

      if (!jsmaf.bgm || typeof jsmaf.bgm.play !== 'function') {
        createBgm();
      } else if (!jsmaf.bgm.opened && typeof jsmaf.bgm.open === 'function') {
        try {
          jsmaf.bgm.open('file:///../download0/themes/RE9/Data/Song/Song_Over8.wav');
          jsmaf.bgm.opened = true;
        } catch (e) {
          log('applyMusicSetting reopen failed: ' + e.message);
        }
      }
      tryPlayBgm(0);
    } catch (e) {
      log('applyMusicSetting error: ' + e.message);
    }
  }

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
      logo: 1,
      hover: 1,
      // new auto-bg fields
      auto_bg: false,
      bg_delay: 10
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
        if (xhr.readyState === 4) {
          if (callback) callback(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed'));
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
          currentConfig.hover = cfg.hover || 1;
          // new fields
          currentConfig.auto_bg = !!cfg.auto_bg;
          currentConfig.bg_delay = typeof cfg.bg_delay === 'number' ? cfg.bg_delay : (cfg.bg_delay ? Number(cfg.bg_delay) : 10);
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

  function ensureConfigFields() {
    if (typeof currentConfig.auto_bg !== 'boolean') currentConfig.auto_bg = false;
    if (typeof currentConfig.bg_delay !== 'number' || isNaN(currentConfig.bg_delay)) currentConfig.bg_delay = 10;
    // allow 1s,2s,3s plus previous presets
    var allowed = [1,2,3,5,10,20,25,30,45,60];
    if (allowed.indexOf(currentConfig.bg_delay) === -1) currentConfig.bg_delay = 10;
  }

  function saveConfig(callback) {
    if (!configLoaded) {
      log('Config not loaded yet, skipping save');
      if (callback) callback(new Error('Config not loaded'));
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
        logo: currentConfig.logo,
        hover: currentConfig.hover,
        auto_bg: currentConfig.auto_bg,
        bg_delay: currentConfig.bg_delay
      },
      payloads: userPayloads
    };
    var content = JSON.stringify(saveData, null, 2);
    fs.write('config.json', content, function (err) {
      if (err) log('ERROR: Failed to save config: ' + err.message);
      else log('Config saved successfully');
      if (callback) callback(err);
    });
  }

  // ==================== THEME / BG / HOVER SCANNING ====================
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

  // ==== Background, logo, hover detection ====
  var bgBase = 'file:///../download0/themes/RE9/Data/Bg/IMG_OVER_';
  var logoBase = 'file:///../download0/themes/RE9/Data/Logo/LOGO_';
  var hoverBase = 'file:///../download0/themes/RE9/Data/Over11/Over_Hover_';
  var availableBgIndices = [];
  var availableLogoIndices = [];
  var availableHoverIndices = [];
  var MAX_CHECK = 200;

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

  // start detection
  preloadImages(bgBase, '.jpeg', availableBgIndices);
  preloadImages(logoBase, '.png', availableLogoIndices);
  preloadImages(hoverBase, '.png', availableHoverIndices);

  // ==================== AUTO BG HANDLING ====================
  var autoBgInterval = null;
  var allowedBgDelays = [1,2,3,5,10,20,25,30,45,60];

  // wait until availableBgIndices fills (or timeout)
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
    if (!currentConfig.auto_bg) return;

    var delay = allowedBgDelays.indexOf(currentConfig.bg_delay) === -1 ? 10 : currentConfig.bg_delay;

    function beginCycle() {
      if (!availableBgIndices || availableBgIndices.length === 0) {
        log('startAutoBg: no background images detected, auto-bg will not start.');
        return;
      }
      var idxList = availableBgIndices;
      var curIndex = idxList.indexOf(currentConfig.background);
      if (curIndex === -1) {
        curIndex = 0;
        for (var i = 0; i < idxList.length; i++) {
          if (idxList[i] >= currentConfig.background) { curIndex = i; break; }
        }
        currentConfig.background = idxList[curIndex];
        bgImageObj.url = bgBase + currentConfig.background + '.jpeg';
        updateValueElement(configOptions.findIndex(o => o.key === 'background'));
        saveConfig(function(){});
      }

      // start interval that does loops through idxList lol
      autoBgInterval = jsmaf.setInterval(function () {
        try {
          if (!idxList || idxList.length === 0) return;
          curIndex = (curIndex + 1) % idxList.length;
          currentConfig.background = idxList[curIndex];
          bgImageObj.url = bgBase + currentConfig.background + '.jpeg';
          updateValueElement(configOptions.findIndex(o => o.key === 'background'));
          saveConfig(function(){});
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
      }, 5000);
    }

    var abIdx = configOptions.findIndex(o => o.key === 'auto_bg');
    if (abIdx !== -1) {
      var slotVisible = (abIdx >= startIndex && abIdx < startIndex + visibleCount);
      var ve = valueElements[abIdx];
      if (ve) ve.visible = slotVisible && !!currentConfig.auto_bg;
    }
  }

  function stopAutoBg() {
    if (autoBgInterval) {
      jsmaf.clearInterval(autoBgInterval);
      autoBgInterval = null;
    }

    var abIdx = configOptions.findIndex(o => o.key === 'auto_bg');
    if (abIdx !== -1) {
      var ve = valueElements[abIdx];
      if (ve) ve.visible = false;
    }
  }

  // ==================== UI CONSTANTS ====================
  var highlightSize = { width: 600, height: 65 };
  var markerImgPath = 'file:///../download0/themes/RE9/Data/Stuff/Marker.png';
  var listX = 230;
  var fixedHighlightX = 140;
  var valueX = 550;
  var firstButtonY = 300;
  var lineHeight = 70;
  var fontSize = 24;
  var markerSize = 10;

  // Show 9 items before scrolling
  var visibleCount = 9;

  // ==================== UI BUILD ====================
  jsmaf.root.children.length = 0;

  new Style({ name: 'menuText', color: 'white', size: 24 });
  new Style({ name: 'title', color: 'white', size: 32 });

  var bgImageObj = new Image({
    url: bgBase + currentConfig.background + '.jpeg',
    x: 0, y: 0, width: 1920, height: 1080
  });
  jsmaf.root.children.push(bgImageObj);

  var logoWidth = 500, logoHeight = 194;
  var logoImageObj = new Image({
    url: logoBase + currentConfig.logo + '.png',
    x: 180, y: 80, width: logoWidth, height: logoHeight
  });
  jsmaf.root.children.push(logoImageObj);

  var delayLabels = allowedBgDelays.map(function(d){ return d + 's'; });

  var configOptions = [
    { key: 'autolapse', label: lang.autoLapse, type: 'toggle' },
    { key: 'autopoop', label: lang.autoPoop, type: 'toggle' },
    { key: 'autoclose', label: lang.autoClose, type: 'toggle' },
    { key: 'music', label: lang.music, type: 'toggle' },
    { key: 'jb_behavior', label: lang.jbBehavior, type: 'cycle', values: jbBehaviorLabels },
    { key: 'theme', label: lang.theme || 'Theme', type: 'cycle', values: themeLabels },
    { key: 'background', label: 'Background', type: 'cycle', values: [] },
    { key: 'logo', label: 'Logo', type: 'cycle', values: [] },
    { key: 'hover', label: 'Hover', type: 'cycle', values: [] },
    { key: 'auto_bg', label: 'Auto BG', type: 'toggle' },
    { key: 'bg_delay', label: 'BG Delay', type: 'cycle', values: delayLabels }
  ];

  var optionCount = configOptions.length;
  var buttonTexts = [];
  var highlightImages = [];
  var valueElements = [];
  var textSizes = [];

  function estimateTextWidth(text) { return text.length * fontSize * 0.6; }

  // scrolling state ofc
  var startIndex = 0;
  var zoomInInterval = null;
  var zoomOutInterval = null;
  var prevButton = -1;
  var currentButton = 0;

  // create UI objects for each option
  for (var i = 0; i < optionCount; i++) {
    var opt = configOptions[i];
    var textObj = new jsmaf.Text();
    textObj.text = opt.label;
    textObj.x = listX;
    textObj.y = firstButtonY + i * lineHeight;
    textObj.style = 'menuText';
    buttonTexts.push(textObj);
    textSizes.push({ width: estimateTextWidth(opt.label), height: fontSize });

    var highlight = new Image({
      url: hoverBase + '1.png',
      x: fixedHighlightX,
      y: firstButtonY + i * lineHeight - (highlightSize.height - fontSize) / 2,
      width: highlightSize.width,
      height: highlightSize.height,
      visible: false
    });
    highlightImages.push(highlight);

    if (opt.type === 'toggle') {
      var marker = new Image({
        url: markerImgPath,
        x: valueX - markerSize/2,
        y: firstButtonY + i * lineHeight + fontSize/2 - markerSize/2,
        width: markerSize,
        height: markerSize,
        visible: false
      });
      valueElements.push(marker);
    } else {
      var valText = new jsmaf.Text();
      valText.text = '';
      if (opt.key === 'jb_behavior') valText.x = valueX - 50;
      else if (opt.key === 'logo') valText.x = valueX - 30;
      else if (opt.key === 'hover') valText.x = valueX - 20;
      else valText.x = valueX;
      valText.y = firstButtonY + i * lineHeight;
      valText.style = 'menuText';
      valText.visible = false;
      valueElements.push(valText);
    }

    jsmaf.root.children.push(highlight);
    jsmaf.root.children.push(textObj);
    jsmaf.root.children.push(valueElements[i]);
  }

  var backHint = new jsmaf.Text();
  backHint.text = jsmaf.circleIsAdvanceButton ? 'X to go back' : 'O to go back';
  backHint.x = 890; backHint.y = 1000; backHint.style = 'white';
  jsmaf.root.children.push(backHint);

  function updateValueElement(index) {
    var opt = configOptions[index];
    var elem = valueElements[index];
    if (!elem) return;
    var key = opt.key;
    if (opt.type === 'toggle') {
      var slotVisible = (index >= startIndex && index < startIndex + visibleCount);
      elem.visible = slotVisible && !!currentConfig[key];
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
      } else if (key === 'hover') {
        displayStr = 'HOVER ' + currentConfig.hover;
      } else if (key === 'bg_delay') {
        displayStr = currentConfig.bg_delay + 's';
      }
      if (typeof elem.text !== 'undefined') elem.text = displayStr;
    }
  }

  for (var i = 0; i < optionCount; i++) updateValueElement(i);

  function easeInOut(t) { return (1 - Math.cos(t * Math.PI)) / 2; }

  function animateZoomIn(text, highlight, origX, origY, textSize, hSize) {
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
      text.scaleX = scale; text.scaleY = scale;
      text.x = origX - (textSize.width * (scale - 1)) / 2;
      text.y = origY - (textSize.height * (scale - 1)) / 2;
      highlight.scaleX = scale; highlight.scaleY = scale;
      highlight.x = fixedHighlightX - (hSize.width * (scale - 1)) / 2;
      highlight.y = origY - (hSize.height - textSize.height) / 2 - (hSize.height * (scale - 1)) / 2;
      if (t >= 1 && zoomInInterval) { jsmaf.clearInterval(zoomInInterval); zoomInInterval = null; }
    }, step);
  }

  function animateZoomOut(text, highlight, origX, origY, textSize, hSize) {
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
      text.scaleX = scale; text.scaleY = scale;
      text.x = origX - (textSize.width * (scale - 1)) / 2;
      text.y = origY - (textSize.height * (scale - 1)) / 2;
      highlight.scaleX = scale; highlight.scaleY = scale;
      highlight.x = fixedHighlightX - (hSize.width * (scale - 1)) / 2;
      highlight.y = origY - (hSize.height - textSize.height) / 2 - (hSize.height * (scale - 1)) / 2;
      if (t >= 1 && zoomOutInterval) { jsmaf.clearInterval(zoomOutInterval); zoomOutInterval = null; }
    }, step);
  }

  // positions & visibility (scrolling)
  function updatePositionsAndVisibility() {
    if (startIndex < 0) startIndex = 0;
    if (startIndex > Math.max(0, optionCount - visibleCount)) startIndex = Math.max(0, optionCount - visibleCount);

    for (var i = 0; i < optionCount; i++) {
      var text = buttonTexts[i], highlight = highlightImages[i], valElem = valueElements[i];
      var opt = configOptions[i];
      var visible = (i >= startIndex && i < startIndex + visibleCount);
      if (visible) {
        var visiblePos = firstButtonY + (i - startIndex) * lineHeight;
        text.visible = true; text.x = listX; text.y = visiblePos;
        if (valElem) {
          if (opt.type === 'toggle') {
            valElem.x = valueX - markerSize/2; valElem.y = visiblePos + fontSize/2 - markerSize/2;
            valElem.visible = !!currentConfig[opt.key];
          } else {
            valElem.x = (opt.key === 'jb_behavior') ? (valueX - 50) :
                        (opt.key === 'logo') ? (valueX - 30) :
                        (opt.key === 'hover') ? (valueX - 20) : valueX;
            valElem.y = visiblePos;
            valElem.visible = false;
          }
        }
        var scaleX = (highlight.scaleX || 1);
        var scaleY = (highlight.scaleY || 1);
        highlight.x = fixedHighlightX - (highlightSize.width * (scaleX - 1)) / 2;
        highlight.y = visiblePos - (highlightSize.height - fontSize) / 2 - (highlightSize.height * (scaleY - 1)) / 2;
      } else {
        text.visible = false; highlight.visible = false;
        if (valElem) valElem.visible = false;
      }
    }
  }

  // highlight update (scrolling)
  function updateHighlight() {
    if (currentButton < startIndex) startIndex = currentButton;
    else if (currentButton >= startIndex + visibleCount) startIndex = currentButton - visibleCount + 1;

    updatePositionsAndVisibility();

    if (prevButton >= 0 && prevButton !== currentButton) {
      var prevText = buttonTexts[prevButton];
      var prevHighlight = highlightImages[prevButton];
      var prevTextSize = textSizes[prevButton];
      var prevVisible = (prevButton >= startIndex && prevButton < startIndex + visibleCount);
      if (prevText && prevHighlight && prevVisible) {
        prevHighlight.visible = false;
        var prevY = firstButtonY + (prevButton - startIndex) * lineHeight;
        animateZoomOut(prevText, prevHighlight, prevText.x, prevY, prevTextSize, highlightSize);
      }
      var prevOpt = configOptions[prevButton];
      if (prevOpt.type === 'cycle') valueElements[prevButton].visible = false;
    }

    for (var i = 0; i < optionCount; i++) {
      var text = buttonTexts[i], highlight = highlightImages[i], textSize = textSizes[i], opt = configOptions[i], valElem = valueElements[i];
      var isVisible = (i >= startIndex && i < startIndex + visibleCount);
      if (!isVisible) continue;
      var yPos = firstButtonY + (i - startIndex) * lineHeight;

      if (i === currentButton) {
        highlight.visible = true; text.x = listX; text.y = yPos;
        var sX = (highlight.scaleX || 1), sY = (highlight.scaleY || 1);
        highlight.x = fixedHighlightX - (highlightSize.width * (sX - 1)) / 2;
        highlight.y = yPos - (highlightSize.height - fontSize) / 2 - (highlightSize.height * (sY - 1)) / 2;
        animateZoomIn(text, highlight, text.x, yPos, textSize, highlightSize);
        if (opt.type === 'cycle') {
          valElem.visible = true;
          if (typeof valElem.text !== 'undefined') updateValueElement(i);
        } else if (opt.type === 'toggle') {
        }
      } else if (i !== prevButton) {
        text.scaleX = 1.0; text.scaleY = 1.0; text.x = listX; text.y = yPos;
        highlight.scaleX = 1.0; highlight.scaleY = 1.0;
        highlight.x = fixedHighlightX;
        highlight.y = yPos - (highlightSize.height - fontSize) / 2;
        highlight.visible = false;
        if (opt.type === 'cycle') valElem.visible = false;
      }
    }

    prevButton = currentButton;
  }

  // button press handler
  function handleButtonPress() {
    var opt = configOptions[currentButton];
    var key = opt.key;
    if (opt.type === 'toggle') {
      currentConfig[key] = !currentConfig[key];

      // special cases, idk why but yeah
      if (key === 'autolapse' && currentConfig.autolapse) {
        currentConfig.autopoop = false;
        updateValueElement(configOptions.findIndex(o => o.key === 'autopoop'));
      } else if (key === 'autopoop' && currentConfig.autopoop) {
        currentConfig.autolapse = false;
        updateValueElement(configOptions.findIndex(o => o.key === 'autolapse'));
      } else if (key === 'music') {
        // fully fixed mute/unmute
        applyMusicSetting();
      } else if (key === 'auto_bg') {
        if (currentConfig.auto_bg) startAutoBg();
        else stopAutoBg();
      }

      updateValueElement(currentButton);
      updateHighlight();
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
      } else if (key === 'hover') {
        if (availableHoverIndices.length > 0) {
          var hoverIdx = availableHoverIndices.indexOf(currentConfig.hover);
          hoverIdx = (hoverIdx + 1) % availableHoverIndices.length;
          currentConfig.hover = availableHoverIndices[hoverIdx];
          updateAllHighlightImages();
        }
      } else if (key === 'bg_delay') {
        var curDelay = currentConfig.bg_delay;
        var idx = allowedBgDelays.indexOf(curDelay);
        if (idx === -1) idx = 0;
        idx = (idx + 1) % allowedBgDelays.length;
        currentConfig.bg_delay = allowedBgDelays[idx];
        if (currentConfig.auto_bg) startAutoBg(); // restart with new delay
      }
      updateValueElement(currentButton);
    }
    // save user changes
    saveConfig(function(){});
  }

  // input handling
  var confirmKey = jsmaf.circleIsAdvanceButton ? 13 : 14;
  var backKey = jsmaf.circleIsAdvanceButton ? 14 : 13;

  jsmaf.onKeyDown = function (keyCode) {
    log('Key pressed: ' + keyCode);
    if (keyCode === 4) {
      if (currentButton > 0) currentButton--;
      else currentButton = optionCount - 1;
      updateHighlight();
    } else if (keyCode === 6) {
      if (currentButton < optionCount - 1) currentButton++;
      else currentButton = 0;
      updateHighlight();
    } else if (keyCode === confirmKey) {
      handleButtonPress();
    } else if (keyCode === backKey) {
      log('Restarting...');
      saveConfig(function (err) {
        if (err) log('Save failed, but restarting anyway.');
        jsmaf.setTimeout(function () {
          debugging.restart();
        }, 50);
      });
    }
  };

  // update highlights & positions initially
  updatePositionsAndVisibility();
  updateHighlight();

  function updateAllHighlightImages() {
    var newUrl = hoverBase + currentConfig.hover + '.png';
    for (var i = 0; i < highlightImages.length; i++) {
      highlightImages[i].url = newUrl;
    }
  }

  // LOAD CONFIG
  loadConfig(function () {
    for (var i = 0; i < optionCount; i++) updateValueElement(i);
    updatePositionsAndVisibility();
    updateHighlight();

    bgImageObj.url = bgBase + currentConfig.background + '.jpeg';
    logoImageObj.url = logoBase + currentConfig.logo + '.png';
    updateAllHighlightImages();
    // apply music
    applyMusicSetting();
    if (currentConfig.auto_bg) startAutoBg(); else stopAutoBg();
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
    if (availableHoverIndices.length > 0 && availableHoverIndices.indexOf(currentConfig.hover) === -1) {
      currentConfig.hover = availableHoverIndices[0];
      updateAllHighlightImages();
      updateValueElement(configOptions.findIndex(o => o.key === 'hover'));
    }

    updatePositionsAndVisibility();
    updateHighlight();
  }, 900);

})();