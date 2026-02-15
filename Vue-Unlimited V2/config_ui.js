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
  var textOrigPos = [];
  var valueTexts = [];
  var normalButtonImg = 'file:///assets/img/button_over_9.png';
  var selectedButtonImg = 'file:///assets/img/button_over_9.png';
  jsmaf.root.children.length = 0;
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
  if (typeof CONFIG !== 'undefined' && CONFIG.music) {
    var audio = new jsmaf.AudioClip();
    audio.volume = 0.5;
    audio.open('file://../download0/sfx/bgm.wav');
  }
  var background = new Image({
    url: 'file:///../download0/img/multiview_bg_VAF.png',
    x: 0,
    y: 0,
    width: 1920,
    height: 1080
  });
  jsmaf.root.children.push(background);
  var logo = new Image({
    url: 'file:///../download0/img/logo.png',
    x: 1620,
    y: 0,
    width: 300,
    height: 169
  });
  jsmaf.root.children.push(logo);
  if (useImageText) {
    var title = new Image({
      url: textImageBase + 'config.png',
      x: 860,
      y: 100,
      width: 200,
      height: 60
    });
    jsmaf.root.children.push(title);
  } else {
    var _title = new jsmaf.Text();
    _title.text = lang.config;
    _title.x = 910;
    _title.y = 120;
    _title.style = 'title';
    jsmaf.root.children.push(_title);
  }

  // Include the stats tracker
  include('stats-tracker.js');

  // Load and display stats
  stats.load();
  var statsData = stats.get();

  // Create text elements for each stat
  var statsImgKeys = ['totalAttempts', 'successes', 'failures', 'successRate', 'failureRate'];
  var statsValues = [statsData.total, statsData.success, statsData.failures, statsData.successRate, statsData.failureRate];
  var statsLabels = [lang.totalAttempts, lang.successes, lang.failures, lang.successRate, lang.failureRate];

  // Display each stat line
  for (var i = 0; i < statsImgKeys.length; i++) {
    var yPos = 120 + i * 25;
    if (useImageText) {
      var labelImg = new Image({
        url: textImageBase + statsImgKeys[i] + '.png',
        x: 20,
        y: yPos,
        width: 180,
        height: 25
      });
      jsmaf.root.children.push(labelImg);
      var valueText = new jsmaf.Text();
      valueText.text = String(statsValues[i]);
      valueText.x = 210;
      valueText.y = yPos;
      valueText.style = 'white';
      jsmaf.root.children.push(valueText);
    } else {
      var lineText = new jsmaf.Text();
      lineText.text = statsLabels[i] + statsValues[i];
      lineText.x = 20;
      lineText.y = yPos;
      lineText.style = 'white';
      jsmaf.root.children.push(lineText);
    }
  }
  var configOptions = [{
    key: 'autolapse',
    label: lang.autoLapse,
    imgKey: 'autoLapse',
    type: 'toggle'
  }, {
    key: 'autopoop',
    label: lang.autoPoop,
    imgKey: 'autoPoop',
    type: 'toggle'
  }, {
    key: 'autoclose',
    label: lang.autoClose,
    imgKey: 'autoClose',
    type: 'toggle'
  }, {
    key: 'music',
    label: lang.music,
    imgKey: 'music',
    type: 'toggle'
  }, {
    key: 'jb_behavior',
    label: lang.jbBehavior,
    imgKey: 'jbBehavior',
    type: 'cycle'
  }];
  var centerX = 960;
  var startY = 300;
  var buttonSpacing = 120;
  var buttonWidth = 400;
  var buttonHeight = 80;
  for (var _i = 0; _i < configOptions.length; _i++) {
    var configOption = configOptions[_i];
    var btnX = centerX - buttonWidth / 2;
    var btnY = startY + _i * buttonSpacing;
    var button = new Image({
      url: normalButtonImg,
      x: btnX,
      y: btnY,
      width: buttonWidth,
      height: buttonHeight
    });
    buttons.push(button);
    jsmaf.root.children.push(button);
    buttonMarkers.push(null);
    var btnText = void 0;
    if (useImageText) {
      btnText = new Image({
        url: textImageBase + configOption.imgKey + '.png',
        x: btnX + 20,
        y: btnY + 15,
        width: 200,
        height: 50
      });
    } else {
      btnText = new jsmaf.Text();
      btnText.text = configOption.label;
      btnText.x = btnX + 30;
      btnText.y = btnY + 28;
      btnText.style = 'white';
    }
    buttonTexts.push(btnText);
    jsmaf.root.children.push(btnText);
    if (configOption.type === 'toggle') {
      var checkmark = new Image({
        url: currentConfig[configOption.key] ? 'file:///assets/img/check_small_on.png' : 'file:///assets/img/check_small_off.png',
        x: btnX + 320,
        y: btnY + 20,
        width: 40,
        height: 40
      });
      valueTexts.push(checkmark);
      jsmaf.root.children.push(checkmark);
    } else {
      var valueLabel = void 0;
      if (useImageText) {
        valueLabel = new Image({
          url: textImageBase + jbBehaviorImgKeys[currentConfig.jb_behavior] + '.png',
          x: btnX + 230,
          y: btnY + 15,
          width: 150,
          height: 50
        });
      } else {
        valueLabel = new jsmaf.Text();
        valueLabel.text = jbBehaviorLabels[currentConfig.jb_behavior] || jbBehaviorLabels[0];
        valueLabel.x = btnX + 250;
        valueLabel.y = btnY + 28;
        valueLabel.style = 'white';
      }
      valueTexts.push(valueLabel);
      jsmaf.root.children.push(valueLabel);
    }
    buttonOrigPos.push({
      x: btnX,
      y: btnY
    });
    textOrigPos.push({
      x: btnText.x,
      y: btnText.y
    });
  }
  var backX = centerX - buttonWidth / 2;
  var backY = startY + configOptions.length * buttonSpacing + 100;
  var backButton = new Image({
    url: normalButtonImg,
    x: backX,
    y: backY,
    width: buttonWidth,
    height: buttonHeight
  });
  buttons.push(backButton);
  jsmaf.root.children.push(backButton);
  var backMarker = new Image({
    url: 'file:///assets/img/ad_pod_marker.png',
    x: backX + buttonWidth - 50,
    y: backY + 35,
    width: 12,
    height: 12,
    visible: false
  });
  buttonMarkers.push(backMarker);
  jsmaf.root.children.push(backMarker);
  var backText;
  if (useImageText) {
    backText = new Image({
      url: textImageBase + 'back.png',
      x: backX + 20,
      y: backY + 15,
      width: 200,
      height: 50
    });
  } else {
    backText = new jsmaf.Text();
    backText.text = lang.back;
    backText.x = backX + buttonWidth / 2 - 20;
    backText.y = backY + buttonHeight / 2 - 12;
    backText.style = 'white';
  }
  buttonTexts.push(backText);
  jsmaf.root.children.push(backText);
  buttonOrigPos.push({
    x: backX,
    y: backY
  });
  textOrigPos.push({
    x: backText.x,
    y: backText.y
  });
  var zoomInInterval = null;
  var zoomOutInterval = null;
  var prevButton = -1;
  function easeInOut(t) {
    return (1 - Math.cos(t * Math.PI)) / 2;
  }
  function animateZoomIn(btn, text, btnOrigX, btnOrigY, textOrigX, textOrigY) {
    if (zoomInInterval) jsmaf.clearInterval(zoomInInterval);
    var btnW = buttonWidth;
    var btnH = buttonHeight;
    var startScale = btn.scaleX || 1.0;
    var endScale = 1.1;
    var duration = 175;
    var elapsed = 0;
    var step = 16;
    zoomInInterval = jsmaf.setInterval(function () {
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeInOut(t);
      var scale = startScale + (endScale - startScale) * eased;
      btn.scaleX = scale;
      btn.scaleY = scale;
      btn.x = btnOrigX - btnW * (scale - 1) / 2;
      btn.y = btnOrigY - btnH * (scale - 1) / 2;
      text.scaleX = scale;
      text.scaleY = scale;
      text.x = textOrigX - btnW * (scale - 1) / 2;
      text.y = textOrigY - btnH * (scale - 1) / 2;
      if (t >= 1) {
        jsmaf.clearInterval(zoomInInterval !== null && zoomInInterval !== void 0 ? zoomInInterval : -1);
        zoomInInterval = null;
      }
    }, step);
  }
  function animateZoomOut(btn, text, btnOrigX, btnOrigY, textOrigX, textOrigY) {
    if (zoomOutInterval) jsmaf.clearInterval(zoomOutInterval);
    var btnW = buttonWidth;
    var btnH = buttonHeight;
    var startScale = btn.scaleX || 1.1;
    var endScale = 1.0;
    var duration = 175;
    var elapsed = 0;
    var step = 16;
    zoomOutInterval = jsmaf.setInterval(function () {
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeInOut(t);
      var scale = startScale + (endScale - startScale) * eased;
      btn.scaleX = scale;
      btn.scaleY = scale;
      btn.x = btnOrigX - btnW * (scale - 1) / 2;
      btn.y = btnOrigY - btnH * (scale - 1) / 2;
      text.scaleX = scale;
      text.scaleY = scale;
      text.x = textOrigX - btnW * (scale - 1) / 2;
      text.y = textOrigY - btnH * (scale - 1) / 2;
      if (t >= 1) {
        jsmaf.clearInterval(zoomOutInterval !== null && zoomOutInterval !== void 0 ? zoomOutInterval : -1);
        zoomOutInterval = null;
      }
    }, step);
  }
  function updateHighlight() {
    // Animate out the previous button
    var prevButtonObj = buttons[prevButton];
    var buttonMarker = buttonMarkers[prevButton];
    if (prevButton >= 0 && prevButton !== currentButton && prevButtonObj) {
      prevButtonObj.url = normalButtonImg;
      prevButtonObj.alpha = 0.7;
      prevButtonObj.borderColor = 'transparent';
      prevButtonObj.borderWidth = 0;
      if (buttonMarker) buttonMarker.visible = false;
      animateZoomOut(prevButtonObj, buttonTexts[prevButton], buttonOrigPos[prevButton].x, buttonOrigPos[prevButton].y, textOrigPos[prevButton].x, textOrigPos[prevButton].y);
    }

    // Set styles for all buttons
    for (var _i2 = 0; _i2 < buttons.length; _i2++) {
      var _button = buttons[_i2];
      var _buttonMarker = buttonMarkers[_i2];
      var buttonText = buttonTexts[_i2];
      var buttonOrigPos_ = buttonOrigPos[_i2];
      var textOrigPos_ = textOrigPos[_i2];
      if (_button === undefined || buttonText === undefined || buttonOrigPos_ === undefined || textOrigPos_ === undefined) continue;
      if (_i2 === currentButton) {
        _button.url = selectedButtonImg;
        _button.alpha = 1.0;
        _button.borderColor = 'rgb(100,180,255)';
        _button.borderWidth = 3;
        if (_buttonMarker) _buttonMarker.visible = true;
        animateZoomIn(_button, buttonText, buttonOrigPos_.x, buttonOrigPos_.y, textOrigPos_.x, textOrigPos_.y);
      } else if (_i2 !== prevButton) {
        _button.url = normalButtonImg;
        _button.alpha = 0.7;
        _button.borderColor = 'transparent';
        _button.borderWidth = 0;
        _button.scaleX = 1.0;
        _button.scaleY = 1.0;
        _button.x = buttonOrigPos_.x;
        _button.y = buttonOrigPos_.y;
        buttonText.scaleX = 1.0;
        buttonText.scaleY = 1.0;
        buttonText.x = textOrigPos_.x;
        buttonText.y = textOrigPos_.y;
        if (_buttonMarker) _buttonMarker.visible = false;
      }
    }
    prevButton = currentButton;
  }
  function updateValueText(index) {
    var options = configOptions[index];
    var valueText = valueTexts[index];
    if (!options || !valueText) return;
    var key = options.key;
    if (options.type === 'toggle') {
      var value = currentConfig[key];
      valueText.url = value ? 'file:///assets/img/check_small_on.png' : 'file:///assets/img/check_small_off.png';
    } else {
      if (useImageText) {
        valueText.url = textImageBase + jbBehaviorImgKeys[currentConfig.jb_behavior] + '.png';
      } else {
        valueText.text = jbBehaviorLabels[currentConfig.jb_behavior] || jbBehaviorLabels[0];
      }
    }
  }
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
    for (var _i3 = 0; _i3 < userPayloads.length; _i3++) {
      configContent += '    "' + userPayloads[_i3] + '"';
      if (_i3 < userPayloads.length - 1) {
        configContent += ',';
      }
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
        log('ERROR: Failed to read config: ' + err.message);
        return;
      }
      try {
        eval(data || ''); // eslint-disable-line no-eval
        if (typeof CONFIG !== 'undefined') {
          currentConfig.autolapse = CONFIG.autolapse || false;
          currentConfig.autopoop = CONFIG.autopoop || false;
          currentConfig.autoclose = CONFIG.autoclose || false;
          currentConfig.music = CONFIG.music !== false;
          currentConfig.jb_behavior = CONFIG.jb_behavior || 0;

          // Preserve user's payloads
          if (typeof payloads !== 'undefined' && Array.isArray(payloads)) {
            userPayloads = payloads.slice();
          }
          for (var _i4 = 0; _i4 < configOptions.length; _i4++) {
            updateValueText(_i4);
          }
          configLoaded = true;
          log('Config loaded successfully');
        }
      } catch (e) {
        log('ERROR: Failed to parse config: ' + e.message);
        configLoaded = true; // Allow saving even on error
      }
    });
  }
  function handleButtonPress() {
    if (currentButton === buttons.length - 1) {
      log('Restarting...');
      debugging.restart();
    } else if (currentButton < configOptions.length) {
      var option = configOptions[currentButton];
      var key = option.key;
      if (option.type === 'cycle') {
        currentConfig.jb_behavior = (currentConfig.jb_behavior + 1) % jbBehaviorLabels.length;
        log(key + ' = ' + jbBehaviorLabels[currentConfig.jb_behavior]);
      } else {
        var boolKey = key;
        currentConfig[boolKey] = !currentConfig[boolKey];
        if (key === 'autolapse' && currentConfig.autolapse === true) {
          currentConfig.autopoop = false;
          for (var _i5 = 0; _i5 < configOptions.length; _i5++) {
            if (configOptions[_i5].key === 'autopoop') {
              updateValueText(_i5);
              break;
            }
          }
          log('autopoop disabled (autolapse enabled)');
        } else if (key === 'autopoop' && currentConfig.autopoop === true) {
          currentConfig.autolapse = false;
          for (var _i6 = 0; _i6 < configOptions.length; _i6++) {
            if (configOptions[_i6].key === 'autolapse') {
              updateValueText(_i6);
              break;
            }
          }
          log('autolapse disabled (autopoop enabled)');
        }
        log(key + ' = ' + currentConfig[boolKey]);
      }
      updateValueText(currentButton);
      saveConfig();
    }
  }
  jsmaf.onKeyDown = function (keyCode) {
    if (keyCode === 6 || keyCode === 5) {
      currentButton = (currentButton + 1) % buttons.length;
      updateHighlight();
    } else if (keyCode === 4 || keyCode === 7) {
      currentButton = (currentButton - 1 + buttons.length) % buttons.length;
      updateHighlight();
    } else if (keyCode === 14) {
      handleButtonPress();
    } else if (keyCode === 13) {
      log('Restarting...');
      debugging.restart();
    }
  };
  updateHighlight();
  loadConfig();
  log(lang.configLoaded);
})();