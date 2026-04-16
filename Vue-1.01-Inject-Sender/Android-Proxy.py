"""
Android Vue 1.01 Vue Inject ONLY. python...
Made by MexrlDev to work on Android Pythonica without MITMPROXY
Original by Earthonion

UNTESTED
"""

import os
import sys
import socket
import threading
import urllib.request
import urllib.error
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

# -------------------- Configuration --------------------
LISTEN_HOST = "" #<< IP HERE
LISTEN_PORT = 8080
LOG_SERVER_URL = "http://127.0.0.1:8082/log"

# Hardcoded manifest content (bytes)
MANIFEST = b'{"app_version":"1.01","override":true,"scripts":[{"src":"inject.js","version":"1.0"}]}'

# -------------------- Load Blocked Domains --------------------
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
        pass  # Suppress default logs

    def do_CONNECT(self):
        """Handle HTTPS CONNECT - tunnel only, no inspection."""
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
        """Bidirectional copy."""
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

        # Intercept log forwarding
        if "/_log" in self.path:
            self._handle_log()
            return

        # Intercept manifest
        if "manifest.json.aes" in self.path:
            self._serve_manifest()
            return

        # Intercept local .js files
        if self.path.endswith(".js"):
            filename = self.path.split("/")[-1]
            js_path = Path(__file__).parent / filename
            if js_path.exists():
                self._serve_file(js_path, "application/javascript")
                print(f"[+] Served local JS: {filename}")
                return

        # Default: forward request
        self._forward_request()

    def _handle_log(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len > 0 else b""
        try:
            print(f"[PROXY] Log: {body.decode('utf-8', errors='ignore')}")
        except:
            print(f"[PROXY] Log (binary): {len(body)} bytes")

        try:
            req = urllib.request.Request(LOG_SERVER_URL, data=body,
                                         headers={"Content-Type": "application/json"},
                                         method="POST")
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
        if not host:
            self.send_error(400, "Missing Host header")
            return

        # Extract hostname without port
        hostname = host.split(":")[0]

        # Resolve hostname to IP manually (fixes DNS issues on Android)
        try:
            resolved_ip = socket.gethostbyname(hostname)
        except socket.gaierror as e:
            print(f"[!] DNS resolution failed for {hostname}: {e}")
            self.send_error(502, f"DNS resolution failed: {e}")
            return

        # Build URL using resolved IP, but keep original Host header
        url = f"http://{resolved_ip}{self.path}"

        headers = dict(self.headers)
        # Remove hop-by-hop headers
        for h in ["Proxy-Connection", "Connection", "Keep-Alive",
                  "Proxy-Authenticate", "Proxy-Authorization",
                  "TE", "Trailer", "Transfer-Encoding", "Upgrade"]:
            headers.pop(h, None)
        # Ensure the original Host header is sent (some servers require it)
        headers["Host"] = host

        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len > 0 else None

        print(f"[>] {self.command} {url} (Host: {host})")

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

# -------------------- Threaded Server --------------------
class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

def get_local_ip():
    """Return the Android device's Wi-Fi IP address."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except:
        return "127.0.0.1"

def get_all_ips():
    """Return all non-loopback IPv4 addresses on this device."""
    ips = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None):
            addr = info[4][0]
            if addr not in ips and not addr.startswith("127."):
                ips.append(addr)
    except:
        pass
    return ips

def main():
    bind_addresses = [LISTEN_HOST]
    if LISTEN_HOST != "0.0.0.0":
        bind_addresses.append("0.0.0.0")
    bind_addresses.extend([get_local_ip(), "127.0.0.1"])
    bind_addresses = list(dict.fromkeys(bind_addresses))

    httpd = None
    for addr in bind_addresses:
        try:
            server_address = (addr, LISTEN_PORT)
            httpd = ThreadedHTTPServer(server_address, ProxyHandler)
            print(f"[+] Proxy bound to {addr}:{LISTEN_PORT}")
            break
        except OSError as e:
            print(f"[!] Could not bind to {addr}:{LISTEN_PORT} - {e}")

    if httpd is None:
        print("[!] Failed to bind to any address.")
        print("    Available IP addresses on this device:")
        for ip in get_all_ips():
            print(f"      - {ip}")
        sys.exit(1)

    client_ip = get_local_ip()
    print(f"\n[+] Proxy running!")
    print(f"[+] Configure your PS4 / router / device proxy settings to:")
    print(f"      Proxy Server: {client_ip}")
    print(f"      Proxy Port:   {LISTEN_PORT}")
    print("[+] Press Ctrl+C to stop.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Shutting down...")
        httpd.shutdown()

if __name__ == "__main__":
    main()
