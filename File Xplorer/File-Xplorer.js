// PsVue File Xplorer.. or File Xplorer
// Made by MexrlDev
//
// Fun Fact, this is a remastered version of my old first project for vue, the legacy File Explorer.

(function () {
  'use strict';

  function stopExternalBgm() {
    try {
      if (typeof stopBgm === 'function') stopBgm();
    } catch (e1) {}
    try {
      if (typeof bgmClip !== 'undefined' && bgmClip) {
        if (typeof bgmClip.stop === 'function') bgmClip.stop();
        if (typeof bgmClip.close === 'function') bgmClip.close();
        bgmClip = null;
      }
    } catch (e2) {}
  }

  // Cleanup.
  function globalCleanup() {
    try {
      stopExternalBgm();

      var bgmCandidates = ['bgmClip', '__explorerBgm', '__mainMenuBgm', '__menuBgm', 'menuBgm', 'mainBgm', '_bgm', 'bgm'];
      for (var i = 0; i < bgmCandidates.length; i++) {
        var name = bgmCandidates[i];
        var obj = null;
        try { if (typeof global !== 'undefined' && global[name]) obj = global[name]; } catch (e) {}
        try { if (!obj && typeof window !== 'undefined' && window[name]) obj = window[name]; } catch (e) {}
        if (obj && typeof obj.stop === 'function') {
          try { obj.stop(); } catch (e1) {}
          try { if (typeof obj.pause === 'function') obj.pause(); } catch (e2) {}
          try { delete global[name]; } catch (e3) {}
          try { delete window[name]; } catch (e4) {}
        }
      }
      if (jsmaf.root && jsmaf.root.children) jsmaf.root.children.length = 0;
      jsmaf.onKeyDown = function () {};
      jsmaf.onKeyUp = function () {};
      jsmaf.onMouseMove = function () {};
      jsmaf.onMouseDown = function () {};
      jsmaf.onEnterFrame = function () {};
      jsmaf.onShutdown = function () {};
    } catch (e) {
      log('Cleanup error: ' + (e.message || e));
    }
  }
  globalCleanup();

  // Syscalls ( Not saying i dont have that in my repo :3 )
  try { fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint'); } catch (e) {}
  try { fn.register(0x06, 'close_sys', ['bigint'], 'bigint'); } catch (e) {}
  try { fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint'); } catch (e) {}
  try { fn.register(0x03, 'read_sys', ['bigint', 'bigint', 'bigint'], 'bigint'); } catch (e) {}
  try { fn.register(0x04, 'write_sys', ['bigint', 'bigint', 'bigint'], 'bigint'); } catch (e) {}
  try { fn.register(0x80, 'rename_sys', ['bigint', 'bigint'], 'bigint'); } catch (e) {}
  try { fn.register(0x0A, 'unlink_sys', ['bigint'], 'bigint'); } catch (e) {}
  try { fn.register(0x88, 'mkdir_sys', ['bigint', 'bigint'], 'bigint'); } catch (e) {}
  try { fn.register(0x89, 'rmdir_sys', ['bigint'], 'bigint'); } catch (e) {}

  // Asset paths
  var baseUrl = 'file:///../download0/payloads/FileXplorer/Data/';
  var bgImageUrl = baseUrl + 'bg.png';
  var openingImgUrl = baseUrl + 'opening.png';
  var folderIconUrl = baseUrl + 'folder.png';
  var folderFavIconUrl = baseUrl + 'folderfav.png';
  var fileIconUrl = baseUrl + 'file.png';
  var imageIconUrl = baseUrl + 'image.png';
  var videoIconUrl = baseUrl + 'video.png';
  var musicIconUrl = baseUrl + 'music.png';
  var selectImgUrl = baseUrl + 'list-select.png';
  var selectedImgUrl = baseUrl + 'list-selected.png';
  var popupBgUrl = baseUrl + 'opt.png';
  var helpImgUrl = baseUrl + 'help.png';
  var bgmUrl = baseUrl + 'Fade-Away-Seether.wav';
  var favConfigPath = baseUrl + 'Fav.json';

  // UI
  var screenWidth = 1920;
  var screenHeight = 1080;
  var visibleCount = 10;
  var rowHeight = 90;
  var listStartY = 100;
  var listWidth = screenWidth;

  var popupWidth = 560;
  var popupHeight = 790;
  var popupX = (screenWidth - popupWidth) / 2;
  var popupY = (screenHeight - popupHeight) / 2;
  var popupOptionHeight = 50;

  var helpWidth = 909;
  var helpHeight = 650;
  var helpX = (screenWidth - helpWidth) / 2;
  var helpY = (screenHeight - helpHeight) / 2;

  // State
  var startPath = '/';
  var currentPath = startPath;
  var pathStack = [startPath];
  var allItems = [];
  var scrollOffset = 0;
  var selectedIndex = 0;
  var lastSelectedIndex = -1;
  var persistentPathText = null;
  var rowBackgrounds = [];
  var rowSelectedBackgrounds = [];
  var rowIcons = [];
  var rowTexts = [];
  var bgm = null;
  var popupActive = false;
  var viewerActive = false;
  var helpActive = false;
  var favMode = false;
  var favReturnState = null;
  var restartPending = false;
  var popupOverlay = null;
  var popupBgImg = null;
  var popupOptionBgs = [];
  var popupOptionTexts = [];
  var popupSelected = 0;
  var popupOptions = ['Rename', 'Delete', 'Create', 'Move', 'Edit', 'Run', 'Cut', 'Copy', 'Paste', 'Fav', 'Unfav', 'Create inside folder', 'Help'];
  var viewerOverlay = null;
  var viewerModalBg = null;
  var viewerTitle = null;
  var viewerContent = null;
  var viewerCloseHint = null;
  var viewerScroll = 0;
  var helpOverlay = null;
  var helpBgImg = null;
  var intervals = [];
  var timeouts = [];
  var selectedMap = {};
  var favoritePaths = [];
  var clipboardItems = [];
  var clipboardMode = null;
  var navHoldKey = null;
  var navHoldInterval = null;
  var favBrowseActive = false;
  var favPathStack = [];
  var backgroundImage = null;
  var openingImage = null;

  try { new Style({ name: 'white', color: 'white', size: 28 }); } catch (e) {}
  try { new Style({ name: 'small', color: 'white', size: 22 }); } catch (e) {}
  try { new Style({ name: 'title', color: 'white', size: 34 }); } catch (e) {}

  function strToAddr(s) {
    s = (s === null || typeof s === 'undefined') ? '' : String(s);
    var addr = mem.malloc(s.length + 1);
    if (!addr) return null;
    for (var i = 0; i < s.length; i++) mem.view(addr).setUint8(i, s.charCodeAt(i) & 0xFF);
    mem.view(addr).setUint8(s.length, 0);
    return addr;
  }

  function safeBigIntToNumber(bi) {
    try {
      if (bi === null || typeof bi === 'undefined') return 0;
      if (typeof bi === 'number') return bi;
      if (typeof bi === 'object' && bi.lo !== undefined) return bi.lo;
      if (typeof bi === 'bigint') return Number(bi);
      return Number(bi);
    } catch (e) { return 0; }
  }

  function isErrorResult(ret) {
    if (ret === null || typeof ret === 'undefined') return true;
    if (typeof ret === 'number') return ret < 0;
    if (typeof ret === 'object' && ret !== null && ret.lo !== undefined && ret.hi !== undefined) {
      if ((ret.lo >>> 0) === 0xffffffff && (ret.hi >>> 0) === 0xffffffff) return true;
    }
    return false;
  }

  function normalizePath(path) {
    path = (path === null || typeof path === 'undefined') ? '/' : String(path);
    path = path.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!path.startsWith('/')) path = '/' + path;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return path;
  }

  function parseUserPath(input) {
    input = (input === null || typeof input === 'undefined') ? '' : String(input).trim();
    if (!input) return '/';
    input = input.replace(/\\/g, '/');
    if (input.indexOf('file://../') === 0) input = input.slice('file://../'.length);
    else if (input.indexOf('file:///') === 0) input = input.slice('file:///'.length);
    else if (input.indexOf('file://') === 0) input = input.slice('file://'.length);
    input = input.replace(/^\/+/, '/').replace(/\/+/g, '/');
    if (!input.startsWith('/')) input = '/' + input;
    if (input.length > 1 && input.endsWith('/')) input = input.slice(0, -1);
    return input;
  }

  function toFsPath(input) {
    return normalizePath(parseUserPath(input));
  }

  function joinPath(dir, name) {
    dir = toFsPath(dir);
    name = (name === null || typeof name === 'undefined') ? '' : String(name).trim();
    name = name.replace(/^[\/\\]+/, '').replace(/[\/\\]+$/, '');
    if (!name) return dir;
    return dir === '/' ? '/' + name : dir + '/' + name;
  }

  function getParentPath(path) {
    path = toFsPath(path);
    if (path === '/') return '/';
    var idx = path.lastIndexOf('/');
    if (idx <= 0) return '/';
    return path.slice(0, idx);
  }

  function getBaseName(path) {
    path = toFsPath(path);
    if (path === '/') return '/';
    var idx = path.lastIndexOf('/');
    return idx >= 0 ? path.slice(idx + 1) : path;
  }

  function sanitizeName(name) {
    name = (name === null || typeof name === 'undefined') ? '' : String(name).trim();
    name = name.replace(/[\/\\]/g, '');
    return name;
  }

  function removeElement(el) {
    if (!el) return;
    var idx = jsmaf.root.children.indexOf(el);
    if (idx !== -1) jsmaf.root.children.splice(idx, 1);
  }

  function getFileIconUrl(item) {
    if (item && item.isDir) return favMode ? folderFavIconUrl : folderIconUrl;
    var ext = (item && item.name ? item.name : '').split('.').pop().toLowerCase();
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'bmp' || ext === 'webp') return imageIconUrl;
    if (ext === 'mp4' || ext === 'mkv' || ext === 'avi' || ext === 'mov' || ext === 'wmv' || ext === 'flv' || ext === 'webm' || ext === 'ts') return videoIconUrl;
    if (ext === 'wav' || ext === 'mp3' || ext === 'ogg' || ext === 'flac' || ext === 'aac' || ext === 'm4a' || ext === 'wma') return musicIconUrl;
    return fileIconUrl;
  }

  function reliableImageLoad(img, url, label) {
    var tries = 0;
    function apply() {
      try { img.url = url; } catch (e) {}
    }
    try {
      img.onerror = function () {
        tries++;
        if (tries <= 6) {
          scheduleTimeout(apply, tries * 180);
        } else {
          log('Failed to load ' + label + ': ' + url);
        }
      };
    } catch (e) {}
    scheduleTimeout(apply, 0);
  }

  function promptLater(title, initial, maxLen, cb) {
    jsmaf.setTimeout(function () {
      try { jsmaf.showOSK(title, initial, maxLen, cb); }
      catch (e) { showError('OSK failed: ' + (e.message || e)); }
    }, 50);
  }

  function selectedCount() {
    var c = 0;
    for (var k in selectedMap) if (Object.prototype.hasOwnProperty.call(selectedMap, k) && selectedMap[k]) c++;
    return c;
  }

  function getSelectedItems() {
    var out = [];
    for (var i = 0; i < allItems.length; i++) if (selectedMap[allItems[i].path]) out.push(allItems[i]);
    return out;
  }

  function clearSelection() { selectedMap = {}; }
  function isSelectedPath(path) { return !!selectedMap[path]; }
  function isMultiSelectMode() { return selectedCount() > 0; }

  function containsFavoriteItems(items) {
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].isDir && isFavoritePath(items[i].path)) return true;
    }
    return false;
  }

  function toggleSelectCurrent() {
    var item = allItems[selectedIndex];
    if (!item) return;
    if (selectedMap[item.path]) delete selectedMap[item.path];
    else selectedMap[item.path] = true;
    if (selectedCount() === 0) clearSelection();
    updateListUI();
  }

  function toggleSelectAll() {
    if (!allItems.length) return;
    var allSelected = true;
    for (var i = 0; i < allItems.length; i++) {
      if (!selectedMap[allItems[i].path]) { allSelected = false; break; }
    }
    if (allSelected) clearSelection();
    else {
      selectedMap = {};
      for (var j = 0; j < allItems.length; j++) selectedMap[allItems[j].path] = true;
    }
    updateListUI();
  }

  function isJsFile(item) {
    if (!item || item.isDir) return false;
    return (/\.js$/i).test(item.name || '');
  }

  function isDownload0Path(path) {
    path = toFsPath(path || currentPath);
    return path === '/download0' || path.indexOf('/download0/') === 0;
  }

  function refreshPathLabel() {
    if (!persistentPathText) return;
    persistentPathText.text = favMode ? 'FAVORITES' : currentPath;
  }

  function scheduleTimeout(fn, delay) {
    var t = jsmaf.setTimeout(fn, delay);
    timeouts.push(t);
    return t;
  }

  function postMutationRefresh(refPath) {
    refreshDirectoryData();
    if (isDownload0Path(refPath || currentPath)) {
      scheduleTimeout(function () { refreshDirectoryData(); }, 140);
      scheduleTimeout(function () { refreshDirectoryData(); }, 650);
      scheduleTimeout(function () { refreshDirectoryData(); }, 1400);
    }
  }

  function stopNavRepeat() {
    if (navHoldInterval !== null) {
      try { jsmaf.clearInterval(navHoldInterval); } catch (e) {}
    }
    navHoldInterval = null;
    navHoldKey = null;
  }

  function beginNavRepeat(keyCode, actionFn) {
    if (navHoldKey === keyCode) return;
    stopNavRepeat();
    navHoldKey = keyCode;
    try { actionFn(); } catch (e) {}
    navHoldInterval = jsmaf.setInterval(function () {
      if (navHoldKey !== keyCode) return;
      try { actionFn(); } catch (e) {}
    }, 120);
    intervals.push(navHoldInterval);
  }

  function clearArray(arr) {
    if (!arr || !arr.length) return;
    arr.length = 0;
  }

  function stopAudioClip(clip) {
    if (!clip) return;
    try { clip.stop(); } catch (e1) {}
    try { clip.pause(); } catch (e2) {}
    try { clip.onended = null; } catch (e3) {}
  }

  function detachElement(el) {
    if (!el) return;
    try { el.visible = false; } catch (e) {}
    try { el.url = ''; } catch (e2) {}
    removeElement(el);
  }

  function hardReleaseAllAssets() {
    try { closePopup(); } catch (e1) {}
    try { closeViewer(); } catch (e2) {}
    try { closeHelpPopup(); } catch (e3) {}

    stopAudioClip(bgm);
    bgm = null;

    detachElement(backgroundImage);
    detachElement(openingImage);
    detachElement(persistentPathText);

    detachElement(popupOverlay);
    detachElement(popupBgImg);
    detachElement(helpOverlay);
    detachElement(helpBgImg);
    detachElement(viewerOverlay);
    detachElement(viewerModalBg);
    detachElement(viewerTitle);
    detachElement(viewerContent);
    detachElement(viewerCloseHint);

    for (var i = 0; i < rowBackgrounds.length; i++) detachElement(rowBackgrounds[i]);
    for (var j = 0; j < rowSelectedBackgrounds.length; j++) detachElement(rowSelectedBackgrounds[j]);
    for (var k = 0; k < rowIcons.length; k++) detachElement(rowIcons[k]);
    for (var l = 0; l < rowTexts.length; l++) detachElement(rowTexts[l]);
    for (var m = 0; m < popupOptionBgs.length; m++) detachElement(popupOptionBgs[m]);
    for (var n = 0; n < popupOptionTexts.length; n++) detachElement(popupOptionTexts[n]);

    clearArray(rowBackgrounds);
    clearArray(rowSelectedBackgrounds);
    clearArray(rowIcons);
    clearArray(rowTexts);
    clearArray(popupOptionBgs);
    clearArray(popupOptionTexts);
  }

  function hardCleanupRuntime() {
    try { stopNavRepeat(); } catch (e1) {}
    try {
      for (var i = 0; i < intervals.length; i++) {
        try { jsmaf.clearInterval(intervals[i]); } catch (e2) {}
      }
      for (var j = 0; j < timeouts.length; j++) {
        try { jsmaf.clearTimeout(timeouts[j]); } catch (e3) {}
      }
    } catch (e4) {}

    clearArray(intervals);
    clearArray(timeouts);

    try { jsmaf.onKeyDown = function () {}; } catch (e5) {}
    try { jsmaf.onKeyUp = function () {}; } catch (e6) {}
    try { jsmaf.onMouseMove = function () {}; } catch (e7) {}
    try { jsmaf.onMouseDown = function () {}; } catch (e8) {}
    try { jsmaf.onEnterFrame = function () {}; } catch (e9) {}
    try { jsmaf.onShutdown = function () {}; } catch (e10) {}

    try { jsmaf.root.children.length = 0; } catch (e11) {}

    backgroundImage = null;
    openingImage = null;
    persistentPathText = null;
    popupOverlay = null;
    popupBgImg = null;
    helpOverlay = null;
    helpBgImg = null;
    viewerOverlay = null;
    viewerModalBg = null;
    viewerTitle = null;
    viewerContent = null;
    viewerCloseHint = null;
  }

  function findPayloadHostFiles(rootDir) {
    var stack = [toFsPath(rootDir)];
    var out = [];
    var seen = {};

    while (stack.length) {
      var dir = stack.pop();
      if (!dir || seen[dir]) continue;
      seen[dir] = true;

      var entries = scanDirectory(dir);
      for (var i = 0; i < entries.length; i++) {
        var it = entries[i];
        if (!it) continue;

        if (it.isDir) {
          stack.push(it.path);
        } else if (getBaseName(it.path).toLowerCase() === 'payload_host.js') {
          out.push(it.path);
        }
      }
    }
    return out;
  }

  function requestExternalPayloadShutdown(path) {
    try {
      if (typeof window !== 'undefined') {
        if (window.__payloadHostRegistry && typeof window.__payloadHostRegistry[path] === 'function') {
          try { window.__payloadHostRegistry[path](); } catch (e1) {}
          return true;
        }
        if (typeof window.__payloadHostShutdown === 'function') {
          try { window.__payloadHostShutdown(path); } catch (e2) {}
          return true;
        }
        if (typeof window.__payloadHostCleanup === 'function') {
          try { window.__payloadHostCleanup(path); } catch (e3) {}
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function prelaunchPayloadSweep() {
    var targets = findPayloadHostFiles('/download0/themes');
    for (var i = 0; i < targets.length; i++) {
      requestExternalPayloadShutdown(targets[i]);
    }
  }

  function shutdownAndExit() {
    if (restartPending) return;
    restartPending = true;

    hardReleaseAllAssets();
    hardCleanupRuntime();

    scheduleTimeout(function () {
      try {
        if (typeof debugging !== 'undefined' && typeof debugging.restart === 'function') {
          debugging.restart();
        } else {
          include('main-menu.js');
        }
      } catch (e) {
        log('Shutdown exit failed: ' + (e.message || e));
      }
    }, 0);
  }

  function normalizeFavList(arr) {
    var out = [];
    var seen = {};
    if (!arr || !arr.length) return out;
    for (var i = 0; i < arr.length; i++) {
      var p = toFsPath(arr[i]);
      if (p !== '/' && !seen[p]) {
        seen[p] = true;
        out.push(p);
      }
    }
    return out;
  }

  function ensureFavConfigExists(callback) {
    var favPath = toFsPath(favConfigPath);
    readFileContent(favPath, function (err, content) {
      if (err) {
        createFile(favPath, function (createErr) {
          if (createErr) {
            if (callback) callback(createErr);
            return;
          }
          writeFileContent(favPath, '[]', function (writeErr) {
            if (callback) callback(writeErr || null);
          });
        });
        return;
      }
      if (typeof content !== 'string' || !content.trim()) {
        writeFileContent(favPath, '[]', function (writeErr2) {
          if (callback) callback(writeErr2 || null);
        });
        return;
      }
      if (callback) callback(null);
    });
  }

  function saveFavorites(callback) {
    favoritePaths = normalizeFavList(favoritePaths);
    var favPath = toFsPath(favConfigPath);
    ensureFavConfigExists(function (ensureErr) {
      if (ensureErr) {
        if (callback) callback(ensureErr);
        return;
      }
      var payload = JSON.stringify(favoritePaths, null, 2);
      writeFileContent(favPath, payload, function (err) {
        if (err) {
          createFile(favPath, function (createErr) {
            if (createErr) {
              if (callback) callback(err || createErr);
              return;
            }
            writeFileContent(favPath, payload, function (retryErr) {
              if (callback) callback(retryErr || null);
            });
          });
          return;
        }
        if (callback) callback(null);
      });
    });
  }

  function loadFavorites() {
    var favPath = toFsPath(favConfigPath);
    readFileContent(favPath, function (err, content) {
      if (err) {
        favoritePaths = [];
        ensureFavConfigExists(function () {});
        return;
      }
      try {
        var parsed = JSON.parse(content || '[]');
        if (Array.isArray(parsed)) favoritePaths = normalizeFavList(parsed);
        else favoritePaths = [];
      } catch (e) {
        favoritePaths = [];
      }
      ensureFavConfigExists(function () {});
    });
  }

  function isFavoritePath(path) {
    path = toFsPath(path);
    for (var i = 0; i < favoritePaths.length; i++) if (favoritePaths[i] === path) return true;
    return false;
  }

  function addFavorites(items) {
    var changed = false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || !it.isDir) continue;
      var p = toFsPath(it.path);
      if (p === '/' || isFavoritePath(p)) continue;
      favoritePaths.push(p);
      changed = true;
    }
    if (!changed) {
      showError('Nothing to add to favorites.');
      return;
    }
    favoritePaths = normalizeFavList(favoritePaths);
    saveFavorites(function (err) {
      if (err) showError('Fav save failed: ' + (err.message || err));
      if (favMode) refreshDirectoryData();
    });
  }

  function removeFavorites(items) {
    var removeMap = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || !it.isDir) continue;
      removeMap[toFsPath(it.path)] = true;
    }
    var next = [];
    for (var j = 0; j < favoritePaths.length; j++) {
      if (!removeMap[favoritePaths[j]]) next.push(favoritePaths[j]);
    }
    if (next.length === favoritePaths.length) {
      showError('Nothing to remove from favorites.');
      return;
    }
    favoritePaths = next;
    saveFavorites(function (err) {
      if (err) showError('Fav save failed: ' + (err.message || err));
      if (favMode) refreshDirectoryData();
    });
  }

  function enterFavMode() {
    if (favMode) return;
    favReturnState = {
      currentPath: currentPath,
      pathStack: pathStack.slice(0),
      selectedIndex: selectedIndex,
      scrollOffset: scrollOffset,
      selectedMap: (function () {
        var m = {};
        for (var k in selectedMap) if (Object.prototype.hasOwnProperty.call(selectedMap, k) && selectedMap[k]) m[k] = true;
        return m;
      })()
    };
    favMode = true;
    favBrowseActive = false;
    favPathStack = [];
    clearSelection();
    selectedIndex = 0;
    scrollOffset = 0;
    refreshDirectoryData();
    refreshPathLabel();
  }

  function exitFavMode() {
    if (!favMode) return;
    favMode = false;
    favBrowseActive = false;
    favPathStack = [];
    if (favReturnState) {
      currentPath = normalizePath(favReturnState.currentPath || '/');
      pathStack = (favReturnState.pathStack && favReturnState.pathStack.length) ? favReturnState.pathStack.slice(0) : [currentPath];
      selectedIndex = favReturnState.selectedIndex || 0;
      scrollOffset = favReturnState.scrollOffset || 0;
      selectedMap = favReturnState.selectedMap || {};
    }
    favReturnState = null;
    refreshDirectoryData();
    refreshPathLabel();
  }

  function scanDirectory(path) {
    var results = [];
    path = toFsPath(path);
    if (!path) return results;
    try {
      var paddr = strToAddr(path);
      if (!paddr) return results;
      var fd = fn.open_sys(paddr, new BigInt(0, 0), new BigInt(0, 0));
      if (isErrorResult(fd)) return results;
      var buf = mem.malloc(8192);
      if (!buf) { try { fn.close_sys(fd); } catch (e) {} return results; }
      var res = fn.getdents(fd, buf, new BigInt(0, 8192));
      var rlen = safeBigIntToNumber(res);
      if (rlen > 0) {
        var offset = 0;
        while (offset < rlen) {
          try {
            var reclen = mem.view(buf.add(new BigInt(0, offset + 4))).getUint16(0, true);
            var d_type = mem.view(buf.add(new BigInt(0, offset + 6))).getUint8(0);
            var d_namlen = mem.view(buf.add(new BigInt(0, offset + 7))).getUint8(0);
            var name = '';
            for (var n = 0; n < d_namlen; n++) name += String.fromCharCode(mem.view(buf.add(new BigInt(0, offset + 8 + n))).getUint8(0));
            if (name && name !== '.' && name !== '..') results.push({ name: name, path: joinPath(path, name), isDir: (d_type !== 8) });
            offset += reclen || 1;
          } catch (e1) { break; }
        }
      }
      try { fn.close_sys(fd); } catch (e2) {}
    } catch (e) {
      log('scanDirectory error: ' + (e.message || e));
    }
    results.sort(function (a, b) {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      var an = (a.name || '').toLowerCase(), bn = (b.name || '').toLowerCase();
      return an < bn ? -1 : (an > bn ? 1 : 0);
    });
    return results;
  }

  function readFileContent(path, callback) {
    try {
      path = toFsPath(path);
      var paddr = strToAddr(path);
      if (!paddr) return callback(new Error('Invalid path'));
      var fd = fn.open_sys(paddr, new BigInt(0, 0), new BigInt(0, 0));
      if (isErrorResult(fd)) return callback(new Error('Cannot open file'));
      var maxRead = 256 * 1024;
      var buf = mem.malloc(maxRead);
      if (!buf) { try { fn.close_sys(fd); } catch (e) {} return callback(new Error('Out of memory')); }
      var read_len = fn.read_sys(fd, buf, new BigInt(0, maxRead));
      try { fn.close_sys(fd); } catch (e) {}
      var len = safeBigIntToNumber(read_len);
      if (len < 0) len = 0;
      var content = '';
      for (var i = 0; i < len; i++) content += String.fromCharCode(mem.view(buf).getUint8(i));
      callback(null, content);
    } catch (e) {
      callback(e);
    }
  }

  function writeFileContent(path, content, callback) {
    try {
      path = toFsPath(path);
      var paddr = strToAddr(path);
      if (!paddr) return callback(new Error('Invalid path'));
      var fd = fn.open_sys(paddr, new BigInt(0, 0x601), new BigInt(0, 0x1FF));
      if (isErrorResult(fd)) return callback(new Error('Cannot open file for writing'));
      var contentAddr = strToAddr(content);
      if (!contentAddr) { try { fn.close_sys(fd); } catch (e) {} return callback(new Error('Memory allocation failed')); }
      var written = fn.write_sys(fd, contentAddr, new BigInt(0, content.length));
      try { fn.close_sys(fd); } catch (e) {}
      if (safeBigIntToNumber(written) < 0) return callback(new Error('Write failed'));
      callback(null, written);
    } catch (e) { callback(e); }
  }

  function renameFileOrFolder(oldPath, newPath, callback) {
    try {
      oldPath = toFsPath(oldPath);
      newPath = toFsPath(newPath);
      var oldAddr = strToAddr(oldPath);
      var newAddr = strToAddr(newPath);
      if (!oldAddr || !newAddr) return callback(new Error('Invalid path'));
      var ret = fn.rename_sys(oldAddr, newAddr);
      if (safeBigIntToNumber(ret) < 0) return callback(new Error('Rename failed'));
      callback(null, ret);
    } catch (e) { callback(e); }
  }

  function deleteItem(item, callback) {
    try {
      var addr = strToAddr(toFsPath(item.path));
      if (!addr) return callback(new Error('Invalid path'));
      var ret = item.isDir ? fn.rmdir_sys(addr) : fn.unlink_sys(addr);
      if (safeBigIntToNumber(ret) < 0) return callback(new Error('Delete failed'));
      callback(null, ret);
    } catch (e) { callback(e); }
  }

  function createFolder(path, callback) {
    try {
      path = toFsPath(path);
      var addr = strToAddr(path);
      if (!addr) return callback(new Error('Invalid path'));
      var ret = fn.mkdir_sys(addr, new BigInt(0, 0x1FF));
      if (safeBigIntToNumber(ret) < 0) return callback(new Error('Create folder failed'));
      callback(null, ret);
    } catch (e) { callback(e); }
  }

  function createFile(path, callback) {
    try {
      path = toFsPath(path);
      var addr = strToAddr(path);
      if (!addr) return callback(new Error('Invalid path'));
      var fd = fn.open_sys(addr, new BigInt(0, 0x601), new BigInt(0, 0x1FF));
      if (isErrorResult(fd)) return callback(new Error('Cannot create file'));
      try { fn.close_sys(fd); } catch (e) {}
      callback(null, 0);
    } catch (e) { callback(e); }
  }

  function getPathEntry(path) {
    path = toFsPath(path);
    if (path === '/') return { name: '/', path: '/', isDir: true };
    var parent = getParentPath(path);
    var name = getBaseName(path);
    var entries = scanDirectory(parent);
    for (var i = 0; i < entries.length; i++) if (entries[i].name === name) return entries[i];
    return null;
  }

  function deletePathRecursive(path, callback) {
    path = toFsPath(path);
    var entry = getPathEntry(path);
    if (!entry) return callback(null);
    if (!entry.isDir) return deleteItem(entry, callback);
    var children = scanDirectory(path);
    var idx = 0;
    var firstErr = null;
    function next() {
      if (idx >= children.length) {
        return deleteItem(entry, function (err) {
          if (err && !firstErr) firstErr = err;
          callback(firstErr);
        });
      }
      var child = children[idx++];
      deletePathRecursive(child.path, function (err2) {
        if (err2 && !firstErr) firstErr = err2;
        next();
      });
    }
    next();
  }

  function copyTreeItem(srcItem, destPath, overwrite, callback) {
    if (!srcItem) return callback(new Error('Invalid source'));
    destPath = toFsPath(destPath);
    function copyNow() {
      if (srcItem.isDir) {
        createFolder(destPath, function (err) {
          if (err) return callback(err);
          var children = scanDirectory(srcItem.path);
          var i = 0;
          var firstErr = null;
          function step() {
            if (i >= children.length) return callback(firstErr);
            var child = children[i++];
            copyTreeItem(child, joinPath(destPath, child.name), false, function (err2) {
              if (err2 && !firstErr) firstErr = err2;
              step();
            });
          }
          step();
        });
      } else {
        readFileContent(srcItem.path, function (errRead, content) {
          if (errRead) return callback(errRead);
          writeFileContent(destPath, content, callback);
        });
      }
    }

    if (overwrite) {
      deletePathRecursive(destPath, function (errDel) {
        if (errDel) return callback(errDel);
        copyNow();
      });
    } else {
      copyNow();
    }
  }

  function copyItemsToDir(items, destDir, finalCallback) {
    destDir = toFsPath(destDir);
    items = items || [];
    var destEntries = scanDirectory(destDir);
    var destMap = {};
    for (var i = 0; i < destEntries.length; i++) destMap[destEntries[i].name] = destEntries[i];

    var nonConflict = [];
    var conflict = [];
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      if (!it) continue;
      if (destMap[it.name]) conflict.push(it);
      else nonConflict.push(it);
    }

    function copySequential(list, overwrite, done) {
      var idx = 0;
      var firstErr = null;
      function step() {
        if (idx >= list.length) return done(firstErr);
        var item = list[idx++];
        var target = joinPath(destDir, item.name);
        copyTreeItem(item, target, overwrite, function (err) {
          if (err && !firstErr) firstErr = err;
          step();
        });
      }
      step();
    }

    copySequential(nonConflict, false, function (nonErr) {
      if (!conflict.length) {
        if (finalCallback) finalCallback(nonErr || null, null, []);
        return;
      }

      var conflictNames = [];
      for (var i2 = 0; i2 < conflict.length; i2++) conflictNames.push(conflict[i2].name);

      promptLater('Replace existing files?\n' + conflictNames.join('\n') + '\ntype yes or no', 'no', 8, function (answer) {
        answer = (answer === null || typeof answer === 'undefined') ? '' : String(answer).trim().toLowerCase();
        if (answer === 'yes') {
          copySequential(conflict, true, function (overErr) {
            if (finalCallback) finalCallback(overErr || nonErr || null, null, conflictNames);
          });
        } else {
          if (finalCallback) finalCallback(nonErr || null, null, conflictNames);
        }
      });
    });
  }

  function moveTreeItem(srcItem, destPath, overwrite, callback) {
    if (!srcItem) return callback(new Error('Invalid source'));
    destPath = toFsPath(destPath);

    function moveNow() {
      renameFileOrFolder(srcItem.path, destPath, callback);
    }

    if (overwrite) {
      deletePathRecursive(destPath, function (errDel) {
        if (errDel) return callback(errDel);
        moveNow();
      });
    } else {
      moveNow();
    }
  }

  function moveItemsToDir(items, destDir, finalCallback) {
    destDir = toFsPath(destDir);
    items = items || [];
    var destEntries = scanDirectory(destDir);
    var destMap = {};
    for (var i = 0; i < destEntries.length; i++) destMap[destEntries[i].name] = destEntries[i];

    var nonConflict = [];
    var conflict = [];
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      if (!it) continue;
      if (destMap[it.name]) conflict.push(it);
      else nonConflict.push(it);
    }

    function moveSequential(list, overwrite, done) {
      var idx = 0;
      var firstErr = null;
      function step() {
        if (idx >= list.length) return done(firstErr);
        var item = list[idx++];
        var target = joinPath(destDir, item.name);
        if (normalizePath(target) === normalizePath(item.path)) {
          step();
          return;
        }
        moveTreeItem(item, target, overwrite, function (err) {
          if (err && !firstErr) firstErr = err;
          step();
        });
      }
      step();
    }

    moveSequential(nonConflict, false, function (nonErr) {
      if (!conflict.length) {
        if (finalCallback) finalCallback(nonErr || null, null, []);
        return;
      }

      var conflictNames = [];
      for (var i2 = 0; i2 < conflict.length; i2++) conflictNames.push(conflict[i2].name);

      promptLater('Replace existing files?\n' + conflictNames.join('\n') + '\ntype yes or no', 'no', 8, function (answer) {
        answer = (answer === null || typeof answer === 'undefined') ? '' : String(answer).trim().toLowerCase();
        if (answer === 'yes') {
          moveSequential(conflict, true, function (overErr) {
            if (finalCallback) finalCallback(overErr || nonErr || null, null, conflictNames);
          });
        } else {
          if (finalCallback) finalCallback(nonErr || null, null, conflictNames);
        }
      });
    });
  }

  function performMoveItems(items, destDir, done) {
    moveItemsToDir(items, destDir, done);
  }

  function performDeleteItems(items, done) {
    var i = 0;
    var firstErr = null;
    function step() {
      if (i >= items.length) return done(firstErr);
      deleteItem(items[i++], function (err) {
        if (err && !firstErr) firstErr = err;
        step();
      });
    }
    step();
  }

  function createFileWithPromptAtPath(targetDir) {
    targetDir = toFsPath(targetDir || currentPath);
    promptLater('New file name', '', 255, function (baseName) {
      baseName = sanitizeName(baseName);
      if (!baseName) return;
      promptLater('Extension', '', 32, function (ext) {
        ext = sanitizeName(ext);
        if (!ext) { showError('Extension is required.'); return; }
        if (ext.charAt(0) !== '.') ext = '.' + ext;
        var fileName = baseName + ext;
        promptLater('Type empty to create blank file, or no to add content after', 'empty', 16, function (choice) {
          choice = (choice === null || typeof choice === 'undefined') ? '' : String(choice).trim().toLowerCase();
          var filePath = joinPath(targetDir, fileName);
          if (choice === 'empty') {
            createFile(filePath, function (err) {
              if (err) showError('Create file failed: ' + (err.message || err));
              else postMutationRefresh(filePath);
            });
            return;
          }
          if (choice === 'no') {
            createFile(filePath, function (err2) {
              if (err2) { showError('Create file failed: ' + (err2.message || err2)); return; }
              promptLater('File content for ' + fileName, '', 32768, function (content) {
                if (content === null || typeof content === 'undefined') content = '';
                writeFileContent(filePath, content, function (writeErr) {
                  if (writeErr) showError('Write failed: ' + (writeErr.message || writeErr));
                  else postMutationRefresh(filePath);
                });
              });
            });
            return;
          }
          showError('Type empty or no.');
        });
      });
    });
  }

  function createFileWithPrompt() {
    createFileWithPromptAtPath(currentPath);
  }

  function createFolderAndMoveSelected(folderName, itemsToMove) {
    folderName = sanitizeName(folderName);
    if (!folderName) return;
    var folderPath = joinPath(currentPath, folderName);
    createFolder(folderPath, function (err) {
      if (err) { showError('Create folder failed: ' + (err.message || err)); return; }
      performMoveItems(itemsToMove, folderPath, function (moveErr) {
        clearSelection();
        postMutationRefresh(folderPath);
        if (moveErr) showError('Folder created, but some moves failed: ' + (moveErr.message || moveErr));
      });
    });
  }

  function setClipboard(items, mode) {
    clipboardItems = [];
    clipboardMode = mode;
    for (var i = 0; i < items.length; i++) {
      clipboardItems.push({ name: items[i].name, path: items[i].path, isDir: items[i].isDir });
    }
  }

  function copySelection() {
    var items = isMultiSelectMode() ? getSelectedItems() : [allItems[selectedIndex]];
    items = items.filter(function (x) { return !!x; });
    if (!items.length) { showError('Nothing to copy.'); return; }
    setClipboard(items, 'copy');
    showError('Copied ' + clipboardItems.length + ' item(s).');
  }

  function cutSelection() {
    var items = isMultiSelectMode() ? getSelectedItems() : [allItems[selectedIndex]];
    items = items.filter(function (x) { return !!x; });
    if (!items.length) { showError('Nothing to cut.'); return; }
    if (containsFavoriteItems(items)) {
      showError('This favorite folder you could break the save of it if you do this!');
      return;
    }
    setClipboard(items, 'cut');
    showError('Cut ' + clipboardItems.length + ' item(s).');
  }

  function pasteClipboard() {
    if (!clipboardItems || !clipboardItems.length) { showError('Nothing copied or cut.'); return; }
    var destDir = currentPath;

    if (clipboardMode === 'cut') {
      if (isFavoritePath(destDir)) {
        showError('This favorite folder you could break the save of it if you do this!');
        return;
      }

      moveItemsToDir(clipboardItems.slice(0), destDir, function (errOrOverwriteErr) {
        if (errOrOverwriteErr) showError('Paste completed with errors: ' + (errOrOverwriteErr.message || errOrOverwriteErr));
        clearSelection();
        clipboardItems = [];
        clipboardMode = null;
        postMutationRefresh(destDir);
      });
      return;
    }

    copyItemsToDir(clipboardItems.slice(0), destDir, function (errOrOverwriteErr) {
      if (errOrOverwriteErr) showError('Paste completed with errors: ' + (errOrOverwriteErr.message || errOrOverwriteErr));
      clearSelection();
      postMutationRefresh(destDir);
    });
  }

  function runJsFile(item) {
    if (!item) return;
    if (item.isDir || !isJsFile(item)) {
      showError('This Is Not JS file');
      return;
    }
    readFileContent(item.path, function (err, content) {
      if (err) { showError('Run failed: ' + (err.message || err)); return; }
      try {
        var runner = new Function(content);
        runner();
      } catch (e) {
        showError('Run failed: ' + (e.message || e));
      }
    });
  }

  function runFavoriteToggleAction(item, multiItems) {
    if (isMultiSelectMode()) {
      var folders = multiItems.filter(function (x) { return x && x.isDir; });
      if (!folders.length) { showError('No folders selected.'); return; }
      var allFav = true;
      for (var i = 0; i < folders.length; i++) if (!isFavoritePath(folders[i].path)) { allFav = false; break; }
      if (allFav) removeFavorites(folders);
      else addFavorites(folders);
      return;
    }
    if (!item || !item.isDir) { showError('Only folders can be favorited.'); return; }
    if (isFavoritePath(item.path)) removeFavorites([item]);
    else addFavorites([item]);
  }

  function showError(msg) { jsmaf.alert(msg); }

  function resetRowVisibility() {
    for (var i = 0; i < rowBackgrounds.length; i++) if (rowBackgrounds[i]) rowBackgrounds[i].visible = false;
    for (var j = 0; j < rowSelectedBackgrounds.length; j++) if (rowSelectedBackgrounds[j]) rowSelectedBackgrounds[j].visible = false;
    lastSelectedIndex = -1;
  }

  function makeFavoriteItems() {
    var out = [];
    for (var i = 0; i < favoritePaths.length; i++) {
      var p = toFsPath(favoritePaths[i]);
      out.push({ name: getBaseName(p), path: p, isDir: true, favorite: true });
    }
    out.sort(function (a, b) {
      var an = (a.name || '').toLowerCase();
      var bn = (b.name || '').toLowerCase();
      return an < bn ? -1 : (an > bn ? 1 : 0);
    });
    return out;
  }

  function updateListUI() {
    if (scrollOffset < 0) scrollOffset = 0;
    if (selectedIndex < 0) selectedIndex = 0;
    if (selectedIndex >= allItems.length) selectedIndex = Math.max(0, allItems.length - 1);
    if (scrollOffset > allItems.length - visibleCount && allItems.length > visibleCount) scrollOffset = allItems.length - visibleCount;
    if (scrollOffset < 0) scrollOffset = 0;
    resetRowVisibility();
    for (var i = 0; i < visibleCount; i++) {
      var itemIdx = scrollOffset + i;
      var yPos = listStartY + i * rowHeight;
      if (itemIdx < allItems.length) {
        var item = allItems[itemIdx];
        var selected = isSelectedPath(item.path);
        if (!rowSelectedBackgrounds[i]) {
          rowSelectedBackgrounds[i] = new Image({ url: selectedImgUrl, x: 0, y: yPos, width: listWidth, height: rowHeight });
          rowSelectedBackgrounds[i].alpha = 0.9;
          jsmaf.root.children.push(rowSelectedBackgrounds[i]);
        } else {
          rowSelectedBackgrounds[i].y = yPos;
          rowSelectedBackgrounds[i].url = selectedImgUrl;
        }
        rowSelectedBackgrounds[i].visible = selected;

        if (!rowBackgrounds[i]) {
          rowBackgrounds[i] = new Image({ url: selectImgUrl, x: 0, y: yPos, width: listWidth, height: rowHeight });
          rowBackgrounds[i].alpha = 0.9;
          jsmaf.root.children.push(rowBackgrounds[i]);
        } else {
          rowBackgrounds[i].y = yPos;
        }
        rowBackgrounds[i].visible = (itemIdx === selectedIndex);

        var iconUrl = getFileIconUrl(item);
        if (!rowIcons[i]) {
          rowIcons[i] = new Image({ url: iconUrl, x: 20, y: yPos + (rowHeight - 56) / 2, width: 56, height: 56 });
          rowIcons[i].alpha = 1;
          jsmaf.root.children.push(rowIcons[i]);
        } else {
          rowIcons[i].url = iconUrl;
          rowIcons[i].y = yPos + (rowHeight - 56) / 2;
        }
        rowIcons[i].visible = true;

        if (!rowTexts[i]) {
          rowTexts[i] = new jsmaf.Text();
          rowTexts[i].style = 'white';
          rowTexts[i].x = 100;
          rowTexts[i].y = yPos + (rowHeight - 28) / 2;
          jsmaf.root.children.push(rowTexts[i]);
        } else {
          rowTexts[i].y = yPos + (rowHeight - 28) / 2;
        }
        rowTexts[i].text = item.name || '';
        rowTexts[i].visible = true;
      } else {
        if (rowBackgrounds[i]) rowBackgrounds[i].visible = false;
        if (rowSelectedBackgrounds[i]) rowSelectedBackgrounds[i].visible = false;
        if (rowIcons[i]) rowIcons[i].visible = false;
        if (rowTexts[i]) rowTexts[i].visible = false;
      }
    }
    lastSelectedIndex = selectedIndex;
    refreshPathLabel();
  }

  function refreshDirectoryData() {
    if (favMode) allItems = favBrowseActive ? scanDirectory(currentPath) : makeFavoriteItems();
    else allItems = scanDirectory(currentPath);

    var newMap = {};
    for (var i = 0; i < allItems.length; i++) {
      if (selectedMap[allItems[i].path]) newMap[allItems[i].path] = true;
    }
    selectedMap = newMap;

    selectedIndex = Math.min(selectedIndex, allItems.length - 1);
    if (selectedIndex < 0) selectedIndex = 0;
    scrollOffset = Math.max(0, Math.min(scrollOffset, allItems.length - visibleCount));
    if (scrollOffset < 0) scrollOffset = 0;

    scheduleTimeout(function () { updateListUI(); }, 16);
  }

  function goToRoot() {
    if (helpActive) { closeHelpPopup(); }
    if (popupActive) closePopup();
    if (viewerActive) closeViewer();

    if (favMode) exitFavMode();
    currentPath = '/';
    pathStack = ['/'];
    favBrowseActive = false;
    favPathStack = [];
    clearSelection();
    selectedIndex = 0;
    scrollOffset = 0;
    refreshDirectoryData();
    refreshPathLabel();
  }

  function restartScriptAfterUnload() {
    shutdownAndExit();
  }

  function navigateUp() {
    if (helpActive) { closeHelpPopup(); return; }
    if (popupActive) { closePopup(); return; }
    if (viewerActive) { closeViewer(); return; }

    if (favMode) {
      if (favBrowseActive) {
        if (favPathStack.length > 1) {
          favPathStack.pop();
          currentPath = normalizePath(favPathStack[favPathStack.length - 1]);
          scrollOffset = 0;
          selectedIndex = 0;
          clearSelection();
          refreshDirectoryData();
          refreshPathLabel();
        } else {
          favBrowseActive = false;
          favPathStack = [];
          currentPath = normalizePath(favReturnState && favReturnState.currentPath ? favReturnState.currentPath : currentPath);
          scrollOffset = 0;
          selectedIndex = 0;
          clearSelection();
          refreshDirectoryData();
          refreshPathLabel();
        }
      } else {
        exitFavMode();
      }
      return;
    }

    if (pathStack.length > 1) {
      pathStack.pop();
      currentPath = normalizePath(pathStack[pathStack.length - 1]);
      scrollOffset = 0;
      selectedIndex = 0;
      clearSelection();
      refreshDirectoryData();
    } else {
      shutdownAndExit();
    }
    refreshPathLabel();
  }

  function navigateDown() {
    if (helpActive) return;
    if (viewerActive) {
      if (viewerContent) { viewerScroll += 28; viewerContent.y = 180 + viewerScroll; }
      return;
    }
    if (popupActive) { popupNavigate(1); return; }
    if (!allItems.length) return;
    if (selectedIndex >= allItems.length - 1) {
      selectedIndex = 0;
      scrollOffset = 0;
      updateListUI();
      return;
    }
    selectedIndex++;
    if (selectedIndex >= scrollOffset + visibleCount) {
      scrollOffset = selectedIndex - visibleCount + 1;
      updateListUI();
    } else if (lastSelectedIndex !== selectedIndex) {
      if (lastSelectedIndex >= 0 && lastSelectedIndex - scrollOffset >= 0 && lastSelectedIndex - scrollOffset < visibleCount) {
        var oldBg = rowBackgrounds[lastSelectedIndex - scrollOffset];
        if (oldBg) oldBg.visible = false;
      }
      if (selectedIndex - scrollOffset >= 0 && selectedIndex - scrollOffset < visibleCount) {
        var newBg = rowBackgrounds[selectedIndex - scrollOffset];
        if (newBg) newBg.visible = true;
      }
      lastSelectedIndex = selectedIndex;
    }
  }

  function navigateUpInList() {
    if (helpActive) return;
    if (viewerActive) {
      if (viewerContent) { viewerScroll -= 28; viewerContent.y = 180 + viewerScroll; }
      return;
    }
    if (popupActive) { popupNavigate(-1); return; }
    if (!allItems.length) return;
    if (selectedIndex <= 0) {
      selectedIndex = allItems.length - 1;
      scrollOffset = Math.max(0, allItems.length - visibleCount);
      updateListUI();
      return;
    }
    selectedIndex--;
    if (selectedIndex < scrollOffset) {
      scrollOffset = selectedIndex;
      updateListUI();
    } else if (lastSelectedIndex !== selectedIndex) {
      if (lastSelectedIndex >= 0 && lastSelectedIndex - scrollOffset >= 0 && lastSelectedIndex - scrollOffset < visibleCount) {
        var oldBg2 = rowBackgrounds[lastSelectedIndex - scrollOffset];
        if (oldBg2) oldBg2.visible = false;
      }
      if (selectedIndex - scrollOffset >= 0 && selectedIndex - scrollOffset < visibleCount) {
        var newBg2 = rowBackgrounds[selectedIndex - scrollOffset];
        if (newBg2) newBg2.visible = true;
      }
      lastSelectedIndex = selectedIndex;
    }
  }

  function confirmSelection() {
    if (helpActive) return;
    if (viewerActive) return;
    if (popupActive) { popupConfirm(); return; }
    var item = allItems[selectedIndex];
    if (!item) return;

    if (favMode) {
      if (!favBrowseActive) {
        if (!item.isDir) return;
        favBrowseActive = true;
        favPathStack = [item.path];
        currentPath = normalizePath(item.path);
        scrollOffset = 0;
        selectedIndex = 0;
        clearSelection();
        refreshDirectoryData();
        refreshPathLabel();
        return;
      }

      if (item.isDir) {
        favPathStack.push(item.path);
        currentPath = normalizePath(item.path);
        scrollOffset = 0;
        selectedIndex = 0;
        clearSelection();
        refreshDirectoryData();
        refreshPathLabel();
      } else {
        openTextViewer(item);
      }
      return;
    }

    if (item.isDir) {
      pathStack.push(item.path);
      currentPath = normalizePath(item.path);
      scrollOffset = 0;
      selectedIndex = 0;
      clearSelection();
      refreshDirectoryData();
      refreshPathLabel();
    } else {
      openTextViewer(item);
    }
  }

  function showPopup() {
    if (viewerActive || popupActive || helpActive) return;
    popupActive = true;
    for (var i = 0; i < rowBackgrounds.length; i++) if (rowBackgrounds[i]) rowBackgrounds[i].visible = false;
    for (var j = 0; j < rowSelectedBackgrounds.length; j++) if (rowSelectedBackgrounds[j]) rowSelectedBackgrounds[j].visible = false;
    for (var k = 0; k < rowIcons.length; k++) if (rowIcons[k]) rowIcons[k].visible = false;
    for (var l = 0; l < rowTexts.length; l++) if (rowTexts[l]) rowTexts[l].visible = false;

    popupOverlay = new Image({ url: '', x: 0, y: 0, width: screenWidth, height: screenHeight });
    popupOverlay.alpha = 0.5;
    popupOverlay.background = 'black';
    jsmaf.root.children.push(popupOverlay);

    popupBgImg = new Image({ url: popupBgUrl, x: popupX, y: popupY, width: popupWidth, height: popupHeight });
    popupBgImg.alpha = 1;
    jsmaf.root.children.push(popupBgImg);

    popupSelected = 0;
    popupOptionBgs = [];
    popupOptionTexts = [];

    for (var i2 = 0; i2 < popupOptions.length; i2++) {
      var y = popupY + 70 + i2 * popupOptionHeight;
      var optBg = new Image({ url: selectImgUrl, x: popupX, y: y, width: popupWidth, height: popupOptionHeight });
      optBg.visible = (i2 === popupSelected);
      optBg.alpha = 0.9;
      jsmaf.root.children.push(optBg);
      popupOptionBgs.push(optBg);

      var optTxt = new jsmaf.Text();
      optTxt.text = popupOptions[i2];
      optTxt.x = popupX + 20;
      optTxt.y = y + (popupOptionHeight - 28) / 2;
      optTxt.style = 'white';
      jsmaf.root.children.push(optTxt);
      popupOptionTexts.push(optTxt);
    }
  }

  function closePopup() {
    if (!popupActive) return;
    popupActive = false;
    removeElement(popupOverlay);
    removeElement(popupBgImg);
    for (var i = 0; i < popupOptionBgs.length; i++) removeElement(popupOptionBgs[i]);
    for (var j = 0; j < popupOptionTexts.length; j++) removeElement(popupOptionTexts[j]);
    popupOverlay = popupBgImg = null;
    popupOptionBgs = [];
    popupOptionTexts = [];
    updateListUI();
  }

  function popupNavigate(delta) {
    popupSelected += delta;
    if (popupSelected < 0) popupSelected = popupOptions.length - 1;
    if (popupSelected >= popupOptions.length) popupSelected = 0;
    for (var i = 0; i < popupOptionBgs.length; i++) popupOptionBgs[i].visible = (i === popupSelected);
  }

  function showHelpPopup() {
    if (helpActive) return;
    helpActive = true;
    removeElement(popupOverlay);
    removeElement(popupBgImg);
    for (var i = 0; i < popupOptionBgs.length; i++) removeElement(popupOptionBgs[i]);
    for (var j = 0; j < popupOptionTexts.length; j++) removeElement(popupOptionTexts[j]);
    popupActive = false;
    popupOverlay = popupBgImg = null;
    popupOptionBgs = [];
    popupOptionTexts = [];

    helpOverlay = new Image({ url: '', x: 0, y: 0, width: screenWidth, height: screenHeight });
    helpOverlay.alpha = 0.6;
    helpOverlay.background = 'black';
    jsmaf.root.children.push(helpOverlay);

    helpBgImg = new Image({ url: helpImgUrl, x: helpX, y: helpY, width: helpWidth, height: helpHeight });
    helpBgImg.alpha = 1;
    jsmaf.root.children.push(helpBgImg);
  }

  function closeHelpPopup() {
    if (!helpActive) return;
    helpActive = false;
    removeElement(helpOverlay);
    removeElement(helpBgImg);
    helpOverlay = helpBgImg = null;
    updateListUI();
    if (persistentPathText) persistentPathText.visible = true;
  }

  function popupConfirm() {
    var option = popupOptions[popupSelected];
    var item = allItems[selectedIndex];
    if (!item && option !== 'Paste') return;
    var multiItems = getSelectedItems();
    var multiMode = multiItems.length > 0;
    closePopup();

    switch (option) {
      case 'Rename':
        if (multiMode) { showError('No.. You cannot do this!.. you are on mutiple select..'); return; }
        if (isFavoritePath(item.path)) {
          showError('This favorite folder you could break the save of it if you do this!');
          return;
        }
        promptLater('Rename ' + (item.isDir ? 'Folder' : 'File'), item.name, 255, function (newName) {
          newName = sanitizeName(newName);
          if (newName && newName !== item.name) {
            var parentPath = getParentPath(item.path);
            var newPath = joinPath(parentPath, newName);
            renameFileOrFolder(item.path, newPath, function (err) {
              if (err) showError('Rename failed: ' + (err.message || err));
              else { clearSelection(); postMutationRefresh(newPath); }
            });
          }
        });
        break;

      case 'Delete':
        if (multiMode) {
          promptLater('Delete selected items? type yes', '', 8, function (answer) {
            if (answer && String(answer).toLowerCase() === 'yes') {
              performDeleteItems(multiItems.slice(0), function (err) {
                clearSelection();
                postMutationRefresh(currentPath);
                if (err) showError('Delete completed with errors: ' + (err.message || err));
              });
            } else showError('Delete cancelled.');
          });
        } else {
          promptLater('Type yes to delete', '', 8, function (answer2) {
            if (answer2 && String(answer2).toLowerCase() === 'yes') {
              deleteItem(item, function (err2) {
                if (err2) showError('Delete failed: ' + (err2.message || err2));
                else postMutationRefresh(item.path);
              });
            } else showError('Delete cancelled.');
          });
        }
        break;

      case 'Create':
        if (multiMode) {
          promptLater('New folder name', '', 255, function (folderName) {
            folderName = sanitizeName(folderName);
            if (folderName) createFolderAndMoveSelected(folderName, multiItems.slice(0));
          });
        } else {
          promptLater('Create type: folder or file', '', 16, function (type) {
            if (!type) return;
            type = String(type).toLowerCase().trim();
            if (type === 'folder' || type === 'f') {
              promptLater('New folder name', '', 255, function (name) {
                name = sanitizeName(name);
                if (name) {
                  var folderPath = joinPath(currentPath, name);
                  createFolder(folderPath, function (err) {
                    if (err) showError('Create folder failed: ' + (err.message || err));
                    else postMutationRefresh(folderPath);
                  });
                }
              });
            } else if (type === 'file') {
              createFileWithPrompt();
            } else {
              showError('Invalid type. Use folder or file.');
            }
          });
        }
        break;

      case 'Move':
        if (multiMode) {
          if (containsFavoriteItems(multiItems)) {
            showError('This favorite folder you could break the save of it if you do this!');
            return;
          }
          var defaultDestMulti = 'file://../' + currentPath.replace(/^\/+/, '') + '/';
          promptLater('Move selected items to path (use trailing /)', defaultDestMulti, 512, function (dest) {
            if (dest && String(dest).trim() !== '') {
              var destDir = parseUserPath(dest);
              if (isFavoritePath(destDir)) {
                showError('This favorite folder you could break the save of it if you do this!');
                return;
              }
              moveItemsToDir(multiItems.slice(0), destDir, function (moveErr) {
                clearSelection();
                postMutationRefresh(destDir);
                if (moveErr) showError('Move completed with errors: ' + (moveErr.message || moveErr));
              });
            }
          });
        } else {
          if (isFavoritePath(item.path)) {
            showError('This favorite folder you could break the save of it if you do this!');
            return;
          }
          var defaultDest = 'file://../' + currentPath.replace(/^\/+/, '') + '/';
          promptLater('Move to path (use trailing / for folder)', defaultDest, 512, function (dest2) {
            if (dest2 && String(dest2).trim() !== '') {
              var destDir2 = parseUserPath(dest2);
              if (isFavoritePath(destDir2)) {
                showError('This favorite folder you could break the save of it if you do this!');
                return;
              }
              var newTarget = joinPath(destDir2, item.name);
              if (!newTarget) { showError('Invalid destination.'); return; }
              renameFileOrFolder(item.path, newTarget, function (err3) {
                if (err3) showError('Move failed: ' + (err3.message || err3));
                else { clearSelection(); postMutationRefresh(newTarget); }
              });
            }
          });
        }
        break;

      case 'Edit':
        if (multiMode) { showError('No.. You cannot fo this!.. you are on mutiple select..'); return; }
        if (item.isDir) { showError('Cannot edit a folder.'); return; }
        readFileContent(item.path, function (err4, content) {
          if (err4) { showError('Failed to read file: ' + (err4.message || err4)); return; }
          promptLater('Edit file: ' + item.name, content, Math.max(4096, content.length + 1024), function (newContent) {
            if (newContent !== undefined && newContent !== null) {
              writeFileContent(item.path, newContent, function (writeErr) {
                if (writeErr) showError('Save failed: ' + (writeErr.message || writeErr));
                else postMutationRefresh(item.path);
              });
            }
          });
        });
        break;

      case 'Run':
        if (multiMode) { showError('No.. You cannot fo this!.. you are on mutiple select..'); return; }
        if (!isJsFile(item)) { showError('This Is Not JS file'); return; }
        runJsFile(item);
        break;

      case 'Cut':
        if (multiMode && containsFavoriteItems(multiItems)) {
          showError('This favorite folder you could break the save of it if you do this!');
          return;
        }
        cutSelection();
        break;

      case 'Copy':
        copySelection();
        break;

      case 'Paste':
        pasteClipboard();
        break;

      case 'Fav':
        runFavoriteToggleAction(item, multiItems);
        break;

      case 'Unfav':
        if (multiMode) removeFavorites(multiItems);
        else removeFavorites([item]);
        break;

      case 'Create inside folder':
        if (multiMode) { showError('No.. You cannot fo this!.. you are on mutiple select..'); return; }
        if (item && !item.isDir) { showError('This option only works on folders.'); return; }
        createFileWithPromptAtPath(item && item.isDir ? item.path : currentPath);
        break;

      case 'Help':
        showHelpPopup();
        break;
    }
  }

  function openTextViewer(item) {
    closeViewer();
    viewerActive = false;
    viewerScroll = 0;
    readFileContent(item.path, function (err, text) {
      if (err) { showError('Cannot preview: ' + (err.message || err)); return; }
      viewerActive = true;
      for (var i = 0; i < rowBackgrounds.length; i++) if (rowBackgrounds[i]) rowBackgrounds[i].visible = false;
      for (var j = 0; j < rowSelectedBackgrounds.length; j++) if (rowSelectedBackgrounds[j]) rowSelectedBackgrounds[j].visible = false;
      for (var k = 0; k < rowIcons.length; k++) if (rowIcons[k]) rowIcons[k].visible = false;
      for (var l = 0; l < rowTexts.length; l++) if (rowTexts[l]) rowTexts[l].visible = false;
      if (persistentPathText) persistentPathText.visible = false;

      viewerOverlay = new Image({ url: '', x: 0, y: 0, width: screenWidth, height: screenHeight });
      viewerOverlay.alpha = 0.7;
      viewerOverlay.background = 'black';
      jsmaf.root.children.push(viewerOverlay);

      viewerModalBg = new Image({ url: '', x: 200, y: 100, width: 1520, height: 880 });
      viewerModalBg.background = 'gray';
      viewerModalBg.alpha = 0.95;
      jsmaf.root.children.push(viewerModalBg);

      viewerTitle = new jsmaf.Text();
      viewerTitle.text = item.name;
      viewerTitle.x = 240;
      viewerTitle.y = 130;
      viewerTitle.style = 'title';
      jsmaf.root.children.push(viewerTitle);

      viewerContent = new jsmaf.Text();
      viewerContent.x = 240;
      viewerContent.y = 180;
      viewerContent.style = 'white';
      viewerContent.wrap = true;
      viewerContent.width = 1440;
      viewerContent.text = '';
      jsmaf.root.children.push(viewerContent);

      scheduleTimeout(function () {
        try { viewerContent.text = (text && text.length > 0) ? text : '(empty)'; }
        catch (e) { viewerContent.text = '(error rendering text)'; }
      }, 50);

      viewerCloseHint = new jsmaf.Text();
      viewerCloseHint.text = 'Circle to close, Up/Down to scroll';
      viewerCloseHint.x = 240;
      viewerCloseHint.y = 940;
      viewerCloseHint.style = 'small';
      jsmaf.root.children.push(viewerCloseHint);
    });
  }

  function closeViewer() {
    if (viewerActive === false) {
      removeElement(viewerOverlay);
      removeElement(viewerModalBg);
      removeElement(viewerTitle);
      removeElement(viewerContent);
      removeElement(viewerCloseHint);
      viewerOverlay = viewerModalBg = viewerTitle = viewerContent = viewerCloseHint = null;
      return;
    }
    viewerActive = false;
    removeElement(viewerOverlay);
    removeElement(viewerModalBg);
    removeElement(viewerTitle);
    removeElement(viewerContent);
    removeElement(viewerCloseHint);
    viewerOverlay = viewerModalBg = viewerTitle = viewerContent = viewerCloseHint = null;
    updateListUI();
    if (persistentPathText) persistentPathText.visible = true;
  }

  function initBgm() {
    try {
      bgm = new jsmaf.AudioClip();
      bgm.open(bgmUrl);
      bgm.loop = false;
      bgm.volume = 0.45;
      bgm.onended = function () {
        if (!bgm) return;
        scheduleTimeout(function () {
          try { if (bgm) { bgm.stop(); bgm.play(); } } catch (e) {}
        }, 800);
      };
      bgm.play();
    } catch (e) {
      log('BGM init failed: ' + (e.message || e));
    }
  }

  jsmaf.onKeyDown = function (keyCode) {
    if (restartPending) return;

    if (helpActive) {
      if (keyCode === 13) closeHelpPopup();
      return;
    }

    if (keyCode === 12) {
      goToRoot();
      return;
    }

    if (keyCode === 15) {
      if (favMode) exitFavMode();
      else enterFavMode();
      return;
    }

    if (keyCode === 4) { beginNavRepeat(4, navigateUpInList); return; }
    if (keyCode === 6) { beginNavRepeat(6, navigateDown); return; }

    if (keyCode === 14) confirmSelection();
    else if (keyCode === 13) navigateUp();
    else if (keyCode === 3 && !popupActive && !viewerActive) showPopup();
    else if (keyCode === 11 && !popupActive && !viewerActive) toggleSelectCurrent();
    else if (keyCode === 9 && !popupActive && !viewerActive) toggleSelectAll();
  };

  jsmaf.onKeyUp = function (keyCode) {
    if (keyCode === navHoldKey) stopNavRepeat();
  };

  function fullUnload() {
    try {
      hardReleaseAllAssets();

      for (var i = 0; i < intervals.length; i++) {
        try { jsmaf.clearInterval(intervals[i]); } catch (e1) {}
      }
      for (var j = 0; j < timeouts.length; j++) {
        try { jsmaf.clearTimeout(timeouts[j]); } catch (e2) {}
      }

      clearArray(intervals);
      clearArray(timeouts);
      clearSelection();
      clipboardItems = [];
      clipboardMode = null;
      selectedIndex = 0;
      scrollOffset = 0;
      lastSelectedIndex = -1;
      allItems = [];
      favMode = false;
      favBrowseActive = false;
      favPathStack = [];
      favReturnState = null;

      try { jsmaf.root.children.length = 0; } catch (e3) {}
      try { globalCleanup(); } catch (e4) {}

      jsmaf.onKeyDown = function () {};
      jsmaf.onKeyUp = function () {};
      jsmaf.onMouseMove = function () {};
      jsmaf.onMouseDown = function () {};
      jsmaf.onEnterFrame = function () {};
      jsmaf.onShutdown = function () {};
    } catch (e) {}
  }

  prelaunchPayloadSweep();
  loadFavorites();

  backgroundImage = new Image({ url: '', x: 0, y: 0, width: screenWidth, height: screenHeight });
  backgroundImage.alpha = 1;
  jsmaf.root.children.push(backgroundImage);
  reliableImageLoad(backgroundImage, bgImageUrl, 'background');

  openingImage = new Image({ url: '', x: 0, y: 0, width: screenWidth, height: screenHeight });
  openingImage.alpha = 1;
  jsmaf.root.children.push(openingImage);
  scheduleTimeout(function () {
    reliableImageLoad(openingImage, openingImgUrl, 'opening image');
  }, 120);

  persistentPathText = new jsmaf.Text();
  persistentPathText.x = 20;
  persistentPathText.y = 20;
  persistentPathText.style = 'small';
  persistentPathText.text = currentPath;
  persistentPathText.visible = false;
  jsmaf.root.children.push(persistentPathText);

  scheduleTimeout(function () {
    openingImage.visible = false;
    persistentPathText.visible = true;
    initBgm();
    refreshDirectoryData();
  }, 3000);
})();
