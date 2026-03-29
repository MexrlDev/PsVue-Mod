// Dump all jsmaf from your vue version

// By mexrldev 2026

(function () {
  var DUMP_PATH = '/download0/payloads/jsmaf_dump.json';
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var MAX_DEPTH = 24;
  var MAX_PREVIEW = 180;

  var mode = 'menu'; //
  var dumpStarted = false;
  var testEntries = null;
  var testIndex = 0;

  var ui = {
    menu: [],
    header: null,
    body: null,
    footer: null,
    status: null
  };

  if (typeof jsmaf !== 'undefined' && jsmaf && jsmaf.root && jsmaf.root.children) {
    jsmaf.root.children.length = 0;
  }

  if (typeof Style !== 'undefined') {
    try {
      new Style({ name: 'white', color: 'white', size: 24 });
      new Style({ name: 'green', color: 'green', size: 24 });
      new Style({ name: 'red', color: 'red', size: 24 });
      new Style({ name: 'yellow', color: 'yellow', size: 24 });
      new Style({ name: 'cyan', color: 'cyan', size: 20 });
      new Style({ name: 'small', color: 'white', size: 16 });
    } catch (e) {}
  }

  function isArray(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function isPrimitive(v) {
    return v === null || (typeof v !== 'object' && typeof v !== 'function');
  }

  function fileUrl(path) {
    if (!path) return 'file:///';
    if (path.indexOf('file://') === 0) return path;
    return 'file://' + path;
  }

  function truncateText(s) {
    if (s === null || s === undefined) return String(s);
    s = String(s);
    if (s.length <= MAX_PREVIEW) return s;
    return s.substr(0, MAX_PREVIEW) + '…';
  }

  function safeStringify(v) {
    try {
      return JSON.stringify(v);
    } catch (e) {
      return '"[unstringifiable]"';
    }
  }

  function clearTexts(arr) {
    var i;
    for (i = 0; i < arr.length; i++) {
      if (arr[i]) arr[i].visible = false;
    }
    arr.length = 0;
  }

  function addText(style, x, y, text) {
    var t = new jsmaf.Text();
    t.style = style;
    t.x = x;
    t.y = y;
    t.text = text;
    jsmaf.root.children.push(t);
    return t;
  }

  function showStatus(msg, style, y) {
    if (ui.status) ui.status.visible = false;
    ui.status = addText(style || 'yellow', 20, y || (SCREEN_H - 60), msg);
  }

  function showError(msg) {
    showStatus(msg, 'red', SCREEN_H / 2);
    if (typeof console !== 'undefined' && console.log) {
      console.log('[!] ' + msg);
    }
  }

  function resetUI() {
    if (ui.header) ui.header.visible = false;
    if (ui.body) ui.body.visible = false;
    if (ui.footer) ui.footer.visible = false;
    if (ui.status) ui.status.visible = false;
    clearTexts(ui.menu);
  }

  function showMenu() {
    mode = 'menu';
    resetUI();

    var cx = SCREEN_W / 2;
    var y = SCREEN_H / 2 - 50;

    ui.menu.push(addText('white', cx - 180, y, 'Press X (⨉) to dump jsmaf'));
    ui.menu.push(addText('white', cx - 180, y + 60, 'Press SQUARE (◻) to test the dump'));
    ui.menu.push(addText('white', 20, SCREEN_H - 40, 'Dump path: ' + DUMP_PATH));
  }

  function makePath(parentPath, key) {
    if (!parentPath) return String(key);
    return parentPath + '.' + String(key);
  }

  function normalizePathForLookup(path) {
    if (!path) return [];
    var parts = String(path).split('.');
    var out = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      if (parts[i] !== '') out.push(parts[i]);
    }
    return out;
  }

  function resolvePath(root, path) {
    var parts = normalizePathForLookup(path);
    var current = root;
    var i, part;

    for (i = 0; i < parts.length; i++) {
      if (current === null || current === undefined) return undefined;
      part = parts[i];

      if (i === 0 && part === 'jsmaf') {
        current = root;
        continue;
      }

      if (part === '__proto__') {
        try {
          current = Object.getPrototypeOf(current);
        } catch (e0) {
          return undefined;
        }
        continue;
      }

      if (/^\d+$/.test(part)) {
        current = current[parseInt(part, 10)];
      } else {
        current = current[part];
      }
    }

    return current;
  }

  function typeOfValue(v) {
    if (v === null) return 'null';
    return typeof v;
  }

  function previewValue(v) {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'string') return JSON.stringify(truncateText(v));
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'function') {
      return '[function' + (v.name ? ' ' + v.name : '') + ']';
    }
    try {
      if (v && v.constructor && v.constructor.name) {
        return '[object ' + v.constructor.name + ']';
      }
    } catch (e) {}
    return '[object]';
  }

  function primitiveEqual(a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') {
      if (isNaN(a) && isNaN(b)) return true;
    }
    return false;
  }

  function isVisited(vis, obj) {
    if (!vis) return false;
    if (typeof vis.indexOf === 'function') return vis.indexOf(obj) !== -1;
    return false;
  }

  function markVisited(vis, obj) {
    if (!vis) return;
    if (typeof vis.push === 'function') vis.push(obj);
  }

  function dumpObject(rootObj, rootPath, visited, results, depth) {
    var obj, props, i, key, fullPath, val, vt, entry;

    if (depth > MAX_DEPTH) {
      results.push({ path: rootPath, type: 'depth_limit' });
      return;
    }

    if (rootObj === null) {
      results.push({ path: rootPath, type: 'null', value: null });
      return;
    }

    vt = typeof rootObj;

    if (vt !== 'object' && vt !== 'function') {
      results.push({ path: rootPath, type: vt, value: rootObj });
      return;
    }

    if (isVisited(visited, rootObj)) {
      results.push({ path: rootPath, type: 'circular' });
      return;
    }

    markVisited(visited, rootObj);

    try {
      props = Object.getOwnPropertyNames(rootObj);
    } catch (e0) {
      results.push({ path: rootPath, type: 'error', error: e0.message });
      return;
    }

    for (i = 0; i < props.length; i++) {
      key = props[i];
      fullPath = makePath(rootPath, key);

      try {
        val = rootObj[key];
        vt = typeOfValue(val);

        if (vt === 'object') {
          entry = { path: fullPath, type: 'object' };
          results.push(entry);
          if (val !== null) dumpObject(val, fullPath, visited, results, depth + 1);
          else results.push({ path: fullPath, type: 'null', value: null });
        } else if (vt === 'function') {
          results.push({
            path: fullPath,
            type: 'function',
            name: val.name || '',
            arity: typeof val.length === 'number' ? val.length : null
          });
        } else {
          entry = { path: fullPath, type: vt };
          if (isPrimitive(val)) entry.value = val;
          results.push(entry);
        }
      } catch (e1) {
        results.push({ path: fullPath, type: 'inaccessible', error: e1.message });
      }
    }

    try {
      var proto = Object.getPrototypeOf(rootObj);
      if (proto && proto !== Object.prototype) {
        dumpObject(proto, rootPath + '.__proto__', visited, results, depth + 1);
      }
    } catch (e2) {}
  }

  function writeFile(path, content, cb) {
    try {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && cb) {
          var ok = xhr.status === 0 || xhr.status === 200 || xhr.status === 201 || xhr.status === 204;
          cb(ok ? null : new Error('write failed, status=' + xhr.status));
        }
      };
      xhr.open('POST', fileUrl(path), true);
      xhr.send(content);
    } catch (e) {
      if (cb) cb(e);
    }
  }

  function readFile(path, cb) {
    try {
      var xhr = new jsmaf.XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && cb) {
          var ok = xhr.status === 0 || xhr.status === 200;
          cb(ok ? null : new Error('read failed, status=' + xhr.status), xhr.responseText);
        }
      };
      xhr.open('GET', fileUrl(path), true);
      xhr.send();
    } catch (e) {
      if (cb) cb(e);
    }
  }

  function performDump() {
    mode = 'dump';
    resetUI();
    showStatus('Dumping...', 'yellow', SCREEN_H / 2);

    var results = [];
    var visited = [];
    try {
      if (!jsmaf) throw new Error('jsmaf is not available');
      dumpObject(jsmaf, 'jsmaf', visited, results, 0);
    } catch (e) {
      showError('Dump failed: ' + e.message);
      showMenu();
      return;
    }

    writeFile(DUMP_PATH, JSON.stringify(results, null, 2), function (err) {
      if (ui.status) ui.status.visible = false;
      if (err) {
        showError('Write failed: ' + err.message);
        jsmaf.setTimeout(function () { showMenu(); }, 2000);
        return;
      }

      ui.status = addText('green', SCREEN_W / 2 - 150, SCREEN_H / 2, 'Dump complete: ' + results.length + ' entries');
      jsmaf.setTimeout(function () {
        if (ui.status) ui.status.visible = false;
        showMenu();
      }, 2000);
    });
  }

  function functionCallShouldSkip(path) {
    var p = String(path || '').toLowerCase();
    var blocked = [
      'exit',
      'restart',
      'shutdown',
      'forceshutdown',
      'forceconnect',
      'openwebbrowser',
      'alert',
      'eval',
      'include',
      'settimeout',
      'setinterval',
      'clearinterval',
      'cleartimeout',
      'showosk'
    ];
    var i;
    for (i = 0; i < blocked.length; i++) {
      if (p.indexOf(blocked[i]) !== -1) return true;
    }
    return false;
  }

  function testFunctionIfSafe(path, fn) {
    if (typeof fn !== 'function') return { skipped: true, note: 'not a function' };
    if (functionCallShouldSkip(path)) return { skipped: true, note: 'skipped dangerous function' };

    try {
      if (fn.length === 0) {
        var r = fn();
        return { skipped: false, ok: true, result: previewValue(r) };
      }
      return { skipped: true, note: 'function has arguments; skipped' };
    } catch (e) {
      return { skipped: false, ok: false, error: e.message };
    }
  }

  function testEntry(entry) {
    var path = entry.path;
    var expectedType = entry.type;
    var expectedValue = hasOwn(entry, 'value') ? entry.value : undefined;
    var actualValue;
    var actualType;
    var typePass = false;
    var valuePass = true;
    var callResult = null;
    var error = null;

    try {
      actualValue = resolvePath(jsmaf, path);
      actualType = typeOfValue(actualValue);

      if (expectedType === 'circular') {
        typePass = true;
      } else if (expectedType === 'accessor') {
        typePass = true;
      } else if (expectedType === 'depth_limit') {
        typePass = true;
      } else if (expectedType === 'inaccessible' || expectedType === 'error') {
        typePass = true;
      } else {
        typePass = (actualType === expectedType);
      }

      if (hasOwn(entry, 'value')) {
        valuePass = primitiveEqual(expectedValue, actualValue);
      }
    } catch (e0) {
      actualType = 'error';
      error = e0.message;
      typePass = false;
      valuePass = false;
    }

    if (actualType === 'function' && actualValue !== undefined && actualValue !== null) {
      callResult = testFunctionIfSafe(path, actualValue);
    }

    return {
      path: path,
      expected: expectedType,
      expectedValue: expectedValue,
      actual: actualType,
      actualValue: actualValue,
      typePass: typePass,
      valuePass: valuePass,
      callResult: callResult,
      error: error
    };
  }

  function updateTestDisplay() {
    var entry, result, lines, overallPass, preview;

    if (!testEntries || testIndex >= testEntries.length) {
      if (ui.header) ui.header.text = 'Test finished';
      if (ui.body) {
        ui.body.style = 'green';
        ui.body.text = 'All tests completed!';
      }
      return;
    }

    entry = testEntries[testIndex];
    result = testEntry(entry);

    if (ui.header) ui.header.text = 'Test ' + (testIndex + 1) + ' / ' + testEntries.length;

    lines = [];
    lines.push('Path: ' + result.path);
    lines.push('Expected: ' + result.expected);
    lines.push('Actual: ' + result.actual);

    if (hasOwn(entry, 'value')) {
      lines.push('Expected value: ' + safeStringify(result.expectedValue));
    }

    if (result.actual !== 'object' && result.actual !== 'function') {
      preview = previewValue(result.actualValue);
      lines.push('Current value: ' + preview);
    } else if (result.actual === 'string') {
      lines.push('Current value: ' + previewValue(result.actualValue));
    }

    if (result.error) {
      lines.push('Error: ' + result.error);
    }

    lines.push('');
    lines.push(result.typePass ? 'type PASS' : 'type FAIL');

    if (hasOwn(entry, 'value')) {
      lines.push(result.valuePass ? 'value PASS' : 'value FAIL');
    }

    if (result.callResult) {
      lines.push('');
      lines.push('Function test:');
      if (result.callResult.skipped) {
        lines.push('  skipped: ' + result.callResult.note);
      } else if (result.callResult.ok) {
        lines.push('  ✓ call success: ' + result.callResult.result);
      } else {
        lines.push('  ✗ call failed: ' + result.callResult.error);
      }
    }

    if (ui.body) {
      ui.body.text = lines.join('\n');
      overallPass = result.typePass && result.valuePass && (!result.callResult || result.callResult.skipped || result.callResult.ok);
      ui.body.style = overallPass ? 'green' : 'red';
    }

    if (ui.footer) {
      ui.footer.text = 'LEFT (◀) next test | BACK (O) restart';
    }
  }

  function showTestUI() {
    mode = 'test';
    resetUI();

    ui.header = addText('cyan', 20, 20, '');
    ui.body = addText('white', 20, 120, '');
    ui.footer = addText('small', 20, SCREEN_H - 60, 'LEFT (◀) next test | BACK (O) restart');

    updateTestDisplay();
  }

  function nextTest() {
    if (!testEntries || !testEntries.length) return;
    if (testIndex + 1 < testEntries.length) {
      testIndex++;
    } else {
      testIndex = testEntries.length;
    }
    updateTestDisplay();
  }

  function loadAndTest() {
    mode = 'test';
    resetUI();
    showStatus('Loading JSON...', 'yellow', SCREEN_H / 2);

    readFile(DUMP_PATH, function (err, data) {
      if (ui.status) ui.status.visible = false;

      if (err) {
        showError('Could not read dump: ' + err.message);
        jsmaf.setTimeout(function () { showMenu(); }, 2000);
        return;
      }

      try {
        var parsed = JSON.parse(data);
        if (!isArray(parsed)) throw new Error('JSON root is not an array');
        testEntries = parsed;
        testIndex = 0;
        showTestUI();
      } catch (e0) {
        showError('Invalid JSON: ' + e0.message);
        jsmaf.setTimeout(function () { showMenu(); }, 2000);
      }
    });
  }

  function restartApp() {
    try {
      if (typeof debugging !== 'undefined' && debugging && typeof debugging.restart === 'function') {
        debugging.restart();
      } else if (jsmaf && typeof jsmaf.restart === 'function') {
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

  jsmaf.onKeyDown = function (keyCode) {
    if (mode === 'menu') {
      if (keyCode === 14 && !dumpStarted) {
        dumpStarted = true;
        performDump();
      } else if (keyCode === 15) {
        loadAndTest();
      }
    } else if (mode === 'test') {
      if (keyCode === 7) {
        nextTest();
      } else if (keyCode === 13) {
        restartApp();
      }
    }
  };

  showMenu();
  if (typeof console !== 'undefined' && console.log) {
    console.log('[+] JSMAF Dumper Ready.');
  }
})();
