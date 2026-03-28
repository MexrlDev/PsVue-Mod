
(function () {
  // --- Clean up any existing BGM to avoid conflicts ---
  if (typeof stopBgm === 'function') {
    try { stopBgm(); } catch (e) {}
  }
  if (typeof startBgmIfEnabled !== 'undefined') {
    startBgmIfEnabled = function () {};
  }
  if (typeof bgmClip !== 'undefined' && bgmClip) {
    try {
      if (typeof bgmClip.stop === 'function') bgmClip.stop();
      if (typeof bgmClip.close === 'function') bgmClip.close();
    } catch (e) {}
    bgmClip = null;
  }

  // ==================== CONFIGURATION ====================
  var VIDEO_URLS = [
    "http://content.jwplatform.com/manifests/yp34SRmf.m3u8",
    "http://earthonion.com/download0/stream.m3u8"
  ];

  // Default settings (can be changed at runtime)
  var SETTINGS = {
    bufferTime: 60,
    watchdogThreshold: 30000,
    maxRetries: 10,
    retryBaseDelay: 5000,
    crossfadeDuration: 500,
    autoMode: false,
    loopMode: false
  };

  // ==================== INTERNAL STATE ====================
  var activeVideo = null;
  var nextVideo = null;
  var currentIndex = 0;
  var fadeText = null;
  var fadeTimeouts = [];
  var _switching = false;
  var retryCount = 0;
  var retryTimeout = null;
  var networkConnected = true;
  var settingsVisible = false;
  var settingsText = null;

  // Watchdog state
  var watchdogTimer = null;
  var lastProgressTime = 0;
  var lastCurrentTime = 0;

  // ==================== HELPER FUNCTIONS ====================
  function getCurrentUrl() {
    return VIDEO_URLS[currentIndex];
  }

  // ---- UI Feedback ----
  function showFadeMessage(msg, isError) {
    for (var i = 0; i < fadeTimeouts.length; i++) {
      clearTimeout(fadeTimeouts[i]);
    }
    fadeTimeouts = [];

    if (!fadeText) {
      fadeText = new Text({
        x: 10,
        y: 30,
        text: "",
        font: "20px Arial",
        color: "#00FF00",
        visible: true,
        opacity: 0,
        zIndex: 1000
      });
      jsmaf.root.children.push(fadeText);
    }

    fadeText.color = isError ? "#FF6666" : "#00FF00";
    fadeText.text = msg;
    fadeText.opacity = 0;
    fadeText.visible = true;

    var startTime = Date.now();
    var fadeInInterval = setInterval(function () {
      var elapsed = Date.now() - startTime;
      var progress = Math.min(1, elapsed / 1000);
      fadeText.opacity = progress;
      if (progress >= 1) {
        clearInterval(fadeInInterval);
        var stayTimeout = setTimeout(function () {
          var fadeOutStart = Date.now();
          var fadeOutInterval = setInterval(function () {
            var elapsed2 = Date.now() - fadeOutStart;
            var progress2 = 1 - Math.min(1, elapsed2 / 1000);
            fadeText.opacity = progress2;
            if (progress2 <= 0) {
              clearInterval(fadeOutInterval);
              fadeText.visible = false;
            }
          }, 16);
          fadeTimeouts.push(fadeOutInterval);
        }, 1000);
        fadeTimeouts.push(stayTimeout);
      }
    }, 16);
    fadeTimeouts.push(fadeInInterval);
  }

  // ---- Settings UI ----
  function updateSettingsDisplay() {
    if (!settingsText) {
      settingsText = new Text({
        x: 10,
        y: 100,
        text: "",
        font: "18px Arial",
        color: "#FFFFFF",
        visible: false,
        zIndex: 1001,
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: 10
      });
      jsmaf.root.children.push(settingsText);
    }

    if (settingsVisible) {
      settingsText.text = 
        "=== SETTINGS ===\n" +
        "Buffer time: " + SETTINGS.bufferTime + " sec\n" +
        "Watchdog threshold: " + (SETTINGS.watchdogThreshold / 1000) + " sec\n" +
        "Max retries: " + SETTINGS.maxRetries + "\n" +
        "Auto mode: " + (SETTINGS.autoMode ? "ON" : "OFF") + "\n" +
        "Loop mode: " + (SETTINGS.loopMode ? "ON" : "OFF") + "\n" +
        "Press INFO again to close";
      settingsText.visible = true;
    } else {
      settingsText.visible = false;
    }
  }

  function toggleSettings() {
    settingsVisible = !settingsVisible;
    updateSettingsDisplay();
  }

  function adjustBuffer(delta) {
    var newVal = SETTINGS.bufferTime + delta;
    if (newVal < 5) newVal = 5;
    if (newVal > 300) newVal = 300;
    SETTINGS.bufferTime = newVal;
    if (activeVideo) {
      activeVideo.bufferTime = SETTINGS.bufferTime;
    }
    showFadeMessage("Buffer set to " + SETTINGS.bufferTime + " sec");
    updateSettingsDisplay();
  }

  function adjustWatchdog(delta) {
    var newVal = SETTINGS.watchdogThreshold + delta;
    if (newVal < 5000) newVal = 5000;
    if (newVal > 120000) newVal = 120000;
    SETTINGS.watchdogThreshold = newVal;
    showFadeMessage("Watchdog set to " + (SETTINGS.watchdogThreshold / 1000) + " sec");
    updateSettingsDisplay();
  }

  function adjustMaxRetries(delta) {
    var newVal = SETTINGS.maxRetries + delta;
    if (newVal < 1) newVal = 1;
    if (newVal > 20) newVal = 20;
    SETTINGS.maxRetries = newVal;
    showFadeMessage("Max retries set to " + SETTINGS.maxRetries);
    updateSettingsDisplay();
  }

  // ---- Video creation with proper buffer ----
  function createVideoElement(x, y, width, height, bufferTime) {
    var video = new Video({
      x: x,
      y: y,
      width: width,
      height: height,
      visible: false,
      autoplay: false,
      preload: 'auto',
      bufferTime: bufferTime,
      audio: true
    });
    video.muted = false;
    video.volume = 1.0;
    if (video.audioTracks) {
      try { video.audioTracks.enabled = true; } catch(e) {}
    }
    jsmaf.root.children.push(video);
    return video;
  }

  // ---- Crossfade between two videos ----
  function crossfadeToNewVideo(newVideo, newUrl, onComplete) {
    if (!activeVideo) {
      newVideo.open(newUrl);
      newVideo.visible = true;
      activeVideo = newVideo;
      if (onComplete) onComplete();
      return;
    }

    newVideo.open(newUrl);
    newVideo.visible = true;
    newVideo.opacity = 0;

    var fadeInterval = setInterval(function () {
      var step = 0.05;
      if (activeVideo.opacity > 0) {
        activeVideo.opacity -= step;
        if (activeVideo.opacity < 0) activeVideo.opacity = 0;
      }
      if (newVideo.opacity < 1) {
        newVideo.opacity += step;
        if (newVideo.opacity > 1) newVideo.opacity = 1;
      }
      if (activeVideo.opacity <= 0 && newVideo.opacity >= 1) {
        clearInterval(fadeInterval);
        try {
          activeVideo.close();
          var idx = jsmaf.root.children.indexOf(activeVideo);
          if (idx !== -1) jsmaf.root.children.splice(idx, 1);
        } catch(e) {}
        activeVideo = newVideo;
        if (onComplete) onComplete();
      }
    }, 20);
  }

  // ---- Watchdog: monitors playback health ----
  function startWatchdog() {
    stopWatchdog();
    lastProgressTime = Date.now();
    lastCurrentTime = activeVideo ? (activeVideo.currentTime || 0) : 0;
    watchdogTimer = setInterval(function () {
      if (_switching || !activeVideo) return;
      var state = activeVideo.state;
      if (state !== 'Playing' && state !== 'Buffering') return;
      var now = Date.now();
      var currentTime = activeVideo.currentTime || 0;
      if (activeVideo.readyState && activeVideo.readyState < 2) return;

      if (currentTime === lastCurrentTime && (now - lastProgressTime) > SETTINGS.watchdogThreshold) {
        showFadeMessage("Stream appears stuck – reconnecting", true);
        refreshCurrentVideo();
      } else if (currentTime !== lastCurrentTime) {
        lastProgressTime = now;
        lastCurrentTime = currentTime;
      }
    }, 5000);
  }

  function stopWatchdog() {
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
  }

  // ---- Refresh current video (close & reopen) ----
  function refreshCurrentVideo() {
    if (_switching || !activeVideo) return;
    _switching = true;
    stopWatchdog();
    if (retryTimeout) clearTimeout(retryTimeout);
    var screenW = jsmaf.screenWidth || 1920;
    var screenH = jsmaf.screenHeight || 1080;
    var newVideo = createVideoElement(0, 0, screenW, screenH, SETTINGS.bufferTime);
    crossfadeToNewVideo(newVideo, getCurrentUrl(), function () {
      _switching = false;
      startWatchdog();
      retryCount = 0;
    });
  }

  // ---- Switch to a different video (with preload) ----
  function switchToVideo(index, silent) {
    if (_switching) return;
    if (index === currentIndex && activeVideo && activeVideo.state === 'Playing') return;

    _switching = true;
    stopWatchdog();
    if (retryTimeout) clearTimeout(retryTimeout);
    retryCount = 0;

    currentIndex = index;
    var url = getCurrentUrl();

    var screenW = jsmaf.screenWidth || 1920;
    var screenH = jsmaf.screenHeight || 1080;
    var newVideo = createVideoElement(0, 0, screenW, screenH, SETTINGS.bufferTime);

    crossfadeToNewVideo(newVideo, url, function () {
      _switching = false;
      startWatchdog();
      if (!silent) {
        showFadeMessage("Video " + (currentIndex + 1));
      }
    });
  }

  // ---- Next/Prev navigation ----
  function nextVideo(silent) {
    if (VIDEO_URLS.length <= 1) return;
    var next = (currentIndex + 1) % VIDEO_URLS.length;
    switchToVideo(next, silent);
    if (!silent) showFadeMessage("Next: Video " + (next + 1));
  }

  function prevVideo() {
    if (VIDEO_URLS.length <= 1) return;
    var prev = (currentIndex - 1 + VIDEO_URLS.length) % VIDEO_URLS.length;
    switchToVideo(prev, false);
    showFadeMessage("Previous: Video " + (prev + 1));
  }

  // ---- Mode toggles ----
  function toggleAuto() {
    SETTINGS.autoMode = !SETTINGS.autoMode;
    if (SETTINGS.autoMode && SETTINGS.loopMode) SETTINGS.loopMode = false;
    showFadeMessage("Auto mode: " + (SETTINGS.autoMode ? "ON" : "OFF"));
    updateSettingsDisplay();
  }

  function toggleLoop() {
    SETTINGS.loopMode = !SETTINGS.loopMode;
    if (SETTINGS.loopMode && SETTINGS.autoMode) SETTINGS.autoMode = false;
    showFadeMessage("Loop mode: " + (SETTINGS.loopMode ? "ON" : "OFF"));
    updateSettingsDisplay();
  }

  // ---- Error handling & retries ----
  function handleVideoError() {
    if (_switching) return;
    retryCount++;
    if (retryCount <= SETTINGS.maxRetries) {
      var delay = SETTINGS.retryBaseDelay * Math.pow(2, retryCount - 1);
      var msg = "Stream error – retry " + retryCount + "/" + SETTINGS.maxRetries;
      if (retryCount === SETTINGS.maxRetries) msg = "Last retry attempt";
      showFadeMessage(msg, true);
      if (retryTimeout) clearTimeout(retryTimeout);
      retryTimeout = setTimeout(function () {
        refreshCurrentVideo();
      }, delay);
    } else {
      showFadeMessage("Stream failed – switching to next", true);
      retryCount = 0;
      nextVideo(false);
    }
  }

  function onVideoEnded() {
    if (_switching) return;
    if (SETTINGS.loopMode) {
      refreshCurrentVideo();   // restart same video
    } else if (SETTINGS.autoMode) {
      nextVideo(true);
    }
  }

  // ---- Network status handling ----
  function onNetworkStatusChange(status) {
    if (status === "connected") {
      if (!networkConnected) {
        networkConnected = true;
        showFadeMessage("Network reconnected");
        if (activeVideo && (activeVideo.state === 'Error' || activeVideo.state === 'Stopped')) {
          refreshCurrentVideo();
        }
      }
    } else if (status === "disconnected") {
      networkConnected = false;
      showFadeMessage("Network disconnected", true);
    }
  }

  // ---- Key handler ----
  function handleKeyDown(keyCode) {
    switch (keyCode) {
      case 5:   // Right -> next
        nextVideo();
        break;
      case 7:   // Left -> previous
        prevVideo();
        break;
      case 12:  // Triangle -> loop
        toggleLoop();
        break;
      case 16:  // Square -> refresh
        showFadeMessage("Manual refresh");
        refreshCurrentVideo();
        break;
      case 15:  // Circle -> auto
        toggleAuto();
        break;
      case 13:  // X -> restart
        if (retryTimeout) clearTimeout(retryTimeout);
        jsmaf.setTimeout(function () {
          if (typeof debugging !== 'undefined' && debugging && typeof debugging.restart === 'function') {
            debugging.restart();
          } else {
            location.reload();
          }
        }, 100);
        break;
      case 38:  // Up -> increase buffer
        adjustBuffer(5);
        break;
      case 40:  // Down -> decrease buffer
        adjustBuffer(-5);
        break;
      case 99:  // INFO / Menu (often 99) – toggle settings
        toggleSettings();
        break;
      default:
        break;
    }
  }

  // ---- Initialization ----
  function init() {
    try {
      jsmaf.remotePlay = true;
      jsmaf.onKeyDown = handleKeyDown;
      if (typeof jsmaf.onNetworkStatusChange === 'function') {
        jsmaf.onNetworkStatusChange = onNetworkStatusChange;
      }

      var screenW = jsmaf.screenWidth || 1920;
      var screenH = jsmaf.screenHeight || 1080;
      activeVideo = createVideoElement(0, 0, screenW, screenH, SETTINGS.bufferTime);
      activeVideo.onOpen = function () {
        activeVideo.play();
        startWatchdog();
        retryCount = 0;
      };
      activeVideo.onstatechange = function (state) {
        if (state === 'Ended') onVideoEnded();
      };
      activeVideo.onerror = handleVideoError;
      activeVideo.open(getCurrentUrl());
    } catch(e) {
      alert("Error: " + e.message);
    }
  }

  init();
})();
