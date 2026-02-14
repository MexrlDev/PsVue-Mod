(function () {

    'use strict';



    if (typeof jsmaf === 'undefined' || !jsmaf.root) {

        try { log('jsmaf not ready'); } catch(e){}

        return;

    }



    function suppressOverlays(durationMs) {



        var stopAt = Date.now() + (durationMs || 1000);



        var interval = jsmaf.setInterval(function () {

            try {



                var children = jsmaf.root.children;



                for (var i = 0; i < children.length; i++) {



                    var ch = children[i];

                    if (!ch || ch._overlaySuppressed) continue;



                    var w = ch.width  || 0;

                    var h = ch.height || 0;

                    var x = ch.x || 0;

                    var y = ch.y || 0;

                    var alpha = (typeof ch.alpha === 'number') ? ch.alpha : 1;



                    var centered =

                        Math.abs((x + w/2) - 960) < 260 &&

                        Math.abs((y + h/2) - 540) < 200;



                    var fullscreen = (w >= 1400 && h >= 700);



                    var bigCenteredBox =

                        centered &&

                        w >= 280 &&

                        h >= 150 &&

                        alpha >= 0.65;



                    if (fullscreen || bigCenteredBox) {

                        ch.visible = false;

                        ch._overlaySuppressed = true;

                    }

                }



            } catch (e) {}



            if (Date.now() >= stopAt) {

                try { jsmaf.clearInterval(interval); } catch(e){}

            }



        }, 40);

    }



    function loadUserland() {



        if (typeof libc_addr !== 'undefined') {

            return;

        }



        try {

            suppressOverlays(1200);

            include('userland.js');

        } catch (e) {

            try { log('userland include failed'); } catch(_){}

        }

    }



    function safeNotify(msg) {



        if (typeof utils !== 'undefined' &&

            typeof utils.notify === 'function') {



            utils.notify(msg);

        }

    }



    loadUserland();









    var texts = [

        'Ps2 . GTA SA',

        'Week-Ends .. Week-End',

        'Doesnt it reminds you of..\Ps4 ps2 theme?',

        'Playstation 2 \n PlayStation 2'

    ];







    var notifyBusy = false;







    function sendRandomOnce() {



        if (notifyBusy) return;



        notifyBusy = true;



        var msg = texts[Math.floor(Math.random() * texts.length)];



        safeNotify(msg);



        jsmaf.setTimeout(function () {

            notifyBusy = false;

        }, 1200);

    }









    sendRandomOnce();



})();

