// Originally by ArabPixel and Earthonion
// https://github.com/ArabPixel/psvue-theming/

// Include the bypass
include("classic/bypassPSN.js");

// To load from classic folder
var themeName = "classic";

// Keep localStorage compatibility for any external scripts that might read "theme".
// If a previous theme index exists, it is ignored; we always load the classic theme.
localStorage.setItem("theme", "0");

localStorage.setItem("themes", JSON.stringify(["classic"]));

// Load the script
include("classic/" + themeName + "/payloads.js");
