// Sample 8, Vue (VID) Player v1.2 (alpha)

// Original code that only has 1 stream on loop by Earthonion

// Modified to work with multi url and coding by MexrlDev, 

// bugs and issues Researching by StandVideo - Alienaareps4

(function () {

  // == (1) OPTIONAL BGM MUTE / CLEANUP ==
  
  if (typeof stopBgm === 'function') {
    try { stopBgm(); } catch (e) {}
  }

  if (typeof startBgmIfEnabled !== 'undefined') {
    startBgmIfEnabled = function () {};
  }

  if (typeof bgmClip !== 'undefined' && bgmClip) {
    try {
      if (typeof bgmClip.stop === 'function') bgmClip.stop();
    } catch (e1) {}
    try {
      if (typeof bgmClip.close === 'function') bgmClip.close();
    } catch (e2) {}
    try {
      if (typeof bgmClip.mute === 'function') bgmClip.mute(true);
    } catch (e3) {}
    try {
      bgmClip.muted = true;
      bgmClip.volume = 0;
    } catch (e4) {}
    bgmClip = null;
  }


  // == (2) EDIT HERE: STREAM LIST ==
  
  var STREAMS = [
    "http://content.jwplatform.com/manifests/yp34SRmf.m3u8"
    "http://earthonion.com/download0/stream.m3u8",
  ];


  // == (3) EDIT HERE: PLAYBACK TUNING ==
 
  var CONFIG = {
    // How long we tolerate startup, buffering, or temporary silence before recovery
    startupGraceMs: 45000,
    playingStallMs: 90000,
    bufferingStallMs: 120000,

    // How often the watchdog checks the player
    watchdogIntervalMs: 5000,

    // Retry behavior on the same stream
    baseRetryDelayMs: 4000,
    maxSameUrlRetries: 6,

    // Cooldown to avoid repeated rapid reopen loops
    refreshGuardMs: 4000,

    // Buffer profile for higher quality streams
    bufferTime: 90,
    bufferMemory: 64,
    bufferSize: 64,
    bufferAhead: 90,
    minBufferTime: 8,
    maxBufferTime: 90,
    startBufferTime: 5
  };

  // == (4) STATE ==

  var index = 0;
  var video = null;

  var autoMode = false;
  var loopMode = false;

  var overlay = null;
  var overlayTimers = [];

  var switching = false;
  var retryTimer = null;
  var watchdogTimer = null;
  var startupTimer = null;

  var sameUrlFailures = 0;
  var connected = true;

  var lastCurrentTime = 0;
  var lastProgressAt = 0;
  var refreshGuardUntil = 0;

  // == (5) SMALL HELPERS

  function now() {
    return Date.now ? Date.now() : new Date().getTime();
  }

  function currentUrl() {
    return STREAMS[index];
  }

  function clearTimers(list) {
    for (var i = 0; i < list.length; i++) {
      try { clearTimeout(list[i]); } catch (e1) {}
      try { clearInterval(list[i]); } catch (e2) {}
    }
    list.length = 0;
  }

  function safeSet(obj, key, value) {
    try {
      obj[key] = value;
      return true;
    } catch (e) {
      return false;
    }
  }

  function removeFromRoot(obj) {
    if (!obj || !jsmaf || !jsmaf.root || !jsmaf.root.children) return;
    try {
      var pos = jsmaf.root.children.indexOf(obj);
      if (pos !== -1) jsmaf.root.children.splice(pos, 1);
    } catch (e) {}
  }

  function closeVideo(obj) {
    if (!obj) return;
    try { if (typeof obj.stop === 'function') obj.stop(); } catch (e1) {}
    try { if (typeof obj.close === 'function') obj.close(); } catch (e2) {}
  }

  function safePlay() {
    if (!video) return;
    try { video.play(); } catch (e) {}
  }

  function safeOpen(url) {
    if (!video) return false;
    try {
      video.open(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  function getBufferedAheadSeconds() {
    try {
      if (!video) return null;

      if (typeof video.bufferedAhead === 'number') {
        return Math.max(0, video.bufferedAhead);
      }

      if (video.buffered && typeof video.buffered.length === 'number' && typeof video.currentTime === 'number') {
        var ct = video.currentTime || 0;
        for (var i = 0; i < video.buffered.length; i++) {
          var start = 0;
          var end = 0;
          try { start = video.buffered.start(i); } catch (e1) {}
          try { end = video.buffered.end(i); } catch (e2) {}
          if (ct >= start && ct <= end) {
            return Math.max(0, end - ct);
          }
        }
        return 0;
      }
    } catch (e) {}

    return null;
  }

  // == (6) OVERLAY / STATUS TEXT ==

  function ensureOverlay() {
    if (overlay) return;

    overlay = new Text({
      x: 10,
      y: 30,
      text: "",
      font: "20px Arial",
      color: "#00FF00",
      visible: true,
      opacity: 0,
      zIndex: 1000
    });

    jsmaf.root.children.push(overlay);
  }

  function showMessage(msg, isError) {
    ensureOverlay();
    clearTimers(overlayTimers);

    overlay.color = isError ? "#FF6666" : "#00FF00";
    overlay.text = msg;
    overlay.opacity = 0;
    overlay.visible = true;

    var fadeInStart = now();
    var fadeIn = setInterval(function () {
      var p = Math.min(1, (now() - fadeInStart) / 700);
      overlay.opacity = p;

      if (p >= 1) {
        clearInterval(fadeIn);

        var hold = setTimeout(function () {
          var fadeOutStart = now();
          var fadeOut = setInterval(function () {
            var p2 = 1 - Math.min(1, (now() - fadeOutStart) / 900);
            overlay.opacity = p2;

            if (p2 <= 0) {
              clearInterval(fadeOut);
              overlay.visible = false;
            }
          }, 16);

          overlayTimers.push(fadeOut);
        }, 900);

        overlayTimers.push(hold);
      }
    }, 16);

    overlayTimers.push(fadeIn);
  }

  // == (7) BUFFER PROFILE ==
  
  function applyBufferProfile(obj) {
    if (!obj) return;

    // Standard prebuffer behavior
    safeSet(obj, "preload", "auto");

    // Buffer-related hints for different player implementations
    safeSet(obj, "bufferTime", CONFIG.bufferTime);
    safeSet(obj, "bufferMemory", CONFIG.bufferMemory);
    safeSet(obj, "bufferSize", CONFIG.bufferSize);
    safeSet(obj, "bufferAhead", CONFIG.bufferAhead);
    safeSet(obj, "minBufferTime", CONFIG.minBufferTime);
    safeSet(obj, "maxBufferTime", CONFIG.maxBufferTime);
    safeSet(obj, "startBufferTime", CONFIG.startBufferTime);

    // Generic buffering flags
    safeSet(obj, "useBuffer", true);
    safeSet(obj, "enableBuffer", true);
    safeSet(obj, "autoBuffer", true);
    safeSet(obj, "allowBuffering", true);

    // Playback defaults
    safeSet(obj, "muted", false);
    safeSet(obj, "volume", 1.0);

    try {
      if (obj.audioTracks) obj.audioTracks.enabled = true;
    } catch (e) {}
  }

  // == (8) WATCHDOGS ==

  function stopWatchdog() {
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
  }

  function stopStartupTimer() {
    if (startupTimer) {
      clearTimeout(startupTimer);
      startupTimer = null;
    }
  }

  function startWatchdog() {
    stopWatchdog();

    lastCurrentTime = video ? (video.currentTime || 0) : 0;
    lastProgressAt = now();

    watchdogTimer = setInterval(function () {
      if (switching || !video) return;

      var state = video.state || "";
      if (state !== "Playing" && state !== "Buffering") return;

      var ct = video.currentTime || 0;
      var currentNow = now();

      if (video.readyState && video.readyState < 2) return;

      if (ct !== lastCurrentTime) {
        lastCurrentTime = ct;
        lastProgressAt = currentNow;
        return;
      }

      var stalledFor = currentNow - lastProgressAt;
      var bufferedAhead = getBufferedAheadSeconds();

      if (state === "Playing") {
        if (stalledFor >= CONFIG.playingStallMs) {
          recoverSameUrl("Playback stalled");
        }
        return;
      }

      if (state === "Buffering") {
        // For high-quality streams, let it buffer much longer before recovery.
        // If buffer is clearly progressing, stay hands-off.
        if (bufferedAhead !== null && bufferedAhead > 0) {
          if (stalledFor >= CONFIG.bufferingStallMs) {
            recoverSameUrl("Buffering took too long");
          }
        } else {
          if (stalledFor >= CONFIG.bufferingStallMs) {
            recoverSameUrl("Buffering stuck");
          }
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

  // == (9) PLAYER LIFECYCLE ==

  function destroyVideo() {
    stopWatchdog();
    stopStartupTimer();

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    if (video) {
      removeFromRoot(video);
      closeVideo(video);
      video = null;
    }
  }

  function buildVideo() {
    destroyVideo();

    var w = jsmaf.screenWidth || 1920;
    var h = jsmaf.screenHeight || 1080;

    video = new Video({
      x: 0,
      y: 0,
      width: w,
      height: h,
      visible: true,
      autoplay: true,
      audio: true,
      preload: "auto"
    });

    applyBufferProfile(video);

    video.onOpen = function () {
      switching = false;
      lastCurrentTime = 0;
      lastProgressAt = now();
      applyBufferProfile(video);
      safePlay();
      startWatchdog();
      startStartupTimer();
    };

    video.onstatechange = function (state) {
      if (switching) return;

      if (state === "Playing") {
        lastCurrentTime = video.currentTime || 0;
        lastProgressAt = now();
        stopStartupTimer();
      }

      if (state === "Ended") {
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

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    var url = currentUrl();

    try {
      closeVideo(video);
    } catch (e) {}

    setTimeout(function () {
      try {
        applyBufferProfile(video);
        safeOpen(url);
      } catch (e2) {}
      switching = false;
      refreshGuardUntil = now() + CONFIG.refreshGuardMs;
      lastProgressAt = now();
      startWatchdog();
      startStartupTimer();

      if (!silent) {
        showMessage("Video " + (index + 1), false);
      }
    }, 120);
  }

  function softReopenSameUrl() {
    if (!video || switching) return;

    switching = true;
    stopWatchdog();
    stopStartupTimer();

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    refreshGuardUntil = now() + CONFIG.refreshGuardMs;

    try {
      applyBufferProfile(video);
      safeOpen(currentUrl());
    } catch (e) {}

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

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    refreshGuardUntil = now() + CONFIG.refreshGuardMs;

    var url = currentUrl();

    destroyVideo();

    setTimeout(function () {
      buildVideo();
      try {
        applyBufferProfile(video);
        safeOpen(url);
      } catch (e2) {}
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


  // == (10) RECOVERY  ==
  function scheduleRetry(fn, attempt) {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    var delay = CONFIG.baseRetryDelayMs * Math.pow(2, Math.max(0, attempt - 1));
    retryTimer = setTimeout(function () {
      fn();
    }, delay);
  }

  function recoverSameUrl(reason) {
    if (switching) return;

    var current = now();
    if (current < refreshGuardUntil) return;

    sameUrlFailures += 1;

    if (sameUrlFailures <= 2) {
      showMessage(reason + " - retrying same stream", true);
      scheduleRetry(function () {
        softReopenSameUrl();
      }, sameUrlFailures);
      return;
    }

    if (sameUrlFailures <= CONFIG.maxSameUrlRetries) {
      showMessage(reason + " - rebuilding player", true);
      scheduleRetry(function () {
        hardRebuildSameUrl();
      }, sameUrlFailures);
      return;
    }

    sameUrlFailures = 0;
    showMessage(reason + " - switching channel", true);
    goNext(false);
  }

  function goNext(silent) {
    if (STREAMS.length <= 1) return;
    sameUrlFailures = 0;
    index = (index + 1) % STREAMS.length;
    openCurrentStream(silent);
    if (!silent) showMessage("Next: Video " + (index + 1), false);
  }

  function goPrev() {
    if (STREAMS.length <= 1) return;
    sameUrlFailures = 0;
    index = (index - 1 + STREAMS.length) % STREAMS.length;
    openCurrentStream(false);
    showMessage("Previous: Video " + (index + 1), false);
  }

  // == (11) MODES / INPUT ==
  
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

  function handleKeyDown(keyCode) {
    switch (keyCode) {
      case 5:
        goNext(false);
        break;
      case 7:
        goPrev();
        break;
      case 12:
        toggleLoop();
        break;
      case 15:
        toggleAuto();
        break;
      case 16:
        manualRefresh();
        break;
      case 13:
        if (retryTimer) clearTimeout(retryTimer);
        jsmaf.setTimeout(function () {
          if (typeof debugging !== "undefined" && debugging && typeof debugging.restart === "function") {
            debugging.restart();
          } else {
            location.reload();
          }
        }, 100);
        break;
      default:
        break;
    }
  }

  function onNetworkStatusChange(status) {
    if (status === "connected") {
      if (!connected) {
        connected = true;
        showMessage("Network reconnected", false);
        manualRefresh();
      }
    } else if (status === "disconnected") {
      connected = false;
      showMessage("Network disconnected", true);
    }
  }

  // == (12) INIT
  
  try {
    jsmaf.remotePlay = true;
    jsmaf.onKeyDown = handleKeyDown;

    var previousNetworkHandler = jsmaf.onNetworkStatusChange;
    jsmaf.onNetworkStatusChange = function (status) {
      try {
        if (typeof previousNetworkHandler === "function") {
          previousNetworkHandler(status);
        }
      } catch (e) {}
      onNetworkStatusChange(status);
    };

    buildVideo();
    openCurrentStream(false);
  } catch (e) {
    alert("Error: " + e.message);
  }
})();
