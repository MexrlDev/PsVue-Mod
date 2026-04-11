// PSN bypass hook - inject early to avoid timeouts
(function() {
    // Hook psn.getAvailability to return "signedout" immediately
    if (typeof psn !== "undefined" && psn.getAvailability) {
        psn.getAvailability = function(callback) {
            if (callback) {
                callback("signedout", null);
            }
        };
    }
})();

function log(msg) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "http://s3.amazonaws.com/_log", true);
    xhr.send(msg);
}

alert("YEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEAAAAAAAAAAAAAAAAAAAHHHHHHHHHHHHHHHHHHHHHBBBBBBBBBBBBBBBBBBBBOOOOOOOOOOOOOOOOOOOOOOOOOOYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY");

// Auto refresh after alert 2 seconds
setTimeout(function() {
    try {
        debugging.restart();
    } catch(e) {}
}, 2000);
