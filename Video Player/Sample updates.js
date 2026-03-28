// a script made by earthonion to stream m3u8 online, pulled from the new drop of the installer of VUE AFTER FREE.

// Modified by MexrlDev

(function () {
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

  // === CONFIGURATION ===
  var VIDEO_URLS = [
    "http://content.jwplatform.com/manifests/yp34SRmf.m3u8",
    "http://earthonion.com/download0/stream.m3u8"
  ];
  var SPLASH_PATH = "file://../download0/payloads/Vid-Player/splash.jpg";
  var SPLASH_DURATION = 3000;

  var currentIndex = 0;
  var _video = null;
  var autoMode = false;
  var loopMode = false;
  var splashActive = false;
  var fadeText = null;
  var fadeTimeouts = [];
  var _switching = false;
  var _audioRetryCount = 0;
  var _audioCheckInterval = null;

  // === get current URL ===
  function getCurrentUrl() {
    return VIDEO_URLS[currentIndex];
  }

  // === fade message ===
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

    // Change color for errors
    if (isError) {
      fadeText.color = "#FF6666";
    } else {
      fadeText.color = "#00FF00";
    }

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

  // === fetch and parse m3u8 manifest to find audio track URL ===
  function fetchManifest(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        callback(xhr.responseText);
      } else if (xhr.readyState === 4) {
        callback(null);
      }
    };
    xhr.send();
  }

  // === extract audio track URL from manifest ===
  function getAudioTrackUrl(manifest, baseUrl) {
    var lines = manifest.split('\n');
    var audioGroupId = null;
    var audioUri = null;
    
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('#EXT-X-MEDIA:TYPE=AUDIO') !== -1) {
        var uriMatch = line.match(/URI="([^"]+)"/);
        var defaultMatch = line.match(/DEFAULT=([A-Z]+)/);
        var autoSelectMatch = line.match(/AUTOSELECT=([A-Z]+)/);
        
        if (defaultMatch && defaultMatch[1] === 'YES') {
          if (uriMatch && uriMatch[1]) {
            audioUri = uriMatch[1];
            break;
          }
        } else if (autoSelectMatch && autoSelectMatch[1] === 'YES') {
          if (uriMatch && uriMatch[1] && !audioUri) {
            audioUri = uriMatch[1];
          }
        } else if (uriMatch && uriMatch[1] && !audioUri) {
          audioUri = uriMatch[1];
        }
      }
    }
    
    if (audioUri) {
      var basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
      if (audioUri.indexOf('http://') === 0 || audioUri.indexOf('https://') === 0) {
        return audioUri;
      }
      return basePath + audioUri;
    }
    return null;
  }

  // === create a separate audio element if needed (fallback) ===
  var _altAudio = null;

  function createAltAudio(url) {
    if (_altAudio) {
      try { _altAudio.stop(); } catch(e) {}
      try { _altAudio.close(); } catch(e) {}
      _altAudio = null;
    }
    try {
      _altAudio = new Audio({ url: url, autoplay: true, loop: false });
      _altAudio.volume = 1.0;
      _altAudio.muted = false;
    } catch(e) {}
  }

  // === monitor audio and retry if no sound ===
  function startAudioMonitoring() {
    if (_audioCheckInterval) clearInterval(_audioCheckInterval);
    _audioRetryCount = 0;
    _audioCheckInterval = setInterval(function() {
      if (!_video) return;
      if (_video.duration > 0 && _video.elapsed > 5 && _audioRetryCount < 3) {
        if (_video.audioTracks && _video.audioTracks.length === 0) {
          console.log("No audio tracks, reloading...");
          _audioRetryCount++;
          var currentUrl = getCurrentUrl();
          try {
            _video.close();
            setTimeout(function() {
              _video.open(currentUrl);
            }, 100);
          } catch(e) {}
        }
      }
    }, 5000);
  }

  // === Video creation with audio-first loading ===
  function createBackgroundVideo() {
    var screenW = jsmaf.screenWidth || 1920;
    var screenH = jsmaf.screenHeight || 1080;

    _video = new Video({
      x: 0,
      y: 0,
      width: screenW,
      height: screenH,
      visible: true,
      autoplay: true,
      audio: true
    });

    // Force unmute and full volume
    _video.muted = false;
    _video.volume = 1.0;

    if (_video.audioTracks) {
      try {
        _video.audioTracks.enabled = true;
      } catch(e) {}
    }

    _video.onOpen = function () {
      _video.play();
      // Ensure audio settings stick
      setTimeout(function() {
        if (_video) {
          _video.muted = false;
          _video.volume = 1.0;
        }
      }, 100);
    };

    _video.onstatechange = function (state) {
      if (_switching) return;
      if (state === 'Ended') {
        if (loopMode) {
          restartCurrentVideo();
        } else if (autoMode) {
          nextVideo(true);
        } else {
          console.log("Video ended, stopped.");
        }
      }
    };

    jsmaf.root.children.push(_video);
  }

  // === Play current URL with audio-first loading ===
  function playCurrentUrl(silent) {
    if (!_video) return;
    _switching = true;

    try {
      _video.close();
    } catch (e) {}

    var currentUrl = getCurrentUrl();
    fetchManifest(currentUrl, function(manifest) {
      if (manifest) {
        var audioUrl = getAudioTrackUrl(manifest, currentUrl);
        if (audioUrl) {
          console.log("Found separate audio track:", audioUrl);
        }
      }
      setTimeout(function () {
        try {
          _video.open(currentUrl);
        } catch (e) {
          console.log("Error opening video:", e);
        }
        _switching = false;
        if (!silent) {
          showFadeMessage("Video " + (currentIndex + 1));
        }
        startAudioMonitoring();
      }, 50);
    });
  }

  // === Restart current video ===
  function restartCurrentVideo() {
    if (!_video) return;
    _switching = true;
    try {
      _video.close();
    } catch (e) {}
    setTimeout(function () {
      try {
        _video.open(getCurrentUrl());
      } catch (e) {}
      _switching = false;
      showFadeMessage("Looping: Video " + (currentIndex + 1));
    }, 50);
  }

  // === Change to a new index ===
  function changeVideo(newIndex, silent) {
    if (newIndex === currentIndex) return;
    currentIndex = newIndex;
    playCurrentUrl(silent);
  }

  // === Navigation: next (D-PAD right) ===
  function nextVideo(silent) {
    if (VIDEO_URLS.length <= 1) return;
    var next = (currentIndex + 1) % VIDEO_URLS.length;
    changeVideo(next, silent);
    if (!silent) showFadeMessage("Next: Video " + (next + 1));
  }

  // === Navigation: previous (D-Pad left) ===
  function prevVideo() {
    if (VIDEO_URLS.length <= 1) return;
    var prev = (currentIndex - 1 + VIDEO_URLS.length) % VIDEO_URLS.length;
    changeVideo(prev, false);
    showFadeMessage("Previous: Video " + (prev + 1));
  }

  // === Toggle auto mode (Square) ===
  function toggleAuto() {
    autoMode = !autoMode;
    if (autoMode && loopMode) loopMode = false;
    showFadeMessage(autoMode ? "AUTO ENABLED" : "AUTO DISABLED");
  }

  // === Toggle loop mode (Triangle) ===
  function toggleLoop() {
    loopMode = !loopMode;
    if (loopMode && autoMode) autoMode = false;
    showFadeMessage(loopMode ? "LOOP ENABLED" : "LOOP DISABLED");
  }

  // === Toggle mute/unmute (key 8) for debugging ===
  function toggleMute() {
    if (_video) {
      _video.muted = !_video.muted;
      showFadeMessage(_video.muted ? "MUTED" : "UNMUTED");
    }
  }

  // === Key handler ===
  function handleKeyDown(keyCode) {
    if (splashActive) {
      removeSplash();
      return;
    }

    if (keyCode === 5) {
      nextVideo();
    } else if (keyCode === 7) {
      prevVideo();
    } else if (keyCode === 12) {
      toggleLoop();
    } else if (keyCode === 15) {
      toggleAuto();
    } else if (keyCode === 8) {
      toggleMute();
    } else if (keyCode === 13) {
      jsmaf.setTimeout(function () {
        if (typeof debugging !== 'undefined' && debugging && typeof debugging.restart === 'function') {
          debugging.restart();
        } else {
          location.reload();
        }
      }, 100);
    }
  }

  // === Splash screen ===
  var splashImage = null;

  function removeSplash() {
    if (!splashActive) return;
    splashActive = false;
    if (splashImage) {
      try {
        splashImage.visible = false;
        jsmaf.root.children = jsmaf.root.children.filter(function(child) { return child !== splashImage; });
      } catch (e) {}
      splashImage = null;
    }
    showFadeMessage("Starting: Video " + (currentIndex + 1));
    createBackgroundVideo();
    playCurrentUrl();
  }

  function showSplash() {
    var screenW = jsmaf.screenWidth || 1920;
    var screenH = jsmaf.screenHeight || 1080;
    splashImage = new Image({
      url: SPLASH_PATH,
      x: 0,
      y: 0,
      width: screenW,
      height: screenH,
      visible: true,
      zIndex: 1000
    });
    jsmaf.root.children.push(splashImage);
    splashActive = true;

    jsmaf.setTimeout(function() {
      if (splashActive) removeSplash();
    }, SPLASH_DURATION);
  }

  // === Initialization ===
  try {
    jsmaf.remotePlay = true;
    jsmaf.onKeyDown = handleKeyDown;
    showSplash();
    console.log("Loaded. Audio-first loading enabled. Press 8 to toggle mute/unmute.");
  } catch(e) {
    alert("Error: " + e.message);
  }
})();
