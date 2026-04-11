
"""
iPhone Vue 1.01 Vue Inject + Log python...
Made by MexrlDev to work on IOS pythonica without MITMPROXY
Original by Earthonion
"""


import os
import sys
import socket
import threading
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

# -------------------- Configuration --------------------
PROXY_LISTEN_HOST = "0.0.0.0"
PROXY_LISTEN_PORT = 8080

LOG_LISTEN_HOST = "0.0.0.0"
LOG_LISTEN_PORT = 8082
LOG_FILE = Path(__file__).parent / "ps4_logs.txt"

# Hardcoded manifest
MANIFEST = b'{"app_version":"1.01","override":true,"scripts":[{"src":"inject.js","version":"1.0"}]}'

# -------------------- Blocked Domains --------------------
BLOCKED = set()
hosts_path = Path(__file__).parent / "hosts.txt"
if hosts_path.exists():
    with open(hosts_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                parts = line.split()
                domain = parts[-1] if parts else line
                BLOCKED.add(domain.lower())
    print(f"[+] Loaded {len(BLOCKED)} blocked domains from hosts.txt")

def is_blocked(hostname):
    host_lower = hostname.lower()
    return any(blocked in host_lower for blocked in BLOCKED)

# -------------------- Proxy Handler --------------------
class ProxyHandler(BaseHTTPRequestHandler):
    timeout = 30

    def log_message(self, format, *args):
        pass

    def do_CONNECT(self):
        host, port = self.path.split(":")
        port = int(port)

        if is_blocked(host):
            self.send_error(403, f"Blocked domain: {host}")
            print(f"[*] Blocked CONNECT: {host}:{port}")
            return

        print(f"[*] CONNECT tunnel to {host}:{port}")
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as remote:
                remote.settimeout(self.timeout)
                remote.connect((host, port))

                self.send_response(200, "Connection Established")
                self.end_headers()
                self._tunnel(self.connection, remote)
        except Exception as e:
            print(f"[!] CONNECT error: {e}")
            self.send_error(502, "Bad Gateway")

    def _tunnel(self, client, remote):
        def forward(src, dst):
            try:
                while True:
                    data = src.recv(8192)
                    if not data:
                        break
                    dst.sendall(data)
            except:
                pass
            finally:
                src.close()
                dst.close()

        t1 = threading.Thread(target=forward, args=(client, remote))
        t2 = threading.Thread(target=forward, args=(remote, client))
        t1.daemon = t2.daemon = True
        t1.start(); t2.start()
        t1.join(self.timeout); t2.join(self.timeout)

    def do_GET(self): self._handle_request()
    def do_POST(self): self._handle_request()
    def do_PUT(self): self._handle_request()
    def do_DELETE(self): self._handle_request()
    def do_HEAD(self): self._handle_request()

    def _handle_request(self):
        host = self.headers.get("Host")
        if not host:
            self.send_error(400, "Missing Host header")
            return

        if is_blocked(host):
            self.send_error(404, "Blocked")
            print(f"[*] Blocked HTTP: {host}{self.path}")
            return

        if "/_log" in self.path:
            self._handle_log()
            return

        if "manifest.json.aes" in self.path:
            self._serve_manifest()
            return

        if self.path.endswith(".js"):
            filename = self.path.split("/")[-1]
            js_path = Path(__file__).parent / filename
            if js_path.exists():
                self._serve_file(js_path, "application/javascript")
                print(f"[+] Served local JS: {filename}")
                return

        self._forward_request()

    def _handle_log(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len > 0 else b""
        try:
            decoded = body.decode("utf-8", errors="ignore")
            print(f"[PROXY] Log: {decoded}")
        except:
            print(f"[PROXY] Log (binary): {len(body)} bytes")

        # Forward to local log server
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{LOG_LISTEN_PORT}/log",
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            urllib.request.urlopen(req, timeout=2)
            print("[PROXY] Forwarded to log server")
        except Exception as e:
            print(f"[PROXY] Forward failed: {e}")

        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"ok")

    def _serve_manifest(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(MANIFEST)
        print("[+] Served manifest override")

    def _serve_file(self, path, content_type):
        try:
            data = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", len(data))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, f"File error: {e}")

    def _forward_request(self):
        host = self.headers.get("Host")
        url = f"http://{host}{self.path}"

        headers = dict(self.headers)
        for h in ["Proxy-Connection", "Connection", "Keep-Alive",
                  "Proxy-Authenticate", "Proxy-Authorization",
                  "TE", "Trailer", "Transfer-Encoding", "Upgrade"]:
            headers.pop(h, None)

        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len > 0 else None

        print(f"[>] {self.command} {url}")

        try:
            req = urllib.request.Request(url, data=body, headers=headers, method=self.command)
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                self.send_response(resp.status)
                for key, val in resp.getheaders():
                    if key.lower() not in ["connection", "keep-alive", "proxy-authenticate",
                                           "proxy-authorization", "te", "trailer",
                                           "transfer-encoding", "upgrade"]:
                        self.send_header(key, val)
                self.end_headers()
                while chunk := resp.read(8192):
                    self.wfile.write(chunk)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for key, val in e.headers.items():
                if key.lower() not in ["connection", "keep-alive", "proxy-authenticate",
                                       "proxy-authorization", "te", "trailer",
                                       "transfer-encoding", "upgrade"]:
                    self.send_header(key, val)
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            print(f"[!] Forward error: {e}")
            self.send_error(502, f"Gateway Error: {e}")

class ThreadedProxyServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

# -------------------- Log Server Handler --------------------
class LogHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path in ('/log', '/_log'):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8', errors='ignore')

            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            line = f"[{timestamp}] {body}"
            print(f"[LOG] {line}")

            # Save to file
            try:
                with open(LOG_FILE, 'a', encoding='utf-8') as f:
                    f.write(line + '\n')
            except Exception as e:
                print(f"[!] Failed to write log: {e}")

            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'ok')
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        pass

class ThreadedLogServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

# -------------------- Utility --------------------
def get_local_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except:
        return "127.0.0.1"

# -------------------- Main --------------------
def main():
    # Start Log Server in background thread
    log_server = ThreadedLogServer((LOG_LISTEN_HOST, LOG_LISTEN_PORT), LogHandler)
    log_thread = threading.Thread(target=log_server.serve_forever, daemon=True)
    log_thread.start()
    print(f"[+] Log server listening on {LOG_LISTEN_HOST}:{LOG_LISTEN_PORT}")

    # Start Proxy Server in main thread (or also background)
    # Try multiple bind addresses
    bind_addresses = [PROXY_LISTEN_HOST, "0.0.0.0", get_local_ip(), "127.0.0.1"]
    bind_addresses = list(dict.fromkeys(bind_addresses))

    proxy_server = None
    for addr in bind_addresses:
        try:
            proxy_server = ThreadedProxyServer((addr, PROXY_LISTEN_PORT), ProxyHandler)
            print(f"[+] Proxy bound to {addr}:{PROXY_LISTEN_PORT}")
            break
        except OSError as e:
            print(f"[!] Could not bind proxy to {addr}:{PROXY_LISTEN_PORT} - {e}")

    if proxy_server is None:
        print("[!] Failed to start proxy. Exiting.")
        sys.exit(1)

    client_ip = get_local_ip()
    print(f"\n[+] All services running!")
    print(f"[+] Proxy:  http://{client_ip}:{PROXY_LISTEN_PORT}")
    print(f"[+] Log server: http://{client_ip}:{LOG_LISTEN_PORT}")
    print(f"[+] Log file: {LOG_FILE}")
    print(f"\n[+] Configure PS4 / router to use proxy: {client_ip}:{PROXY_LISTEN_PORT}")
    print("[+] Press Ctrl+C to stop.\n")

    try:
        proxy_server.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Shutting down...")
        proxy_server.shutdown()
        log_server.shutdown()

if __name__ == "__main__":
    main()
