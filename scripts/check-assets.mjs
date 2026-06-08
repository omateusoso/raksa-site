import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const textExtensions = [".css", ".html", ".js", ".json", ".mjs", ".txt"];
const skippedDirectories = new Set([".git", "node_modules"]);
const ignoredPaths = [/\.map$/, /^framer\.com\/login$/];
const pagesBase = "raksadesign";
const assetPattern = /["'`(=,]\s*\/((?:(?:raksadesign\/)?framerusercontent\.com|(?:raksadesign\/)?vendor|app\.framerstatic\.com|framer\.com|events\.framer\.com|res\.cloudinary\.com|ga\.jspm\.io)\/[^"'`()\s?#,]+)/g;
const unprefixedPagesAssets = new Set();
const missing = new Set();

function walk(directory, files = []) {
  for (const name of readdirSync(directory)) {
    if (skippedDirectories.has(name)) continue;

    const path = join(directory, name);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      walk(path, files);
    } else if (textExtensions.some((extension) => path.endsWith(extension)) || /\.m?js@/.test(path)) {
      files.push(path);
    }
  }

  return files;
}

for (const file of walk(root)) {
  const contents = readFileSync(file, "utf8");

  for (const match of contents.matchAll(assetPattern)) {
    const assetPath = match[1].replace(/&amp;/g, "&");

    if (ignoredPaths.some((pattern) => pattern.test(assetPath))) continue;

    if (assetPath.startsWith("framerusercontent.com/") || assetPath.startsWith("vendor/")) {
      unprefixedPagesAssets.add(`/${assetPath}`);
    }

    const localAssetPath = assetPath.startsWith(`${pagesBase}/`)
      ? assetPath.slice(pagesBase.length + 1)
      : assetPath;

    if (!existsSync(join(root, localAssetPath))) missing.add(`/${assetPath}`);
  }
}

if (unprefixedPagesAssets.size > 0) {
  console.error(`Unprefixed GitHub Pages assets (${unprefixedPagesAssets.size}):`);
  for (const path of unprefixedPagesAssets) console.error(`- ${path}`);
  process.exit(1);
}

if (missing.size > 0) {
  console.error(`Missing local assets (${missing.size}):`);
  for (const path of missing) console.error(`- ${path}`);
  process.exit(1);
}

console.log("All referenced local static assets exist.");
