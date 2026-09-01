/**
 * node tools/check.mjs
 *
 * Zero dependencies, no build, no config — `node:test` and `node:assert` are
 * built in. This file travels with the folder, which is the point: the homepage
 * is destined to be lifted out of the saltdog repo, and a check that lived in
 * the parent project's `npm test` would silently stop running the moment it
 * moved.
 *
 * WHAT IS WORTH CHECKING ON A STATIC PAGE, and what is not. There is no logic
 * here to regression-test; every defect this page can have is a defect of
 * AGREEMENT. Two copies of the FAQ that drift apart. A canonical URL and an
 * og:url that name different origins. A declared image size that does not match
 * the file. An icon referenced in the manifest that was renamed in assets/. A
 * palette comment asserting a contrast ratio for a colour that has since
 * changed. None of those break the page visibly, all of them are invisible in a
 * browser, and every one of them is exactly the kind of thing a machine should
 * be looking at instead of a person.
 *
 * Following the standing rule in this repo: every assertion below was run
 * against a deliberately broken copy of the file it inspects and watched to
 * fail before it was kept — `tools/sabotage.mjs` does that mechanically, one
 * defect at a time. A check that has never failed is a decoration.
 *
 * The practice paid immediately and in one specific direction, worth stating
 * because it will keep happening in a codebase written like this one: FOUR of
 * these checks were reading the file's own explanatory comments rather than its
 * markup. Three failed loudly on the first run and one survived sabotage
 * silently, which is the worse outcome and the reason sabotage exists. See
 * `stripComments` below and the note on the favicon check.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/**
 * STRIP HTML COMMENTS BEFORE SCANNING ANYTHING, and this is not a nicety.
 *
 * index.html is more comment than markup by line count — that is the house style
 * in this repo — and those comments quote the exact strings these checks look
 * for. On the first run, three of twenty-four checks failed for this single
 * reason and none of them for the reason it looked like: the head comment
 * explaining the FAQ mirror contains the literal text "<dt>", so the
 * question-scanning regex matched from inside a comment to the first real
 * </dt> and compared the entire document against one question; and the CSS
 * comment reading "Never `outline: none`" tripped the check asserting the focus
 * ring is never removed.
 *
 * A comment-aware scanner is the fix rather than rewording the comments, because
 * the alternative is a file whose prose has to tiptoe around its own tests.
 */
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, "");

/**
 * The same hazard one level down: the stylesheet's own /* *\/ comments quote the
 * declarations under test, and an HTML comment strip does not touch them. The
 * `outline: none` check failed on the comment reading "Never `outline: none`".
 */
const styleOf = (html) =>
  (html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * THE ONE PLACE THE ORIGIN IS WRITTEN DOWN AS A VALUE.
 *
 * It is duplicated across five files as a matter of spec — `rel=canonical`,
 * `og:url`, `og:image`, the JSON-LD `@id`s, every `<loc>` in the sitemap, and
 * the `Sitemap:` line in robots.txt all require an absolute URL, and none of
 * them can be relative. So the defence against a custom-domain move leaving
 * half of them behind is not to avoid the duplication — it cannot be avoided —
 * but to make a disagreement fail loudly. Change this constant and the tests
 * will list every file that still says the old thing.
 */
const ORIGIN = "https://thepollywog.github.io";

const HTML = stripComments(read("index.html"));
const NOT_FOUND = stripComments(read("404.html"));
const CSS = styleOf(HTML);
const CSS_404 = styleOf(NOT_FOUND);
const ROBOTS = read("robots.txt");
const SITEMAP = read("sitemap.xml");
const MANIFEST_RAW = read("site.webmanifest");

/** Strip tags and collapse whitespace, so prose can be compared to prose. */
function textOf(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function meta(name) {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const m = HTML.match(re);
  return m ? m[1] : null;
}

/** Width and height straight out of a PNG's IHDR — no image library needed. */
function pngSize(rel) {
  const buf = readFileSync(join(ROOT, rel));
  assert.equal(buf.subarray(1, 4).toString("ascii"), "PNG", `${rel} is not a PNG`);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ---------------------------------------------------------------------------
// The origin, spread across five files by necessity
// ---------------------------------------------------------------------------

test("every absolute self-reference uses exactly one origin", () => {
  const files = {
    "index.html": HTML,
    "404.html": NOT_FOUND,
    "robots.txt": ROBOTS,
    "sitemap.xml": SITEMAP,
    "site.webmanifest": MANIFEST_RAW,
    "README.md": read("README.md"),
  };
  // Anything that looks like a URL naming this project, however spelled: the
  // failure being hunted is a stale `www.`, a bare `http://`, or a leftover
  // `thepollywog.com` after a domain move.
  const re = /\bhttps?:\/\/[a-z0-9.-]*pollywog[a-z0-9.-]*/gi;
  let seen = 0;
  for (const [name, body] of Object.entries(files)) {
    for (const m of body.match(re) ?? []) {
      seen++;
      assert.equal(m, ORIGIN, `${name} references ${m}, not ${ORIGIN}`);
    }
  }
  // A guard on the guard. If the pattern ever stops matching — a rename, a
  // refactor — this test would pass by finding nothing, which is the failure
  // mode that makes a check worthless.
  assert.ok(seen > 12, `only found ${seen} self-references; the pattern has rotted`);
});

test("canonical, og:url and the JSON-LD all point at the front page", () => {
  const canonical = HTML.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  assert.ok(canonical, "no rel=canonical");
  assert.equal(canonical[1], `${ORIGIN}/`);
  assert.equal(meta("og:url"), `${ORIGIN}/`);

  const graph = jsonLd();
  const site = graph.find((n) => n["@type"] === "WebSite");
  assert.ok(site, "no WebSite node in the JSON-LD");
  assert.equal(site.url, `${ORIGIN}/`);
});

test("robots.txt advertises the sitemap and blocks nothing", () => {
  assert.match(ROBOTS, new RegExp(`^Sitemap: ${ORIGIN}/sitemap\\.xml$`, "m"));
  assert.doesNotMatch(ROBOTS, /^\s*Disallow:\s*\/\s*$/m, "robots.txt disallows the whole origin");
  assert.match(ROBOTS, /^User-agent: \*$/m);
});

test("the sitemap lists all three sites, with a real lastmod", () => {
  const locs = [...SITEMAP.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, [`${ORIGIN}/`, `${ORIGIN}/saltdog/`, `${ORIGIN}/webnavfit/`]);
  const mods = [...SITEMAP.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  assert.equal(mods.length, locs.length, "every <url> needs a <lastmod>");
  for (const d of mods) {
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/, `lastmod "${d}" is not W3C date format`);
    assert.ok(!Number.isNaN(Date.parse(d)), `lastmod "${d}" is not a real date`);
  }
});

// ---------------------------------------------------------------------------
// The head: the parts a search result is actually built from
// ---------------------------------------------------------------------------

test("title and description are present and inside their useful lengths", () => {
  const title = HTML.match(/<title>([^<]+)<\/title>/)[1];
  assert.ok(title.length <= 65, `title is ${title.length} chars; truncates on a phone`);
  assert.ok(title.length >= 20, `title is only ${title.length} chars`);

  const desc = meta("description");
  assert.ok(desc, "no meta description");
  // Under ~120 wastes the slot; over ~165 is cut mid-sentence in the result.
  assert.ok(desc.length >= 120 && desc.length <= 165, `description is ${desc.length} chars`);
});

test("exactly one h1, and it is not just the brand name", () => {
  const h1s = [...HTML.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(h1s.length, 1, `found ${h1s.length} <h1> elements`);
  const text = textOf(h1s[0][1]);
  assert.ok(text.length > 12, `the h1 is "${text}"`);
  assert.ok(
    !/^the pollywog\.?$/i.test(text),
    "the h1 spends the strongest heading signal on a string already in the title and URL",
  );
});

test("the social card is complete and its declared size matches the file", () => {
  for (const key of ["og:type", "og:site_name", "og:title", "og:description", "og:image:alt"]) {
    assert.ok(meta(key), `missing ${key}`);
  }
  assert.equal(meta("twitter:card"), "summary_large_image");

  for (const key of ["og:image", "twitter:image"]) {
    const url = meta(key);
    assert.ok(url?.startsWith(`${ORIGIN}/`), `${key} must be absolute; got ${url}`);
  }
  assert.equal(meta("og:image"), meta("twitter:image"));

  const rel = meta("og:image").slice(`${ORIGIN}/`.length);
  const { w, h } = pngSize(rel);
  assert.equal(String(w), meta("og:image:width"), "og:image:width disagrees with the file");
  assert.equal(String(h), meta("og:image:height"), "og:image:height disagrees with the file");
  // 1.91:1 is what every unfurler crops toward.
  assert.ok(Math.abs(w / h - 1.91) < 0.02, `card is ${w}x${h}, not ~1.91:1`);
});

test("robots meta allows a large image preview", () => {
  const robots = meta("robots");
  assert.ok(robots, "no robots meta");
  assert.match(robots, /index/);
  assert.doesNotMatch(robots, /noindex/);
  assert.match(robots, /max-image-preview:\s*large/);
});

// ---------------------------------------------------------------------------
// Structured data, and its agreement with the visible page
// ---------------------------------------------------------------------------

function jsonLd() {
  const blocks = [...HTML.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1, "expected exactly one ld+json block");
  const parsed = JSON.parse(blocks[0][1]);
  return parsed["@graph"];
}

test("the JSON-LD parses and every node is typed and identified", () => {
  const graph = jsonLd();
  assert.ok(graph.length >= 5, `only ${graph.length} nodes`);
  for (const node of graph) {
    assert.ok(node["@type"], `a node has no @type: ${JSON.stringify(node).slice(0, 80)}`);
    assert.ok(node["@id"]?.startsWith(`${ORIGIN}/#`), `bad @id on ${node["@type"]}`);
  }
  const types = graph.map((n) => n["@type"]);
  for (const t of ["WebSite", "Organization", "FAQPage"]) {
    assert.ok(types.includes(t), `no ${t} node`);
  }
  assert.equal(
    types.filter((t) => t === "SoftwareApplication").length,
    2,
    "expected one SoftwareApplication per app",
  );
});

test("each app is declared free in a way a parser accepts", () => {
  for (const app of jsonLd().filter((n) => n["@type"] === "SoftwareApplication")) {
    assert.equal(app.isAccessibleForFree, true, `${app.name} is not marked free`);
    assert.equal(app.offers?.price, "0", `${app.name} has no zero-price offer`);
    // An Offer with a price and no currency is invalid, and "free" is exactly
    // the case where forgetting the currency looks harmless.
    assert.ok(app.offers?.priceCurrency, `${app.name}'s offer has no priceCurrency`);
    assert.ok(app.url?.startsWith(`${ORIGIN}/`), `${app.name} has no absolute url`);
    assert.ok(app.description?.length > 80, `${app.name}'s description is thin`);
  }
});

test("every FAQ answer in the structured data is on the page verbatim", () => {
  const faq = jsonLd().find((n) => n["@type"] === "FAQPage");
  const dts = [...HTML.matchAll(/<dt>([\s\S]*?)<\/dt>/g)].map((m) => textOf(m[1]));
  const dds = [...HTML.matchAll(/<dd>([\s\S]*?)<\/dd>/g)].map((m) => textOf(m[1]));

  assert.ok(dts.length >= 5, `only ${dts.length} questions on the page`);
  assert.equal(dts.length, dds.length, "a question is missing its answer");
  assert.equal(
    faq.mainEntity.length,
    dts.length,
    `${faq.mainEntity.length} questions in the JSON-LD, ${dts.length} on the page`,
  );

  for (const [i, q] of faq.mainEntity.entries()) {
    assert.equal(textOf(q.name), dts[i], `question ${i + 1} differs from its <dt>`);
    // Not `includes`: an answer that is a superset of the visible text is the
    // defect being hunted — marked-up content the reader cannot see.
    assert.equal(
      textOf(q.acceptedAnswer.text),
      dds[i],
      `answer ${i + 1} differs from its <dd>\n  ld:   ${textOf(q.acceptedAnswer.text)}\n  page: ${dds[i]}`,
    );
  }
});

// ---------------------------------------------------------------------------
// The disclaimer, which is a requirement and not a decoration
// ---------------------------------------------------------------------------

test("the page says it is unofficial, early and in every machine-readable field", () => {
  const body = HTML.slice(HTML.indexOf("<body"));
  const notice = body.match(/<aside class="notice"[\s\S]*?<\/aside>/);
  assert.ok(notice, "the disclaimer aside is gone");
  assert.match(textOf(notice[0]), /unofficial/i);
  assert.match(textOf(notice[0]), /not affiliated with|not a Department of the Navy/i);

  // Before the first section, i.e. in the first screenful rather than the footer.
  assert.ok(
    body.indexOf(notice[0]) < body.indexOf("<section"),
    "the disclaimer sits below the first section",
  );

  assert.match(meta("og:description"), /unofficial/i);
  const org = jsonLd().find((n) => n["@type"] === "Organization");
  assert.match(
    org.disambiguatingDescription ?? "",
    /not affiliated/i,
    "the Organization node does not disclaim affiliation",
  );

  // And on the card image's own alt text consumer: the footer.
  assert.match(textOf(body.match(/<footer[\s\S]*<\/footer>/)[0]), /unofficial/i);
});

// ---------------------------------------------------------------------------
// Assets: nothing referenced may be missing, nothing shipped may be orphaned
// ---------------------------------------------------------------------------

/**
 * The two app directories are published by their own repositories and are not
 * in this folder, so they are the only local references that cannot be resolved
 * on disk. Listed explicitly rather than skipped by a pattern, so that adding a
 * third app is a deliberate edit here and not a silently unchecked link.
 */
const EXTERNAL_DIRS = ["saltdog/", "webnavfit/"];

test("every local reference in index.html resolves to a file", () => {
  const refs = [...HTML.matchAll(/(?:href|src|srcset)=["']([^"']+)["']/g)].flatMap((m) =>
    // srcset is a comma-separated list of "url descriptor" pairs.
    m[1].split(",").map((part) => part.trim().split(/\s+/)[0]),
  );
  let checked = 0;
  for (const ref of refs) {
    if (/^(https?:|tel:|mailto:|#|data:)/.test(ref)) continue;
    if (EXTERNAL_DIRS.some((d) => ref === d || ref.startsWith(d))) continue;
    checked++;
    assert.ok(existsSync(join(ROOT, ref)), `index.html references missing file: ${ref}`);
  }
  assert.ok(checked >= 8, `only checked ${checked} local refs; the pattern has rotted`);
});

test("every asset in the folder is referenced by something", () => {
  const everything = ["index.html", "404.html", "site.webmanifest", "README.md"]
    .map(read)
    .join("\n");
  for (const name of readdirSync(join(ROOT, "assets"))) {
    // The master is a build input, not a served file; build-assets.py owns it.
    if (name === "logo-512.png") {
      assert.match(read("tools/build-assets.py"), /logo-512\.png/);
      continue;
    }
    assert.ok(everything.includes(name), `assets/${name} is shipped but never referenced`);
  }
});

test("the manifest parses, and its icons exist at the sizes it claims", () => {
  const m = JSON.parse(MANIFEST_RAW);
  assert.equal(m.start_url, ".", "a root-absolute start_url would break under a subpath");
  assert.equal(m.theme_color.toLowerCase(), "#0e130f");
  assert.ok(m.icons.length >= 2);
  let maskable = 0;
  for (const icon of m.icons) {
    const { w, h } = pngSize(icon.src);
    assert.equal(`${w}x${h}`, icon.sizes, `${icon.src} is ${w}x${h}, declared ${icon.sizes}`);
    if (icon.purpose === "maskable") maskable++;
  }
  // Android crops a non-maskable icon to a circle and shaves the artwork; the
  // maskable variant exists precisely so that does not happen.
  assert.equal(maskable, 1, "expected exactly one maskable icon");
});

test("the favicon svg and the ico are the same mark", () => {
  // Comments stripped for the third time in this file, and the third time it was
  // not optional: the FIRST version of this check asserted the string "#A9B063"
  // appears in the SVG, and a sabotage run that repainted the tadpole a
  // different olive SURVIVED — because the file's own comment explains why
  // #A9B063 was chosen, so the assertion was reading the prose rather than the
  // markup. It now compares the fills actually used in the drawing.
  const svg = stripComments(read("assets/favicon.svg"));
  assert.match(svg, /viewBox="0 0 24 24"/);

  // Literals in the SVG, because a favicon is fetched before any CSS runs and
  // cannot read a custom property — so the icon has to be checked against the
  // stylesheet rather than wired to it.
  const fills = [...new Set([...svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map((m) => m[1].toLowerCase()))];
  const dark = darkTokens();
  assert.deepEqual(
    fills.sort(),
    [dark.accent, dark.bg].sort(),
    "the favicon is painted in colours the dark theme no longer uses",
  );
  assert.ok(existsSync(join(ROOT, "assets/favicon.ico")), "no favicon.ico fallback");
  assert.match(
    read("tools/build-assets.py"),
    /FAVICON_SVG/,
    "the ico must be generated from the svg, or the two will drift",
  );
});

// ---------------------------------------------------------------------------
// Claims the page makes about itself
// ---------------------------------------------------------------------------

test("there is no JavaScript on the page", () => {
  // The page's stated reason for existing in this shape is that one request
  // produces a painted page. A script tag — an analytics snippet, a cookie
  // banner, a font loader — is how that stops being true, and it would arrive
  // in a hurry and look harmless.
  const scripts = [...HTML.matchAll(/<script([^>]*)>/g)].map((m) => m[1]);
  for (const attrs of scripts) {
    assert.match(attrs, /type="application\/ld\+json"/, `unexpected <script${attrs}>`);
  }
  assert.equal(scripts.length, 1);
  assert.doesNotMatch(HTML, /\son[a-z]+=["']/, "an inline event handler is still JavaScript");
});

test("nothing is fetched from a third party", () => {
  // Not a purity exercise: an external font or script is a render-blocking
  // request to a host this project does not control, and it is also the only
  // way this page could start tracking anyone.
  //
  // SUBRESOURCES ARE IDENTIFIED BY TAG AND `rel`, not by looking for an absolute
  // URL near an opening tag. The first version did the latter and failed on
  // `<link rel="canonical">`, which is a <link> with an absolute href and is not
  // a fetch at all — as are `og:url` and every JSON-LD `@id`. The distinction is
  // the whole check: this page is *required* to state absolute URLs, so the
  // question is never "is there an absolute URL" but "does anything load".
  const FETCHING_REL =
    /^(stylesheet|preload|prefetch|preconnect|dns-prefetch|modulepreload|icon|shortcut|apple-touch-icon|mask-icon|manifest)$/i;
  const subresources = [];
  for (const [tag] of HTML.matchAll(/<(?:script|img|source|iframe|video|audio|embed)\b[^>]*>/gi)) {
    for (const m of tag.matchAll(/\bsrc=["']([^"']+)["']/g)) subresources.push(m[1]);
    // srcset is a comma-separated list of "url descriptor" pairs.
    for (const m of tag.matchAll(/\bsrcset=["']([^"']+)["']/g)) {
      for (const part of m[1].split(",")) subresources.push(part.trim().split(/\s+/)[0]);
    }
  }
  for (const [tag] of HTML.matchAll(/<link\b[^>]*>/gi)) {
    const rel = tag.match(/\brel=["']([^"']+)["']/)?.[1] ?? "";
    if (!rel.split(/\s+/).some((r) => FETCHING_REL.test(r))) continue;
    subresources.push(tag.match(/\bhref=["']([^"']+)["']/)?.[1] ?? "");
  }
  // Plus anything the inline stylesheet pulls in.
  for (const m of CSS.matchAll(/url\(\s*['"]?([^'")]+)/g)) subresources.push(m[1]);

  for (const ref of subresources) {
    assert.doesNotMatch(ref, /^https?:\/\//, `subresource loaded from a third party: ${ref}`);
  }
  assert.doesNotMatch(CSS, /@import/, "@import is a blocking request and can be remote");
  assert.doesNotMatch(HTML, /fonts\.googleapis|fonts\.gstatic|@font-face/);
  assert.ok(subresources.length >= 7, `found only ${subresources.length} subresources to check`);
});

test("the hero image cannot shift the layout", () => {
  const img = HTML.match(/<img[^>]+src=["']assets\/logo-160\.png["'][^>]*>/s);
  assert.ok(img, "the masthead logo is gone or renamed");
  const w = img[0].match(/\bwidth="(\d+)"/);
  const h = img[0].match(/\bheight="(\d+)"/);
  assert.ok(w && h, "the hero image has no intrinsic dimensions; it will shift the page");
  const actual = pngSize("assets/logo-160.png");
  assert.equal(Number(w[1]), actual.w, "declared width disagrees with the file");
  assert.equal(Number(h[1]), actual.h, "declared height disagrees with the file");
  assert.doesNotMatch(img[0], /loading="lazy"/, "the LCP element must not be lazy-loaded");
  assert.match(img[0], /fetchpriority="high"/);
  // A WebP source is the reason the PNG's weight is tolerable; if the <picture>
  // is flattened to a bare <img> the page ships 134 KB instead of 18 KB.
  assert.match(HTML, /<source[^>]+type="image\/webp"[^>]+srcset=/);
});

// ---------------------------------------------------------------------------
// Palette: the numbers in the comments have to still be true
// ---------------------------------------------------------------------------

/** WCAG 2.x relative luminance and contrast, ~10 lines and no dependency. */
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, b2] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b2);
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function tokens(scope) {
  const out = {};
  for (const m of scope.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2].toLowerCase();
  return out;
}

/**
 * The custom properties from one `:root` block, sliced by brace rather than by
 * indentation — neither block contains a nested rule, so the first `}` after the
 * opening is its end, and that survives reformatting.
 */
function rootBlock(from, label) {
  const start = CSS.indexOf(":root {", from);
  assert.notEqual(start, -1, `the ${label} palette block was not found`);
  const t = tokens(CSS.slice(start, CSS.indexOf("}", start)));
  assert.ok(t.bg && t.accent, `the ${label} palette block has no tokens — the slice has rotted`);
  return t;
}

/** The bare `:root`, i.e. the dark scheme, which is the default. */
const darkTokens = () => rootBlock(0, "dark");

const lightTokens = () =>
  rootBlock(CSS.indexOf("@media (prefers-color-scheme: light)"), "light");

test("every colour pair the page uses clears WCAG AA, in both schemes", () => {
  const dark = darkTokens();
  const light = lightTokens();

  for (const [name, t] of [
    ["dark", dark],
    ["light", light],
  ]) {
    assert.ok(t.bg && t.text && t.muted && t.accent, `${name} scheme is missing tokens`);
    // 4.5:1 for body text, and the muted colour is body text too — it carries
    // the feature descriptions and the FAQ answers, not decoration.
    assert.ok(contrast(t.text, t.bg) >= 4.5, `${name}: text on bg is ${contrast(t.text, t.bg)}`);
    assert.ok(contrast(t.muted, t.bg) >= 4.5, `${name}: muted on bg is ${contrast(t.muted, t.bg)}`);
    // The accent carries headings and the button label. 3:1 is the large-text
    // floor; the button's own label is checked against the accent below.
    assert.ok(contrast(t.accent, t.bg) >= 3, `${name}: accent on bg is ${contrast(t.accent, t.bg)}`);
    assert.ok(
      contrast(t["on-accent"], t.accent) >= 4.5,
      `${name}: button label on accent is ${contrast(t["on-accent"], t.accent)}`,
    );
  }

  // The trap this whole palette is arranged around, asserted rather than
  // trusted: each theme's accent is unusable in the other. If someone
  // "simplifies" the two accents into one shared value, this fails.
  assert.ok(
    contrast(dark.accent, light.bg) < 3,
    "the dark accent now passes on the light background — the two accents have converged",
  );
});

test("the theme-color meta tags match the backgrounds they claim to match", () => {
  const dark = darkTokens();
  const pairs = [...HTML.matchAll(/<meta name="theme-color" media="([^"]+)" content="([^"]+)"/g)];
  assert.equal(pairs.length, 2, "expected one theme-color per scheme");
  const forDark = pairs.find((p) => p[1].includes("dark"));
  assert.equal(forDark[2].toLowerCase(), dark.bg.toLowerCase());
});

test("the asset builder's palette literals match the stylesheet", () => {
  const py = read("tools/build-assets.py");
  const dark = darkTokens();
  const of = (name) => {
    const m = py.match(new RegExp(`^${name} = \\(([^)]+)\\)`, "m"));
    assert.ok(m, `build-assets.py has no ${name}`);
    const [r, g, b] = m[1].split(",").map((s) => parseInt(s.trim(), 16));
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  // The link-preview card is drawn in Python and the page in CSS; the two are
  // seen side by side only in a link unfurl, which is the least likely place to
  // notice they have drifted.
  assert.equal(of("BG"), dark.bg.toLowerCase());
  assert.equal(of("ACCENT"), dark.accent.toLowerCase());
  assert.equal(of("TEXT"), dark.text.toLowerCase());
  assert.equal(of("MUTED"), dark.muted.toLowerCase());
});

// ---------------------------------------------------------------------------
// 404.html, whose rules are the inverse of the front page's
// ---------------------------------------------------------------------------

test("404.html is noindex, uncanonicalised, and root-absolute throughout", () => {
  assert.match(meta404("robots"), /noindex/);
  assert.doesNotMatch(NOT_FOUND, /rel=["']canonical["']/, "a canonical on a 404 invites a soft-404");

  const refs = [...NOT_FOUND.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map((m) => m[1]);
  let local = 0;
  for (const ref of refs) {
    if (/^(https?:|tel:|mailto:|#|data:)/.test(ref)) continue;
    local++;
    // This file is served AT the path that failed, so a relative reference
    // resolves against that path and misses. Verified by serving it from a
    // subdirectory, not by reasoning about it.
    assert.ok(ref.startsWith("/"), `404.html has a relative reference: ${ref}`);
    if (!EXTERNAL_DIRS.some((d) => ref === `/${d}`)) {
      assert.ok(existsSync(join(ROOT, ref.slice(1))), `404.html references missing file: ${ref}`);
    }
  }
  assert.ok(local >= 5, `only checked ${local} local refs in 404.html`);
  assert.match(textOf(NOT_FOUND), /Unofficial/);
});

function meta404(name) {
  const m = NOT_FOUND.match(
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"),
  );
  return m ? m[1] : "";
}

// ---------------------------------------------------------------------------
// Accessibility floor
// ---------------------------------------------------------------------------

test("the page is navigable and every image is described or hidden", () => {
  assert.match(HTML, /<html lang="en">/);
  assert.match(HTML, /class="skip" href="#main"/, "no skip link");
  assert.match(HTML, /id="main"/, "the skip link has no target");
  assert.doesNotMatch(CSS, /outline:\s*(none|0)\b/, "never remove the focus ring");
  assert.doesNotMatch(CSS_404, /outline:\s*(none|0)\b/, "never remove the focus ring");
  assert.match(CSS, /:focus-visible/);
  assert.match(CSS_404, /:focus-visible/);

  for (const [tag] of HTML.matchAll(/<img\b[^>]*>/g)) {
    assert.match(tag, /\balt=/, `an <img> has no alt attribute: ${tag.slice(0, 70)}`);
  }
  // Decorative only where it is also hidden from the accessibility tree.
  for (const [tag] of NOT_FOUND.matchAll(/<img\b[^>]*>/g)) {
    if (/alt=""/.test(tag)) assert.match(tag, /aria-hidden="true"/, "empty alt without aria-hidden");
  }

  // Headings must not skip a level: h1 then h2s then h3s inside the cards.
  const levels = [...HTML.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  assert.equal(levels[0], 1, "the first heading is not the h1");
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i] <= levels[i - 1] + 1, `heading level jumps from h${levels[i - 1]} to h${levels[i]}`);
  }
});

// ---------------------------------------------------------------------------
// The project's issue queue
//
// Issues for all three sites are filed here, so these templates are the entry
// point for every report about any of them. SALTDOG and WEBNAVFIT each carry a
// .github/ISSUE_TEMPLATE/config.yml that redirects to the URLs below, and those
// URLs name template FILES — so a renamed file here is a 404 in two other
// repositories, from a link the person reporting a problem just clicked.
//
// No YAML parser: this repo has zero dependencies and that is worth more than
// schema validation GitHub itself performs on push. What is checked is the part
// GitHub will not catch, which is agreement — between the forms, between each
// form and the sites it claims to cover, and between the queue's promise to be
// the only one and the files that would quietly re-open a second.
// ---------------------------------------------------------------------------

const TEMPLATE_DIR = ".github/ISSUE_TEMPLATE";
const FORMS = readdirSync(join(ROOT, TEMPLATE_DIR))
  .filter((f) => f.endsWith(".yml") && f !== "config.yml")
  .sort();
const FORM_SRC = new Map(FORMS.map((f) => [f, read(join(TEMPLATE_DIR, f))]));

/** The sites that redirect their issues here, by the name the forms must offer. */
const SITES = ["SALTDOG", "WEBNAVFIT", "Homepage"];

test("the issue queue offers a form for each thing people arrive to do", () => {
  // Named explicitly rather than derived from the directory: the point is that
  // these three exist, and a directory listing compared against itself would
  // pass just as happily with one of them deleted.
  assert.deepEqual(FORMS, ["bug.yml", "content-correction.yml", "feature-request.yml"]);
});

test("every form declares what GitHub needs to render it", () => {
  for (const [name, src] of FORM_SRC) {
    for (const key of ["name:", "description:", "labels:", "body:"]) {
      assert.ok(src.includes(key), `${name} has no top-level ${key}`);
    }
    // Every field GitHub can render, and nothing else. A typo in a type is not
    // a parse error over there — the field is simply dropped from the form.
    const types = [...src.matchAll(/^ {2}- type: (\S+)/gm)].map((m) => m[1]);
    // Asserted non-empty because this scan was written against the wrong
    // indentation the first time: it matched nothing, looped zero times, and
    // passed. Sabotage found it; the count is what stops it coming back.
    assert.ok(types.length >= 3, `${name} declares ${types.length} fields`);
    for (const type of types) {
      assert.ok(
        ["markdown", "input", "textarea", "dropdown", "checkboxes"].includes(type),
        `${name} uses "${type}", which is not an issue-form field type`,
      );
    }
    // Ids address the field in a prefill URL, so a duplicate silently makes one
    // of the two unaddressable.
    const ids = [...src.matchAll(/^ {4}id: (\S+)/gm)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${name} reuses a field id`);
  }
});

test("every form asks which site, and offers all of them", () => {
  // The one cost of a single queue: without this field a report cannot be
  // routed at all, and the reporter is the only person who still knows.
  for (const [name, src] of FORM_SRC) {
    assert.ok(src.includes("    id: site"), `${name} never asks which site`);
    for (const site of SITES) {
      assert.ok(src.includes(`        - ${site}`), `${name} does not offer ${site}`);
    }
  }
});

test("a correction cannot be filed without naming what says so", () => {
  // The site is a transcription of official charts and instructions. A change
  // with no source cannot be told from a guess once the issue is a month old,
  // which is the whole reason this field is required rather than encouraged.
  const src = FORM_SRC.get("content-correction.yml");
  const start = src.indexOf("    id: source");
  assert.notEqual(start, -1, "the correction form has no source field at all");
  // Bounded at the NEXT field, so this cannot pass by finding some later
  // field's own `required: true`. An unbounded slice is how a check like this ends
  // up reading the whole rest of the file and always succeeding.
  const next = src.indexOf("  - type:", start);
  const field = src.slice(start, next === -1 ? src.length : next);
  assert.match(field, /required: true/, "the source field on a correction is optional");
});

test("every form warns against putting personal data in a public issue", () => {
  // These sites keep what you enter in your browser and transmit nothing, so a
  // pasted screenshot is the one route by which someone's own points record or
  // ribbon rack could end up on a public issue.
  for (const [name, src] of FORM_SRC) {
    assert.match(
      src,
      /no personal information|not attach a screenshot|nothing CUI/i,
      `${name} does not warn against personal data`,
    );
  }
});

test("the chooser's own links resolve to templates that exist", () => {
  const config = read(join(TEMPLATE_DIR, "config.yml"));
  for (const [, template] of config.matchAll(/[?&]template=([\w.-]+)/g)) {
    assert.ok(FORMS.includes(template), `the chooser links ${template}, which does not exist`);
  }
  // This repo keeps blank issues so the maintainer can jot a note; the
  // satellites are the ones that must not.
  assert.match(config, /^blank_issues_enabled: true$/m);
});
