#!/usr/bin/env python3
"""
Serve vault files for Family Vault app to download.
Run: python3 serve-vault.py
Then tap "Sync from Mac" in the app.
"""

import http.server
import json
import os
import sys
import unicodedata
from urllib.parse import unquote

VAULT_PATH = os.environ.get("VAULT_PATH", os.path.expanduser("~/Documents/coffre"))
PORT = 8765

class VaultHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/manifest.json':
            self.send_manifest()
        elif self.path.startswith('/file/'):
            self.send_file()
        else:
            self.send_error(404)

    def send_manifest(self):
        """List all vault files (.md, .cook)"""
        files = []
        extensions = ('.md', '.cook')
        for root, dirs, filenames in os.walk(VAULT_PATH):
            # Skip .obsidian and .scripts
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for f in filenames:
                if f.endswith(extensions):
                    rel = os.path.relpath(os.path.join(root, f), VAULT_PATH)
                    # Normalize to NFC (iOS/app expects NFC, macOS APFS uses NFD)
                    rel = unicodedata.normalize('NFC', rel)
                    files.append(rel)

        data = json.dumps({"files": sorted(files)}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', len(data))
        self.end_headers()
        self.wfile.write(data)

    def send_file(self):
        """Serve a specific vault file"""
        rel_path = unquote(self.path[6:])  # Remove '/file/' and decode URL
        # Normalize unicode (iOS sends decomposed, macOS uses precomposed)
        rel_path = unicodedata.normalize('NFC', rel_path)
        full_path = os.path.join(VAULT_PATH, rel_path)

        if not os.path.isfile(full_path):
            self.send_error(404, f"Not found: {rel_path}")
            return

        with open(full_path, 'rb') as f:
            content = f.read()

        self.send_response(200)
        self.send_header('Content-Type', 'text/markdown; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', len(content))
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format, *args):
        print(f"  {args[0]}")

if __name__ == '__main__':
    if not os.path.isdir(VAULT_PATH):
        print(f"Vault not found: {VAULT_PATH}")
        sys.exit(1)

    # Count files
    count = sum(1 for r, d, f in os.walk(VAULT_PATH)
                for x in f if x.endswith('.md')
                if not any(p.startswith('.') for p in r.split('/')))

    print(f"Serving vault: {VAULT_PATH}")
    print(f"Files: {count} .md files")
    print(f"URL: http://0.0.0.0:{PORT}")
    print(f"Press Ctrl+C to stop\n")

    server = http.server.HTTPServer(('0.0.0.0', PORT), VaultHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
