import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = resolve(projectRoot, "frontend", "dist");
const indexPath = resolve(distRoot, "index.html");
const host = process.env.FRONTEND_HOST || "0.0.0.0";
const port = Number(process.env.FRONTEND_PORT || 5173);

if (!existsSync(indexPath)) {
  console.error("No existe frontend/dist/index.html. Ejecutá: cd frontend && npm ci && npm run build");
  process.exit(1);
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendFile(request, response, filePath) {
  const extension = extname(filePath).toLowerCase();
  response.statusCode = 200;
  response.setHeader("Content-Type", mimeTypes[extension] || "application/octet-stream");
  response.setHeader(
    "Cache-Control",
    filePath === indexPath ? "no-cache" : "public, max-age=31536000, immutable",
  );
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method || "GET")) {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Método no permitido");
    return;
  }

  const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  const requestedPath = resolve(distRoot, `.${pathname}`);
  const insideDist = requestedPath === distRoot || requestedPath.startsWith(`${distRoot}${sep}`);

  if (insideDist && existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    sendFile(request, response, requestedPath);
    return;
  }

  sendFile(request, response, indexPath);
}).listen(port, host, () => {
  console.log(`Frontend beta disponible en http://${host}:${port}`);
});
