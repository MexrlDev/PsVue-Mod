(function () {
  // ==================== DEPENDENCIES ====================
  if (typeof libc_addr === 'undefined') {
    include('userland.js');
  }
  if (typeof lang === 'undefined') {
    include('languages.js');
  }

  log(lang.loadingConfig);

  // ==================== FILESYSTEM HELPERS ====================
  var fs = {
    write: function (filename, content, callback) {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && callback) {
          callback(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed to write ' + filename + ' (status ' + xhr.status + ')'));
        }
      };
      try {
        xhr.open('POST', 'file://../download0/' + filename, true);
        xhr.send(content);
      } catch (e) {
        if (callback) callback(e);
      }
    },
    read: function (filename, callback) {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && callback) {
          callback(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed to read ' + filename + ' (status ' + xhr.status + ')'), xhr.responseText);
        }
      };
      try {
        xhr.open('GET', 'file://../download0/' + filename, true);
        xhr.send();
      } catch (e) {
        if (callback) callback(e);
      }
    }
  };

  // ==================== CONFIGURATION DEFAULTS ====================
  var currentConfig = {
    autolapse: false,
    autopoop: false,
    autoclose: false,
    autoclose_delay: 0,
    music: true,
    jb_behavior: 0,
    theme: 'default'
  };

  var userPayloads = [];
  var configLoaded = false;

  // ==================== LABELS FOR CYCLE TYPES ====================
  var jbBehaviorLabels = [lang.jbBehaviorAuto, lang.jbBehaviorNetctrl, lang.jbBehaviorLapse];
  var jbBehaviorImgKeys = ['jbBehaviorAuto', 'jbBehaviorNetctrl', 'jbBehaviorLapse'];

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
            for (var j = 0; j < d_namlen; j++) {
              name += String.fromCharCode(mem.view(buf.add(new BigInt(0, offset + 8 + j))).getUint8(0));
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
      log('Theme scan failed: ' + (e && e.message ? e.message : e));
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
  var themeImgKeys = availableThemes.map(theme => 'theme' + theme.charAt(0).toUpperCase() + theme.slice(1)); // kept for compatibility

  // ==================== UI CONSTANTS ====================
  var WIDTH = 1920;
  var HEIGHT = 1080;
  var BASE_PATH = 'file:///../download0/';
  var IMG_PATH = BASE_PATH + 'themes/apollo/static/images/';

  var APP_LINE_OFFSET = 70;
  var MENU_ICON_OFF = 50;
  var MENU_TITLE_OFF = 100;
  var OPTION_ITEM_OFF = 1529;

  var ARROW_X_CENTER = MENU_ICON_OFF + MENU_TITLE_OFF;
  var NAME_X = ARROW_X_CENTER + 50;
  var BOOL_X = OPTION_ITEM_OFF - 29;
  var LIST_X = OPTION_ITEM_OFF - 18;

  var ARROW_WIDTH = Math.floor((2 * APP_LINE_OFFSET) / 3);
  var ARROW_HEIGHT = APP_LINE_OFFSET + 2;
  var ARROW_X_OFFSET = -25;

  var ARROW_USER_X_OFFSET = 0;
  var ARROW_Y_OFFSET = -4;

  var CHECKBOX_WIDTH = 28;
  var CHECKBOX_HEIGHT = 40;

  // Header
  var HEADER_Y = 50;
  var HEADER_ICON_WIDTH = 100;
  var HEADER_ICON_HEIGHT = 100;

  // ==================== KEY CODES ====================
  var CONFIRM_KEY = jsmaf.circleIsAdvanceButton ? 13 : 14;
  var BACK_KEY = jsmaf.circleIsAdvanceButton ? 14 : 13;

  // ==================== STYLES ====================
  var TEXT_HEIGHT = 36;
  new Style({ name: 'headerTitle', color: 'white', size: 48, align: 'left' });
  new Style({ name: 'optionName', color: 'white', size: TEXT_HEIGHT, align: 'left' });
  new Style({ name: 'optionValue', color: 'white', size: TEXT_HEIGHT, align: 'center' });

  // ==================== CLEAR SCREEN ====================
  jsmaf.root.children.length = 0;

  // ==================== BACKGROUND ====================
  var background = new Image({
    url: IMG_PATH + 'apollo.jpg',
    x: 0, y: 0, width: WIDTH, height: HEIGHT
  });
  jsmaf.root.children.push(background);

  // ==================== HELP IMAGE ====================
  // initial size
  var HELP_BASE_WIDTH = 2300;
  var HELP_BASE_HEIGHT = 635;
  var helpBg = new Image({
    url: IMG_PATH + 'help.png',
    x: (WIDTH - HELP_BASE_WIDTH) / 2,
    y: (HEIGHT - HELP_BASE_HEIGHT) / 2,
    width: HELP_BASE_WIDTH,
    height: HELP_BASE_HEIGHT,
    alpha: 0.7,
    visible: true
  });
  jsmaf.root.children.push(helpBg);

  // functions to adjust width/height
  function setHelpWidthOffset(offset) {
    offset = Number(offset) || 0;
    var newWidth = HELP_BASE_WIDTH + 2 * offset;
    if (newWidth < 10) newWidth = 10;
    helpBg.width = newWidth;
    helpBg.x = (WIDTH - newWidth) / 2;
  }
  function setHelpHeightOffset(offset) {
    offset = Number(offset) || 0;
    var newHeight = HELP_BASE_HEIGHT + 2 * offset;
    if (newHeight < 10) newHeight = 10;
    helpBg.height = newHeight;
    helpBg.y = (HEIGHT - newHeight) / 2;
  }
  try {
    window.setHelpWidthOffset = setHelpWidthOffset;
    window.setHelpHeightOffset = setHelpHeightOffset;
  } catch(e) { /* ignore */ }

  // ==================== HEADER ====================
  var headerIcon = new Image({
    url: IMG_PATH + 'cat_opt.png',
    x: 50, y: HEADER_Y, width: HEADER_ICON_WIDTH, height: HEADER_ICON_HEIGHT
  });
  jsmaf.root.children.push(headerIcon);

  var titleText = new jsmaf.Text();
  titleText.text = lang.settings || 'Settings';
  titleText.style = 'headerTitle';
  titleText.x = 50 + HEADER_ICON_WIDTH + 20;
  titleText.y = HEADER_Y;
  jsmaf.root.children.push(titleText);

  // ==================== SELECTION INDICATORS ====================
  var selectionLine = new Image({
    url: IMG_PATH + 'mark_line.png',
    x: 0, y: 0, width: WIDTH, height: APP_LINE_OFFSET,
    alpha: 0.3, visible: false
  });
  jsmaf.root.children.push(selectionLine);

  var initialArrowX = ARROW_X_CENTER + ARROW_X_OFFSET + ARROW_USER_X_OFFSET;
  var selectionArrow = new Image({
    url: IMG_PATH + 'mark_arrow.png',
    x: initialArrowX,
    y: 0,
    width: ARROW_WIDTH,
    height: ARROW_HEIGHT,
    alpha: 0.8,
    visible: false
  });
  jsmaf.root.children.push(selectionArrow);

  // ==================== CONFIGURATION OPTIONS ====================
  var configOptions = [
    { key: 'autolapse', label: lang.autoLapse, type: 'toggle' },
    { key: 'autopoop', label: lang.autoPoop, type: 'toggle' },
    { key: 'autoclose', label: lang.autoClose, type: 'toggle' },
    { key: 'music', label: lang.music, type: 'toggle' },
    { key: 'jb_behavior', label: lang.jbBehavior, type: 'cycle', labels: jbBehaviorLabels, values: [0,1,2] },
    { key: 'theme', label: lang.theme || 'Theme', type: 'cycle', labels: themeLabels, values: availableThemes }
  ];

  var optionNames = [];
  var optionControls = [];
  var optionY = [];

  // Compute start Y to vertically center the list
  var totalOptions = configOptions.length;
  var listHeight = totalOptions * APP_LINE_OFFSET;
  var startY = (HEIGHT - listHeight) / 2;

  for (var i = 0; i < totalOptions; i++) {
    var opt = configOptions[i];
    var y = startY + i * APP_LINE_OFFSET;
    optionY[i] = y;
    var centerY = y + Math.floor((APP_LINE_OFFSET - TEXT_HEIGHT) / 2);

    var nameText = new jsmaf.Text();
    nameText.text = opt.label;
    nameText.style = 'optionName';
    nameText.x = NAME_X;
    nameText.y = centerY;
    jsmaf.root.children.push(nameText);
    optionNames.push(nameText);

    if (opt.type === 'toggle') {
      var imgY = y + Math.floor((APP_LINE_OFFSET - CHECKBOX_HEIGHT) / 2);
      var img = new Image({
        url: currentConfig[opt.key] ? IMG_PATH + 'opt_on.png' : IMG_PATH + 'opt_off.png',
        x: BOOL_X,
        y: imgY,
        width: CHECKBOX_WIDTH,
        height: CHECKBOX_HEIGHT
      });
      jsmaf.root.children.push(img);
      optionControls.push(img);
    } else {
      var valueText = new jsmaf.Text();
      valueText.style = 'optionValue';
      valueText.x = LIST_X;
      valueText.y = centerY;
      var initialIdx;
      if (opt.key === 'jb_behavior') {
        initialIdx = currentConfig.jb_behavior;
      } else {
        initialIdx = availableThemes.indexOf(currentConfig.theme);
        if (initialIdx < 0) initialIdx = 0;
      }
      valueText.text = '< ' + opt.labels[initialIdx] + ' >';
      jsmaf.root.children.push(valueText);
      optionControls.push(valueText);
    }
  }

  // ==================== BACK HINT ====================
  var backHint = new jsmaf.Text();
  backHint.text = jsmaf.circleIsAdvanceButton ? 'X to go back' : 'O to go back';
  backHint.style = 'optionName';
  backHint.x = 20;
  backHint.y = HEIGHT - 60;
  jsmaf.root.children.push(backHint);

  // ==================== SELECTION STATE ====================
  var selectedIndex = 0;

  function updateSelection() {
    if (selectedIndex >= 0 && selectedIndex < totalOptions) {
      var y = optionY[selectedIndex];
      selectionLine.visible = true;
      selectionLine.y = y;
      selectionArrow.visible = true;
      var arrowCenterY = y + Math.floor((APP_LINE_OFFSET - ARROW_HEIGHT) / 2) + ARROW_Y_OFFSET;
      selectionArrow.y = arrowCenterY;
      selectionArrow.x = ARROW_X_CENTER + ARROW_X_OFFSET + ARROW_USER_X_OFFSET;
    } else {
      selectionLine.visible = false;
      selectionArrow.visible = false;
    }
  }

  // ==================== UPDATE CONTROL VISUALS ====================
  function updateControl(index) {
    var opt = configOptions[index];
    var control = optionControls[index];
    if (opt.type === 'toggle') {
      control.url = currentConfig[opt.key] ? IMG_PATH + 'opt_on.png' : IMG_PATH + 'opt_off.png';
    } else {
      var idx;
      if (opt.key === 'jb_behavior') {
        idx = currentConfig.jb_behavior;
      } else {
        idx = availableThemes.indexOf(currentConfig.theme);
        if (idx < 0) idx = 0;
      }
      control.text = '< ' + opt.labels[idx] + ' >';
    }
  }

  // ==================== CONFIG LOAD / SAVE ====================
  function saveConfig(callback) {
    if (!configLoaded) {
      log('Warning: saving config before full load.. proceeding anyway.');
    }

    var configData = {
      config: {
        autolapse: !!currentConfig.autolapse,
        autopoop: !!currentConfig.autopoop,
        autoclose: !!currentConfig.autoclose,
        autoclose_delay: Number(currentConfig.autoclose_delay) || 0,
        music: !!currentConfig.music,
        jb_behavior: Number(currentConfig.jb_behavior) || 0,
        theme: String(currentConfig.theme || 'default')
      },
      payloads: Array.isArray(userPayloads) ? userPayloads : []
    };
    var configContent;
    try {
      configContent = JSON.stringify(configData, null, 2);
    } catch (e) {
      log('ERROR: Failed to stringify config: ' + (e && e.message ? e.message : e));
      if (callback) callback(e);
      return;
    }

    var finalName = 'config.json';
    var tmpName = 'config.json.tmp';
    var bakName = 'config.json.bak';

    fs.read(finalName, function (readErr, data) {
      if (!readErr && typeof data === 'string') {
        fs.write(bakName, data, function (bakErr) {
          if (bakErr) {
            log('Warning: failed to write backup config: ' + (bakErr && bakErr.message ? bakErr.message : bakErr));
          }
          fs.write(tmpName, configContent, function (tmpErr) {
            if (tmpErr) {
              log('ERROR: failed to write tmp config: ' + (tmpErr && tmpErr.message ? tmpErr.message : tmpErr));
              if (callback) callback(tmpErr);
              return;
            }
            fs.write(finalName, configContent, function (finalErr) {
              if (finalErr) {
                log('ERROR: failed to write final config: ' + (finalErr && finalErr.message ? finalErr.message : finalErr));
                if (callback) callback(finalErr);
                return;
              }
              log('Config saved successfully (tmp->final).');
              if (callback) callback(null);
            });
          });
        });
      } else {
        fs.write(tmpName, configContent, function (tmpErr) {
          if (tmpErr) {
            log('ERROR: failed to write tmp config: ' + (tmpErr && tmpErr.message ? tmpErr.message : tmpErr));
            if (callback) callback(tmpErr);
            return;
          }
          fs.write(finalName, configContent, function (finalErr) {
            if (finalErr) {
              log('ERROR: failed to write final config: ' + (finalErr && finalErr.message ? finalErr.message : finalErr));
              if (callback) callback(finalErr);
              return;
            }
            log('Config saved successfully (new file).');
            if (callback) callback(null);
          });
        });
      }
    });
  }

  function loadConfig() {
    fs.read('config.json', function (err, data) {
      if (err) {
        log('No config found or read error: ' + (err && err.message ? err.message : err) + ' — using defaults.');
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
          currentConfig.autoclose_delay = Number(cfg.autoclose_delay) || 0;
          currentConfig.music = (cfg.music !== false);
          currentConfig.jb_behavior = Number(cfg.jb_behavior) || 0;

          if (cfg.theme && availableThemes.includes(cfg.theme)) {
            currentConfig.theme = cfg.theme;
          } else {
            log('WARNING: Theme "' + (cfg.theme || 'undefined') + '" not found, using default');
            currentConfig.theme = availableThemes[0] || 'default';
          }

          if (configData.payloads && Array.isArray(configData.payloads)) {
            userPayloads = configData.payloads.slice();
          }

          // Update UI visuals
          for (var i = 0; i < configOptions.length; i++) {
            updateControl(i);
          }

          configLoaded = true;
          log('Config loaded successfully');
        } else {
          configLoaded = true;
          log('No config structure found, using defaults');
        }
      } catch (e) {
        log('ERROR: Failed to parse config: ' + (e && e.message ? e.message : e));
        configLoaded = true;
      }
    });
  }

  // ==================== VALUE CHANGE ====================
  function changeValue(delta) {
    var opt = configOptions[selectedIndex];
    var key = opt.key;

    if (opt.type === 'toggle') {
      currentConfig[key] = !currentConfig[key];

      if (key === 'autolapse' && currentConfig.autolapse) {
        currentConfig.autopoop = false;
        updateControl(configOptions.findIndex(o => o.key === 'autopoop'));
        log('autopoop disabled (autolapse enabled)');
      } else if (key === 'autopoop' && currentConfig.autopoop) {
        currentConfig.autolapse = false;
        updateControl(configOptions.findIndex(o => o.key === 'autolapse'));
        log('autolapse disabled (autopoop enabled)');
      }

      log(key + ' = ' + currentConfig[key]);
    } else {
      var values = opt.values;
      var currentIdx;
      if (key === 'jb_behavior') {
        currentIdx = currentConfig.jb_behavior;
      } else {
        currentIdx = values.indexOf(currentConfig.theme);
        if (currentIdx < 0) currentIdx = 0;
      }
      var newIdx = (currentIdx + delta + values.length) % values.length;
      if (key === 'jb_behavior') {
        currentConfig.jb_behavior = newIdx;
        log(key + ' = ' + jbBehaviorLabels[newIdx]);
      } else {
        currentConfig.theme = values[newIdx];
        log(key + ' = ' + currentConfig.theme);
      }
    }

    updateControl(selectedIndex);
    saveConfig(function (err) {
      if (err) log('Warning: saveConfig after changeValue returned error: ' + (err && err.message ? err.message : err));
    });
  }

  // ==================== KEYBOARD HANDLER ====================
  jsmaf.onKeyDown = function (keyCode) {
    if (keyCode === 4) {
      selectedIndex = (selectedIndex - 1 + totalOptions) % totalOptions;
      updateSelection();
    } else if (keyCode === 6) {
      selectedIndex = (selectedIndex + 1) % totalOptions;
      updateSelection();
    } else if (keyCode === 7) {
      changeValue(-1);
    } else if (keyCode === 5) {
      changeValue(1);
    } else if (keyCode === CONFIRM_KEY) {
      changeValue(1);
    } else if (keyCode === BACK_KEY || keyCode === 13 || keyCode === 41) {
      var restartAfter = function () {
        jsmaf.setTimeout(function () {
          try { debugging.restart(); } catch (e) { log('Restart failed: ' + (e && e.message ? e.message : e)); }
        }, 120);
      };
      
      try {
        saveConfig(function (err) {
          if (err) {
            log('ERROR saving config before restart: ' + (err && err.message ? err.message : err));
            jsmaf.setTimeout(restartAfter, 200);
          } else {
            jsmaf.setTimeout(restartAfter, 120);
          }
        });
      } catch (e) {
        log('Exception while saving config: ' + (e && e.message ? e.message : e));
        jsmaf.setTimeout(restartAfter, 200);
      }
    }
  };

  // ==================== WHITE FADE OVERLAY ====================
  var whiteOverlay = new Image({
    url: IMG_PATH + 'white.png',
    x: 0,
    y: 0,
    width: WIDTH,
    height: HEIGHT,
    alpha: 1.0,
    visible: true
  });
  jsmaf.root.children.push(whiteOverlay);

  var whiteFadeInterval = null;
  function startWhiteFade() {
    var duration = 1500;
    var start = Date.now();
    if (whiteFadeInterval) jsmaf.clearInterval(whiteFadeInterval);
    whiteFadeInterval = jsmaf.setInterval(function() {
      var elapsed = Date.now() - start;
      var progress = elapsed / duration;
      if (progress >= 1) {
        whiteOverlay.alpha = 0.0;
        whiteOverlay.visible = false;
        var idx = jsmaf.root.children.indexOf(whiteOverlay);
        if (idx !== -1) jsmaf.root.children.splice(idx, 1);
        jsmaf.clearInterval(whiteFadeInterval);
        whiteFadeInterval = null;
      } else {
        whiteOverlay.alpha = 1.0 - progress;
      }
    }, 16);
  }

  // ==================== ARROW OFFSET HELPERS ====================
  function setArrowOffset(x, y) {
    ARROW_USER_X_OFFSET = Number(x) || 0;
    ARROW_Y_OFFSET = Number(y) || 0;
    selectionArrow.x = ARROW_X_CENTER + ARROW_X_OFFSET + ARROW_USER_X_OFFSET;
    updateSelection();
  }
  function setArrowYOffset(y) {
    ARROW_Y_OFFSET = Number(y) || 0;
    updateSelection();
  }
  try { window.setArrowOffset = setArrowOffset; window.setArrowYOffset = setArrowYOffset; } catch (e) { /* ignore */ }

  // ==================== INIT ====================
  updateSelection();
  loadConfig();
  startWhiteFade();

  log(lang.configLoaded || 'Configuration UI loaded');
})();
