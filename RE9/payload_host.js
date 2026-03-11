(function () {
  // ==================== INITIALIZATION ====================
  if (typeof libc_addr === 'undefined') {
    log('Loading userland.js...');
    include('userland.js');
  }
  log('Loading check-jailbroken.js...');
  include('check-jailbroken.js');
  var is_jailbroken = checkJailbroken();

  // ==================== CONFIGURATION MANAGEMENT ====================
  var configPath = 'file://../download0/config.json';
  var configData = {
    config: {
      music: true,
      background: 1,
      logo: 1,
      hover: 1,
      auto_bg: false,
      bg_delay: 10
    },
    payloads: []
  };
  var configLoaded = false;

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
    if (cfg.config.background === undefined) { cfg.config.background = 1; changed = true; }
    if (cfg.config.logo === undefined) { cfg.config.logo = 1; changed = true; }
    if (cfg.config.music === undefined) { cfg.config.music = true; changed = true; }
    if (cfg.config.hover === undefined) { cfg.config.hover = 1; changed = true; }
    if (cfg.config.auto_bg === undefined) { cfg.config.auto_bg = false; changed = true; }
    if (cfg.config.bg_delay === undefined) { cfg.config.bg_delay = 10; changed = true; }
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

  // ==================== ROBUST GLOBAL MUSIC ====================
  if (typeof jsmaf.bgm === 'undefined') {
    jsmaf.bgm = null;
  }
  var bgm = jsmaf.bgm;

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
    bgm = jsmaf.bgm;
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
  var hoverBase = 'file:///../download0/themes/RE9/Data/Over11/Over_Hover_';
  var availableBgIndices = [];
  var availableLogoIndices = [];
  var availableHoverIndices = [];
  var currentBgIndexPos = 0;
  var currentLogoIndexPos = 0;
  var currentHoverIndexPos = 0;
  var bgImageObj = null;
  var logoImageObj = null;
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

  preloadImages(bgBase, '.jpeg', availableBgIndices);
  preloadImages(logoBase, '.png', availableLogoIndices);
  preloadImages(hoverBase, '.png', availableHoverIndices);

  var desiredBgIndex = 1;
  var desiredLogoIndex = 1;
  var desiredHoverIndex = 1;

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
      }, 5000);
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
  new Style({
    name: 'menuText',
    color: 'white',
    size: 24
  });

  // ==================== BACKGROUND IMAGE ====================
  bgImageObj = new Image({
    url: bgBase + '1.jpeg',
    x: 0,
    y: 0,
    width: 1920,
    height: 1080
  });
  jsmaf.root.children.push(bgImageObj);

  // ==================== LOGO ====================
  var logoWidth = 500;
  var logoHeight = 194;
  logoImageObj = new Image({
    url: logoBase + '1.png', // temporary
    x: 180,
    y: 80,
    width: logoWidth,
    height: logoHeight
  });
  jsmaf.root.children.push(logoImageObj);

  // ==================== SCAN FOR PAYLOADS ====================
  fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(0x06, 'close_sys', ['bigint'], 'bigint');
  fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(0x03, 'read_sys', ['bigint', 'bigint', 'bigint'], 'bigint');

  var scanPaths = ['/download0/payloads'];
  if (is_jailbroken) {
    scanPaths.push('/data/payloads');
    for (var i = 0; i <= 7; i++) {
      scanPaths.push('/mnt/usb' + i + '/payloads');
    }
  }

  log('Scanning paths: ' + scanPaths.join(', '));
  var path_addr = mem.malloc(256);
  var buf = mem.malloc(4096);
  var fileList = [];

  for (var currentPath of scanPaths) {
    log('Scanning ' + currentPath + ' for files...');
    for (var _i = 0; _i < currentPath.length; _i++) {
      mem.view(path_addr).setUint8(_i, currentPath.charCodeAt(_i));
    }
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
          for (var _i2 = 0; _i2 < d_namlen; _i2++) {
            name += String.fromCharCode(mem.view(buf.add(new BigInt(0, offset + 8 + _i2))).getUint8(0));
          }
          if (d_type === 8 && name !== '.' && name !== '..') {
            var lowerName = name.toLowerCase();
            if (lowerName.endsWith('.elf') || lowerName.endsWith('.bin') || lowerName.endsWith('.js')) {
              fileList.push({
                name: name,
                path: currentPath + '/' + name
              });
              log('Added file: ' + name + ' from ' + currentPath);
            }
          }
          offset += d_reclen;
        }
      }
      fn.close_sys(fd);
    } else {
      log('Failed to open ' + currentPath);
    }
  }

  log('Total payloads found: ' + fileList.length);

  // ==================== UI CONSTANTS ====================
  var highlightSize = {
    width: 450,
    height: 65
  };
  var listX = 230;
  var fixedHighlightX = 160;
  var firstButtonY = 300;
  var lineHeight = 50;
  var fontSize = 24;

  var visibleCount = 12;
  var topIndex = 0;
  var currentButton = 0;

  var buttonTexts = [];
  var highlightImages = [];
  var textOrigPos = [];
  var highlightOrigPos = [];
  var textSizes = [];

  function estimateTextWidth(text) {
    return text.length * fontSize * 0.6;
  }

  // Create the number of button slots
  for (var slot = 0; slot < visibleCount; slot++) {
    var textY = firstButtonY + slot * lineHeight;

    var textObj = new jsmaf.Text();
    textObj.text = '';
    textObj.x = listX;
    textObj.y = textY;
    textObj.style = 'menuText';
    buttonTexts.push(textObj);

    var highlight = new Image({
      url: hoverBase + '1.png',
      x: fixedHighlightX,
      y: textY - (highlightSize.height - fontSize) / 2,
      width: highlightSize.width,
      height: highlightSize.height,
      visible: false
    });
    highlightImages.push(highlight);

    textOrigPos.push({ x: listX, y: textY });
    highlightOrigPos.push({ x: fixedHighlightX, y: highlight.y });

    textSizes.push({ width: 0, height: fontSize });

    jsmaf.root.children.push(highlight);
    jsmaf.root.children.push(textObj);
  }

  function updateVisibleSlots() {
    for (var slot = 0; slot < visibleCount; slot++) {
      var payloadIndex = topIndex + slot;
      var textObj = buttonTexts[slot];
      var highlight = highlightImages[slot];
      var textOrig = textOrigPos[slot];
      var highlightOrig = highlightOrigPos[slot];

      if (payloadIndex < fileList.length) {
        var payload = fileList[payloadIndex];
        var displayName = payload.name;
        if (displayName.length > 30) {
          displayName = displayName.substring(0, 27) + '...';
        }
        textObj.text = displayName;
        textObj.visible = true;

        var textWidth = estimateTextWidth(displayName);
        textSizes[slot] = { width: textWidth, height: fontSize };

        var textCenterY = textOrig.y + fontSize / 2;
        var highlightY = textCenterY - highlightSize.height / 2;
        highlight.y = highlightY;
        highlightOrig.y = highlightY;

        textObj.x = listX;
        highlight.x = fixedHighlightX;

        highlight.visible = false;
      } else {
        textObj.visible = false;
        highlight.visible = false;
      }
    }
  }

  updateVisibleSlots();

  // ==================== BACK HINT ====================
  var backHint = new jsmaf.Text();
  backHint.text = jsmaf.circleIsAdvanceButton ? 'X to go back' : 'O to go back';
  backHint.x = 890;
  backHint.y = 1000;
  backHint.style = 'white';
  jsmaf.root.children.push(backHint);

  // ==================== ANIMATION VARIABLES ====================
  var zoomInInterval = null;
  var zoomOutInterval = null;
  var prevButton = -1;

  // ==================== ANIMATION FUNCTIONS ====================
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
      for (var slot = 0; slot < visibleCount; slot++) {
        var payloadIndex = topIndex + slot;
        if (payloadIndex === prevButton && payloadIndex < fileList.length) {
          var prevText = buttonTexts[slot];
          var prevHighlight = highlightImages[slot];
          var prevTextOrig = textOrigPos[slot];
          var prevHighlightOrig = highlightOrigPos[slot];
          var prevTextSize = textSizes[slot];
          if (prevText && prevHighlight && prevTextOrig && prevHighlightOrig) {
            prevHighlight.visible = false;
            animateZoomOut(prevText, prevHighlight, prevTextOrig, prevHighlightOrig, prevTextSize, highlightSize);
          }
          break;
        }
      }
    }

    for (var slot = 0; slot < visibleCount; slot++) {
      var payloadIndex = topIndex + slot;
      if (payloadIndex >= fileList.length) break;

      var text = buttonTexts[slot];
      var highlight = highlightImages[slot];
      var textOrig = textOrigPos[slot];
      var highlightOrig = highlightOrigPos[slot];
      var textSize = textSizes[slot];

      if (payloadIndex === currentButton) {
        highlight.visible = true;
        text.x = textOrig.x;
        text.y = textOrig.y;
        highlight.x = highlightOrig.x;
        highlight.y = highlightOrig.y;
        animateZoomIn(text, highlight, textOrig, highlightOrig, textSize, highlightSize);
      } else if (payloadIndex !== prevButton) {
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

  // ==================== SCROLLING WITH WRAP-AROUND ====================
  function scrollUp() {
    if (fileList.length === 0) return;
    if (currentButton > 0) {
      currentButton--;
    } else {
      currentButton = fileList.length - 1;
    }
    if (currentButton < topIndex) {
      topIndex = currentButton;
    } else if (currentButton >= topIndex + visibleCount) {
      topIndex = Math.max(0, currentButton - visibleCount + 1);
    }
    updateVisibleSlots();
    updateHighlight();
  }

  function scrollDown() {
    if (fileList.length === 0) return;
    if (currentButton < fileList.length - 1) {
      currentButton++;
    } else {
      currentButton = 0;
    }
    if (currentButton < topIndex) {
      topIndex = currentButton;
    } else if (currentButton >= topIndex + visibleCount) {
      topIndex = currentButton - visibleCount + 1;
    }
    updateVisibleSlots();
    updateHighlight();
  }

  // ==================== BUTTON PRESS HANDLER ====================
  function handleButtonPress() {
    if (currentButton < fileList.length) {
      var selectedEntry = fileList[currentButton];
      var filePath = selectedEntry.path;
      var fileName = selectedEntry.name;
      log('Selected: ' + fileName + ' from ' + filePath);
      try {
        if (fileName.toLowerCase().endsWith('.js')) {
          if (filePath.startsWith('/download0/')) {
            log('Including JavaScript file: ' + fileName);
            include('payloads/' + fileName);
          } else {
            log('Reading external JavaScript file: ' + filePath);
            var p_addr = mem.malloc(256);
            for (var _i3 = 0; _i3 < filePath.length; _i3++) {
              mem.view(p_addr).setUint8(_i3, filePath.charCodeAt(_i3));
            }
            mem.view(p_addr).setUint8(filePath.length, 0);
            var _fd = fn.open_sys(p_addr, new BigInt(0, 0), new BigInt(0, 0));
            if (!_fd.eq(new BigInt(0xffffffff, 0xffffffff))) {
              var buf_size = 1024 * 1024 * 1; // 1 MiB
              var _buf = mem.malloc(buf_size);
              var read_len = fn.read_sys(_fd, _buf, new BigInt(0, buf_size));
              fn.close_sys(_fd);
              var scriptContent = '';
              var len = read_len instanceof BigInt ? read_len.lo : read_len;
              log('File read size: ' + len + ' bytes');
              for (var _i4 = 0; _i4 < len; _i4++) {
                scriptContent += String.fromCharCode(mem.view(_buf).getUint8(_i4));
              }
              log('Executing via eval()...');
              eval(scriptContent);
            } else {
              log('ERROR: Could not open file for reading!');
            }
          }
        } else {
          log('Loading binloader.js...');
          include('binloader.js');
          var { bl_load_from_file } = binloader_init();
          log('Loading payload from: ' + filePath);
          bl_load_from_file(filePath);
        }
      } catch (e) {
        var err = e;
        log('ERROR: ' + err.message);
        if (err.stack) log(err.stack);
      }
    }
  }

  // ==================== INPUT HANDLING ====================
  var confirmKey = jsmaf.circleIsAdvanceButton ? 13 : 14;
  var backKey = jsmaf.circleIsAdvanceButton ? 14 : 13;

  jsmaf.onKeyDown = function (keyCode) {
    log('Key pressed: ' + keyCode);
    if (keyCode === 4) { // up
      scrollUp();
    } else if (keyCode === 6) { // down
      scrollDown();
    } else if (keyCode === confirmKey) {
      handleButtonPress();
    } else if (keyCode === backKey) {
      log('Going back to main menu...');
      try {
        include('themes/RE9/main.js');
      } catch (e) {
        log('ERROR loading main.js: ' + e.message);
      }
    }
  };

  // ==================== APPLY CONFIG ====================
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

  // ==================== INITIAL HIGHLIGHT ====================
  updateHighlight();
  log('Payload menu loaded – ' + fileList.length + ' payloads found.');
})();