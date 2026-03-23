// Jsmaf Dumper by MexrlDev

(function () {
  // ========== 1. Configuration ==========
  var OUTPUT_PATH = '/download0/payloads/jsmaf_dump.json';
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var LINES_PER_PAGE = 20;
  var LINE_HEIGHT = 24;
  var START_Y = 80;

  // ========== 2. Global State ==========
  var dumpResults = null;         // array of { path, type, error? }
  var scrollOffset = 0;           // index of first line to show
  var currentMode = 'prompt';     // 'prompt' or 'debug'
  var debugText = null;           // the Text element showing the lines
  var headerText = null;           // small header with stats
  var promptText = null;          // initial prompt
  var footerText = null;          // initial footer

  // ========== 3. UI Setup ==========
  if (jsmaf && jsmaf.root && jsmaf.root.children) {
    jsmaf.root.children.length = 0;
  }

  // Define styles
  if (typeof Style !== 'undefined') {
    try {
      new Style({ name: 'white',   color: 'white', size: 24 });
      new Style({ name: 'green',   color: 'green', size: 24 });
      new Style({ name: 'red',     color: 'red',   size: 24 });
      new Style({ name: 'yellow',  color: 'yellow',size: 24 });
      new Style({ name: 'header',  color: 'cyan',  size: 20 });
    } catch (e) {}
  }

  // Create initial prompt UI
  promptText = new jsmaf.Text();
  promptText.style = 'white';
  promptText.x = SCREEN_W / 2 - 150;
  promptText.y = SCREEN_H / 2;
  promptText.text = 'Press X (⨉) to dump jsmaf';
  jsmaf.root.children.push(promptText);

  footerText = new jsmaf.Text();
  footerText.style = 'white';
  footerText.x = 20;
  footerText.y = SCREEN_H - 40;
  footerText.text = 'Output: /download0/payloads/jsmaf_dump.json';
  jsmaf.root.children.push(footerText);

  // ========== 4. File Writing (fsWrite) ==========
  function fsWrite(filename, content, cb) {
    try {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && cb) {
          cb(xhr.status === 0 || xhr.status === 200 ? null : new Error('failed'));
        }
      };
      xhr.open('POST', 'file://..' + filename, true);
      xhr.send(content);
    } catch (e) {
      if (cb) cb(e);
    }
  }

  // ========== 5. Dump Exploration ==========
  function explore(obj, path, visited, results) {
    if (obj === null || obj === undefined) {
      results.push({ path: path, type: 'null' });
      return;
    }
    var type = typeof obj;
    if (type !== 'object' && type !== 'function') {
      results.push({ path: path, type: type });
      return;
    }
    if (visited.has(obj)) {
      results.push({ path: path, type: 'circular' });
      return;
    }
    visited.add(obj);

    var props = [];
    try {
      props = Object.getOwnPropertyNames(obj);
    } catch (e) {
      results.push({ path: path, type: 'error', error: e.message });
      return;
    }

    for (var i = 0; i < props.length; i++) {
      var key = props[i];
      var fullPath = path + '.' + key;
      try {
        var value = obj[key];
        var valType = typeof value;
        if (valType === 'function') {
          results.push({ path: fullPath, type: 'function' });
        } else if (valType === 'object' && value !== null) {
          results.push({ path: fullPath, type: 'object' });
          explore(value, fullPath, visited, results);
        } else {
          results.push({ path: fullPath, type: valType });
        }
      } catch (e) {
        results.push({ path: fullPath, type: 'inaccessible', error: e.message });
      }
    }

    // Prototype chain
    try {
      var proto = Object.getPrototypeOf(obj);
      if (proto && proto !== Object.prototype && !visited.has(proto)) {
        explore(proto, path + '.__proto__', visited, results);
      }
    } catch (e) {
      // ignore
    }
  }

  function performDump() {
    if (promptText) promptText.visible = false;
    if (footerText) footerText.visible = false;
    var tmpText = new jsmaf.Text();
    tmpText.style = 'yellow';
    tmpText.x = SCREEN_W / 2 - 80;
    tmpText.y = SCREEN_H / 2;
    tmpText.text = 'Dumping...';
    jsmaf.root.children.push(tmpText);

    var results = [];
    var visited = new WeakSet();

    try {
      var root = jsmaf;
      if (!root) throw new Error('jsmaf is not defined');

      explore(root, 'jsmaf', visited, results);
      dumpResults = results;

      var json = JSON.stringify(results, null, 2);
      fsWrite(OUTPUT_PATH, json, function (err) {
        if (tmpText) tmpText.visible = false;

        if (err) {
          showError('Write failed: ' + err.message);
        } else {
          showDebugView();
        }
      });
    } catch (e) {
      if (tmpText) tmpText.visible = false;
      showError('Dump failed: ' + e.message);
    }
  }

  function showError(msg) {
    var errorText = new jsmaf.Text();
    errorText.style = 'red';
    errorText.x = SCREEN_W / 2 - 150;
    errorText.y = SCREEN_H / 2;
    errorText.text = msg;
    jsmaf.root.children.push(errorText);
  }

  // ========== 6. Debug View ==========
  function showDebugView() {
    currentMode = 'debug';
    scrollOffset = 0;

    // Create header
    headerText = new jsmaf.Text();
    headerText.style = 'header';
    headerText.x = 20;
    headerText.y = 20;
    headerText.text = '';
    jsmaf.root.children.push(headerText);

    debugText = new jsmaf.Text();
    debugText.style = 'white';
    debugText.x = 20;
    debugText.y = START_Y;
    debugText.text = '';
    jsmaf.root.children.push(debugText);

    // Small hint at bottom
    var hint = new jsmaf.Text();
    hint.style = 'white';
    hint.x = 20;
    hint.y = SCREEN_H - 60;
    hint.text = 'UP/DOWN scroll | BACK to restart';
    jsmaf.root.children.push(hint);

    updateDebugView();
  }

  function updateDebugView() {
    if (!dumpResults) return;

    var total = dumpResults.length;
    var start = scrollOffset;
    var end = Math.min(start + LINES_PER_PAGE, total);

    // Build the visible lines
    var lines = [];
    for (var i = start; i < end; i++) {
      var entry = dumpResults[i];
      var line = entry.path;
      if (entry.type === 'inaccessible' || entry.type === 'error') {
        line += ' [' + entry.type + ': ' + (entry.error || '?') + ']';
      } else {
        line += ' (' + entry.type + ')';
      }
      lines.push(line);
    }

    // Fill the debug text
    debugText.text = lines.join('\n');

    // Update header
    headerText.text = 'Total: ' + total + ' entries | Showing ' + (start+1) + '-' + end + ' (scroll ' + scrollOffset + ')';
  }

  function scrollDebug(delta) {
    if (!dumpResults) return;
    var newOffset = scrollOffset + delta;
    if (newOffset < 0) newOffset = 0;
    if (newOffset > dumpResults.length - LINES_PER_PAGE) {
      newOffset = Math.max(0, dumpResults.length - LINES_PER_PAGE);
    }
    if (newOffset !== scrollOffset) {
      scrollOffset = newOffset;
      updateDebugView();
    }
  }

  // ========== 7. Key Handling ==========
  var dumpStarted = false;

  jsmaf.onKeyDown = function (keyCode) {
    if (currentMode === 'prompt') {
      if (keyCode === 14 && !dumpStarted) {
        dumpStarted = true;
        performDump();
      }
    } else if (currentMode === 'debug') {
      if (keyCode === 4) {
        scrollDebug(-1);
      } else if (keyCode === 6) {
        scrollDebug(1);
      } else if (keyCode === 13) {
        restartApp();
      }
    }
  };

  function restartApp() {
    try {
      if (typeof debugging !== 'undefined' && debugging && typeof debugging.restart === 'function') {
        debugging.restart();
      } else if (typeof jsmaf !== 'undefined' && jsmaf && typeof jsmaf.restart === 'function') {
        jsmaf.restart();
      } else if (typeof location !== 'undefined' && location && typeof location.reload === 'function') {
        location.reload();
      } else {
        console.log('[!] No restart method available.');
      }
    } catch (e) {
      console.log('[!] Restart failed: ' + e.message);
    }
  }

  jsmaf.setInterval(function () {}, 1000);

  console.log('[+] JSMAF Dumper ready. Press X to start.');
})();
