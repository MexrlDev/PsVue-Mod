# PlayStation Vue JSMAF Environment

Comprehensive Analysis of the Sony PlayStation Vue App Runtime

---

1. Introduction

The PlayStation Vue application for PS4 runs a custom JavaScript engine called JSMAF (version 2.13.2, build 2.13-e98b7be). Like the Netflix NRDP, it is not a standard web browser. There is no DOM, no document, and no window object. All rendering, input, networking, and storage are exposed through the jsmaf global object.

Sony’s own UI (menus, live TV, profiles) is written entirely atop this platform. Through the supplied source code and runtime dump, it is possible to build full‑featured applications, automation, game loaders, and even kernel‑level exploits that run inside the Vue app.

---

2. The Global Environment

2.1 JavaScript Runtime

· Engine: JavaScriptCore (not V8), ES5 with limited ES6 features (arrow functions, let, const, Map, Set, typed arrays, BigInt implementation present in custom exploit code).
· No browser APIs: No window, document, XMLHttpRequest (polyfilled by the JSMAF engine).
· Timers: jsmaf.setTimeout(callback, delay), jsmaf.clearTimeout(id), jsmaf.setInterval(callback, interval), jsmaf.clearInterval(id).
· Logging: jsmaf.print(msg) – simple text output (usually goes to the PS4 debug console).
· Alerts: jsmaf.alert(message) – displays a native dialog.

2.2 The jsmaf Global Object

Key sub‑objects:

Module Purpose
jsmaf.root Root display container (top‑level widget)
jsmaf.Image Constructor for image objects
jsmaf.Text Constructor for text objects
jsmaf.Style Reusable text style definition
jsmaf.Container Generic container (rarely used)
jsmaf.Video Video playback (unused in provided code)
jsmaf.AudioClip Audio playback
jsmaf.XMLHttpRequest HTTP client (also used for file:// I/O)
jsmaf.WebSocket WebSocket client
jsmaf.WebSocketServer WebSocket server (allows creating local websocket server)
jsmaf.User PSN user information (mostly dummy for offline)
jsmaf.location Script/location loader (similar to Netflix’s util.changeLocation)
jsmaf.Preload Resource preloader
jsmaf.onKeyDown, jsmaf.onKeyUp Input callbacks
jsmaf.screenWidth, jsmaf.screenHeight Display resolution (set to 1920×1080)
jsmaf.frameRate Target frame rate (60 FPS)
jsmaf.locale Current system locale (e.g. "en")
jsmaf.networkStatus "connected" or "disconnected"
jsmaf.platform "ps4"
jsmaf.exit() Exits the application

---

3. Core JSMAF Primitives

3.1 Display Hierarchy – jsmaf.root

The entire visual tree is a single flat array under jsmaf.root.children.

```js
var bg = new jsmaf.Image({
    url: 'file:///assets/img/bg.png',
    x: 0, y: 0,
    width: 1920, height: 1080
});
jsmaf.root.children.push(bg);
```

jsmaf.root supports the following properties (shared by all display objects):

Property Type Description
x, y number Position (pixels)
width number Display width (0 = auto)
height number Display height (0 = auto)
alpha number (0‑1) Opacity
scaleX, scaleY, scaleZ number Scale transforms
rotateX, rotateY, rotateZ number Rotation (degrees?)
visible boolean Show/hide
clip boolean Clip children to this object’s bounds
clipX, clipY, clipWidth, clipHeight number Clipping rectangle
children array Child objects (same type)
borderWidth, borderColor, borderImage styling Optional border

3.2 jsmaf.Image

```js
var img = new jsmaf.Image({
    url: 'file:///../download0/img/logo.png',
    x: 100, y: 50,
    width: 300, height: 169,
    visible: true
});
```

Supports onLoad/onload callback when the image finishes loading.
naturalWidth / naturalHeight give the original image dimensions.

3.3 jsmaf.Text

```js
var txt = new jsmaf.Text();
txt.text = "Hello PS4";
txt.style = "white";        // references a previously created jsmaf.Style
txt.x = 500; txt.y = 200;
```

Text properties:

· text : string
· style : name of a registered jsmaf.Style
· align : "left", "center", "right"
· baseline : vertical offset
· lineCount : read‑only number of lines
· lineClamp : maximum visible lines
· naturalWidth, naturalHeight : computed text size

3.4 jsmaf.Style

Styles are named objects that define text appearance. They are created globally and referenced by name.

```js
new jsmaf.Style({
    name: "white",
    color: "white",
    size: 24
});
new jsmaf.Style({
    name: "title",
    color: "white",
    size: 32
});
```

Supported properties:

· color : string (e.g. "white", "rgb(255,0,0)")
· size : font size (points)
· Additional properties may include align, italic, bold, etc. (not fully explored in given code).

3.5 Key Input

The PS4 controller is exposed through jsmaf.onKeyDown and jsmaf.onKeyUp. The callback receives a numeric key code:

```js
jsmaf.onKeyDown = function(keyCode) {
    if (keyCode === 14) {       // Cross (X)
        // action
    } else if (keyCode === 13) { // Circle (O)
        // back
    } else if (keyCode === 4) {  // D‑Pad Up
        // ...
    }
};
```

Key mapping (PS4):

Button Key Code
D‑Pad Up 4
D‑Pad Right 5
D‑Pad Down 6
D‑Pad Left 7
Cross (X) 14
Circle (O) 13
Triangle 12
Square 15
L1 10
R1 11
L2 8
R2 9
Options 3
L3 2
R3 1
Touchpad press 16

Stick movement: 55‑58 (left), 59‑62 (right)

---

3.6 Timers

```js
var id = jsmaf.setTimeout(function() { ... }, 1000);
jsmaf.clearTimeout(id);

var intervalId = jsmaf.setInterval(function() { ... }, 100);
jsmaf.clearInterval(intervalId);
```

3.7 Networking & File I/O

jsmaf.XMLHttpRequest mimics the browser interface but can also access local files via file:// URIs (restricted to the app’s sandbox).

```js
var xhr = new jsmaf.XMLHttpRequest();
xhr.open('GET', 'file://../download0/config.json', false);
xhr.send();
if (xhr.status === 0 || xhr.status === 200) {
    var data = JSON.parse(xhr.responseText);
}
```

This is the primary way to read/write persistent data inside the sandbox. Write operations are done via POST to file://../download0/ paths.

3.8 WebSocket & WebSocketServer

The app includes a built‑in WebSocket server! jsmaf.WebSocketServer allows creating a local server:

```js
var wss = new jsmaf.WebSocketServer(40404);
wss.onconnect = function(ws) {
    ws.onmessage = function(msg) { ... };
    ws.send("hello");
};
```

Client: new jsmaf.WebSocket("ws://127.0.0.1:40404").

3.9 Audio

```js
var clip = new jsmaf.AudioClip();
clip.load("file:///assets/sfx/bgm.wav");
clip.play();
clip.loop = true;
```

3.10 Include Mechanism

jsmaf.include(path) loads and immediately executes another JavaScript file. The path is relative to the app’s working directory.

```js
jsmaf.include('languages.js');
```

This is the standard way to split code into multiple files.

3.11 jsmaf.location – Script Loader

The jsmaf.location object is a sophisticated chain‑of‑responsibility loader that fetches and evaluates application scripts. It is set in index.js:

```js
jsmaf.location = gManifestURI;
```

When you assign a string to jsmaf.location, it:

1. Creates a handler chain that attempts to fetch the manifest.
2. Parses the manifest JSON (expected to have a scripts array).
3. Downloads each script (possibly from remote URLs or local file:// paths).
4. Evaluates them in the global scope.
5. Calls jsmaf.onLoadLocation(true/false) when finished.

Overriding the manifest is the simplest way to inject arbitrary code. By pointing jsmaf.location to a crafted local manifest file (like the dummy_psn.json.aes used in the jailbreak project), the entire app’s logic can be replaced.

The chain logic is implemented in location.js (see section 7 for full breakdown).

---

4. High‑Level UI Framework (from Runtime Dump)

The jsmaf environment provides only low‑level primitives. The attached loader.js, main.js, config_ui.js, and payload_host.js demonstrate a complete UI framework built on top:

· Scene management: jsmaf.root.children.length = 0 clears the screen.
· Widget helpers: Functions like animateZoomIn/Out for button hover effects using jsmaf.setInterval.
· Button abstraction: Array of Image + Text pairs managed with a currentButton index.
· Styling: Centralised jsmaf.Style declarations.
· Navigation: D‑Pad and Circle/Cross handlers.

This is the equivalent of Netflix’s error.js framework, but far simpler and sufficient for menu‑based payload selectors.

---

5. Building a Simple Application

Example: “Hello Vue” screen

```js
// Clear existing UI
jsmaf.root.children.length = 0;

// Create a style
new jsmaf.Style({ name: "big", color: "white", size: 48 });

// Background
var bg = new jsmaf.Image({
    url: 'file:///assets/img/multiview_bg.png',
    width: 1920, height: 1080
});
jsmaf.root.children.push(bg);

// Title
var title = new jsmaf.Text();
title.text = "Hello Vue!";
title.style = "big";
title.x = 960 - 150; title.y = 400;
jsmaf.root.children.push(title);

// Input
jsmaf.onKeyDown = function(keyCode) {
    if (keyCode === 14) {        // Cross
        jsmaf.alert("You pressed X!");
    } else if (keyCode === 13) { // Circle
        jsmaf.exit();
    }
};
```

---

6. File System & Persistence

The app has sandboxed storage at /download0/. You can:

· Read files: xhr.open('GET', 'file://../download0/filename', false)
· Write files: xhr.open('POST', 'file://../download0/filename', true); xhr.send(content);
· List directories (via kernel syscalls after exploit).

This is used by the updater to fetch the latest scripts from GitHub Pages and store them locally.

---

7. location.js – Deep Dive

The location.js file (included via jsmaf.include) defines the entire app loading pipeline. It implements a Chain of Responsibility pattern:

```
SystemCheck → PrefetchAuthCode → SetLocation → DownloadManifest → ParseManifest → DownloadScripts → EvaluateScripts → Complete → Error
```

Key classes (minimized names replaced in source):

· a = base handler l
· b = extendable handler
· v = network handler (extends base, adds fetch(), abort())
· Others for each step.

Manifest format:

```json
{
  "app_version": "1.29",
  "override": true,
  "scripts": [
    {
      "src": "file://../download0/serve.js.aes",
      "version": "1.0",
      "code": ""
    }
  ]
}
```

The DownloadScripts handler fetches each script and populates code. The EvaluateScripts handler calls (0,eval)(code) (or jsmaf.eval), effectively running arbitrary code.

To hijack the Vue app, you only need to place a crafted manifest (and your own scripts) in /download0/, then direct jsmaf.location to it (already done in the provided project via index.js).

---

8. The “Vue‑After‑Free” Project

The attached code is a complete jailbreak menu that runs inside the Vue app after a kernel exploit. It consists of:

File Purpose
index.js Bootstrap, sets up jsmaf.location to dummy manifest
location.js Script loader
dummy_psn.json.aes Fake manifest that redirects to serve.js.aes
serve.js.aes entry point
loader.js Post‑exploit payload that initiates lapse.js (jailbreak) and binloader.js (ELF loader)
lapse.js Kernel exploit to gain code execution
binloader.js Loads ELF payloads from USB/network
main.js Main jailbreak menu UI (Jailbreak, Payload Menu, Config, Exit)
config_ui.js Configuration screen (auto‑lapse, music, theme)
payload_host.js Payload selection screen
languages.js Localisation support
types.js, kernel.js, userland.js, defs.js Kernel exploit support
web-ui.js, ftp-server.js Network services

All menus use pure jsmaf API .. Image, Text, Style, onKeyDown, setInterval, XMLHttpRequest. They demonstrate how to build interactive UIs without any framework.

---

 9. In short…

Component Files Description
JSMAF Runtime All jsmaf.* properties from dump Core rendering, input, networking, storage
​location.js location.js Script loading chain; manifest fetching and evaluation
​index.js index.js App bootstrap, sets manifest URL
UI Examples main.js, config_ui.js, payload_host.js Full menu systems using jsmaf.Image/Text
Kernel Exploit lapse.js, netctrl_c0w_twins.js, kernel.js, types.js Gain kernel r/w via PS4 vulnerabilities
Payload Loader binloader.js Loads arbitrary ELF binaries after kernel access
File I/O config.json, updater.js Read/write configs and update scripts via XMLHttpRequest
Network Services web-ui.js, ftp-server.js Built‑in web server and FTP server inside the sandbox

---

10. Conclusion

The PlayStation Vue app’s JSMAF environment is a feature complete, standalone JavaScript runtime with direct access to 2D rendering, input, audio, networking, and file storage. By replacing the manifest and included scripts, an attacker (or developer) can take complete control over the app’s behaviour, turning it into a custom homebrew launcher, media player, or exploit delivery platform.

With the knowledge from this research combined with the provided source code you now have everything needed to build your own tools, games, or even a full fledged jailbreak menu inside the PlayStation Vue app.

---

11. Credit
this research based on [PsVue After Free Project](https://github.com/Vuemony/vue-after-free) and the [PsVue JSMAF Project](https://github.com/MexrlDev/PsVue-Mod/tree/main/Vue%20JSMAF) and the Playstation Vue itself in the source files that i decrypted from AES to .js.
