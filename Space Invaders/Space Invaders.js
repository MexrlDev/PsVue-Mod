// Vue Space Invaders

// Author: MexrlDev 2026

(function () {
  // ---------------- Configuration ----------------
  var SCREEN_W = 1920, SCREEN_H = 1080;
  var ASSET_PATH = 'file:///../download0/payloads/invaders/';
  var SAVE_PATH = '/download0/payloads/invaders/save.json';

  // Original dimensions
  var BG_ORIG_W = 640, BG_ORIG_H = 960;
  var CANNON_ORIG_W = 64, CANNON_ORIG_H = 48;
  var ALIEN_ORIG_W = 48, ALIEN_ORIG_H = 32;
  var BULLET_ORIG_W = 8, BULLET_ORIG_H = 16;
  var POWERUP_ORIG_W = 30, POWERUP_ORIG_H = 30;
  var LOGO_ORIG_W = 315, LOGO_ORIG_H = 219;

  var SCALE = SCREEN_H / BG_ORIG_H;

  var CANNON_WIDTH = Math.round(CANNON_ORIG_W * SCALE);
  var CANNON_HEIGHT = Math.round(CANNON_ORIG_H * SCALE);
  var ALIEN_WIDTH = Math.round(ALIEN_ORIG_W * SCALE);
  var ALIEN_HEIGHT = Math.round(ALIEN_ORIG_H * SCALE);
  var BULLET_WIDTH = Math.round(BULLET_ORIG_W * SCALE);
  var BULLET_HEIGHT = Math.round(BULLET_ORIG_H * SCALE);
  var POWERUP_SIZE = Math.round(POWERUP_ORIG_W * SCALE);
  var LOGO_WIDTH = Math.round(LOGO_ORIG_W * SCALE);
  var LOGO_HEIGHT = Math.round(LOGO_ORIG_H * SCALE);

  // Game area
  var GAME_LEFT = 100;
  var GAME_RIGHT = SCREEN_W - 100;
  var GAME_TOP = 150;
  var GAME_BOTTOM = SCREEN_H - 150;

  // Cannon.. shooter
  var CANNON_SPEED = 12;
  var cannon = { x: (SCREEN_W - CANNON_WIDTH) / 2, y: GAME_BOTTOM };

  // Aliens
  var ALIEN_SPACING_X = 150;
  var ALIEN_SPACING_Y = 100;
  var ALIEN_BASE_SPEED = 1.2;
  var ALIEN_SPEED_INCR = 0.15;
  var ALIEN_MAX_SPEED = 4.0;
  var ALIEN_DROP_STEP = 15;

  // Wave configuration
  var BASE_ROWS = 3;
  var BASE_COLS = 5;
  var MAX_ROWS = 8;
  var MAX_COLS = 12;

  // Bullets
  var PLAYER_BULLET_SPEED = -15;
  var ALIEN_BULLET_BASE_SPEED = 5;
  var ALIEN_BULLET_SPEED_INCR = 0.8;
  var PLAYER_FIRE_COOLDOWN = 15;
  var LASER_FIRE_INTERVAL = 5;

  // Alien firing
  var ALIEN_FIRE_INTERVAL = 84;
  var ALIEN_FIRE_VARIATION = 20;
  var BASE_FIRE_PROB = 0.25;

  // Power‑ups
  var POWERUP_SPEED = 5;
  var POWERUP_CHANCE = 0.15;
  var POWERUP_TYPES = ['spread', 'laser', 'extra', 'shield'];
  var POWERUP_DURATION = 660;
  var SHIELD_DURATION = 300;

  // Spread levels
  var MAX_SPREAD_LEVEL = 5;

  // Active power‑ups
  var activePowerups = {
    spread: { timer: 0, level: 0 },
    laser: 0,
    shield: 0
  };

  var laserFireCounter = 0;

  // Hard mode progression (increases alien bullet speed)
  var hardModeBonusSpeed = 0;  // each win adds +2 to alien bullet speed
  var WIN_WAVE_THRESHOLD = 10;

  // Layers
  var layerOrder = ['background', 'aliens', 'powerups', 'player_bullets', 'alien_bullets', 'cannon', 'shield', 'ui'];

  // ---------------- Global State ----------------
  var STATE_START = 0, STATE_PLAYING = 1, STATE_GAMEOVER = 2, STATE_WIN = 3;
  var gameState = STATE_START;
  var paused = false;

  var layers = {
    background: [],
    aliens: [],
    powerups: [],
    player_bullets: [],
    alien_bullets: [],
    cannon: [],
    shield: [],
    ui: []
  };

  // Object pools (larger pools to avoid starvation)
  var alienPool = [];
  var playerBulletPool = [];
  var alienBulletPool = [];
  var powerupPool = [];

  var activeAliens = [];
  var activePlayerBullets = [];
  var activeAlienBullets = [];
  var activePowerupsList = [];

  // Player
  var lives = 3;
  var score = 0;
  var highScore = 0;
  var wave = 1;
  var fireCooldown = 0;

  // Background scrolling
  var bgY1 = 0, bgY2 = -SCREEN_H;
  var bgScrollSpeed = 2;

  // UI elements
  var scoreText, highScoreText, livesText, waveText;
  var startText, gameOverText, pausedText, winText;
  var logoImg;
  var shieldImg;

  // Audio
  var shootAudio, explodeAudio, powerupAudio;

  // File I/O
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
      if (err) { if (cb) cb(); return; }
      try {
        var s = JSON.parse(data || '{}');
        highScore = typeof s.highScore === 'number' ? s.highScore : 0;
      } catch (e) { log('Parse error: ' + e.message); }
      if (cb) cb();
    });
  }

  function saveProgress() {
    var saveData = { highScore: highScore, lastWave: wave };
    fs.write(SAVE_PATH, JSON.stringify(saveData), function (err) {
      if (err) log('Save failed: ' + err.message);
      else log('Progress saved');
    });
  }

  // ---------------- Layer helpers ----------------
  function rebuildRootChildren() {
    if (!jsmaf.root) return;
    var children = [];
    for (var i = 0; i < layerOrder.length; i++) {
      var arr = layers[layerOrder[i]] || [];
      for (var j = 0; j < arr.length; j++) children.push(arr[j]);
    }
    jsmaf.root.children.length = 0;
    for (var k = 0; k < children.length; k++) jsmaf.root.children.push(children[k]);
  }

  // ---------------- Object Pools (with on-demand creation) ----------------
  function createAlienPool(size) {
    for (var i = 0; i < size; i++) {
      var img = new Image({
        url: ASSET_PATH + 'alien1.png',
        x: -1000, y: -1000,
        width: ALIEN_WIDTH, height: ALIEN_HEIGHT,
        visible: false
      });
      layers.aliens.push(img);
      alienPool.push({
        img: img,
        active: false,
        type: 1,
        x: 0, y: 0,
        dir: 1,
        fireTimer: 0
      });
    }
  }

  function obtainAlien(type, x, y) {
    var a;
    if (alienPool.length > 0) {
      a = alienPool.pop();
    } else {
      var img = new Image({
        url: ASSET_PATH + 'alien1.png',
        x: -1000, y: -1000,
        width: ALIEN_WIDTH, height: ALIEN_HEIGHT,
        visible: false
      });
      layers.aliens.push(img);
      a = { img: img, active: false, fireTimer: 0 };
    }
    a.active = true;
    a.type = type;
    a.x = x;
    a.y = y;
    a.dir = Math.random() < 0.5 ? 1 : -1;
    a.fireTimer = Math.floor(Math.random() * ALIEN_FIRE_INTERVAL);
    a.img.url = ASSET_PATH + 'alien' + type + '.png';
    a.img.x = x; a.img.y = y;
    a.img.visible = true;
    activeAliens.push(a);
    return a;
  }

  function releaseAlien(a) {
    a.active = false;
    a.img.visible = false;
    a.img.x = -1000; a.img.y = -1000;
    var idx = activeAliens.indexOf(a);
    if (idx >= 0) activeAliens.splice(idx, 1);
    alienPool.push(a);
  }

  function createPlayerBulletPool(size) {
    for (var i = 0; i < size; i++) {
      var img = new Image({
        url: ASSET_PATH + 'bullet_player.png',
        x: -1000, y: -1000,
        width: BULLET_WIDTH, height: BULLET_HEIGHT,
        visible: false
      });
      layers.player_bullets.push(img);
      playerBulletPool.push({
        img: img,
        active: false,
        x: 0, y: 0
      });
    }
  }

  function obtainPlayerBullet(x, y) {
    var b;
    if (playerBulletPool.length > 0) {
      b = playerBulletPool.pop();
    } else {
      var img = new Image({
        url: ASSET_PATH + 'bullet_player.png',
        x: -1000, y: -1000,
        width: BULLET_WIDTH, height: BULLET_HEIGHT,
        visible: false
      });
      layers.player_bullets.push(img);
      b = { img: img, active: false };
    }
    b.active = true;
    b.x = x;
    b.y = y;
    b.img.x = x; b.img.y = y;
    b.img.visible = true;
    activePlayerBullets.push(b);
    return b;
  }

  function releasePlayerBullet(b) {
    b.active = false;
    b.img.visible = false;
    b.img.x = -1000; b.img.y = -1000;
    var idx = activePlayerBullets.indexOf(b);
    if (idx >= 0) activePlayerBullets.splice(idx, 1);
    playerBulletPool.push(b);
  }

  function createAlienBulletPool(size) {
    for (var i = 0; i < size; i++) {
      var img = new Image({
        url: ASSET_PATH + 'bullet_alien.png',
        x: -1000, y: -1000,
        width: BULLET_WIDTH, height: BULLET_HEIGHT,
        visible: false
      });
      layers.alien_bullets.push(img);
      alienBulletPool.push({
        img: img,
        active: false,
        x: 0, y: 0
      });
    }
  }

  function obtainAlienBullet(x, y) {
    var b;
    if (alienBulletPool.length > 0) {
      b = alienBulletPool.pop();
    } else {
      var img = new Image({
        url: ASSET_PATH + 'bullet_alien.png',
        x: -1000, y: -1000,
        width: BULLET_WIDTH, height: BULLET_HEIGHT,
        visible: false
      });
      layers.alien_bullets.push(img);
      b = { img: img, active: false };
    }
    b.active = true;
    b.x = x;
    b.y = y;
    b.img.x = x; b.img.y = y;
    b.img.visible = true;
    activeAlienBullets.push(b);
    return b;
  }

  function releaseAlienBullet(b) {
    b.active = false;
    b.img.visible = false;
    b.img.x = -1000; b.img.y = -1000;
    var idx = activeAlienBullets.indexOf(b);
    if (idx >= 0) activeAlienBullets.splice(idx, 1);
    alienBulletPool.push(b);
  }

  function createPowerupPool(size) {
    for (var i = 0; i < size; i++) {
      var img = new Image({
        url: ASSET_PATH + 'powerup_extra.png',
        x: -1000, y: -1000,
        width: POWERUP_SIZE, height: POWERUP_SIZE,
        visible: false
      });
      layers.powerups.push(img);
      powerupPool.push({
        img: img,
        active: false,
        type: 'extra',
        x: 0, y: 0
      });
    }
  }

  function obtainPowerup(type, x, y) {
    var p;
    if (powerupPool.length > 0) {
      p = powerupPool.pop();
    } else {
      var img = new Image({
        url: ASSET_PATH + 'powerup_extra.png',
        x: -1000, y: -1000,
        width: POWERUP_SIZE, height: POWERUP_SIZE,
        visible: false
      });
      layers.powerups.push(img);
      p = { img: img, active: false, type: 'extra' };
    }
    p.active = true;
    p.type = type;
    p.x = x;
    p.y = y;
    var f = type === 'spread' ? 'powerup_spread.png' :
            type === 'laser' ? 'powerup_laser.png' :
            type === 'shield' ? 'powerup_shield.png' : 'powerup_extra.png';
    p.img.url = ASSET_PATH + f;
    p.img.x = x; p.img.y = y;
    p.img.visible = true;
    activePowerupsList.push(p);
    return p;
  }

  function releasePowerup(p) {
    p.active = false;
    p.img.visible = false;
    p.img.x = -1000; p.img.y = -1000;
    var idx = activePowerupsList.indexOf(p);
    if (idx >= 0) activePowerupsList.splice(idx, 1);
    powerupPool.push(p);
  }

  // ---------------- Spawn Wave ----------------
  function spawnWave() {
    for (var i = activeAliens.length - 1; i >= 0; i--) releaseAlien(activeAliens[i]);

    var extra = Math.floor((wave - 1) / 3);
    var rows = Math.min(MAX_ROWS, BASE_ROWS + extra);
    var cols = Math.min(MAX_COLS, BASE_COLS + extra);

    var startX = (SCREEN_W - (cols * (ALIEN_WIDTH + ALIEN_SPACING_X))) / 2;
    var startY = GAME_TOP + 30;

    for (var row = 0; row < rows; row++) {
      var type;
      if (row === rows - 1) type = 3;
      else if (row === rows - 2) type = 2;
      else type = 1;

      for (var col = 0; col < cols; col++) {
        var x = startX + col * (ALIEN_WIDTH + ALIEN_SPACING_X);
        var y = startY + row * (ALIEN_HEIGHT + ALIEN_SPACING_Y);
        obtainAlien(type, x, y);
      }
    }
  }

  // ---------------- Reset Game (preserves hardModeBonusSpeed) ----------------
  function resetGame() {
    lives = 3;
    score = 0;
    wave = 1;
    activePowerups.spread.timer = 0;
    activePowerups.spread.level = 0;
    activePowerups.laser = 0;
    activePowerups.shield = 0;
    fireCooldown = 0;
    laserFireCounter = 0;

    for (var i = activePlayerBullets.length - 1; i >= 0; i--) releasePlayerBullet(activePlayerBullets[i]);
    for (var j = activeAlienBullets.length - 1; j >= 0; j--) releaseAlienBullet(activeAlienBullets[j]);
    for (var k = activePowerupsList.length - 1; k >= 0; k--) releasePowerup(activePowerupsList[k]);

    spawnWave();

    cannon.x = (SCREEN_W - CANNON_WIDTH) / 2;
    cannon.y = GAME_BOTTOM;

    gameState = STATE_PLAYING;
    if (logoImg) logoImg.visible = false;
    if (startText) startText.visible = false;
    if (gameOverText) gameOverText.visible = false;
    if (winText) winText.visible = false;
    if (pausedText) pausedText.visible = false;
    if (shieldImg) shieldImg.visible = false;
    updateUI();
  }

  // ---------------- UI Update ----------------
  function updateUI() {
    if (scoreText) scoreText.text = 'Score: ' + score;
    if (highScoreText) highScoreText.text = 'High: ' + highScore;
    if (livesText) livesText.text = 'Lives: ' + lives;
    var spreadInfo = activePowerups.spread.level > 0 ? ' Spread Lv.' + activePowerups.spread.level : '';
    if (waveText) waveText.text = 'Wave: ' + wave + spreadInfo;
  }

  // ---------------- Game Over ----------------
  function gameOver() {
    gameState = STATE_GAMEOVER;
    if (score > highScore) {
      highScore = score;
      saveProgress();
    }
    if (gameOverText) gameOverText.visible = true;
    if (startText) startText.visible = true;
    startText.text = 'Press X to restart';
    updateUI();
  }

  // ---------------- Win (after wave 10) ----------------
  function winGame() {
    gameState = STATE_WIN;
    if (score > highScore) {
      highScore = score;
      saveProgress();
    }
    if (winText) winText.visible = true;
    if (startText) startText.visible = true;
    startText.text = 'Press X to restart with HARDER MODE!';
    updateUI();
  }

  // ---------------- Next Wave ----------------
  function nextWave() {
    wave++;
    score += 500 * wave;

    for (var i = activePlayerBullets.length - 1; i >= 0; i--) releasePlayerBullet(activePlayerBullets[i]);
    for (var j = activeAlienBullets.length - 1; j >= 0; j--) releaseAlienBullet(activeAlienBullets[j]);

    cannon.x = (SCREEN_W - CANNON_WIDTH) / 2;
    cannon.y = GAME_BOTTOM;
    if (layers.cannon[0]) {
      layers.cannon[0].x = cannon.x;
      layers.cannon[0].y = cannon.y;
    }

    // After completing wave 10 (wave becomes 11), trigger win
    if (wave > WIN_WAVE_THRESHOLD) {
      winGame();
      return;
    }

    spawnWave();
  }

  // ---------------- Collision Helpers ----------------
  function rectCollide(r1, r2) {
    return !(r2.x > r1.x + r1.w ||
             r2.x + r2.w < r1.x ||
             r2.y > r1.y + r1.h ||
             r2.y + r2.h < r1.y);
  }

  // ---------------- Apply Power‑up ----------------
  function applyPowerup(type) {
    switch (type) {
      case 'spread':
        activePowerups.spread.level = Math.min(MAX_SPREAD_LEVEL, activePowerups.spread.level + 1);
        activePowerups.spread.timer = POWERUP_DURATION;
        break;
      case 'laser':
        activePowerups.laser = POWERUP_DURATION;
        break;
      case 'extra':
        if (lives < 5) lives++;
        break;
      case 'shield':
        activePowerups.shield = SHIELD_DURATION;
        break;
    }
  }

  // ---------------- Player Fire (fixed) ----------------
  function playerFire() {
    if (fireCooldown > 0 && activePowerups.laser <= 0) return;
    if (activePowerups.laser <= 0) {
      fireCooldown = PLAYER_FIRE_COOLDOWN;
    }

    var baseX = cannon.x + CANNON_WIDTH / 2 - BULLET_WIDTH / 2;
    var bulletY = cannon.y - BULLET_HEIGHT;

    if (activePowerups.spread.level > 0) {
      var level = activePowerups.spread.level;
      var count = 1 + 2 * level;
      var spacing = 15;
      var startX = baseX - (level * spacing);
      for (var i = 0; i < count; i++) {
        obtainPlayerBullet(startX + i * spacing, bulletY);
      }
    } else {
      obtainPlayerBullet(baseX, bulletY);
    }

    if (shootAudio) try { shootAudio.play(false); } catch (e) {}
  }

  // ---------------- Update Loop ----------------
  function updateGame() {
    if (gameState !== STATE_PLAYING || paused) return;

    // Decrement power‑up timers
    if (activePowerups.spread.timer > 0) {
      activePowerups.spread.timer--;
      if (activePowerups.spread.timer === 0) {
        activePowerups.spread.level = 0;
      }
    }
    if (activePowerups.laser > 0) activePowerups.laser--;
    if (activePowerups.shield > 0) activePowerups.shield--;
    if (fireCooldown > 0) fireCooldown--;

    if (shieldImg) {
      shieldImg.visible = (activePowerups.shield > 0);
      if (shieldImg.visible) {
        shieldImg.x = cannon.x + (CANNON_WIDTH - POWERUP_SIZE) / 2;
        shieldImg.y = cannon.y + (CANNON_HEIGHT - POWERUP_SIZE) / 2;
      }
    }

    // Laser auto‑fire
    if (activePowerups.laser > 0) {
      laserFireCounter--;
      if (laserFireCounter <= 0) {
        playerFire();
        laserFireCounter = LASER_FIRE_INTERVAL;
      }
    }

    if (pressedKeys[7]) {
      cannon.x = Math.max(GAME_LEFT, cannon.x - CANNON_SPEED);
    }
    if (pressedKeys[5]) {
      cannon.x = Math.min(GAME_RIGHT - CANNON_WIDTH, cannon.x + CANNON_SPEED);
    }
    if (pressedKeys[4]) {
      cannon.y = Math.max(GAME_TOP, cannon.y - CANNON_SPEED);
    }
    if (pressedKeys[6]) {
      cannon.y = Math.min(GAME_BOTTOM, cannon.y + CANNON_SPEED);
    }
    if (layers.cannon[0]) {
      layers.cannon[0].x = cannon.x;
      layers.cannon[0].y = cannon.y;
    }

    // Scroll background
    bgY1 += bgScrollSpeed;
    bgY2 += bgScrollSpeed;
    if (bgY1 >= SCREEN_H) bgY1 = -SCREEN_H;
    if (bgY2 >= SCREEN_H) bgY2 = -SCREEN_H;
    if (layers.background[0]) layers.background[0].y = bgY1;
    if (layers.background[1]) layers.background[1].y = bgY2;

    // Move aliens
    var alienSpeed = Math.min(ALIEN_MAX_SPEED, ALIEN_BASE_SPEED + (wave - 1) * ALIEN_SPEED_INCR);
    for (var i = 0; i < activeAliens.length; i++) {
      var a = activeAliens[i];
      a.x += a.dir * alienSpeed;

      if (a.x < GAME_LEFT) {
        a.x = GAME_LEFT;
        a.dir = 1;
        a.y += ALIEN_DROP_STEP;
      } else if (a.x + ALIEN_WIDTH > GAME_RIGHT) {
        a.x = GAME_RIGHT - ALIEN_WIDTH;
        a.dir = -1;
        a.y += ALIEN_DROP_STEP;
      }

      a.img.x = a.x;
      a.img.y = a.y;
    }

    var cannonRect = { x: cannon.x, y: cannon.y, w: CANNON_WIDTH, h: CANNON_HEIGHT };
    for (var i = 0; i < activeAliens.length; i++) {
      var a = activeAliens[i];
      var alienRect = { x: a.x, y: a.y, w: ALIEN_WIDTH, h: ALIEN_HEIGHT };
      if (rectCollide(cannonRect, alienRect)) {
        gameOver();
        return;
      }
    }

    var fireProb = Math.min(0.6, BASE_FIRE_PROB + wave * 0.03);
    for (var i = 0; i < activeAliens.length; i++) {
      var a = activeAliens[i];
      a.fireTimer--;
      if (a.fireTimer <= 0) {
        if (Math.random() < fireProb) {
          obtainAlienBullet(a.x + ALIEN_WIDTH/2 - BULLET_WIDTH/2, a.y + ALIEN_HEIGHT);
        }
        a.fireTimer = ALIEN_FIRE_INTERVAL + Math.floor(Math.random() * ALIEN_FIRE_VARIATION * 2 - ALIEN_FIRE_VARIATION);
      }
    }

    // Move player bullets
    for (var i = activePlayerBullets.length - 1; i >= 0; i--) {
      var b = activePlayerBullets[i];
      b.y += PLAYER_BULLET_SPEED;
      b.img.y = b.y;

      if (b.y + BULLET_HEIGHT < 0) {
        releasePlayerBullet(b);
        continue;
      }

      var bulletRect = { x: b.x, y: b.y, w: BULLET_WIDTH, h: BULLET_HEIGHT };
      for (var j = activeAliens.length - 1; j >= 0; j--) {
        var a = activeAliens[j];
        var alienRect = { x: a.x, y: a.y, w: ALIEN_WIDTH, h: ALIEN_HEIGHT };
        if (rectCollide(bulletRect, alienRect)) {
          var points = a.type === 3 ? 40 : a.type === 2 ? 20 : 10;
          score += points;

          if (Math.random() < POWERUP_CHANCE) {
            var type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
            obtainPowerup(type, a.x + ALIEN_WIDTH/2 - POWERUP_SIZE/2, a.y + ALIEN_HEIGHT/2 - POWERUP_SIZE/2);
          }

          releaseAlien(a);
          releasePlayerBullet(b);
          if (explodeAudio) try { explodeAudio.play(false); } catch (e) {}
          break;
        }
      }
    }

    // Alien bullets with progressive difficulty (hardModeBonusSpeed)
    var alienBulletSpeed = ALIEN_BULLET_BASE_SPEED + (wave - 1) * ALIEN_BULLET_SPEED_INCR + hardModeBonusSpeed;
    for (var i = activeAlienBullets.length - 1; i >= 0; i--) {
      var b = activeAlienBullets[i];
      b.y += alienBulletSpeed;
      b.img.y = b.y;

      if (b.y > SCREEN_H) {
        releaseAlienBullet(b);
        continue;
      }

      if (activePowerups.shield <= 0) {
        var bulletRect = { x: b.x, y: b.y, w: BULLET_WIDTH, h: BULLET_HEIGHT };
        var cannonRect = { x: cannon.x, y: cannon.y, w: CANNON_WIDTH, h: CANNON_HEIGHT };
        if (rectCollide(bulletRect, cannonRect)) {
          lives--;
          releaseAlienBullet(b);
          if (lives <= 0) {
            gameOver();
            return;
          }
          if (explodeAudio) try { explodeAudio.play(false); } catch (e) {}
          continue;
        }
      }
    }

    for (var i = activePowerupsList.length - 1; i >= 0; i--) {
      var p = activePowerupsList[i];
      p.y += POWERUP_SPEED;
      p.img.y = p.y;

      var powerRect = { x: p.x, y: p.y, w: POWERUP_SIZE, h: POWERUP_SIZE };
      var cannonRect = { x: cannon.x, y: cannon.y, w: CANNON_WIDTH, h: CANNON_HEIGHT };
      if (rectCollide(powerRect, cannonRect)) {
        applyPowerup(p.type);
        if (powerupAudio) try { powerupAudio.play(false); } catch (e) {}
        releasePowerup(p);
      } else if (p.y > SCREEN_H) {
        releasePowerup(p);
      }
    }

    if (activeAliens.length === 0) {
      nextWave();
    }

    updateUI();
  }

  function gameLoop() { updateGame(); }

  // ---------------- Input Handling ----------------
  var pressedKeys = {};

  jsmaf.onKeyDown = function (keyCode) {
    if (pressedKeys[keyCode]) return;
    pressedKeys[keyCode] = true;

    if (keyCode === 3) {
      if (gameState === STATE_PLAYING) {
        paused = !paused;
        if (pausedText) pausedText.visible = paused;
      }
    }
    else if (keyCode === 14) {
      if (gameState === STATE_START || gameState === STATE_GAMEOVER) {
        // Normal restart: reset hardModeBonusSpeed to 0
        hardModeBonusSpeed = 0;
        resetGame();
      }
      else if (gameState === STATE_WIN) {
        hardModeBonusSpeed += 2;
        resetGame();
      }
      else if (gameState === STATE_PLAYING && !paused) {
        if (activePowerups.laser <= 0) {
          playerFire();
        }
      }
    }
    else if (keyCode === 13) {
      saveProgress();
      cleanup();
      jsmaf.setTimeout(function () { try { debugging.restart(); } catch (e) {} }, 100);
    }
  };

  jsmaf.onKeyUp = function (keyCode) {
    delete pressedKeys[keyCode];
  };

  // ---------------- Build UI ----------------
  function buildUI() {
    if (jsmaf.root && jsmaf.root.children) jsmaf.root.children.length = 0;
    for (var k in layers) if (layers.hasOwnProperty(k)) layers[k].length = 0;

    // Background
    var bg1 = new Image({
      url: ASSET_PATH + 'background.png',
      x: 0, y: 0,
      width: SCREEN_W, height: SCREEN_H
    });
    var bg2 = new Image({
      url: ASSET_PATH + 'background.png',
      x: 0, y: -SCREEN_H,
      width: SCREEN_W, height: SCREEN_H
    });
    layers.background.push(bg1, bg2);

    // Cannon
    var cannonImg = new Image({
      url: ASSET_PATH + 'cannon.png',
      x: cannon.x, y: cannon.y,
      width: CANNON_WIDTH, height: CANNON_HEIGHT
    });
    layers.cannon.push(cannonImg);

    // Shield overlay
    shieldImg = new Image({
      url: ASSET_PATH + 'powerup_shield.png',
      x: cannon.x, y: cannon.y,
      width: POWERUP_SIZE, height: POWERUP_SIZE,
      visible: false
    });
    layers.shield.push(shieldImg);

    // Pools (larger to prevent starvation)
    createAlienPool(MAX_ROWS * MAX_COLS + 20);
    createPlayerBulletPool(100);
    createAlienBulletPool(100);
    createPowerupPool(50);

    // UI
    new Style({ name: 'uiStyle', color: 'white', size: 48, bold: true, shadow: true });
    scoreText = new jsmaf.Text(); scoreText.style = 'uiStyle'; scoreText.x = 50; scoreText.y = 50; scoreText.text = 'Score: 0';
    highScoreText = new jsmaf.Text(); highScoreText.style = 'uiStyle'; highScoreText.x = 50; highScoreText.y = 110; highScoreText.text = 'High: ' + highScore;
    livesText = new jsmaf.Text(); livesText.style = 'uiStyle'; livesText.x = 50; livesText.y = 170; livesText.text = 'Lives: 3';
    waveText = new jsmaf.Text(); waveText.style = 'uiStyle'; waveText.x = 50; waveText.y = 230; waveText.text = 'Wave: 1';

    startText = new jsmaf.Text(); startText.style = 'uiStyle'; startText.x = SCREEN_W/2 - 250; startText.y = SCREEN_H/2 + 50; startText.text = 'Press X to start'; startText.visible = true;
    new Style({ name: 'pausedStyle', color: 'white', size: 96, bold: true, shadow: true });
    pausedText = new jsmaf.Text(); pausedText.style = 'pausedStyle'; pausedText.x = SCREEN_W/2 - 200; pausedText.y = SCREEN_H/2 - 50; pausedText.text = 'PAUSED'; pausedText.visible = false;

    gameOverText = new jsmaf.Text(); gameOverText.style = 'uiStyle'; gameOverText.x = SCREEN_W/2 - 200; gameOverText.y = SCREEN_H/2 - 100; gameOverText.text = 'GAME OVER'; gameOverText.visible = false;

    winText = new jsmaf.Text(); winText.style = 'uiStyle'; winText.x = SCREEN_W/2 - 150; winText.y = SCREEN_H/2 - 150; winText.text = 'YOU WIN!'; winText.visible = false;

    // Logo
    logoImg = new Image({
      url: ASSET_PATH + 'logo.png',
      x: (SCREEN_W - LOGO_WIDTH) / 2,
      y: SCREEN_H/2 - LOGO_HEIGHT - 80,
      width: LOGO_WIDTH,
      height: LOGO_HEIGHT,
      visible: true
    });

    layers.ui.push(logoImg, scoreText, highScoreText, livesText, waveText, startText, pausedText, gameOverText, winText);

    rebuildRootChildren();

    // Audio
    try {
      shootAudio = new jsmaf.AudioClip(); shootAudio.open(ASSET_PATH + 'shoot.wav'); shootAudio.volume = 1.0;
      explodeAudio = new jsmaf.AudioClip(); explodeAudio.open(ASSET_PATH + 'explode.wav'); explodeAudio.volume = 1.0;
      powerupAudio = new jsmaf.AudioClip(); powerupAudio.open(ASSET_PATH + 'powerup.wav'); powerupAudio.volume = 1.0;
    } catch (e) { shootAudio = explodeAudio = powerupAudio = null; }
  }

  // ---------------- Cleanup ----------------
  function cleanup() {
    if (frameInterval) { jsmaf.clearInterval(frameInterval); frameInterval = null; }
    jsmaf.onKeyDown = null;
    jsmaf.onKeyUp = null;
    if (jsmaf.root && jsmaf.root.children) jsmaf.root.children.length = 0;
    for (var n in layers) if (layers.hasOwnProperty(n)) layers[n].length = 0;
  }

  var GLOBAL_KEY = '__invadersFinal_v4';
  var prev = (typeof window !== 'undefined' && window[GLOBAL_KEY]) || null;
  if (prev && typeof prev.cleanup === 'function') { try { prev.cleanup(); } catch (e) {} }
  var instance = { cleanup: cleanup };
  if (typeof window !== 'undefined') window[GLOBAL_KEY] = instance;

  // ---------------- Init ----------------
  loadSave(function () {
    buildUI();
    frameInterval = jsmaf.setInterval(gameLoop, 16);
    log('Space Invaders loded.');
  });
})();
