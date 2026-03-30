# From https://github.com/ArabPixel/psvue-theming/blob/master/proxy.py

from mitmproxy import http
from mitmproxy.proxy.layers import tls
from pathlib import Path
import os

# hardcoded manifest - Minimal test with logging and auto-refresh
MANIFEST = b'{"app_version":"1.01","override":true,"scripts":[{"src":"inject.js","version":"1.0"}]}'

# load blocked domains from hosts.txt
BLOCKED = set()
hosts_path = os.path.join(os.path.dirname(__file__), "hosts.txt")
try:
    with open(hosts_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                parts = line.split()
                domain = parts[-1] if parts else line
                BLOCKED.add(domain.lower())
    print(f"[+] Loaded {len(BLOCKED)} blocked domains")
except:
    pass

def is_blocked(hostname):
    hostname_lower = hostname.lower()
    for blocked in BLOCKED:
        if blocked in hostname_lower:
            return True
    return False

def tls_clienthello(data: tls.ClientHelloData):
    if data.context.server.address:
        hostname = data.context.server.address[0]
        if is_blocked(hostname):
            raise ConnectionRefusedError(f"[*] Blocked HTTPS: {hostname}")

def request(flow: http.HTTPFlow):
    hostname = flow.request.pretty_host

    # block domains from hosts.txt
    if is_blocked(hostname):
        flow.response = http.Response.make(404, b"blocked")
        print(f"[*] Blocked HTTP: {hostname}")
        return

    # intercept logs and forward to log server
    if "/_log" in flow.request.path:
        body = flow.request.content.decode('utf-8', errors='ignore')
        print(f"[PROXY] Got log request: {body}")
        # Forward to log server
        import urllib.request
        try:
            req = urllib.request.Request('http://127.0.0.1:8082/log', data=body.encode('utf-8'), method='POST')
            urllib.request.urlopen(req, timeout=1)
            print(f"[PROXY] Forwarded to log server")
        except Exception as e:
            print(f"[PROXY] Failed to forward: {e}")
        flow.response = http.Response.make(200, b"ok")
        return

    # intercept manifest
    if "manifest.json.aes" in flow.request.path:
        flow.response = http.Response.make(200, MANIFEST, {"Content-Type": "application/json"})
        print(f"[+] Served manifest")
        return

    # intercept js files
    if flow.request.path.endswith(".js"):
        filename = flow.request.path.split('/')[-1]
        js_path = Path(__file__).parent / filename
        if js_path.exists():
            flow.response = http.Response.make(200, js_path.read_bytes(), {"Content-Type": "application/javascript"})
            print(f"[+] Served {filename}")
