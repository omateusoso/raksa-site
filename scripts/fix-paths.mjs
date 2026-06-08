import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const pagesBase = "raksadesign";
const textExtensions = new Set([".css", ".html", ".js", ".json", ".mjs"]);
const skippedDirectories = new Set([".git", "node_modules"]);

function isTextFile(path) {
  return textExtensions.has(path.slice(path.lastIndexOf("."))) || /\.m?js@/.test(path);
}

function walk(directory, files = []) {
  for (const name of readdirSync(directory)) {
    if (skippedDirectories.has(name)) continue;

    const path = join(directory, name);
    const stats = statSync(path);

    if (stats.isDirectory()) walk(path, files);
    else if (isTextFile(path)) files.push(path);
  }

  return files;
}

let changed = 0;

for (const file of walk(root)) {
  if (file.endsWith("scripts/fix-paths.mjs")) continue;

  const source = readFileSync(file, "utf8");
  const assetBase = `/${pagesBase}`;
  let next = source
    .replaceAll(`./${pagesBase}/framerusercontent.com/`, `${assetBase}/framerusercontent.com/`)
    .replaceAll(`./${pagesBase}/vendor/`, `${assetBase}/vendor/`)
    .replaceAll(`${assetBase}/framerusercontent.com/`, "/framerusercontent.com/")
    .replaceAll(`${assetBase}/vendor/`, "/vendor/")
    .replaceAll("/framerusercontent.com/", `${assetBase}/framerusercontent.com/`)
    .replaceAll("/vendor/", `${assetBase}/vendor/`)
    .replaceAll('href="/admin/', 'href="./admin/')
    .replaceAll('src="/admin/', 'src="./admin/')
    .replaceAll('"/admin/data/cases.json"', '"./data/cases.json"');

  if (next !== source) {
    writeFileSync(file, next);
    changed += 1;
  }
}

console.log(`Caminhos corrigidos em ${changed} arquivos.`);
