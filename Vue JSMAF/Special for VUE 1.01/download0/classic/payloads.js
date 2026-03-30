// JSMAF Dumper for Vue 1.01
// By mexrldev 2026, adapted for consistent environment

(function() {
    var DUMP_PATH = 'file://../download0/classic/jsmaf_dump.json';
    var SCREEN_W = 1920;
    var SCREEN_H = 1080;
    var MAX_DEPTH = 24;
    var MAX_PREVIEW = 180;

    var mode = 'menu';
    var dumpStarted = false;

    // UI elements
    var ui = {
        menu: [],
        header: null,
        body: null,
        footer: null,
        status: null
    };

    // Clear the screen
    if (typeof jsmaf !== 'undefined' && jsmaf && jsmaf.root && jsmaf.root.children) {
        jsmaf.root.children.length = 0;
    }

    // Predefine styles (same as original)
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

    // Helper functions
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

    // Add text directly to jsmaf root (like original displayText)
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
        // Original used alert for errors, but here we just show on screen
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
        var y = SCREEN_H / 2 - 30;

        ui.menu.push(addText('white', cx - 180, y, 'Press X (⨉) to dump jsmaf'));
        ui.menu.push(addText('white', cx - 180, y + 60, 'Press O (O) to reload debugging'));
        ui.menu.push(addText('small', 20, SCREEN_H - 40, 'Dump path: ' + DUMP_PATH));
    }

    function makePath(parentPath, key) {
        if (key === '__proto__') return null;
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
                return undefined;
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
        var props, i, key, fullPath, val, vt, entry;

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

            if (key === '__proto__') {
                continue;
            }

            fullPath = makePath(rootPath, key);
            if (!fullPath) {
                continue;
            }

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
            xhr.onreadystatechange = function() {
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

        writeFile(DUMP_PATH, JSON.stringify(results, null, 2), function(err) {
            if (ui.status) ui.status.visible = false;

            if (err) {
                showError('Write failed: ' + err.message);
                setTimeout(function() { showMenu(); }, 2000);
                return;
            }

            ui.status = addText('green', SCREEN_W / 2 - 150, SCREEN_H / 2, 'Dump complete: ' + results.length + ' entries');
            setTimeout(function() {
                if (ui.status) ui.status.visible = false;
                showMenu();
            }, 2000);
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
                // Fallback: show alert (original used alert for errors)
                alert('No restart method available.');
            }
        } catch (e) {
            alert('Restart failed: ' + e.message);
        }
    }

    // Key handler (lowercase to match original jsmaf.onkeydown)
    jsmaf.onkeydown = function(keyCode) {
        // Circle (13) restarts
        if (keyCode === 13) {
            restartApp();
            return;
        }

        if (mode === 'menu') {
            if (keyCode === 14 && !dumpStarted) {  // X button
                dumpStarted = true;
                performDump();
            }
        } else if (mode === 'dump') {
            if (keyCode === 13) {  // Circle
                restartApp();
            }
        }
    };

    // Start the menu
    showMenu();

    // Optional log (silent)
    function log(msg) {
        // Unused but kept for compatibility
    }
})();
