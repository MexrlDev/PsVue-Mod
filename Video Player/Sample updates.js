// Originally from Earthonion
// Modded and Remade by MexrlDev 
// Open source for everyone to use, learn from, and enjoy.

(function () {
  log('=== Local Video Server ===');

  if (typeof libc_addr === 'undefined') {
    include('userland.js');
  }

  // Register socket/syscall wrappers
  fn.register(97,  'socket',      ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(98,  'connect',     ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(104, 'bind',        ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(105, 'setsockopt',  ['bigint', 'bigint', 'bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(106, 'listen',      ['bigint', 'bigint'], 'bigint');
  fn.register(30,  'accept',      ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(32,  'getsockname', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(3,   'read_sys',    ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(4,   'write_sys',   ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(6,   'close_sys',   ['bigint'], 'bigint');
  fn.register(5,   'open_sys',    ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(93,  'select',      ['bigint', 'bigint', 'bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(134, 'shutdown',    ['bigint', 'bigint'], 'bigint');

  var socket_sys      = fn.socket;
  var bind_sys        = fn.bind;
  var setsockopt_sys  = fn.setsockopt;
  var listen_sys      = fn.listen;
  var accept_sys      = fn.accept;
  var getsockname_sys = fn.getsockname;
  var read_sys        = fn.read_sys;
  var write_sys       = fn.write_sys;
  var close_sys       = fn.close_sys;
  var open_sys        = fn.open_sys;
  var select_sys      = fn.select;
  var shutdown_sys    = fn.shutdown;

  var AF_INET     = 2;
  var SOCK_STREAM  = 1;
  var SOL_SOCKET   = 0xFFFF;
  var SO_REUSEADDR = 0x4;
  var O_RDONLY     = 0;

  // ===== VIDEO CONFIGURATION =====
  var VIDEO_BASE_NAME = 'Woah';
  var VIDEO_DIR = '/download0/payloads/vid';
  var PLAYLIST_FILE = VIDEO_BASE_NAME + '.m3u8';
  // ===============================

  function read_bigint(v) {
    return (v instanceof BigInt) ? v.lo : v;
  }

  function alloc_c_string(s) {
    var p = mem.malloc(s.length + 1);
    for (var i = 0; i < s.length; i++) {
      mem.view(p).setUint8(i, s.charCodeAt(i) & 0xFF);
    }
    mem.view(p).setUint8(s.length, 0);
    return p;
  }

  function write_buffer(fd, buf, len) {
    return write_sys(new BigInt(0, fd), buf, new BigInt(0, len));
  }

  function send_text(fd, status_line, content_type, body) {
    var headers =
      'HTTP/1.1 ' + status_line + '\r\n' +
      'Content-Type: ' + content_type + '\r\n' +
      'Access-Control-Allow-Origin: *\r\n' +
      'Connection: close\r\n' +
      '\r\n';

    var resp = headers + body;
    var buf = mem.malloc(resp.length);
    for (var i = 0; i < resp.length; i++) {
      mem.view(buf).setUint8(i, resp.charCodeAt(i) & 0xFF);
    }
    write_buffer(fd, buf, resp.length);
  }

  function send_headers(fd, status_line, content_type) {
    var headers =
      'HTTP/1.1 ' + status_line + '\r\n' +
      'Content-Type: ' + content_type + '\r\n' +
      'Access-Control-Allow-Origin: *\r\n' +
      'Connection: close\r\n' +
      '\r\n';

    var buf = mem.malloc(headers.length);
    for (var i = 0; i < headers.length; i++) {
      mem.view(buf).setUint8(i, headers.charCodeAt(i) & 0xFF);
    }
    write_buffer(fd, buf, headers.length);
  }

  function content_type_for(path) {
    var p = path.toLowerCase();
    if (p.indexOf('.m3u8') >= 0) return 'application/vnd.apple.mpegurl';
    if (p.indexOf('.ts') >= 0)   return 'video/mp2t';
    if (p.indexOf('.mp4') >= 0)  return 'video/mp4';
    if (p.indexOf('.mov') >= 0)  return 'video/quicktime';
    return 'application/octet-stream';
  }

  function normalize_request_path(path) {
    if (!path || path === '') return '/';
    var q = path.indexOf('?');
    if (q >= 0) path = path.substring(0, q);
    var h = path.indexOf('#');
    if (h >= 0) path = path.substring(0, h);
    return path;
  }

  function is_safe_path(path) {
    if (path.indexOf('..') >= 0) return false;
    if (path.indexOf('\\') >= 0) return false;
    return true;
  }

  function send_file(fd, filepath) {
    var path_buf = alloc_c_string(filepath);
    var file_fd = open_sys(path_buf, new BigInt(0, O_RDONLY), new BigInt(0, 0));

    if (read_bigint(file_fd) < 0) {
      log('Cannot open file: ' + filepath);
      send_text(fd, '404 Not Found', 'text/plain', 'Not Found');
      return;
    }

    send_headers(fd, '200 OK', content_type_for(filepath));

    // Stream in chunks so long videos / large segments do not get truncated.
    var chunk_size = 32768;
    var file_buf = mem.malloc(chunk_size);

    while (true) {
      var n = read_sys(file_fd, file_buf, new BigInt(0, chunk_size));
      var bytes_read = read_bigint(n);
      if (bytes_read <= 0) break;

      write_buffer(fd, file_buf, bytes_read);

      if (bytes_read < chunk_size) break;
    }

    close_sys(file_fd);
    log('Sent ' + filepath);
  }

  function get_path(buf, len) {
    var req = '';
    for (var i = 0; i < len && i < 2048; i++) {
      var c = mem.view(buf).getUint8(i);
      if (c === 0) break;
      req += String.fromCharCode(c);
    }

    var lines = req.split('\n');
    if (lines.length > 0) {
      var parts = lines[0].trim().split(' ');
      if (parts.length >= 2) return normalize_request_path(parts[1]);
    }
    return '/';
  }

  // Create server socket
  log('Creating HTTP server for video files...');
  var srv = socket_sys(new BigInt(0, AF_INET), new BigInt(0, SOCK_STREAM), new BigInt(0, 0));
  if (read_bigint(srv) < 0) throw new Error('Cannot create socket');

  // SO_REUSEADDR
  var optval = mem.malloc(4);
  mem.view(optval).setUint32(0, 1, true);
  setsockopt_sys(srv, new BigInt(0, SOL_SOCKET), new BigInt(0, SO_REUSEADDR), optval, new BigInt(0, 4));

  // Bind to port 0
  var addr = mem.malloc(16);
  mem.view(addr).setUint8(0, 16);
  mem.view(addr).setUint8(1, AF_INET);
  mem.view(addr).setUint16(2, 0, false);
  mem.view(addr).setUint32(4, 0, false);

  if (bind_sys(srv, addr, new BigInt(0, 16)).lo < 0) {
    close_sys(srv);
    throw new Error('Bind failed');
  }

  var actual_addr = mem.malloc(16);
  var actual_len = mem.malloc(4);
  mem.view(actual_len).setUint32(0, 16, true);
  getsockname_sys(srv, actual_addr, actual_len);
  var port = mem.view(actual_addr).getUint16(2, false);

  if (listen_sys(srv, new BigInt(0, 8)).lo < 0) {
    close_sys(srv);
    throw new Error('Listen failed');
  }

  log('HTTP server listening on port ' + port);

  var videoUrl = 'http://127.0.0.1:' + port + '/' + PLAYLIST_FILE;
  log('Video URL: ' + videoUrl);

  // UI setup
  jsmaf.root.children.length = 0;

  var video1 = new Video({
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    visible: true,
    autoplay: true
  });
  jsmaf.root.children.push(video1);

  var video2 = new Video({
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    visible: false,
    autoplay: false
  });
  jsmaf.root.children.push(video2);

  var currentVideo = video1;
  var nextVideo = video2;
  var preloadStarted = false;
  var requestCount = 0;
  var serverRunning = true;
  var restartPending = false;

  function setupVideoCallbacks(video, label) {
    video.onOpen = function () {
      log('Video ' + label + ' opened. Duration: ' + video.duration);
    };

    video.onerror = function (err) {
      log('Video error: ' + JSON.stringify(err));
    };

    video.onstatechange = function (state) {
      log('Video ' + label + ' state: ' + state);

      if (video === currentVideo && state === 'Ended') {
        log('Swapping to next video...');

        currentVideo.visible = false;
        nextVideo.visible = true;
        nextVideo.play();

        var tmp = currentVideo;
        currentVideo = nextVideo;
        nextVideo = tmp;
        preloadStarted = false;
      }
    };
  }

  setupVideoCallbacks(video1, 'current');
  setupVideoCallbacks(video2, 'next');

  // select() structures
  var readfds = mem.malloc(128);
  var timeout = mem.malloc(16);
  mem.view(timeout).setUint32(0, 0, true);
  mem.view(timeout).setUint32(4, 0, true);
  mem.view(timeout).setUint32(8, 0, true);
  mem.view(timeout).setUint32(12, 0, true);

  function serverLoop() {
    if (!serverRunning) return;

    for (var i = 0; i < 128; i++) {
      mem.view(readfds).setUint8(i, 0);
    }

    var fd = srv.lo;
    var byte_index = Math.floor(fd / 8);
    var bit_index = fd % 8;
    var current = mem.view(readfds).getUint8(byte_index);
    mem.view(readfds).setUint8(byte_index, current | (1 << bit_index));

    var nfds = fd + 1;
    var select_ret = select_sys(new BigInt(0, nfds), readfds, new BigInt(0, 0), new BigInt(0, 0), timeout);
    if (select_ret.lo <= 0) return;

    var client_addr = mem.malloc(16);
    var client_len = mem.malloc(4);
    mem.view(client_len).setUint32(0, 16, true);

    var client_ret = accept_sys(srv, client_addr, client_len);
    var client = read_bigint(client_ret);
    if (client < 0) return;

    requestCount++;

    var req_buf = mem.malloc(4096);
    var read_ret = read_sys(new BigInt(0, client), req_buf, new BigInt(0, 4096));
    var bytes = read_bigint(read_ret);

    if (bytes > 0) {
      var path = get_path(req_buf, bytes);
      log('Request #' + requestCount + ': ' + path);

      if (path === '/' || path === '') {
        send_text(client, '200 OK', 'text/plain', 'Video server running');
      } else {
        var safe_path = path.charAt(0) === '/' ? path.substring(1) : path;
        if (!is_safe_path(safe_path)) {
          send_text(client, '400 Bad Request', 'text/plain', 'Bad Request');
        } else {
          var full_path = VIDEO_DIR + '/' + safe_path;
          send_file(client, full_path);
        }
      }
    }

    close_sys(new BigInt(0, client));
  }

  jsmaf.onEnterFrame = function () {
    serverLoop();

    if (currentVideo.duration > 0 && currentVideo.elapsed > 0) {
      var threshold = currentVideo.duration * 0.80;
      if (!preloadStarted && currentVideo.elapsed >= threshold) {
        log('Preloading next video at ' + currentVideo.elapsed + ' ms');
        preloadStarted = true;
        nextVideo.open(videoUrl);
      }
    }
  };

  function restartApp() {
    if (restartPending) return;
    restartPending = true;

    log('Restarting application...');

    serverRunning = false;

    try { shutdown_sys(srv, new BigInt(0, 2)); } catch (e) {}
    try { close_sys(srv); } catch (e) {}

    try { currentVideo.close(); } catch (e) {}
    try { nextVideo.close(); } catch (e) {}

    jsmaf.onEnterFrame = null;
    jsmaf.onKeyDown = null;

    var safeSetTimeout = function (callback, delay) {
      if (typeof setTimeout !== 'undefined') {
        setTimeout(callback, delay);
      } else if (typeof jsmaf !== 'undefined' && jsmaf.setTimeout) {
        jsmaf.setTimeout(callback, delay);
      } else {
        callback();
      }
    };

    safeSetTimeout(function () {
      if (typeof debugging !== 'undefined' && debugging && typeof debugging.restart === 'function') {
        debugging.restart();
        return;
      }

      if (typeof jsmaf !== 'undefined' && jsmaf && typeof jsmaf.restart === 'function') {
        jsmaf.restart();
        return;
      }

      if (typeof location !== 'undefined' && location && typeof location.reload === 'function') {
        location.reload();
        return;
      }

      log('Restart method not available.');
    }, 100);
  }

  jsmaf.onKeyDown = function (keyCode) {
    if (keyCode === 13) {
      restartApp();
    }
  };

  log('Server ready.');
  log('Starting playback...');
  log('Video URL: ' + videoUrl);

  video1.open(videoUrl);
})();
