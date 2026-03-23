// Original earthonion code 
(function () {
  log('=== Local Video Server ===');
  if (typeof libc_addr === 'undefined') {
    include('userland.js');
  }

  // Register socket syscalls
  fn.register(97, 'socket', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(98, 'connect', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(104, 'bind', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(105, 'setsockopt', ['bigint', 'bigint', 'bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(106, 'listen', ['bigint', 'bigint'], 'bigint');
  fn.register(30, 'accept', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(32, 'getsockname', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(3, 'read_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(4, 'write_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(6, 'close_sys', ['bigint'], 'bigint');
  fn.register(5, 'open_sys', ['bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(93, 'select', ['bigint', 'bigint', 'bigint', 'bigint', 'bigint'], 'bigint');
  fn.register(134, 'shutdown', ['bigint', 'bigint'], 'bigint');
  var socket_sys = fn.socket;
  var bind_sys = fn.bind;
  var setsockopt_sys = fn.setsockopt;
  var listen_sys = fn.listen;
  var accept_sys = fn.accept;
  var getsockname_sys = fn.getsockname;
  var read_sys = fn.read_sys;
  var write_sys = fn.write_sys;
  var close_sys = fn.close_sys;
  var open_sys = fn.open_sys;
  var select_sys = fn.select;
  var shutdown_sys = fn.shutdown;
  var AF_INET = 2;
  var SOCK_STREAM = 1;
  var SOL_SOCKET = 0xFFFF;
  var SO_REUSEADDR = 0x4;
  var O_RDONLY = 0;

  // ===== VIDEO CONFIGURATION =====
  var VIDEO_DIR = '/download0/vid';
  var PLAYLIST_FILE = 'cat-meow.m3u8';
  var SEGMENT_FILES = ['cat-meow0.ts'];
  // ================================

  // Create server socket
  log('Creating HTTP server for video files...');
  var srv = socket_sys(new BigInt(0, AF_INET), new BigInt(0, SOCK_STREAM), new BigInt(0, 0));
  if (srv.lo < 0) throw new Error('Cannot create socket');

  // Set SO_REUSEADDR
  var optval = mem.malloc(4);
  mem.view(optval).setUint32(0, 1, true);
  setsockopt_sys(srv, new BigInt(0, SOL_SOCKET), new BigInt(0, SO_REUSEADDR), optval, new BigInt(0, 4));

  // Bind to port 0 (let OS pick)
  var addr = mem.malloc(16);
  mem.view(addr).setUint8(0, 16);
  mem.view(addr).setUint8(1, AF_INET);
  mem.view(addr).setUint16(2, 0, false); // port 0 = let OS choose
  mem.view(addr).setUint32(4, 0, false); // 0.0.0.0

  if (bind_sys(srv, addr, new BigInt(0, 16)).lo < 0) {
    close_sys(srv);
    throw new Error('Bind failed');
  }

  // Get actual port
  var actual_addr = mem.malloc(16);
  var actual_len = mem.malloc(4);
  mem.view(actual_len).setUint32(0, 16, true);
  getsockname_sys(srv, actual_addr, actual_len);
  var port = mem.view(actual_addr).getUint16(2, false);

  // Listen
  if (listen_sys(srv, new BigInt(0, 5)).lo < 0) {
    close_sys(srv);
    throw new Error('Listen failed');
  }
  log('HTTP server listening on port ' + port);

  // Store video URL separately (video.url property gets cleared by Video object)
  var videoUrl = 'http://127.0.0.1:' + port + '/' + PLAYLIST_FILE;
  log('Video URL: ' + videoUrl);

  // Setup UI
  jsmaf.root.children.length = 0;

  // Dual video approach for seamless looping
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
  var requestCount = 0;
  var currentVideo = video1;
  var nextVideo = video2;
  var preloadStarted = false;
  function setupVideoCallbacks(video, isNext) {
    video.onOpen = function () {
      log('Video ' + (isNext ? 'next' : 'current') + ' opened! Duration: ' + video.duration);
    };
    video.onerror = function (err) {
      log('Video error: ' + JSON.stringify(err));
    };
    video.onstatechange = function (state) {
      log('Video ' + (video === currentVideo ? 'current' : 'next') + ' state: ' + state);
      if (video === currentVideo && state === 'Ended') {
        log('Swapping to next video...');
        // Hide current, show next
        currentVideo.visible = false;
        nextVideo.visible = true;
        nextVideo.play();

        // Swap references
        var temp = currentVideo;
        currentVideo = nextVideo;
        nextVideo = temp;

        // Start preloading the next loop immediately
        preloadStarted = false;
      }
    };
  }
  setupVideoCallbacks(video1, false);
  setupVideoCallbacks(video2, true);

  // Send HTTP response
  function send_response(fd, content_type, body) {
    var headers = 'HTTP/1.1 200 OK\r\n' + 'Content-Type: ' + content_type + '\r\n' + 'Content-Length: ' + body.length + '\r\n' + 'Access-Control-Allow-Origin: *\r\n' + 'Connection: close\r\n' + '\r\n';
    var resp = headers + body;
    var buf = mem.malloc(resp.length);
    for (var i = 0; i < resp.length; i++) {
      mem.view(buf).setUint8(i, resp.charCodeAt(i));
    }
    write_sys(new BigInt(fd), buf, new BigInt(0, resp.length));
  }

  // Send binary file
  function send_file(fd, filepath, content_type) {
    // Open file
    var path_buf = mem.malloc(filepath.length + 1);
    for (var i = 0; i < filepath.length; i++) {
      mem.view(path_buf).setUint8(i, filepath.charCodeAt(i));
    }
    mem.view(path_buf).setUint8(filepath.length, 0);
    var file_fd = open_sys(path_buf, new BigInt(0, O_RDONLY), new BigInt(0, 0));
    if (file_fd.eq(new BigInt(0xffffffff, 0xffffffff))) {
      log('Cannot open file: ' + filepath);
      var error = 'HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\n\r\nNot Found';
      var error_buf = mem.malloc(error.length);
      for (var _i = 0; _i < error.length; _i++) {
        mem.view(error_buf).setUint8(_i, error.charCodeAt(_i));
      }
      write_sys(new BigInt(fd), error_buf, new BigInt(0, error.length));
      return;
    }

    // Read file content
    var file_buf = mem.malloc(65536);
    var bytes_read = read_sys(file_fd, file_buf, new BigInt(0, 65536));
    close_sys(file_fd);
    if (bytes_read.lo <= 0) {
      log('Cannot read file: ' + filepath);
      return;
    }

    // Build response string from buffer
    var body = '';
    for (var _i2 = 0; _i2 < bytes_read.lo; _i2++) {
      body += String.fromCharCode(mem.view(file_buf).getUint8(_i2));
    }
    send_response(fd, content_type, body);
    log('Sent ' + filepath + ' (' + bytes_read.lo + ' bytes)');
  }

  // Parse request path
  function get_path(buf, len) {
    var req = '';
    for (var i = 0; i < len && i < 1024; i++) {
      var c = mem.view(buf).getUint8(i);
      if (c === 0) break;
      req += String.fromCharCode(c);
    }
    var lines = req.split('\n');
    if (lines.length > 0) {
      var parts = lines[0].trim().split(' ');
      if (parts.length >= 2) return parts[1];
    }
    return '/';
  }
  var serverRunning = true;

  // Prepare select() structures (reuse across calls)
  var readfds = mem.malloc(128); // fd_set (128 bytes for up to 1024 fds)
  var timeout = mem.malloc(16); // struct timeval
  // Set timeout to 0 (poll mode)
  mem.view(timeout).setUint32(0, 0, true); // tv_sec = 0
  mem.view(timeout).setUint32(4, 0, true);
  mem.view(timeout).setUint32(8, 0, true); // tv_usec = 0
  mem.view(timeout).setUint32(12, 0, true);

  // Non-blocking server loop using select()
  function serverLoop() {
    if (!serverRunning) return;

    // Clear fd_set and set our server fd
    for (var i = 0; i < 128; i++) {
      mem.view(readfds).setUint8(i, 0);
    }

    // Set the bit for our server socket fd
    var fd = srv.lo;
    var byte_index = Math.floor(fd / 8);
    var bit_index = fd % 8;
    var current = mem.view(readfds).getUint8(byte_index);
    mem.view(readfds).setUint8(byte_index, current | 1 << bit_index);

    // Poll with select() - returns immediately
    var nfds = fd + 1;
    var select_ret = select_sys(new BigInt(0, nfds), readfds, new BigInt(0, 0), new BigInt(0, 0), timeout);

    // If select returns 0, no connections ready
    if (select_ret.lo <= 0) {
      return; // No connection, exit without blocking
    }

    // Connection is ready, now accept() won't block
    var client_addr = mem.malloc(16);
    var client_len = mem.malloc(4);
    mem.view(client_len).setUint32(0, 16, true);
    var client_ret = accept_sys(srv, client_addr, client_len);
    var client = client_ret instanceof BigInt ? client_ret.lo : client_ret;
    if (client >= 0) {
      requestCount++;
      var req_buf = mem.malloc(4096);
      var read_ret = read_sys(new BigInt(client), req_buf, new BigInt(0, 4096));
      var bytes = read_ret instanceof BigInt ? read_ret.lo : read_ret;
      if (bytes > 0) {
        var path = get_path(req_buf, bytes);
        log('Request #' + requestCount + ': ' + path);

        // Check if requesting playlist
        if (path === '/' + PLAYLIST_FILE || path.indexOf('/' + PLAYLIST_FILE) >= 0) {
          send_file(client, VIDEO_DIR + '/' + PLAYLIST_FILE, 'application/vnd.apple.mpegurl');
        } else {
          // Check if requesting any segment file
          var handled = false;
          for (var _i3 = 0; _i3 < SEGMENT_FILES.length; _i3++) {
            if (path === '/' + SEGMENT_FILES[_i3] || path.indexOf('/' + SEGMENT_FILES[_i3]) >= 0) {
              send_file(client, VIDEO_DIR + '/' + SEGMENT_FILES[_i3], 'video/MP2T');
              handled = true;
              break;
            }
          }
          if (!handled) {
            send_response(client, 'text/plain', 'Video server running');
          }
        }
      }
      close_sys(new BigInt(client));
    }
  }

  // Monitor playback and preload next video near the end
  jsmaf.onEnterFrame = function () {
    serverLoop();
    if (currentVideo.duration > 0 && currentVideo.elapsed > 0) {
      // Start preloading when 70% through current video
      var threshold = currentVideo.duration * 0.7;
      if (!preloadStarted && currentVideo.elapsed >= threshold) {
        log('Preloading next video at ' + currentVideo.elapsed + 'ms...');
        preloadStarted = true;
        nextVideo.open(videoUrl);
      }
    }
  };
  var isShuttingDown = false;
  jsmaf.onKeyDown = function (keyCode) {
    if (keyCode === 13 && !isShuttingDown) {
      // Circle - exit
      log('Shutting down video server...');
      isShuttingDown = true;
      serverRunning = false;

      // Shutdown server socket (stops accepting new connections)
      try {
        var SHUT_RDWR = 2;
        shutdown_sys(srv, new BigInt(0, SHUT_RDWR));
        log('Server socket shutdown');
      } catch (e) {
        log('Error shutting down server: ' + e.message);
      }

      // Close server socket
      try {
        close_sys(srv);
        log('Server socket closed');
      } catch (e) {
        log('Error closing server socket: ' + e.message);
      }

      // Close video players
      try {
        currentVideo.close();
        log('Current video closed');
      } catch (e) {
        log('Error closing current video: ' + e.message);
      }
      try {
        nextVideo.close();
        log('Next video closed');
      } catch (e) {
        log('Error closing next video: ' + e.message);
      }

      // Clear handlers
      jsmaf.onEnterFrame = null;
      jsmaf.onKeyDown = null;
      log('Cleanup complete, returning to main menu in 500ms...');

      // Small delay to let everything settle
      var cleanup_start = Date.now();
      while (Date.now() - cleanup_start < 500) {
        // Wait
      }
      include('themes/' + (typeof CONFIG !== 'undefined' && CONFIG.theme ? CONFIG.theme : 'default') + '/main.js');
    }
  };
  log('Server ready! Using select() for non-blocking I/O.');
  log('Starting seamless looping video...');
  log('Video URL: ' + videoUrl);

  // Auto-start first video
  video1.open(videoUrl);
})();
