import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const casesDir = join(root, "cases");
const outputFile = join(root, "admin", "data", "cases.json");
const handoverMarker = '<script type="framer/handover" id="__framer__handoverData">';
const tagLabels = [
  ["uiux", "UI/UX Design"],
  ["desenvolvimento", "Desenvolvimento"],
  ["branding", "Branding"],
  ["editorial", "Editorial"],
];

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanImageUrl(url) {
  return url.replace(/&amp;/g, "&");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function typedEntry(data, ref) {
  const entry = data[ref];
  if (!entry || typeof entry !== "object" || !("value" in entry)) return undefined;
  return entry;
}

function typedValue(data, ref) {
  const entry = typedEntry(data, ref);
  if (!entry) return undefined;
  return data[entry.value];
}

function currentCaseRecord(data) {
  return data.find((entry) => entry && typeof entry === "object" && !Array.isArray(entry) && entry.g67MmmUYm);
}

function normalizeExternalUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return value;
  if (value.startsWith("/") || !value.includes(".")) return "";
  return `https://${value}`;
}

function readHandoverData(html) {
  const start = html.indexOf(handoverMarker);
  if (start < 0) return null;

  const jsonStart = start + handoverMarker.length;
  const end = html.indexOf("</script>", jsonStart);
  if (end < 0) return null;

  try {
    return JSON.parse(html.slice(jsonStart, end));
  } catch {
    return null;
  }
}

function imageSrcFromRecord(data, imageEntryRef) {
  const imageEntry = typedValue(data, imageEntryRef);
  const imageRecord = typedValue(data, imageEntry?.wqkNFeLx5);
  if (!imageRecord || typeof imageRecord !== "object") return "";

  return cleanImageUrl(data[imageRecord.src] || "");
}

function extractGalleryImages(html) {
  const data = readHandoverData(html);
  if (!data) return [];

  const currentCase = currentCaseRecord(data);
  const imageRefs = typedValue(data, currentCase?.g67MmmUYm);
  if (!Array.isArray(imageRefs)) return [];

  return unique(imageRefs.map((ref) => imageSrcFromRecord(data, ref)));
}

function extractExternalUrl(html) {
  const data = readHandoverData(html);
  if (!data) return "";

  const currentCase = currentCaseRecord(data);
  if (!currentCase) return "";

  for (const ref of Object.values(currentCase)) {
    const entry = typedEntry(data, ref);
    if (entry?.type !== "link") continue;
    const url = normalizeExternalUrl(data[entry.value]);
    if (url) return url;
  }

  return "";
}

function extractDescription(text, title, tags) {
  let description = text.replaceAll(`${title} - Raksa Design`, " ").replaceAll(title, " ");
  for (const tag of tags) description = description.replaceAll(tag, " ");
  description = description.replace(/\bAcessar website\b/g, " ").replace(/\s+/g, " ").trim();
  return description.slice(0, 720);
}

const cases = readdirSync(casesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const slug = entry.name;
    const html = readFileSync(join(casesDir, slug, "index.html"), "utf8");
    const title = (html.match(/<title>(.*?)\s+-\s+Raksa Design<\/title>/)?.[1] || slug)
      .replace(/&amp;/g, "&")
      .trim();
    const text = stripHtml(html);
    const tags = tagLabels.filter(([, label]) => text.includes(label)).map(([, label]) => label);
    const galleryImages = extractGalleryImages(html);
    const externalUrl = extractExternalUrl(html);
    const fallbackImages = unique([...html.matchAll(/<img [^>]*src="([^"]+)"/g)].map((match) => cleanImageUrl(match[1])));
    const images = galleryImages.length ? galleryImages : fallbackImages;
    const cover = images[0] || "";

    return {
      id: slug,
      slug,
      title,
      tags,
      description: extractDescription(text, title, tags),
      cover,
      images,
      externalUrl,
      updatedAt: new Date().toISOString(),
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));

mkdirSync(join(root, "admin", "data"), { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(cases, null, 2)}\n`);
console.log(`Generated ${cases.length} admin cases at ${outputFile}`);
