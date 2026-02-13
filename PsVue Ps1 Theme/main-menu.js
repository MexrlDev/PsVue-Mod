(function () {
include('languages.js');
log(lang.loadingMainMenu);

var currentButton = 0;
var buttons = [];
var buttonTexts = [];
var buttonMarkers = [];
var buttonOrigPos = [];
var textCenterPos = []; // center coords for text
var idleParams = []; // per-button idle parameters
var normalButtonImg = 'file://../download0/img/button_over_9.png';
var selectedButtonImg = 'file://../download0/img/button_over_9.png';
jsmaf.root.children.length = 0;

new Style({ name: 'white', color: 'white', size: 24 });
new Style({ name: 'title', color: 'white', size: 32 });

if (typeof CONFIG !== 'undefined' && CONFIG.music) {
var audio = new jsmaf.AudioClip();
audio.volume = 0.5;
audio.open('file://../download0/sfx/bgm.wav');
}

// Animated background (BgAnim folder) — 27 frames requested
var bgBase = 'file:///../download0/BgAnim/Theme-Ps1-';
var bgExt = '.png';
var bgFramesTotal = 27; // updated to 27 frames
var bgFPS = 20; // playback fps
var bgFrameIntervalMs = Math.round(1000 / bgFPS);
var bgFrameIndex = 0;
var bgUrls = [];
for (var bi = 0; bi < bgFramesTotal; bi++) {
bgUrls.push(bgBase + bi + bgExt);
}

// Visible background shown to the user
var background = new Image({
url: bgUrls[0],
x: 0, y: 0, width: 1920, height: 1080
});
jsmaf.root.children.push(background);

// Preload hidden images (placed offscreen and invisible) to ensure frames are loaded before animation
var bgPreloads = [];
for (var p = 0; p < bgUrls.length; p++) {
try {
var pr = new Image({
url: bgUrls[p],
x: -9999, y: -9999,
width: 1, height: 1,
alpha: 0,
visible: false
});
pr._loaded = false;
bgPreloads.push(pr);
jsmaf.root.children.push(pr);
} catch (e) { }
}

var bgPreloadChecker = null;
var bgAnimInterval = null;
var bgPreloadStart = Date.now();
var bgReady = false;
var BG_MIN_LOADED_TO_START = 20; // start when at least 20 frames loaded
var BG_FALLBACK_MS = 3000; // fallback start after 3s

function countLoadedPreloads() {
var cnt = 0;
for (var i = 0; i < bgPreloads.length; i++) {
var pimg = bgPreloads[i];
if (!pimg) continue;
if (pimg._loaded) {
cnt++;
continue;
}
try {
if ((pimg.width && pimg.width > 0) || (pimg.height && pimg.height > 0)) {
pimg._loaded = true;
cnt++;
}
} catch (e) { }
}
return cnt;
}

function startBgAnimation() {
if (bgAnimInterval) return;
bgReady = true;
bgFrameIndex = 0;
try { background.url = bgUrls[0]; } catch (e) { }
bgAnimInterval = jsmaf.setInterval(function () {
bgFrameIndex = (bgFrameIndex + 1) % bgUrls.length;
try {
background.url = bgUrls[bgFrameIndex];
} catch (e) { }
}, bgFrameIntervalMs);
}

bgPreloadChecker = jsmaf.setInterval(function () {
var loaded = countLoadedPreloads();
var elapsed = Date.now() - bgPreloadStart;
if (loaded >= BG_MIN_LOADED_TO_START || loaded === bgFramesTotal || elapsed >= BG_FALLBACK_MS) {
try { startBgAnimation(); } catch (e) { }
if (bgPreloadChecker) { jsmaf.clearInterval(bgPreloadChecker); bgPreloadChecker = null; }
}
}, 120);

// center & logo sizes (make logo a lot smaller)
var centerX = 960;
var origLogoW = 600;
var origLogoH = 338;
var logoWidth = 240; // much smaller
var logoHeight = Math.round(logoWidth * origLogoH / origLogoW); // keep aspect ratio

// --- LOGO: created and placed at base; will have dynamic in-place animation ---
var logoStartX = centerX - logoWidth / 2;
var logoStartY = (1080 - logoHeight) / 2;
var logoBaseX = 50; // left margin (bottom-left placement)
var logoBaseY = 1080 - logoHeight - 30; // down (bottom-left)
if (logoBaseY < 0) logoBaseY = 30;
var logo = new Image({
url: 'file:///../download0/img/logo.png',
x: logoBaseX,
y: logoBaseY,
width: logoWidth,
height: logoHeight,
alpha: 1.0,
scaleX: 1.0,
scaleY: 1.0,
rotation: 0
});
jsmaf.root.children.push(logo);

// Full-screen black overlay (hidden because intro is skipped)
var introOverlay = new Image({
url: 'file:///assets/img/black.png',
x: 0, y: 0, width: 1920, height: 1080,
alpha: 0.0
});
jsmaf.root.children.push(introOverlay);

// Menu options: File Explorer inserted before exit; Message Tester added before exit
var menuOptions = [
{ label: lang.jailbreak, script: 'loader.js', imgKey: 'jailbreak' },
{ label: lang.payloadMenu, script: 'payload_host.js', imgKey: 'payloadMenu' },
{ label: lang.config, script: 'config_ui.js', imgKey: 'config' },
{ label: lang.fileExplorer || 'File Explorer', script: 'file-explorer.js', imgKey: 'file_explorer' },
{ label: 'Message Tester', script: 'Message-test.js', imgKey: 'message_tester' },
{ label: lang.exit, script: 'exit', imgKey: 'exit' }
];

// Layout: place 3 buttons on top-left and 3 buttons on top-right
var leftColumnX = 120;
var buttonWidth = 420;
var buttonHeight = 84;
var rightColumnX = 1920 - 120 - buttonWidth;
var startY = 60; // top area
var cols = 2;
var buttonSpacingY = 22;

// helper easing
function easeInOut(t) { return (1 - Math.cos(t * Math.PI)) / 2; }
function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

var ENTER_DUR = 3000;
var OVERLAY_FADE = 3000;

// We'll hold entrance starters here and only run them after initialization
var entranceStarters = [];

for (var i = 0; i < menuOptions.length; i++) {
(function (i) {
var col = i % cols;
var posIndex = Math.floor(i / cols); // 0..2 for rows
var finalX = (col === 0) ? leftColumnX : rightColumnX;
var finalY = startY + posIndex * (buttonHeight + buttonSpacingY);


  var offLeftX = -buttonWidth - 260;
  var offRightX = 1920 + 260;
  var startXpos = (col === 0) ? offLeftX : offRightX;
  var startYpos = finalY + ((posIndex % 2 === 0) ? -40 : 40);

  var button = new Image({
    url: normalButtonImg,
    x: startXpos,
    y: startYpos,
    width: buttonWidth,
    height: buttonHeight,
    alpha: 0.0,
    rotation: 0,
    scaleX: 1.0,
    scaleY: 1.0
  });
  button._entering = true;
  button._enterDelay = i * 80;
  button._enterFromX = startXpos;
  button._enterFromY = startYpos;
  button._enterToX = finalX;
  button._enterToY = finalY;
  button._enterFromAlpha = 0.0;
  button._enterToAlpha = 0.96;
  button._enterDur = ENTER_DUR;
  button._pressInterval = null;
  buttons.push(button);
  jsmaf.root.children.push(button);

  var marker = new Image({
    url: 'file:///assets/img/ad_pod_marker.png',
    x: finalX + buttonWidth - 50,
    y: finalY + 35,
    width: 12,
    height: 12,
    alpha: 0.0,
    scaleX: 0.6,
    scaleY: 0.6,
    visible: true
  });
  marker._blinkInterval = null;
  marker._entering = true;
  marker._enterDelay = button._enterDelay + 80;
  marker._enterFromAlpha = 0.0;
  marker._enterToAlpha = 1.0;
  marker._enterFromScale = 0.6;
  marker._enterToScale = 1.0;
  buttonMarkers.push(marker);
  jsmaf.root.children.push(marker);

  var btnText;
  if (typeof useImageText !== 'undefined' && useImageText) {
    btnText = new Image({
      url: (typeof textImageBase !== 'undefined' ? textImageBase : '') + menuOptions[i].imgKey + '.png',
      x: startXpos + buttonWidth / 2,
      y: startYpos + buttonHeight / 2,
      width: 300,
      height: 50,
      alpha: 0.0,
      visible: true
    });
  } else {
    btnText = new jsmaf.Text();
    btnText.text = menuOptions[i].label;
    btnText.align = 'center';
    btnText.x = startXpos + buttonWidth / 2;
    btnText.y = startYpos + buttonHeight / 2 - 8;
    btnText.style = 'white';
    btnText.alpha = 0.0;
  }
  buttonTexts.push(btnText);
  jsmaf.root.children.push(btnText);

  buttonOrigPos.push({ x: finalX, y: finalY });
  textCenterPos.push({ cx: finalX + buttonWidth / 2, cy: finalY + buttonHeight / 2 - 8 });

  idleParams.push({
    phase: Math.random() * Math.PI * 2,
    slowSpeed: 0.35 + Math.random() * 0.2,
    fastSpeed: 1.2 + Math.random() * 0.8,
    swayAmp: 4 + Math.random() * 4,
    bobAmp: 3 + Math.random() * 4,
    rotateAmp: 0.8 + Math.random() * 1.2
  });

  entranceStarters.push((function startEntranceFactory(btn, text, marker, idx) {
    return function () {
      var delay = btn._enterDelay;
      var sTime = Date.now() + delay;
      var dur = btn._enterDur;
      var interval = jsmaf.setInterval(function () {
        var now = Date.now();
        if (now < sTime) return;
        var elapsed = now - sTime;
        var t = Math.min(elapsed / dur, 1);
        var eased = easeInOut(t);
        var posEased = easeOutQuad(eased);
        btn.x = btn._enterFromX + (btn._enterToX - btn._enterFromX) * posEased;
        btn.y = btn._enterFromY + (btn._enterToY - btn._enterFromY) * posEased;
        btn.alpha = btn._enterFromAlpha + (btn._enterToAlpha - btn._enterFromAlpha) * eased;

        var txtFromCx = btn._enterFromX + buttonWidth / 2;
        var txtFromCy = btn._enterFromY + buttonHeight / 2 - 8;
        var txtToCx = textCenterPos[idx].cx;
        var txtToCy = textCenterPos[idx].cy;
        var textEased = easeInOut(Math.min(1, (elapsed + dur * 0.08) / dur));
        text.x = txtFromCx + (txtToCx - txtFromCx) * textEased;
        text.y = txtFromCy + (txtToCy - txtFromCy) * textEased;
        text.alpha = btn.alpha;

        marker.x = btn._enterToX + buttonWidth - 50;
        marker.y = btn._enterToY + 35;
        var mElapsed = Math.max(0, elapsed - marker._enterDelay + btn._enterDelay);
        var mT = Math.min(mElapsed / (dur * 0.5), 1);
        var mEased = easeOutQuad(mT);
        marker.alpha = marker._enterFromAlpha + (marker._enterToAlpha - marker._enterFromAlpha) * mEased;
        var mScale = marker._enterFromScale + (marker._enterToScale - marker._enterFromScale) * mEased;
        marker.scaleX = mScale;
        marker.scaleY = mScale;

        if (t >= 1) {
          jsmaf.clearInterval(interval);
          btn._entering = false;
          marker._entering = false;
          btn.x = btn._enterToX;
          btn.y = btn._enterToY;
          btn.alpha = btn._enterToAlpha;
          text.x = textCenterPos[idx].cx;
          text.y = textCenterPos[idx].cy;
          text.alpha = btn.alpha;
          marker.x = btn._enterToX + buttonWidth - 50;
          marker.y = btn._enterToY + 35;
          marker.alpha = marker._enterToAlpha;
          marker.scaleX = marker._enterToScale;
          marker.scaleY = marker._enterToScale;
        }
      }, 16);
    };
  })(button, btnText, marker, i));
})(i);


}

function startButtonsEntrance() {
for (var s = 0; s < entranceStarters.length; s++) {
try { entranceStarters[s](); } catch (e) { log('Entrance starter error: ' + e.message); }
}
updateHighlight();
log(lang.mainMenuLoaded);
}

function animatePress(btn, text, btnOrigX, btnOrigY, txtCenterX, txtCenterY, callback) {
if (btn._pressInterval) jsmaf.clearInterval(btn._pressInterval);
var timeline = [{ scale: 0.94, dur: 70 }, { scale: 1.08, dur: 110 }, { scale: 1.0, dur: 70 }];
var idx = 0;
var elapsed = 0;
var step = 16;
var startScale = btn.scaleX || 1.0;
btn._pressInterval = jsmaf.setInterval(function () {
elapsed += step;
var phase = timeline[idx];
var t = Math.min(elapsed / phase.dur, 1);
var target = phase.scale;
var scale = startScale + (target - startScale) * t;
btn.scaleX = scale;
btn.scaleY = scale;
// keep button center consistent while scaling:
btn.x = btnOrigX - buttonWidth * (scale - 1) / 2;
btn.y = btnOrigY - buttonHeight * (scale - 1) / 2;


  // text scale and centered position:
  text.scaleX = scale;
  text.scaleY = scale;
  text.x = txtCenterX - buttonWidth * (scale - 1) / 2;
  text.y = txtCenterY - buttonHeight * (scale - 1) / 2;

  if (t >= 1) {
    idx++;
    if (idx >= timeline.length) {
      jsmaf.clearInterval(btn._pressInterval);
      btn._pressInterval = null;
      btn.scaleX = 1.0;
      btn.scaleY = 1.0;
      btn.x = btnOrigX;
      btn.y = btnOrigY;
      text.scaleX = 1.0;
      text.scaleY = 1.0;
      text.x = txtCenterX;
      text.y = txtCenterY;
      if (typeof callback === 'function') callback();
    } else {
      startScale = btn.scaleX;
      elapsed = 0;
    }
  }
}, step);


}

var prevButton = -1;

function startMarkerBlink(marker) {
if (!marker) return;
if (marker._blinkInterval) return;
marker._blinkInterval = jsmaf.setInterval(function () {
marker.visible = !marker.visible;
if (marker.visible) {
var start = Date.now();
var pdur = 350;
var baseScale = marker.scaleX || 1.0;
var intv = jsmaf.setInterval(function () {
var now = Date.now();
var t = Math.min((now - start) / pdur, 1);
var s = baseScale + (1.08 - baseScale) * Math.sin(t * Math.PI);
marker.scaleX = s;
marker.scaleY = s;
if (t >= 1) jsmaf.clearInterval(intv);
}, 16);
}
}, 700);
}
function stopMarkerBlink(marker) {
if (!marker) return;
if (marker._blinkInterval) {
jsmaf.clearInterval(marker._blinkInterval);
marker._blinkInterval = null;
}
marker.visible = false;
}

var flashingMode = false;
var flashingInterval = null;

function startRandomFlashing() {
if (flashingMode) return;
flashingMode = true;
flashingInterval = jsmaf.setInterval(function () {
for (var m = 0; m < buttonMarkers.length; m++) {
if (!buttonMarkers[m]) continue;
var show = Math.random() > 0.5;
buttonMarkers[m].visible = show;
if (show) { buttonMarkers[m].scaleX = 1.0 + Math.random() * 0.18; buttonMarkers[m].scaleY = buttonMarkers[m].scaleX; }
else { buttonMarkers[m].scaleX = 0.9; buttonMarkers[m].scaleY = 0.9; }
}
}, 120);
}

function stopRandomFlashing() {
if (!flashingMode) return;
flashingMode = false;
if (flashingInterval) { jsmaf.clearInterval(flashingInterval); flashingInterval = null; }
for (var mm = 0; mm < buttonMarkers.length; mm++) {
var mark = buttonMarkers[mm];
if (!mark) continue;
stopMarkerBlink(mark);
mark.visible = false;
mark.scaleX = 1.0;
mark.scaleY = 1.0;
}
var focusedMarker = buttonMarkers[currentButton];
if (focusedMarker) startMarkerBlink(focusedMarker);
}

function updateHighlight() {
if (prevButton >= 0 && prevButton !== currentButton) {
var prevBtn = buttons[prevButton];
var prevTxt = buttonTexts[prevButton];
var prevMark = buttonMarkers[prevButton];
if (prevBtn && prevTxt && prevMark) {
prevBtn.url = normalButtonImg;
prevBtn.alpha = 0.96;
prevBtn.borderColor = 'transparent';
prevBtn.borderWidth = 0;
stopMarkerBlink(prevMark);
prevBtn.scaleX = 1.0;
prevBtn.scaleY = 1.0;
prevBtn.rotation = 0;
prevBtn.x = buttonOrigPos[prevButton].x;
prevBtn.y = buttonOrigPos[prevButton].y;
prevTxt.scaleX = 1.0;
prevTxt.scaleY = 1.0;
prevTxt.x = textCenterPos[prevButton].cx;
prevTxt.y = textCenterPos[prevButton].cy;
}
}


for (var i = 0; i < buttons.length; i++) {
  var b = buttons[i];
  var m = buttonMarkers[i];
  var t = buttonTexts[i];
  if (!b || t === undefined) continue;
  if (i === currentButton) {
    b.url = selectedButtonImg;
    b.alpha = 1.0;
    b.borderColor = 'rgb(155,154,150)';
    b.borderWidth = 3;
    if (m) { if (!flashingMode) { m.visible = true; startMarkerBlink(m); } }
  } else {
    b.url = normalButtonImg;
    b.alpha = 0.96;
    if (m && !flashingMode) { stopMarkerBlink(m); m.visible = false; }
  }
}

prevButton = currentButton;


}

var idleStart = Date.now();
var idleLoop = jsmaf.setInterval(function () {
var t = (Date.now() - idleStart) / 1000;
for (var j = 0; j < buttons.length; j++) {
var btn = buttons[j];
var txt = buttonTexts[j];
var mark = buttonMarkers[j];
var base = buttonOrigPos[j];
var txtBase = textCenterPos[j];
var params = idleParams[j];
if (!btn || txtBase === undefined || !params) continue;
if (btn._entering || (mark && mark._entering)) {
if (mark) { mark.x = btn._enterToX + buttonWidth - 50; mark.y = btn._enterToY + 35; }
continue;
}
var slow = Math.sin(t * params.slowSpeed + params.phase);
var fast = Math.sin(t * params.fastSpeed + params.phase * 1.3);
var sway = slow * params.swayAmp;
var bob = fast * params.bobAmp;
var rotate = slow * params.rotateAmp;
if (j === currentButton) {
var baseBreath = 1.0 + 0.01 * Math.sin(t * params.fastSpeed + params.phase);
var squash = 1 + Math.sin(t * 2.6 + params.phase) * 0.04;
var finalScaleX = baseBreath * squash;
var finalScaleY = baseBreath * (1 - (squash - 1) * 0.45);
btn.scaleX = finalScaleX;
btn.scaleY = finalScaleY;
btn.rotation = rotate * 0.4;
btn.x = base.x + sway * 0.75 - buttonWidth * (finalScaleX - 1) / 2;
btn.y = base.y + bob * 0.9 - buttonHeight * (finalScaleY - 1) / 2;
txt.scaleX = finalScaleX;
txt.scaleY = finalScaleY;
txt.x = txtBase.cx + sway * 0.75 - buttonWidth * (finalScaleX - 1) / 2;
txt.y = txtBase.cy + bob * 0.9 - buttonHeight * (finalScaleY - 1) / 2;
if (mark) {
mark.x = btn.x + buttonWidth - 50 + Math.sin(t * 1.9 + params.phase) * 1.8;
mark.y = btn.y + 35 + Math.cos(t * 1.7 + params.phase) * 1.2;
mark.scaleX = 1.0 + 0.04 * Math.sin(t * 2.4);
mark.scaleY = mark.scaleX;
}
} else {
var finalScale = 1.0 + 0.01 * Math.sin(t * params.fastSpeed + params.phase);
btn.scaleX = finalScale;
btn.scaleY = finalScale;
btn.rotation = rotate * 0.35;
btn.x = base.x + sway * 0.6 - buttonWidth * (finalScale - 1) / 2;
btn.y = base.y + bob * 0.6 - buttonHeight * (finalScale - 1) / 2;
txt.scaleX = finalScale;
txt.scaleY = finalScale;
txt.x = txtBase.cx + sway * 0.6 - buttonWidth * (finalScale - 1) / 2;
txt.y = txtBase.cy + bob * 0.6 - buttonHeight * (finalScale - 1) / 2;
if (mark) {
mark.x = btn.x + buttonWidth - 50 + Math.sin(t * 1.2 + params.phase) * 1.2;
mark.y = btn.y + 35 + Math.cos(t * 1.1 + params.phase) * 1.0;
mark.scaleX = 0.98 + 0.02 * Math.sin(t * 1.6 + params.phase);
mark.scaleY = mark.scaleX;
}
}
}
}, 50);

// perform action for option; exit handled when script === 'exit'
function performButtonAction(index) {
var opt = menuOptions[index];
if (!opt) return;
if (opt.script === 'exit') {
log('Exiting application...');
try {
// clear bg intervals & preload checker
if (bgAnimInterval) { jsmaf.clearInterval(bgAnimInterval); bgAnimInterval = null; }
if (bgPreloadChecker) { jsmaf.clearInterval(bgPreloadChecker); bgPreloadChecker = null; }
if (logoAnimInterval) { jsmaf.clearInterval(logoAnimInterval); logoAnimInterval = null; }
// remove preload helpers to free memory (hide and remove)
for (var ri = 0; ri < bgPreloads.length; ri++) {
try { var r = bgPreloads[ri]; if (r && r.parent) { var idx = jsmaf.root.children.indexOf(r); if (idx >= 0) jsmaf.root.children.splice(idx, 1); } } catch (e) {}
}
bgPreloads = [];


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
  jsmaf.exit();
} else {
  if (opt.script === 'loader.js') {
    jsmaf.onKeyDown = function () {};
  }
  log('Loading ' + opt.script + '...');
  try {
    include(opt.script);
  } catch (e) {
    log('ERROR loading ' + opt.script + ': ' + e.message);
    if (e.stack) log(e.stack);
  }
}


}

function handleButtonPress() {
var btn = buttons[currentButton];
var txt = buttonTexts[currentButton];
if (!btn || !txt) {
performButtonAction(currentButton);
return;
}
if (btn._entering) {
btn._entering = false;
btn.x = buttonOrigPos[currentButton].x;
btn.y = buttonOrigPos[currentButton].y;
txt.x = textCenterPos[currentButton].cx;
txt.y = textCenterPos[currentButton].cy;
var mk = buttonMarkers[currentButton];
if (mk) { mk.x = btn.x + buttonWidth - 50; mk.y = btn.y + 35; mk.alpha = 1.0; mk.scaleX = 1.0; mk.scaleY = 1.0; }
}
var origBtnX = buttonOrigPos[currentButton].x;
var origBtnY = buttonOrigPos[currentButton].y;
var origTxtCX = textCenterPos[currentButton].cx;
var origTxtCY = textCenterPos[currentButton].cy;


animatePress(btn, txt, origBtnX, origBtnY, origTxtCX, origTxtCY, function () {
  performButtonAction(currentButton);
});


}

// INPUT: we skip the logo intro, enable input now
var introPlaying = false;
jsmaf.onKeyDown = function () { /* may be replaced below */ };
jsmaf.onKeyUp = function () { /* may be replaced below */ };

function realOnKeyDown(keyCode) {
if (keyCode === 6 || keyCode === 5) {
currentButton = (currentButton + 1) % buttons.length;
updateHighlight();
} else if (keyCode === 4 || keyCode === 7) {
currentButton = (currentButton - 1 + buttons.length) % buttons.length;
updateHighlight();
} else if (keyCode === 14) {
handleButtonPress();
}
}
function realOnKeyUp(keyCode) {}

// Also support external callers of "stop flashing" if needed:
this.stopAdFlash = stopRandomFlashing;
this.startAdFlash = startRandomFlashing;

// Start buttons entrance immediately
jsmaf.onKeyDown = realOnKeyDown;
jsmaf.onKeyUp = realOnKeyUp;
startButtonsEntrance();

// Logo dynamic in-place animation
var logoAnimInterval = null;
var logoAnimStart = Date.now();
try {
// ensure base placement
logo.x = logoBaseX;
logo.y = logoBaseY;
logo.scaleX = 1.0;
logo.scaleY = 1.0;
logo.rotation = 0;
} catch (e) {}
logoAnimInterval = jsmaf.setInterval(function () {
var t = (Date.now() - logoAnimStart) / 1000;
// gentle bob, sway, tiny rotation, and subtle breathing scale
var bob = Math.sin(t * 1.6) * 6;         // vertical up/down (px)
var sway = Math.sin(t * 0.9) * 4;        // horizontal subtle (px)
var rot = Math.sin(t * 0.6) * 1.1;       // rotation degrees
var breath = 1.0 + Math.sin(t * 1.2) * 0.02; // scale around 1.0 +- 0.02
try {
logo.x = logoBaseX + sway;
logo.y = logoBaseY + bob;
logo.scaleX = breath;
logo.scaleY = breath;
logo.rotation = rot;
} catch (e) {}
}, 50);

})();
