// Originally from Earthonion
// Modded and Remade by MexrlDev
// Open source for everyone to use, learn from, and enjoy.

(function () {
  log('=== Ultimate Local Video Server ===');

  if (typeof stopBgm === 'function') {
    try { stopBgm(); } catch (e) {}
  }

  if (typeof libc_addr === 'undefined') {
    include('userland.js');
  }

  // Syscall wrappers
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

  var AF_INET      = 2;
  var SOCK_STREAM  = 1;
  var SOL_SOCKET   = 0xFFFF;
  var SO_REUSEADDR = 0x4;
  var O_RDONLY     = 0;

  // ===== CONFIGURATION =====
  var VIDEO_BASE_NAME = 'Work';
  var VIDEO_DIR = '/download0/payloads/vid';
  var SCREEN_W = 1920;
  var SCREEN_H = 1080;
  var CHUNK_SIZE = 262144;          // 256KB – optimal for high‑bitrate streams
  var WATCHDOG_INTERVAL = 5000;     // check video state every 5 seconds
  // =========================

  // ----- Helper functions -----
  function read_bigint(v) {
    if (v === null || v === undefined) return -1;
    if (typeof v === 'number') return v;
    if (typeof v === 'bigint') return Number(v);
    if (typeof v.lo !== 'undefined') return v.lo;
    return Number(v);
  }

  function safeFree(p) {
    try {
      if (p && typeof mem !== 'undefined' && mem && typeof mem.free === 'function') {
        mem.free(p);
      }
    } catch (e) {}
  }

  function alloc_c_string(s) {
    var p = mem.malloc(s.length + 1);
    var view = mem.view(p);
    for (var i = 0; i < s.length; i++) {
      view.setUint8(i, s.charCodeAt(i) & 0xFF);
    }
    view.setUint8(s.length, 0);
    return p;
  }

  function write_buffer(fd, buf, len) {
    return write_sys(new BigInt(0, fd), buf, new BigInt(0, len));
  }

  function send_raw(fd, text) {
    var buf = mem.malloc(text.length);
    var view = mem.view(buf);
    for (var i = 0; i < text.length; i++) {
      view.setUint8(i, text.charCodeAt(i) & 0xFF);
    }
    write_buffer(fd, buf, text.length);
    safeFree(buf);
  }

  function send_headers(fd, status_line, content_type, content_length, extra_headers) {
    var headers =
      'HTTP/1.1 ' + status_line + '\r\n' +
      'Content-Type: ' + content_type + '\r\n' +
      'Access-Control-Allow-Origin: *\r\n' +
      'Cache-Control: no-cache\r\n' +
      'Accept-Ranges: bytes\r\n';

    if (extra_headers && extra_headers.length) {
      for (var i = 0; i < extra_headers.length; i++) {
        headers += extra_headers[i] + '\r\n';
      }
    }

    if (content_length !== undefined && content_length !== null) {
      headers += 'Content-Length: ' + content_length + '\r\n';
    }

    headers += 'Connection: close\r\n\r\n';
    send_raw(fd, headers);
  }

  function send_text(fd, status_line, content_type, body) {
    send_headers(fd, status_line, content_type, body.length, null);
    send_raw(fd, body);
  }

  function content_type_for(path) {
    var p = path.toLowerCase();
    if (p.indexOf('.m3u8') >= 0 || p.indexOf('.m3u') >= 0) return 'application/vnd.apple.mpegurl';
    if (p.indexOf('.ts') >= 0) return 'video/mp2t';
    if (p.indexOf('.mp4') >= 0) return 'video/mp4';
    if (p.indexOf('.mov') >= 0) return 'video/quicktime';
    if (p.indexOf('.avi') >= 0) return 'video/x-msvideo';
    if (p.indexOf('.mkv') >= 0) return 'video/x-matroska';
    if (p.indexOf('.webm') >= 0) return 'video/webm';
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

  function strip_leading_slash(path) {
    return (path && path.charAt(0) === '/') ? path.substring(1) : path;
  }

  function get_path(buf, len) {
    var req = '';
    for (var i = 0; i < len && i < 4096; i++) {
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

  function parse_range_header(buf, len) {
    var header = '';
    for (var i = 0; i < len && i < 4096; i++) {
      var c = mem.view(buf).getUint8(i);
      if (c === 0) break;
      header += String.fromCharCode(c);
    }

    var lines = header.split('\n');
    for (var j = 0; j < lines.length; j++) {
      var line = lines[j];
      if (line.toLowerCase().indexOf('range:') === 0) {
        var match = line.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          return {
            start: parseInt(match[1], 10),
            end: match[2] ? parseInt(match[2], 10) : undefined
          };
        }
        break;
      }
    }
    return null;
  }

  function is_safe_path(path) {
    if (path.indexOf('..') >= 0) return false;
    if (path.indexOf('\\') >= 0) return false;
    return true;
  }

  function file_exists(filepath) {
    var path_buf = 0;
    try {
      path_buf = alloc_c_string(filepath);
      var fd = open_sys(path_buf, new BigInt(0, O_RDONLY), new BigInt(0, 0));
      var ok = read_bigint(fd) >= 0;
      if (ok) close_sys(fd);
      return ok;
    } catch (e) {
      return false;
    } finally {
      safeFree(path_buf);
    }
  }

  // Get file size by reading whole file
  function get_file_size(fd) {
    var tmp = mem.malloc(65536);
    var total = 0;

    while (true) {
      var n = read_sys(fd, tmp, new BigInt(0, 65536));
      var bytes = read_bigint(n);
      if (bytes <= 0) break;
      total += bytes;
      if (bytes < 65536) break;
    }

    safeFree(tmp);
    return total;
  }

  // Send file with optional Range support
  function send_file(fd, filepath, range) {
    var path_buf = 0;
    var file_fd = -1;

    try {
      path_buf = alloc_c_string(filepath);
      file_fd = open_sys(path_buf, new BigInt(0, O_RDONLY), new BigInt(0, 0));
      if (read_bigint(file_fd) < 0) {
        log('Cannot open file: ' + filepath);
        send_text(fd, '404 Not Found', 'text/plain', 'Not Found');
        return;
      }

      var file_size = get_file_size(file_fd);
      close_sys(file_fd);

      // Reopen for actual reading
      file_fd = open_sys(path_buf, new BigInt(0, O_RDONLY), new BigInt(0, 0));
      if (read_bigint(file_fd) < 0) {
        log('Cannot reopen file: ' + filepath);
        send_text(fd, '500 Internal Server Error', 'text/plain', 'Server error');
        return;
      }

      var start = 0;
      var end = file_size - 1;
      var status = '200 OK';
      var extra_headers = null;

      if (range && range.start !== undefined) {
        start = range.start;
        end = (range.end !== undefined) ? range.end : (file_size - 1);

        if (start >= file_size || end >= file_size || start > end) {
          send_text(fd, '416 Range Not Satisfiable', 'text/plain', 'Invalid range');
          return;
        }

        status = '206 Partial Content';
        extra_headers = ['Content-Range: bytes ' + start + '-' + end + '/' + file_size];

        // Seek to start by reading and discarding
        var skip_buf = mem.malloc(65536);
        var remaining = start;
        while (remaining > 0) {
          var to_read = remaining > 65536 ? 65536 : remaining;
          var s = read_sys(file_fd, skip_buf, new BigInt(0, to_read));
          var skipped = read_bigint(s);
          if (skipped <= 0) break;
          remaining -= skipped;
        }
        safeFree(skip_buf);
      }

      var content_length = end - start + 1;
      send_headers(fd, status, content_type_for(filepath), content_length, extra_headers);

      var file_buf = mem.malloc(CHUNK_SIZE);
      var bytes_left = content_length;

      while (bytes_left > 0) {
        var to_read = bytes_left > CHUNK_SIZE ? CHUNK_SIZE : bytes_left;
        var n2 = read_sys(file_fd, file_buf, new BigInt(0, to_read));
        var bytes_read = read_bigint(n2);
        if (bytes_read <= 0) break;
        write_buffer(fd, file_buf, bytes_read);
        bytes_left -= bytes_read;
      }

      safeFree(file_buf);
    } catch (e) {
      log('send_file error: ' + e);
      try { send_text(fd, '500 Internal Server Error', 'text/plain', 'Server error'); } catch (x) {}
    } finally {
      if (file_fd >= 0) {
        try { close_sys(file_fd); } catch (e) {}
      }
      safeFree(path_buf);
    }
  }

  // Resolve request path to disk file (handles .m3u8 ↔ .m3u mapping)
  function resolve_path(request_path) {
    var safe = (request_path.charAt(0) === '/') ? request_path.substring(1) : request_path;
    if (safe === '' || safe === '/') return { kind: 'root' };

    var lower = safe.toLowerCase();
    var disk_m3u8 = VIDEO_DIR + '/' + VIDEO_BASE_NAME + '.m3u8';
    var disk_m3u  = VIDEO_DIR + '/' + VIDEO_BASE_NAME + '.m3u';

    if (lower === (VIDEO_BASE_NAME + '.m3u8').toLowerCase()) {
      if (file_exists(disk_m3u8)) return { kind: 'file', path: disk_m3u8 };
      if (file_exists(disk_m3u))   return { kind: 'file', path: disk_m3u };
      return { kind: 'missing', path: disk_m3u8 };
    }

    if (lower === (VIDEO_BASE_NAME + '.m3u').toLowerCase()) {
      if (file_exists(disk_m3u))   return { kind: 'file', path: disk_m3u };
      if (file_exists(disk_m3u8))  return { kind: 'file', path: disk_m3u8 };
      return { kind: 'missing', path: disk_m3u };
    }

    return { kind: 'file', path: VIDEO_DIR + '/' + safe };
  }

  // ----- Setup video element -----
  jsmaf.root.children.length = 0;

  var video = new Video({
    x: 0,
    y: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    visible: true,
    autoplay: true,
    preload: 'auto',           // Start buffering immediately
    scaleMode: 'aspectFill'    // Fill screen without black bars
  });
  jsmaf.root.children.push(video);

  // ----- Video event handlers with watchdog -----
  var videoErrorCount = 0;
  var lastVideoState = null;
  var videoWatchdog = null;

  function clearWatchdog() {
    if (videoWatchdog) {
      if (typeof clearInterval === 'function') clearInterval(videoWatchdog);
      else if (typeof jsmaf !== 'undefined' && jsmaf.clearInterval) jsmaf.clearInterval(videoWatchdog);
      videoWatchdog = null;
    }
  }

  function startWatchdog() {
    clearWatchdog();
    // Periodically check if video is still playing
    var checkState = function () {
      try {
        if (!video || !video.duration) return;
        var currentState = video.state; // assume state property exists
        if (currentState === 'error' || (currentState === 'stopped' && videoErrorCount > 0)) {
          log('Watchdog: video in error state, restarting...');
          restartVideo();
        } else if (currentState === 'stopped' && video.duration > 0 && video.currentTime < video.duration - 1) {
          // Stopped before the end – possibly a glitch, restart
          log('Watchdog: video stopped prematurely, restarting...');
          restartVideo();
        }
      } catch (e) {
        log('Watchdog error: ' + e);
      }
    };

    if (typeof setInterval === 'function') {
      videoWatchdog = setInterval(checkState, WATCHDOG_INTERVAL);
    } else if (typeof jsmaf !== 'undefined' && jsmaf.setInterval) {
      videoWatchdog = jsmaf.setInterval(checkState, WATCHDOG_INTERVAL);
    } else {
      // fallback: use onEnterFrame for watchdog
      var frameCount = 0;
      var originalOnEnterFrame = jsmaf.onEnterFrame;
      jsmaf.onEnterFrame = function () {
        if (originalOnEnterFrame) originalOnEnterFrame();
        frameCount++;
        if (frameCount % (WATCHDOG_INTERVAL / 16.7) < 1) {
          checkState();
        }
      };
    }
  }

  video.onOpen = function () {
    log('Video opened. Duration: ' + video.duration);
    videoErrorCount = 0;
    startWatchdog();
  };

  video.onerror = function (err) {
    log('Video error: ' + JSON.stringify(err));
    videoErrorCount++;
    if (videoErrorCount > 3) {
      log('Too many errors, restarting app...');
      restartApp();
    } else {
      restartVideo();
    }
  };

  video.onstatechange = function (state) {
    log('Video state: ' + state);
    lastVideoState = state;
    if (state === 'error') {
      videoErrorCount++;
    }
  };

  // ----- HTTP Server -----
  var srv = socket_sys(new BigInt(0, AF_INET), new BigInt(0, SOCK_STREAM), new BigInt(0, 0));
  if (read_bigint(srv) < 0) throw new Error('Cannot create socket');

  var optval = mem.malloc(4);
  mem.view(optval).setUint32(0, 1, true);
  setsockopt_sys(srv, new BigInt(0, SOL_SOCKET), new BigInt(0, SO_REUSEADDR), optval, new BigInt(0, 4));
  safeFree(optval);

  var addr = mem.malloc(16);
  var av = mem.view(addr);
  av.setUint8(0, 16);
  av.setUint8(1, AF_INET);
  av.setUint16(2, 0, false);
  av.setUint32(4, 0, false);

  if (bind_sys(srv, addr, new BigInt(0, 16)).lo < 0) {
    safeFree(addr);
    close_sys(srv);
    throw new Error('Bind failed');
  }
  safeFree(addr);

  var actual_addr = mem.malloc(16);
  var actual_len = mem.malloc(4);
  mem.view(actual_len).setUint32(0, 16, true);
  getsockname_sys(srv, actual_addr, actual_len);
  var port = mem.view(actual_addr).getUint16(2, false);
  safeFree(actual_addr);
  safeFree(actual_len);

  if (listen_sys(srv, new BigInt(0, 8)).lo < 0) {
    close_sys(srv);
    throw new Error('Listen failed');
  }

  log('HTTP server listening on port ' + port);
  var videoUrl = 'http://127.0.0.1:' + port + '/' + VIDEO_BASE_NAME + '.m3u8';
  log('Video URL: ' + videoUrl);

  // ----- Server loop variables -----
  var serverRunning = true;
  var restartPending = false;
  var readfds = mem.malloc(128);
  var timeout = mem.malloc(16);

  function reset_timeout() {
    var tv = mem.view(timeout);
    tv.setUint32(0, 0, true);
    tv.setUint32(4, 0, true);
    tv.setUint32(8, 0, true);
    tv.setUint32(12, 0, true);
  }

  function serverLoop() {
    if (!serverRunning) return;

    var client = -1;
    var client_addr = 0;
    var client_len = 0;
    var req_buf = 0;

    try {
      // Clear readfds
      for (var i = 0; i < 128; i++) {
        mem.view(readfds).setUint8(i, 0);
      }

      var fd = srv.lo;
      var byte_index = Math.floor(fd / 8);
      var bit_index = fd % 8;
      var current = mem.view(readfds).getUint8(byte_index);
      mem.view(readfds).setUint8(byte_index, current | (1 << bit_index));

      reset_timeout();

      var nfds = fd + 1;
      var select_ret = select_sys(new BigInt(0, nfds), readfds, new BigInt(0, 0), new BigInt(0, 0), timeout);
      if (select_ret.lo <= 0) return;

      client_addr = mem.malloc(16);
      client_len = mem.malloc(4);
      mem.view(client_len).setUint32(0, 16, true);

      var client_ret = accept_sys(srv, client_addr, client_len);
      client = read_bigint(client_ret);
      if (client < 0) return;

      req_buf = mem.malloc(4096);
      var read_ret = read_sys(new BigInt(0, client), req_buf, new BigInt(0, 4096));
      var bytes = read_bigint(read_ret);

      if (bytes > 0) {
        var path = get_path(req_buf, bytes);
        log('Request: ' + path);

        if (path === '/' || path === '') {
          send_text(client, '200 OK', 'text/plain', 'Video server running');
        } else {
          var safe = (path.charAt(0) === '/') ? path.substring(1) : path;
          if (!is_safe_path(safe)) {
            send_text(client, '400 Bad Request', 'text/plain', 'Bad Request');
          } else {
            var range = parse_range_header(req_buf, bytes);
            var resolved = resolve_path(path);

            if (resolved.kind === 'missing') {
              send_text(client, '404 Not Found', 'text/plain', 'Not Found');
            } else if (resolved.kind === 'root') {
              send_text(client, '200 OK', 'text/plain', 'Video server running');
            } else {
              send_file(client, resolved.path, range);
            }
          }
        }
      }
    } catch (e) {
      log('serverLoop error: ' + e);
    } finally {
      if (client >= 0) {
        try { close_sys(new BigInt(0, client)); } catch (e) {}
      }
      safeFree(req_buf);
      safeFree(client_addr);
      safeFree(client_len);
    }
  }

  // ----- Control functions -----
  function restartVideo() {
    log('Restarting video...');
    try { video.close(); } catch (e) {}
    try { video.open(videoUrl); } catch (e) {}
  }

  function restartApp() {
    if (restartPending) return;
    restartPending = true;

    log('Restarting application...');
    serverRunning = false;
    clearWatchdog();

    try { shutdown_sys(srv, new BigInt(0, 2)); } catch (e) {}
    try { close_sys(srv); } catch (e) {}
    try { video.close(); } catch (e) {}

    jsmaf.onEnterFrame = null;
    jsmaf.onKeyDown = null;

    var safeSetTimeout = function (callback, delay) {
      if (typeof setTimeout !== 'undefined') {
        setTimeout(callback, delay);
      } else if (typeof jsmaf !== 'undefined' && jsmaf && typeof jsmaf.setTimeout === 'function') {
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

  // ----- Attach event handlers -----
  jsmaf.onEnterFrame = serverLoop;
  jsmaf.onKeyDown = function (keyCode) {
    if (keyCode === 14) {
      restartVideo();
    } else if (keyCode === 13) {
      restartApp();
    }
  };

  log('Server ready. Starting playback...');
  video.open(videoUrl);
})();
