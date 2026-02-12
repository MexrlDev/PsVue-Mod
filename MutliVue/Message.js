// sends alert lol. from original vue. HAH

(function () {

    // --- First alert
    alert(
        "YEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEAAAAAAAAAAAAAAAAAAAHHHHHHHHHHHHHHHHHHHHHBBBBBBBBBBBBBBBBBBBBOOOOOOOOOOOOOOOOOOOOOOOOOOYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY!!!"
    );

    // --- Second alert
    alert(
        "You did it! \n\nThe mod was installed successfully."
    );


    // ---  Userland load?
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

})();
