(function () {
  // ==================== INITIALIZATION ====================
  if (typeof libc_addr === 'undefined') {
    log('Loading userland.js...');
    include('userland.js');
  }
  log('Loading check-jailbroken.js...');
  include('check-jailbroken.js');
  var is_jailbroken = typeof checkJailbroken === 'function' ? checkJailbroken() : false;

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
  if (typeof jsmaf.bgm === 'undefined' || !jsmaf.bgm) {
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
      if (!jsmaf.bgm || typeof jsmaf.bgm.play !== 'function') createBgm();
      else if (!jsmaf.bgm.opened && typeof jsmaf.bgm.open === 'function') {
        try { jsmaf.bgm.open('file:///../download0/themes/RE9/Data/Song/Song_Over8.wav'); jsmaf.bgm.opened = true; } catch (e) { log('applyMusicSetting reopen failed: ' + e.message); }
      }
      tryPlayBgm(0);
    } catch (e) {
      log('applyMusicSetting error: ' + e.message);
    }
  }

  // ==================== DYNAMIC BACKGROUND & LOGO ====================
  var bgBase = 'file:///../download0/themes/RE9/Data/Bg/IMG_OVER_';
  var logoBase = 'file:///../download0/themes/RE9/Data/Logo/LOGO_';
  var hoverBase = 'file:///../download0/themes/RE9/Data/Over11/Over_Hover_';
  var availableBgIndices = [];
  var availableLogoIndices = [];
  var availableHoverIndices = [];
  var currentBgIndexPos = 0;
  var currentLogoIndexPos = 0;
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
    if (bgImageObj) bgImageObj.url = url;
    if (bgImageObj) {
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
  }

  function setLogoImage(index) {
    var url = logoBase + index + '.png';
    if (logoImageObj) logoImageObj.url = url;
    if (logoImageObj) {
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
  }

  function setHoverImage(index) {
    var url = hoverBase + index + '.png';
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

    if (availableBgIndices && availableBgIndices.length > 0) beginCycle();
    else {
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
  new Style({ name: 'titleText', color: 'white', size: 36 });
  new Style({ name: 'versionText', color: '#00ff55', size: 18 });

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
    url: logoBase + '1.png',
    x: (1920 - logoWidth) / 2,
    y: 80,
    width: logoWidth,
    height: logoHeight
  });
  jsmaf.root.children.push(logoImageObj);

  // ==================== ABOUT TEXT ====================
  var centerX = 960;

  var creditsText = new jsmaf.Text();
  creditsText.text = 'Credits';
  creditsText.x = centerX;
  creditsText.y = 300;
  creditsText.style = 'titleText';
  creditsText.align = 'center';
  jsmaf.root.children.push(creditsText);

  var themeByText = new jsmaf.Text();
  themeByText.text = 'Theme By:';
  themeByText.x = centerX;
  themeByText.y = 370;
  themeByText.style = 'titleText';
  themeByText.align = 'center';
  jsmaf.root.children.push(themeByText);

  var mexrlText = new jsmaf.Text();
  mexrlText.text = 'MexrlDev';
  mexrlText.x = centerX;
  mexrlText.y = 420;
  mexrlText.style = 'menuText';
  mexrlText.align = 'center';
  jsmaf.root.children.push(mexrlText);

  var vueText = new jsmaf.Text();
  vueText.text = 'Vue After Free:';
  vueText.x = centerX;
  vueText.y = 490;
  vueText.style = 'titleText';
  vueText.align = 'center';
  jsmaf.root.children.push(vueText);

  var names = [
    'ufm42',
    'c0w-ar',
    'earthonion',
    'HelloYunho',
    'Gezine',
    'D-Link turtle',
    'Dr.YenYen',
    'TheFl0w',
    'abc'
  ];
  var startY = 540;
  var lineSpacing = 30;
  for (var i = 0; i < names.length; i++) {
    var nameText = new jsmaf.Text();
    nameText.text = names[i];
    nameText.x = centerX;
    nameText.y = startY + i * lineSpacing;
    nameText.style = 'menuText';
    nameText.align = 'center';
    jsmaf.root.children.push(nameText);
  }

  // ==================== BACK HINT ====================
  var backHint = new jsmaf.Text();
  backHint.text = jsmaf.circleIsAdvanceButton ? 'X to go back' : 'O to go back';
  backHint.x = 890;
  backHint.y = 1000;
  backHint.style = 'menuText';
  jsmaf.root.children.push(backHint);

  // ==================== VERSION TEXT FOR USERS TO KNOW THE V🫡 ====================
  var versionText = new jsmaf.Text();
  versionText.text = 'v.3.0';
  versionText.style = 'versionText';
  versionText.align = 'left';
  versionText.x = 20;
  versionText.y = backHint.y;
  jsmaf.root.children.push(versionText);

  // ==================== INPUT HANDLING ====================
  var backKey = jsmaf.circleIsAdvanceButton ? 14 : 13;
  jsmaf.onKeyDown = function (keyCode) {
    log('Key pressed: ' + keyCode);
    if (keyCode === backKey) {
      log('Going back to main menu...');
      try {
        include('themes/RE9/main.js');
      } catch (e) {
        log('ERROR loading main.js: ' + e.message);
      }
    }
  };

  // ==================== SYNC + APPLY CONFIG ====================
  function syncIndices() {
    var bgIdx = availableBgIndices.indexOf(desiredBgIndex);
    if (bgIdx === -1) {
      if (availableBgIndices.length > 0) {
        desiredBgIndex = availableBgIndices[0];
        currentBgIndexPos = 0;
      } else {
        currentBgIndexPos = 0;
      }
    } else {
      currentBgIndexPos = bgIdx;
    }
    var logoIdx = availableLogoIndices.indexOf(desiredLogoIndex);
    if (logoIdx === -1) {
      if (availableLogoIndices.length > 0) {
        desiredLogoIndex = availableLogoIndices[0];
        currentLogoIndexPos = 0;
      } else {
        currentLogoIndexPos = 0;
      }
    } else {
      currentLogoIndexPos = logoIdx;
    }
    setBackgroundImage(desiredBgIndex);
    setLogoImage(desiredLogoIndex);
  }

  function applyConfig() {
    desiredBgIndex = configData.config.background;
    desiredLogoIndex = configData.config.logo;
    desiredHoverIndex = configData.config.hover || 1;

    syncIndices();
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

  setTimeout(function () {
    syncIndices();
  }, 800);

  log('About menu loaded.');
})();