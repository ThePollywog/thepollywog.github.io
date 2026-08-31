/**
 * node tools/sabotage.mjs
 *
 * Breaks this folder on purpose, one defect at a time, and asserts that
 * `check.mjs` notices. A check you have never watched fail is a decoration, and
 * on a page with no logic — where every check is a string comparison against a
 * hand-written file — the failure mode is not a false negative but a check that
 * cannot fail at all: a regex that matches nothing, a slice that lands past the
 * end of the file, an assertion on a substring that is present in a comment.
 *
 * Each mutation is applied to a throwaway copy of the whole folder, `check.mjs`
 * is run against that copy, and a mutation is "killed" if the run exits non-zero.
 * A SURVIVOR means the corresponding check is not doing what its name says.
 *
 * This is the same practice as the parent project's tools/sabotage.mjs, and it
 * travels with this folder for the same reason check.mjs does.
 */

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Every entry names the check it is meant to kill, so a survivor points at the
 * assertion to go fix rather than starting a hunt.
 *
 *   { file, from, to }      replace `from` once; it MUST occur exactly once
 *   { files, from, to }     replace every occurrence in each listed file
 *   { add: { path, body } } create a file
 */
const MUTATIONS = [
  // --- the origin, spread across five files by necessity ---
  {
    label: "og:url gains a www. subdomain",
    kills: "every absolute self-reference uses exactly one origin",
    file: "index.html",
    from: '<meta property="og:url" content="https://thepollywog.github.io/" />',
    to: '<meta property="og:url" content="https://www.thepollywog.github.io/" />',
  },
  {
    label: "the origin is renamed everywhere, so the scan matches nothing",
    kills: "the >12 self-reference guard on the origin scan",
    files: ["index.html", "404.html", "robots.txt", "sitemap.xml", "site.webmanifest", "README.md"],
    from: "thepollywog.github.io",
    to: "example.invalid",
  },
  {
    label: "canonical points at /index.html instead of /",
    kills: "canonical, og:url and the JSON-LD all point at the front page",
    file: "index.html",
    from: '<link rel="canonical" href="https://thepollywog.github.io/" />',
    to: '<link rel="canonical" href="https://thepollywog.github.io/index.html" />',
  },
  {
    label: "robots.txt disallows the whole origin",
    kills: "robots.txt advertises the sitemap and blocks nothing",
    file: "robots.txt",
    from: "Allow: /",
    to: "Allow: /\nDisallow: /",
  },
  {
    label: "the Sitemap: line is dropped from robots.txt",
    kills: "robots.txt advertises the sitemap and blocks nothing",
    file: "robots.txt",
    from: "Sitemap: https://thepollywog.github.io/sitemap.xml",
    to: "",
  },
  {
    label: "webnavfit is dropped from the sitemap",
    kills: "the sitemap lists all three sites, with a real lastmod",
    file: "sitemap.xml",
    from: "  <url>\n    <loc>https://thepollywog.github.io/webnavfit/</loc>\n    <lastmod>2026-08-12</lastmod>\n  </url>\n",
    to: "",
  },
  {
    label: "a lastmod is written in US date order",
    kills: "the sitemap lists all three sites, with a real lastmod",
    file: "sitemap.xml",
    from: "<loc>https://thepollywog.github.io/saltdog/</loc>\n    <lastmod>2026-08-12</lastmod>",
    to: "<loc>https://thepollywog.github.io/saltdog/</loc>\n    <lastmod>08/12/2026</lastmod>",
  },

  // --- the head ---
  {
    label: "the title grows past what a result list shows",
    kills: "title and description are present and inside their useful lengths",
    file: "index.html",
    from: "<title>The Pollywog — Navy Reserve Quick Reference &amp; FITREP Tools</title>",
    to: "<title>The Pollywog — Navy Reserve Quick Reference, FITREP and EVAL Tools for Sailors and Reservists</title>",
  },
  {
    label: "the meta description is truncated to a fragment",
    kills: "title and description are present and inside their useful lengths",
    file: "index.html",
    from: "Free, unofficial browser tools for Navy Reservists — SALTDOG quick links, reference cards and readiness math, plus WEBNAVFIT for drafting FITREPs and EVALs.",
    to: "Free browser tools for Navy Reservists.",
  },
  {
    label: "the masthead wordmark is promoted to a second h1",
    kills: "exactly one h1, and it is not just the brand name",
    file: "index.html",
    from: '<p class="wordmark">The Pollywog</p>',
    to: '<h1 class="wordmark">The Pollywog</h1>',
  },
  {
    label: "the h1 is replaced by the brand name",
    kills: "exactly one h1, and it is not just the brand name",
    file: "index.html",
    from: "<h1>Navy paperwork, without the scavenger hunt</h1>",
    to: "<h1>The Pollywog</h1>",
  },
  {
    label: "og:image:width is off by one",
    kills: "the social card is complete and its declared size matches the file",
    file: "index.html",
    from: '<meta property="og:image:width" content="1200" />',
    to: '<meta property="og:image:width" content="1201" />',
  },
  {
    label: "og:image points at a square icon instead of the card",
    kills: "the social card is complete and its declared size matches the file",
    file: "index.html",
    from: '<meta property="og:image" content="https://thepollywog.github.io/assets/og-image.png" />',
    to: '<meta property="og:image" content="https://thepollywog.github.io/assets/icon-512.png" />',
  },
  {
    label: "og:image is made relative",
    kills: "the social card is complete and its declared size matches the file",
    file: "index.html",
    from: '<meta property="og:image" content="https://thepollywog.github.io/assets/og-image.png" />',
    to: '<meta property="og:image" content="assets/og-image.png" />',
  },
  {
    label: "the page is set to noindex",
    kills: "robots meta allows a large image preview",
    file: "index.html",
    from: '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />',
    to: '<meta name="robots" content="noindex, follow" />',
  },
  {
    label: "max-image-preview is dropped",
    kills: "robots meta allows a large image preview",
    file: "index.html",
    from: "index, follow, max-image-preview:large, max-snippet:-1",
    to: "index, follow",
  },

  // --- structured data ---
  {
    label: "the JSON-LD gains a trailing comma",
    kills: "the JSON-LD parses and every node is typed and identified",
    file: "index.html",
    from: '"inLanguage": "en-US",',
    to: '"inLanguage": "en-US",,',
  },
  {
    label: "a SoftwareApplication node loses its @id",
    kills: "the JSON-LD parses and every node is typed and identified",
    file: "index.html",
    from: '"@id": "https://thepollywog.github.io/#saltdog",\n',
    to: "",
  },
  {
    label: "the free offer loses its currency",
    kills: "each app is declared free in a way a parser accepts",
    file: "index.html",
    from: '"offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },\n            "featureList": [\n              "Navy Reserve systems directory',
    to: '"offers": { "@type": "Offer", "price": "0" },\n            "featureList": [\n              "Navy Reserve systems directory',
  },
  {
    label: "one JSON-LD answer is reworded away from the visible text",
    kills: "every FAQ answer in the structured data is on the page verbatim",
    file: "index.html",
    from: "At least 50 retirement points in your anniversary year, of which 15 come automatically from a full year of membership. SALTDOG's points tracker",
    to: "At least 50 retirement points a year, of which 15 are automatic. SALTDOG's points tracker",
  },
  {
    label: "a visible FAQ entry is deleted but left in the JSON-LD",
    kills: "every FAQ answer in the structured data is on the page verbatim",
    file: "index.html",
    from: "          <dt>Does any of this work offline?</dt>",
    to: "          <dt hidden>Does any of this work offline?</dt>",
  },

  // --- the disclaimer ---
  {
    label: "the disclaimer aside is removed",
    kills: "the page says it is unofficial, early and in every machine-readable field",
    file: "index.html",
    from: '<aside class="notice" role="note" aria-labelledby="unofficial">',
    to: '<aside class="quiet" role="note" aria-labelledby="unofficial">',
  },
  {
    label: '"unofficial" is dropped from the link-preview description',
    kills: "the page says it is unofficial, early and in every machine-readable field",
    files: ["index.html"],
    from: "Unofficial, free browser tools for Navy Reservists:",
    to: "Free browser tools for Navy Reservists:",
  },
  {
    label: "the Organization node stops disclaiming affiliation",
    kills: "the page says it is unofficial, early and in every machine-readable field",
    file: "index.html",
    from: "An independent, unofficial project. Not affiliated with, endorsed by, or a publication of the U.S. Department of the Navy.",
    to: "An independent project supporting U.S. Navy Sailors and Reservists.",
  },

  // --- assets ---
  {
    label: "a stylesheet-less rename leaves the logo reference dangling",
    kills: "every local reference in index.html resolves to a file",
    file: "index.html",
    from: 'src="assets/logo-160.png"',
    to: 'src="assets/logo-159.png"',
  },
  {
    label: "an unused asset is shipped",
    kills: "every asset in the folder is referenced by something",
    add: { path: "assets/logo-old.png", body: "not really a png" },
  },
  {
    label: "an icon's declared size no longer matches the file",
    kills: "the manifest parses, and its icons exist at the sizes it claims",
    file: "site.webmanifest",
    from: '{ "src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" }',
    to: '{ "src": "assets/icon-192.png", "sizes": "180x180", "type": "image/png", "purpose": "any" }',
  },
  {
    label: "the maskable icon is relabelled as an ordinary one",
    kills: "the manifest parses, and its icons exist at the sizes it claims",
    file: "site.webmanifest",
    from: '"purpose": "maskable"',
    to: '"purpose": "any"',
  },
  {
    label: "start_url is made root-absolute",
    kills: "the manifest parses, and its icons exist at the sizes it claims",
    file: "site.webmanifest",
    from: '"start_url": ".",',
    to: '"start_url": "/",',
  },
  {
    label: "the favicon's accent is changed without touching the CSS",
    kills: "the favicon svg and the ico are the same mark",
    file: "assets/favicon.svg",
    from: '<g fill="#A9B063">',
    to: '<g fill="#7A8048">',
  },

  // --- claims the page makes about itself ---
  {
    label: "an analytics snippet is added",
    kills: "there is no JavaScript on the page",
    file: "index.html",
    from: "  <body>",
    to: '  <body>\n    <script>window.dataLayer=[];</script>',
  },
  {
    label: "an inline event handler is added",
    kills: "there is no JavaScript on the page",
    file: "index.html",
    from: '<a class="btn" href="saltdog/">Open SALTDOG</a>',
    to: '<a class="btn" href="saltdog/" onclick="track()">Open SALTDOG</a>',
  },
  {
    label: "a webfont is pulled from a CDN",
    kills: "nothing is fetched from a third party",
    file: "index.html",
    from: '<link rel="manifest" href="site.webmanifest" />',
    to: '<link rel="manifest" href="site.webmanifest" />\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />',
  },
  {
    label: "the hero image loses its intrinsic dimensions",
    kills: "the hero image cannot shift the layout",
    file: "index.html",
    from: '            width="160"\n            height="160"\n',
    to: "",
  },
  {
    label: "the hero image is lazy-loaded",
    kills: "the hero image cannot shift the layout",
    file: "index.html",
    from: '            fetchpriority="high"',
    to: '            loading="lazy"',
  },
  {
    label: "the <picture> is flattened, so the 134 KB PNG ships to everyone",
    kills: "the hero image cannot shift the layout",
    file: "index.html",
    from: '<source\n            type="image/webp"\n            srcset="assets/logo-160.webp 1x, assets/logo-320.webp 2x"\n          />',
    to: "",
  },

  // --- palette ---
  {
    label: "the two accents are 'simplified' into one shared value",
    kills: "every colour pair the page uses clears WCAG AA, in both schemes",
    file: "index.html",
    from: "--accent: #5c5b32; /* 6.39:1 on --bg, 7.01:1 on --surface */",
    to: "--accent: #a9b063; /* 6.39:1 on --bg, 7.01:1 on --surface */",
  },
  {
    label: "the muted body colour is darkened past legibility",
    kills: "every colour pair the page uses clears WCAG AA, in both schemes",
    file: "index.html",
    from: "--muted: #a9af9f; /* 8.33:1 on --bg */",
    to: "--muted: #3d4438; /* 8.33:1 on --bg */",
  },
  {
    label: "the button label goes white on olive",
    kills: "every colour pair the page uses clears WCAG AA, in both schemes",
    file: "index.html",
    from: "--on-accent: #0e130f; /* 8.11:1 on --accent */",
    to: "--on-accent: #ffffff; /* 8.11:1 on --accent */",
  },
  {
    label: "the dark theme-color drifts from the dark background",
    kills: "the theme-color meta tags match the backgrounds they claim to match",
    file: "index.html",
    from: '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0E130F" />',
    to: '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#10203A" />',
  },
  {
    label: "the card generator's background drifts from the page's",
    kills: "the asset builder's palette literals match the stylesheet",
    file: "tools/build-assets.py",
    from: "BG = (0x0E, 0x13, 0x0F)",
    to: "BG = (0x0A, 0x16, 0x28)",
  },

  // --- 404.html, whose rules are inverted ---
  {
    label: "404.html uses a relative asset path",
    kills: "404.html is noindex, uncanonicalised, and root-absolute throughout",
    file: "404.html",
    from: '<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />',
    to: '<link rel="icon" type="image/svg+xml" href="assets/favicon.svg" />',
  },
  {
    label: "404.html becomes indexable",
    kills: "404.html is noindex, uncanonicalised, and root-absolute throughout",
    file: "404.html",
    from: '<meta name="robots" content="noindex, follow" />',
    to: '<meta name="robots" content="index, follow" />',
  },
  {
    label: "404.html gains a canonical pointing at the home page",
    kills: "404.html is noindex, uncanonicalised, and root-absolute throughout",
    file: "404.html",
    from: "    <title>Page not found — The Pollywog</title>",
    to: '    <title>Page not found — The Pollywog</title>\n    <link rel="canonical" href="https://thepollywog.github.io/" />',
  },

  // --- accessibility floor ---
  {
    label: "the focus ring is removed",
    kills: "the page is navigable and every image is described or hidden",
    file: "index.html",
    from: "      a:focus-visible,\n      summary:focus-visible {\n        outline: 2px solid var(--accent);",
    to: "      a:focus-visible,\n      summary:focus-visible {\n        outline: none;",
  },
  {
    label: "the skip link is removed",
    kills: "the page is navigable and every image is described or hidden",
    file: "index.html",
    from: '<a class="skip" href="#main">Skip to content</a>',
    to: "",
  },
  {
    label: "the hero image loses its alt text",
    kills: "the page is navigable and every image is described or hidden",
    file: "index.html",
    from: '            alt="The Pollywog emblem: a tadpole in a combat helmet, on a round patch."\n',
    to: "",
  },
  {
    label: "a section heading skips from h1 to h3",
    kills: "the page is navigable and every image is described or hidden",
    file: "index.html",
    from: '<h2 id="tools-h">Two sites, one job each</h2>',
    to: '<h3 id="tools-h">Two sites, one job each</h3>',
  },
  {
    label: "the decorative 404 image is un-hidden while keeping an empty alt",
    kills: "the page is navigable and every image is described or hidden",
    file: "404.html",
    from: '        aria-hidden="true"\n',
    to: "",
  },
  {
    label: "the lang attribute is dropped",
    kills: "the page is navigable and every image is described or hidden",
    file: "index.html",
    from: '<html lang="en">',
    to: "<html>",
  },
];

function apply(dir, m) {
  if (m.add) {
    writeFileSync(join(dir, m.add.path), m.add.body);
    return;
  }
  const files = m.files ?? [m.file];
  let total = 0;
  for (const f of files) {
    const p = join(dir, f);
    const before = readFileSync(p, "utf8");
    const count = before.split(m.from).length - 1;
    total += count;
    if (m.files) {
      writeFileSync(p, before.split(m.from).join(m.to));
    } else {
      if (count !== 1) {
        throw new Error(`"${m.from.slice(0, 50)}…" occurs ${count} times in ${f}, expected 1`);
      }
      writeFileSync(p, before.replace(m.from, m.to));
    }
  }
  if (total === 0) throw new Error(`mutation matched nothing: ${m.label}`);
}

let survivors = 0;
let broken = 0;

for (const [i, m] of MUTATIONS.entries()) {
  const dir = mkdtempSync(join(tmpdir(), "pollywog-sabotage-"));
  try {
    cpSync(ROOT, dir, { recursive: true });
    apply(dir, m);
    const run = spawnSync(process.execPath, [join(dir, "tools", "check.mjs")], {
      encoding: "utf8",
    });
    const killed = run.status !== 0;
    const n = String(i + 1).padStart(2, " ");
    if (killed) {
      console.log(`${n}. killed    ${m.label}`);
    } else {
      survivors++;
      console.log(`${n}. SURVIVED  ${m.label}`);
      console.log(`         should have been caught by: ${m.kills}`);
    }
  } catch (err) {
    // A mutation that cannot be applied is itself a defect: it means the string
    // it targets has been edited and the mutation is no longer testing anything.
    broken++;
    console.log(`${String(i + 1).padStart(2, " ")}. BROKEN    ${m.label}\n         ${err.message}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(
  `\n${MUTATIONS.length} mutations, ${MUTATIONS.length - survivors - broken} killed, ` +
    `${survivors} survived, ${broken} could not be applied`,
);
process.exit(survivors + broken > 0 ? 1 : 0);
