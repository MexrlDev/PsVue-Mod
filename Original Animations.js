(function() {
    // --- Global flag to stop all animations during exit ---------------------
    var __appExiting = false;

    // --- Animation state variables (must be populated before use) ----------
    // These arrays are expected to exist and contain the UI elements.
    // They are defined here for reference but should be set by the user.
    var buttons = [];           // Array of button Image objects
    var buttonTexts = [];       // Array of button Text or Image objects
    var buttonMarkers = [];     // Array of marker Image objects
    var valueTexts = [];        // Array of optional value Text objects
    var buttonOrigPos = [];     // Original {x, y} for each button
    var textOrigPos = [];       // Original {x, y} for each button text
    var markerOrigPos = [];     // Original {x, y} for each marker
    var idlePhases = [];        // Per‑button phase for idle animation

    // UI elements for background and logo
    var background = null;
    var logo = null;
    var logoIdle = { baseX: 0, baseY: 0 };   // Logo's original position

    // Button dimensions (used in scaling calculations)
    var buttonWidth = 400;       // Should match actual button width
    var buttonHeight = 80;       // Should match actual button height

    // --- Internal interval tracking -----------------------------------------
    var _intervals = [];
    var _markerPulseInterval = null;
    var _logoAnimInterval = null;
    var _buttonIdleInterval = null;
    var zoomInInterval = null;
    var zoomOutInterval = null;

    // Helper: safely set an interval and track it
    function _setInterval(fn, ms) {
        var id = jsmaf.setInterval(fn, ms);
        _intervals.push(id);
        return id;
    }

    // Helper: clear all tracked intervals and stop loops
    function _clearAllIntervals() {
        for (var i = 0; i < _intervals.length; i++) {
            try { jsmaf.clearInterval(_intervals[i]); } catch (e) {}
        }
        _intervals = [];
        if (_markerPulseInterval) {
            try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {}
            _markerPulseInterval = null;
        }
        if (_logoAnimInterval) {
            try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}
            _logoAnimInterval = null;
        }
        if (_buttonIdleInterval) {
            try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {}
            _buttonIdleInterval = null;
        }
        if (zoomInInterval) {
            try { jsmaf.clearInterval(zoomInInterval); } catch (e) {}
            zoomInInterval = null;
        }
        if (zoomOutInterval) {
            try { jsmaf.clearInterval(zoomOutInterval); } catch (e) {}
            zoomOutInterval = null;
        }
    }

    // --- Easing function (smooth in‑out) ------------------------------------
    // Maps a linear progress t [0,1] to a eased value using cosine.
    function easeInOut(t) {
        return (1 - Math.cos(t * Math.PI)) / 2;
    }

    // --- Generic property animation -----------------------------------------
    // Animates an object's properties from one set to another over duration.
    // obj      : the object to animate (e.g., Image, Text)
    // from     : starting property values (if null, current values are used)
    // to       : target property values
    // duration : animation time in milliseconds
    // onStep   : optional callback after each step
    // done     : optional callback when animation completes
    // Returns the interval ID (or null if exiting).
    function animate(obj, from, to, duration, onStep, done) {
        if (__appExiting) {
            if (done) try { done(); } catch (_) {}
            return null;
        }

        var elapsed = 0;
        var step = 16;   // ~60 fps
        var id = _setInterval(function() {
            if (__appExiting) {
                try { jsmaf.clearInterval(id); } catch (ee) {}
                if (done) try { done(); } catch (ee2) {}
                return;
            }
            elapsed += step;
            var t = Math.min(elapsed / duration, 1);
            var e = easeInOut(t);
            for (var k in to) {
                try {
                    var startVal = (from && from[k] !== undefined) ? from[k] : (obj[k] || 0);
                    obj[k] = startVal + (to[k] - startVal) * e;
                } catch (ex) {}
            }
            if (onStep) onStep(e);
            if (t >= 1) {
                try { jsmaf.clearInterval(id); } catch (e2) {}
                if (done) done();
            }
        }, step);
        return id;
    }

    // --- Button idle breathing loop -----------------------------------------
    // Continuously applies a gentle scale and vertical movement to all
    // non‑selected buttons. Selected button (currentButton) moves less.
    // Expects global arrays: buttons, buttonTexts, valueTexts, buttonOrigPos,
    // textOrigPos, and a variable `currentButton` (index of selected button).
    function startButtonIdleLoop() {
        try {
            if (_buttonIdleInterval) try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {}
            var phase = 0;
            _buttonIdleInterval = jsmaf.setInterval(function() {
                if (__appExiting) {
                    try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {}
                    _buttonIdleInterval = null;
                    return;
                }
                phase += 0.04;   // speed of the breathing
                for (var i = 0; i < buttons.length; i++) {
                    try {
                        var b = buttons[i];
                        var t = buttonTexts[i];
                        var v = valueTexts[i];
                        if (!b) continue;
                        var p = phase + i * 0.3;   // slight phase shift per button
                        var sx = 1 + Math.sin(p) * 0.02;   // horizontal stretch
                        var sy = 1 - Math.sin(p) * 0.02;   // vertical squash
                        var dy = Math.sin(p * 0.9) * 1.5;   // vertical drift

                        if (i !== currentButton) {
                            // Non‑selected button: full breathing
                            b.scaleX = sx;
                            b.scaleY = sy;
                            b.y = buttonOrigPos[i] ? buttonOrigPos[i].y + dy : b.y;
                            if (t) {
                                t.scaleX = sx;
                                t.scaleY = sy;
                                t.y = textOrigPos[i] ? textOrigPos[i].y + dy : t.y;
                                // adjust x to keep text centered relative to stretched button
                                t.x = textOrigPos[i] ? textOrigPos[i].x - buttonWidth * (sx - 1) / 2 : t.x;
                            }
                            if (v) {
                                v.scaleX = sx;
                                v.scaleY = sy;
                                v.y = buttonOrigPos[i] ? buttonOrigPos[i].y + 20 + dy : v.y;
                                v.x = buttonOrigPos[i] ? buttonOrigPos[i].x + 320 - buttonWidth * (sx - 1) / 2 : v.x;
                            }
                        } else {
                            // Selected button: very subtle movement
                            b.scaleX = 1 + Math.sin(p) * 0.01;
                            b.scaleY = 1 - Math.sin(p) * 0.01;
                            b.x = buttonOrigPos[i] ? buttonOrigPos[i].x : b.x;
                            b.y = buttonOrigPos[i] ? buttonOrigPos[i].y : b.y;
                            if (t) {
                                t.scaleX = b.scaleX;
                                t.scaleY = b.scaleY;
                                t.x = textOrigPos[i] ? textOrigPos[i].x : t.x;
                                t.y = textOrigPos[i] ? textOrigPos[i].y : t.y;
                            }
                            if (v) {
                                v.scaleX = b.scaleX;
                                v.scaleY = b.scaleY;
                                v.x = buttonOrigPos[i] ? buttonOrigPos[i].x + 320 : v.x;
                                v.y = buttonOrigPos[i] ? buttonOrigPos[i].y + 20 : v.y;
                            }
                        }
                    } catch (e) {}
                }
            }, 16);   // ~60 fps
            _intervals.push(_buttonIdleInterval);
        } catch (e) {}
    }

    // Stop the idle loop (used before reloading animations)
    function stopButtonIdleLoop() {
        if (_buttonIdleInterval) {
            try { jsmaf.clearInterval(_buttonIdleInterval); } catch (e) {}
            _buttonIdleInterval = null;
        }
    }

    // --- Orange marker pulse loop -------------------------------------------
    // Makes markers (assumed to have URL containing 'ad_pod_marker') pulse
    // in alpha and scale. They are only visible when the button is selected.
    function startOrangeDotLoop() {
        if (_markerPulseInterval) try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {}
        var phase = 0;
        _markerPulseInterval = jsmaf.setInterval(function() {
            if (__appExiting) {
                try { jsmaf.clearInterval(_markerPulseInterval); } catch (e) {}
                _markerPulseInterval = null;
                return;
            }
            phase += 0.06;
            for (var i = 0; i < buttonMarkers.length; i++) {
                var m = buttonMarkers[i];
                if (!m) continue;
                // Identify orange dot markers (adjust condition as needed)
                if (m.isOrangeDot || (m.url && m.url.indexOf('ad_pod_marker') !== -1)) {
                    if (m.visible) {
                        var a = 0.6 + Math.sin(phase) * 0.35;   // alpha between 0.25 and 0.95
                        m.alpha = Math.max(0.25, Math.min(a, 1.0));
                        m.scaleX = 1 + Math.sin(phase * 1.2) * 0.06;
                        m.scaleY = m.scaleX;
                    } else {
                        m.alpha = 0;
                        m.scaleX = 1;
                        m.scaleY = 1;
                    }
                }
            }
        }, 16);
        _intervals.push(_markerPulseInterval);
    }

    // --- Logo gentle animation loop -----------------------------------------
    // Makes the logo float up/down and scale slightly; also moves the
    // background horizontally for a parallax effect.
    function startLogoLoop() {
        var phase = 0;
        if (_logoAnimInterval) try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}
        _logoAnimInterval = jsmaf.setInterval(function() {
            if (__appExiting) {
                try { jsmaf.clearInterval(_logoAnimInterval); } catch (e) {}
                _logoAnimInterval = null;
                return;
            }
            phase += 0.02;
            try {
                if (logo) {
                    logo.y = logoIdle.baseY + Math.sin(phase) * 4;
                    logo.scaleX = 0.99 + Math.sin(phase * 0.9) * 0.01;
                    logo.scaleY = logo.scaleX;
                }
                if (background) {
                    background.x = (background._baseX || 0) + Math.sin(phase * 0.4) * 6;
                }
            } catch (e) {}
        }, 16);
        _intervals.push(_logoAnimInterval);
    }

    // --- Zoom‑in animation (when button becomes selected) -------------------
    // Squashes the button horizontally, stretches vertically, and then
    // settles with a small overshoot. Called when highlight changes.
    function animateZoomIn(btn, text, btnOrigX, btnOrigY, textOrigX, textOrigY, valueObj) {
        if (zoomInInterval) try { jsmaf.clearInterval(zoomInInterval); } catch (e) {}
        if (__appExiting) return;
        var btnW = buttonWidth;
        var btnH = buttonHeight;
        var startScale = btn.scaleX || 1.0;
        var endScaleX = 1.12;    // stretch horizontally
        var endScaleY = 0.92;    // squash vertically
        var duration = 180;
        var elapsed = 0;
        var step = 16;
        var origX = btnOrigX;
        var origY = btnOrigY;
        var tOrigX = textOrigX;
        var tOrigY = textOrigY;

        zoomInInterval = jsmaf.setInterval(function() {
            if (__appExiting) {
                try { jsmaf.clearInterval(zoomInInterval); } catch (e) {}
                zoomInInterval = null;
                return;
            }
            elapsed += step;
            var t = Math.min(elapsed / duration, 1);
            var eased = easeInOut(t);
            var sx = startScale + (endScaleX - startScale) * eased;
            var sy = startScale + (endScaleY - startScale) * eased;
            btn.scaleX = sx;
            btn.scaleY = sy;
            btn.x = origX - btnW * (sx - 1) / 2;
            btn.y = origY - btnH * (sy - 1) / 2;
            if (text) {
                text.scaleX = sx;
                text.scaleY = sy;
                text.x = tOrigX - btnW * (sx - 1) / 2;
                text.y = tOrigY - btnH * (sy - 1) / 2;
            }
            if (t >= 1) {
                try { jsmaf.clearInterval(zoomInInterval); } catch (ex) {}
                zoomInInterval = null;
                // After main squash, do a small overshoot and settle
                animate(btn, { scaleX: endScaleX, scaleY: endScaleY }, { scaleX: 1.04, scaleY: 0.98 }, 120, null, function() {
                    animate(btn, { scaleX: 1.04, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 120);
                });
                if (text) {
                    animate(text, { scaleX: endScaleX, scaleY: endScaleY }, { scaleX: 1.04, scaleY: 0.98 }, 120, null, function() {
                        animate(text, { scaleX: 1.04, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 120);
                    });
                }
            }
        }, step);
    }

    // --- Zoom‑out animation (when button loses selection) -------------------
    // Smoothly returns the button to its normal scale.
    function animateZoomOut(btn, text, btnOrigX, btnOrigY, textOrigX, textOrigY, valueObj) {
        if (zoomOutInterval) try { jsmaf.clearInterval(zoomOutInterval); } catch (e) {}
        if (__appExiting) return;
        var btnW = buttonWidth;
        var btnH = buttonHeight;
        var startScaleX = btn.scaleX || 1.0;
        var startScaleY = btn.scaleY || 1.0;
        var endScaleX = 1.0;
        var endScaleY = 1.0;
        var duration = 160;
        var elapsed = 0;
        var step = 16;
        var origX = btnOrigX;
        var origY = btnOrigY;
        var tOrigX = textOrigX;
        var tOrigY = textOrigY;

        zoomOutInterval = jsmaf.setInterval(function() {
            if (__appExiting) {
                try { jsmaf.clearInterval(zoomOutInterval); } catch (e) {}
                zoomOutInterval = null;
                return;
            }
            elapsed += step;
            var t = Math.min(elapsed / duration, 1);
            var eased = easeInOut(t);
            var sx = startScaleX + (endScaleX - startScaleX) * eased;
            var sy = startScaleY + (endScaleY - startScaleY) * eased;
            btn.scaleX = sx;
            btn.scaleY = sy;
            btn.x = origX - btnW * (sx - 1) / 2;
            btn.y = origY - btnH * (sy - 1) / 2;
            if (text) {
                text.scaleX = sx;
                text.scaleY = sy;
                text.x = tOrigX - btnW * (sx - 1) / 2;
                text.y = tOrigY - btnH * (sy - 1) / 2;
            }
            if (t >= 1) {
                try { jsmaf.clearInterval(zoomOutInterval); } catch (ex) {}
                zoomOutInterval = null;
            }
        }, step);
    }

    // --- Click animation (when button is pressed) ---------------------------
    // Shrinks the button, then overshoots and settles back to normal.
    // Plays a click sound if available.
    function animateClick(btn, txt, btnOrigX, btnOrigY, textOrigX, textOrigY, valueObj, done) {
        if (__appExiting) {
            if (done) try { done(); } catch (_) {}
            return;
        }
        // Optional: play click sound
        try {
            if (typeof clickSfx !== 'undefined' && clickSfx && typeof clickSfx.play === 'function')
                clickSfx.play();
        } catch (e) {}

        // Button animation
        animate(btn, { scaleX: btn.scaleX || 1.0, scaleY: btn.scaleY || 1.0 }, { scaleX: 0.92, scaleY: 0.92 }, 80, null, function() {
            animate(btn, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140, null, function() {
                animate(btn, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120, null, function() {
                    if (done) done();
                });
            });
        });

        // Text animation (simultaneous, using timeouts)
        if (txt) {
            animate(txt, { scaleX: txt.scaleX || 1.0, scaleY: txt.scaleY || 1.0 }, { scaleX: 0.92, scaleY: 0.92 }, 80);
            jsmaf.setTimeout(function() {
                if (__appExiting) return;
                animate(txt, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140);
                jsmaf.setTimeout(function() {
                    if (!__appExiting) animate(txt, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120);
                }, 140);
            }, 80);
        }

        // Optional value text animation
        if (valueObj) {
            animate(valueObj, { scaleX: valueObj.scaleX || 1.0, scaleY: valueObj.scaleY || 1.0 }, { scaleX: 0.92, scaleY: 0.92 }, 80);
            jsmaf.setTimeout(function() {
                if (__appExiting) return;
                animate(valueObj, { scaleX: 0.92, scaleY: 0.92 }, { scaleX: 1.06, scaleY: 1.06 }, 140);
                jsmaf.setTimeout(function() {
                    if (!__appExiting) animate(valueObj, { scaleX: 1.06, scaleY: 1.06 }, { scaleX: 1.0, scaleY: 1.0 }, 120);
                }, 140);
            }, 80);
        }
    }

    // --- Entrance animation (initial appearance) ----------------------------
    // Fades in background and logo, then each button flies in with a
    // squash‑and‑stretch effect. After all buttons have entered, starts
    // the idle loops (marker pulse, logo float, button breathing).
    function entrance() {
        // Fade in background and logo
        try {
            animate(background, { alpha: background.alpha || 0 }, { alpha: 1 }, 800);
            animate(logo, { alpha: logo.alpha || 0, scaleX: logo.scaleX || 0.95, scaleY: logo.scaleY || 0.95 },
                          { alpha: 1, scaleX: 1.0, scaleY: 1.0 }, 900);
        } catch (e) {}

        var btnDelayBase = 220;   // first button delay
        var btnDelayStep = 140;   // delay increment per button
        var btnDuration = 1200;   // duration of the main fly‑in animation

        for (var idx = 0; idx < buttons.length; idx++) {
            (function(i) {
                var b = buttons[i];
                var t = buttonTexts[i];
                var m = buttonMarkers[i];
                var v = valueTexts[i];
                var delay = btnDelayBase + i * btnDelayStep;

                jsmaf.setTimeout(function() {
                    if (__appExiting) return;

                    // Set initial off‑screen/appearance state
                    try {
                        if (b) {
                            b.alpha = 0;
                            b.rotation = 360;            // spin in
                            b.scaleX = 0.6;
                            b.scaleY = 0.6;
                            b.y = buttonOrigPos[i].y + 40; // start lower
                        }
                        if (t) {
                            t.alpha = 0;
                            t.scaleX = 0.6;
                            t.scaleY = 0.6;
                            t.y = textOrigPos[i].y + 40;
                        }
                        if (v) {
                            v.alpha = v.alpha || 1;
                            v.scaleX = 0.6;
                            v.scaleY = 0.6;
                            v.y = buttonOrigPos[i].y + 20 + 40;
                            v.x = buttonOrigPos[i].x + 320;
                        }
                        if (m) {
                            var mo = { x: buttonOrigPos[i].x + buttonWidth - 50, y: buttonOrigPos[i].y + 35 };
                            markerOrigPos[i] = mo;
                            m.x = mo.x;
                            m.y = mo.y + 40;   // start lower
                        }
                    } catch (e) {}

                    // Animate button: fly in, spin, and bounce to final scale
                    animate(b, { alpha: 0, rotation: 360, y: buttonOrigPos[i].y + 40, scaleX: 0.6, scaleY: 0.6 },
                               { alpha: 1, rotation: 0, y: buttonOrigPos[i].y, scaleX: 1.08, scaleY: 0.92 },
                               btnDuration, null, function() {
                        // After main animation, do a small bounce settle
                        animate(b, { scaleX: 1.08, scaleY: 0.92 }, { scaleX: 0.96, scaleY: 1.06 }, 160, null, function() {
                            animate(b, { scaleX: 0.96, scaleY: 1.06 }, { scaleX: 1.02, scaleY: 0.98 }, 140, null, function() {
                                animate(b, { scaleX: 1.02, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 120);
                            });
                        });
                    });

                    // Animate text
                    animate(t, { alpha: 0, rotation: 360, y: textOrigPos[i].y + 40, scaleX: 0.6, scaleY: 0.6 },
                               { alpha: 1, rotation: 0, y: textOrigPos[i].y, scaleX: 1.02, scaleY: 0.98 },
                               btnDuration + 80, null, function() {
                        animate(t, { scaleX: 1.02, scaleY: 0.98 }, { scaleX: 1.0, scaleY: 1.0 }, 160);
                    });

                    // Animate optional value text
                    if (v) {
                        animate(v, { scaleX: 0.6, scaleY: 0.6, y: buttonOrigPos[i].y + 20 + 40 },
                                   { scaleX: 1.0, scaleY: 1.0, y: buttonOrigPos[i].y + 20 },
                                   btnDuration + 80);
                    }

                    // Animate marker
                    if (m) {
                        animate(m, { alpha: 0, y: markerOrigPos[i].y + 40 },
                                   { alpha: 1, y: markerOrigPos[i].y },
                                   btnDuration + 40);
                    }
                }, delay);
            })(idx);
        }

        // After the last button's animation, start the continuous loops
        var totalButtons = buttons.length;
        var lastDelay = btnDelayBase + (Math.max(0, totalButtons - 1)) * btnDelayStep;
        var startAfter = lastDelay + btnDuration + 600;

        jsmaf.setTimeout(function() {
            if (__appExiting) return;
            startOrangeDotLoop();
            startLogoLoop();
            startButtonIdleLoop();
        }, startAfter);
    }

    // --- Example usage ---------------------------------------
    /*
    // To use these animations, you must first create the UI elements
    // and populate the global arrays. Below is a minimal example.

    // Create background
    background = new Image({ url: 'bg.png', x: 0, y: 0, width: 1920, height: 1080 });
    background._baseX = background.x;
    jsmaf.root.children.push(background);

    // Create logo
    var centerX = 960;
    var logoWidth = 600;
    var logoHeight = 338;
    logo = new Image({ url: 'logo.png', x: centerX - logoWidth/2, y: 50, width: logoWidth, height: logoHeight });
    logoIdle.baseX = logo.x;
    logoIdle.baseY = logo.y;
    jsmaf.root.children.push(logo);

    // Create buttons (example with 4 buttons)
    var startY = 450;
    var buttonSpacing = 120;
    for (var i = 0; i < 4; i++) {
        var btnX = centerX - buttonWidth/2;
        var btnY = startY + i * buttonSpacing;
        var button = new Image({ url: 'button.png', x: btnX, y: btnY, width: buttonWidth, height: buttonHeight });
        buttons.push(button);
        jsmaf.root.children.push(button);

        var marker = new Image({ url: 'marker.png', x: btnX + buttonWidth - 50, y: btnY + 35, width: 12, height: 12, visible: false });
        buttonMarkers.push(marker);
        jsmaf.root.children.push(marker);

        var btnText = new jsmaf.Text();
        btnText.text = 'Option ' + (i+1);
        btnText.x = btnX + buttonWidth/2 - 60;
        btnText.y = btnY + buttonHeight/2 - 12;
        btnText.style = 'white';
        buttonTexts.push(btnText);
        jsmaf.root.children.push(btnText);

        buttonOrigPos.push({ x: btnX, y: btnY });
        textOrigPos.push({ x: btnText.x, y: btnText.y });
        idlePhases.push(Math.random() * Math.PI * 2);
        valueTexts.push(null);   // no extra value text
    }

    // Set initial selected button
    var currentButton = 0;

    // Start entrance animation
    entrance();

    // After a short delay, apply highlight (zoom in on current button)
    jsmaf.setTimeout(function() {
        // updateHighlight() would normally be called here; you need to
        // define it to call animateZoomIn/Out based on currentButton.
        // For simplicity, you can call animateZoomIn on the first button.
        if (buttons.length > 0) {
            animateZoomIn(buttons[0], buttonTexts[0], buttonOrigPos[0].x, buttonOrigPos[0].y,
                          textOrigPos[0].x, textOrigPos[0].y, valueTexts[0]);
        }
    }, 600);
    */

    // Export public functions if needed (optional)
    // You can attach them to a namespace if desired.
    window.animations = {
        entrance: entrance,
        startButtonIdleLoop: startButtonIdleLoop,
        startOrangeDotLoop: startOrangeDotLoop,
        startLogoLoop: startLogoLoop,
        animateZoomIn: animateZoomIn,
        animateZoomOut: animateZoomOut,
        animateClick: animateClick,
        stopAll: _clearAllIntervals
    };

})();
