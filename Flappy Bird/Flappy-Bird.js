// PsVue Port By MexrlDev

(function () {
  // ---------- Configuration ----------
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var ASSET_PATH = 'file:///../download0/payloads/bird/';
  var SAVE_PATH = '/download0/payloads/bird/save.json';

  // Asset original dimensions
  var BG_ORIG_W = 288, BG_ORIG_H = 512;
  var BASE_ORIG_W = 336, BASE_ORIG_H = 112;
  var PIPE_ORIG_W = 52, PIPE_ORIG_H = 320;
  var BIRD_ORIG_W = 34, BIRD_ORIG_H = 24;
  var GAMEOVER_ORIG_W = 192, GAMEOVER_ORIG_H = 42;

  // Scaled dimensions
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

  // Game physics
  var GRAVITY = 0.5;
  var JUMP_FORCE = -10;
  var PIPE_SPEED = 5;
  var PIPE_SPACING = 500;
  var PIPE_GAP = 300;
  var BIRD_X = 300;

  // Game states
  var STATE_START = 0;
  var STATE_PLAYING = 1;
  var STATE_GAMEOVER = 2;
  var gameState = STATE_START;
  var paused = false;  // pause flag
  var isNight = false; // background mode

  // Game variables
  var bird = { x: BIRD_X, y: SCREEN_H / 2, vy: 0 };
  var pipes = [];
  var score = 0;
  var lastScore = 0;
  var highScore = 0;
  var frameInterval = null;
  var pipeSpawnCounter = 0;

  // UI elements
  var bgImages = [];
  var baseImages = [];
  var birdDownImg = null;
  var birdMidImg = null;
  var birdUpImg = null;
  var gameOverImg = null;
  var scoreText = null;
  var lastScoreText = null;
  var startText = null;
  var pausedText = null;
  var jumpAudio = null;
  var scoreAudio = null;
  var hitAudio = null;

  var pressedKeys = {};

  // ---------- File I/O ----------
  var fs = {
    write: function (filename, content, callback) {
      try {
        var xhr = new jsmaf.XMLHttpRequest();
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && callback) callback(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed'));
        };
        xhr.open('POST', 'file://..' + filename, true);
        xhr.send(content);
      } catch (e) { if (callback) callback(e); }
    },
    read: function (filename, callback) {
      try {
        var xhr = new jsmaf.XMLHttpRequest();
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && callback) callback(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed'), xhr.responseText);
        };
        xhr.open('GET', 'file://..' + filename, true);
        xhr.send();
      } catch (e) { if (callback) callback(e); }
    }
  };

  // ---------- Load save.json ----------
  function loadSave() {
    fs.read(SAVE_PATH, function (err, data) {
      if (err) {
        log('No save file found, starting fresh');
        return;
      }
      try {
        var saveData = JSON.parse(data || '{}');
        lastScore = saveData.lastScore || 0;
        highScore = saveData.highScore || 0;
        if (lastScoreText) lastScoreText.text = 'Last: ' + lastScore;
      } catch (e) {
        log('Failed to parse save.json: ' + e.message);
      }
    });
  }

  // ---------- Save progress ----------
  function saveProgress() {
    var saveData = {
      lastScore: score,
      highScore: Math.max(score, highScore)
    };
    var jsonStr = JSON.stringify(saveData, null, 2);
    fs.write(SAVE_PATH, jsonStr, function (err) {
      if (err) log('Failed to save progress: ' + err.message);
      else log('Progress saved');
    });
  }

  // ---------- Reset game ----------
  function resetGame() {
    bird.y = SCREEN_H / 2;
    bird.vy = 0;
    paused = false;
    if (pausedText) pausedText.visible = false;
    for (var i = jsmaf.root.children.length - 1; i >= 0; i--) {
      var child = jsmaf.root.children[i];
      if (child && child.pipePairId !== undefined) {
        jsmaf.root.children.splice(i, 1);
      }
    }
    pipes = [];
    score = 0;
    pipeSpawnCounter = 0;
    updateScoreDisplay();
  }

  // ---------- Spawn a new pipe pair ----------
  function spawnPipe() {
    var minGapY = PIPE_GAP;
    var maxGapY = SCREEN_H - GROUND_HEIGHT - PIPE_GAP;
    var gapY = Math.random() * (maxGapY - minGapY) + minGapY;

    var topPipe = new Image({
      url: ASSET_PATH + 'pipe-green-top.png',
      x: SCREEN_W,
      y: gapY - PIPE_GAP - PIPE_HEIGHT,
      width: PIPE_WIDTH,
      height: PIPE_HEIGHT,
      pipePairId: pipes.length
    });

    var bottomPipe = new Image({
      url: ASSET_PATH + 'pipe-green.png',
      x: SCREEN_W,
      y: gapY,
      width: PIPE_WIDTH,
      height: PIPE_HEIGHT,
      pipePairId: pipes.length
    });

    jsmaf.root.children.push(topPipe);
    jsmaf.root.children.push(bottomPipe);

    pipes.push({
      id: pipes.length,
      x: SCREEN_W,
      top: topPipe,
      bottom: bottomPipe,
      passed: false
    });
  }

  // ---------- Collision detection ----------
  function rectCollide(r1, r2) {
    return !(r2.x > r1.x + r1.w ||
             r2.x + r2.w < r1.x ||
             r2.y > r1.y + r1.h ||
             r2.y + r2.h < r1.y);
  }

  // ---------- Update score display ----------
  function updateScoreDisplay() {
    if (scoreText) scoreText.text = 'Score: ' + score;
    if (lastScoreText) lastScoreText.text = 'Last: ' + lastScore;
  }

  // ---------- Game over ----------
  function gameOver() {
    if (hitAudio) {
      try { hitAudio.play(false); } catch (e) {}
    }
    gameState = STATE_GAMEOVER;
    paused = false;
    if (pausedText) pausedText.visible = false;
    lastScore = score;
    saveProgress();
    if (gameOverImg) gameOverImg.visible = true;
    if (startText) {
      startText.text = 'Press X to restart, O to exit';
      startText.visible = true;
    }
  }

  // ---------- Start game ----------
  function startGame() {
    resetGame();
    gameState = STATE_PLAYING;
    if (gameOverImg) gameOverImg.visible = false;
    if (startText) startText.visible = false;
  }

  // ---------- Go back (exit) ----------
  function goBack() {
    log('Exiting to main menu...');
    saveProgress();
    cleanup();
    jsmaf.setTimeout(function () {
      debugging.restart();
    }, 100);
  }

  // ---------- Toggle day/night background ----------
  function toggleBackground() {
    isNight = !isNight;
    var bgName = isNight ? 'background-night.png' : 'background-day.png';
    for (var i = 0; i < bgImages.length; i++) {
      bgImages[i].url = ASSET_PATH + bgName;
    }
  }

  // ---------- Update game objects ----------
  function updateGame() {
    if (gameState !== STATE_PLAYING || paused) return;

    bird.vy += GRAVITY;
    bird.y += bird.vy;

    if (bird.y < 0) {
      bird.y = 0;
      bird.vy = 0;
    }
    if (bird.y + BIRD_HEIGHT > SCREEN_H - GROUND_HEIGHT) {
      gameOver();
      return;
    }

    // Update bird images position and alpha
    var downAlpha = 0, midAlpha = 0, upAlpha = 0;
    if (bird.vy < -2) {
      upAlpha = 1;
    } else if (bird.vy > 2) {
      downAlpha = 1;
    } else {
      midAlpha = 1;
    }

    if (birdDownImg) {
      birdDownImg.x = BIRD_X;
      birdDownImg.y = bird.y;
      birdDownImg.alpha = downAlpha;
    }
    if (birdMidImg) {
      birdMidImg.x = BIRD_X;
      birdMidImg.y = bird.y;
      birdMidImg.alpha = midAlpha;
    }
    if (birdUpImg) {
      birdUpImg.x = BIRD_X;
      birdUpImg.y = bird.y;
      birdUpImg.alpha = upAlpha;
    }

    // Move pipes
    for (var i = pipes.length - 1; i >= 0; i--) {
      var pipe = pipes[i];
      pipe.x -= PIPE_SPEED;
      if (pipe.top) pipe.top.x = pipe.x;
      if (pipe.bottom) pipe.bottom.x = pipe.x;

      if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
        pipe.passed = true;
        score++;
        if (scoreAudio) {
          try { scoreAudio.play(false); } catch (e) {}
        }
        updateScoreDisplay();
      }

      if (pipe.x + PIPE_WIDTH < 0) {
        if (pipe.top) {
          var idx = jsmaf.root.children.indexOf(pipe.top);
          if (idx >= 0) jsmaf.root.children.splice(idx, 1);
        }
        if (pipe.bottom) {
          var idx2 = jsmaf.root.children.indexOf(pipe.bottom);
          if (idx2 >= 0) jsmaf.root.children.splice(idx2, 1);
        }
        pipes.splice(i, 1);
      }
    }

    // Spawn pipes
    pipeSpawnCounter += PIPE_SPEED;
    if (pipeSpawnCounter >= PIPE_SPACING) {
      pipeSpawnCounter = 0;
      spawnPipe();
    }

    // Collision detection
    var birdRect = {
      x: BIRD_X,
      y: bird.y,
      w: BIRD_WIDTH,
      h: BIRD_HEIGHT
    };
    for (var j = 0; j < pipes.length; j++) {
      var p = pipes[j];
      var topRect = { x: p.x, y: p.top.y, w: PIPE_WIDTH, h: PIPE_HEIGHT };
      var bottomRect = { x: p.x, y: p.bottom.y, w: PIPE_WIDTH, h: PIPE_HEIGHT };
      if (rectCollide(birdRect, topRect) || rectCollide(birdRect, bottomRect)) {
        gameOver();
        break;
      }
    }

    // Scroll background
    for (var k = 0; k < bgImages.length; k++) {
      bgImages[k].x -= PIPE_SPEED / 3;
      if (bgImages[k].x + BG_WIDTH < 0) {
        bgImages[k].x = bgImages[(k + 1) % bgImages.length].x + BG_WIDTH;
      }
    }

    // Scroll base
    for (var k = 0; k < baseImages.length; k++) {
      baseImages[k].x -= PIPE_SPEED;
      if (baseImages[k].x + BASE_WIDTH < 0) {
        baseImages[k].x = baseImages[(k + 1) % baseImages.length].x + BASE_WIDTH;
      }
      var idx = jsmaf.root.children.indexOf(baseImages[k]);
      if (idx >= 0) {
        jsmaf.root.children.splice(idx, 1);
        jsmaf.root.children.push(baseImages[k]);
      }
    }

    // game over elements
    if (gameOverImg) {
      var idxGO = jsmaf.root.children.indexOf(gameOverImg);
      if (idxGO >= 0) {
        jsmaf.root.children.splice(idxGO, 1);
        jsmaf.root.children.push(gameOverImg);
      }
    }
    if (startText) {
      var idxST = jsmaf.root.children.indexOf(startText);
      if (idxST >= 0) {
        jsmaf.root.children.splice(idxST, 1);
        jsmaf.root.children.push(startText);
      }
    }
    if (pausedText) {
      var idxPT = jsmaf.root.children.indexOf(pausedText);
      if (idxPT >= 0) {
        jsmaf.root.children.splice(idxPT, 1);
        jsmaf.root.children.push(pausedText);
      }
    }
  }

  // ---------- Game loop ----------
  function gameLoop() {
    updateGame(); // this game used to get people addicted to it, this is why it was removed lol.
  }

  // ---------- Build UI ----------
  function buildUI() {
    if (jsmaf.root && jsmaf.root.children) jsmaf.root.children.length = 0;

    // Background tiles (start with day ofc like usal)
    var bgCount = Math.ceil(SCREEN_W / BG_WIDTH) + 15;
    for (var i = 0; i < bgCount; i++) {
      var bg = new Image({
        url: ASSET_PATH + 'background-day.png',
        x: i * BG_WIDTH,
        y: 0,
        width: BG_WIDTH,
        height: BG_HEIGHT
      });
      bgImages.push(bg);
      jsmaf.root.children.push(bg);
    }

    // Base tiles
    var baseCount = Math.ceil(SCREEN_W / BASE_WIDTH) + 15;
    for (var i = 0; i < baseCount; i++) {
      var base = new Image({
        url: ASSET_PATH + 'base.png',
        x: i * BASE_WIDTH,
        y: SCREEN_H - GROUND_HEIGHT,
        width: BASE_WIDTH,
        height: GROUND_HEIGHT
      });
      baseImages.push(base);
      jsmaf.root.children.push(base);
    }

    // Bird images
    birdDownImg = new Image({
      url: ASSET_PATH + 'yellowbird-downflap.png',
      x: BIRD_X,
      y: bird.y,
      width: BIRD_WIDTH,
      height: BIRD_HEIGHT,
      alpha: 0
    });
    jsmaf.root.children.push(birdDownImg);

    birdMidImg = new Image({
      url: ASSET_PATH + 'yellowbird-midflap.png',
      x: BIRD_X,
      y: bird.y,
      width: BIRD_WIDTH,
      height: BIRD_HEIGHT,
      alpha: 1
    });
    jsmaf.root.children.push(birdMidImg);

    birdUpImg = new Image({
      url: ASSET_PATH + 'yellowbird-upflap.png',
      x: BIRD_X,
      y: bird.y,
      width: BIRD_WIDTH,
      height: BIRD_HEIGHT,
      alpha: 0
    });
    jsmaf.root.children.push(birdUpImg);

    gameOverImg = new Image({
      url: ASSET_PATH + 'gameover.png',
      x: (SCREEN_W - GAMEOVER_WIDTH) / 2,
      y: SCREEN_H / 2 - 100,
      width: GAMEOVER_WIDTH,
      height: GAMEOVER_HEIGHT,
      visible: false
    });
    jsmaf.root.children.push(gameOverImg);

    new Style({ name: 'scoreStyle', color: 'white', size: 48, bold: true, shadow: true });
    scoreText = new jsmaf.Text();
    scoreText.style = 'scoreStyle';
    scoreText.x = 50;
    scoreText.y = 50;
    scoreText.text = 'Score: 0';
    jsmaf.root.children.push(scoreText);

    lastScoreText = new jsmaf.Text();
    lastScoreText.style = 'scoreStyle';
    lastScoreText.x = 50;
    lastScoreText.y = 110;
    lastScoreText.text = 'Last: ' + lastScore;
    jsmaf.root.children.push(lastScoreText);

    startText = new jsmaf.Text();
    startText.style = 'scoreStyle';
    startText.x = SCREEN_W / 2 - 200;
    startText.y = SCREEN_H / 2 + 20;
    startText.text = 'Press X to start';
    jsmaf.root.children.push(startText);

    // Paused text
    new Style({ name: 'pausedStyle', color: 'white', size: 96, bold: true, shadow: true });
    pausedText = new jsmaf.Text();
    pausedText.style = 'pausedStyle';
    pausedText.x = SCREEN_W / 2 - 200;
    pausedText.y = SCREEN_H / 2 - 50;
    pausedText.text = 'PAUSED';
    pausedText.visible = false;
    jsmaf.root.children.push(pausedText);

    // Audio
    jumpAudio = new jsmaf.AudioClip();
    jumpAudio.open(ASSET_PATH + 'jump.wav');
    jumpAudio.volume = 1.0;

    scoreAudio = new jsmaf.AudioClip();
    scoreAudio.open(ASSET_PATH + 'score.wav');
    scoreAudio.volume = 1.0;

    hitAudio = new jsmaf.AudioClip();
    hitAudio.open(ASSET_PATH + 'hit.wav');
    hitAudio.volume = 1.0;
  }

  // ---------- Keyboard Handling ----------
  jsmaf.onKeyDown = function (keyCode) {
    if (pressedKeys[keyCode]) return;
    pressedKeys[keyCode] = true;

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
        if (jumpAudio) jumpAudio.play(false);
      } else if (gameState === STATE_GAMEOVER) {
        startGame();
      }
    } else if (keyCode === 13) {
      goBack();
    } else if (keyCode === 15) {
      toggleBackground();
    }
  };

  jsmaf.onKeyUp = function (keyCode) {
    delete pressedKeys[keyCode];
  };

  // ---------- Cleanup for global state ----------
  function cleanup() {
    if (frameInterval) {
      jsmaf.clearInterval(frameInterval);
      frameInterval = null;
    }
    jsmaf.onKeyDown = null;
    jsmaf.onKeyUp = null;
    if (jsmaf.root && jsmaf.root.children) jsmaf.root.children.length = 0;
  }

  var GLOBAL_KEY = '__flappyBirdGame_v1';
  var prev = (typeof window !== 'undefined' && window[GLOBAL_KEY]) || null;
  if (prev && typeof prev.cleanup === 'function') {
    try { prev.cleanup(); } catch (e) {}
  }
  var instance = { cleanup: cleanup };
  if (typeof window !== 'undefined') window[GLOBAL_KEY] = instance;

  // ---------- Initialize ----------
  loadSave();
  buildUI();
  frameInterval = jsmaf.setInterval(gameLoop, 16);

  log('Flappy Bird started. Press X to play.');
})();