# Navy supporting tool and information

Tools for U.S. Navy Sailors — built to simplify routine administrative tasks and questions.

No account. No install. No server. Nothing you type ever leaves your machine.

> **Unofficial.** The Pollywog is an independent project. It is not affiliated with, endorsed by,
> or a publication of the Department of the Navy, and nothing here is a system of record.
>
> Verify anything you act on against the official source, your NRC, or MyNavy Career Center at
> [1-833-330-MNCC](tel:+18333306622).

<!-- section id=golinks eyebrow="Set this up first" -->

## Enable `go website` in your browser address bar

[/go/](go/) is a browser shortcut redirector: add it as a custom search engine once, and typing
`go` plus a keyword jumps straight to a Navy system instead of hunting through MyNavy Portal for it.

<!-- card -->

**Chrome (or any Chromium browser):**

1. Settings → Search engine → Manage search engines → **Add**.
2. Name: anything, e.g. `go links`.
3. Shortcut: `go`.
4. URL: `https://thepollywog.github.io/go/?to=%s`.
5. In the address bar, type `go nsips`, press Enter.

**Firefox:** right-click the address bar on [/go/](go/) (or add a bookmark keyword) with keyword
`go` and URL `https://thepollywog.github.io/go/?to=%s`.

[See every go link](go/)

<!-- /card -->
<!-- /section -->

<!-- section id=tools eyebrow="The tools" -->

## WebNAVFIT, SaltDog and PDF Wizard

<!-- card -->

### [SALTDOG](saltdog/)

A condensed quick-reference desk for Navy Sailors: where the references are, supporting information, and readiness
information.

- A directory of the systems a SELRES actually touches — NSIPS, BOL, MyNavy Portal, milConnect and the rest — each
  marked CAC-required or open
- An annual checklist where every item links the application that completes it
- [One-page reference cards](saltdog/knowledge/): ranks and insignia for all six services, awards precedence, combatant
  commands, numbered fleets, joint staff codes, the phonetic alphabet, and Navy customs and courtesies
- Readiness math — retirement points and good years, EVAL and FITREP due dates, a ribbon rack in order of precedence
- An offline keyword search across every card. Not an AI, no network calls

[Open SALTDOG](saltdog/)

<!-- /card -->
<!-- card -->

### [WEBNAVFIT](webnavfit/)

A browser reconstruction of NAVFIT98A for drafting performance evaluations and printing the official form.

- FITREP, EVAL and Chief Eval entry with the correct traits for each report type
- Live trait averaging, RSCA, and promotion-recommendation summary as you type
- Output onto the real NAVPERS 1610/2 — drawn at the sizes and positions eNavFit uses, so the printed form matches
- Summary groups organised by reporting senior and reporting period
- Everything stored in your browser, exportable to a single file you keep

[Open WEBNAVFIT](webnavfit/)

<!-- /card -->
<!-- card -->

### [PDF WIZARD](pdf-wizard/)

A PDF viewer and editor for administrative paperwork, with CAC digital signing.

- View, fill forms, comment, draw, edit text and images, organise pages, protect and redact
- Sign with a CAC — fill empty signature fields or draw new ones, and several people can sign the same form in turn
  without invalidating the signatures already on it
- Check signatures against the DoD PKI root and issuing CAs, bundled with the app
- Files kept in your browser's storage, with the last 10 versions of each
- CAC signing needs a small browser extension and helper installed on the computer; everything else needs nothing

[Open PDF WIZARD](pdf-wizard/)

<!-- /card -->
<!-- card -->

### [HOW TO POLLYWOG on YouTube](https://www.youtube.com/@HowToPollywog)

Narrated, captioned explainer videos that walk through Navy training material one idea at a time.

- Series built from public Navy references — radar and electronic warfare fundamentals, NEETS electronics modules, and
  more
- Each scene carries one concept, with the numbers worked through on screen rather than just stated
- Burned-in captions and a separate caption track, so they work with the sound off
- Free to watch, no account needed

[Watch on YouTube](https://www.youtube.com/@HowToPollywog)

<!-- /card -->
<!-- /section -->

<!-- section id=how eyebrow="How they work" -->

## Static pages, on purpose

Both tools are static files. There is no application server anywhere in the picture, and that constraint decided most of
what they are and their functionality.

- **Nothing is uploaded** — Your points, your checklist, your drafts: all of it lives in your own browser's storage.
  There is nowhere to send it to and no analytics monitoring activity.
- **They keep working with no signal** — Once a page has loaded it needs no network.
- **Every fact names its source** — Reference pages cite the instruction behind them and link the original PDF, so a
  transcription can be checked against the chart it came from instead of trusted.
- **They say when they do not know** — SALTDOG's search returns an honest "I don't have that" and points you at MyNavy
  HR or MNCC rather than inventing a plausible answer.

<!-- /section -->

<!-- section id=faq eyebrow="Questions" -->

## The things people ask first

### Is this an official Navy website?

No. The Pollywog is an independent project with no affiliation to the Department of the Navy, BUPERS, or any command.
Nothing here is a system of record. Verify anything you act on against the official source, your NRC, or MyNavy Career
Center at 1-833-330-MNCC.

### Do I need an account, a CAC, or a download?

None of the three. Both tools are static web pages: you open a link and they run. There is no sign-in, no install, and
no server to send anything to. The Navy systems these tools point you at still need a CAC, but the tools themselves do
not.

### Where does my data go?

Nowhere. Everything you type stays in your own browser's local storage, and both tools can export it to a file you keep.
There is no backend, no analytics, and no tracking. Clearing your browser's site data erases it, so export anything you
want to keep.

### How many retirement points make a good year?

At least 50 retirement points in your anniversary year, of which 15 come automatically from a full year of membership.
[SALTDOG's points tracker](saltdog/#/tools/points) does the arithmetic against your anniversary date rather than the
fiscal or calendar year, which is where hand calculations usually go wrong. Your NSIPS Electronic Service Record remains
the record of truth.

### Can I submit a FITREP or EVAL from WEBNAVFIT?

No. WEBNAVFIT is a drafting and printing aid. It produces a filled NAVPERS 1610/2 you can print, sign, or hand off, but
submission still happens with your unit. It exists because drafting in the official tool is painful and because a draft
should be simple.

### Does any of this work offline?

Yes. Once a page has loaded, everything in it runs locally, including SALTDOG's reference search — it is keyword
retrieval over the site's own cards, not a chatbot calling an API. That is deliberate: drill weekends happen in
buildings with no signal.

### Why "pollywog"?

In the line-crossing ceremony, a Sailor who has not yet crossed the equator is a pollywog; one who has is a shellback.
Us pollywogs are still figuring out where everything is.

<!-- /section -->

<!-- section id=official eyebrow="Go to the source" -->

## Official Navy systems

The systems of record. Most require a CAC. If something on either tool disagrees with one of these, the system is right.

- [MyNavy HR](https://www.mynavyhr.navy.mil/) — Policy, instructions, NAVADMINs, pay and personnel references.
- [MyNavy Portal](https://my.navy.mil/) — Single sign-on hub to career and administrative applications.
- [NSIPS](https://www.nsips.cloud.navy.mil/) — Electronic Service Record, training, pay and leave.
- [BUPERS Online](https://www.bol.navy.mil/) — Official and performance summary records, orders, boards.
- [milConnect](https://milconnect.dmdc.osd.mil/milconnect/) — DEERS, ID cards, dependents, SGLI.
- [MyNavy Career Center — 1-833-330-MNCC](tel:+18333306622) — The help desk to call when nothing online answers it.

<!-- /section -->

---

This file is also the source `index.html` is generated from — run `make build` after editing it (`make check` verifies
the two haven't drifted apart). See `tools/build-index.mjs` for the small, purpose-built markdown reader that maps the
sections above onto the page's markup, and
`tools/index.template.html` for the head, masthead, and footer that live outside this content.
