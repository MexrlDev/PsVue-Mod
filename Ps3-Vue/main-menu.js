(function () {
  include('languages.js');
  log(lang.loadingMainMenu);

  // Clear any existing UI
  jsmaf.root.children.length = 0;

  // Styles
  new Style({ name: 'white', color: 'white', size: 24 });
  new Style({ name: 'title', color: 'white', size: 32 });
  new Style({ name: 'label', color: 'white', size: 20 });      // main icon labels
  new Style({ name: 'subLabel', color: 'white', size: 28 });   // larger sub-icon labels

  // Background audio (ready but not started)
  var audio = new jsmaf.AudioClip();
  audio.volume = 0.5;
  audio.open('file://../download0/sfx/bgm.wav');

  // Background image
  var background = new Image({
    url: 'file:///../download0/img/multiview_bg_VAF.png',
    x: 0, y: 0, width: 1920, height: 1080
  });
  jsmaf.root.children.push(background);

  // Main icon definitions
  var mainIcons = [
    { file: 'users.png',    script: 'users.js' },
    { file: 'settings.png', script: 'settings.js' },
    { file: 'photo.png',    script: 'photo.js' },
    { file: 'music.png',    script: 'music.js' },
    { file: 'video.png',    script: 'video.js' },
    { file: 'tv.png',       script: 'tv.js' },
    { file: 'game.png',     script: 'game.js' },
    { file: 'network.png',  script: 'network.js' },
    { file: 'psn.png',      script: 'psn.js' },
    { file: 'friends.png',  script: 'friends.js' }
  ];
  var mainCount = mainIcons.length;

  // Sub-icon definitions for each main icon
  var subIcons = [
    [ 
      // Turn Off Vue will use the exit behavior learned below
      { file: 'menu_shutdown.png', label: 'Turn Off Vue', script: null, exit: true },
      { file: 'user1.png',     label: 'Create User', script: null },
      { file: 'MexrlUser.png', label: 'MexrlDev',    script: null, bgFile: 'mexrl_bg.png' }
    ], // users
    [ 
      { file: 'update.png',     label: 'System Update', script: null },
      { file: 'game_setting.png', label: 'Game Settings', script: null },
      { file: 'menu_video.png', label: 'Video Settings', script: null },
      { file: 'menu_audio.png', label: 'Music Settings', script: null },
      { file: 'menu_screen.png', label: 'Screen Settings', script: null },
      { file: 'Vue_Settings.png', label: 'Vue Config Settings', script: 'config_ui.js' },
      { file: 'menu_network.png', label: 'Network Connection', script: null }
    ], // settings
    [
      { file: 'image.png', label: 'Search for Media Servers', script: null },
      { file: 'FFmpeg.png', label: 'Playlist', script: null }
     ], // photo
    [ 
      { file: 'image.png', label: 'Search for Media Servers', script: null },
      { file: 'FFmpeg.png', label: 'Playlist', script: null }
    ], // music
    [ 
      { file: 'zip.png', label: 'BD Data Utility', script: null },
      { file: 'image.png', label: 'Search for Media Servers', script: null }
    ], // video
    [ 
      { file: 'lol.png', label: 'Ps3 Debug.. Stuff...', script: 'payloads/Tv-Message.js'}
    ], // tv
    [ 
      { file: 'zip.png', label: 'Game Data Utility', script: null },
      { file: 'cursor.png', label: 'Memory Card Unility (PS/PS2)', script: null },
      { file: 'menu_playlist.png', label: 'Save Data Utility', script: null },
      { file: 'menu_achievements.png', label: 'Trophy Collection', script: null },
      { file: 'JailBroken.png', label: 'JailBreak', script: 'loader.js' }
    ], // game
    [
      { file: 'menu_help.png', label: 'Online Instruction Manuals', script: null },
      // payloads placed inside download0/payloads
      { file: 'webui.png', label: 'Internet Browser', script: 'payloads/browser.js' },
      { file: 'mag.png', label: 'Internet search', script: null },
      { file: 'Script.png', label: 'Message Js', script: 'payloads/Message-test.js' },
      { file: 'Script.png', label: 'Web ui', script: 'payloads/web-ui.js' },
      { file: 'Script.png', label: 'fake signin', script: 'payloads/fake-signin.bin.js' },
      { file: 'Script.png', label: 'elfldr', script: 'payloads/elfldr.elf' },
      { file: 'menu_network.png', label: 'FTP', script: 'payloads/ftp-server.js' },
      { file: 'Script.png', label: 'Reset BGM', script: 'payloads/reset-bgm.js' },
      { file: 'Script.png', label: 'File Explorer', script: 'payloads/file-explorer.js' },
      { file: 'info.png', label: 'Credits', script: 'payloads/credits.js' }
     ], // network
    [
      { file: 'MexrlUser.png', label: 'MexrlDev', script: null }
     ], // psn
    [
      { file: 'menu_notifications.png', label: 'Messages', script: null }
     ]  // friends
  ];

  // Layout constants for main icons (smaller: 140×140)
  var mainIconSize = 140;
  var mainGap = 180;
  var mainStep = mainIconSize + mainGap;
  var mainStartY = 200;
  var labelY = mainStartY + mainIconSize + 10;
  var charWidth = 10;

  // Layout constants for sub-icons
  var subIconSize = 80;
  var subGap = 60;
  var subStep = subIconSize + subGap;
  var subCenterY = mainStartY + mainIconSize + 60;

  // Scale factor for selected sub-icon
  var selectedScale = 1.1;

  var labelToIconGap = 40;
  var bgGap = 5;
  var bgSize = 58;

  var selectedMainX = 450;

  var mainBaseX = [];
  for (var i = 0; i < mainCount; i++) {
    mainBaseX[i] = selectedMainX + i * mainStep;
  }

  // Create main icon images and labels
  var mainImages = [];
  var mainLabels = [];
  for (var i = 0; i < mainCount; i++) {
    var img = new Image({
      url: 'file:///../download0/icons/' + mainIcons[i].file,
      x: mainBaseX[i],
      y: mainStartY,
      width: mainIconSize,
      height: mainIconSize,
      borderColor: 'transparent',
      borderWidth: 0
    });
    mainImages.push(img);
    jsmaf.root.children.push(img);

    var labelText = mainIcons[i].file.replace('.png', '');
    var label = new jsmaf.Text();
    label.text = labelText;
    label.style = 'label';
    var textWidth = labelText.length * charWidth;
    label.x = mainBaseX[i] + (mainIconSize / 2) - (textWidth / 2);
    label.y = labelY;
    mainLabels.push(label);
    jsmaf.root.children.push(label);
  }

  // Create sub-icon images, backgrounds, and labels for all main icons
  var subImages = [];
  var subLabels = [];
  var subBgImages = []; // 2D array for background images
  for (var i = 0; i < mainCount; i++) {
    subImages[i] = [];
    subLabels[i] = [];
    subBgImages[i] = [];
    for (var j = 0; j < subIcons[i].length; j++) {
      if (subIcons[i][j].bgFile) {
        var bgImg = new Image({
          url: 'file:///../download0/icons/' + subIcons[i][j].bgFile,
          x: 0,
          y: 0,
          width: bgSize,
          height: bgSize,
          borderColor: 'transparent',
          borderWidth: 0,
          visible: false
        });
        subBgImages[i][j] = bgImg;
        jsmaf.root.children.push(bgImg);
      } else {
        subBgImages[i][j] = null;
      }

      var subImg = new Image({
        url: 'file:///../download0/icons/' + subIcons[i][j].file,
        x: 0,
        y: 0,
        width: subIconSize,
        height: subIconSize,
        borderColor: 'transparent',
        borderWidth: 0,
        visible: false
      });
      subImages[i].push(subImg);
      jsmaf.root.children.push(subImg);

      var subLabel = new jsmaf.Text();
      subLabel.text = subIcons[i][j].label;
      subLabel.style = 'subLabel';
      subLabel.visible = false;
      subLabels[i].push(subLabel);
      jsmaf.root.children.push(subLabel);
    }
  }

  // Current indices (targets)
  var targetMain = 0;
  var targetSub = 0;

  // Visual positions for animation (continuous)
  var visualMain = 0;
  var visualSub = 0;

  // Animation intervals
  var mainAnimInterval = null;
  var subAnimInterval = null;

  // Helper to get current sub-icon count
  function currentSubCount() {
    return subIcons[targetMain].length;
  }

  // Easing function (cosine)
  function easeInOut(t) {
    return (1 - Math.cos(t * Math.PI)) / 2;
  }

  // Start smooth scroll animation for main icons to a new target
  function startMainAnimation(newTarget) {
    if (mainAnimInterval) {
      jsmaf.clearInterval(mainAnimInterval);
      mainAnimInterval = null;
    }

    var startVisual = visualMain;
    var delta = newTarget - startVisual;
    var duration = 200; // milliseconds
    var step = 16;
    var elapsed = 0;

    mainAnimInterval = jsmaf.setInterval(function () {
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeInOut(t);
      visualMain = startVisual + delta * eased;

      updateIcons();

      if (t >= 1) {
        visualMain = newTarget;
        updateIcons();
        jsmaf.clearInterval(mainAnimInterval);
        mainAnimInterval = null;
      }
    }, step);
  }

  // Start smooth scroll animation for sub-icons to a new target
  function startSubAnimation(newTarget) {
    if (subAnimInterval) {
      jsmaf.clearInterval(subAnimInterval);
      subAnimInterval = null;
    }

    var startVisual = visualSub;
    var delta = newTarget - startVisual;
    var duration = 200;
    var step = 16;
    var elapsed = 0;

    subAnimInterval = jsmaf.setInterval(function () {
      elapsed += step;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeInOut(t);
      visualSub = startVisual + delta * eased;

      updateIcons();

      if (t >= 1) {
        visualSub = newTarget;
        updateIcons();
        jsmaf.clearInterval(subAnimInterval);
        subAnimInterval = null;
      }
    }, step);
  }

  // Update positions and visibility based on targetMain, targetSub, visualMain, visualSub
  function updateIcons() {
    for (var i = 0; i < mainCount; i++) {
      var newMainX = mainBaseX[i] - visualMain * mainStep;
      mainImages[i].x = newMainX;

      var labelText = mainLabels[i].text;
      var textWidth = labelText.length * charWidth;
      mainLabels[i].x = newMainX + (mainIconSize / 2) - (textWidth / 2);
      mainLabels[i].y = labelY;

      for (var j = 0; j < subImages[i].length; j++) {
        var subImg = subImages[i][j];
        var subLbl = subLabels[i][j];
        var bgImg = subBgImages[i][j];

        var subX = newMainX + (mainIconSize / 2) - (subIconSize / 2);
        var subY = subCenterY + (j - visualSub) * subStep;

        var scale = (i === targetMain && j === targetSub) ? selectedScale : 1.0;
        subImg.scaleX = scale;
        subImg.scaleY = scale;
        subImg.x = subX - (subIconSize * (scale - 1) / 2);
        subImg.y = subY - (subIconSize * (scale - 1) / 2);

        if (bgImg) {
          bgImg.x = subImg.x - bgGap - bgSize;
          bgImg.y = subImg.y;
          bgImg.width = bgSize;
          bgImg.height = bgSize;
          bgImg.borderColor = 'transparent';
          bgImg.borderWidth = 0;
        }

        var iconRightEdge = subImg.x + subIconSize * scale;
        subLbl.x = iconRightEdge + labelToIconGap;
        subLbl.y = subY + (subIconSize * scale) / 2 - 14;

        if (i === targetMain) {
          subImg.visible = true;
          subLbl.visible = true;
          if (bgImg) bgImg.visible = true;

          if (j === targetSub) {
            subImg.borderColor = 'rgb(100,180,255)';
            subImg.borderWidth = 3;
          } else {
            subImg.borderColor = 'transparent';
            subImg.borderWidth = 0;
          }
        } else {
          subImg.visible = false;
          subLbl.visible = false;
          if (bgImg) bgImg.visible = false;
        }
      }
    }
  }

  // Initial call
  updateIcons();

  // Helper to resolve and include scripts from download0 when appropriate.
  // If the provided path is an absolute URL or already contains a path segment (like payloads/...), include it under ../download0/.
  function includeFromDownload0(path) {
    if (!path) return;
    try {
      // If path looks like an absolute URL (http(s) or file: or starting slash), include as-is
      if (/^(https?:|file:|\/)/i.test(path)) {
        include(path);
        return;
      }
      // If path already starts with 'download0/' or '../download0/' use it directly
      if (/^(download0\/|\.{0,2}\/download0\/)/.test(path)) {
        include(path);
        return;
      }
      // Otherwise assume it's relative to download0 and build the path
      var full = '../download0/' + path;
      include(full);
    } catch (e) {
      log('ERROR including ' + path + ': ' + e.message);
      if (e.stack) log(e.stack);
    }
  }

  // Attempt to launch a payload/script robustly.
  // Handles .js, .bin, .elf and payloads inside payloads/ folder.
  function launchItem(subItem) {
    if (!subItem) {
      log('launchItem: no item provided');
      return;
    }

    // if explicitly marked exit
    if (subItem.exit === true || subItem.label === 'Turn Off Vue App' || subItem.file === 'menu_shutdown.png') {
      exitApp();
      return;
    }

    var script = subItem.script;
    if (!script) {
      log('launchItem: no script defined for ' + subItem.label);
      return;
    }

    // Normalize path we will attempt to use for payloads
    var normalized = script;

    // Helper: tries a sequence of strategies
    function tryStrategies(strategies) {
      for (var k = 0; k < strategies.length; k++) {
        try {
          var fn = strategies[k];
          var ok = fn();
          if (ok === true) {
            return true;
          }
        } catch (e) {
          log('strategy error: ' + e.message);
          if (e.stack) log(e.stack);
        }
      }
      return false;
    }

    // If looks like a JS file (ends with .js) → include normally
    if (/\.js$/i.test(normalized)) {
      log('Including JS: ' + normalized);
      includeFromDownload0(normalized);
      return;
    }

    // If looks like ELF or BIN → attempt loaders
    if (/\.elf$/i.test(normalized) || /\.bin$/i.test(normalized)) {
      var payloadPath = normalized;
      // If it's not already inside download0, build that path
      if (!/^(file:|\/|\.{0,2}\/download0\/|download0\/)/i.test(payloadPath)) {
        payloadPath = 'payloads/' + payloadPath;
      }
      // full file URL we'll try
      var fileUrl = 'file:///../download0/' + payloadPath.replace(/^\.\.\/+/, '');

      log('Detected native payload: ' + payloadPath + ' -> trying loaders (fileUrl: ' + fileUrl + ')');

      // Strategy list: try existing loader functions, then include loader scripts and retry, then fallback include
      var tried = tryStrategies([
        // 1) If runPayload exists already
        function () {
          if (typeof runPayload === 'function') {
            try {
              runPayload(fileUrl);
              log('runPayload(fileUrl) called.');
              return true;
            } catch (e) {
              log('runPayload failed: ' + e.message);
            }
          }
          return false;
        },
        // 2) If loadELF exists
        function () {
          if (typeof loadELF === 'function') {
            try {
              loadELF(fileUrl);
              log('loadELF(fileUrl) called.');
              return true;
            } catch (e) {
              log('loadELF failed: ' + e.message);
            }
          }
          return false;
        },
        // 3) If startPayload exists
        function () {
          if (typeof startPayload === 'function') {
            try {
              startPayload(fileUrl);
              log('startPayload(fileUrl) called.');
              return true;
            } catch (e) {
              log('startPayload failed: ' + e.message);
            }
          }
          return false;
        },
        // 4) Include common loader scripts then try runPayload/loadELF again
        function () {
          try {
            includeFromDownload0('loader.js');
            if (typeof runPayload === 'function') {
              runPayload(fileUrl);
              log('runPayload called after loader.js');
              return true;
            }
            if (typeof loadELF === 'function') {
              loadELF(fileUrl);
              log('loadELF called after loader.js');
              return true;
            }
          } catch (e) {
            log('Including loader.js failed: ' + e.message);
          }
          return false;
        },
        function () {
          try {
            includeFromDownload0('payload_loader.js');
            if (typeof runPayload === 'function') {
              runPayload(fileUrl);
              log('runPayload called after payload_loader.js');
              return true;
            }
            if (typeof loadELF === 'function') {
              loadELF(fileUrl);
              log('loadELF called after payload_loader.js');
              return true;
            }
          } catch (e) {
            log('Including payload_loader.js failed: ' + e.message);
          }
          return false;
        },
        // 5) Try including the payload path directly as a last resort (some envs handle this)
        function () {
          try {
            includeFromDownload0(payloadPath);
            log('Tried including payload file directly: ' + payloadPath);
            return true;
          } catch (e) {
            log('Direct include of payload failed: ' + e.message);
          }
          return false;
        }
      ]);

      if (!tried) {
        log('All loader strategies failed for ' + payloadPath + '. Check loader.js or environment loader capabilities.');
      }
      return;
    }

    // If unknown extension, attempt generic includeFromDownload0 and log
    log('Unknown extension, attempting generic include: ' + normalized);
    includeFromDownload0(normalized);
  }

  // Exit routine learned from the other script's exit button
  function exitApp() {
    log('Exiting application...');
    try {
      if (typeof libc_addr === 'undefined') {
        log('Loading userland.js...');
        include('userland.js');
      }
      fn.register(0x14, 'getpid', [], 'bigint');
      fn.register(0x25, 'kill', ['bigint', 'bigint'], 'bigint');
      var pid = fn.getpid();
      var pid_num = pid instanceof BigInt ? pid.lo : pid;
      log('Current PID: ' + pid_num);
      log('Sending SIGKILL to PID ' + pid_num);
      fn.kill(pid, new BigInt(0, 9));
    } catch (e) {
      log('ERROR during exit: ' + e.message);
      if (e.stack) log(e.stack);
    }
    try {
      jsmaf.exit();
    } catch (e) {
      // ignore if not available
    }
  }

  // Key handler
  jsmaf.onKeyDown = function (keyCode) {
    // Main navigation: right (5 and 56) and left (7 and 58) – with smooth animation
    if ((keyCode === 5 || keyCode === 56) && targetMain < mainCount - 1) {
      var newMain = targetMain + 1;
      targetMain = newMain;
      // Reset sub-icon selection and stop any sub animation
      targetSub = 0;
      visualSub = 0;
      if (subAnimInterval) {
        jsmaf.clearInterval(subAnimInterval);
        subAnimInterval = null;
      }
      startMainAnimation(newMain);
    }
    else if ((keyCode === 7 || keyCode === 58) && targetMain > 0) {
      var newMain = targetMain - 1;
      targetMain = newMain;
      targetSub = 0;
      visualSub = 0;
      if (subAnimInterval) {
        jsmaf.clearInterval(subAnimInterval);
        subAnimInterval = null;
      }
      startMainAnimation(newMain);
    }
    // Sub-icon navigation: down (6 and 57) and up (4 and 55) – with smooth animation
    else if (keyCode === 6 || keyCode === 57) { // down
      var subCount = currentSubCount();
      if (subCount > 0 && targetSub < subCount - 1) {
        var newSub = targetSub + 1;
        targetSub = newSub;
        startSubAnimation(newSub);
      }
    }
    else if (keyCode === 4 || keyCode === 55) { // up
      var subCount = currentSubCount();
      if (subCount > 0 && targetSub > 0) {
        var newSub = targetSub - 1;
        targetSub = newSub;
        startSubAnimation(newSub);
      }
    }
    // Confirm (code 14)
    else if (keyCode === 14) {
      var subCount = currentSubCount();
      if (subCount > 0) {
        var subItem = subIcons[targetMain][targetSub];
        if (subItem) {
          launchItem(subItem);
        } else {
          log('Selected sub-item missing.');
        }
      } else {
        var mainItem = mainIcons[targetMain];
        if (mainItem && mainItem.script) {
          log('Loading main icon script: ' + mainItem.script);
          includeFromDownload0(mainItem.script);
        } else {
          log('No script assigned to this main icon.');
        }
      }
    }
  };

  log(lang.mainMenuLoaded);
})();
