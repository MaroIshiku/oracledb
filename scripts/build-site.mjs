import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const contentPath = path.join(root, "content", "wiki-source.json");
const personnelTagsPath = path.join(root, "content", "personnel-tags.json");
let contentSnapshot;
let personnelTags;

const categories = {
  char: {
    title: "Mitarbeiter",
    tab: "Personal",
    route: "mitarbeiter",
    clearance: "Stufe 4 - Personalakten",
  },
  ae: {
    title: "Anomale Entitäten",
    tab: "Entitäten",
    route: "ae",
    clearance: "Stufe 2 - Feldzugang",
  },
  dossier: {
    title: "Dossiers",
    tab: "Dossiers",
    route: "dossier",
    clearance: "Stufe 3 - Archivzugang",
  },
};

let routeById = new Map();
const assetVersion = "20260909-1";

const escapeHtml = (value = "") =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const slugFromId = (id) => id.toLowerCase().replace(/^oracle-/, "").replace(/[^a-z0-9]/g, "");
const slugFromText = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
const headingKey = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const cleanLine = (line) =>
  line
    .replace(/^\uFEFF/, "")
    .replace(/^[-—]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

const isImage = (file) => /\.(png|jpe?g|webp)$/i.test(file);

function splitBlocks(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function titleFromFilename(file) {
  return path.basename(file, path.extname(file)).replace(/\s+/g, " ").trim();
}

function parseIdFromFilename(file) {
  const name = titleFromFilename(file);
  const match = name.match(/^(AE-\d+|ORG-\d+|BASIS-\d+|FAZ-\d+|INT-\d+|ORACLE-[A-Z]+-\d+|ORACLE-INT-\d+)/i);
  return match?.[1]?.toUpperCase() ?? name.split(" ")[0].toUpperCase();
}

function parseTextArticle(file, kind, text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  const id = kind === "char" ? parseIdFromFilename(file) : cleanLine(nonEmpty[0] ?? parseIdFromFilename(file));
  const fileTitle = titleFromFilename(file);

  let title = "";
  let subtitle = "";
  let bodyStart = 0;
  let status = "Aktiv";
  let danger = "Intern";
  let location = "nicht vermerkt";
  let role = "nicht vermerkt";
  let codename = "";
  let identification = {};
  let notice = null;

  if (kind === "char") {
    const nameFromFile = fileTitle.replace(/^ORG-\d+\s*/i, "").trim();
    title = nameFromFile || id;
    const profileLine = lines.findIndex((line) => cleanLine(line).includes("Operatives Profil"));
    bodyStart = profileLine >= 0 ? profileLine + 1 : 0;
    const identificationStart = nonEmpty.findIndex((line) => cleanLine(line).includes("IDENTIFIKATION"));
    const preamble = identificationStart > 0 ? nonEmpty.slice(0, identificationStart).map(cleanLine).filter(Boolean) : [];
    if (preamble.length && /^(⚠|Warn|Sonderstatus|Sicherheit|Loyalität)/i.test(preamble[0])) {
      notice = { title: preamble[0].replace(/^⚠+\s*/, ""), body: preamble.slice(1).join(" ") };
    }

    for (let index = 0; index < nonEmpty.length; index += 1) {
      const current = cleanLine(nonEmpty[index]);
      const next = cleanLine(nonEmpty[index + 1] ?? "");
      if (current === "Bürgerlicher Name" && next && !/^(—|-|\[?redacted\]?)$/i.test(next)) title = next;
      if (current === "Codename" && next) codename = next;
      if (current === "Rolle" && next) role = next;
      if (current === "Nationalität" && next) location = next;
    }
    identification = extractIdentification(nonEmpty);
    subtitle = codename || role || "Interne Personalakte";
    danger = role.includes("Direktor") ? "Direktion" : "Personal";
  } else {
    title = cleanLine(nonEmpty[1] ?? fileTitle.replace(new RegExp(`^${id}\\s*`, "i"), ""));
    subtitle = cleanLine(nonEmpty[2] ?? categories[kind].title);
    let nonEmptySeen = 0;
    bodyStart = lines.length;
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].trim()) continue;
      nonEmptySeen += 1;
      if (nonEmptySeen === 3) {
        bodyStart = index + 1;
        break;
      }
    }

    const headerLines = nonEmpty.slice(0, 14);
    const statusLine = headerLines.find((line) => /Status:/i.test(line)) ?? "";
    const dangerLine = headerLines.find((line) => /Kategorie\s*[IVX]+|Freigabestufe:/i.test(line)) ?? "";
    const locationLine = nonEmpty.find((line) => /Standort:/i.test(line)) ?? "";
    status = statusLine.match(/Status:\s*([^·\n]+)/i)?.[1]?.trim() ?? status;
    danger =
      dangerLine.match(/Kategorie\s*([IVX]+)/i)?.[0]?.trim() ??
      dangerLine.match(/Freigabestufe:\s*([^.—]+)/i)?.[1]?.trim() ??
      danger;
    location =
      locationLine.match(/Standort:\s*([^.\n]+)/i)?.[1]?.trim() ??
      locationLine.match(/Aktueller Standort:\s*([^.\n]+)/i)?.[1]?.trim() ??
      location;
  }

  const rawBody = lines.slice(bodyStart).join("\n");
  const sections = parseSections(rawBody, kind, id);
  const summary = firstParagraph(sections) || subtitle;
  const tags = makeTags({ kind, id, status, danger, role });

  return {
    id,
    slug: slugFromId(id),
    kind,
    title,
    subtitle,
    summary,
    status,
    danger,
    location,
    role,
    codename,
    tags,
    identification,
    notice,
    sections,
    sourceFile: file,
    image: null,
  };
}

function extractIdentification(lines) {
  const labels = new Set(["Bürgerlicher Name", "Eingetragener Name", "Rufname", "Codename", "Alter", "Nationalität", "Rolle"]);
  const data = {};
  for (let index = 0; index < lines.length; index += 1) {
    const label = cleanLine(lines[index]);
    const value = cleanLine(lines[index + 1] ?? "");
    if (labels.has(label) && value && !labels.has(value)) {
      data[label] = value;
    }
  }
  return data;
}

const cleanBodyLine = (line) => line.replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();

function sectionTagConfig(articleId, sectionTitle) {
  const articleConfig = personnelTags?.articles?.[articleId] ?? {};
  const matchingTitle = Object.keys(articleConfig).find((title) => headingKey(title) === headingKey(sectionTitle));
  return matchingTitle ? articleConfig[matchingTitle] : null;
}

function collapseParagraphs(rawLines) {
  const paragraphs = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    paragraphs.push(current.join(" ").replace(/\s+/g, " ").trim());
    current = [];
  };

  for (const rawLine of rawLines) {
    const line = cleanBodyLine(rawLine);
    if (!line) {
      flush();
      continue;
    }
    const isStandaloneLine =
      line.startsWith("//") ||
      /^[—-]/.test(line) ||
      /^\d+[.)]\s/.test(line) ||
      /^[„“"]/.test(line) ||
      /^(?:AE-\d+|Einrichtung .+)\s+—\s+/.test(line) ||
      /^(Datenbankkennung|Eckdaten|Gefahrenprofil|Eskalationsszenarien|Anmerkung zur Datenvollständigkeit|Operative Anmerkung|Umgebungskontrolle & Versorgung|Sicherheitsprotokolle)\b/i.test(line);
    if (isStandaloneLine) {
      flush();
      paragraphs.push(line);
      continue;
    }
    current.push(line);
  }
  flush();
  return paragraphs;
}

function finalizeSection(section, kind, articleId) {
  const config = kind === "char" ? sectionTagConfig(articleId, section.title) : null;
  const rawLines = [...section.rawLines];

  if (config?.source_line) {
    const sourceLine = cleanBodyLine(config.source_line);
    const matches = rawLines
      .map((line, index) => ({ line: cleanBodyLine(line), index }))
      .filter((entry) => entry.line === sourceLine);
    if (matches.length !== 1) {
      throw new Error(`Tag source line for ${articleId} / ${section.title} was found ${matches.length} times.`);
    }
    rawLines.splice(matches[0].index, 1);
  }

  return {
    title: section.title,
    body: collapseParagraphs(rawLines),
    tags: config?.tags ?? [],
  };
}

function parseSections(rawBody, kind, articleId) {
  const rawLines = rawBody.split("\n");
  const lines = rawLines.map(cleanLine).filter(Boolean);
  const expectedHeadings = lines
    .map((line) => line.match(/^\d+\s*[—-]\s*(.+)$/)?.[1])
    .filter(Boolean)
    .map(cleanLine);
  const expectedKeys = expectedHeadings.map(headingKey);
  const sections = [];
  let current = { title: kind === "char" ? "Operatives Profil" : "Überblick", rawLines: [] };

  const headingHints = new Set([
    "Überblick",
    "Klassifizierung & Kenndaten",
    "Erscheinungsbild",
    "Kommunikation & Verhalten",
    "Fähigkeiten & Artefakte (Die Blumen)",
    "ORACLE-Erstkontakt (Transsilvanien K03)",
    "Geschichte & Herkunft",
    "Äußeres Erscheinungsbild & Zugang",
    "Technische Ausstattung & Sicherheit",
    "Interne Struktur",
    "Atmosphäre & interne Kultur",
    "Verhältnis zur Meridian",
    "Psychisches Wesen",
    "Besonderheit",
    "Primärfähigkeit",
    "Schwäche & Grenzen",
    "Vorgeschichte",
    "Rekrutierungsgrund",
    "Der Ausbruch",
    "Gründung von ORACLE — 1947",
    "Nadeya — ORG-0005",
    "Das Zeitachsenereignis — 1951",
    "Rückkehr — 2011",
    "Struktur & Betrieb",
    "Finanzierung",
    "Basen & Infrastruktur",
    "Ethische Grundsätze",
  ]);

  const hasContent = (section) => section.rawLines.some((line) => cleanBodyLine(line));
  const pushCurrent = () => {
    const finalized = finalizeSection(current, kind, articleId);
    if (finalized.body.length || finalized.tags.length) sections.push(finalized);
  };

  for (const rawLine of rawLines) {
    const line = cleanLine(rawLine);
    if (!line) {
      current.rawLines.push("");
      continue;
    }
    if (line.startsWith("// INHALT") || /^\d+\s*[—-]/.test(line)) continue;
    if (/^Dieser Artikel ist Teil der internen ORACLE-Datenbank/i.test(line)) continue;
    const isCommentHeading = /^\/\/\s*(Auszug|Ereignis-Update|Medizinischer Zusatz|Feldvermerk|Feldwarnung|Direktion)/i.test(line);
    const normalized = line.replace(/^\/\/\s*/, "").trim();
    const normalizedKey = headingKey(normalized);
    const headingLikeLength = normalized.length <= 90;
    const isExpectedHeading = headingLikeLength && expectedKeys.includes(normalizedKey);
    const isLevelHeading = /^(Ebene\s+\d+\s*[—-]|Tieferliegende Schächte\s*[—-])/i.test(normalized);
    const isEventHeading = /^Ereignisbericht\s*:/i.test(normalized);
    const hasBulletPrefix = /^\s*[—-]/.test(rawLine);
    const isHeading = !hasBulletPrefix && (headingHints.has(normalized) || isExpectedHeading || isCommentHeading || isLevelHeading || isEventHeading);

    if (isHeading && hasContent(current)) {
      pushCurrent();
      current = { title: normalized, rawLines: [] };
    } else if (isHeading) {
      current.title = normalized;
    } else {
      current.rawLines.push(rawLine);
    }
  }

  if (hasContent(current) || sectionTagConfig(articleId, current.title)) pushCurrent();

  if (kind === "char") {
    const configuredTitles = Object.keys(personnelTags?.articles?.[articleId] ?? {});
    const renderedKeys = new Set(sections.map((section) => headingKey(section.title)));
    const missing = configuredTitles.filter((title) => !renderedKeys.has(headingKey(title)));
    if (missing.length) throw new Error(`Configured tag sections missing for ${articleId}: ${missing.join(", ")}`);
  }
  return sections;
}

function firstParagraph(sections) {
  const first = sections.flatMap((section) => section.body).find((line) => line.length > 45);
  if (!first) return "";
  return first.length > 260 ? `${first.slice(0, 257).trim()}...` : first;
}

function makeTags(article) {
  const tags = [categories[article.kind].tab, article.status, article.danger, article.role]
    .filter(Boolean)
    .map((tag) => tag.replace(/\s+/g, " ").trim())
    .filter((tag) => tag && tag !== "nicht vermerkt");
  return [...new Set(tags)].slice(0, 4);
}

function resolveArticleRoute(id) {
  const normalized = id.toUpperCase();
  return routeById.get(normalized) ?? routeById.get(normalized.replace(/^ORACLE-/, "")) ?? routeById.get(`ORACLE-${normalized}`);
}

function renderInline(text, currentArticle = null) {
  let safe = escapeHtml(text);
  safe = safe.replace(/_{3,}|█{2,}/g, '<span class="redacted" data-redacted data-length="8">REDACTED</span>');
  safe = safe.replace(/(\[)?\b((?:ORACLE-)?(?:ORG|AE|BASIS|FAZ|INT)-\d+)\b(\])?/gi, (match, open, id, close) => {
    const label = `${open ?? ""}${id}${close ?? ""}`;
    const route = resolveArticleRoute(id);
    if (currentArticle && route === articleUrl(currentArticle)) return label;
    if (!route) return `<span class="wiki-ref missing">${label}</span>`;
    return `<a class="wiki-ref" href="${route}">${label}</a>`;
  });
  return safe;
}

function renderToc(article) {
  const items = article.sections
    .map((section, index) => `<a class="wiki-toc-item" href="#${sectionId(section, index)}">${index + 1}. ${escapeHtml(section.title)}</a>`)
    .join("\n");
  return `<nav class="wiki-toc" aria-label="Inhaltsverzeichnis">
            <div class="wiki-toc-label">// INHALT</div>
            ${items}
          </nav>`;
}

function sectionId(section, index) {
  return `${index + 1}-${slugFromText(section.title)}`;
}

function renderIdentification(article) {
  if (article.kind !== "char") return "";
  const id = article.identification ?? {};
  const cell = (label, value, extra = "") => `<div class="id-cell"><div class="id-lbl">${label}</div><div class="id-val ${extra}">${renderInline(value || "nicht vermerkt", article)}</div></div>`;
  const registeredName = id["Eingetragener Name"];
  return `<section class="identity-block" aria-label="Identifikation">
            <div class="id-sbar">// - // IDENTIFIKATION // - //</div>
            <div class="id-grid">
              ${cell(registeredName ? "Eingetragener Name" : "Buergerlicher Name", registeredName || id["Bürgerlicher Name"])}
              ${cell("Rufname", id.Rufname)}
              ${cell("Codename", id.Codename, "cn")}
              ${cell("Alter", id.Alter)}
              ${cell("Nationalitaet", id["Nationalität"])}
              ${cell("Rolle", id.Rolle)}
            </div>
          </section>`;
}

function renderNotice(article) {
  if (!article.notice) return "";
  return `<aside class="dossier-warning" aria-label="Aktenwarnung">
            <div class="dossier-warning-title">⚠ ${escapeHtml(article.notice.title)}</div>
            <div class="dossier-warning-body">${renderInline(article.notice.body || "Zusätzliche Freigabe erforderlich.", article)}</div>
          </aside>`;
}

function renderTraitPills(tokens, article) {
  const pills = tokens
    .map((token) => token.replace(/:\s*/g, " ").replace(/\s+/g, " ").trim())
    .map((token) => `<span class="trait-pill">${renderInline(token, article)}</span>`)
    .join("");
  return `<div class="trait-pills" aria-label="Akten-Tags">${pills}</div>`;
}

function displayedStatus(article) {
  return article.canon?.status_label || article.status;
}

function displayedLocation(article) {
  if (!article.canon?.location_id) return article.location || article.role || categories[article.kind].title;
  return article.canon.location_label && article.canon.location_label !== article.canon.location_id
    ? `${article.canon.location_label} (${article.canon.location_id})`
    : article.canon.location_id;
}

function renderWikiFooter(article) {
  return `<footer class="wiki-footer">
            <span>Datenbankkennung: ${escapeHtml(article.id)}</span>
            <span>Kategorie: ${escapeHtml(categories[article.kind].title)}</span>
            <span>Synchronisation: Oracle.DB</span>
            <span>Status: statisch gesichert</span>
          </footer>`;
}

function renderSection(section, index, article) {
  const specialVoss = /direktor voss/i.test(section.title);
  const body = section.body
    .map((line) => {
      if (line.startsWith("//")) {
        return `<div class="protocol"><b>Interner Vermerk</b>${renderInline(line.replace(/^\/\/\s*/, ""), article)}</div>`;
      }
      if (/^(⚠|Warn|Sonderstatus)/i.test(line)) {
        return `<div class="note"><b>Warnhinweis</b>${renderInline(line, article)}</div>`;
      }
      return `<p>${renderInline(line, article)}</p>`;
    })
    .join("\n");
  if (specialVoss) {
    return `<section class="voss-block" id="${sectionId(section, index)}"><div class="voss-lbl">// ${escapeHtml(section.title)}</div><div class="voss-cnt">${section.body.map((line) => renderInline(line, article)).join("<br>")}</div></section>`;
  }
  const tags = section.tags?.length ? renderTraitPills(section.tags, article) : "";
  return `<h2 id="${sectionId(section, index)}">${escapeHtml(section.title)}</h2>\n${body}${tags}`;
}

function loginMarkup() {
  return `<div class="login" id="login">
    <section class="login-box">
      <div class="login-head">
        <div><div class="brand">Oracle.DB</div><div class="sub">internes Aktenprogramm</div></div>
        <div class="clearance">Zugriffsstufe 5</div>
      </div>
      <div class="login-body">
        <div class="field"><div class="label">Operator</div><div class="input" id="loginUser"></div></div>
        <div class="field"><div class="label">Authentifizierungsschlüssel</div><div class="input" id="loginPass"></div></div>
        <div class="login-status"><span class="pulse"></span><span id="loginStatus">Sitzung wird initialisiert</span></div>
      </div>
    </section>
  </div>`;
}

function head(title) {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="icon" type="image/png" href="/assets/img/oracle-logo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600&family=Rajdhani:wght@600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/oracle.css?v=${assetVersion}">
</head>`;
}

function topbar(meta = "Meridian-Knoten // Aktenindex // statische Routen aktiv") {
  return `<header class="topbar">
      <a class="system-brand" href="/index/" aria-label="Oracle.DB Index">
        <img src="/assets/img/oracle-logo.png?v=${assetVersion}" width="36" height="36" alt="">
        <span class="system-title">Oracle<span>.DB</span></span>
      </a>
      <div class="topmeta">${escapeHtml(meta)}</div>
      <button class="nav-toggle" type="button" data-nav-toggle aria-controls="oracle-sidebar" aria-expanded="false">AKTEN</button>
      <div class="user-chip"><span class="pulse"></span> EVOSS // Direktorin</div>
    </header>`;
}

function sidebar(allArticles, active, activeKind = active?.kind) {
  const records = allArticles
    .filter((article) => !activeKind || article.kind === activeKind)
    .sort((a, b) => a.id.localeCompare(b.id, "de"))
    .map((article) => {
      const isActive = article.id === active?.id;
      const cls = isActive ? "record active" : "record";
      const tag = isActive ? "div" : "a";
      const href = isActive ? "" : ` href="${articleUrl(article)}"`;
      const searchText = `${article.id} ${article.title} ${article.subtitle} ${article.tags.join(" ")}`.toLowerCase();
      return `<${tag} class="${cls}"${href} data-record data-search="${escapeHtml(searchText)}">
            <div class="record-id">${escapeHtml(article.id)}</div>
            <div class="record-name">${renderInline(article.title, article)}</div>
            <div class="record-tags">${article.tags.slice(0, 2).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
          </${tag}>`;
    })
    .join("\n");

  return `<aside class="sidebar" id="oracle-sidebar" data-sidebar>
        <div class="nav-section">
          <div class="section-label">Archivzugriff</div>
          <input class="search" data-search-input placeholder="AKTE SUCHEN" value="${escapeHtml(active?.id ?? "")}" aria-label="Suche">
          <div class="tabs">
            ${Object.entries(categories).map(([kind, category]) => `<a class="tab ${kind === activeKind ? "active" : ""}" href="/${category.route}/">${category.tab}</a>`).join("")}
          </div>
        </div>
        <div class="record-list">${records}</div>
      </aside>`;
}

function navOverlay() {
  return `<button class="nav-overlay" type="button" data-nav-overlay aria-label="Aktennavigation schliessen"></button>`;
}

function articleUrl(article) {
  return `/${categories[article.kind].route}/${article.slug}/`;
}

function signalPanel(article, chronicle) {
  const canonSignal = article?.canon
    ? `${article.canon.status_label}${article.canon.location_id ? `; Ort: ${article.canon.location_label || article.canon.location_id}` : ""}. Quelle: ${article.canon.record_path}.`
    : "Keine einzelne Akte ausgewählt.";
  return `<aside class="rightbar">
        <div class="section-label">Systemsignale</div>
        <div class="signal-card"><div class="signal-title">Chronik-Spiegel</div><div class="signal-body">${escapeHtml(chronicle)}</div></div>
        <div class="signal-card"><div class="signal-title">Aktueller Kanon</div><div class="signal-body">${escapeHtml(canonSignal)}</div></div>
        <div class="signal-card"><div class="signal-title">Archivstatus</div><div class="signal-body">${escapeHtml(article ? `Akte ${article.id} im lokalen Oracle.DB-Knoten verfügbar.` : "Register im lokalen Oracle.DB-Knoten verfügbar.")}</div></div>
        <div class="signal-card"><div class="signal-title">Zugriffsstufe</div><div class="signal-body">${escapeHtml(article ? categories[article.kind].clearance : "Stufe 5 - Direktion")}</div></div>
      </aside>`;
}

function renderMedia(article) {
  if (article.image) {
    return `<img class="dossier-image" src="${article.image}" alt="${escapeHtml(article.title)}">`;
  }
  if (article.kind === "char") {
    return `<div class="portrait-redacted" aria-label="Personenbild geschwärzt">
              <div class="portrait-head"></div>
              <div class="portrait-shoulders"></div>
              <span data-redacted data-length="12">CLASSIFIED</span>
            </div>`;
  }
  return `<div class="image-frame">Bildplatzhalter<br>${escapeHtml(article.id)}</div>`;
}

function ticker() {
  return `<footer class="ticker"><div class="ticker-track">
      <span><b>ORACLE.DB</b> Meridian-Knoten online</span><span><b>AE-Register</b> statische Akten aktiv</span><span><b>Direktion</b> Sitzung EVOSS bestätigt</span><span><b>Hinweis</b> Nicht autorisierte Exporte werden protokolliert</span>
      <span><b>ORACLE.DB</b> Meridian-Knoten online</span><span><b>AE-Register</b> statische Akten aktiv</span><span><b>Direktion</b> Sitzung EVOSS bestätigt</span><span><b>Hinweis</b> Nicht autorisierte Exporte werden protokolliert</span>
    </div></footer>`;
}

function renderArticlePage(article, allArticles, chronicle) {
  return `${head(`Oracle.DB // ${article.id}`)}
<body>
  <main class="app glitch">
    ${topbar(`Meridian-Knoten // ${categories[article.kind].title} // ${article.id}`)}
    <section class="main">
      ${sidebar(allArticles, article)}
      ${navOverlay()}
      <section class="viewer loading-dossier">
        <div class="route-loader" data-route-loader>
          <div class="loader-label">Akte wird entschluesselt</div>
          <div class="loader-bar"><span></span></div>
          <div class="loader-code">${escapeHtml(article.id)} // BUFFER</div>
        </div>
        <article class="dossier" data-dossier>
          <div class="classification">
            <span>Nur interner Gebrauch // Weitergabe untersagt</span>
            <span>Freigabe: ${escapeHtml(categories[article.kind].clearance)}</span>
          </div>
${renderNotice(article)}
          <header class="hero">
            <div class="eyebrow">${escapeHtml(categories[article.kind].title)} // ${escapeHtml(article.subtitle)}</div>
            <h1>${escapeHtml(article.id)}<br>${renderInline(article.title, article)}</h1>
            <div class="summary">${escapeHtml(article.summary)}</div>
          </header>
          ${renderToc(article)}
          ${renderIdentification(article)}
          <section class="meta-grid" aria-label="Kenndaten">
            <div class="meta-cell"><div class="meta-label">Kennung</div><div class="meta-value">${escapeHtml(article.id)}</div></div>
            <div class="meta-cell"><div class="meta-label">Status</div><div class="meta-value">${escapeHtml(displayedStatus(article))}</div></div>
            <div class="meta-cell"><div class="meta-label">Klasse</div><div class="meta-value">${escapeHtml(article.danger)}</div></div>
            <div class="meta-cell"><div class="meta-label">Zuordnung</div><div class="meta-value">${escapeHtml(displayedLocation(article))}</div></div>
          </section>
          <section class="content-grid">
            <div class="article">${article.sections.map((section, index) => renderSection(section, index, article)).join("\n")}${renderWikiFooter(article)}</div>
            <aside class="infobox">
              ${renderMedia(article)}
              <div class="info-row"><div class="info-k">Typ</div><div class="info-v">${escapeHtml(categories[article.kind].title)}</div></div>
              <div class="info-row"><div class="info-k">Status</div><div class="info-v">${escapeHtml(displayedStatus(article))}</div></div>
              <div class="info-row"><div class="info-k">Klasse</div><div class="info-v">${escapeHtml(article.danger)}</div></div>
              <div class="info-row"><div class="info-k">Kennung</div><div class="info-v">${escapeHtml(article.id)}</div></div>
            </aside>
          </section>
        </article>
      </section>
      ${signalPanel(article, chronicle)}
    </section>
    ${ticker()}
  </main>
  <script src="/assets/js/page-load.js?v=${assetVersion}"></script>
  <script src="/assets/js/search.js?v=${assetVersion}"></script>
  <script src="/assets/js/redactions.js?v=${assetVersion}"></script>
</body>
</html>`;
}

function renderIndex(allArticles, chronicle) {
  const counts = Object.fromEntries(Object.keys(categories).map((kind) => [kind, allArticles.filter((article) => article.kind === kind).length]));
  return `${head("Oracle.DB // Aktenindex")}
<body>
  <main class="app glitch">
    ${topbar("Meridian-Knoten // Aktenindex // statische Routen aktiv")}
    <section class="main">
      ${sidebar(allArticles, null, null)}
      ${navOverlay()}
      <section class="viewer">
        <article class="dossier">
          <div class="classification"><span>Oracle.DB // Aktenindex</span><span>Freigabe: Stufe 5 - Direktion</span></div>
          <header class="hero">
            <div class="eyebrow">Interne Navigation // Generierte Akten</div>
            <h1>Aktenindex</h1>
            <div class="summary">Statische Oracle.DB-Ausgabe aus den bestehenden Quelldateien. Jede Akte besitzt eine eigene Route und kann später direkt aus der jeweiligen Textdatei aktualisiert werden.</div>
          </header>
          <section class="index-grid">
            ${Object.entries(categories).map(([kind, category]) => `<a class="index-card" href="/${category.route}/"><h2>${escapeHtml(category.title)}</h2><p>${counts[kind]} Akten im aktuellen Build.</p></a>`).join("\n")}
          </section>
        </article>
      </section>
      ${signalPanel(null, chronicle)}
    </section>
    ${ticker()}
  </main>
  <script src="/assets/js/search.js?v=${assetVersion}"></script>
  <script src="/assets/js/redactions.js?v=${assetVersion}"></script>
</body>
</html>`;
}

function renderCategoryPage(kind, allArticles, chronicle) {
  const category = categories[kind];
  const articles = allArticles.filter((article) => article.kind === kind).sort((a, b) => a.id.localeCompare(b.id, "de"));
  return `${head(`Oracle.DB // ${category.title}`)}
<body>
  <main class="app glitch">
    ${topbar(`Meridian-Knoten // ${category.title} // ${articles.length} Akten`)}
    <section class="main">
      ${sidebar(allArticles, null, kind)}
      ${navOverlay()}
      <section class="viewer">
        <article class="dossier">
          <div class="classification"><span>${escapeHtml(category.title)} // Registeransicht</span><span>Freigabe: ${escapeHtml(category.clearance)}</span></div>
          <header class="hero">
            <div class="eyebrow">Register // ${escapeHtml(category.tab)}</div>
            <h1>${escapeHtml(category.title)}</h1>
            <div class="summary">Registerauszug mit ${articles.length} generierten Akten. Auswahl links oder über die Karten öffnen.</div>
          </header>
          <section class="index-grid">
            ${articles.map((article) => `<a class="index-card" href="${articleUrl(article)}"><h2>${escapeHtml(article.id)}</h2><p><strong>${escapeHtml(article.title)}</strong><br>${escapeHtml(article.summary)}</p></a>`).join("\n")}
          </section>
        </article>
      </section>
      ${signalPanel(null, chronicle)}
    </section>
    ${ticker()}
  </main>
  <script src="/assets/js/search.js?v=${assetVersion}"></script>
  <script src="/assets/js/redactions.js?v=${assetVersion}"></script>
</body>
</html>`;
}

function renderLoginPage() {
  return `${head("Oracle.DB // Anmeldung")}
<body class="login-page">
  ${loginMarkup()}
  <script src="/assets/js/login.js?v=${assetVersion}"></script>
</body>
</html>`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFile(file, content) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, content, "utf8");
}

async function assignImages(allArticles) {
  for (const { kind, file } of contentSnapshot.images ?? []) {
    const imagePath = path.join(root, "assets", "img", file);
    try {
      await fs.access(imagePath);
    } catch {
      throw new Error(`Snapshot image is missing from Web2: ${file}`);
    }
    const stem = path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const article of allArticles.filter((item) => item.kind === kind)) {
      if (article.slug.includes(stem) || stem.includes(article.slug.replace(/^oracle/, ""))) {
        article.image = `/assets/img/${file}`;
      }
    }
  }
}

async function readArticles() {
  const articles = [];
  for (const kind of Object.keys(categories)) {
    for (const source of contentSnapshot.categories?.[kind] ?? []) {
      const article = parseTextArticle(source.file, kind, source.text);
      article.canon = contentSnapshot.wiki_canon?.[article.id] ?? null;
      articles.push(article);
    }
  }
  const duplicateIds = articles.map((article) => article.id).filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateIds.length) throw new Error(`Duplicate article IDs in snapshot: ${[...new Set(duplicateIds)].join(", ")}`);
  const registeredIds = new Set(contentSnapshot.registered_ids ?? []);
  const invalidEntityIds = articles.filter((article) => ["char", "ae"].includes(article.kind) && !registeredIds.has(article.id)).map((article) => article.id);
  if (invalidEntityIds.length) throw new Error(`Articles use unregistered Canon IDs: ${invalidEntityIds.join(", ")}`);
  const unconfiguredPersonnel = articles
    .filter((article) => article.kind === "char" && !Object.hasOwn(personnelTags?.articles ?? {}, article.id))
    .map((article) => article.id);
  if (unconfiguredPersonnel.length) throw new Error(`Personnel dossiers without explicit tag configuration: ${unconfiguredPersonnel.join(", ")}`);
  await assignImages(articles);
  return articles;
}

async function readChronicleSummary() {
  return `${contentSnapshot.canon_cutoff}; nächster Storypart ${contentSnapshot.next_story_ref} (${contentSnapshot.next_story_status})`;
}

async function removeGeneratedRoutes() {
  for (const category of Object.values(categories)) {
    await fs.rm(path.join(root, category.route), { recursive: true, force: true });
  }
}

async function main() {
  [contentSnapshot, personnelTags] = await Promise.all([
    fs.readFile(contentPath, "utf8").then(JSON.parse),
    fs.readFile(personnelTagsPath, "utf8").then(JSON.parse),
  ]);
  const articles = await readArticles();
  routeById = buildRouteMap(articles);
  const chronicle = await readChronicleSummary();
  await removeGeneratedRoutes();

  await writeFile(path.join(root, "index.html"), renderLoginPage());
  await writeFile(path.join(root, "index", "index.html"), renderIndex(articles, chronicle));
  for (const kind of Object.keys(categories)) {
    await writeFile(path.join(root, categories[kind].route, "index.html"), renderCategoryPage(kind, articles, chronicle));
  }
  for (const article of articles) {
    await writeFile(path.join(root, categories[article.kind].route, article.slug, "index.html"), renderArticlePage(article, articles, chronicle));
  }

  const manifest = articles.map((article) => ({
    id: article.id,
    title: article.title,
    kind: article.kind,
    url: articleUrl(article),
  }));
  await writeFile(path.join(root, "assets", "search-index.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${articles.length} articles.`);
}

function buildRouteMap(articles) {
  const map = new Map();
  for (const article of articles) {
    const url = articleUrl(article);
    const id = article.id.toUpperCase();
    map.set(id, url);
    map.set(id.replace(/^ORACLE-/, ""), url);
  }
  return map;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
