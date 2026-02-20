(function () {
  try {
    log("Restarting main menu BGM...");

    // If the original audio exists, itll stop it
    if (typeof audio !== "undefined" && audio) {
      try {
        if (typeof audio.stop === "function") {
          audio.stop();
        }
      } catch (e) {
        log("Audio stop failed: " + e.message);
      }

      try {
        // Reopen the file to reset playback position
        audio.open("file://../download0/sfx/bgm.wav");
        if (typeof audio.play === "function") {
          audio.play();
        }
        log("BGM restarted using existing audio object.");
        return;
      } catch (e) {
        log("Audio reopen failed: " + e.message);
      }
    }

    // Fallback: create a new AudioClip safely
    try {
      var newAudio = new jsmaf.AudioClip();
      newAudio.volume = 0.5;
      newAudio.open("file://../download0/sfx/bgm.wav");
      if (typeof newAudio.play === "function") {
        newAudio.play();
      }
      log("BGM restarted using new AudioClip instance.");
    } catch (e) {
      log("Fallback audio restart failed: " + e.message);
    }

  } catch (err) {
    log("restart_bgm.js error: " + err.message);
  }
})();