// == Payload Launcher By MexrlDev ==


// Logging
function log(msg) {
    try {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "http://s3.amazonaws.com/_log", true);
        xhr.send(msg);
    } catch (e) { /* silent */ }
}

// Global setup
if (typeof jsmaf !== 'undefined' && jsmaf.root && jsmaf.root.children) {
    jsmaf.root.children.length = 0;
}

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


// == Payload Launcher Core ==
(function() {
    var SCREEN_W = 1920;
    var SCREEN_H = 1080;

    // Paths ans stuff..... yeah..
    var BASE_PATH = 'file://../download0/';
    var THEME_BASE = 'VueE/Y3ah/';
    var PAYLOADS_DIR = BASE_PATH + THEME_BASE + 'payloads/';
    var CONFIG_DIR = BASE_PATH + THEME_BASE + '/config/';
    var THEME_IMG_DIR = BASE_PATH + THEME_BASE + 'img/';
    var MANIFEST_PATH = CONFIG_DIR + 'manifest.json';
    var ASSETS_IMG_DIR = 'file://assets/img/';
	// Unused audio.. needs a research about bitrate
    var BGM_PATH = BASE_PATH + THEME_BASE + 'song/bgm.wav';


   // Payloads Path..
    var INCLUDE_BASE = THEME_BASE + 'payloads/';


    // == payloads config ==
    var DEFAULT_PAYLOADS = [
        'Dump-Vue.js',
        'dummy1.js',
        'dummy2.js',
        'dummy3.js',
        'dummy4.js',
        'dummy5.js',
        'dummy6.js'
    ];

    // UI state
    var payloadList = [];
    var selectedIndex = 0;
    var visibleItems = [];
    var background = null;
    var statusText = null;
    var headerTitle = null;
    var headerSubtitle = null;
    var footerElements = [];
    var statusTimeout = null;

    // Styles
    if (typeof Style !== 'undefined') {
        try {
            new Style({ name: 'title', color: '#ff4444', size: 48 });
            new Style({ name: 'subtitle', color: '#ff4444', size: 28 });
            new Style({ name: 'item', color: '#aaaaaa', size: 28 });
            new Style({ name: 'selected', color: 'white', size: 32 });
            new Style({ name: 'hint', color: 'rgba(255, 255, 255, 0.6)', size: 24 });
            new Style({ name: 'status', color: '#ffaa00', size: 22 });
        } catch (e) {}
    }


    // Helper to create text element
    function createText(style, x, y, text, align) {
        var t = new jsmaf.Text();
        t.style = style;
        t.x = x;
        t.y = y;
        t.width = (align === 'center') ? 1200 : 200;
        t.height = 40;
        t.text = text || '';
        t.background = 'rgba(0,0,0,0)';
        t.align = align || 'left';
        t.visible = true;
        return t;
    }


    // Helper to create image element
    function createImage(src, x, y, width, height) {
        var img = new jsmaf.Image();
        img.src = src;
        img.x = x;
        img.y = y;
        img.width = width;
        img.height = height;
        img.visible = true;
        return img;
    }


    // status pop up..
    function showStatus(msg, isError) {
        if (statusTimeout) {
            clearTimeout(statusTimeout);
            statusTimeout = null;
        }
        statusText.text = msg;
        statusText.style = isError ? 'red' : 'status';
        statusText.visible = true;
        statusTimeout = setTimeout(function() {
            statusText.visible = false;
            statusTimeout = null;
        }, 3000);
    }

    // Load background image
    function loadBackground(callback) {
        var exts = ['.png', '.jpg', '.jpeg'];
        var base = THEME_IMG_DIR + 'DOOM-RE';
        var idx = 0;
        var img = new jsmaf.Image();
        img.x = 0; img.y = 0;
        img.width = SCREEN_W; img.height = SCREEN_H;
        img.visible = true;

        function tryNext() {
            if (idx >= exts.length) {
                log('Background not found, using black');
                callback(null);
                return;
            }
            img.src = base + exts[idx++];
            img.onload = function() {
                callback(img);
            };
            img.onerror = tryNext;
        }
        tryNext();
    }


    // Load payload list...
    function loadPayloadList(callback) {
        var list = DEFAULT_PAYLOADS.slice();
        log('Using embedded payload list: ' + list.length + ' items');

        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 0 || xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        if (data && Array.isArray(data.payloads) && data.payloads.length > 0) {
                            list = data.payloads.map(function(name) {
                                return name.endsWith('.js') ? name : name + '.js';
                            });
                            log('Manifest loaded, overriding with ' + list.length + ' payloads');
                        }
                    } catch (e) {
                        log('Manifest parse error, keeping embedded list');
                    }
                } else {
                    log('No manifest found, using embedded list');
                }
                callback(list);
            }
        };
        xhr.open('GET', MANIFEST_PATH, true);
        xhr.send();
    }


    // Refresh payload list.. hidden option lol.. it's square
    function refreshPayloadList() {
        showStatus('Refreshing...');
        loadPayloadList(function(list) {
            payloadList = list;
            if (payloadList.length > 0) {
                selectedIndex = Math.min(selectedIndex, payloadList.length - 1);
                updateListDisplay();
                showStatus(payloadList.length + ' payloads loaded');
            } else {
                for (var i = 0; i < visibleItems.length; i++) {
                    visibleItems[i].visible = false;
                }
                showStatus('No payloads found.', true);
            }
            log('Refresh finished. Payloads: ' + payloadList.length);
        });
    }


    // Build footer
    function buildFooter() {
        var footerY = SCREEN_H - 60;
        
        var groups = [
            { type: 'stack', icon1: 'icon_up.png', icon2: 'icon_down.png', label: 'Navigate', iconW: 25, iconH: 36, gap: 15 },
            { type: 'single', icon: 'icon_cross.png', label: 'Launch', iconW: 33, iconH: 36, gap: 12 },
            { type: 'single', icon: 'icon_circle.png', label: 'Restart', iconW: 33, iconH: 36, gap: 12 }
        ];

        var totalWidth = 0;
        for (var i = 0; i < groups.length; i++) {
            var g = groups[i];
            if (g.type === 'stack') {
                totalWidth += g.iconW + g.gap + 100;
            } else {
                totalWidth += g.iconW + g.gap + 80;
            }
        }
        totalWidth += (groups.length - 1) * 60;

        var startX = (SCREEN_W - totalWidth) / 2;
        var currentX = startX;

        for (var i = 0; i < groups.length; i++) {
            var g = groups[i];
            if (g.type === 'stack') {
                var upIcon = createImage(ASSETS_IMG_DIR + g.icon1, currentX, footerY - 5, g.iconW, g.iconH);
                var downIcon = createImage(ASSETS_IMG_DIR + g.icon2, currentX, footerY + 18, g.iconW, g.iconH);
                jsmaf.root.children.push(upIcon, downIcon);
                
                var textX = currentX + g.iconW + g.gap;
                var navText = createText('hint', textX, footerY + 8, g.label);
                jsmaf.root.children.push(navText);
                
                currentX += g.iconW + g.gap + 110 + 60;
            } else {
                var icon = createImage(ASSETS_IMG_DIR + g.icon, currentX, footerY, g.iconW, g.iconH);
                jsmaf.root.children.push(icon);
                
                var textX = currentX + g.iconW + g.gap;
                var labelText = createText('hint', textX, footerY + 8, g.label);
                jsmaf.root.children.push(labelText);
                
                currentX += g.iconW + g.gap + 80 + 60;
            }
        }
    }


    // Build the list
    function buildListUI() {
        var centerY = SCREEN_H / 2;
        var spacing = 60;
        var baseY = centerY - 4 * spacing;

        for (var i = 0; i < 9; i++) {
            var y = baseY + i * spacing;
            var style = (i === 4) ? 'selected' : 'item';
            var txt = createText(style, SCREEN_W / 2, y, '', 'center');
            visibleItems.push(txt);
            jsmaf.root.children.push(txt);
        }

        headerTitle = createText('title', SCREEN_W / 2, 50, 'DOOM-RE PAYLOAD', 'center');
        jsmaf.root.children.push(headerTitle);
        headerSubtitle = createText('subtitle', SCREEN_W / 2, 120, 'LAUNCHER', 'center');
        jsmaf.root.children.push(headerSubtitle);

        buildFooter();

        statusText = createText('status', 30, SCREEN_H - 100, '', 'left');
        statusText.visible = false;
        jsmaf.root.children.push(statusText);
    }


    // Update list display based on selectedIndex
    function updateListDisplay() {
        if (payloadList.length === 0) {
            for (var i = 0; i < visibleItems.length; i++) {
                visibleItems[i].visible = false;
            }
            return;
        }
        var startIdx = selectedIndex - 4;
        for (var i = 0; i < 9; i++) {
            var idx = startIdx + i;
            if (idx >= 0 && idx < payloadList.length) {
                var name = payloadList[idx];
                var displayName = name.replace(/\.js$/i, '');
                visibleItems[i].text = displayName;
                visibleItems[i].style = (i === 4) ? 'selected' : 'item';
                visibleItems[i].visible = true;
            } else {
                visibleItems[i].visible = false;
            }
        }
    }


    // Execute selected payload
     function launchPayload() {
        if (payloadList.length === 0) return;
        var filename = payloadList[selectedIndex];
        var includePath = INCLUDE_BASE + filename;
        showStatus('Running: ' + filename + '...');
        log('Including: ' + includePath);

        try {
            include(includePath);
            showStatus('Payload executed: ' + filename);
            log('include() successful');
        } catch (e) {
            showStatus('Include failed: ' + (e.message || e), true);
            log('Include error: ' + e);
        }
    }


    // Background music - still searching for the best bitrate..
    function startMusic() {
        try {
            if (typeof jsmaf.bgm === 'undefined') {
                jsmaf.bgm = new jsmaf.AudioClip();
                jsmaf.bgm.volume = 0.5;
                jsmaf.bgm.open(BGM_PATH);
                log('BGM initialized');
            }
            var bgm = jsmaf.bgm;
            bgm.play(true);
            log('BGM started');
        } catch (e) {
            log('BGM error: ' + e);
        }
    }

   // Key handling
    jsmaf.onkeydown = function(keyCode) {
        if (keyCode === 13) {
            restartVue();
            return;
        }

        if (keyCode === 15) {
            refreshPayloadList();
            return;
        }

        if (payloadList.length === 0) return;

        if (keyCode === 4) {
            if (selectedIndex > 0) {
                selectedIndex--;
            } else {
                selectedIndex = payloadList.length - 1;
            }
            updateListDisplay();
        } else if (keyCode === 6) {
            if (selectedIndex < payloadList.length - 1) {
                selectedIndex++;
            } else {
                selectedIndex = 0;
            }
            updateListDisplay();
        } else if (keyCode === 14) {
            launchPayload();
        }
    };


    // Initialization 
    loadBackground(function(bgImg) {
        if (bgImg) {
            background = bgImg;
            jsmaf.root.children.push(bgImg);
        }

        buildListUI();
        startMusic();

        showStatus('Loading payload list...');

        loadPayloadList(function(list) {
            payloadList = list;
            if (payloadList.length > 0) {
                selectedIndex = 0;
                updateListDisplay();
                showStatus(payloadList.length + ' payloads loaded');
            } else {
                showStatus('No payloads found. Edit DEFAULT_PAYLOADS array.', true);
            }
            log('Payload launcher ready. ' + payloadList.length + ' payloads.');
        });
    });

})();
