// PSN bypass hook - inject early to avoid timeouts
// By earthonion 
// from ArabPixel
(function () {
    // Hook psn.getAvailability to return "signedout" immediately
    if (typeof psn !== "undefined" && psn.getAvailability) {
        psn.getAvailability = function (callback) {
            if (callback) {
                callback("signedout", null);
            }
        };
    }
})();
