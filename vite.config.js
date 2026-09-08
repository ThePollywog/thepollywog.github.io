import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { build } from "./tools/build-index.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const README = join(ROOT, "README.md");

/**
 * Serves index.html freshly rendered from README.md on every request,
 * instead of the committed file on disk — so editing README.md is "live" in
 * dev without a separate `make build` step, the same way saltdog's own
 * go-page plugin re-renders on every request rather than reading a committed
 * copy. `make check` is still what enforces that the committed index.html
 * matches what README.md renders to; this plugin never writes that file.
 */
function readmePreview() {
  return {
    name: "pollywog-readme-preview",
    configureServer(server) {
      // README.md is a project-root file Vite already watches, but this
      // makes the dependency explicit rather than relying on that default.
      server.watcher.add(README);
      server.watcher.on("change", (file) => {
        if (file === README) server.ws.send({ type: "full-reload" });
      });

      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (url !== "/" && url !== "/index.html") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        try {
          res.end(build());
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(`README.md failed to render:\n\n${err.message}`);
        }
      });
    },
  };
}

/**
 * `npm run dev` here is a live-reloading static file server and nothing
 * else — matching the `make start` feel of ../saltdog and ../webnavfit,
 * which are real Vite/Vue apps. This site is neither: it is a
 * zero-framework, zero-JavaScript-on-the-page static site by design (see
 * index.html's own header comment and tools/check.mjs), so there is no
 * `build` or `preview` script here — Vite never bundles this folder, only
 * serves it.
 */
export default defineConfig({
  server: { port: 8629 },
  plugins: [readmePreview()],
});
