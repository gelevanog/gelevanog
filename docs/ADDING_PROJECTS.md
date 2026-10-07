# Portfolio site (GitHub Pages)

Static, bilingual (EN at `/`, RU at `/ru/`), no framework, no API keys. Live demos run entirely in the browser.

```
node build.mjs                 # -> dist
npx serve dist                # or: python3 -m http.server -d dist
```

Deploys automatically from `main` via `.github/workflows/pages.yml`
(repo Settings → Pages → Source: **GitHub Actions**).

## Add a new AI project

1. `data/projects/<id>.json` — copy an existing one. Fields: `order`, `name`, `repo`, `stack`, `stats`, `en`/`ru` texts, `demo`.
2. Card illustration: `assets/art/<id>.webp` (1600×1200, no text in the image). Optional live demo: `src/demos/<demo>.js` exporting `default function mount(el, { lang, t, esc, copyText, url })`.
3. Share image: `assets/og/<id>.png` (1200×627). Each project page gets its own link preview.
4. Build. The home grid, sitemap and "next demo" links update by themselves.

Rules: only publish numbers that come from the project's own README/evaluation, and mark demos as browser re-implementations.
