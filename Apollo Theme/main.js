(function () {
  // ==================== CONFIGURATION ====================
  var WIDTH = 1920;
  var HEIGHT = 1080;

  // Base paths
  var BASE_PATH = 'file:///../download0/';
  var IMG_PATH = BASE_PATH + 'themes/apollo/static/images/';
  var SONG_PATH = BASE_PATH + 'themes/apollo/song/bg.wav';

  var TARGET_HEIGHT = 200;
  var COLUMN_GAP = 30;
  var COLUMN1_EXTRA_GAP = 70;
  var COLUMN6_EXTRA_GAP = 100;

  var column_offsets = [50, 15, 30, 0, 60, 0, 80];
  var column_scales = [1.0, 1.0, 1.0, 1.1, 1.0, 1.0, 1.0];

  var jar_offsets = [2, 2, 2, 2, 2, 2, 2];
  var jar_scale = 0.9;

  // jars config if you wanna edit it..
  var jar_labels = ['Trophies', 'Start JB', 'HDD Payloads', 'Online DB', 'Tools', 'Settings', 'About'];

  // label position relative to jar center
  var label_offset_x = [0, 0, 0, 0, 0, 0, 0];
  var label_offset_y = [-60, -60, -60, -60, -60, -60, -60];

  // ==================== GLOBAL VARIABLES ====================
  var state = 'INTRO'; // INTRO, MAIN, SHUTDOWN, EXIT_ANIM
  var prevState = '';
  var selectedJar = 0;
  var hoverJar = -1;
  var mouseX = 0, mouseY = 0;

  var introStart = null;
  var shutdownStart = null;
  var exitAnimStart = null;

  var columns = [], columnRects = [];
  var jars = [], jarsHover = [], jarRects = [];
  var labels = [];

  var background, introImg, logoImg, logoTextImg;
  var blackBarTop, blackBarBottom;
  var whiteOverlay;
  var exitLogo; // logo used during exit animation
  var exitBarTop, exitBarBottom; // bars for exit animation
  var whiteFlash;  // white flash after intro
  var whiteFlashStart = null;

  // Music – robust handling
  var bgm = null;

  var mainLoopInterval = null, mousePollInterval = null;

  // Flags to prevent scheduling multiple exit calls
  var shutdownExitScheduled = false;
  var exitAnimExitScheduled = false;

  // ==================== STYLES ====================
  new Style({ name: 'jarLabel', color: 'black', size: 48, align: 'center' });

  // ==================== CLEAR SCREEN ====================
  jsmaf.root.children.length = 0;

  // ==================== HELPER: 1x1 pixel overlays ====================
  var blackPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAFeAHmG5l6CAAAAABJRU5ErkJggg==';
  var whitePixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  // Black bars for shutdown
  blackBarTop = new Image({ url: blackPixel, x: 0, y: 0, width: WIDTH, height: 0, visible: false });
  blackBarBottom = new Image({ url: blackPixel, x: 0, y: HEIGHT, width: WIDTH, height: 0, visible: false });
  jsmaf.root.children.push(blackBarTop, blackBarBottom);

  // ==================== BACKGROUND ====================
  background = new Image({ url: IMG_PATH + 'apollo.jpg', x: 0, y: 0, width: WIDTH, height: HEIGHT });
  jsmaf.root.children.push(background);

  // ==================== INTRO IMAGE ====================
  var iw = 646, ih = 484;
  var scaleFactor = Math.min(800 / iw, 600 / ih);
  var introW = Math.round(iw * scaleFactor);
  var introH = Math.round(ih * scaleFactor);
  introImg = new Image({ url: IMG_PATH + 'buk_scr.png', x: (WIDTH - introW) / 2, y: (HEIGHT - introH) / 2, width: introW, height: introH, alpha: 0 });
  jsmaf.root.children.push(introImg);

  // ==================== LOGO & LOGO TEXT ====================
  logoImg = new Image({ url: IMG_PATH + 'logo.png', x: 0, y: 0, width: 400, height: 400 });
  logoTextImg = new Image({ url: IMG_PATH + 'logo_text.png', x: 0, y: 0, width: 700, height: 112 });
  jsmaf.root.children.push(logoImg, logoTextImg);

  // ==================== LOAD COLUMN IMAGES ====================
  var columnFiles = ['column_1.png', 'column_2.png', 'column_3.png', 'column_4.png', 'column_5.png', 'column_6.png', 'column_7.png'];
  var originalSizes = [[173,212], [198,261], [180,210], [173,262], [180,210], [200,258], [173,212]];
  for (var i = 0; i < 7; i++) {
    var scale = TARGET_HEIGHT / originalSizes[i][1];
    var colW = Math.round(originalSizes[i][0] * scale * column_scales[i]);
    var colImg = new Image({ url: IMG_PATH + columnFiles[i], x: 0, y: 0, width: colW, height: TARGET_HEIGHT });
    columns.push(colImg);
    jsmaf.root.children.push(colImg);
  }

  // ==================== LOAD JARS ====================
  var jarNames = ['jar_empty', 'jar_JB', 'jar_hdd', 'jar_empty', 'jar_empty', 'jar_opt', 'jar_about'];
  var jarSizes = [[118,133], [118,133], [118,133], [118,133], [118,133], [118,133], [106,174]];
  for (var i = 0; i < 7; i++) {
    var w = Math.round(jarSizes[i][0] * jar_scale);
    var h = Math.round(jarSizes[i][1] * jar_scale);
    var jar = new Image({ url: IMG_PATH + jarNames[i] + '.png', x: 0, y: 0, width: w, height: h });
    var jarHover = new Image({ url: IMG_PATH + jarNames[i] + '_hover.png', x: 0, y: 0, width: w, height: h, visible: false });
    jars.push(jar);
    jarsHover.push(jarHover);
    jsmaf.root.children.push(jar, jarHover);
  }

  // ==================== JAR LABELS ====================
  for (var i = 0; i < 7; i++) {
    var label = new jsmaf.Text();
    label.text = jar_labels[i];
    label.style = 'jarLabel';
    label.align = 'center';
    label.alpha = 0;
    labels.push(label);
    jsmaf.root.children.push(label);
  }

  // ==================== WHITE FLASH OVERLAY ====================
  whiteFlash = new Image({ url: IMG_PATH + 'white.png', x: 0, y: 0, width: WIDTH, height: HEIGHT, visible: false, alpha: 0 });
  jsmaf.root.children.push(whiteFlash);

  // ==================== POSITIONING ====================
  function updatePositions() {
    logoImg.x = (WIDTH - logoImg.width) / 2;
    logoImg.y = 80;
    logoTextImg.x = (WIDTH - logoTextImg.width) / 2;
    logoTextImg.y = logoImg.y + logoImg.height + 10;

    var totalWidth = 0;
    for (var i = 0; i < columns.length; i++) totalWidth += columns[i].width;
    totalWidth += COLUMN_GAP * 6 + (COLUMN1_EXTRA_GAP - COLUMN_GAP) + (COLUMN6_EXTRA_GAP - COLUMN_GAP);
    var startX = (WIDTH - totalWidth) / 2;
    var x = startX;
    for (i = 0; i < columns.length; i++) {
      var rect = {
        x: x,
        y: HEIGHT - columns[i].height + column_offsets[i],
        width: columns[i].width,
        height: columns[i].height
      };
      columnRects[i] = rect;
      columns[i].x = rect.x;
      columns[i].y = rect.y;
      if (i === 0) x += columns[i].width + COLUMN1_EXTRA_GAP;
      else if (i === 5) x += columns[i].width + COLUMN6_EXTRA_GAP;
      else x += columns[i].width + COLUMN_GAP;
    }

    for (i = 0; i < jars.length; i++) {
      var colRect = columnRects[i];
      var jarX = colRect.x + (colRect.width - jars[i].width) / 2;
      var jarY = colRect.y - jars[i].height + jar_offsets[i];
      jarRects[i] = { x: jarX, y: jarY, width: jars[i].width, height: jars[i].height };
      jars[i].x = jarX;
      jars[i].y = jarY;
      jarsHover[i].x = jarX;
      jarsHover[i].y = jarY;
    }

    for (i = 0; i < labels.length; i++) {
      var jr = jarRects[i];
      var jarCenterX = jr.x + jr.width / 2;
      labels[i].x = Math.round(jarCenterX + (label_offset_x[i] || 0));
      labels[i].y = Math.round(jr.y - 34 + (label_offset_y[i] || 0));
    }
  }
  updatePositions();

  // ==================== MOUSE TRACKING ====================
  mousePollInterval = jsmaf.setInterval(function() {
    if (typeof mouseX !== 'undefined' && typeof mouseY !== 'undefined') {
      var newHover = -1;
      for (var i = 0; i < jarRects.length; i++) {
        var r = jarRects[i];
        if (mouseX >= r.x && mouseX <= r.x + r.width && mouseY >= r.y && mouseY <= r.y + r.height) {
          newHover = i;
          break;
        }
      }
      if (newHover !== hoverJar) {
        hoverJar = newHover;
        updateJarDisplay();
      }
    }
  }, 50);

  function updateJarDisplay() {
    for (var i = 0; i < jars.length; i++) {
      var isActive = (i === selectedJar) || (i === hoverJar);
      jars[i].visible = true;
      jarsHover[i].visible = isActive;
      labels[i].alpha = isActive ? 1.0 : 0.1;
    }
  }

  // ==================== GLOBAL BGM STOPPER (idempotent) ====================
  (function createGlobalStopper() {
    try {
      if (!window.__apollo_stop_all_bgm) {
        window.__apollo_stop_all_bgm = function() {
          try { if (window._apollo_bgm && window._apollo_bgm.stop) { try { window._apollo_bgm.stop(); } catch (e) {} } } catch (e) {}
          try { if (window.bgm && window.bgm.stop) { try { window.bgm.stop(); } catch (e) {} } } catch (e) {}
          try { if (bgm && bgm.stop) { try { bgm.stop(); } catch (e) {} } } catch (e) {}
          try { window._apollo_bgm = null; } catch (e) {}
          try { window.bgm = null; } catch (e) {}
          try { bgm = null; } catch (e) {}
        };
      }
    } catch (e) {
      // ignore
    }
  })();

  // ==================== MUSIC ====================
  function startMusic() {
    // Stop any previous Apollo bgm instances first to avoid duplicates/race conditions
    try { if (window.__apollo_stop_all_bgm) window.__apollo_stop_all_bgm(); } catch (e) {}

    try {
      bgm = new jsmaf.AudioClip();
      bgm.open(SONG_PATH);
      bgm.volume = 0.5;
      try { bgm.play(true); } catch (e) { /* ignore play errors */ }
      try { window._apollo_bgm = bgm; window.bgm = bgm; } catch (e) {}
    } catch (e) {
      log('Error loading music: ' + (e && e.message ? e.message : e));
      bgm = null;
    }
  }

  function stopMusic() {
    try { if (bgm && bgm.stop) { try { bgm.stop(); } catch (e) {} } } catch (e) {}
    try { if (window._apollo_bgm && window._apollo_bgm.stop) { try { window._apollo_bgm.stop(); } catch (e) {} } } catch (e) {}
    try { if (window.bgm && window.bgm.stop) { try { window.bgm.stop(); } catch (e) {} } } catch (e) {}
    try { window._apollo_bgm = null; } catch (e) {}
    try { window.bgm = null; } catch (e) {}
    bgm = null;
  }

  // ==================== EXIT ROUTINE ====================
  function exitApplication() {
    log('Exiting...');
    try { if (bgm && bgm.stop) bgm.stop(); } catch (e) {}
    try { if (window.__apollo_stop_all_bgm) window.__apollo_stop_all_bgm(); } catch (e) {}
    try {
      if (typeof libc_addr === 'undefined') {
        include('userland.js');
      }
      fn.register(0x14, 'getpid', [], 'bigint');
      fn.register(0x25, 'kill', ['bigint', 'bigint'], 'bigint');
      var pid = fn.getpid();
      fn.kill(pid, new BigInt(0, 9));
    } catch (e) {
      log('ERROR during exit: ' + (e && e.message ? e.message : e));
    }
    jsmaf.exit();
  }

  // ==================== STATE MANAGEMENT ====================
  function setState(newState) {
    prevState = state;
    state = newState;
    var now = Date.now();

    if (newState === 'INTRO') {
      introStart = now;
      introImg.alpha = 0;
      introImg.visible = true;
      showMainElements(false);
      blackBarTop.visible = false;
      blackBarBottom.visible = false;
      if (whiteOverlay) whiteOverlay.visible = false;
      if (exitLogo) exitLogo.visible = false;
      if (exitBarTop) exitBarTop.visible = false;
      if (exitBarBottom) exitBarBottom.visible = false;
      shutdownExitScheduled = false;
      exitAnimExitScheduled = false;

    } else if (newState === 'MAIN') {
      showMainElements(true);
      logoImg.alpha = 1.0;
      logoTextImg.alpha = 1.0;
      for (var i = 0; i < columns.length; i++) columns[i].alpha = 1.0;
      for (var i = 0; i < jars.length; i++) {
        jars[i].alpha = 1.0;
        jarsHover[i].alpha = 1.0;
      }
      updateJarDisplay();

      introImg.visible = false;
      blackBarTop.visible = false;
      blackBarBottom.visible = false;
      if (whiteOverlay) whiteOverlay.visible = false;
      if (exitLogo) exitLogo.visible = false;
      if (exitBarTop) exitBarTop.visible = false;
      if (exitBarBottom) exitBarBottom.visible = false;

      // Start white flash if coming from INTRO
      if (prevState === 'INTRO') {
        whiteFlash.visible = true;
        whiteFlash.alpha = 1.0;
        whiteFlashStart = now;
      }

      // Ensure music restarts cleanly every time we enter MAIN
      startMusic();

    } else if (newState === 'SHUTDOWN') {
      shutdownStart = now;
      blackBarTop.visible = true;
      blackBarBottom.visible = true;
      blackBarTop.height = 0;
      blackBarBottom.height = 0;
      blackBarBottom.y = HEIGHT;
      showMainElements(false);
      // stop music and clear global refs so next menu can start fresh
      try { if (window.__apollo_stop_all_bgm) window.__apollo_stop_all_bgm(); } catch (e) {}
      stopMusic();
      if (whiteOverlay) whiteOverlay.visible = false;
      if (exitLogo) exitLogo.visible = false;
      if (exitBarTop) exitBarTop.visible = false;
      if (exitBarBottom) exitBarBottom.visible = false;
      shutdownExitScheduled = false;

    } else if (newState === 'EXIT_ANIM') {
      showMainElements(false);
      introImg.visible = false;
      blackBarTop.visible = false;
      blackBarBottom.visible = false;
      // stop music and clear global refs to avoid conflicts during exit
      try { if (window.__apollo_stop_all_bgm) window.__apollo_stop_all_bgm(); } catch (e) {}
      stopMusic();

      if (!whiteOverlay) {
        whiteOverlay = new Image({ url: IMG_PATH + 'white.png', x: 0, y: 0, width: WIDTH, height: HEIGHT, visible: false });
        jsmaf.root.children.push(whiteOverlay);
      }
      whiteOverlay.visible = true;
      whiteOverlay.alpha = 1.0;

      if (!exitLogo) {
        exitLogo = new Image({ url: IMG_PATH + 'logo.png', x: 0, y: 0, width: 400, height: 400 });
        jsmaf.root.children.push(exitLogo);
      }
      exitLogo.visible = true;
      exitLogo.x = (WIDTH - exitLogo.width) / 2;
      exitLogo.y = (HEIGHT - exitLogo.height) / 2;

      if (!exitBarTop) {
        exitBarTop = new Image({ url: blackPixel, x: 0, y: 0, width: WIDTH, height: 0 });
        jsmaf.root.children.push(exitBarTop);
      }
      if (!exitBarBottom) {
        exitBarBottom = new Image({ url: blackPixel, x: 0, y: HEIGHT, width: WIDTH, height: 0 });
        jsmaf.root.children.push(exitBarBottom);
      }
      exitBarTop.visible = true;
      exitBarBottom.visible = true;
      exitBarTop.height = 0;
      exitBarBottom.height = 0;
      exitBarBottom.y = HEIGHT;

      exitAnimStart = now;
      exitAnimExitScheduled = false;
    }
  }

  function showMainElements(show) {
    background.visible = show;
    logoImg.visible = show;
    logoTextImg.visible = show;
    for (var i = 0; i < columns.length; i++) columns[i].visible = show;
    for (var i = 0; i < jars.length; i++) {
      jars[i].visible = show;
      jarsHover[i].visible = show && (i === selectedJar || i === hoverJar);
    }
    for (var i = 0; i < labels.length; i++) labels[i].visible = show;
  }

  // ==================== JAR ACTIONS ====================
  function handleJarAction(index) {
    // stop any apollo bgm instances before switching into included script to avoid race/duplicate audio
    try { if (window.__apollo_stop_all_bgm) window.__apollo_stop_all_bgm(); } catch (e) {}
    stopMusic();

    switch (index) {
      case 1: // Jailbreak loader.js
        log('Loading loader.js');
        include('loader.js');
        break;
      case 2: // Payload Menu payload_host.js in themes/apollo
        log('Loading themes/apollo/payload_host.js');
        include('themes/apollo/payload_host.js');
        break;
      case 5: // Settings config_ui.js in themes/apollo
        log('Loading themes/apollo/config_ui.js');
        include('themes/apollo/config_ui.js');
        break;
      case 6: // About About.js in themes/apollo
        log('Loading About.js');
        include('themes/apollo/About.js');
        break;
      default:
        log('Selected ' + jar_labels[index] + ' (no action yet)');
    }
  }

  // ==================== ANIMATION LOOP ====================
  mainLoopInterval = jsmaf.setInterval(function() {
    var now = Date.now();

    if (state === 'INTRO') {
      if (introStart === null) introStart = now;
      var elapsed = now - introStart;
      if (elapsed < 1000) introImg.alpha = elapsed / 1000;
      else if (elapsed < 3100) introImg.alpha = 1.0;
      else if (elapsed < 4100) introImg.alpha = 1.0 - (elapsed - 3100) / 1000;
      else {
        introImg.alpha = 0;
        setState('MAIN');
      }
    } else if (state === 'MAIN') {
      updateJarDisplay();

      if (whiteFlash.visible) {
        var flashElapsed = now - whiteFlashStart;
        var flashAlpha = Math.max(0, 1 - flashElapsed / 2000);
        whiteFlash.alpha = flashAlpha;
        if (flashAlpha <= 0) {
          whiteFlash.visible = false;
        }
      }
    } else if (state === 'SHUTDOWN') {
      if (shutdownStart === null) shutdownStart = now;
      var elapsed = now - shutdownStart;
      var progress = Math.min(1.0, elapsed / 4000);
      var barHeight = Math.round((HEIGHT / 2) * progress);
      blackBarTop.height = barHeight;
      blackBarBottom.height = barHeight;
      blackBarBottom.y = HEIGHT - barHeight;

      if (progress >= 1.0 && !shutdownExitScheduled) {
        shutdownExitScheduled = true;
        blackBarTop.height = Math.round(HEIGHT / 2);
        blackBarBottom.height = Math.round(HEIGHT / 2);
        blackBarBottom.y = Math.round(HEIGHT - Math.round(HEIGHT / 2));
        var delayFn = (typeof jsmaf.setTimeout === 'function') ? jsmaf.setTimeout : setTimeout;
        delayFn(function() {
          exitApplication();
        }, 40);
      }
    } else if (state === 'EXIT_ANIM') {
      if (exitAnimStart === null) exitAnimStart = now;
      var elapsed = now - exitAnimStart;
      var progress = Math.min(1.0, elapsed / 3000);
      var barHeight = Math.round((HEIGHT / 2) * progress);
      exitBarTop.height = barHeight;
      exitBarBottom.height = barHeight;
      exitBarBottom.y = HEIGHT - barHeight;

      if (progress >= 1.0 && !exitAnimExitScheduled) {
        exitAnimExitScheduled = true;
        exitBarTop.height = Math.round(HEIGHT / 2);
        exitBarBottom.height = Math.round(HEIGHT / 2);
        exitBarBottom.y = Math.round(HEIGHT - Math.round(HEIGHT / 2));
        var delayFn2 = (typeof jsmaf.setTimeout === 'function') ? jsmaf.setTimeout : setTimeout;
        delayFn2(function() {
          exitApplication();
        }, 40);
      }
    }
  }, 16);

  // ==================== KEYBOARD ====================
  jsmaf.onKeyDown = function(keyCode) {
    if (state === 'MAIN') {
      if (keyCode === 5 || keyCode === 56) {
        selectedJar = (selectedJar + 1) % jars.length;
        updateJarDisplay();
      } else if (keyCode === 7 || keyCode === 58) {
        selectedJar = (selectedJar - 1 + jars.length) % jars.length;
        updateJarDisplay();
      } else if (keyCode === 14) {
        handleJarAction(selectedJar);
      } else if (keyCode === 41) {
        setState('SHUTDOWN');
      } else if (keyCode === 13) {
        setState('EXIT_ANIM');
      }
    } else if (state === 'INTRO') {
      setState('MAIN');
    }
  };

  // ==================== MOUSE CLICK ====================
  if (typeof jsmaf.onMouseDown === 'function') {
    jsmaf.onMouseDown = function(button) {
      if (state === 'MAIN' && button === 1) {
        for (var i = 0; i < jarRects.length; i++) {
          var r = jarRects[i];
          if (mouseX >= r.x && mouseX <= r.x + r.width && mouseY >= r.y && mouseY <= r.y + r.height) {
            handleJarAction(i);
            break;
          }
        }
      }
    };
  }

  // ==================== START ====================
  setState('INTRO');
  log('Apollo Save Tool main menu loaded – press key 13 for exit animation');
})();
