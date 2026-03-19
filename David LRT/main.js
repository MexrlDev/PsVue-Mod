if (typeof libc_addr === 'undefined') {
    include('userland.js');
}
if (typeof lang === 'undefined') {
    include('languages.js');
}

(function () {
    log(lang.loadingMainMenu);

    var ROOT_DIR = 'file://../download0/themes/David LRT/';
    var DEFAULT_DIR = 'file://../download0/themes/default/';
    var DAVE_DIR = ROOT_DIR + 'Dave/';
    var BG_DIR = DAVE_DIR + 'Bg/';
    var CONZ_FILE = 'file://../download0/themes/David LRT/Dave/CONz/conz.json';
    var BG_BASE = 'multiview_bg_VAF';
    var BG_EXTS = ['png', 'jpg', 'jpeg'];

    var CONFIG = null;
    var themeFiles = [];
    var currentTheme = 0;
    var currentIndex = 0;
    var inThemeMenu = false;
    var themeMenuSnapshot = null;

    var menuItems = [];
    var cards = [];

    var bg = null;
    var heroImage = null;
    var heroTitle = null;
    var heroDesc = null;

    if (typeof jsmaf.bgm === 'undefined') jsmaf.bgm = null;

    function defaultState() {
        return {
            autolapse: false,
            autopoop: false,
            autoclose: false,
            music: true,
            jb_behavior: 0,
            bgFile: BG_BASE + '_1.png'
        };
    }

    function safeJSONParse(text, fallback) {
        try {
            return JSON.parse(text);
        } catch (e) {
            return fallback;
        }
    }

    function readConfigSync() {
        var state = defaultState();

        try {
            var xhr = new jsmaf.XMLHttpRequest();
            xhr.open('GET', CONZ_FILE, false);
            xhr.send();

            if (xhr.status === 0 || xhr.status === 200) {
                var loaded = safeJSONParse(xhr.responseText || '{}', {});
                for (var k in loaded) {
                    if (loaded[k] !== undefined) state[k] = loaded[k];
                }
            }
        } catch (e) {
            log('Config not found or unreadable, using defaults.');
        }

        if (typeof state.bgFile !== 'string' || !state.bgFile) {
            state.bgFile = BG_BASE + '_1.png';
        }

        return state;
    }

    function saveConfig() {
        if (!CONFIG) return;

        var out = {
            autolapse: CONFIG.autolapse || false,
            autopoop: CONFIG.autopoop || false,
            autoclose: CONFIG.autoclose || false,
            music: CONFIG.music !== false,
            jb_behavior: CONFIG.jb_behavior || 0,
            bgFile: CONFIG.bgFile || (themeFiles[0] || (BG_BASE + '_1.png'))
        };

        try {
            var xhr = new jsmaf.XMLHttpRequest();
            xhr.open('POST', CONZ_FILE, true);
            xhr.send(JSON.stringify(out, null, 4));
        } catch (e) {
            log('ERROR saving conz.json: ' + e.message);
            flashError();
        }
    }

    function isImageFile(name) {
        return /\.(png|jpe?g)$/i.test(String(name || ''));
    }

    function basenameNoExt(name) {
        return String(name || '').replace(/\.(png|jpe?g)$/i, '');
    }

    function naturalSort(a, b) {
        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    }

    function unique(list) {
        var out = [];
        var seen = {};
        for (var i = 0; i < list.length; i++) {
            var s = String(list[i] || '');
            if (!s || seen[s]) continue;
            seen[s] = true;
            out.push(s);
        }
        return out;
    }

    function scanBgFiles() {
        var files = [];

        try {
            fn.register(0x05, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
            fn.register(0x06, 'close_sys', ['bigint'], 'bigint');
            fn.register(0x110, 'getdents', ['bigint', 'bigint', 'bigint'], 'bigint');

            var path_addr = mem.malloc(256);
            var buf = mem.malloc(4096);

            var dir = '/download0/themes/David LRT/Dave/Bg';
            for (var i = 0; i < dir.length; i++) {
                mem.view(path_addr).setUint8(i, dir.charCodeAt(i));
            }
            mem.view(path_addr).setUint8(dir.length, 0);

            var fd = fn.open_sys(path_addr, new BigInt(0, 0), new BigInt(0, 0));
            if (!fd.eq(new BigInt(0xffffffff, 0xffffffff))) {
                var count = fn.getdents(fd, buf, new BigInt(0, 4096));

                if (!count.eq(new BigInt(0xffffffff, 0xffffffff)) && count.lo > 0) {
                    var offset = 0;

                    while (offset < count.lo) {
                        var d_reclen = mem.view(buf.add(new BigInt(0, offset + 4))).getUint16(0, true);
                        var d_type = mem.view(buf.add(new BigInt(0, offset + 6))).getUint8(0);
                        var d_namlen = mem.view(buf.add(new BigInt(0, offset + 7))).getUint8(0);

                        var name = '';
                        for (var j = 0; j < d_namlen; j++) {
                            name += String.fromCharCode(mem.view(buf.add(new BigInt(0, offset + 8 + j))).getUint8(0));
                        }

                        if (d_type === 8 && name !== '.' && name !== '..' && isImageFile(name)) {
                            if (name.indexOf(BG_BASE + '_') === 0) {
                                files.push(name);
                            }
                        }

                        offset += d_reclen;
                    }
                }

                fn.close_sys(fd);
            }
        } catch (e) {
            log('Theme scan failed: ' + e.message);
        }

        files = unique(files);
        files.sort(function (a, b) {
            var aa = basenameNoExt(a);
            var bb = basenameNoExt(b);
            var am = aa.match(/^multiview_bg_VAF_(\d+)$/i);
            var bm = bb.match(/^multiview_bg_VAF_(\d+)$/i);

            if (am && bm) return parseInt(am[1], 10) - parseInt(bm[1], 10);
            if (am) return -1;
            if (bm) return 1;
            return naturalSort(aa, bb);
        });

        return files;
    }

    function indexFromBgFile(fileName) {
        if (!themeFiles.length) return 0;

        for (var i = 0; i < themeFiles.length; i++) {
            if (themeFiles[i] === fileName) return i;
        }

        return 0;
    }

    function ensureValidBgFile() {
        if (!themeFiles.length) {
            themeFiles = [BG_BASE + '_1.png'];
        }

        var found = false;
        for (var i = 0; i < themeFiles.length; i++) {
            if (themeFiles[i] === CONFIG.bgFile) {
                found = true;
                break;
            }
        }

        if (!found) {
            CONFIG.bgFile = themeFiles[0];
        }
    }

    function currentBgUrl() {
        return BG_DIR + CONFIG.bgFile;
    }

    function setBgByOffset(delta) {
        if (!themeFiles.length) return;

        var idx = indexFromBgFile(CONFIG.bgFile);
        idx = (idx + delta + themeFiles.length) % themeFiles.length;

        CONFIG.bgFile = themeFiles[idx];
        if (bg) bg.url = currentBgUrl();
    }

    function refreshThemeState() {
        themeFiles = scanBgFiles();
        ensureValidBgFile();
        currentTheme = indexFromBgFile(CONFIG.bgFile);
    }

    function flashError() {
        if (!heroImage) return;

        var oldColor = heroImage.borderColor;
        var oldWidth = heroImage.borderWidth;

        heroImage.borderColor = 'red';
        heroImage.borderWidth = 5;

        jsmaf.setTimeout(function () {
            heroImage.borderColor = oldColor || 'white';
            heroImage.borderWidth = typeof oldWidth === 'number' ? oldWidth : 3;
        }, 220);
    }

    function createBgm() {
        try {
            jsmaf.bgm = new jsmaf.AudioClip();
            try { jsmaf.bgm.volume = 0.5; } catch (e) {}

            if (typeof jsmaf.bgm.open === 'function') {
                try {
                    jsmaf.bgm.open(DAVE_DIR + 'sfx/bgm.wav');
                    jsmaf.bgm.opened = true;
                } catch (e2) {
                    jsmaf.bgm.opened = false;
                }
            }
        } catch (e3) {
        }
    }

    function tryPlayBgm(retries) {
        retries = retries || 0;
        if (retries > 8) return;

        try {
            if (!jsmaf.bgm) createBgm();
            var _bgm = jsmaf.bgm;
            if (!_bgm) return;

            if (typeof _bgm.stop === 'function') {
                try { _bgm.stop(); } catch (e) {}
            }

            if (typeof _bgm.play === 'function') {
                try {
                    _bgm.play(true);
                    return;
                } catch (e2) {
                }
            }
        } catch (e3) {
        }

        jsmaf.setTimeout(function () {
            tryPlayBgm(retries + 1);
        }, 150);
    }

    function applyMusicSetting() {
        if (!CONFIG) return;

        try {
            if (!CONFIG.music) {
                if (jsmaf.bgm) {
                    try { if (typeof jsmaf.bgm.stop === 'function') jsmaf.bgm.stop(); } catch (e) {}
                    try { if (typeof jsmaf.bgm.close === 'function') jsmaf.bgm.close(); } catch (e) {}
                    try { jsmaf.bgm.opened = false; } catch (e) {}
                }
                return;
            }

            if (!jsmaf.bgm || typeof jsmaf.bgm.play !== 'function') {
                createBgm();
            }

            tryPlayBgm(0);
        } catch (e2) {
        }
    }

    new Style({ name: 'menu', color: 'white', size: 28 });
    new Style({ name: 'menuSelected', color: 'rgb(255,215,0)', size: 32 });
    new Style({ name: 'title', color: 'white', size: 40 });
    new Style({ name: 'desc', color: 'rgb(220,220,220)', size: 22 });

    var assets = {
        logo: DAVE_DIR + 'logo.png',
        themesIcon: DAVE_DIR + 'themes.png',
        quitIcon: DAVE_DIR + 'quit.png',
        heroJB: DAVE_DIR + 'hero_jb.png',
        heroPayload: DAVE_DIR + 'bg_payload.png',
        heroConfig: DAVE_DIR + 'bg_config.png'
    };

    function resolveScriptPath(scriptName) {
        if (scriptName === 'loader.js') return 'file://../download0/loader.js';
        if (scriptName === 'payload_host.js') return ROOT_DIR + 'payload_host.js';
        if (scriptName === 'config_ui.js') return DEFAULT_DIR + 'config_ui.js';
        return ROOT_DIR + scriptName;
    }

    function cleanupAndExit() {
        if (jsmaf.bgm) {
            try { if (typeof jsmaf.bgm.stop === 'function') jsmaf.bgm.stop(); } catch (e) {}
            try { if (typeof jsmaf.bgm.close === 'function') jsmaf.bgm.close(); } catch (e) {}
        }

        saveConfig();

        try {
            include('includes/kill_vue.js');
        } catch (e) {
            jsmaf.exit();
        }
    }

    function launchScript(scriptName) {
        if (!scriptName) return;

        if (scriptName === 'EXIT') {
            cleanupAndExit();
            return;
        }

        try {
            include(resolveScriptPath(scriptName));
        } catch (e) {
            log('ERROR loading ' + scriptName + ': ' + e.message);
            if (heroDesc) heroDesc.text = 'Failed to load ' + scriptName;
            flashError();
        }
    }

    // ==================== BUILD ====================
    CONFIG = readConfigSync();
    themeFiles = scanBgFiles();
    ensureValidBgFile();
    currentTheme = indexFromBgFile(CONFIG.bgFile);

    jsmaf.root.children.length = 0;

    bg = new Image({
        url: currentBgUrl(),
        x: 0,
        y: 0,
        width: 1920,
        height: 1080
    });
    jsmaf.root.children.push(bg);

    var MENU_LEFT = 120;

    var logo = new Image({
        url: assets.logo,
        x: MENU_LEFT,
        y: 80,
        width: 420,
        height: 220
    });
    jsmaf.root.children.push(logo);

    var options = [
        { label: lang.jailbreak, hero: assets.heroJB, desc: 'Launch kernel exploit and initialize environment.', script: 'loader.js' },
        { label: lang.payloadMenu, hero: assets.heroPayload, desc: 'Load custom payloads and tools.', script: 'payload_host.js' },
        { label: lang.config, hero: assets.heroConfig, desc: 'System configuration and tweaks.', script: 'config_ui.js' },
        { label: 'Themes', hero: assets.themesIcon, desc: 'Change UI theme.', script: null },
        { label: lang.exit, hero: assets.quitIcon, desc: 'Exit application.', script: 'EXIT' }
    ];

    var menuStartY = 360;
    for (var i = 0; i < options.length; i++) {
        var txt = new jsmaf.Text();
        txt.text = options[i].label;
        txt.x = MENU_LEFT;
        txt.y = menuStartY + i * 80;
        txt.style = 'menu';
        menuItems.push(txt);
        jsmaf.root.children.push(txt);
    }

    heroImage = new Image({
        url: options[0].hero,
        x: 700,
        y: 250,
        width: 700,
        height: 420
    });
    heroImage.borderColor = 'white';
    heroImage.borderWidth = 3;
    jsmaf.root.children.push(heroImage);

    heroTitle = new jsmaf.Text();
    heroTitle.style = 'title';
    heroTitle.x = 700;
    heroTitle.y = 700;
    jsmaf.root.children.push(heroTitle);

    heroDesc = new jsmaf.Text();
    heroDesc.style = 'desc';
    heroDesc.x = 700;
    heroDesc.y = 750;
    jsmaf.root.children.push(heroDesc);

    var cardWidth = 160;
    var cardHeight = 90;

    for (var j = 0; j < options.length; j++) {
        var card = new Image({
            url: options[j].hero,
            width: cardWidth,
            height: cardHeight,
            alpha: 0.5
        });

        card.borderColor = 'white';
        card.borderWidth = 2;
        cards.push(card);
        jsmaf.root.children.push(card);
    }

    function updateCarousel() {
        var centerX = 1050;
        var baseY = 850;
        var spacing = 200;

        for (var i = 0; i < options.length; i++) {
            var offset = i - currentIndex;
            var scale = (i === currentIndex) ? 1.2 : 0.8;
            var alpha = (i === currentIndex) ? 1 : 0.4;

            cards[i].scaleX = scale;
            cards[i].scaleY = scale;
            cards[i].alpha = alpha;
            cards[i].x = centerX + offset * spacing - (cardWidth * scale) / 2;
            cards[i].y = baseY;
        }
    }

    function updateUI() {
        for (var i = 0; i < menuItems.length; i++) {
            if (i === currentIndex) {
                menuItems[i].style = 'menuSelected';
                menuItems[i].scaleX = 1.08;
                menuItems[i].scaleY = 1.08;
                menuItems[i].x = MENU_LEFT + 15;
                menuItems[i].alpha = 1;
            } else {
                menuItems[i].style = 'menu';
                menuItems[i].scaleX = 1.0;
                menuItems[i].scaleY = 1.0;
                menuItems[i].x = MENU_LEFT;
                menuItems[i].alpha = 0.6;
            }
        }

        heroImage.url = options[currentIndex].hero;
        heroTitle.text = options[currentIndex].label;
        heroDesc.text = options[currentIndex].desc;
        updateCarousel();
    }

    function enterThemeMenu() {
        refreshThemeState();
        themeMenuSnapshot = {
            bgFile: CONFIG.bgFile
        };

        inThemeMenu = true;
        heroTitle.text = 'Select Theme';
        heroDesc.text = 'Left/Right to change. Enter to save. Back to cancel.';
        bg.url = currentBgUrl();
    }

    function cancelThemeMenu() {
        if (themeMenuSnapshot && themeMenuSnapshot.bgFile) {
            CONFIG.bgFile = themeMenuSnapshot.bgFile;
            currentTheme = indexFromBgFile(CONFIG.bgFile);
            bg.url = currentBgUrl();
        }

        inThemeMenu = false;
        themeMenuSnapshot = null;
        updateUI();
    }

    function confirmThemeMenu() {
        saveConfig();
        inThemeMenu = false;
        themeMenuSnapshot = null;
        updateUI();
    }

    function changeTheme(delta) {
        if (!themeFiles.length) {
            flashError();
            return;
        }
        setBgByOffset(delta, false);
    }

    jsmaf.onKeyDown = function (k) {
        if (inThemeMenu) {
            if (k === 6 || k === 5) {
                changeTheme(1);
                return;
            }
            if (k === 4 || k === 7) {
                changeTheme(-1);
                return;
            }
            if (k === 14) {
                confirmThemeMenu();
                return;
            }
            if (k === 13) {
                cancelThemeMenu();
                return;
            }
            return;
        }

        if (k === 6 || k === 5) {
            currentIndex = (currentIndex + 1) % options.length;
            updateUI();
        } else if (k === 4 || k === 7) {
            currentIndex = (currentIndex - 1 + options.length) % options.length;
            updateUI();
        } else if (k === 14) {
            var selected = options[currentIndex];
            if (selected.label === 'Themes') {
                enterThemeMenu();
                return;
            }
            launchScript(selected.script);
        }
    };

    applyMusicSetting();
    updateUI();
    log(lang.mainMenuLoaded);
})();
