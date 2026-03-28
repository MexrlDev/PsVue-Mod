// a script made by earthonion to stream m3u8 online, pulled from the new drop of the installer of VUE AFTER FREE.
 
(function () {
  if (typeof stopBgm === 'function') {
    try {
      stopBgm(); // Stop any playing music
    } catch (e) {}
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

  // === Background video setup ===
  var VIDEO_URL = "http://earthonion.com/download0/stream.m3u8";

  var _bgVideo = null;
  var _bgVideo2 = null;
  var _bgCurrent = null;
  var _bgNext = null;
  var _bgPreloadStarted = false;

  function setupBackground() {
    var screenW = jsmaf.screenWidth || 1920;
    var screenH = jsmaf.screenHeight || 1080;

    // Create two video elements
    _bgVideo = new Video({ x: 0, y: 0, width: screenW, height: screenH, visible: true, autoplay: true });
    _bgVideo2 = new Video({ x: 0, y: 0, width: screenW, height: screenH, visible: false, autoplay: false });
    _bgCurrent = _bgVideo;
    _bgNext = _bgVideo2;

    function setupBgCallbacks(v) {
      v.onOpen = function() {
        if (v === _bgCurrent) v.play();
      };
      v.onstatechange = function(state) {
        if (v === _bgCurrent && state === 'Ended') {
          // Swap videos
          _bgNext.visible = true;
          _bgNext.play();
          _bgCurrent.visible = false;
          var tmp = _bgCurrent;
          _bgCurrent = _bgNext;
          _bgNext = tmp;
          _bgPreloadStarted = false;
        }
      };
    }
    setupBgCallbacks(_bgVideo);
    setupBgCallbacks(_bgVideo2);

    // Preload next video when halfway through current
    jsmaf.onEnterFrame = function() {
      if (_bgCurrent && _bgCurrent.duration > 0 && _bgCurrent.elapsed > 0) {
        if (!_bgPreloadStarted && _bgCurrent.elapsed >= _bgCurrent.duration * 0.5) {
          _bgPreloadStarted = true;
          _bgNext.open(VIDEO_URL);
        }
      }
    };

    // Start first video
    _bgVideo.open(VIDEO_URL);

    // Clear any existing children and add videos
    jsmaf.root.children.length = 0;
    jsmaf.root.children.push(_bgVideo);
    jsmaf.root.children.push(_bgVideo2);
  }

  // === Key handler ===
  function handleKeyDown(keyCode) {
    if (keyCode === 13) {
      jsmaf.setTimeout(function () {
        if (typeof debugging !== 'undefined' && debugging && typeof debugging.restart === 'function') {
          debugging.restart();
        } else {
          location.reload();
        }
      }, 100);
    }
  }

  // === Initialize ===
  try {
    // Enable remote play (required for video)
    jsmaf.remotePlay = true;

    setupBackground();

    // Set key handler
    jsmaf.onKeyDown = handleKeyDown;

    console.log("Background video running.");
  } catch(e) {
    alert("Error: " + e.message);
  }
})();
