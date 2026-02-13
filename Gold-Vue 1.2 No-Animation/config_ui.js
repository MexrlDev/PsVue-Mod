if (typeof libc_addr === 'undefined') {
  include('userland.js');
}
if (typeof lang === 'undefined') {
  include('languages.js');
}
(function () {
  log(lang.loadingConfig);

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

  var currentConfig = {
    autolapse: false,
    autopoop: false,
    autoclose: false,
    music: true,
    jb_behavior: 0
  };

  // Store user's payloads so we don't overwrite them
  var userPayloads = [];
  var configLoaded = false;
  var jbBehaviorLabels = [lang.jbBehaviorAuto, lang.jbBehaviorNetctrl, lang.jbBehaviorLapse];
  var jbBehaviorImgKeys = ['jbBehaviorAuto', 'jbBehaviorNetctrl', 'jbBehaviorLapse'];

  var currentButton = 0;
  var buttons = [];
  var buttonTexts = [];
  var buttonMarkers = [];
  var buttonOrigPos = [];
  var textCenterPos = [];
  var valueTexts = []; // holds either Images (checkmarks) or Text (jb label)
  var valueOrigPos = [];

  var idleParams = [];

  var normalButtonImg = 'file:///../download0/img/button_over_9.png';
  var selectedButtonImg = 'file:///../download0/img/button_over_9.png';
  jsmaf.root.children.length = 0;

  new Style({ name: 'white', color: 'white', size: 24 });
  new Style({ name: 'title', color: 'white', size: 32 });
  new Style({ name: 'small', color: 'white', size: 18 });

  // audio handler (create/close dynamically when music setting changes)
  var audio = null;
  function startBackgroundAudio() {
    try {
      if (!audio) {
        audio = new jsmaf.AudioClip();
        audio.volume = 0.5;
        audio.open('file://../download0/sfx/bgm.wav');
      } else {
        try { if (typeof audio.play === 'function') audio.play(); } catch (e) {}
      }
    } catch (e) { log('Audio start error: ' + e.message); }
  }
  function stopBackgroundAudio() {
    try {
      if (audio) {
        try { if (typeof audio.close === 'function') audio.close(); } catch (e) {}
        try { if (typeof audio.stop === 'function') audio.stop(); } catch (e) {}
        audio = null;
      }
    } catch (e) { log('Audio stop error: ' + e.message); }
  }

  // background (preserved from original)
  var background = new Image({
    url: 'file:///../download0/img/multiview_bg_VAF.png',
    x: 0,
    y: 0,
    width: 1920,
    height: 1080
  });
  jsmaf.root.children.push(background);

  // logo: keep static and visible
  var logo = new Image({
    url: 'file:///../download0/img/logo.png',
    x: 1620,
    y: 0,
    width: 300,
    height: 169,
    alpha: 1.0,
    scaleX: 1.0,
    scaleY: 1.0
  });
  jsmaf.root.children.push(logo);

  // Title (config)
  if (useImageText) {
    var title = new Image({
      url: textImageBase + 'config.png',
      x: 860,
      y: 100,
      width: 200,
      height: 60,
      alpha: 1.0
    });
    jsmaf.root.children.push(title);
  } else {
    var _title = new jsmaf.Text();
    _title.text = lang.config;
    _title.x = 910;
    _title.y = 120;
    _title.style = 'title';
    _title.alpha = 1.0;
    jsmaf.root.children.push(_title);
  }

  // --- LEFT-SIDE root info (static, fixed on left) ---
  var rootInfo = new jsmaf.Text();
  rootInfo.text = 'Root: /';
  rootInfo.x = 24; // left margin
  rootInfo.y = 28;
  rootInfo.style = 'small';
  rootInfo.align = 'left';
  jsmaf.root.children.push(rootInfo);

  var scriptsInfo = new jsmaf.Text();
  scriptsInfo.text = 'Script paths: /download0/config_ui.js' + (typeof checkJailbroken === 'function' && checkJailbroken() ? '; /data/payloads; /mnt/usb0..7/payloads' : '');
  scriptsInfo.x = 24;
  scriptsInfo.y = 52;
  scriptsInfo.style = 'small';
  scriptsInfo.align = 'left';
  jsmaf.root.children.push(scriptsInfo);

  // Include the stats tracker
  include('stats-tracker.js');

  // Load and display stats
  stats.load();
  var statsData = stats.get();

  // Create text elements for each stat (static)
  var statsImgKeys = ['totalAttempts', 'successes', 'failures', 'successRate', 'failureRate'];
  var statsValues = [statsData.total, statsData.success, statsData.failures, statsData.successRate, statsData.failureRate];
  var statsLabels = [lang.totalAttempts, lang.successes, lang.failures, lang.successRate, lang.failureRate];

  for (var s = 0; s < statsImgKeys.length; s++) {
    var yPos = 120 + s * 25;
    if (useImageText) {
      var labelImg = new Image({
        url: textImageBase + statsImgKeys[s] + '.png',
        x: 20,
        y: yPos,
        width: 180,
        height: 25,
        alpha: 1.0
      });
      jsmaf.root.children.push(labelImg);
      var valueText = new jsmaf.Text();
      valueText.text = String(statsValues[s]);
      valueText.x = 210;
      valueText.y = yPos;
      valueText.style = 'white';
      valueText.alpha = 1.0;
      jsmaf.root.children.push(valueText);
    } else {
      var lineText = new jsmaf.Text();
      lineText.text = statsLabels[s] + statsValues[s];
      lineText.x = 20;
      lineText.y = yPos;
      lineText.style = 'white';
      lineText.alpha = 1.0;
      jsmaf.root.children.push(lineText);
    }
  }

  var configOptions = [
    { key: 'autolapse', label: lang.autoLapse, imgKey: 'autoLapse', type: 'toggle' },
    { key: 'autopoop', label: lang.autoPoop, imgKey: 'autoPoop', type: 'toggle' },
    { key: 'autoclose', label: lang.autoClose, imgKey: 'autoClose', type: 'toggle' },
    { key: 'music', label: lang.music, imgKey: 'music', type: 'toggle' },
    { key: 'jb_behavior', label: lang.jbBehavior, imgKey: 'jbBehavior', type: 'cycle' }
  ];

  var centerX = 960;
  var startY = 300;
  var buttonSpacing = 120;
  var buttonWidth = 400;
  var buttonHeight = 80;

  // intro overlay present but non-blocking
  var introOverlay = new Image({
    url: 'file:///assets/img/black.png',
    x: 0, y: 0, width: 1920, height: 1080,
    alpha: 0.0
  });
  jsmaf.root.children.push(introOverlay);

  // Build buttons (config options) WITHOUT animations — instant placement and visibility
  for (var i = 0; i < configOptions.length; i++) {
    (function (i) {
      var configOption = configOptions[i];
      var btnX = centerX - buttonWidth / 2;
      var btnY = startY + i * buttonSpacing;

      var button = new Image({
        url: normalButtonImg,
        x: btnX,
        y: btnY,
        width: buttonWidth,
        height: buttonHeight,
        alpha: 1.0,
        scaleX: 1.0,
        scaleY: 1.0,
        rotation: 0
      });
      button._entering = false;
      buttons.push(button);
      jsmaf.root.children.push(button);

      // keep marker placeholder null for alignment
      buttonMarkers.push(null);

      var btnText;
      if (useImageText) {
        btnText = new Image({
          url: textImageBase + configOption.imgKey + '.png',
          x: btnX + buttonWidth / 2,
          y: btnY + buttonHeight / 2 - 6,
          width: 220,
          height: 48,
          alpha: 1.0
        });
      } else {
        btnText = new jsmaf.Text();
        btnText.text = configOption.label;
        btnText.align = 'center';
        btnText.x = btnX + buttonWidth / 2;
        btnText.y = btnY + buttonHeight / 2 - 8;
        btnText.style = 'white';
        btnText.alpha = 1.0;
      }
      buttonTexts.push(btnText);
      jsmaf.root.children.push(btnText);

      var valueEl;
      if (configOption.type === 'toggle') {
        valueEl = new Image({
          url: currentConfig[configOption.key] ? 'file:///../download0/img/check_small_on.png' : 'file:///../download0/img/check_small_off.png',
          x: btnX + buttonWidth - 60,
          y: btnY + (buttonHeight / 2) - 20,
          width: 40,
          height: 40,
          alpha: 1.0
        });
      } else {
        if (useImageText) {
          valueEl = new Image({
            url: textImageBase + jbBehaviorImgKeys[currentConfig.jb_behavior] + '.png',
            x: btnX + buttonWidth - 140,
            y: btnY + 15,
            width: 150,
            height: 50,
            alpha: 1.0
          });
        } else {
          valueEl = new jsmaf.Text();
          valueEl.text = jbBehaviorLabels[currentConfig.jb_behavior] || jbBehaviorLabels[0];
          valueEl.align = 'right';
          valueEl.x = btnX + buttonWidth - 20;
          valueEl.y = btnY + (buttonHeight / 2) - 8;
          valueEl.style = 'white';
          valueEl.alpha = 1.0;
        }
      }
      valueTexts.push(valueEl);
      jsmaf.root.children.push(valueEl);

      buttonOrigPos.push({ x: btnX, y: btnY });
      textCenterPos.push({ cx: btnX + buttonWidth / 2, cy: btnY + buttonHeight / 2 - 8 });
      valueOrigPos.push({ x: btnX + (configOption.type === 'toggle' ? buttonWidth - 60 : buttonWidth - 20), y: btnY + (configOption.type === 'toggle' ? (buttonHeight / 2) - 20 : (buttonHeight / 2) - 8) });

      // keep idleParams for API parity but do not use them for motion
      idleParams.push({
        phase: 0,
        slowSpeed: 0,
        fastSpeed: 0,
        swayAmp: 0,
        bobAmp: 0,
        rotateAmp: 0
      });
    })(i);
  }

  // --- BACK button: instant placement, marker hidden by default ---
  (function () {
    var backX = centerX - buttonWidth / 2;
    var backY = startY + configOptions.length * buttonSpacing + 20;
    var backButton = new Image({
      url: normalButtonImg,
      x: backX,
      y: backY,
      width: buttonWidth,
      height: buttonHeight,
      alpha: 1.0,
      scaleX: 1.0,
      scaleY: 1.0
    });
    backButton._entering = false;
    backButton._pressInterval = null;
    buttons.push(backButton);
    jsmaf.root.children.push(backButton);

    var backMarker = new Image({
      url: 'file:///assets/img/ad_pod_marker.png',
      x: backX + buttonWidth - 50,
      y: backY + 35,
      width: 12,
      height: 12,
      alpha: 1.0,
      scaleX: 1.0,
      scaleY: 1.0,
      visible: false
    });
    buttonMarkers.push(backMarker);
    jsmaf.root.children.push(backMarker);

    var backText;
    if (useImageText) {
      backText = new Image({
        url: textImageBase + 'back.png',
        x: backX + buttonWidth / 2,
        y: backY + buttonHeight / 2 - 6,
        width: 220,
        height: 48,
        alpha: 1.0
      });
    } else {
      backText = new jsmaf.Text();
      backText.text = lang.back;
      backText.align = 'center';
      backText.x = backX + buttonWidth / 2;
      backText.y = backY + buttonHeight / 2 - 8;
      backText.style = 'white';
      backText.alpha = 1.0;
    }
    buttonTexts.push(backText);
    jsmaf.root.children.push(backText);

    valueTexts.push(null);
    valueOrigPos.push({ x: backX + 250, y: backY + 28 });

    buttonOrigPos.push({ x: backX, y: backY });
    textCenterPos.push({ cx: backX + buttonWidth / 2, cy: backY + buttonHeight / 2 - 8 });

    idleParams.push({ phase: 0, slowSpeed: 0, fastSpeed: 0, swayAmp: 0, bobAmp: 0, rotateAmp: 0 });
  })();

  // marker blink helper (removed intervals — instant toggle)
  function startMarkerBlink(marker) {
    if (!marker) return;
    marker.visible = true;
    marker.scaleX = 1.0;
    marker.scaleY = 1.0;
  }
  function stopMarkerBlink(marker) {
    if (!marker) return;
    marker.visible = false;
    marker.scaleX = 1.0;
    marker.scaleY = 1.0;
  }

  // Simple start/stop flashing API (instant)
  var flashingMode = false;
  function startRandomFlashing() {
    flashingMode = true;
    for (var m = 0; m < buttonMarkers.length; m++) {
      if (!buttonMarkers[m]) continue;
      buttonMarkers[m].visible = true;
      buttonMarkers[m].scaleX = 1.0;
      buttonMarkers[m].scaleY = 1.0;
    }
  }
  function stopRandomFlashing() {
    flashingMode = false;
    for (var mm = 0; mm < buttonMarkers.length; mm++) {
      if (!buttonMarkers[mm]) continue;
      stopMarkerBlink(buttonMarkers[mm]);
    }
    var focusedMarker = buttonMarkers[currentButton];
    if (focusedMarker) focusedMarker.visible = true;
  }

  // highlight update: instant visual changes, no animation
  var prevButton = -1;
  function updateHighlight() {
    if (prevButton >= 0 && prevButton !== currentButton) {
      var prevBtn = buttons[prevButton];
      var prevTxt = buttonTexts[prevButton];
      var prevVal = valueTexts[prevButton];
      var prevMark = buttonMarkers[prevButton];
      if (prevBtn) {
        prevBtn.url = normalButtonImg;
        prevBtn.alpha = 0.9;
        prevBtn.borderColor = 'transparent';
        prevBtn.borderWidth = 0;
        prevBtn.scaleX = 1.0;
        prevBtn.scaleY = 1.0;
        prevBtn.rotation = 0;
        prevBtn.x = buttonOrigPos[prevButton].x;
        prevBtn.y = buttonOrigPos[prevButton].y;
      }
      if (prevTxt) {
        prevTxt.scaleX = 1.0;
        prevTxt.scaleY = 1.0;
        prevTxt.x = textCenterPos[prevButton].cx;
        prevTxt.y = textCenterPos[prevButton].cy;
      }
      if (prevVal) {
        prevVal.x = valueOrigPos[prevButton].x;
        prevVal.y = valueOrigPos[prevButton].y;
        prevVal.scaleX = 1.0;
        prevVal.scaleY = 1.0;
      }
      if (prevMark) stopMarkerBlink(prevMark);
    }

    for (var ii = 0; ii < buttons.length; ii++) {
      var b = buttons[ii];
      var m = buttonMarkers[ii];
      var t = buttonTexts[ii];
      if (!b || t === undefined) continue;
      if (ii === currentButton) {
        b.url = selectedButtonImg;
        b.alpha = 1.0;
        b.borderColor = 'rgb(122, 91, 6)';
        b.borderWidth = 3;
        b.scaleX = 1.0;
        b.scaleY = 1.0;
        if (m) {
          m.visible = true;
        }
      } else {
        b.url = normalButtonImg;
        b.alpha = 0.9;
        if (m && !flashingMode) {
          m.visible = false;
        }
      }
    }

    prevButton = currentButton;
  }

  // perform action for option; exit/back handled here
  function performConfigAction(index) {
    if (index === buttons.length - 1) {
      log('Restarting...');
      try { debugging.restart(); } catch (e) { log('ERROR restarting: ' + (e && e.message ? e.message : e)); }
      return;
    }
    if (index < configOptions.length) {
      var option = configOptions[index];
      var key = option.key;
      if (option.type === 'cycle') {
        currentConfig.jb_behavior = (currentConfig.jb_behavior + 1) % jbBehaviorLabels.length;
        log(key + ' = ' + jbBehaviorLabels[currentConfig.jb_behavior]);
      } else {
        currentConfig[key] = !currentConfig[key];

        // if music changed, start/stop audio accordingly
        if (key === 'music') {
          if (currentConfig.music) startBackgroundAudio(); else stopBackgroundAudio();
        }

        // mutual exclusivity rules from original
        if (key === 'autolapse' && currentConfig.autolapse === true) {
          currentConfig.autopoop = false;
          for (var z = 0; z < configOptions.length; z++) {
            if (configOptions[z].key === 'autopoop') { updateValueText(z); break; }
          }
          log('autopoop disabled (autolapse enabled)');
        } else if (key === 'autopoop' && currentConfig.autopoop === true) {
          currentConfig.autolapse = false;
          for (var zz = 0; zz < configOptions.length; zz++) {
            if (configOptions[zz].key === 'autolapse') { updateValueText(zz); break; }
          }
          log('autolapse disabled (autopoop enabled)');
        }
        log(key + ' = ' + currentConfig[key]);
      }
      updateValueText(index);
      // persist changes
      saveConfig();
    }
  }

  // update value visuals (checkmarks or jb label)
  function updateValueText(idx) {
    var opt = configOptions[idx];
    var valEl = valueTexts[idx];
    if (!opt || !valEl) return;
    if (opt.type === 'toggle') {
      valEl.url = currentConfig[opt.key] ? 'file:///../download0/img/check_small_on.png' : 'file:///../download0/img/check_small_off.png';
    } else {
      if (useImageText) {
        valEl.url = textImageBase + jbBehaviorImgKeys[currentConfig.jb_behavior] + '.png';
      } else {
        valEl.text = jbBehaviorLabels[currentConfig.jb_behavior];
      }
    }
  }

  // handle confirm: instant action (no press animation)
  function handleConfirm() {
    var btn = buttons[currentButton];
    var txt = buttonTexts[currentButton];
    if (btn && btn._entering) {
      btn._entering = false;
      btn.x = buttonOrigPos[currentButton].x;
      btn.y = buttonOrigPos[currentButton].y;
      if (txt) { txt.x = textCenterPos[currentButton].cx; txt.y = textCenterPos[currentButton].cy; }
      var mk = buttonMarkers[currentButton];
      if (mk) { mk.x = btn.x + buttonWidth - 50; mk.y = btn.y + 35; mk.alpha = 1.0; mk.scaleX = 1.0; mk.scaleY = 1.0; mk.visible = true; }
    }
    performConfigAction(currentButton);
  }

  // save/load config (adapted)
  function saveConfig() {
    if (!configLoaded) {
      log('Config not loaded yet, skipping save');
      return;
    }
    var configContent = 'const CONFIG = {\n';
    configContent += '    autolapse: ' + currentConfig.autolapse + ',\n';
    configContent += '    autopoop: ' + currentConfig.autopoop + ',\n';
    configContent += '    autoclose: ' + currentConfig.autoclose + ',\n';
    configContent += '    music: ' + currentConfig.music + ',\n';
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
      if (err) {
        log('ERROR: Failed to save config: ' + err.message);
      } else {
        log('Config saved successfully');
      }
    });
  }

  function loadConfig() {
    fs.read('config.js', function (err, data) {
      if (err) {
        log('ERROR: Failed to read config: ' + (err && err.message ? err.message : err));
        configLoaded = true;
        if (currentConfig.music) startBackgroundAudio();
        return;
      }
      try {
        eval(data || ''); // eslint-disable-line no-eval
        if (typeof CONFIG !== 'undefined') {
          currentConfig.autolapse = CONFIG.autolapse || false;
          currentConfig.autopoop = CONFIG.autopoop || false;
          currentConfig.autoclose = CONFIG.autoclose || false;
          currentConfig.music = (typeof CONFIG.music === 'undefined') ? true : CONFIG.music;
          currentConfig.jb_behavior = CONFIG.jb_behavior || 0;

          if (typeof payloads !== 'undefined' && Array.isArray(payloads)) {
            userPayloads = payloads.slice();
          }
          for (var idx = 0; idx < configOptions.length; idx++) {
            updateValueText(idx);
          }
          configLoaded = true;
          log('Config loaded successfully');
          if (currentConfig.music) startBackgroundAudio();
        } else {
          configLoaded = true;
          if (currentConfig.music) startBackgroundAudio();
        }
      } catch (e) {
        log('ERROR: Failed to parse config: ' + e.message);
        configLoaded = true;
        if (currentConfig.music) startBackgroundAudio();
      }
    });
  }

  // key handling (restored extra mappings)
  jsmaf.onKeyDown = function (keyCode) {
    if (keyCode === 6 || keyCode === 5) {
      currentButton = (currentButton + 1) % buttons.length;
      updateHighlight();
    } else if (keyCode === 4 || keyCode === 7) {
      currentButton = (currentButton - 1 + buttons.length) % buttons.length;
      updateHighlight();
    } else if (keyCode === 14) {
      handleConfirm();
    } else if (keyCode === 13) {
      try { include('main-menu.js'); } catch (e) { log('ERROR loading main-menu.js: ' + e.message); }
    }
  };

  jsmaf.onKeyUp = function () { /* intentionally empty */ };

  // initial highlight (call after layout built)
  updateHighlight();

  // load persisted config (this will also start audio if music is enabled)
  loadConfig();

  log('Interactive Config UI loaded!');
  log('Total elements: ' + jsmaf.root.children.length);
})();
