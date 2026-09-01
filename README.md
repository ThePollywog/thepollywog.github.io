# thepollywog.github.io — homepage

The landing page for the GitHub Pages **user site** at
`https://thepollywog.github.io/`. It summarizes what the two apps published on
that origin are for and sends people into them.

**Unofficial.** Not a Department of the Navy publication. Nothing here or in
either app is a system of record.

```
homepage/
├── index.html          the page — markup, inline CSS, structured data
├── 404.html            served for every unresolved path on the whole origin
├── robots.txt          crawl policy for the whole origin; names both sitemaps
├── sitemap.xml         three URLs: /, /saltdog/, /webnavfit/
├── site.webmanifest    name, theme colour, and the PWA icon set
├── .nojekyll           tells Pages to publish the files as-is
├── assets/             icons, logo, link-preview card
├── go/                 browser go-link redirector — see below
│   ├── index.html      looks up ?to= in links.json and redirects
│   └── links.json      the shortcut manifest — edit this to add links
└── tools/
    ├── build-assets.py   generates every binary in assets/
    ├── check.mjs         node tools/check.mjs — 24 checks, zero dependencies
    ├── sabotage.mjs      breaks the folder 50 ways, asserts check.mjs notices
    └── sync-go-links.mjs merges a saved MyNavy Portal Quick Links page into go/links.json
```

## Deploying it

Copy the contents of this folder to the root of the `ThePollywog.github.io`
repository and push. There is no build step: what is here is what gets served.
`/saltdog/` and `/webnavfit/` are published by their own repositories and are not
part of this folder.

```sh
node tools/check.mjs                # before every push
node tools/sabotage.mjs             # after editing check.mjs
python3 -m http.server 8080         # then open http://localhost:8080/
```

`check.mjs` needs nothing installed — `node:test` and `node:assert` are built in.
`build-assets.py` needs Pillow and ImageMagick's `convert`, and only needs to run
when the artwork changes; its outputs are committed.

## Why it is one hand-written file

The page has two jobs — be found, and load instantly — and both are served by
one HTTP request producing a fully painted page. So: no framework, no webfont,
**no JavaScript at all**, no analytics, no cookie banner. The stylesheet is small
enough to inline whole, which removes the render-blocking request *and* the
critical-CSS split that would otherwise have to be kept correct. The only
subresource in the content is the logo — a 7.3 KB WebP (18 KB at 2×) with a PNG
fallback and explicit dimensions — so there is nothing left that can shift the
layout or delay the text.

`check.mjs` asserts the no-JavaScript and no-third-party claims, because both are
the kind of thing that gets undone in a hurry by something that looks harmless.

## Go links

`/go/` is a tiny redirector: `go/index.html` reads a `?to=` query parameter,
looks it up in `go/links.json`, and redirects. Visiting `/go/` with no match
lists every shortcut currently in the manifest.

**Add it to Chrome (or any Chromium browser):**

1. Settings → Search engine → Manage search engines → **Add**.
2. Name: anything, e.g. `go links`.
3. Shortcut: `go`.
4. URL: `https://thepollywog.github.io/go/?to=%s`.
5. In the address bar, type `go nsips`, press Tab or Space, then Enter.

**Add it to Firefox:** right-click the address bar on `/go/` (or add a
bookmark keyword) with keyword `go` and URL
`https://thepollywog.github.io/go/?to=%s`.

**Add one shortcut by hand:** edit `go/links.json` — it's a flat `{"key":
"url"}` map, sorted by key — commit, and push. No build step, no code change.

**Bulk-add from MyNavy Portal's Quick Links page:** `go/links.json` started
as a curated pull from MyNavy Portal's own directory of these systems —
`https://my.navy.mil/quick-links.html` ("Quick Links Classic") — which lists
the Most Popular Quick Links plus every entry across all four A–Z accordion
columns. That page isn't fetchable by a script (it 404s outside a logged-in
browser session), so keeping the manifest current is a manual-in,
automatic-out loop:

1. Open `https://my.navy.mil/quick-links.html` in a browser and save it
   (Ctrl+S, "Webpage, HTML only" is enough — the markup is server-rendered).
2. Run `node tools/sync-go-links.mjs path/to/quick-links.html` — add
   `--dry-run` first to preview.

It extracts every `(title, URL)` pair from the saved page and merges in
whatever isn't already in the manifest, matching on URL (ignoring MyNavy
Portal's `utm_source` tracking param) so it never touches or renames an
existing hand-picked key like `nsips` or `bol`. New links get an
auto-generated key from their title (`"Navy eLearning"` → `navyelearning`) —
rename those to something short by hand afterward, the way that one became
`nel`. Nothing is ever removed automatically; a link MyNavy Portal drops
stays in the manifest until someone deletes it on purpose.

## The canonical-URL hazard

Five files hardcode `https://thepollywog.github.io` because the specs give no
choice: `rel=canonical`, `og:url`, `og:image`, `twitter:image`, the JSON-LD
`@id`/`url` fields, every `<loc>` in `sitemap.xml`, and the `Sitemap:` line in
`robots.txt` all require an absolute URL.

**If this site ever moves to a custom domain, those are the first thing to
change, and a canonical tag left pointing at the old host is the most expensive
mistake available here** — it explicitly instructs Google to index the other URL
instead of yours.

The duplication cannot be removed, so `check.mjs` makes a disagreement fail
loudly instead: it finds every URL matching `https?://…pollywog…` across all six
files and asserts each one equals a single `ORIGIN` constant. Change the constant
and the failures list exactly which files still say the old thing. The pattern is
deliberately loose enough to catch a stray `www.`, a bare `http://`, or a
half-finished domain migration, and there is a guard asserting it matched more
than twelve references so that a rename cannot make the check pass by finding
nothing.

## Assets

`tools/build-assets.py` generates every binary from two committed sources:
`assets/logo-512.png` (the patch artwork, trimmed to a transparent circle) and
`assets/favicon.svg` (a hand-authored simplified mark). 512 is the smallest size
everything else derives from without upscaling — the largest consumer is the
512 px icon at an 0.88 inset — so it is the source of record. `--from PATH`
re-derives it from the original artwork, which lives outside this folder and is
deliberately not committed here.

Decisions the generated files embody:

- **The favicon is not the patch.** The patch is a detailed illustration —
  helmeted tadpole, pond, ring of lettering — and at the 16 px a tab actually
  rasterizes, all of it collapses into an olive smudge. Five candidate marks were
  rendered at 96/32/16 and compared; the surviving one is a blunt-tailed tadpole
  silhouette. Two rejected variants are recorded in `favicon.svg` because they
  were the *obvious* ideas and both failed: a comma-shaped tail with an eye reads
  as a comet, and a tapering swept tail reads as a trumpet.
- **A tadpole, not an anchor.** SALTDOG's favicon is an anchor; two tabs from the
  same origin showing the same glyph is worse than no glyph.
- **`favicon.ico` is rasterized from `favicon.svg`** by the build script, so the
  tab icon and its fallback cannot drift apart.
- **The icons are opaque tiles.** iOS composites an apple-touch icon onto white
  and Android onto whatever the launcher feels like, so a transparent dark-green
  tadpole would land on a white field roughly half the time.
- **One maskable icon at a 0.62 inset**, because Android may crop to a circle
  inscribed in 80% of the tile and will otherwise shave the artwork. `check.mjs`
  asserts exactly one exists and that every declared `sizes` matches the file's
  actual pixel dimensions, read out of the PNG header.
- **`display: "browser"` in the manifest.** A link hub is not an app; claiming
  `standalone` would make Chrome offer to install a page whose whole content is
  two outbound links. The manifest is there for the name, the theme colour and
  the icons, not for installability. (JSON has no comments, which is why this
  note is here.)
- **The link-preview card carries the disclaimer.** A preview is frequently the
  whole of what someone sees before deciding whether this is an official Navy
  resource, and it gets pasted into group chats stripped of all other context.

## Palette

Taken from the patch artwork rather than invented, and every pair measured.
`index.html` records the contrast ratio next to each token. The one number that
decided the scheme: the patch's own olive lettering is `#5C5B32`, which is
**2.68:1** on the dark background and fails outright — so the dark theme uses a
brightened `#A9B063` (8.11:1) and the light theme uses the original (6.39:1).

Each accent is unusable in the other theme (`#A9B063` is 2.11:1 on the light
background), which is the same trap SALTDOG documents for navy-and-gold. So:
**the olive accent never carries body text in either theme** — it carries
headings, rules, and its own inverted button label.

`check.mjs` recomputes every ratio from the stylesheet rather than trusting the
comments, and separately asserts that the two accents have *not* converged onto
one shared value, which is the obvious "simplification" that would break both
themes at once. It also checks that the palette literals in `build-assets.py`
still match the CSS, because the link-preview card is drawn in Python and the
page in CSS, and the only place the two are ever seen side by side is a link
unfurl — the least likely place to notice they have drifted.

## 404.html breaks the folder's own rules, deliberately

Every path in `index.html` is relative. Every path in `404.html` is
**root-absolute**, because Pages serves that file *at the URL that failed*: a
request for `/saltdog/nope` renders it while the browser still believes the base
is `/saltdog/`, so a relative `assets/favicon.svg` would be fetched from
`/saltdog/assets/` and 404 in turn. Root-absolute is the only form that resolves
from every path — and it is precisely what makes that one file non-portable to a
subdirectory deployment. `check.mjs` asserts the distinction in both directions
rather than trusting it.

It also carries `noindex` and **no** `rel=canonical`. A 404 whose canonical
points at the home page asks a crawler to treat every broken URL as a duplicate
of the front page, which is how soft-404s get indexed.

## Verification

```sh
node tools/check.mjs      # 24 checks
node tools/sabotage.mjs   # 50 mutations, all of which must be killed
```

24 checks, no dependencies. There is no logic on this page to regression-test;
every defect it can have is a defect of **agreement** — two copies of the FAQ
drifting apart, a canonical and an `og:url` naming different origins, a declared
image size that no longer matches the file, an icon renamed out from under the
manifest, a contrast ratio in a comment for a colour that has changed. None of
those break the page visibly, all of them are invisible in a browser, and every
one is the kind of thing a machine should be looking at instead of a person.

Following the standing practice in this repo, **every check here was run against
a deliberately broken copy of the file it inspects and watched to fail before it
was kept** — a check you have never seen fail is a decoration. That is what
`tools/sabotage.mjs` automates: it applies each of 50 defects to a throwaway copy
of the folder, runs `check.mjs` against the copy, and reports a **survivor** if
the run still passes. Every mutation names the check it is meant to kill, so a
survivor points straight at the assertion to go fix.

### What that discipline actually caught

Not a single defect in the page. **Four checks that were reading this folder's
own explanatory comments instead of its markup** — which is the specific hazard
of a house style that comments heavily, because a comment discussing `<dt>` or
`outline: none` or `#A9B063` contains the exact string the naive check is
grepping for:

- Three failed on the **first run** of `check.mjs`. The FAQ check's question
  regex matched from inside the file's head comment to the first real `</dt>`;
  the focus-ring check was satisfied by a CSS comment reading *"Never `outline:
  none`"*; and the third-party-subresource check flagged `<link rel="canonical">`
  because its heuristic was "a `<link>` with an absolute href" rather than "a
  `<link>` that fetches something".
- The fourth **passed** and was only exposed when sabotage repainted the
  favicon's tadpole a different olive and the mutation **survived**:
  `assert.match(svg, /#A9B063/i)` was being satisfied by `favicon.svg`'s own
  comment explaining where that colour comes from. This is the worse of the two
  outcomes and the reason the sabotage harness exists at all.

The fix is `stripComments()` for HTML and SVG and `styleOf()` for the inlined
stylesheet, applied once at the top of `check.mjs` so no later check can forget;
the favicon check now compares the *set* of `fill=` attributes against the dark
palette's tokens with `deepEqual`, which cannot be satisfied by prose.

### Manual verification, for the things a checker cannot see

Both pages were rendered in headless Chrome with `prefers-color-scheme` forced
each way, at 320–1440 px wide, with console errors and warnings treated as
failures: no console output, no horizontal overflow at any width, and both
schemes read correctly. Two defects were found this way and by no other means —
the pale rim around the logo on the link-preview card (the circular mask was
keeping the original artwork's antialiased outer edge, a blend toward the white
page it was drawn on, invisible on white and obvious on the dark card; fixed by
the generator's `BLEED` inset), and the rasterised `favicon.ico`, which had to be
looked at at 16, 32 and 48 px to confirm it still reads as a tadpole.
