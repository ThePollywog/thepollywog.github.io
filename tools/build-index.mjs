/**
 * node tools/build-index.mjs
 *
 * Renders index.html's <main> content from README.md. README.md is the one
 * source of truth for the page's visible copy; the <head>, masthead and
 * footer stay hand-authored in tools/index.template.html because markdown has
 * no representation for meta tags, JSON-LD, or inline CSS.
 *
 * README.md is NOT parsed as general markdown. It is a fixed, five-section
 * document and this is a purpose-built reader for that exact shape: an H1,
 * two lede paragraphs, a blockquote disclaimer, then five
 * `<!-- section id=... eyebrow="..." -->` blocks, each containing standard
 * block-level markdown (headings, paragraphs, lists, `<!-- card -->` blocks).
 * A generic CommonMark parser would still need all of this bespoke-section
 * knowledge layered on top to produce the exact markup check.mjs enforces
 * (aria-labelledby ids, the FAQ <dl>, the go-link <a class="btn">), so it
 * would not remove any of the logic here — only add a dependency.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SECTIONS = {
  golinks: { article: false },
  tools: { article: true },
  how: { links: true },
  faq: { faq: true },
  official: { links: true },
};

/** Inline markdown: code spans, then links, then bold. Order matters — code
 * spans are protected from the later passes, and link text can be bold but
 * not the reverse in anything this file contains. */
function inline(md) {
  return md
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => `<a href="${href}">${text}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function isBlank(line) {
  return line === undefined || line.trim() === "";
}

/** True for any line that starts a new block, so a paragraph/list-item
 * continuation scan knows where to stop. */
function startsBlock(line) {
  return (
    isBlank(line) ||
    /^#{1,6}\s/.test(line) ||
    /^-\s/.test(line) ||
    /^\d+\.\s/.test(line) ||
    /^>/.test(line) ||
    /^<!--/.test(line)
  );
}

/** Reads one logical paragraph: the current line plus any wrapped
 * continuation lines, joined with a space. Returns [text, nextIndex]. */
function readParagraph(lines, i) {
  const parts = [lines[i].trim()];
  i++;
  while (i < lines.length && !startsBlock(lines[i])) {
    parts.push(lines[i].trim());
    i++;
  }
  return [parts.join(" "), i];
}

/** Reads a `-` or `1.` list. Each item's wrapped continuation lines are
 * folded into that item. Returns [{ordered, items}, nextIndex]. */
function readList(lines, i) {
  const ordered = /^\d+\.\s/.test(lines[i]);
  const marker = ordered ? /^\d+\.\s+/ : /^-\s+/;
  const items = [];
  while (i < lines.length && marker.test(lines[i])) {
    const parts = [lines[i].replace(marker, "").trim()];
    i++;
    while (i < lines.length && !isBlank(lines[i]) && !marker.test(lines[i]) && !startsBlock(lines[i])) {
      parts.push(lines[i].trim());
      i++;
    }
    items.push(parts.join(" "));
  }
  return [{ ordered, items }, i];
}

/** A paragraph that is nothing but a single link becomes the section/card's
 * call-to-action button rather than a plain <p>. */
function renderParagraph(text) {
  const soleLink = text.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (soleLink) {
    return `<p class="go"><a class="btn" href="${soleLink[2]}">${soleLink[1]}</a></p>`;
  }
  return `<p>${inline(text)}</p>`;
}

/** "how" and "official" render as a two-column term/description list; every
 * other list is a plain <ul>/<ol>. */
function renderList({ ordered, items }, linksStyle) {
  if (linksStyle) {
    const lis = items
      .map((item) => {
        const m = item.match(/^(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))\s+—\s+(.+)$/);
        if (!m) throw new Error(`links-list item is not "term — description": ${item}`);
        return `<li>${inline(m[1])}<span>${inline(m[2])}</span></li>`;
      })
      .join("\n");
    return `<ul class="links">\n${lis}\n</ul>`;
  }
  const tag = ordered ? "ol" : "ul";
  const lis = items.map((item) => `<li>${inline(item)}</li>`).join("\n");
  return `<${tag}>\n${lis}\n</${tag}>`;
}

/** Reads blocks (paragraph / list / heading / card) until a line the caller
 * doesn't own: a directive comment, or end of input. Cards recurse into this
 * same reader for their own content. */
function readBlocks(lines, i, opts) {
  const out = [];
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    if (/^<!--\s*\/(section|card)\s*-->$/.test(line)) break;

    if (line === "<!-- card -->") {
      i++;
      const [innerBlocks, next] = readBlocks(lines, i, opts);
      i = next;
      if (!/^<!--\s*\/card\s*-->$/.test(lines[i])) throw new Error("unterminated <!-- card -->");
      i++;
      const tag = opts.article ? "article" : "div";
      out.push(`<${tag} class="card">\n${innerBlocks.join("\n")}\n</${tag}>`);
      continue;
    }

    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      if (opts.faq && level === 3) {
        // Q&A pair: this heading is the question, the paragraph right after
        // it is the answer, mirroring the JSON-LD FAQ block.
        const question = h[2];
        i++;
        while (i < lines.length && isBlank(lines[i])) i++;
        const [answer, next] = readParagraph(lines, i);
        i = next;
        out.push({ dt: question, dd: answer });
        continue;
      }
      // Card title: "### [SALTDOG](saltdog/)" — a bare link becomes the
      // whole heading's content, same rule as a go-link button.
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^-\s/.test(line) || /^\d+\.\s/.test(line)) {
      const [list, next] = readList(lines, i);
      i = next;
      out.push(renderList(list, Boolean(opts.links)));
      continue;
    }

    const [para, next] = readParagraph(lines, i);
    i = next;
    out.push(renderParagraph(para));
  }
  return [out, i];
}

/** Joins a section/card's collected blocks into HTML: FAQ blocks become
 * <dt>/<dd> pairs inside a <dl>; a leading plain paragraph — the section's
 * "sec-note" intro, before any card or list — gets that class; and, in an
 * article-card section, the cards are grouped into their own <div class="cards">
 * so a preceding intro paragraph stays outside it. */
function blocksToHtml(blocks, opts) {
  if (opts.faq) {
    const dl = blocks.map((b) => `<dt>${inline(b.dt)}</dt>\n<dd>${inline(b.dd)}</dd>`).join("\n");
    return `<dl class="faq">\n${dl}\n</dl>`;
  }
  const strings = blocks.slice();
  if (strings[0]?.startsWith("<p>")) strings[0] = strings[0].replace("<p>", '<p class="sec-note">');
  if (opts.article) {
    const cards = strings.filter((b) => b.startsWith("<article"));
    const rest = strings.filter((b) => !b.startsWith("<article"));
    return [...rest, `<div class="cards">\n${cards.join("\n")}\n</div>`].join("\n");
  }
  return strings.join("\n");
}

function renderSection(id, eyebrow, lines, i) {
  const opts = SECTIONS[id];
  if (!opts) throw new Error(`unknown section id "${id}"`);
  const h = lines[i].match(/^##\s+(.*)$/);
  if (!h) throw new Error(`section "${id}" must open with an H2, got: ${lines[i]}`);
  i++;
  const [blocks, next] = readBlocks(lines, i, opts);
  i = next;
  if (!/^<!--\s*\/section\s*-->$/.test(lines[i])) throw new Error(`unterminated section "${id}"`);
  i++;

  const heading = `<h2 id="${id}-h">${inline(h[1])}</h2>`;
  const inner = blocksToHtml(blocks, opts);
  return [
    `<section id="${id}" aria-labelledby="${id}-h">\n` +
      `<p class="eyebrow">${inline(eyebrow)}</p>\n${heading}\n${inner}\n</section>`,
    i,
  ];
}

export function renderMain(md) {
  const lines = md.split("\n");
  let i = 0;
  const skip = () => {
    while (i < lines.length && isBlank(lines[i])) i++;
  };

  skip();
  const h1 = lines[i].match(/^#\s+(.*)$/);
  if (!h1) throw new Error("README.md must open with an H1");
  const out = [`<h1>${inline(h1[1])}</h1>`];
  i++;
  skip();

  while (i < lines.length && !lines[i].startsWith(">")) {
    const [text, next] = readParagraph(lines, i);
    out.push(`<p class="lede">${inline(text)}</p>`);
    i = next;
    skip();
  }

  // Blockquote disclaimer -> the notice aside. Blank ">" lines split it into
  // paragraphs; the first paragraph's leading "**Unofficial.**" gets the id
  // the aside's aria-labelledby points at.
  const bqParas = [];
  let cur = [];
  while (i < lines.length && (lines[i].startsWith(">") || lines[i] === ">")) {
    const content = lines[i].replace(/^>\s?/, "");
    if (content.trim() === "") {
      if (cur.length) bqParas.push(cur.join(" "));
      cur = [];
    } else {
      cur.push(content.trim());
    }
    i++;
  }
  if (cur.length) bqParas.push(cur.join(" "));
  if (!bqParas.length) throw new Error("README.md is missing the blockquote disclaimer");
  const bqHtml = bqParas
    .map((p, idx) => {
      let html = inline(p);
      if (idx === 0) html = html.replace(/^<strong>Unofficial\.<\/strong>/, '<strong id="unofficial">Unofficial.</strong>');
      return `<p>\n${html}\n</p>`;
    })
    .join("\n");
  out.push(`<aside class="notice" role="note" aria-labelledby="unofficial">\n${bqHtml}\n</aside>`);
  skip();

  while (i < lines.length) {
    if (isBlank(lines[i])) {
      i++;
      continue;
    }
    if (lines[i] === "---") break; // trailing meta note about this file itself
    const sec = lines[i].match(/^<!--\s*section\s+id=(\S+)\s+eyebrow="([^"]+)"\s*-->$/);
    if (!sec) throw new Error(`expected a "<!-- section -->" directive, got: ${lines[i]}`);
    i++;
    skip();
    const [html, next] = renderSection(sec[1], sec[2], lines, i);
    out.push(html);
    i = next;
    skip();
  }

  return out.join("\n\n");
}

export function build() {
  const md = readFileSync(join(ROOT, "README.md"), "utf8");
  const template = readFileSync(join(ROOT, "tools/index.template.html"), "utf8");
  const main = renderMain(md);
  const html = template.replace("      <!-- BUILD:MAIN -->", main);
  return html;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(join(ROOT, "index.html"), build());
  console.log("wrote index.html from README.md");
}
