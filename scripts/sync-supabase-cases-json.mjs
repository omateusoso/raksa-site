import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const casesPath = join(root, "admin/data/cases.json");
const configSource = readFileSync(join(root, "admin/supabase-config.js"), "utf8");
const config = parseSupabaseConfig(configSource);

if (!config) throw new Error("Supabase nao configurado em admin/supabase-config.js.");

const remoteCases = await loadSupabaseCases(config);
const remoteBySlug = new Map(remoteCases.map((item) => [normalizeSlug(item.slug), item]));
const localCases = JSON.parse(readFileSync(casesPath, "utf8"));
let changed = 0;

for (const item of localCases) {
  const remote = remoteBySlug.get(normalizeSlug(item.slug));
  if (!remote) continue;

  if (remote.cover && item.cover !== remote.cover) {
    item.cover = remote.cover;
    changed += 1;
  }

  if (Array.isArray(remote.images) && JSON.stringify(item.images || []) !== JSON.stringify(remote.images)) {
    item.images = remote.images;
    changed += 1;
  }
}

writeFileSync(casesPath, `${JSON.stringify(localCases, null, 2)}\n`);
console.log(`cases.json sincronizado: ${changed} campos atualizados.`);

function normalizeSlug(value = "") {
  return String(value || "").normalize("NFC");
}

function parseSupabaseConfig(source) {
  const url = source.match(/url:\s*["']([^"']+)["']/)?.[1];
  const anonKey = source.match(/anonKey:\s*["']([^"']+)["']/)?.[1];
  return url && anonKey ? { url, anonKey } : null;
}

async function loadSupabaseCases({ url, anonKey }) {
  const endpoint = new URL("/rest/v1/cases", url);
  endpoint.searchParams.set("select", "slug,cover,images");
  endpoint.searchParams.set("order", "title.asc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Nao foi possivel carregar cases do Supabase: ${message || response.statusText}`);
  }

  return response.json();
}
