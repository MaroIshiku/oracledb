import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const repo = path.resolve(root, "..", "..");
const dataRoot = path.join(repo, "Wiki page", "Data");
const canonRoot = path.join(repo, "oracle_data");

const categorySources = {
  char: path.join(dataRoot, "Char"),
  ae: path.join(dataRoot, "AEs"),
  dossier: path.join(dataRoot, "Knowledge"),
};

const dossierCanonIds = {
  "ORACLE-BASIS-001": "LOC-MERIDIAN",
  "ORACLE-BASIS-002": "LOC-TARTAROS",
  "ORACLE-FAZ-0051": "ASSET-VANDURA",
  "ORACLE-INT-0001": "ORG-ORACLE",
};

const statusLabels = {
  active_bound_to_annina: "Aktiv — an Annina gebunden",
  active_internal_and_external_crisis: "Aktiv — interne und externe Krise",
  available: "Aktiv — verfügbar",
  available_command: "Aktiv — Kommando",
  available_exhausted: "Aktiv — felderschöpft",
  available_under_investigation: "Aktiv — unter Prüfung",
  availability_unclear_unresponsive: "Verfügbarkeit unklar — schweigt",
  availability_unconfirmed: "Aktiv — Verfügbarkeit nicht bestätigt",
  contained_latency: "Enthalten — stabile Latenz",
  contained_stable_effect_persists: "Enthalten — stabil, Nachwirkung aktiv",
  cooperative_exhausted: "Kooperativ — erschöpft",
  dormant_conditional_containment: "Schlafend — bedingte Eindämmung",
  dormant_not_neutralized: "Ruhend — nicht neutralisiert",
  internal_crisis: "Aktiv — interne Krise",
  partially_repelled_primary_active: "Teilweise zurückgedrängt — Primärform aktiv",
  protected_status_location_imprecise: "Geschützter Status — Ort ungenau",
  stable_minimal_staff: "Stabil — minimal besetzt",
  status_uncertain_after_manifestation: "Status nach Manifestation unklar",
  unavailable_unresponsive: "Nicht verfügbar — schweigt",
  unreachable_active_containment: "Aktiv, aber unerreichbar — hält Eindämmung",
};

const cleanLine = (line) => line.replace(/^[-—]\s*/, "").replace(/\s+/g, " ").trim();
const isImage = (file) => /\.(png|jpe?g|webp)$/i.test(file);

function articleId(kind, file, text) {
  if (kind === "char") {
    return file.match(/^(ORG-\d+)/i)?.[1]?.toUpperCase() ?? file.split(" ")[0].toUpperCase();
  }
  return cleanLine(text.replace(/\r\n/g, "\n").split("\n").find(Boolean) ?? file.split(" ")[0]).toUpperCase();
}

function findRecord(document, id) {
  if (document?.id === id) return document;
  return document?.records?.find((record) => record.id === id) ?? null;
}

function statusLabel(status) {
  if (!status) return "Nicht vermerkt";
  return statusLabels[status] ?? status.replaceAll("_", " ");
}

async function main() {
  const categories = {};
  const images = [];
  const imageOutput = path.join(root, "assets", "img");
  await fs.mkdir(imageOutput, { recursive: true });

  for (const [kind, source] of Object.entries(categorySources)) {
    const files = (await fs.readdir(source)).sort((a, b) => a.localeCompare(b, "de"));
    categories[kind] = [];
    for (const file of files) {
      if (file.toLowerCase().endsWith(".txt")) {
        const text = await fs.readFile(path.join(source, file), "utf8");
        categories[kind].push({ file: `${kind}/${file}`, id: articleId(kind, file, text), text });
      } else if (isImage(file)) {
        const cleanName = file.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
        await fs.copyFile(path.join(source, file), path.join(imageOutput, cleanName));
        images.push({ kind, file: cleanName });
      }
    }
  }

  const canonState = JSON.parse(await fs.readFile(path.join(canonRoot, "canon_state.json"), "utf8"));
  const registry = JSON.parse(await fs.readFile(path.join(canonRoot, "provenance", "id_registry.json"), "utf8"));
  const documentCache = new Map();
  const records = new Map();

  for (const row of registry.records) {
    if (!documentCache.has(row.path)) {
      try {
        documentCache.set(row.path, JSON.parse(await fs.readFile(path.join(canonRoot, row.path), "utf8")));
      } catch {
        documentCache.set(row.path, null);
      }
    }
    const record = findRecord(documentCache.get(row.path), row.id);
    if (record) records.set(row.id, { record, path: row.path });
  }

  const wikiCanon = {};
  for (const entries of Object.values(categories)) {
    for (const entry of entries) {
      const canonicalId = dossierCanonIds[entry.id] ?? entry.id;
      const found = records.get(canonicalId);
      if (!found) continue;
      const current = found.record.current_state ?? {};
      const locationId = current.location_id ?? null;
      const locationRecord = locationId ? records.get(locationId)?.record : null;
      wikiCanon[entry.id] = {
        canonical_id: canonicalId,
        name: found.record.name ?? null,
        status: found.record.status ?? current.status ?? null,
        status_label: statusLabel(found.record.status ?? current.status),
        location_id: locationId,
        location_label: locationRecord?.name ?? locationId,
        record_path: found.path,
      };
    }
  }

  const snapshot = {
    schema_version: "1.0.0",
    generated_from_canon: canonState.last_updated,
    canon_cutoff: canonState.cutoff,
    next_story_ref: canonState.next_story_ref,
    next_story_status: canonState.next_story_status,
    canon_state: canonState,
    registered_ids: registry.records.map((row) => row.id).sort(),
    wiki_canon: wikiCanon,
    images,
    categories,
  };

  const target = path.join(root, "content", "wiki-source.json");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Synchronized ${Object.values(categories).flat().length} dossiers and ${Object.keys(wikiCanon).length} canon summaries.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
