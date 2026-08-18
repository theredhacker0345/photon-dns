const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.env.PORT || 3000);
const clientRoot = path.join(__dirname, "web");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function withinClientRoot(candidate) {
  const relative = path.relative(clientRoot, candidate);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function serveFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", "http://localhost");
  const decodedPath = decodeURIComponent(requestUrl.pathname);
  const requestedFile = path.resolve(clientRoot, `.${decodedPath}`);
  const candidates = [];

  if (withinClientRoot(requestedFile)) candidates.push(requestedFile);
  if (withinClientRoot(`${requestedFile}.html`)) candidates.push(`${requestedFile}.html`);
  candidates.push(path.join(clientRoot, "index.html"));

  const match = candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });

  if (!match) {
    response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Pocket Relay client bundle is not available.");
    return;
  }

  serveFile(response, match);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Pocket Relay web bundle listening on :${port}`);
});
