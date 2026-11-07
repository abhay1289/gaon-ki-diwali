"""Local dev server for the village: like `python3 -m http.server`, but tells the browser
not to cache, so every edit shows up on the next reload."""
import http.server
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".oga": "audio/ogg", ".ogg": "audio/ogg", ".js": "text/javascript"}

    def end_headers(self):
        path = self.path.split("?", 1)[0]
        # the library and the font files do not change between edits; everything else stays uncached
        if path.startswith("/vendor/") or path.startswith("/assets/fonts/") or path.endswith(".woff2"):
            self.send_header("Cache-Control", "public, max-age=604800")
        else:
            self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4000
    http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCache).serve_forever()
