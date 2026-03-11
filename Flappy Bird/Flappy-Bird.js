// PsVue Flappy Bird Port
// By MexrlDev (2026)

// You may also use this code to learn, study, make projects

(function () {
  // ---------------- Config ----------------
  var SCREEN_W = 1920, SCREEN_H = 1080;
  var ASSET_PATH = 'file:///../download0/payloads/bird/';
  var SAVE_PATH = '/download0/payloads/bird/save.json';

  // Originals and scaled dimensions
  var BG_ORIG_W = 288, BG_ORIG_H = 512;
  var BASE_ORIG_W = 336, BASE_ORIG_H = 112;
  var PIPE_ORIG_W = 52, PIPE_ORIG_H = 320;
  var BIRD_ORIG_W = 34, BIRD_ORIG_H = 24;
  var GAMEOVER_ORIG_W = 192, GAMEOVER_ORIG_H = 42;

  var BG_SCALE = SCREEN_H / BG_ORIG_H;
  var BG_WIDTH = Math.round(BG_ORIG_W * BG_SCALE);
  var BG_HEIGHT = SCREEN_H;

  var BASE_SCALE = SCREEN_H / BG_ORIG_H;
  var BASE_WIDTH = Math.round(BASE_ORIG_W * BASE_SCALE);
  var BASE_HEIGHT = Math.round(BASE_ORIG_H * BASE_SCALE);
  var GROUND_HEIGHT = BASE_HEIGHT;

  var PIPE_SCALE = SCREEN_H / BG_ORIG_H;
  var PIPE_WIDTH = Math.round(PIPE_ORIG_W * PIPE_SCALE);
  var PIPE_HEIGHT = Math.round(PIPE_ORIG_H * PIPE_SCALE);

  var BIRD_SCALE = SCREEN_H / BG_ORIG_H;
  var BIRD_WIDTH = Math.round(BIRD_ORIG_W * BIRD_SCALE);
  var BIRD_HEIGHT = Math.round(BIRD_ORIG_H * BIRD_SCALE);

  var GAMEOVER_WIDTH = Math.round(GAMEOVER_ORIG_W * 1.5);
  var GAMEOVER_HEIGHT = Math.round(GAMEOVER_ORIG_H * 1.5);

  // Game Physics
  var GRAVITY = 0.5;
  var JUMP_FORCE = -10;

  // Speed ramp configuration
  var BASE_PIPE_SPEED = 5;        // starting speed
  var PIPE_SPEED = BASE_PIPE_SPEED;
  var MAX_PIPE_SPEED = 12;        // absolute cap lol, change this if you want to speed the game to insane levels
  var SPEED_STEP = 0.25;          // increase applied per passed pipe
  var PIPE_SPACING = 500;
  var PIPE_GAP = 300;
  var BIRD_X = 300;

  // Layers: change order here to modify draw order (So this is how thing are layered... background first = bottom)
  var layerOrder = ['background', 'pipes', 'base', 'bird', 'ui'];
  var PIPE_POOL_PAIRS = 6;

  // ---------------- State ----------------
  var STATE_START = 0, STATE_PLAYING = 1, STATE_GAMEOVER = 2;
  var gameState = STATE_START;
  var paused = false;

  var bird = { x: BIRD_X, y: SCREEN_H / 2, vy: 0 };

  // Layer containers (the fix i did before)
  var layers = {
    background: [],
    pipes: [],
    base: [],
    bird: [],
    ui: []
  };

  var activePipes = [];
  var unusedPipePool = [];

  // Game modes normal or my fav.. racer! .. idk what more to add lol
  var mode = 'normal';

  // Day/night flag
  var isNight = false;

  // Lifetime counter, this counts how many pipes you've been through so.. check your json if yourr curious
  var lifetimePipes = 0;

  var score = 0, lastScore = 0, highScore = 0;
  var pipeSpawnCounter = 0;
  var frameInterval = null;
  var pressedKeys = {};

  // UI refs
  var birdDownImg = null, birdMidImg = null, birdUpImg = null;
  var gameOverImg = null, startText = null, pausedText = null;
  var scoreText = null, lastScoreText = null, modeText = null;

  // Audio refs
  var jumpAudio = null, scoreAudio = null, hitAudio = null;

  // Preload cache
  var preloaded = { 'background-day.png': null, 'background-night.png': null };

  // Fade helpers, for the mode text ofc
  var modeFadeIntervalId = null;
  var modeFadeTimeoutId = null;

  // ---------------- File I/O ----------------
  var fs = {
    write: function (filename, content, cb) {
      try {
        var xhr = new jsmaf.XMLHttpRequest();
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && cb) cb(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed'));
        };
        xhr.open('POST', 'file://..' + filename, true);
        xhr.send(content);
      } catch (e) { if (cb) cb(e); }
    },
    read: function (filename, cb) {
      try {
        var xhr = new jsmaf.XMLHttpRequest();
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && cb) cb(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed'), xhr.responseText);
        };
        xhr.open('GET', 'file://..' + filename, true);
        xhr.send();
      } catch (e) { if (cb) cb(e); }
    }
  };

  function loadSave(cb) {
    fs.read(SAVE_PATH, function (err, data) {
      if (err) {
        // in case of no save file it'll use defaults
        if (cb) cb();
        return;
      }
      try {
        var s = JSON.parse(data || '{}');
        lastScore = typeof s.lastScore === 'number' ? s.lastScore : 0;
        highScore = typeof s.highScore === 'number' ? s.highScore : 0;
        mode = (s.mode === 'racer') ? 'racer' : 'normal';
        isNight = !!s.isNight;
        lifetimePipes = typeof s.lifetimePipes === 'number' ? s.lifetimePipes : 0;
        if (cb) cb();
      } catch (e) {
        log('Failed to parse save.json: ' + e.message);
        if (cb) cb();
      }
    });
  }

  // Save writes the stored lastScore, highScore, mode, isNight and lifetimePipes
  function saveProgress() {
    var saveData = {
      lastScore: lastScore,
      highScore: highScore,
      mode: mode,
      isNight: !!isNight,
      lifetimePipes: lifetimePipes
    };
    fs.write(SAVE_PATH, JSON.stringify(saveData, null, 2), function (err) {
      if (err) log('Failed to save: ' + err.message);
      else log('Saved progress');
    });
  }

  // ---------------- Layer helpers ----------------
  function rebuildRootChildren() {
    if (!jsmaf.root) return;
    var children = [];
    for (var i = 0; i < layerOrder.length; i++) {
      var name = layerOrder[i];
      var arr = layers[name] || [];
      for (var j = 0; j < arr.length; j++) children.push(arr[j]);
    }
    jsmaf.root.children.length = 0;
    for (var k = 0; k < children.length; k++) jsmaf.root.children.push(children[k]);
  }

  function setLayerOrder(newOrder) {
    var ok = Array.isArray(newOrder) && newOrder.length === Object.keys(layers).length;
    if (!ok) return false;
    layerOrder = newOrder.slice();
    rebuildRootChildren();
    return true;
  }

  // ---------------- Preload / Toggle background ----------------
  function preloadBackgrounds() {
    try {
      preloaded['background-day.png'] = new Image({ url: ASSET_PATH + 'background-day.png', visible: false });
      preloaded['background-night.png'] = new Image({ url: ASSET_PATH + 'background-night.png', visible: false });
    } catch (e) { /* ignore */ }
  }

  function toggleBackground(persist) {
    isNight = !isNight;
    var file = isNight ? 'background-night.png' : 'background-day.png';
    for (var i = 0; i < layers.background.length; i++) {
      try { layers.background[i].url = ASSET_PATH + file; } catch (e) {}
    }
    if (persist) saveProgress();
  }

  // ---------------- Pipe pool ----------------
  function createPipePool(poolPairs) {
    for (var i = 0; i < poolPairs; i++) {
      var top = new Image({
        url: ASSET_PATH + 'pipe-green-top.png',
        x: -9999, y: -9999,
        width: PIPE_WIDTH, height: PIPE_HEIGHT,
        visible: false
      });
      var bottom = new Image({
        url: ASSET_PATH + 'pipe-green.png',
        x: -9999, y: -9999,
        width: PIPE_WIDTH, height: PIPE_HEIGHT,
        visible: false
      });
      var entry = { top: top, bottom: bottom, active: false, x: -9999, passed: false };
      layers.pipes.push(top);
      layers.pipes.push(bottom);
      unusedPipePool.push(entry);
    }
  }

  function obtainPipePair() {
    if (unusedPipePool.length > 0) return unusedPipePool.pop();
    var top = new Image({
      url: ASSET_PATH + 'pipe-green-top.png',
      x: -9999, y: -9999,
      width: PIPE_WIDTH, height: PIPE_HEIGHT,
      visible: false
    });
    var bottom = new Image({
      url: ASSET_PATH + 'pipe-green.png',
      x: -9999, y: -9999,
      width: PIPE_WIDTH, height: PIPE_HEIGHT,
      visible: false
    });
    var entry = { top: top, bottom: bottom, active: false, x: -9999, passed: false };
    layers.pipes.push(top);
    layers.pipes.push(bottom);
    rebuildRootChildren();
    return entry;
  }

  function releasePipePair(entry) {
    if (!entry) return;
    entry.active = false;
    entry.passed = false;
    entry.x = -9999;
    try { entry.top.visible = false; entry.bottom.visible = false; } catch (e) {}
    unusedPipePool.push(entry);
  }

  function spawnPipe() {
    var minGapY = PIPE_GAP;
    var maxGapY = SCREEN_H - GROUND_HEIGHT - PIPE_GAP - 10;
    var gapY = Math.random() * Math.max(1, (maxGapY - minGapY)) + minGapY;

    var pair = obtainPipePair();
    pair.active = true;
    pair.passed = false;
    pair.x = SCREEN_W;

    pair.top.x = pair.x;
    pair.top.y = gapY - PIPE_GAP - PIPE_HEIGHT;
    pair.top.width = PIPE_WIDTH;
    pair.top.height = PIPE_HEIGHT;
    pair.top.visible = true;

    pair.bottom.x = pair.x;
    pair.bottom.y = gapY;
    pair.bottom.width = PIPE_WIDTH;
    pair.bottom.height = PIPE_HEIGHT;
    pair.bottom.visible = true;

    activePipes.push(pair);
  }

  // ---------------- Collision util ----------------
  function rectCollide(r1, r2) {
    return !(r2.x > r1.x + r1.w ||
             r2.x + r2.w < r1.x ||
             r2.y > r1.y + r1.h ||
             r2.y + r2.h < r1.y);
  }

  // ---------------- Mode text fade utilities ----------------
  function clearModeFadeTimers() {
    if (modeFadeIntervalId) { try { jsmaf.clearInterval(modeFadeIntervalId); } catch (e) {} modeFadeIntervalId = null; }
    if (modeFadeTimeoutId) { try { jsmaf.clearTimeout(modeFadeTimeoutId); } catch (e) {} modeFadeTimeoutId = null; }
  }

  function animateAlpha(element, from, to, duration, cb) {
    clearModeFadeTimers();
    var startTime = Date.now();
    element.alpha = from;
    element.visible = true;
    modeFadeIntervalId = jsmaf.setInterval(function () {
      var t = (Date.now() - startTime) / Math.max(1, duration);
      if (t >= 1) {
        element.alpha = to;
        try { jsmaf.clearInterval(modeFadeIntervalId); } catch (e) {}
        modeFadeIntervalId = null;
        if (cb) cb();
        return;
      }
      element.alpha = from + (to - from) * t;
    }, 16);
    return modeFadeIntervalId;
  }

  function showModeText(temporary) {
    if (!modeText) return;
    clearModeFadeTimers();
    // normal is lowercase; racer remains uppercase per request
    modeText.text = 'Game Mode: ' + (mode === 'racer' ? 'RACER' : 'normal');
    animateAlpha(modeText, 0, 1, 250, function () {
      if (temporary) {
        modeFadeTimeoutId = jsmaf.setTimeout(function () {
          animateAlpha(modeText, 1, 0, 250, function () { modeText.visible = false; });
        }, 1500);
      }
    });
  }

  // ---------------- UI / Game control ----------------
  function updateScoreDisplay() {
    if (scoreText) scoreText.text = 'Score: ' + score;
    if (lastScoreText) lastScoreText.text = 'Last: ' + lastScore;
  }

  function resetGame() {
    bird.y = SCREEN_H / 2;
    bird.vy = 0;
    paused = false;
    if (pausedText) pausedText.visible = false;

    for (var i = activePipes.length - 1; i >= 0; i--) {
      releasePipePair(activePipes[i]);
    }
    activePipes.length = 0;

    // reset gameplay variables including speed
    score = 0;
    pipeSpawnCounter = 0;
    PIPE_SPEED = BASE_PIPE_SPEED;

    // this tells the code to NOT reset lifetimePipes
    updateScoreDisplay();
  }

  function gameOver() {
    gameState = STATE_GAMEOVER;
    paused = false;

    // Update lastScore only if you user beat stored lastScore
    if (score > lastScore) {
      lastScore = score;
    }
    // Update highScore if needed
    if (score > highScore) highScore = score;

    // Persist lastScore, highScore, mode, isNight and lifetimePipes
    saveProgress();

    if (hitAudio) try { hitAudio.play(false); } catch (e) {}
    if (gameOverImg) gameOverImg.visible = true;
    if (startText) { startText.text = 'Press X to restart, O to exit'; startText.visible = true; }
    updateScoreDisplay();
  }

  function startGame() {
    resetGame();
    gameState = STATE_PLAYING;
    if (gameOverImg) gameOverImg.visible = false;
    if (startText) startText.visible = false;
  }

  function goBack() {
    saveProgress();
    cleanup();
    jsmaf.setTimeout(function () { try { debugging.restart(); } catch (e) {} }, 100);
  }

  // ---------------- Update loop ----------------
  function updateGame() {
    if (gameState !== STATE_PLAYING || paused) return;

    // Bird physics
    bird.vy += GRAVITY;
    bird.y += bird.vy;
    if (bird.y < 0) { bird.y = 0; bird.vy = 0; }
    if (bird.y + BIRD_HEIGHT > SCREEN_H - GROUND_HEIGHT) { gameOver(); return; }

    // Bird sprite updates
    if (birdDownImg) { birdDownImg.x = BIRD_X; birdDownImg.y = bird.y; birdDownImg.alpha = 0; }
    if (birdMidImg) { birdMidImg.x = BIRD_X; birdMidImg.y = bird.y; birdMidImg.alpha = 0; }
    if (birdUpImg) { birdUpImg.x = BIRD_X; birdUpImg.y = bird.y; birdUpImg.alpha = 0; }
    if (bird.vy < -2) { if (birdUpImg) birdUpImg.alpha = 1; }
    else if (bird.vy > 2) { if (birdDownImg) birdDownImg.alpha = 1; }
    else { if (birdMidImg) birdMidImg.alpha = 1; }

    // Move active pipes
    for (var i = activePipes.length - 1; i >= 0; i--) {
      var p = activePipes[i];
      p.x -= PIPE_SPEED;
      if (p.top) p.top.x = p.x;
      if (p.bottom) p.bottom.x = p.x;

      // scoring
      if (!p.passed && p.x + PIPE_WIDTH < BIRD_X) {
        p.passed = true;
        score++;
        // lifetime counter increments for every passed pipe
        lifetimePipes++;
        // increase speed each time you user score only in racer mode
        if (mode === 'racer') {
          PIPE_SPEED = Math.min(MAX_PIPE_SPEED, PIPE_SPEED + SPEED_STEP);
        }
        updateScoreDisplay();
        if (scoreAudio) try { scoreAudio.play(false); } catch (e) {}
      }

      // offscreen - release back to pool
      if (p.x + PIPE_WIDTH < -50) {
        releasePipePair(p);
        activePipes.splice(i, 1);
      }
    }

    // Spawn logic (pipeSpawnCounter scaled by current speed)
    pipeSpawnCounter += PIPE_SPEED;
    if (pipeSpawnCounter >= PIPE_SPACING) {
      pipeSpawnCounter = 0;
      spawnPipe(); // uses pool
    }

    // Collisions
    var birdRect = { x: BIRD_X, y: bird.y, w: BIRD_WIDTH, h: BIRD_HEIGHT };
    for (var j = 0; j < activePipes.length; j++) {
      var q = activePipes[j];
      if (!q.top || !q.bottom) continue;
      var topRect = { x: q.x, y: q.top.y, w: PIPE_WIDTH, h: PIPE_HEIGHT };
      var botRect = { x: q.x, y: q.bottom.y, w: PIPE_WIDTH, h: PIPE_HEIGHT };
      if (rectCollide(birdRect, topRect) || rectCollide(birdRect, botRect)) { gameOver(); break; }
    }

    // Scroll background tiles deterministically
    for (var bi = 0; bi < layers.background.length; bi++) {
      var bg = layers.background[bi];
      bg.x -= PIPE_SPEED / 3;
      if (bg.x + BG_WIDTH < 0) bg.x += BG_WIDTH * layers.background.length;
    }

    // Scroll base tiles deterministically
    for (var bi2 = 0; bi2 < layers.base.length; bi2++) {
      var base = layers.base[bi2];
      base.x -= PIPE_SPEED;
      if (base.x + BASE_WIDTH < 0) base.x += BASE_WIDTH * layers.base.length;
    }

    // UI visibility
    if (gameOverImg) gameOverImg.visible = (gameState === STATE_GAMEOVER);
    if (startText) startText.visible = (gameState === STATE_START || gameState === STATE_GAMEOVER);
    if (pausedText) pausedText.visible = paused;
  }

  function gameLoop() { updateGame(); }

  // ---------------- Build UI ----------------
  function buildUI() {
    if (jsmaf.root && jsmaf.root.children) jsmaf.root.children.length = 0;
    for (var k in layers) if (layers.hasOwnProperty(k)) layers[k].length = 0;
    activePipes.length = 0;
    unusedPipePool.length = 0;

    preloadBackgrounds();

    // Background tiles - use saved isNight
    var bgFile = isNight ? 'background-night.png' : 'background-day.png';
    var bgCount = Math.ceil(SCREEN_W / BG_WIDTH) + 2;
    for (var i = 0; i < bgCount; i++) {
      var bg = new Image({
        url: ASSET_PATH + bgFile,
        x: i * BG_WIDTH,
        y: 0,
        width: BG_WIDTH,
        height: BG_HEIGHT
      });
      layers.background.push(bg);
    }

    // Base tiles
    var baseCount = Math.ceil(SCREEN_W / BASE_WIDTH) + 2;
    for (var b = 0; b < baseCount; b++) {
      var base = new Image({
        url: ASSET_PATH + 'base.png',
        x: b * BASE_WIDTH,
        y: SCREEN_H - GROUND_HEIGHT,
        width: BASE_WIDTH,
        height: GROUND_HEIGHT
      });
      layers.base.push(base);
    }

    // Bird sprites
    birdDownImg = new Image({ url: ASSET_PATH + 'yellowbird-downflap.png', x: BIRD_X, y: bird.y, width: BIRD_WIDTH, height: BIRD_HEIGHT, alpha: 0 });
    birdMidImg = new Image({ url: ASSET_PATH + 'yellowbird-midflap.png', x: BIRD_X, y: bird.y, width: BIRD_WIDTH, height: BIRD_HEIGHT, alpha: 1 });
    birdUpImg = new Image({ url: ASSET_PATH + 'yellowbird-upflap.png', x: BIRD_X, y: bird.y, width: BIRD_WIDTH, height: BIRD_HEIGHT, alpha: 0 });
    layers.bird.push(birdDownImg, birdMidImg, birdUpImg);

    // Pipe pool
    createPipePool(PIPE_POOL_PAIRS);

    // UI elements
    new Style({ name: 'scoreStyle', color: 'white', size: 48, bold: true, shadow: true });
    scoreText = new jsmaf.Text(); scoreText.style = 'scoreStyle'; scoreText.x = 50; scoreText.y = 50; scoreText.text = 'Score: 0';
    lastScoreText = new jsmaf.Text(); lastScoreText.style = 'scoreStyle'; lastScoreText.x = 50; lastScoreText.y = 110; lastScoreText.text = 'Last: ' + lastScore;

    // Mode text (hidden by default, placed under lastScore)
    modeText = new jsmaf.Text();
    modeText.style = 'scoreStyle';
    modeText.x = 50;
    modeText.y = lastScoreText.y + 48; // under last score
    modeText.text = 'Game Mode: ' + (mode === 'racer' ? 'RACER' : 'normal');
    modeText.visible = false;
    modeText.alpha = 0;

    startText = new jsmaf.Text(); startText.style = 'scoreStyle'; startText.x = SCREEN_W / 2 - 200; startText.y = SCREEN_H / 2 + 20; startText.text = 'Press X to start'; startText.visible = true;
    new Style({ name: 'pausedStyle', color: 'white', size: 96, bold: true, shadow: true });
    pausedText = new jsmaf.Text(); pausedText.style = 'pausedStyle'; pausedText.x = SCREEN_W / 2 - 200; pausedText.y = SCREEN_H / 2 - 50; pausedText.text = 'PAUSED'; pausedText.visible = false;

    // GAME OVER image
    gameOverImg = new Image({
      url: ASSET_PATH + 'gameover.png',
      x: (SCREEN_W - GAMEOVER_WIDTH) / 2,
      y: SCREEN_H / 2 - 100,
      width: GAMEOVER_WIDTH,
      height: GAMEOVER_HEIGHT,
      visible: false
    });

    layers.ui.push(gameOverImg, scoreText, lastScoreText, modeText, startText, pausedText);

    // Build root children according to layerOrder
    rebuildRootChildren();

    // Audio
    try {
      jumpAudio = new jsmaf.AudioClip(); jumpAudio.open(ASSET_PATH + 'jump.wav'); jumpAudio.volume = 1.0;
      scoreAudio = new jsmaf.AudioClip(); scoreAudio.open(ASSET_PATH + 'score.wav'); scoreAudio.volume = 1.0;
      hitAudio = new jsmaf.AudioClip(); hitAudio.open(ASSET_PATH + 'hit.wav'); hitAudio.volume = 1.0;
    } catch (e) { jumpAudio = scoreAudio = hitAudio = null; }
  }

  // ---------------- Input handlers ----------------
  jsmaf.onKeyDown = function (keyCode) {
    if (pressedKeys[keyCode]) return;
    pressedKeys[keyCode] = true;

    // Start button (3) - pause/unpause if playing
    if (keyCode === 3) {
      if (gameState === STATE_PLAYING) {
        paused = !paused;
        if (pausedText) pausedText.visible = paused;
      }
    }
    // X button (14)
    else if (keyCode === 14) {
      if (gameState === STATE_START) {
        // show mode briefly on first start too
        showModeText(true);
        startGame();
      } else if (gameState === STATE_PLAYING && !paused) {
        bird.vy = JUMP_FORCE;
        if (jumpAudio) try { jumpAudio.play(false); } catch (e) {}
      } else if (gameState === STATE_GAMEOVER) {
        startGame();
      }
    }
    // O button (13) exits
    else if (keyCode === 13) {
      goBack();
    }
    // Square toggle background (15)
    else if (keyCode === 15) {
      toggleBackground(true);
    }
    // Triangle: Toggle mode (12)
    else if (keyCode === 12) {
      // toggle mode
      mode = (mode === 'racer') ? 'normal' : 'racer';
      // immediate visual feedback
      showModeText(true);
      // if switching to normal, reset the speed to base to stop ramp
      if (mode === 'normal') {
        PIPE_SPEED = BASE_PIPE_SPEED;
      }
      // persist the mode change (and lifetime is saved on next saveProgress)
      saveProgress();
    }
  };

  jsmaf.onKeyUp = function (keyCode) { delete pressedKeys[keyCode]; };

  // ---------------- Cleanup ----------------
  function cleanup() {
    if (frameInterval) { jsmaf.clearInterval(frameInterval); frameInterval = null; }
    jsmaf.onKeyDown = null;
    jsmaf.onKeyUp = null;
    clearModeFadeTimers();
    if (jsmaf.root && jsmaf.root.children) jsmaf.root.children.length = 0;
    for (var n in layers) if (layers.hasOwnProperty(n)) layers[n].length = 0;
    activePipes.length = 0; unusedPipePool.length = 0;
  }

  var GLOBAL_KEY = '__flappyBirdLayered_v4';
  var prev = (typeof window !== 'undefined' && window[GLOBAL_KEY]) || null;
  if (prev && typeof prev.cleanup === 'function') { try { prev.cleanup(); } catch (e) {} }
  var instance = { cleanup: cleanup, setLayerOrder: setLayerOrder };
  if (typeof window !== 'undefined') window[GLOBAL_KEY] = instance;

  // ---------------- Init ----------------
  // load save then build UI so saved mode/isNight and lifetimePipes are applied
  loadSave(function () {
    buildUI();
    // ensure starting speed is base
    PIPE_SPEED = BASE_PIPE_SPEED;
    frameInterval = jsmaf.setInterval(gameLoop, 16);
    log('Flappy Bird Loaded! press X to start....');
  });

})();
