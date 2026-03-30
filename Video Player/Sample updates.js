// Original code that only has 1 stream on loop by Earthonion

// Modified to work with multi url and coding by MexrlDev, 

// bugs and issues Researching by StandVideo - Alienaareps4

// Sample 8 (v1.2) Test build -LITE

(function () {
  // --- Cleanup any existing BGM (from your original scripts) ---
  if (typeof stopBgm === 'function') { try { stopBgm(); } catch (e) {} }
  if (typeof startBgmIfEnabled !== 'undefined') { startBgmIfEnabled = function () {}; }
  if (typeof bgmClip !== 'undefined' && bgmClip) {
    try {
      if (typeof bgmClip.stop === 'function') bgmClip.stop();
      if (typeof bgmClip.close === 'function') bgmClip.close();
      bgmClip.muted = true;
      bgmClip.volume = 0;
    } catch (e) {}
    bgmClip = null;
  }

  // ========== (1) EDITABLE CONFIGURATION ==========

  // --- Your video streams (add as many as you like) ---
  var STREAMS = [
    "http://content.jwplatform.com/manifests/yp34SRmf.m3u8",
    "http://earthonion.com/download0/stream.m3u8"
    // Add more URLs below – remember to put a comma after the previous line
  ];

  // --- Splash images (optional) – set to [] to disable splash ---
  var SPLASH_IMAGES = [
  // Add here
  ];

  // --- Splash timing (milliseconds) – only used if there are images ---
  var SPLASH_FADE_IN = 500;
  var SPLASH_HOLD    = 1000;
  var SPLASH_FADE_OUT = 500;

  // --- Player tuning (optimal for both live and VOD) ---
  var CONFIG = {
    // Memory & buffer management (prevents leaks and over‑downloading)
    backBufferLength: 30,          // Keeps only 30 sec of watched video
    liveBackBufferLength: 30,
    liveSyncDuration: 10,          // Stays 10 sec behind live edge (reduces manifest parsing)
    liveMaxLatency: 20,
    maxBufferLength: 30,           // Limits forward buffer
    maxMaxBufferLength: 30,
    maxBufferHole: 1.5,            // Skip glitches up to 1.5 sec
    nudgeOffset: 0.05,
    nudgeMaxRetry: 4,
    highBufferWatchdogPeriod: 3,
    startFragPrefetch: true,
    startupGraceMs: 60000,         // 60 sec to start playing
    playingStallMs: 180000,        // 3 min without progress while playing
    bufferingStallMs: 240000,      // 4 min stuck in buffering
    watchdogIntervalMs: 8000,      // Check every 8 sec
    baseRetryDelayMs: 2000,
    maxSameUrlRetries: 999,        // How many times to retry the same stream before giving up
    refreshGuardMs: 8000,
    debug: false                   // Set to true to show console logs
  };

  // ========== (2) INTERNAL GLOBALS – DO NOT EDIT ==========
  var currentIndex = 0;
  var video = null;
  var autoMode = false;
  var loopMode = false;
  var switching = false;
  var splashActive = false;
  var splashSkipped = false;
  var watchdogTimer = null, startupTimer = null, retryTimer = null, refreshGuardUntil = 0;
  var sameUrlFailures = 0, lastCurrentTime = 0, lastProgressAt = 0;
  var fadeText = null, fadeTimeouts = [];
  var splashImage = null, splashStep = 0;
  var splashFadeInId = null, splashHoldId = null, splashFadeOutId = null;
  var networkConnected = true;

  if (STREAMS.length > 1) {
    autoMode = true;   // Rotate through the list
    loopMode = false;
  } else {
    autoMode = false;
    loopMode = true;
  }

  // ========== (3) HELPER FUNCTIONS ==========
  function now() { return Date.now ? Date.now() : new Date().getTime(); }
  function currentUrl() { return STREAMS[currentIndex]; }

  function clearTimers(list) {
    for (var i = 0; i < list.length; i++) {
      try { clearTimeout(list[i]); } catch(e) {}
      try { clearInterval(list[i]); } catch(e) {}
    }
    list.length = 0;
  }

  function cancelAllTimers() {
    if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
    if (startupTimer) { clearTimeout(startupTimer); startupTimer = null; }
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (splashFadeInId) { clearInterval(splashFadeInId); splashFadeInId = null; }
    if (splashHoldId) { clearTimeout(splashHoldId); splashHoldId = null; }
    if (splashFadeOutId) { clearInterval(splashFadeOutId); splashFadeOutId = null; }
    clearTimers(fadeTimeouts);
  }

  function removeFromRoot(obj) {
    if (!obj || !jsmaf || !jsmaf.root || !jsmaf.root.children) return;
    var idx = jsmaf.root.children.indexOf(obj);
    if (idx !== -1) jsmaf.root.children.splice(idx, 1);
  }

  function closeVideo(obj) {
    if (!obj) return;
    try { if (typeof obj.stop === 'function') obj.stop(); } catch(e) {}
    try { if (typeof obj.close === 'function') obj.close(); } catch(e) {}
  }

  function destroyVideo() {
    stopWatchdog();
    stopStartupTimer();
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (video) {
      removeFromRoot(video);
      closeVideo(video);
      video = null;
    }
  }

  function safePlay() { try { if (video) video.play(); } catch(e) {} }
  function safeOpen(url) { try { if (video) video.open(url); } catch(e) {} }

  // ========== (4) FADE MESSAGE (Overlay text) ==========
  function ensureFadeText() {
    if (fadeText) return;
    fadeText = new Text({
      x: 10, y: 30, text: "", font: "24px Arial", color: "#FFFFFF",
      visible: true, opacity: 0, zIndex: 1000
    });
    jsmaf.root.children.push(fadeText);
  }

  function showMessage(msg, isError) {
    ensureFadeText();
    clearTimers(fadeTimeouts);

    fadeText.color = isError ? "#FF6666" : "#FFFFFF";
    fadeText.text = msg;
    fadeText.opacity = 0;
    fadeText.visible = true;

    var fadeInStart = now();
    var fadeIn = setInterval(function () {
      var p = Math.min(1, (now() - fadeInStart) / 700);
      fadeText.opacity = p;
      if (p >= 1) {
        clearInterval(fadeIn);
        var hold = setTimeout(function () {
          var fadeOutStart = now();
          var fadeOut = setInterval(function () {
            var p2 = 1 - Math.min(1, (now() - fadeOutStart) / 900);
            fadeText.opacity = p2;
            if (p2 <= 0) {
              clearInterval(fadeOut);
              fadeText.visible = false;
            }
          }, 16);
          fadeTimeouts.push(fadeOut);
        }, 900);
        fadeTimeouts.push(hold);
      }
    }, 16);
    fadeTimeouts.push(fadeIn);
  }

  // ========== (5) EASING FUNCTION ==========
  function easeInOut(t) {
    return (1 - Math.cos(t * Math.PI)) / 2;
  }

  // ========== (6) APPLY LIVE TUNING ==========
  function applyLiveTuning(obj) {
    if (!obj) return;
    if (CONFIG.debug) console.log("[Player] Applying live‑stream tuning...");
    try {
      if (typeof obj.backBufferLength !== 'undefined') obj.backBufferLength = CONFIG.backBufferLength;
      if (typeof obj.liveBackBufferLength !== 'undefined') obj.liveBackBufferLength = CONFIG.liveBackBufferLength;
      if (typeof obj.liveSyncDuration !== 'undefined') obj.liveSyncDuration = CONFIG.liveSyncDuration;
      if (typeof obj.liveMaxLatency !== 'undefined') obj.liveMaxLatency = CONFIG.liveMaxLatency;
      if (typeof obj.maxBufferLength !== 'undefined') obj.maxBufferLength = CONFIG.maxBufferLength;
      if (typeof obj.maxMaxBufferLength !== 'undefined') obj.maxMaxBufferLength = CONFIG.maxMaxBufferLength;
      if (typeof obj.maxBufferHole !== 'undefined') obj.maxBufferHole = CONFIG.maxBufferHole;
      if (typeof obj.nudgeOffset !== 'undefined') obj.nudgeOffset = CONFIG.nudgeOffset;
      if (typeof obj.nudgeMaxRetry !== 'undefined') obj.nudgeMaxRetry = CONFIG.nudgeMaxRetry;
      if (typeof obj.highBufferWatchdogPeriod !== 'undefined') obj.highBufferWatchdogPeriod = CONFIG.highBufferWatchdogPeriod;
      if (typeof obj.startFragPrefetch !== 'undefined') obj.startFragPrefetch = CONFIG.startFragPrefetch;
      if (typeof obj.debug !== 'undefined') obj.debug = CONFIG.debug;

      // Standard buffer hints
      obj.bufferTime = 30;
      obj.minBufferTime = 5;
      obj.maxBufferTime = 60;
      obj.bufferAhead = 30;
      obj.preload = "auto";
      obj.muted = false;
      obj.volume = 1.0;
    } catch(e) { if (CONFIG.debug) console.error("[Player] Error applying config:", e); }
  }

  // ========== (7) WATCHDOG & TIMERS ==========
  function stopWatchdog() { if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; } }
  function stopStartupTimer() { if (startupTimer) { clearTimeout(startupTimer); startupTimer = null; } }

  function startWatchdog() {
    stopWatchdog();
    if (!video) return;
    lastCurrentTime = video.currentTime || 0;
    lastProgressAt = now();

    watchdogTimer = setInterval(function () {
      if (switching || !video) return;
      var state = video.state || "";
      if (state !== "Playing" && state !== "Buffering") return;

      var ct = video.currentTime || 0;
      var currentNow = now();

      if (ct !== lastCurrentTime) {
        lastCurrentTime = ct;
        lastProgressAt = currentNow;
        return;
      }

      var stalledFor = currentNow - lastProgressAt;

      if (state === "Playing") {
        if (stalledFor >= CONFIG.playingStallMs) {
          recoverSameUrl("Playback stalled");
        }
      } else if (state === "Buffering") {
        if (stalledFor >= CONFIG.bufferingStallMs) {
          recoverSameUrl("Buffering stuck");
        }
      }
    }, CONFIG.watchdogIntervalMs);
  }

  function startStartupTimer() {
    stopStartupTimer();
    startupTimer = setTimeout(function () {
      if (!video || switching) return;
      var state = video.state || "";
      var ct = video.currentTime || 0;
      if (state === "Opening" || state === "Buffering" || ct === 0) {
        recoverSameUrl("Startup timeout");
      }
    }, CONFIG.startupGraceMs);
  }

  // ========== (8) VIDEO LIFECYCLE ==========
  function buildVideo() {
    destroyVideo();
    var w = jsmaf.screenWidth || 1920;
    var h = jsmaf.screenHeight || 1080;

    video = new Video({
      x: 0, y: 0, width: w, height: h,
      visible: true, autoplay: true, audio: true
    });

    applyLiveTuning(video);

    video.onOpen = function () {
      if (CONFIG.debug) console.log("[Player] Video opened.");
      switching = false;
      lastCurrentTime = 0;
      lastProgressAt = now();
      safePlay();
      startWatchdog();
      startStartupTimer();
    };

    video.onstatechange = function (state) {
      if (switching) return;
      if (CONFIG.debug) console.log("[Player] State:", state);

      if (state === "Playing") {
        lastCurrentTime = video.currentTime || 0;
        lastProgressAt = now();
        stopStartupTimer();
      }

      if (state === "Ended") {
        // Handle end of stream (works for both VOD and live if the event ends)
        if (loopMode) {
          restartSameUrl(false);
        } else if (autoMode) {
          goNext(false);
        } else {
          restartSameUrl(false);
        }
      }

      if (state === "Buffering") {
        startWatchdog();
      }
    };

    video.onerror = function () {
      recoverSameUrl("Stream error");
    };

    jsmaf.root.children.push(video);
  }

  function openCurrentStream(silent) {
    if (!video) buildVideo();
    switching = true;
    stopWatchdog();
    stopStartupTimer();
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }

    var url = currentUrl();
    closeVideo(video);

    setTimeout(function () {
      applyLiveTuning(video);
      safeOpen(url);
      switching = false;
      refreshGuardUntil = now() + CONFIG.refreshGuardMs;
      lastProgressAt = now();
      startWatchdog();
      startStartupTimer();
      if (!silent) showMessage("Video " + (currentIndex + 1), false);
    }, 120);
  }

  function softReopenSameUrl() {
    if (!video || switching) return;
    switching = true;
    stopWatchdog();
    stopStartupTimer();
    refreshGuardUntil = now() + CONFIG.refreshGuardMs;
    applyLiveTuning(video);
    safeOpen(currentUrl());
    setTimeout(function () {
      switching = false;
      lastProgressAt = now();
      startWatchdog();
      startStartupTimer();
    }, 150);
  }

  function hardRebuildSameUrl() {
    if (switching) return;
    switching = true;
    stopWatchdog();
    stopStartupTimer();
    refreshGuardUntil = now() + CONFIG.refreshGuardMs;
    var url = currentUrl();
    destroyVideo();
    setTimeout(function () {
      buildVideo();
      applyLiveTuning(video);
      safeOpen(url);
      switching = false;
      lastProgressAt = now();
      startWatchdog();
      startStartupTimer();
    }, 200);
  }

  function restartSameUrl(silent) {
    if (!video) return;
    if (!silent) showMessage("Restarting stream...", false);
    openCurrentStream(true);
  }

  // ========== (9) RECOVERY ==========
  function scheduleRetry(fn, attempt) {
    if (retryTimer) clearTimeout(retryTimer);
    var delay = Math.min(CONFIG.baseRetryDelayMs * Math.pow(2, attempt - 1), 30000);
    retryTimer = setTimeout(fn, delay);
  }

  function recoverSameUrl(reason) {
    if (switching) return;
    if (now() < refreshGuardUntil) return;

    sameUrlFailures += 1;

    if (sameUrlFailures <= CONFIG.maxSameUrlRetries) {
      if (sameUrlFailures <= 2) {
        showMessage(reason + " - retrying (" + sameUrlFailures + "/" + CONFIG.maxSameUrlRetries + ")", true);
        scheduleRetry(function () { softReopenSameUrl(); }, sameUrlFailures);
      } else {
        showMessage(reason + " - rebuilding (" + sameUrlFailures + "/" + CONFIG.maxSameUrlRetries + ")", true);
        scheduleRetry(function () { hardRebuildSameUrl(); }, sameUrlFailures);
      }
      return;
    }

    sameUrlFailures = 0;
    showMessage(reason + " - retrying same stream again", true);
    scheduleRetry(function () { softReopenSameUrl(); }, 1);
  }

  // ========== (10) NAVIGATION & MODES ==========
  function goNext(silent) {
    if (STREAMS.length <= 1) return;
    sameUrlFailures = 0;
    currentIndex = (currentIndex + 1) % STREAMS.length;
    openCurrentStream(silent);
    if (!silent) showMessage("Next: Video " + (currentIndex + 1), false);
  }

  function goPrev() {
    if (STREAMS.length <= 1) return;
    sameUrlFailures = 0;
    currentIndex = (currentIndex - 1 + STREAMS.length) % STREAMS.length;
    openCurrentStream(false);
    showMessage("Previous: Video " + (currentIndex + 1), false);
  }

  function toggleAuto() {
    autoMode = !autoMode;
    if (autoMode && loopMode) loopMode = false;
    showMessage(autoMode ? "Auto mode ON" : "Auto mode OFF", false);
  }

  function toggleLoop() {
    loopMode = !loopMode;
    if (loopMode && autoMode) autoMode = false;
    showMessage(loopMode ? "Loop mode ON" : "Loop mode OFF", false);
  }

  function manualRefresh() {
    sameUrlFailures = 0;
    showMessage("Manual refresh", false);
    openCurrentStream(true);
  }

  // ========== (11) RESTART CLEANUP ==========
  function performRestart() {
    cancelAllTimers();
    if (splashImage) {
      removeFromRoot(splashImage);
      splashImage = null;
    }
    destroyVideo();
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    splashActive = false;
    splashSkipped = false;
    switching = false;

    if (typeof debugging !== "undefined" && debugging && typeof debugging.restart === "function") {
      debugging.restart();
    } else if (typeof location !== "undefined" && location && typeof location.reload === "function") {
      location.reload();
    } else if (jsmaf && typeof jsmaf.restart === "function") {
      jsmaf.restart();
    }
  }

  // ========== (12) KEY HANDLER ==========
  function handleKeyDown(keyCode) {
    if (splashActive && !splashSkipped) {
      skipSplash();
      return;
    }

    switch (keyCode) {
      case 5:  goNext(false); break;
      case 7:  goPrev(); break;
      case 12: toggleLoop(); break;
      case 15: toggleAuto(); break;
      case 16: manualRefresh(); break;
      case 13: performRestart(); break;
      default: break;
    }
  }

  // ========== (13) SPLASH SKIP ==========
  function skipSplash() {
    if (splashSkipped) return;
    splashSkipped = true;
    splashActive = false;
    if (splashFadeInId) { clearInterval(splashFadeInId); splashFadeInId = null; }
    if (splashHoldId) { clearTimeout(splashHoldId); splashHoldId = null; }
    if (splashFadeOutId) { clearInterval(splashFadeOutId); splashFadeOutId = null; }
    if (splashImage) {
      removeFromRoot(splashImage);
      splashImage = null;
    }
    buildVideo();
    openCurrentStream(false);
  }

  // ========== (14) SPLASH WITH EASING ==========
  function animateOpacity(obj, from, to, duration, onComplete) {
    var startTime = now();
    var interval = setInterval(function () {
      var elapsed = now() - startTime;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeInOut(t);
      var value = from + (to - from) * eased;
      try { obj.opacity = value; } catch(e) {}
      if (t >= 1) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, 16);
    return interval;
  }

  function showNextSplashImage() {
    if (splashSkipped) return;
    if (splashStep >= SPLASH_IMAGES.length) {
      splashActive = false;
      buildVideo();
      openCurrentStream(false);
      return;
    }

    var screenW = jsmaf.screenWidth || 1920;
    var screenH = jsmaf.screenHeight || 1080;

    if (!splashImage) {
      splashImage = new Image({
        url: SPLASH_IMAGES[splashStep],
        x: 0, y: 0, width: screenW, height: screenH,
        visible: true, opacity: 0, zIndex: 1000
      });
      jsmaf.root.children.push(splashImage);
    } else {
      splashImage.url = SPLASH_IMAGES[splashStep];
      splashImage.opacity = 0;
      splashImage.visible = true;
    }

    splashFadeInId = animateOpacity(splashImage, 0, 1, SPLASH_FADE_IN, function () {
      if (splashSkipped) return;
      splashHoldId = setTimeout(function () {
        if (splashSkipped) return;
        splashFadeOutId = animateOpacity(splashImage, 1, 0, SPLASH_FADE_OUT, function () {
          if (splashSkipped) return;
          splashImage.visible = false;
          splashStep++;
          showNextSplashImage();
        });
      }, SPLASH_HOLD);
    });
  }

  function showSplash() {
    if (!SPLASH_IMAGES || SPLASH_IMAGES.length === 0) {
      buildVideo();
      openCurrentStream(false);
      return;
    }
    splashActive = true;
    splashSkipped = false;
    splashStep = 0;
    showNextSplashImage();
  }

  // ========== (15) NETWORK STATUS ==========
  function onNetworkStatusChange(status) {
    if (status === "connected") {
      if (!networkConnected) {
        networkConnected = true;
        showMessage("Network reconnected", false);
        manualRefresh();
      }
    } else if (status === "disconnected") {
      networkConnected = false;
      showMessage("Network disconnected", true);
    }
  }

  // ========== (16) INITIALISATION ==========
  try {
    jsmaf.remotePlay = true;
    jsmaf.onKeyDown = handleKeyDown;

    var prevNetworkHandler = jsmaf.onNetworkStatusChange;
    jsmaf.onNetworkStatusChange = function (status) {
      try { if (typeof prevNetworkHandler === "function") prevNetworkHandler(status); } catch(e) {}
      onNetworkStatusChange(status);
    };

    showSplash();
    if (CONFIG.debug) console.log("Player Loaded..");
  } catch (e) {
    alert("Error: " + e.message);
  }
})();
