import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const localCases = JSON.parse(readFileSync(join(root, "admin/data/cases.json"), "utf8"));
const supabaseConfig = parseSupabaseConfig(readFileSync(join(root, "admin/supabase-config.js"), "utf8"));
const bySlug = new Map(localCases.map((item) => [normalizeSlug(item.slug), item]));
const skippedDirectories = new Set([".git", "node_modules"]);

if (supabaseConfig) {
  const remoteCases = await loadSupabaseCases(supabaseConfig);
  for (const item of remoteCases) bySlug.set(normalizeSlug(item.slug), item);
}

function normalizeSlug(value = "") {
  return String(value).normalize("NFC");
}

function parseSupabaseConfig(source) {
  const url = source.match(/url:\s*["']([^"']+)["']/)?.[1];
  const anonKey = source.match(/anonKey:\s*["']([^"']+)["']/)?.[1];
  return url && anonKey ? { url, anonKey } : null;
}

async function loadSupabaseCases(config) {
  const url = new URL("/rest/v1/cases", config.url);
  url.searchParams.set("select", "slug,cover");
  url.searchParams.set("published", "eq.true");
  url.searchParams.set("order", "title.asc");

  const response = await fetch(url, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Nao foi possivel carregar cases do Supabase: ${message || response.statusText}`);
  }

  return response.json();
}

function walk(directory, files = []) {
  for (const name of readdirSync(directory)) {
    if (skippedDirectories.has(name)) continue;

    const path = join(directory, name);
    const stats = statSync(path);
    if (stats.isDirectory()) walk(path, files);
    else if (path.endsWith(".html")) files.push(path);
  }

  return files;
}

function typedValue(data, ref) {
  const entry = data[ref];
  if (!entry || typeof entry !== "object" || !("value" in entry)) return undefined;
  return data[entry.value];
}

function coverSrcSet(cover) {
  if (!cover) return "";
  if (cover.includes("width=788") && cover.includes("height=434")) {
    return `${cover.replace("?", "?scale-down-to=512&")} 512w,${cover} 788w`;
  }
  return cover;
}

function patchHandoverJson(json) {
  const data = JSON.parse(json);
  let changed = 0;

  for (const entry of data) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    if (!entry.KRVExH2Fv || !entry.CfLxrmguJ) continue;

    const slug = typedValue(data, entry.KRVExH2Fv);
    const caseData = bySlug.get(normalizeSlug(slug));
    if (!caseData?.cover) continue;

    const imageRecord = typedValue(data, entry.CfLxrmguJ);
    if (!imageRecord || typeof imageRecord !== "object") continue;

    const currentSrc = data[imageRecord.src];
    const currentSrcSet = data[imageRecord.srcSet];
    const nextSrcSet = coverSrcSet(caseData.cover);

    if (currentSrc !== caseData.cover) {
      data[imageRecord.src] = caseData.cover;
      changed += 1;
    }
    if (currentSrcSet !== nextSrcSet) {
      data[imageRecord.srcSet] = nextSrcSet;
      changed += 1;
    }
  }

  return { json: changed ? JSON.stringify(data) : json, changed };
}

let changedFiles = 0;
let changedEntries = 0;
const marker = '<script type="framer/handover" id="__framer__handoverData">';

for (const file of walk(root)) {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf(marker);
  if (start < 0) continue;

  const jsonStart = start + marker.length;
  const end = source.indexOf("</script>", jsonStart);
  if (end < 0) continue;

  const result = patchHandoverJson(source.slice(jsonStart, end));
  if (!result.changed) continue;

  writeFileSync(file, `${source.slice(0, jsonStart)}${result.json}${source.slice(end)}`);
  changedFiles += 1;
  changedEntries += result.changed;
}

console.log(`Capas sincronizadas em ${changedFiles} arquivos (${changedEntries} campos atualizados).`);
