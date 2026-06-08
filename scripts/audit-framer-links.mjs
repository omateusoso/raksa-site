import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const pagesBase = "raksadesign";
const forbiddenHosts = [
  "framer.com",
  "www.framer.com",
  "events.framer.com",
  "app.framerstatic.com",
  "api.framer.com",
  "framerusercontent.com",
];

const entryPattern =
  /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+\.(?:mjs|js))["'][^>]*>/g;
const staticImportPattern =
  /(?:import\s+[^"'`]*?\s+from\s*|import\s*)["'`]([^"'`]+)["'`]/g;
const dynamicTemplatePattern = /import\s*\(\s*`([^`]+)`\s*\)/g;
const absoluteUrlPattern = /https?:\/\/[^\s"'<>]+/g;

const entries = new Set();
const failures = [];

function walkHtml(directory, files = []) {
  for (const name of readdirSync(directory)) {
    if (name === ".git" || name === "node_modules") continue;

    const path = join(directory, name);
    const stats = statSync(path);

    if (stats.isDirectory()) walkHtml(path, files);
    else if (path.endsWith(".html")) files.push(path);
  }

  return files;
}

function isForbiddenUrl(value) {
  try {
    const url = new URL(value);
    return forbiddenHosts.includes(url.hostname);
  } catch {
    return false;
  }
}

function localPathFromUrl(value, fromFile = "index.html") {
  if (value.startsWith("/")) {
    const path = value.slice(1);
    return normalize(path.startsWith(`${pagesBase}/`) ? path.slice(pagesBase.length + 1) : path);
  }
  if (value.startsWith("./") || value.startsWith("../")) {
    const path = normalize(join(dirname(fromFile), value));
    return path.startsWith(`${pagesBase}/`) ? path.slice(pagesBase.length + 1) : path;
  }
  return null;
}

for (const htmlFile of walkHtml(root)) {
  const relativeHtmlFile = normalize(htmlFile.slice(root.length));
  const html = readFileSync(htmlFile, "utf8");

  for (const match of html.matchAll(absoluteUrlPattern)) {
    const url = match[0];
    if (isForbiddenUrl(url)) failures.push(`External Framer URL in /${relativeHtmlFile}: ${url}`);
  }

  for (const match of html.matchAll(entryPattern)) {
    const src = match[1];
    if (isForbiddenUrl(src)) failures.push(`External entry in /${relativeHtmlFile}: ${src}`);

    const localPath = localPathFromUrl(src, relativeHtmlFile);
    if (localPath) entries.add(localPath);
  }
}

const visited = new Set();
const queue = [...entries];

while (queue.length) {
  const file = queue.shift();
  if (visited.has(file)) continue;
  visited.add(file);

  const absolute = join(root, file);
  if (!existsSync(absolute)) {
    failures.push(`Missing module referenced by graph: /${file}`);
    continue;
  }

  const source = readFileSync(absolute, "utf8");
  const imports = [...source.matchAll(staticImportPattern)].map((match) => match[1]);
  const dynamicImports = [...source.matchAll(dynamicTemplatePattern)].map((match) => match[1]);

  for (const specifier of imports) {
    if (isForbiddenUrl(specifier)) {
      failures.push(`External module import in /${file}: ${specifier}`);
      continue;
    }

    const cleaned = specifier.split("?")[0].split("#")[0];
    const localPath = localPathFromUrl(cleaned, file);
    if (localPath && /\.(?:mjs|js)(?:@[\d.]+)?$/.test(localPath)) {
      queue.push(localPath);
    }
  }

  for (const specifier of dynamicImports) {
    if (isForbiddenUrl(specifier)) {
      failures.push(`External dynamic module import in /${file}: ${specifier}`);
    }
  }
}

if (failures.length) {
  console.error("Framer independence audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Framer independence audit passed. Reachable modules checked: ${visited.size}.`);
