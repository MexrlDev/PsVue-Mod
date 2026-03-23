// Script by MexrlDev
// Music goes into /download0/payloads/player/music/Foldername/ (or USB/music/)
// Covers can be placed in /download0/payloads/player/cover/Foldername/song.png
// Also supports covers in the same folder as the song.

(function () {
  // ==================== DEPENDENCIES ====================
  if (typeof libc_addr === 'undefined') {
    log('Loading userland.js...');
    include('userland.js');
  }

  log('Loading check-jailbroken.js...');
  include('check-jailbroken.js');

  var is_jailbroken = checkJailbroken();

  // ==================== SYSTEM CALL WRAPPERS ====================
  fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(0x06, 'close_sys', ['bigint'], 'bigint');
  fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(0x03, 'read_sys', ['bigint', 'bigint', 'bigint'], 'bigint');

  // ==================== PATHS ====================
  var FS_BASE = '/download0/payloads/player/';
  var URL_BASE = 'file:///../download0/payloads/player/';

  var MUSIC_PARENT = 'music';           // name of the parent folder containing music subfolders
  var COVER_PARENT = 'cover';           // name of the global cover folder

  var DEFAULT_COVER = 'default_cover.png';
  var BG_FOLDER = 'bg/';
  var DEFAULT_BG_NAME = 'bg';

  var ICON_PREV = 'goneleft.png';
  var ICON_PLAY = 'play.png';
  var ICON_PAUSE = 'pause.png';
  var ICON_NEXT = 'goneright.png';
  var LOOP_IMAGE = 'Loop.png';
  var SHUFFLE_IMAGE = 'Shuffle.png';
  var AUTOPLAY_IMAGE = 'AutoPlay.png';
  var FOLDER_ICON = 'folder.png';

  // ==================== UI LAYOUT ====================
  var UI = {
    bg: { x: 0, y: 0, w: 1920, h: 1080 },
    cover: { x: 760, y: 150, w: 400, h: 400 },
    text: {
      gapUnderCover: 16,
      nameStyle: 'white',
      timeStyle: 'whiteSmall'
    },
    controls: {
      startX: 720,
      startY: 800,
      spacing: 200,
      iconW: 100,
      iconH: 100
    },
    modeText: { x: 20, y: 20, style: 'whiteSmall' },
    hints: {
      exit:   { x: 1700, y: 1000 },
      mode:   { x: 1700, y: 950 },
      refresh:{ x: 1700, y: 900 },
      loop:   { x: 1700, y: 850 },
      shuffle:{ x: 1700, y: 800 },
      autoPlay:{ x: 1700, y: 750 }
    },
    loopStatus:   { xOffset: 60, y: 850 },
    shuffleStatus:{ xOffset: 80, y: 800 },
    autoPlayStatus:{ xOffset: 98, y: 750 },
    loopImage:    { w: 30, h: 30 },
    shuffleImage: { w: 30, h: 30 },
    autoPlayImage:{ w: 30, h: 30 },
    list: {
      startX: 100,
      startY: 200,
      itemHeight: 70,
      coverSize: 60,
      titleX: 180,
      durationRightOffset: 665,
      visibleCount: 12
    }
  };

  // ==================== KEY CODES ====================
  var KEY_LEFT = 7;
  var KEY_RIGHT = 5;
  var KEY_UP = 4;
  var KEY_DOWN = 6;
  var KEY_ENTER = 14;
  var KEY_BACK = 13;
  var KEY_MODE = 12;
  var KEY_REFRESH = 15;
  var KEY_LOOP = 3;
  var KEY_SHUFFLE = 11;
  var KEY_AUTOPLAY = 9;

  // ==================== GLOBAL STATE ====================
  var currentMode = 'ps4';
  var folders = [];           // list of folder objects { name, path }
  var currentFolderIndex = -1;
  var songList = [];          // songs inside the selected folder
  var currentSongIndex = -1;
  var playing = false;
  var currentIcon = 1; // 0=prev, 1=play/pause, 2=next

  var audio = null;
  var coverImageObj = null;
  var playPauseImage = null;
  var iconImages = [];
  var songNameText = null;
  var songTimeText = null;
  var modeText = null;
  var modeFadeInterval = null;
  var bgList = [];
  var currentBgIndex = -1;
  var timerInterval = null;

  var bgImage = null;
  var prevIcon = null;
  var nextIcon = null;
  var exitHint = null;
  var modeHint = null;
  var refreshHint = null;
  var loopLabel = null;
  var loopStatus = null;
  var shuffleLabel = null;
  var shuffleStatus = null;
  var autoPlayLabel = null;
  var autoPlayStatus = null;
  var autoPlayImage = null;

  var coverRequestId = 0;
  var liveProbes = [];

  // Playback timer tracking
  var playbackAnchorMs = 0;
  var pausedAccumulatedMs = 0;
  var lastKnownPlaybackMs = 0;
  var trackDurationSeconds = 0;

  // Loop, shuffle, AutoPlay
  var loopEnabled = false;
  var shuffleEnabled = false;
  var autoPlayEnabled = false;
  var loopImage = null;
  var shuffleImage = null;
  var loopBlinkInterval = null;
  var shuffleBlinkInterval = null;
  var autoPlayBlinkInterval = null;

  var _hasShownNoFoldersNotification = false;

  // ==================== LIST STATE ====================
  var uiMode = 'list';           // 'list' or 'player'
  var listType = 'folders';      // 'folders' or 'songs'
  var selectedListIndex = 0;
  var listScrollOffset = 0;
  var listItemSlots = [];

  // ==================== KEY DEBOUNCE ====================
  var lastKeyPressTime = 0;
  var KEY_DEBOUNCE_MS = 200;

  // ==================== HELPERS ====================
  function logMsg(msg) {
    log('[Player] ' + msg);
  }

  function safeSetTimeout(fn, ms) {
    if (typeof jsmaf !== 'undefined' && jsmaf && typeof jsmaf.setTimeout === 'function') {
      return jsmaf.setTimeout(fn, ms);
    }
    return setTimeout(fn, ms);
  }

  function safeSetInterval(fn, ms) {
    if (typeof jsmaf !== 'undefined' && jsmaf && typeof jsmaf.setInterval === 'function') {
      return jsmaf.setInterval(fn, ms);
    }
    return setInterval(fn, ms);
  }

  function safeClearInterval(id) {
    if (id === null || id === undefined) return;
    if (typeof jsmaf !== 'undefined' && jsmaf && typeof jsmaf.clearInterval === 'function') {
      jsmaf.clearInterval(id);
      return;
    }
    clearInterval(id);
  }

  // Cleanup function to stop audio and timers properly
  function cleanupAudio() {
    if (audio) {
      try {
        if (typeof audio.stop === 'function') audio.stop();
        if (typeof audio.close === 'function') audio.close();
      } catch (e) { logMsg('Error stopping audio: ' + e.message); }
    }
    stopTimer();
    syncPlayIcon(false);
    playing = false;
    playbackAnchorMs = 0;
    pausedAccumulatedMs = 0;
    lastKnownPlaybackMs = 0;
  }

  function restartApp() {
    logMsg('Restarting application...');
    cleanupAudio();
    safeSetTimeout(function () {
      if (typeof debugging !== 'undefined' && debugging && typeof debugging.restart === 'function') {
        debugging.restart();
        return;
      }
      if (typeof jsmaf !== 'undefined' && jsmaf && typeof jsmaf.restart === 'function') {
        jsmaf.restart();
        return;
      }
      if (typeof location !== 'undefined' && location && typeof location.reload === 'function') {
        location.reload();
        return;
      }
      logMsg('Restart method not available.');
    }, 100);
  }

  function assetUrl(fileName) {
    return URL_BASE + fileName;
  }

  function bgAssetUrl(fileName) {
    return URL_BASE + BG_FOLDER + fileName;
  }

  function filePathToUrl(path) {
    if (!path) return '';
    if (path.indexOf('file://') === 0) return path;
    if (path.indexOf('/download0/') === 0) {
      return 'file:///../' + path.replace(/^\//, '');
    }
    return 'file://' + path;
  }

  function fileNameBase(name) {
    return (name || '').replace(/\.[^.]+$/, '');
  }

  function setImageUrl(img, url) {
    if (!img) return;
    try {
      img.url = url;
    } catch (e) {}
  }

  function setTextValue(txtObj, value) {
    if (!txtObj) return;
    try {
      txtObj.text = value;
    } catch (e) {}
  }

  function preloadImage(url) {
    var img = new Image();
    try {
      img.url = url;
    } catch (e) {}
  }

  function makeBig(lo, hi) {
    try {
      if (typeof BigInt === 'function') {
        return new BigInt(lo, hi);
      }
    } catch (e) {}
    return {
      lo: lo >>> 0,
      hi: hi >>> 0,
      eq: function (other) {
        return other && this.lo === other.lo && this.hi === other.hi;
      }
    };
  }

  function isFailBigInt(v) {
    if (!v) return false;
    return (typeof v.eq === 'function') && v.eq(makeBig(0xffffffff, 0xffffffff));
  }

  function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    return mins + ':' + (secs < 10 ? '0' + secs : secs);
  }

  function formatPlaybackText(positionSeconds, durationSeconds) {
    return formatTime(positionSeconds) + ' / ' + formatTime(durationSeconds);
  }

  function parseSongName(filename) {
    var base = (filename || '').replace(/\.[^.]+$/, '');
    return { displayName: base, number: null };
  }

  function writeCString(ptr, str) {
    for (var i = 0; i < str.length; i++) {
      mem.view(ptr).setUint8(i, str.charCodeAt(i) & 0xff);
    }
    mem.view(ptr).setUint8(str.length, 0);
  }

  function readFileBytes(path, maxBytes) {
    var path_addr = mem.malloc(path.length + 1);
    var buf = mem.malloc(maxBytes);
    writeCString(path_addr, path);

    var fd = fn.open_sys(path_addr, makeBig(0, 0), makeBig(0, 0));
    if (isFailBigInt(fd)) return null;

    var read_len = fn.read_sys(fd, buf, makeBig(0, maxBytes));
    fn.close_sys(fd);

    if (isFailBigInt(read_len)) return null;

    var len = read_len.lo >>> 0;
    if (!len) return null;

    var bytes = [];
    for (var j = 0; j < len; j++) {
      bytes.push(mem.view(buf).getUint8(j));
    }
    return bytes;
  }

  function getWavDuration(path) {
    var header = readFileBytes(path, 512);
    if (!header || header.length < 44) return 0;

    if (header[0] !== 0x52 || header[1] !== 0x49 || header[2] !== 0x46 || header[3] !== 0x46) return 0;
    if (header[8] !== 0x57 || header[9] !== 0x41 || header[10] !== 0x56 || header[11] !== 0x45) return 0;

    var audioFormat = header[20] + (header[21] << 8);
    if (audioFormat !== 1) return 0;

    var numChannels = header[22] + (header[23] << 8);
    var sampleRate = header[24] + (header[25] << 8) + (header[26] << 16) + (header[27] << 24);
    var bitsPerSample = header[34] + (header[35] << 8);

    var offset = 12;
    var dataSize = 0;

    while (offset + 8 <= header.length) {
      var chunkId = String.fromCharCode(
        header[offset],
        header[offset + 1],
        header[offset + 2],
        header[offset + 3]
      );
      var chunkSize = header[offset + 4] +
        (header[offset + 5] << 8) +
        (header[offset + 6] << 16) +
        (header[offset + 7] << 24);

      if (chunkId === 'data') {
        dataSize = chunkSize >>> 0;
        break;
      }
      if (chunkSize <= 0) break;
      offset += 8 + chunkSize;
    }

    if (!dataSize || !sampleRate || !numChannels || !bitsPerSample) return 0;

    var bytesPerSec = sampleRate * numChannels * (bitsPerSample / 8);
    if (!bytesPerSec) return 0;

    return dataSize / bytesPerSec;
  }

  // Scan a directory for .wav files
  function scanDirectoryForWavs(path) {
    var files = [];
    var path_addr = mem.malloc(path.length + 1);
    var buf = mem.malloc(4096);

    writeCString(path_addr, path);

    var fd = fn.open_sys(path_addr, makeBig(0, 0), makeBig(0, 0));
    if (isFailBigInt(fd)) return files;

    while (true) {
      var count = fn.getdents(fd, buf, makeBig(0, 4096));
      if (isFailBigInt(count) || count.lo === 0) break;

      var offset = 0;
      while (offset < count.lo) {
        var d_reclen = mem.view(buf.add(makeBig(0, offset + 4))).getUint16(0, true);
        var d_type = mem.view(buf.add(makeBig(0, offset + 6))).getUint8(0);
        var d_namlen = mem.view(buf.add(makeBig(0, offset + 7))).getUint8(0);
        var name = '';
        for (var j = 0; j < d_namlen; j++) {
          name += String.fromCharCode(mem.view(buf.add(makeBig(0, offset + 8 + j))).getUint8(0));
        }
        if (d_type === 8 && name !== '.' && name !== '..' && /\.wav$/i.test(name)) {
          files.push(name);
        }
        if (!d_reclen || d_reclen <= 0) break;
        offset += d_reclen;
      }
    }
    fn.close_sys(fd);
    return files;
  }

  // Scan a directory for immediate subdirectories
  function scanDirectoryForSubdirs(path) {
    var dirs = [];
    var path_addr = mem.malloc(path.length + 1);
    var buf = mem.malloc(4096);

    writeCString(path_addr, path);

    var fd = fn.open_sys(path_addr, makeBig(0, 0), makeBig(0, 0));
    if (isFailBigInt(fd)) return dirs;

    while (true) {
      var count = fn.getdents(fd, buf, makeBig(0, 4096));
      if (isFailBigInt(count) || count.lo === 0) break;

      var offset = 0;
      while (offset < count.lo) {
        var d_reclen = mem.view(buf.add(makeBig(0, offset + 4))).getUint16(0, true);
        var d_type = mem.view(buf.add(makeBig(0, offset + 6))).getUint8(0);
        var d_namlen = mem.view(buf.add(makeBig(0, offset + 7))).getUint8(0);
        var name = '';
        for (var j = 0; j < d_namlen; j++) {
          name += String.fromCharCode(mem.view(buf.add(makeBig(0, offset + 8 + j))).getUint8(0));
        }
        if (d_type === 4 && name !== '.' && name !== '..') {
          dirs.push(name);
        }
        if (!d_reclen || d_reclen <= 0) break;
        offset += d_reclen;
      }
    }
    fn.close_sys(fd);
    return dirs;
  }

  function scanBackgrounds() {
    var files = scanDirectoryForWavs(FS_BASE + BG_FOLDER);
    var list = [{ name: DEFAULT_BG_NAME, url: bgAssetUrl(DEFAULT_BG_NAME + '.png') }];

    for (var i = 0; i < files.length; i++) {
      if (/\.(png|jpg|jpeg)$/i.test(files[i])) {
        list.push({
          name: fileNameBase(files[i]),
          url: filePathToUrl(FS_BASE + BG_FOLDER + '/' + files[i])
        });
      }
    }

    list.sort(function (a, b) {
      if ((a.name || '').toLowerCase() === DEFAULT_BG_NAME.toLowerCase()) return -1;
      if ((b.name || '').toLowerCase() === DEFAULT_BG_NAME.toLowerCase()) return 1;
      return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
    });

    return list;
  }

  // Build cover candidates:
  // 1) Global cover folder mirroring music structure: replace '/music/' with '/cover/' in the path
  // 2) Local cover: same folder as the song
  function getCoverCandidates(songPath) {
    var candidates = [];
    var exts = ['.png', '.jpg', '.jpeg'];
    var baseName = fileNameBase(songPath.substring(songPath.lastIndexOf('/') + 1));

    // Global cover path: replace the first occurrence of '/music/' with '/cover/'
    var musicIdx = songPath.indexOf('/' + MUSIC_PARENT + '/');
    if (musicIdx !== -1) {
      var prefix = songPath.substring(0, musicIdx);
      var suffix = songPath.substring(musicIdx + ('/' + MUSIC_PARENT).length);
      var globalCoverBase = prefix + '/' + COVER_PARENT + suffix.substring(0, suffix.lastIndexOf('/') + 1) + baseName;
      for (var i = 0; i < exts.length; i++) {
        candidates.push(filePathToUrl(globalCoverBase + exts[i]));
      }
    }

    // Local cover: same folder as the song
    var localBase = songPath.substring(0, songPath.lastIndexOf('/')) + '/' + baseName;
    for (var i = 0; i < exts.length; i++) {
      candidates.push(filePathToUrl(localBase + exts[i]));
    }

    return candidates;
  }

  // ==================== FOLDER & SONG SCANNING ====================
  function getBasePathsForMode(mode) {
    var paths = [];
    if (mode === 'ps4') {
      paths.push(FS_BASE + MUSIC_PARENT + '/');
    } else {
      // USB mode
      if (!is_jailbroken) {
        logMsg('Not jailbroken, USB mode not available.');
        return [];
      }
      // For USB, we look for /mnt/usbX/music/
      for (var i = 0; i <= 7; i++) {
        paths.push('/mnt/usb' + i + '/' + MUSIC_PARENT + '/');
      }
    }
    return paths;
  }

  // Scan for folders that contain at least one .wav file within the given base paths
  function buildFolderListForMode(mode) {
    logMsg('Building folder list for mode: ' + mode);
    var basePaths = getBasePathsForMode(mode);
    var folderSet = {};
    var foldersList = [];

    for (var i = 0; i < basePaths.length; i++) {
      var base = basePaths[i];
      var subdirs = scanDirectoryForSubdirs(base);
      for (var j = 0; j < subdirs.length; j++) {
        var dirName = subdirs[j];
        if (dirName === 'bg' || dirName === 'cover' || dirName === 'Cover' || dirName === 'COVER') {
          continue;
        }
        var fullPath = base + dirName;
        var wavs = scanDirectoryForWavs(fullPath);
        if (wavs.length > 0) {
          var key = fullPath;
          if (!folderSet[key]) {
            folderSet[key] = true;
            foldersList.push({
              name: dirName,
              path: fullPath
            });
          }
        }
      }
    }

    foldersList.sort(function (a, b) {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    logMsg('Found ' + foldersList.length + ' music folders');
    return foldersList;
  }

  function buildSongListForFolder(folderPath) {
    var files = scanDirectoryForWavs(folderPath);
    var list = [];

    for (var i = 0; i < files.length; i++) {
      var fname = files[i];
      var fullPath = folderPath + '/' + fname;
      var durationSec = getWavDuration(fullPath);
      var parsed = parseSongName(fname);

      list.push({
        name: fname,
        displayName: parsed.displayName,
        path: fullPath,
        duration: formatTime(durationSec),
        durationSeconds: durationSec,
        coverCandidates: getCoverCandidates(fullPath),
        number: parsed.number
      });
    }

    list.sort(function (a, b) {
      var an = (a.displayName || a.name || '').toLowerCase();
      var bn = (b.displayName || b.name || '').toLowerCase();
      return an.localeCompare(bn);
    });

    return list;
  }

  // ==================== UI UPDATE FUNCTIONS ====================
  function loadFoldersForMode(mode) {
    folders = buildFolderListForMode(mode);
    currentFolderIndex = -1;
    songList = [];
    currentSongIndex = -1;
    listType = 'folders';
    selectedListIndex = 0;
    listScrollOffset = 0;

    if (folders.length === 0) {
      if (!_hasShownNoFoldersNotification) {
        _hasShownNoFoldersNotification = true;
        showModeNotification('No folders with music found');
      }
      logMsg('No folders found');
    } else {
      _hasShownNoFoldersNotification = false;
    }

    if (uiMode === 'list') {
      updateListView();
    }
  }

  function loadSongsForFolder(folderIndex) {
    if (folderIndex < 0 || folderIndex >= folders.length) return;
    var folder = folders[folderIndex];
    currentFolderIndex = folderIndex;
    songList = buildSongListForFolder(folder.path);
    listType = 'songs';
    selectedListIndex = 0;
    listScrollOffset = 0;

    if (songList.length === 0) {
      logMsg('Folder contains no playable songs: ' + folder.name);
    }

    if (uiMode === 'list') {
      updateListView();
    }
  }

  function updateListView() {
    if (!listItemSlots.length) return;

    if (listType === 'folders') {
      var numFolders = folders.length;
      for (var i = 0; i < listItemSlots.length; i++) {
        var idx = listScrollOffset + i;
        var slot = listItemSlots[i];
        if (idx < numFolders) {
          var folder = folders[idx];
          slot.coverImg.visible = true;
          setImageUrl(slot.coverImg, assetUrl(FOLDER_ICON));
          slot.coverImg.y = UI.list.startY + i * UI.list.itemHeight;
          slot.titleText.visible = true;
          slot.durationText.visible = false;
          slot.titleText.y = UI.list.startY + i * UI.list.itemHeight + 10;
          slot.titleText.text = folder.name;
          if (idx === selectedListIndex) {
            slot.coverImg.borderColor = 'white';
            slot.coverImg.borderWidth = 3;
            slot.titleText.color = 'yellow';
          } else {
            slot.coverImg.borderColor = 'transparent';
            slot.coverImg.borderWidth = 0;
            slot.titleText.color = 'white';
          }
        } else {
          slot.coverImg.visible = false;
          slot.titleText.visible = false;
          slot.durationText.visible = false;
        }
      }
    } else if (listType === 'songs') {
      var numSongs = songList.length;
      for (var i = 0; i < listItemSlots.length; i++) {
        var idx = listScrollOffset + i;
        var slot = listItemSlots[i];
        if (idx < numSongs) {
          var song = songList[idx];
          slot.coverImg.visible = true;
          slot.titleText.visible = true;
          slot.durationText.visible = true;
          slot.coverImg.y = UI.list.startY + i * UI.list.itemHeight;
          slot.titleText.y = UI.list.startY + i * UI.list.itemHeight + 10;
          slot.durationText.y = UI.list.startY + i * UI.list.itemHeight + 10;
          slot.titleText.text = song.displayName || song.name;
          slot.durationText.text = song.duration;
          loadCoverIntoTarget(idx, slot.coverImg);
          if (idx === selectedListIndex) {
            slot.coverImg.borderColor = 'white';
            slot.coverImg.borderWidth = 3;
          } else {
            slot.coverImg.borderColor = 'transparent';
            slot.coverImg.borderWidth = 0;
          }
        } else {
          slot.coverImg.visible = false;
          slot.titleText.visible = false;
          slot.durationText.visible = false;
        }
      }
    }
  }

  // ==================== PLAYER FUNCTIONS ====================
  function clearPendingProbes() {
    liveProbes = [];
  }

  function loadDefaultCover() {
    if (!coverImageObj) return;
    setImageUrl(coverImageObj, assetUrl(DEFAULT_COVER));
  }

  function loadDefaultBackground() {
    if (!bgImage) return;
    setImageUrl(bgImage, bgAssetUrl(DEFAULT_BG_NAME + '.png'));
  }

  function loadBackgroundByIndex(index) {
    if (!bgImage) return;
    if (!bgList.length) {
      loadDefaultBackground();
      return;
    }
    if (index < 0 || index >= bgList.length) {
      setImageUrl(bgImage, bgList[0].url);
      return;
    }
    setImageUrl(bgImage, bgList[index].url);
  }

  function cycleBackground() {
    if (!bgList.length) {
      bgList = scanBackgrounds();
    }
    if (!bgList.length) {
      currentBgIndex = -1;
      loadDefaultBackground();
      showModeNotification('BG: ' + DEFAULT_BG_NAME);
      return;
    }

    if (currentBgIndex === -1) {
      currentBgIndex = 0;
    } else {
      currentBgIndex++;
      if (currentBgIndex >= bgList.length - 1) {
        currentBgIndex = -1;
      }
    }

    if (currentBgIndex === -1) {
      loadDefaultBackground();
      showModeNotification('BG: ' + DEFAULT_BG_NAME);
    } else {
      loadBackgroundByIndex(currentBgIndex);
      showModeNotification('BG: ' + bgList[currentBgIndex].name);
    }
  }

  function loadCoverIntoTarget(songIndex, targetImg) {
    if (!targetImg) return;
    if (songIndex < 0 || songIndex >= songList.length) {
      setImageUrl(targetImg, assetUrl(DEFAULT_COVER));
      return;
    }

    var requestId = ++coverRequestId;
    targetImg._coverRequestId = requestId;
    targetImg._coverSongIndex = songIndex;

    var song = songList[songIndex];
    var candidates = song.coverCandidates || [];
    var tryIndex = 0;

    function finishWithDefault() {
      if (targetImg._coverRequestId !== requestId) return;
      setImageUrl(targetImg, assetUrl(DEFAULT_COVER));
    }

    function tryNext() {
      if (targetImg._coverRequestId !== requestId) return;
      if (tryIndex >= candidates.length) {
        finishWithDefault();
        return;
      }

      var url = candidates[tryIndex];
      var probe = new Image();
      liveProbes.push(probe);

      probe.onload = function () {
        var idx = liveProbes.indexOf(probe);
        if (idx !== -1) liveProbes.splice(idx, 1);
        if (targetImg._coverRequestId !== requestId) return;
        setImageUrl(targetImg, url);
      };

      probe.onerror = function () {
        var idx = liveProbes.indexOf(probe);
        if (idx !== -1) liveProbes.splice(idx, 1);
        if (targetImg._coverRequestId !== requestId) return;
        tryIndex++;
        tryNext();
      };

      try {
        probe.url = url;
      } catch (e) {
        tryIndex++;
        tryNext();
      }
    }

    tryNext();
  }

  function loadCoverForSong(index) {
    if (!coverImageObj) return;
    loadCoverIntoTarget(index, coverImageObj);
  }

  function updateSongInfoUI(index) {
    if (index < 0 || index >= songList.length) {
      setTextValue(songNameText, '');
      setTextValue(songTimeText, '');
      loadDefaultCover();
      stopTimer();
      return;
    }

    var song = songList[index];
    setTextValue(songNameText, song.displayName || '');
    trackDurationSeconds = song.durationSeconds || 0;
    setTextValue(songTimeText, formatPlaybackText(0, trackDurationSeconds));
    loadCoverForSong(index);
  }

  // Stops playback and closes the current file (keeps audio instance alive)
  function stopAudio() {
    if (audio) {
      try {
        if (typeof audio.stop === 'function') audio.stop();
        if (typeof audio.close === 'function') audio.close();
      } catch (e) { logMsg('Error stopping audio: ' + e.message); }
    }
    syncPlayIcon(false);
    stopTimer();
  }

  // Ensure the audio instance exists
  function ensureAudio() {
    if (!audio && typeof jsmaf !== 'undefined' && jsmaf.AudioClip) {
      try {
        audio = new jsmaf.AudioClip();
        audio.volume = 0.7;
      } catch (e) {
        logMsg('Failed to create AudioClip: ' + e.message);
      }
    }
  }

  function syncPlayIcon(isPlaying) {
    playing = !!isPlaying;
    if (!playPauseImage) return;
    setImageUrl(playPauseImage, assetUrl(playing ? ICON_PAUSE : ICON_PLAY));
  }

  function getPlaybackPositionSeconds() {
    if (!playing) {
      return lastKnownPlaybackMs / 1000;
    }
    var now = Date.now();
    var elapsed = now - playbackAnchorMs + pausedAccumulatedMs;
    if (elapsed < 0) elapsed = 0;
    lastKnownPlaybackMs = elapsed;
    return elapsed / 1000;
  }

  function applyTimerText() {
    if (currentSongIndex < 0 || currentSongIndex >= songList.length) {
      setTextValue(songTimeText, '');
      return;
    }
    var pos = getPlaybackPositionSeconds();
    setTextValue(songTimeText, formatPlaybackText(pos, trackDurationSeconds));
  }

  function startTimer() {
    stopTimer();
    timerInterval = safeSetInterval(function () {
      if (currentSongIndex < 0 || currentSongIndex >= songList.length) return;
      if (!playing) return;
      applyTimerText();

      // Check if song ended
      if (trackDurationSeconds > 0 && getPlaybackPositionSeconds() >= trackDurationSeconds) {
        if (loopEnabled) {
          loadAndPlaySong(currentSongIndex);
        } else if (shuffleEnabled) {
          var newIndex;
          if (songList.length === 1) {
            newIndex = 0;
          } else {
            do {
              newIndex = Math.floor(Math.random() * songList.length);
            } while (newIndex === currentSongIndex);
          }
          selectSong(newIndex, true);
        } else if (autoPlayEnabled) {
          nextSong();
        } else {
          stopAudio();
          syncPlayIcon(false);
          lastKnownPlaybackMs = trackDurationSeconds * 1000;
          applyTimerText();
        }
      }
    }, 250);
  }

  function stopTimer() {
    if (timerInterval) {
      safeClearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resetTimerState() {
    playbackAnchorMs = Date.now();
    pausedAccumulatedMs = 0;
    lastKnownPlaybackMs = 0;
    applyTimerText();
  }

  function prepareTimerForSongStart() {
    playbackAnchorMs = Date.now();
    pausedAccumulatedMs = 0;
    lastKnownPlaybackMs = 0;
    startTimer();
    applyTimerText();
  }

  function pauseTimerOnly() {
    if (!playing) return;
    lastKnownPlaybackMs = getPlaybackPositionSeconds() * 1000;
    pausedAccumulatedMs = lastKnownPlaybackMs;
    stopTimer();
  }

  function loadAndPlaySong(index) {
    if (index < 0 || index >= songList.length) return;

    ensureAudio();
    if (!audio) return;

    var song = songList[index];
    var url = filePathToUrl(song.path);

    stopAudio();

    try {
      audio.open(url);
      audio.play(true);
      syncPlayIcon(true);
      prepareTimerForSongStart();
      loadCoverForSong(index);
    } catch (e) {
      logMsg('Error opening/playing ' + url + ': ' + e.message);
      syncPlayIcon(false);
      stopTimer();
    }
  }

  function selectSong(index, autoplayIfPlaying) {
    if (index < 0 || index >= songList.length) return;
    currentSongIndex = index;
    updateSongInfoUI(index);

    if (playing && autoplayIfPlaying !== false) {
      loadAndPlaySong(index);
    } else {
      stopAudio();
    }
  }

  function nextSong() {
    if (!songList.length) return;
    selectSong((currentSongIndex + 1) % songList.length, true);
  }

  function prevSong() {
    if (!songList.length) return;
    selectSong((currentSongIndex - 1 + songList.length) % songList.length, true);
  }

  // ==================== MODE SWITCH & REFRESH ====================
  function switchMode() {
    cleanupAudio();
    var newMode = (currentMode === 'ps4') ? 'usb' : 'ps4';
    loadFoldersForMode(newMode);
    currentMode = newMode;
    reloadStaticAssets();
    showModeNotification(newMode === 'ps4' ? 'PS4 Mode' : 'USB Mode');
    if (uiMode !== 'list') {
      showListMode();
    } else {
      updateListView();
    }
  }

  function refreshSongs() {
    cleanupAudio();  // stop playback before refreshing
    logMsg('Refreshing folders and songs...');

    coverRequestId++;
    clearPendingProbes();

    bgList = scanBackgrounds();
    if (!bgList.length) {
      currentBgIndex = -1;
    } else if (currentBgIndex >= bgList.length - 1) {
      currentBgIndex = -1;
    }

    loadFoldersForMode(currentMode);
    reloadStaticAssets();
    showModeNotification('Refreshed');
    if (uiMode !== 'list') {
      showListMode();
    } else {
      updateListView();
    }
  }

  function togglePlayPause() {
    if (!songList.length) return;
    if (currentSongIndex === -1) currentSongIndex = 0;

    if (playing) {
      pauseTimerOnly();
      stopAudio();
      return;
    }

    playing = true;
    syncPlayIcon(true);
    loadAndPlaySong(currentSongIndex);
  }

  // ==================== UI MODE MANAGEMENT ====================
  function showListMode() {
    uiMode = 'list';
    coverImageObj.visible = false;
    songNameText.visible = false;
    songTimeText.visible = false;
    prevIcon.visible = false;
    playPauseImage.visible = false;
    nextIcon.visible = false;
    loopImage.visible = false;
    shuffleImage.visible = false;
    autoPlayImage.visible = false;
    loopStatus.visible = false;
    shuffleStatus.visible = false;
    autoPlayStatus.visible = false;

    updateListView();
  }

  function showPlayerMode(songIndex) {
    if (songIndex < 0 || songIndex >= songList.length) return;
    uiMode = 'player';
    currentSongIndex = songIndex;
    selectedListIndex = songIndex;

    for (var i = 0; i < listItemSlots.length; i++) {
      listItemSlots[i].coverImg.visible = false;
      listItemSlots[i].titleText.visible = false;
      listItemSlots[i].durationText.visible = false;
    }

    coverImageObj.visible = true;
    songNameText.visible = true;
    songTimeText.visible = true;
    prevIcon.visible = true;
    playPauseImage.visible = true;
    nextIcon.visible = true;

    if (loopEnabled) {
      loopImage.visible = true;
      loopStatus.visible = false;
    } else {
      loopStatus.visible = true;
    }
    if (shuffleEnabled) {
      shuffleImage.visible = true;
      shuffleStatus.visible = false;
    } else {
      shuffleStatus.visible = true;
    }
    if (autoPlayEnabled) {
      autoPlayImage.visible = true;
      autoPlayStatus.visible = false;
    } else {
      autoPlayStatus.visible = true;
    }

    updateSongInfoUI(songIndex);
    loadAndPlaySong(songIndex);
  }

  // ==================== BLINKING ====================
  function startBlinking(img, intervalRef) {
    if (intervalRef !== null) safeClearInterval(intervalRef);
    var direction = 1;
    var alpha = 0.3;
    var step = 0.1;
    intervalRef = safeSetInterval(function () {
      alpha += direction * step;
      if (alpha >= 1.0) {
        alpha = 1.0;
        direction = -1;
      } else if (alpha <= 0.3) {
        alpha = 0.3;
        direction = 1;
      }
      img.alpha = alpha;
    }, 100);
    return intervalRef;
  }

  function stopBlinking(img, intervalRef) {
    if (intervalRef !== null) safeClearInterval(intervalRef);
    img.alpha = 1.0;
    return null;
  }

  function toggleLoop() {
    loopEnabled = !loopEnabled;
    if (loopEnabled) {
      loopStatus.visible = false;
      loopImage.visible = true;
      loopBlinkInterval = startBlinking(loopImage, loopBlinkInterval);
    } else {
      loopStatus.visible = true;
      loopBlinkInterval = stopBlinking(loopImage, loopBlinkInterval);
      loopImage.visible = false;
    }
  }

  function toggleShuffle() {
    shuffleEnabled = !shuffleEnabled;
    if (shuffleEnabled) {
      shuffleStatus.visible = false;
      shuffleImage.visible = true;
      shuffleBlinkInterval = startBlinking(shuffleImage, shuffleBlinkInterval);
    } else {
      shuffleStatus.visible = true;
      shuffleBlinkInterval = stopBlinking(shuffleImage, shuffleBlinkInterval);
      shuffleImage.visible = false;
    }
  }

  function toggleAutoPlay() {
    autoPlayEnabled = !autoPlayEnabled;
    if (autoPlayEnabled) {
      autoPlayStatus.visible = false;
      autoPlayImage.visible = true;
      autoPlayBlinkInterval = startBlinking(autoPlayImage, autoPlayBlinkInterval);
    } else {
      autoPlayStatus.visible = true;
      autoPlayBlinkInterval = stopBlinking(autoPlayImage, autoPlayBlinkInterval);
      autoPlayImage.visible = false;
    }
  }

  function showModeNotification(text) {
    if (!modeText) return;

    if (modeFadeInterval) {
      safeClearInterval(modeFadeInterval);
      modeFadeInterval = null;
    }

    modeText.text = text;
    modeText.alpha = 1.0;
    modeText.visible = true;

    var fadeSteps = 10;
    var step = 0;

    modeFadeInterval = safeSetInterval(function () {
      step++;
      var newAlpha = 1.0 - (step / fadeSteps);
      if (newAlpha <= 0) {
        modeText.visible = false;
        safeClearInterval(modeFadeInterval);
        modeFadeInterval = null;
      } else {
        modeText.alpha = newAlpha;
      }
    }, 100);
  }

  function reloadStaticAssets() {
    loadBackgroundByIndex(currentBgIndex);
    setImageUrl(prevIcon, assetUrl(ICON_PREV));
    setImageUrl(nextIcon, assetUrl(ICON_NEXT));
    syncPlayIcon(playing);

    if (currentSongIndex >= 0 && currentSongIndex < songList.length) {
      loadCoverForSong(currentSongIndex);
    } else {
      loadDefaultCover();
    }
  }

  // ==================== UI SETUP ====================
  if (typeof jsmaf !== 'undefined' && jsmaf && jsmaf.root && jsmaf.root.children) {
    jsmaf.root.children.length = 0;
  }

  if (typeof Style !== 'undefined') {
    new Style({ name: 'white', color: 'white', size: 24 });
    new Style({ name: 'whiteSmall', color: 'white', size: 20 });
  }

  bgImage = new Image({
    url: bgAssetUrl(DEFAULT_BG_NAME + '.png'),
    x: UI.bg.x,
    y: UI.bg.y,
    width: UI.bg.w,
    height: UI.bg.h
  });
  jsmaf.root.children.push(bgImage);

  coverImageObj = new Image({
    url: assetUrl(DEFAULT_COVER),
    x: UI.cover.x,
    y: UI.cover.y,
    width: UI.cover.w,
    height: UI.cover.h,
    visible: false
  });
  jsmaf.root.children.push(coverImageObj);

  songNameText = new jsmaf.Text();
  songNameText.style = UI.text.nameStyle;
  songNameText.x = UI.cover.x;
  songNameText.y = UI.cover.y + UI.cover.h + UI.text.gapUnderCover;
  songNameText.text = '';
  songNameText.visible = false;
  jsmaf.root.children.push(songNameText);

  songTimeText = new jsmaf.Text();
  songTimeText.style = UI.text.timeStyle;
  songTimeText.x = UI.cover.x;
  songTimeText.y = UI.cover.y + UI.cover.h + UI.text.gapUnderCover + 28;
  songTimeText.text = '';
  songTimeText.visible = false;
  jsmaf.root.children.push(songTimeText);

  var iconX = UI.controls.startX;
  var iconY = UI.controls.startY;
  var iconW = UI.controls.iconW;
  var iconH = UI.controls.iconH;

  prevIcon = new Image({
    url: assetUrl(ICON_PREV),
    x: iconX,
    y: iconY,
    width: iconW,
    height: iconH,
    visible: false
  });
  jsmaf.root.children.push(prevIcon);
  iconImages.push(prevIcon);

  playPauseImage = new Image({
    url: assetUrl(ICON_PLAY),
    x: iconX + UI.controls.spacing,
    y: iconY,
    width: iconW,
    height: iconH,
    visible: false
  });
  jsmaf.root.children.push(playPauseImage);
  iconImages.push(playPauseImage);

  nextIcon = new Image({
    url: assetUrl(ICON_NEXT),
    x: iconX + 2 * UI.controls.spacing,
    y: iconY,
    width: iconW,
    height: iconH,
    visible: false
  });
  jsmaf.root.children.push(nextIcon);
  iconImages.push(nextIcon);

  preloadImage(bgAssetUrl(DEFAULT_BG_NAME + '.png'));
  preloadImage(assetUrl(ICON_PREV));
  preloadImage(assetUrl(ICON_PLAY));
  preloadImage(assetUrl(ICON_PAUSE));
  preloadImage(assetUrl(ICON_NEXT));
  preloadImage(assetUrl(DEFAULT_COVER));
  preloadImage(assetUrl(LOOP_IMAGE));
  preloadImage(assetUrl(SHUFFLE_IMAGE));
  preloadImage(assetUrl(AUTOPLAY_IMAGE));
  preloadImage(assetUrl(FOLDER_ICON));

  function updateIconHighlight() {
    for (var i = 0; i < iconImages.length; i++) {
      if (i === currentIcon) {
        iconImages[i].borderColor = 'white';
        iconImages[i].borderWidth = 4;
      } else {
        iconImages[i].borderColor = 'transparent';
        iconImages[i].borderWidth = 0;
      }
    }
  }

  updateIconHighlight();

  modeText = new jsmaf.Text();
  modeText.style = UI.modeText.style;
  modeText.x = UI.modeText.x;
  modeText.y = UI.modeText.y;
  modeText.text = '';
  modeText.visible = false;
  jsmaf.root.children.push(modeText);

  exitHint = new jsmaf.Text();
  exitHint.text = jsmaf.circleIsAdvanceButton ? 'X to exit' : 'O to exit';
  exitHint.x = UI.hints.exit.x;
  exitHint.y = UI.hints.exit.y;
  exitHint.style = 'white';
  jsmaf.root.children.push(exitHint);

  modeHint = new jsmaf.Text();
  modeHint.text = 'Mode: Triangle';
  modeHint.x = UI.hints.mode.x;
  modeHint.y = UI.hints.mode.y;
  modeHint.style = 'whiteSmall';
  jsmaf.root.children.push(modeHint);

  refreshHint = new jsmaf.Text();
  refreshHint.text = 'Refresh: Square';
  refreshHint.x = UI.hints.refresh.x;
  refreshHint.y = UI.hints.refresh.y;
  refreshHint.style = 'whiteSmall';
  jsmaf.root.children.push(refreshHint);

  loopLabel = new jsmaf.Text();
  loopLabel.text = 'Loop:';
  loopLabel.x = UI.hints.loop.x;
  loopLabel.y = UI.hints.loop.y;
  loopLabel.style = 'whiteSmall';
  jsmaf.root.children.push(loopLabel);

  loopStatus = new jsmaf.Text();
  loopStatus.text = 'Options';
  loopStatus.x = UI.hints.loop.x + UI.loopStatus.xOffset;
  loopStatus.y = UI.loopStatus.y;
  loopStatus.style = 'whiteSmall';
  jsmaf.root.children.push(loopStatus);

  shuffleLabel = new jsmaf.Text();
  shuffleLabel.text = 'Shuffle:';
  shuffleLabel.x = UI.hints.shuffle.x;
  shuffleLabel.y = UI.hints.shuffle.y;
  shuffleLabel.style = 'whiteSmall';
  jsmaf.root.children.push(shuffleLabel);

  shuffleStatus = new jsmaf.Text();
  shuffleStatus.text = 'R1';
  shuffleStatus.x = UI.hints.shuffle.x + UI.shuffleStatus.xOffset;
  shuffleStatus.y = UI.shuffleStatus.y;
  shuffleStatus.style = 'whiteSmall';
  jsmaf.root.children.push(shuffleStatus);

  autoPlayLabel = new jsmaf.Text();
  autoPlayLabel.text = 'AutoPlay:';
  autoPlayLabel.x = UI.hints.autoPlay.x;
  autoPlayLabel.y = UI.hints.autoPlay.y;
  autoPlayLabel.style = 'whiteSmall';
  jsmaf.root.children.push(autoPlayLabel);

  autoPlayStatus = new jsmaf.Text();
  autoPlayStatus.text = 'R2';
  autoPlayStatus.x = UI.hints.autoPlay.x + UI.autoPlayStatus.xOffset;
  autoPlayStatus.y = UI.autoPlayStatus.y;
  autoPlayStatus.style = 'whiteSmall';
  jsmaf.root.children.push(autoPlayStatus);

  loopImage = new Image({
    url: assetUrl(LOOP_IMAGE),
    x: UI.hints.loop.x + UI.loopStatus.xOffset,
    y: UI.loopStatus.y - (UI.loopImage.h - 20) / 2,
    width: UI.loopImage.w,
    height: UI.loopImage.h,
    visible: false
  });
  jsmaf.root.children.push(loopImage);

  shuffleImage = new Image({
    url: assetUrl(SHUFFLE_IMAGE),
    x: UI.hints.shuffle.x + UI.shuffleStatus.xOffset,
    y: UI.shuffleStatus.y - (UI.shuffleImage.h - 20) / 2,
    width: UI.shuffleImage.w,
    height: UI.shuffleImage.h,
    visible: false
  });
  jsmaf.root.children.push(shuffleImage);

  autoPlayImage = new Image({
    url: assetUrl(AUTOPLAY_IMAGE),
    x: UI.hints.autoPlay.x + UI.autoPlayStatus.xOffset,
    y: UI.autoPlayStatus.y - (UI.autoPlayImage.h - 20) / 2,
    width: UI.autoPlayImage.w,
    height: UI.autoPlayImage.h,
    visible: false
  });
  jsmaf.root.children.push(autoPlayImage);

  function createListSlots() {
    for (var i = 0; i < UI.list.visibleCount; i++) {
      var y = UI.list.startY + i * UI.list.itemHeight;

      var cover = new Image({
        url: assetUrl(DEFAULT_COVER),
        x: UI.list.startX,
        y: y,
        width: UI.list.coverSize,
        height: UI.list.coverSize,
        visible: false
      });
      jsmaf.root.children.push(cover);

      var title = new jsmaf.Text();
      title.style = 'whiteSmall';
      title.x = UI.list.titleX;
      title.y = y + 10;
      title.text = '';
      title.visible = false;
      jsmaf.root.children.push(title);

      var duration = new jsmaf.Text();
      duration.style = 'whiteSmall';
      duration.x = 1920 - UI.list.durationRightOffset;
      duration.y = y + 10;
      duration.text = '';
      duration.visible = false;
      jsmaf.root.children.push(duration);

      listItemSlots.push({
        coverImg: cover,
        titleText: title,
        durationText: duration
      });
    }
  }
  createListSlots();

  // Create the single AudioClip instance now
  ensureAudio();

  // ==================== KEY HANDLING ====================
  jsmaf.onKeyDown = function (keyCode) {
    // Debounce key presses
    var now = Date.now();
    if (now - lastKeyPressTime < KEY_DEBOUNCE_MS) return;
    lastKeyPressTime = now;

    logMsg('Key pressed: ' + keyCode);

    if (uiMode === 'list') {
      if (listType === 'folders') {
        if (keyCode === KEY_UP) {
          if (folders.length) {
            if (selectedListIndex > 0) {
              selectedListIndex--;
              // Adjust scroll offset if selected goes above visible area
              if (selectedListIndex < listScrollOffset) {
                listScrollOffset = selectedListIndex;
              }
              updateListView();
            }
          }
          return;
        }
        if (keyCode === KEY_DOWN) {
          if (folders.length) {
            if (selectedListIndex < folders.length - 1) {
              selectedListIndex++;
              // Adjust scroll offset if selected goes below visible area
              if (selectedListIndex >= listScrollOffset + UI.list.visibleCount) {
                listScrollOffset = selectedListIndex - UI.list.visibleCount + 1;
              }
              updateListView();
            }
          }
          return;
        }
        if (keyCode === KEY_ENTER) {
          if (folders.length) {
            loadSongsForFolder(selectedListIndex);
            updateListView();
          }
          return;
        }
        if (keyCode === KEY_BACK) {
          restartApp();
          return;
        }
      } else if (listType === 'songs') {
        if (keyCode === KEY_UP) {
          if (songList.length) {
            if (selectedListIndex > 0) {
              selectedListIndex--;
              if (selectedListIndex < listScrollOffset) {
                listScrollOffset = selectedListIndex;
              }
              updateListView();
            }
          }
          return;
        }
        if (keyCode === KEY_DOWN) {
          if (songList.length) {
            if (selectedListIndex < songList.length - 1) {
              selectedListIndex++;
              if (selectedListIndex >= listScrollOffset + UI.list.visibleCount) {
                listScrollOffset = selectedListIndex - UI.list.visibleCount + 1;
              }
              updateListView();
            }
          }
          return;
        }
        if (keyCode === KEY_ENTER) {
          if (songList.length) {
            showPlayerMode(selectedListIndex);
          }
          return;
        }
        if (keyCode === KEY_BACK) {
          listType = 'folders';
          selectedListIndex = currentFolderIndex;
          if (selectedListIndex < 0) selectedListIndex = 0;
          if (selectedListIndex >= folders.length) selectedListIndex = 0;
          listScrollOffset = 0;
          updateListView();
          return;
        }
      }

      if (keyCode === KEY_MODE) {
        switchMode();
        return;
      }
      if (keyCode === KEY_REFRESH) {
        refreshSongs();
        return;
      }
    } else { // player mode
      if (keyCode === KEY_LEFT) {
        currentIcon = (currentIcon - 1 + 3) % 3;
        updateIconHighlight();
        return;
      }
      if (keyCode === KEY_RIGHT) {
        currentIcon = (currentIcon + 1) % 3;
        updateIconHighlight();
        return;
      }
      if (keyCode === KEY_ENTER) {
        if (currentIcon === 0) {
          prevSong();
        } else if (currentIcon === 1) {
          togglePlayPause();
        } else if (currentIcon === 2) {
          nextSong();
        }
        return;
      }
      if (keyCode === KEY_BACK) {
        stopAudio();
        playing = false;
        syncPlayIcon(false);
        showListMode();
        return;
      }
      if (keyCode === KEY_MODE) {
        switchMode();
        return;
      }
      if (keyCode === KEY_REFRESH) {
        refreshSongs();
        return;
      }
      if (keyCode === KEY_LOOP) {
        toggleLoop();
        return;
      }
      if (keyCode === KEY_SHUFFLE) {
        toggleShuffle();
        return;
      }
      if (keyCode === KEY_AUTOPLAY) {
        toggleAutoPlay();
        return;
      }
    }
  };

  // ==================== INITIAL LOAD ====================
  loadFoldersForMode(currentMode);
  reloadStaticAssets();

  if (folders.length) {
    selectedListIndex = 0;
    showListMode();
  } else {
    if (!_hasShownNoFoldersNotification) {
      _hasShownNoFoldersNotification = true;
      showModeNotification('No folders with music found');
    }
    logMsg('No folders found. Press SQUARE to refresh.');
    showListMode();
  }

  logMsg('Media player LOADED!');
})();
