/**
 * node tools/sync-go-links.mjs path/to/quick-links.html [--dry-run]
 *
 * MyNavy Portal's Quick Links Classic page (my.navy.mil/quick-links.html) is
 * the closest thing the Navy has to a directory of these systems, but it
 * isn't fetchable by a script — it 404s to a plain HTTP client and needs a
 * logged-in browser session. So the workflow is manual-in, automatic-out:
 * save the rendered page from a browser (Ctrl+S, "Webpage, HTML only" is
 * enough — the markup is all server-rendered, nothing here depends on the
 * page's own JS) and point this script at the file. It extracts every
 * (title, URL) pair — the "Most Popular Quick Links" list and all four
 * accordion columns — and merges anything not already in go/links.json.
 *
 * Zero dependencies, matching tools/check.mjs.
 *
 * Merge rules:
 *   - A link already present under any key (by URL, ignoring the
 *     `utm_source` tracking param MyNavy Portal appends to everything) is
 *     left alone — existing hand-picked keys like "nsips" or "bol" are never
 *     touched or renamed.
 *   - A genuinely new link gets a key auto-generated from its title
 *     (lowercased, alphanumeric only — "Navy eLearning" -> "navyelearning").
 *     These are meant as a starting point: rename them to something shorter
 *     in go/links.json by hand, the same way "Navy eLearning" became "nel".
 *   - Nothing is ever removed automatically. A link MyNavy Portal drops stays
 *     in the manifest until someone deletes it on purpose.
 *
 * --dry-run prints what would change without writing the file.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LINKS_PATH = join(ROOT, "go/links.json");

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const htmlPath = args.find((a) => !a.startsWith("--"));

if (!htmlPath) {
  fail(
    "Usage: node tools/sync-go-links.mjs path/to/quick-links.html [--dry-run]\n" +
      "Save the rendered page from https://my.navy.mil/quick-links.html first — it is not fetchable headlessly."
  );
}

let html;
try {
  html = readFileSync(htmlPath, "utf8");
} catch (err) {
  fail(`Could not read ${htmlPath}: ${err.message}`);
}

// --- extraction -------------------------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();
}

const extracted = [];

// "Most Popular Quick Links": <div class="popular-links"><a href="URL">TEXT</a></div>
for (const m of html.matchAll(
  /<div class="popular-links"><a href="([^"]+)"[^>]*>([^<]+)<\/a><\/div>/g
)) {
  extracted.push({ href: decodeEntities(m[1]), title: decodeEntities(m[2]) });
}

// Accordion cards: a numbered <h5 id="title-N">TITLE</h5> paired with an
// <a id="Continue-N" href="URL"> elsewhere in the same card.
const titles = new Map();
for (const m of html.matchAll(
  /id="title-(\d+)"[^>]*>([^<]+)<\/h5>/g
)) {
  titles.set(m[1], decodeEntities(m[2]));
}
for (const m of html.matchAll(/id="Continue-(\d+)" href="([^"]+)"/g)) {
  const title = titles.get(m[1]);
  if (title) extracted.push({ href: decodeEntities(m[2]), title });
}

if (extracted.length === 0) {
  fail(
    "Found no links in that file — is it a saved copy of the Quick Links Classic page?"
  );
}

// --- de-dup against the existing manifest ------------------------------

function normalize(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete("utm_source");
    u.hash = "";
    // trailing slash and scheme case are the two common accidental diffs
    return (u.origin + u.pathname.replace(/\/$/, "") + "?" + u.searchParams.toString())
      .toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

const existing = JSON.parse(readFileSync(LINKS_PATH, "utf8"));
const knownUrls = new Set(Object.values(existing).map(normalize));
const usedKeys = new Set(Object.keys(existing));

function slugify(title) {
  const base = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!base) return "link";
  if (!usedKeys.has(base)) return base;
  let i = 2;
  while (usedKeys.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

const additions = {};
const seenThisRun = new Set();
for (const { href, title } of extracted) {
  const norm = normalize(href);
  if (knownUrls.has(norm) || seenThisRun.has(norm)) continue;
  seenThisRun.add(norm);
  knownUrls.add(norm);
  const key = slugify(title);
  usedKeys.add(key);
  additions[key] = href;
}

// --- report / write ------------------------------------------------------

const addedKeys = Object.keys(additions).sort();

if (addedKeys.length === 0) {
  console.log(`No new links — go/links.json already covers everything in ${htmlPath}.`);
  process.exit(0);
}

console.log(`${addedKeys.length} new link(s) found:\n`);
for (const key of addedKeys) {
  console.log(`  ${key.padEnd(20)} ${additions[key]}`);
}

if (dryRun) {
  console.log("\n--dry-run: go/links.json not written.");
  process.exit(0);
}

const merged = { ...existing, ...additions };
const sortedMerged = Object.fromEntries(
  Object.keys(merged)
    .sort()
    .map((k) => [k, merged[k]])
);

writeFileSync(LINKS_PATH, JSON.stringify(sortedMerged, null, 2) + "\n");
console.log(`\nWrote go/links.json. Consider giving the new keys shorter names.`);
