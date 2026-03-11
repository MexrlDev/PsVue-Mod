// PsVue Flappy Bird Port
// By MexrlDev (2026)

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

  // Gameplay
  var GRAVITY = 0.5;
  var JUMP_FORCE = -10;
  var PIPE_SPEED = 5;
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

  // Layer containers (The fix i did for the bug, now itll see how thungs are layered and it'll finally work perfectly)
  var layers = {
    background: [],
    pipes: [],
    base: [],
    bird: [],
    ui: []
  };

  // Active pipe logical list
  var activePipes = [];

  // Unused pipe pool
  var unusedPipePool = [];

  var score = 0, lastScore = 0, highScore = 0;
  var pipeSpawnCounter = 0;
  var frameInterval = null;
  var pressedKeys = {};

  // UI refs
  var birdDownImg = null, birdMidImg = null, birdUpImg = null;
  var gameOverImg = null, startText = null, pausedText = null;
  var scoreText = null, lastScoreText = null;

  // Audio refs
  var jumpAudio = null, scoreAudio = null, hitAudio = null;

  // Preload cache for background toggles
  var preloaded = { 'background-day.png': null, 'background-night.png': null };
  var isNight = false;

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

  function loadSave() {
    fs.read(SAVE_PATH, function (err, data) {
      if (err) { log('No save file found'); return; }
      try {
        var s = JSON.parse(data || '{}');
        lastScore = s.lastScore || 0;
        highScore = s.highScore || 0;
        if (lastScoreText) lastScoreText.text = 'Last: ' + lastScore;
      } catch (e) {
        log('Failed to parse save.json: ' + e.message);
      }
    });
  }

  function saveProgress() {
    var saveData = { lastScore: score, highScore: Math.max(score, highScore) };
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
      // push existing objects in their current order
      for (var j = 0; j < arr.length; j++) children.push(arr[j]);
    }
    jsmaf.root.children.length = 0;
    for (var k = 0; k < children.length; k++) jsmaf.root.children.push(children[k]);
  }

  // Change layer order at runtime if needed
  function setLayerOrder(newOrder) {
    var ok = Array.isArray(newOrder) && newOrder.length === Object.keys(layers).length;
    if (!ok) return false;
    layerOrder = newOrder.slice();
    rebuildRootChildren();
    return true;
  }

  // Sum of lengths of layers before a given layer
  function getLayerStartIndex(layerName) {
    var idx = 0;
    for (var i = 0; i < layerOrder.length; i++) {
      var name = layerOrder[i];
      if (name === layerName) return idx;
      idx += layers[name].length;
    }
    return idx;
  }

  // ---------------- Preload / Toggle background ----------------
  function preloadBackgrounds() {
    try {
      preloaded['background-day.png'] = new Image({ url: ASSET_PATH + 'background-day.png', visible: false });
      preloaded['background-night.png'] = new Image({ url: ASSET_PATH + 'background-night.png', visible: false });
    } catch (e) { /* ignore if environment doesn't allow */ }
  }

  function toggleBackground() {
    isNight = !isNight;
    var file = isNight ? 'background-night.png' : 'background-day.png';
    for (var i = 0; i < layers.background.length; i++) {
      try { layers.background[i].url = ASSET_PATH + file; } catch (e) {}
    }
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

  // Obtain a pair from pool
  function obtainPipePair() {
    if (unusedPipePool.length > 0) return unusedPipePool.pop();
    // create on demand (rare)
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

  // Spawn uses pooled pair and sets positions
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

    // Release all active pipes to unused pool (hide them)
    for (var i = activePipes.length - 1; i >= 0; i--) {
      releasePipePair(activePipes[i]);
    }
    activePipes.length = 0;

    score = 0;
    pipeSpawnCounter = 0;
    updateScoreDisplay();
  }

  function gameOver() {
    gameState = STATE_GAMEOVER;
    paused = false;
    lastScore = score;
    saveProgress();
    if (hitAudio) try { hitAudio.play(false); } catch (e) {}
    if (gameOverImg) gameOverImg.visible = true;
    if (startText) { startText.text = 'Press X to restart, O to exit'; startText.visible = true; }
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

    // Move active pipes (update both image positions lol)
    for (var i = activePipes.length - 1; i >= 0; i--) {
      var p = activePipes[i];
      p.x -= PIPE_SPEED;
      if (p.top) p.top.x = p.x;
      if (p.bottom) p.bottom.x = p.x;

      // scoring
      if (!p.passed && p.x + PIPE_WIDTH < BIRD_X) {
        p.passed = true;
        score++;
        updateScoreDisplay();
        if (scoreAudio) try { scoreAudio.play(false); } catch (e) {}
      }

      // offscreen -> release back to pool (hide)
      if (p.x + PIPE_WIDTH < -50) {
        releasePipePair(p);
        activePipes.splice(i, 1);
      }
    }

    // Spawn logic
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

  // loop entry
  function gameLoop() { updateGame(); }

  // ---------------- Build UI ----------------
  function buildUI() {
    // clear jsmaf.root children and the layer arrays
    if (jsmaf.root && jsmaf.root.children) jsmaf.root.children.length = 0;
    for (var k in layers) if (layers.hasOwnProperty(k)) layers[k].length = 0;
    activePipes.length = 0;
    unusedPipePool.length = 0;

    preloadBackgrounds();

    // Background tiles
    var bgCount = Math.ceil(SCREEN_W / BG_WIDTH) + 2;
    for (var i = 0; i < bgCount; i++) {
      var bg = new Image({
        url: ASSET_PATH + 'background-day.png',
        x: i * BG_WIDTH,
        y: 0,
        width: BG_WIDTH,
        height: BG_HEIGHT
      });
      layers.background.push(bg);
    }

    // Create base tiles
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

    // Pipe pool creation
    createPipePool(PIPE_POOL_PAIRS);

    // UI elements
    new Style({ name: 'scoreStyle', color: 'white', size: 48, bold: true, shadow: true });
    scoreText = new jsmaf.Text(); scoreText.style = 'scoreStyle'; scoreText.x = 50; scoreText.y = 50; scoreText.text = 'Score: 0';
    lastScoreText = new jsmaf.Text(); lastScoreText.style = 'scoreStyle'; lastScoreText.x = 50; lastScoreText.y = 110; lastScoreText.text = 'Last: ' + lastScore;
    startText = new jsmaf.Text(); startText.style = 'scoreStyle'; startText.x = SCREEN_W / 2 - 200; startText.y = SCREEN_H / 2 + 20; startText.text = 'Press X to start'; startText.visible = true;
    new Style({ name: 'pausedStyle', color: 'white', size: 96, bold: true, shadow: true });
    pausedText = new jsmaf.Text(); pausedText.style = 'pausedStyle'; pausedText.x = SCREEN_W / 2 - 200; pausedText.y = SCREEN_H / 2 - 50; pausedText.text = 'PAUSED'; pausedText.visible = false;

    // GAME OVER
    gameOverImg = new Image({
      url: ASSET_PATH + 'gameover.png',
      x: (SCREEN_W - GAMEOVER_WIDTH) / 2,
      y: SCREEN_H / 2 - 100,
      width: GAMEOVER_WIDTH,
      height: GAMEOVER_HEIGHT,
      visible: false
    });

    layers.ui.push(gameOverImg, scoreText, lastScoreText, startText, pausedText);

    // Populate jsmaf.root.children from layers in the configured order
    rebuildRootChildren();

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

  // buttones mapping, edit it if you want lol
    if (keyCode === 3) {
      if (gameState === STATE_PLAYING) {
        paused = !paused;
        if (pausedText) pausedText.visible = paused;
      }
    } else if (keyCode === 14) {
      if (gameState === STATE_START) {
        startGame();
      } else if (gameState === STATE_PLAYING && !paused) {
        bird.vy = JUMP_FORCE;
        if (jumpAudio) try { jumpAudio.play(false); } catch (e) {}
      } else if (gameState === STATE_GAMEOVER) {
        startGame();
      }
    } else if (keyCode === 13) {
      goBack();
    } else if (keyCode === 15) {
      toggleBackground();
    }
  };

  jsmaf.onKeyUp = function (keyCode) { delete pressedKeys[keyCode]; };

  // ---------------- Cleanup ----------------
  function cleanup() {
    if (frameInterval) { jsmaf.clearInterval(frameInterval); frameInterval = null; }
    jsmaf.onKeyDown = null;
    jsmaf.onKeyUp = null;
    if (jsmaf.root && jsmaf.root.children) jsmaf.root.children.length = 0;
    for (var n in layers) if (layers.hasOwnProperty(n)) layers[n].length = 0;
    activePipes.length = 0; unusedPipePool.length = 0;
  }

  // Ensure single global instance cleanup across reloads
  var GLOBAL_KEY = '__flappyBirdLayered_v1';
  var prev = (typeof window !== 'undefined' && window[GLOBAL_KEY]) || null;
  if (prev && typeof prev.cleanup === 'function') { try { prev.cleanup(); } catch (e) {} }
  var instance = { cleanup: cleanup, setLayerOrder: setLayerOrder };
  if (typeof window !== 'undefined') window[GLOBAL_KEY] = instance;

  // ---------------- Init ----------------
  loadSave();
  buildUI();

  frameInterval = jsmaf.setInterval(gameLoop, 16);

  log('Flappy Bird Loaded... Press X to start.');

})();
