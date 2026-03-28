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
    "http://content.jwplatform.com/manifests/yp34SRmf.m3u8",  // default
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

  // === get current URL ===
  function getCurrentUrl() {
    return VIDEO_URLS[currentIndex];
  }

  // === message.. ===
  function showFadeMessage(msg) {
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

  // === Video creation ===
  function createBackgroundVideo() {
    var screenW = jsmaf.screenWidth || 1920;
    var screenH = jsmaf.screenHeight || 1080;

    _video = new Video({ x: 0, y: 0, width: screenW, height: screenH, visible: true, autoplay: true });

    _video.onOpen = function () {
      _video.play();
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

  // === Play current URL (close old, open new) with optional delay lol. i wont let it CRASH... ===
  function playCurrentUrl(silent) {
    if (!_video) return;
    _switching = true;

    try {
      _video.close();   // kill previous playback
    } catch (e) {}

    setTimeout(function () {
      try {
        _video.open(getCurrentUrl());
      } catch (e) {}
      _switching = false;
      if (!silent) {
        showFadeMessage("Video " + (currentIndex + 1));
      }
    }, 50);
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

  // === Toggle auto mode (key 15) ===
  function toggleAuto() {
    autoMode = !autoMode;
    if (autoMode && loopMode) loopMode = false;
    showFadeMessage(autoMode ? "AUTO ENABLED" : "AUTO DISABLED");
  }

  // === Toggle loop mode (key 12) ===
  function toggleLoop() {
    loopMode = !loopMode;
    if (loopMode && autoMode) autoMode = false;
    showFadeMessage(loopMode ? "LOOP ENABLED" : "LOOP DISABLED");
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
    console.log("Loaded.. yeah.");
  } catch(e) {
    alert("Error: " + e.message);
  }
})();
