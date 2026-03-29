(function () {

  // ========== Stops BGM... only work with the default vue song haha ==========
    if (typeof stopBgm === 'function') {
    try { stopBgm(); } catch (e) {}
  }

  if (typeof startBgmIfEnabled !== 'undefined') {
    startBgmIfEnabled = function () {};
  }

  if (typeof bgmClip !== 'undefined' && bgmClip) {
    try {
      if (typeof bgmClip.stop === 'function') bgmClip.stop();
    } catch (e1) {}
    try {
      if (typeof bgmClip.close === 'function') bgmClip.close();
    } catch (e2) {}
    try {
      if (typeof bgmClip.mute === 'function') bgmClip.mute(true);
    } catch (e3) {}
    try {
      bgmClip.muted = true;
      bgmClip.volume = 0;
    } catch (e4) {}
    bgmClip = null;
  }
  
  // ========== Config ==========
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var LINES_PER_PAGE = 23;

  var config = [
    { path: "jsmaf.version", type: "string" },
    { path:"jsmaf.location.mHandlerChain.mSuccessor.mSuccessor.mSuccessor.mSuccessor.mSuccessor.mManifest.app_version", type: "string", info: "This_gets_the_save_file_version_haha_the_one_used_in_the_save_file_ofc_its_1.27_but_the_one_using_migh_be_less_or_more"},
    { path: "jsmaf.screenAspect", type: "number" },
    { path: "jsmaf.onKeyboardDown", type: "object" },
    { path: "jsmaf.connectionInfo", type: "object" }
  ];

  var lines = [];
  var scrollOffset = 0;

  var textView = null;
  var header = null;

  // ========== Root Fix ==========
  var ROOT = (typeof globalThis !== 'undefined') ? globalThis : this;

  // ========== Reset UI ==========
  if (jsmaf && jsmaf.root && jsmaf.root.children) {
    jsmaf.root.children.length = 0;
  }

  // ========== Styles ==========
  try {
    new Style({ name: 'white', color: 'white', size: 26 });
    new Style({ name: 'cyan', color: 'cyan', size: 20 });
  } catch (e) {}

  // ========== UI ==========
  header = new jsmaf.Text();
  header.style = 'cyan';
  header.x = 20;
  header.y = 20;
  header.text = 'JSMAF Tester';
  jsmaf.root.children.push(header);

  textView = new jsmaf.Text();
  textView.style = 'white';
  textView.x = 20;
  textView.y = 80;
  textView.text = '';
  jsmaf.root.children.push(textView);

  var hint = new jsmaf.Text();
  hint.style = 'white';
  hint.x = 20;
  hint.y = SCREEN_H - 50;
  hint.text = 'UP/DOWN = scroll | Circle = quit';
  jsmaf.root.children.push(hint);

  // ========== Helper ==========
  function getValueByPath(path) {
    try {
      var parts = path.split('.');
      var obj = ROOT;

      for (var i = 0; i < parts.length; i++) {
        if (obj == null) return undefined;
        obj = obj[parts[i]];
      }

      return obj;
    } catch (e) {
      return undefined;
    }
  }

  // ========== Data Builder ==========
  function buildLines() {
    lines = [];
    lines.push('JSMAF Tester Output');
    lines.push('------------------');

    config.forEach(function(item, idx) {
      var val = getValueByPath(item.path);
      var type = typeof val;
      var display;

      if (val === undefined) {
        display = 'undefined';
      } else if (type === 'function') {
        try {
          display = val();
        } catch (e) {
          display = '[function error: ' + e.message + ']';
        }
      } else if (type === 'object') {
        try {
          display = JSON.stringify(val);
        } catch (e) {
          display = '[object]';
        }
      } else {
        display = val;
      }

      lines.push('[' + idx + '] ' + item.path + ' -> ' + display + ' (' + type + ')');
    });
  }

  // ========== Render ==========
  function render() {
    var visible = [];
    var end = Math.min(scrollOffset + LINES_PER_PAGE, lines.length);

    for (var i = scrollOffset; i < end; i++) {
      visible.push(lines[i]);
    }

    textView.text = visible.join('\n');

    header.text =
      'JSMAF Tester (' +
      (scrollOffset + 1) + '-' + end +
      '/' + lines.length + ')';
  }

  function scroll(delta) {
    var max = Math.max(0, lines.length - LINES_PER_PAGE);
    scrollOffset += delta;

    if (scrollOffset < 0) scrollOffset = 0;
    if (scrollOffset > max) scrollOffset = max;

    render();
  }

  // ========== Init ==========
  buildLines();
  render();

  // ========== Controls ==========
  jsmaf.onKeyDown = function (key) {
    if (key === 4) scroll(-1);
    else if (key === 6) scroll(1);
    else if (key === 13) {
      buildLines();
      if (typeof debugging !== 'undefined' && debugging.restart) {
        debugging.restart();
      }
      scrollOffset = 0;
      render();
    }
  };

  jsmaf.setInterval(function(){}, 1000);

})();
