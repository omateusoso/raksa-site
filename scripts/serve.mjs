import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT || 4173);
const pagesBase = "/raksadesign";

const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

function getSitePath(urlPath) {
  let decoded = decodeURIComponent(urlPath.split("?")[0]);
  if (decoded === pagesBase) decoded = "/";
  else if (decoded.startsWith(`${pagesBase}/`)) decoded = decoded.slice(pagesBase.length);

  return decoded;
}

function getCandidatePath(decodedPath) {
  const cleanPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  return join(root, cleanPath);
}

function getDirectoryRedirect(urlPath) {
  const requestPath = urlPath.split("?")[0] || "/";
  if (requestPath.endsWith("/")) return "";

  const decoded = getSitePath(urlPath);
  const candidate = getCandidatePath(decoded);
  const directoryIndex = join(candidate, "index.html");

  if (
    candidate.startsWith(root) &&
    existsSync(candidate) &&
    statSync(candidate).isDirectory() &&
    directoryIndex.startsWith(root) &&
    existsSync(directoryIndex) &&
    statSync(directoryIndex).isFile()
  ) {
    const query = urlPath.includes("?") ? `?${urlPath.split("?").slice(1).join("?")}` : "";
    return `${requestPath}/${query}`;
  }

  return "";
}

function resolvePath(urlPath) {
  const decoded = getSitePath(urlPath);
  const candidate = getCandidatePath(decoded);

  if (candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  const directoryIndex = join(candidate, "index.html");
  if (directoryIndex.startsWith(root) && existsSync(directoryIndex) && statSync(directoryIndex).isFile()) {
    return directoryIndex;
  }

  if (/^\/cases\/[^/]+\/?$/.test(decoded)) {
    return join(root, "cases", "index.html");
  }

  return join(root, "index.html");
}

function contentExtension(filePath) {
  return extname(filePath.replace(/\.js@[\d.]+$/, ".js"));
}

createServer((request, response) => {
  const redirect = getDirectoryRedirect(request.url || "/");
  if (redirect) {
    response.writeHead(308, { Location: redirect });
    response.end();
    return;
  }

  const filePath = resolvePath(request.url || "/");
  const extension = contentExtension(filePath);
  const stats = statSync(filePath);

  response.setHeader("Content-Type", mimeTypes[extension] || "application/octet-stream");
  response.setHeader("Cache-Control", extension === ".html" ? "no-store" : "public, max-age=31536000, immutable");
  response.setHeader("Accept-Ranges", "bytes");

  const range = request.headers.range;

  if (range) {
    const [startText, endText] = range.replace("bytes=", "").split("-");
    const start = Number(startText);
    const end = endText ? Number(endText) : stats.size - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stats.size) {
      response.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
      response.end();
      return;
    }

    response.writeHead(206, {
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stats.size}`
    });

    createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  response.setHeader("Content-Length", stats.size);

  createReadStream(filePath)
    .on("error", () => {
      response.writeHead(500);
      response.end("Internal server error");
    })
    .pipe(response);
}).listen(port, () => {
  console.log(`RAKSA site running at http://localhost:${port}`);
});
