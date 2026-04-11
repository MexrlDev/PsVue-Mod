// Vue Dumper for Vuw 1.01 by MexrlDev

// Thanks to Arabpixel. i used his theme for vue 1.01 to get this to work!

// log
function log(msg) {
    try {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "http://s3.amazonaws.com/_log", true);
        xhr.send(msg);
    } catch (e) { /* silent */ }
}


// == Global setup ==

// Clear all elements
if (typeof jsmaf !== 'undefined' && jsmaf.root && jsmaf.root.children) {
    jsmaf.root.children.length = 0;
}

// Restart function
function restartVue() {
    try {
        if (typeof debugging !== 'undefined' && debugging.restart) {
            debugging.restart();
        } else if (jsmaf && typeof jsmaf.restart === 'function') {
            jsmaf.restart();
        } else if (typeof location !== 'undefined' && location.reload) {
            location.reload();
        } else {
            alert('No restart method available.');
        }
    } catch (e) {
        log('Restart error: ' + e);
        alert('Restart failed: ' + e);
    }
}

// == Dumper core ==

(function() {
    var DUMP_PATH = 'file:///../download0/VueE/Y3ah/payloads/jsmaf_dump.json';
    var SCREEN_W = 1920;
    var SCREEN_H = 1080;
    var MAX_DEPTH = 24;
    var MAX_PREVIEW = 180;

    var mode = 'menu';
    var dumpStarted = false;

    // Paths for assets
    var BASE_THEME_PATH = 'file:///../download0/VueE/Y3ah/payloads/';
    var IMG_DIR = BASE_THEME_PATH + 'images/';

    // UI element containers
    var ui = {
        menu: [],
        header: null,
        body: null,
        footer: null,
        status: null,
        background: null
    };


    // Style definitions
    if (typeof Style !== 'undefined') {
        try {
            new Style({ name: 'white', color: 'white', size: 24 });
            new Style({ name: 'green', color: 'green', size: 24 });
            new Style({ name: 'red', color: 'red', size: 24 });
            new Style({ name: 'yellow', color: 'yellow', size: 24 });
            new Style({ name: 'cyan', color: 'cyan', size: 20 });
            new Style({ name: 'small', color: 'white', size: 16 });
        } catch (e) {
            log('Style init error: ' + e);
        }
    }

    // == Helper functions ==
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
        for (var i = 0; i < arr.length; i++) {
            if (arr[i]) arr[i].visible = false;
        }
        arr.length = 0;
    }


    // == UI creation ==
    function addText(style, x, y, text) {
        var t = new jsmaf.Text();
        t.style = style;
        t.x = x;
        t.y = y;
        t.width = 800;
        t.height = 40;
        t.text = text;
        t.background = 'rgba(0,0,0,0)';
        t.visible = true;
        jsmaf.root.children.push(t);
        return t;
    }

    function showStatus(msg, style, y) {
        if (ui.status) ui.status.visible = false;
        ui.status = addText(style || 'yellow', 20, y || (SCREEN_H - 60), msg);
    }

    function showError(msg) {
        showStatus(msg, 'red', SCREEN_H / 2);
        log('[DUMPER ERROR] ' + msg);
    }

    function resetUI() {
        if (ui.header) ui.header.visible = false;
        if (ui.body) ui.body.visible = false;
        if (ui.footer) ui.footer.visible = false;
        if (ui.status) ui.status.visible = false;
        clearTexts(ui.menu);
    }


    // == Background Image ==
    function loadBackgroundImage(callback) {
        var extensions = ['.png', '.jpg', '.jpeg', '.bmp', '.gif'];
        var baseName = IMG_DIR + 'DOOM';
        var tried = 0;
        var img = new jsmaf.Image();
        img.x = 0;
        img.y = 0;
        img.width = SCREEN_W;
        img.height = SCREEN_H;
        img.visible = true;

        function tryNext() {
            if (tried >= extensions.length) {
                log('Background image not found, using black background.');
                callback(null);
                return;
            }
            var ext = extensions[tried];
            tried++;
            img.src = baseName + ext;
            img.onload = function() {
                log('Background loaded: ' + img.src);
                callback(img);
            };
            img.onerror = function() {
                tryNext();
            };
        }

        tryNext();
    }


    // == Menu Display ==
    function showMenu() {
        mode = 'menu';
        resetUI();
        if (ui.background) {
            var idx = jsmaf.root.children.indexOf(ui.background);
            if (idx > 0) {
                jsmaf.root.children.splice(idx, 1);
                jsmaf.root.children.unshift(ui.background);
            }
        }

        var cx = SCREEN_W / 2;
        var y = SCREEN_H / 2 - 30;

        ui.menu.push(addText('white', cx - 180, y, 'Press X to dump jsmaf'));
        ui.menu.push(addText('white', cx - 180, y + 60, 'Press O to restart'));
        ui.menu.push(addText('small', 20, SCREEN_H - 40, 'Dump path: ' + DUMP_PATH));
    }


    // == Object traversal ==
    function makePath(parentPath, key) {
        if (key === '__proto__') return null;
        if (!parentPath) return String(key);
        return parentPath + '.' + String(key);
    }

    function normalizePathForLookup(path) {
        if (!path) return [];
        var parts = String(path).split('.');
        var out = [];
        for (var i = 0; i < parts.length; i++) {
            if (parts[i] !== '') out.push(parts[i]);
        }
        return out;
    }

    function resolvePath(root, path) {
        var parts = normalizePathForLookup(path);
        var current = root;
        for (var i = 0; i < parts.length; i++) {
            if (current === null || current === undefined) return undefined;
            var part = parts[i];
            if (i === 0 && part === 'jsmaf') {
                current = root;
                continue;
            }
            if (part === '__proto__') return undefined;
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
        if (depth > MAX_DEPTH) {
            results.push({ path: rootPath, type: 'depth_limit' });
            return;
        }
        if (rootObj === null) {
            results.push({ path: rootPath, type: 'null', value: null });
            return;
        }
        var vt = typeof rootObj;
        if (vt !== 'object' && vt !== 'function') {
            results.push({ path: rootPath, type: vt, value: rootObj });
            return;
        }
        if (isVisited(visited, rootObj)) {
            results.push({ path: rootPath, type: 'circular' });
            return;
        }
        markVisited(visited, rootObj);

        var props;
        try {
            props = Object.getOwnPropertyNames(rootObj);
        } catch (e0) {
            results.push({ path: rootPath, type: 'error', error: e0.message });
            return;
        }

        for (var i = 0; i < props.length; i++) {
            var key = props[i];
            if (key === '__proto__') continue;

            var fullPath = makePath(rootPath, key);
            if (!fullPath) continue;

            try {
                var val = rootObj[key];
                var valType = typeOfValue(val);

                if (valType === 'object') {
                    var entry = { path: fullPath, type: 'object' };
                    results.push(entry);
                    if (val !== null) {
                        dumpObject(val, fullPath, visited, results, depth + 1);
                    } else {
                        results.push({ path: fullPath, type: 'null', value: null });
                    }
                } else if (valType === 'function') {
                    results.push({
                        path: fullPath,
                        type: 'function',
                        name: val.name || '',
                        arity: typeof val.length === 'number' ? val.length : null
                    });
                } else {
                    var entry2 = { path: fullPath, type: valType };
                    if (isPrimitive(val)) entry2.value = val;
                    results.push(entry2);
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
        } catch (e2) { /* ignore */ }
    }


    // == File writing ==
    function writeFile(path, content, cb) {
        try {
            var XHR = (typeof jsmaf !== 'undefined' && jsmaf.XMLHttpRequest) ? jsmaf.XMLHttpRequest : XMLHttpRequest;
            var xhr = new XHR();
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4 && cb) {
                    var ok = (xhr.status === 0 || xhr.status === 200 || xhr.status === 201 || xhr.status === 204);
                    cb(ok ? null : new Error('write failed, status=' + xhr.status));
                }
            };
            xhr.open('POST', fileUrl(path), true);
            xhr.send(content);
        } catch (e) {
            if (cb) cb(e);
        }
    }


    // == Dump execution ==
    function performDump() {
        mode = 'dump';
        resetUI();
        showStatus('Dumping jsmaf object...', 'yellow', SCREEN_H / 2);
        log('Dump started');

        var results = [];
        var visited = [];

        try {
            if (typeof jsmaf === 'undefined') throw new Error('jsmaf is not available');
            dumpObject(jsmaf, 'jsmaf', visited, results, 0);
        } catch (e) {
            showError('Dump failed: ' + e.message);
            log('Dump error: ' + e);
            setTimeout(function() { showMenu(); }, 2000);
            return;
        }

        writeFile(DUMP_PATH, JSON.stringify(results, null, 2), function(err) {
            if (ui.status) ui.status.visible = false;

            if (err) {
                showError('Write failed: ' + err.message);
                log('Write error: ' + err);
                setTimeout(function() { showMenu(); }, 2000);
                return;
            }

            ui.status = addText('green', SCREEN_W / 2 - 150, SCREEN_H / 2,
                'Dump complete: ' + results.length + ' entries');
            log('Dump written successfully: ' + results.length + ' entries');
            setTimeout(function() {
                if (ui.status) ui.status.visible = false;
                showMenu();
            }, 2000);
        });
    }


    // == Input handling ==
    jsmaf.onkeydown = function(keyCode) {
        log('Key: ' + keyCode + ' in mode: ' + mode);

        if (keyCode === 13) {
            restartVue();
            return;
        }

        if (mode === 'menu') {
            if (keyCode === 14 && !dumpStarted) {
                dumpStarted = true;
                performDump();
            }
        }
    };

    // == Initialization ==
    loadBackgroundImage(function(bgImage) {
        if (bgImage) {
            ui.background = bgImage;
            jsmaf.root.children.push(bgImage);
        }
        showMenu();
        log('DOOM Dumper loaded');
    });

})();
