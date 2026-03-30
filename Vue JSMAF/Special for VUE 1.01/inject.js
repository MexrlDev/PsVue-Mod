// Originally by ArabPixel and Earthonion

// https://github.com/ArabPixel/psvue-theming/


(function() {
    const THEME_FOLDER = "classic";

    // Helper to include files (catches errors if include() fails)
    function safeInclude(filePath) {
        try {
            include(filePath);
        } catch (e) {
            console.error(`[Theming] Failed to include ${filePath}:`, e);
        }
    }

    // 1. Load the bypass script (PSN related)
    safeInclude(`${THEME_FOLDER}/bypassPSN.js`);

    // 2. Set localStorage keys for compatibility with older code.
    //    Even though there's only one theme, we store a minimal list.
    localStorage.setItem("themes", JSON.stringify(["classic"]));
    localStorage.setItem("theme", "0");   // index 0 points to the only theme

    // 3. Load the main payload script
    safeInclude(`${THEME_FOLDER}/payloads.js`);
})();
