// Static site generator: node build.mjs  ->  dist/
// Adding a project = add data/projects/<id>.json (+ optional src/demos/<demo>.js, assets/art/<id>.webp, assets/og/<id>.png).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8'));
const SITE_URL = (process.env.SITE_URL || site.url).replace(/\/$/, '');
const projects = fs.readdirSync(path.join(root, 'data/projects'))
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(root, 'data/projects', f), 'utf8')))
  .sort((a, b) => a.order - b.order);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pagePath = (lang, sub) => (lang === 'ru' ? 'ru/' : '') + sub;
const up = (p) => '../'.repeat((p.match(/\//g) || []).length) || './';
const prefix = (lang, r) => r + (lang === 'ru' ? 'ru/' : '');
const art = (p, r) => `${r}assets/art/${p.id}.webp`;

function layout({ lang, sub, title, desc, og, body, demo }) {
  const t = site[lang];
  const here = pagePath(lang, sub);
  const other = pagePath(lang === 'en' ? 'ru' : 'en', sub);
  const r = up(here);
  const url = `${SITE_URL}/${here}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#05070f">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${SITE_URL}/${pagePath('en', sub)}">
<link rel="alternate" hreflang="ru" href="${SITE_URL}/${pagePath('ru', sub)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}/${og}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="627">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE_URL}/${og}">
<link rel="icon" href="${r}assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&family=Onest:wght@500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${r}assets/style.css">
</head>
<body data-root="${r}">
<div class="glow-cursor" aria-hidden="true"></div>
<header class="top"><div class="wrap bar">
  <a class="brand" href="${prefix(lang, r)}"><span class="dot"></span>${esc(site.name)}</a>
  <nav><a href="${prefix(lang, r)}#demos">${esc(t.demos_h)}</a><a href="${prefix(lang, r)}#contact">${esc(t.contact_h)}</a></nav>
</div></header>
${body}
<footer><div class="wrap">${esc(t.footer)} · <a href="${site.links.github}">GitHub</a> · <a href="${site.links.linkedin}">LinkedIn</a> · <a href="${site.links.upwork}">Upwork</a></div></footer>
<script src="${r}assets/ui.js" defer></script>
${demo ? `<script type="module" src="${r}assets/boot.js"></script>` : ''}
</body></html>`;
}

function card(lang, p, r, i) {
  const t = site[lang], c = p[lang], s = p.stats[0];
  return `<a class="card reveal ${i === 0 ? 'big' : ''}" style="--d:${i * 70}ms" href="${prefix(lang, r)}p/${p.id}/">
  <div class="art"><img src="${art(p, r)}" alt="" loading="${i < 3 ? 'eager' : 'lazy'}" width="2000" height="1250"></div>
  <div class="cb">
    <div class="pill"><b>${esc(lang === 'ru' && s[3] ? s[3] : s[0])}</b><i>${esc(lang === 'ru' ? s[2] : s[1])}</i></div>
    <div class="cn">${esc(p.name)}</div><div class="ct">${esc(c.tag)}</div>
    <div class="cg">${esc(t.try)} <span>→</span></div>
  </div></a>`;
}

function homePage(lang) {
  const t = site[lang];
  const r = up(pagePath(lang, ''));
  const stack = [...site.stack, ...projects.flatMap(p => p.stack)];
  const uniq = [...new Set(stack)];
  const body = `<main>
<section class="hero"><div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>
  <img class="hero-art" src="${r}assets/art/hero.webp" alt="" width="2752" height="1536">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <div class="eyebrow"><span class="ping"></span>${esc(t.hero_tag)}</div>
      <h1>${t.h1}</h1>
      <p class="lead">${esc(t.lead)}</p>
      <div class="cta"><a class="btn primary" href="#demos">${esc(t.cta_demos)} ↓</a><a class="btn" href="#contact">${esc(t.cta_hire)}</a></div>
    </div>
    <div class="term" aria-label="${esc(t.hero_note)}">
      <div class="term-bar"><i></i><i></i><i></i><span>${esc(t.hero_note)}</span></div>
      <pre class="term-body" id="term" data-lines="${esc(JSON.stringify(t.terminal))}"></pre>
    </div>
  </div>
</section>
<section class="counters"><div class="wrap cgrid">${t.counters.map(([n, l]) => `<div class="cnt reveal"><b data-count="${n}">${n}</b><span>${esc(l)}</span></div>`).join('')}</div></section>
<section id="demos"><div class="wrap">
  <h2 class="reveal">${esc(t.demos_h)}</h2><p class="sub reveal">${esc(t.demos_sub)}</p>
  <div class="bento">${projects.map((p, i) => card(lang, p, r, i)).join('')}
  <a class="card soon reveal" href="${site.links.linkedin}"><div class="cb"><div class="cn">${esc(t.soon_h)}</div><div class="ct">${esc(t.soon_p)}</div><div class="cg">LinkedIn <span>→</span></div></div></a></div>
</div></section>
<section class="marq" aria-label="${esc(t.marquee_h)}"><div class="track">${[0, 1].map(() => uniq.map(s => `<span>${esc(s)}</span>`).join('')).join('')}</div></section>
<section><div class="wrap"><h2 class="reveal">${esc(t.principles_h)}</h2>
  <div class="cols">${t.principles.map(([h, p], i) => `<div class="col reveal" style="--d:${i * 90}ms"><div class="num">0${i + 1}</div><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('')}</div></div></section>
<section><div class="wrap two">
  <div class="reveal"><h2>${esc(t.about_h)}</h2><p>${esc(t.about_p)}</p></div>
  <div class="reveal"><h2>${esc(t.stack_h)}</h2><div class="chips">${site.stack.map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div></div>
</div></section>
<section id="contact"><div class="wrap"><div class="final reveal"><h2>${esc(t.cta_final)}</h2><p>${esc(t.contact_p)}</p>
  <div class="cta"><a class="btn primary" href="mailto:${site.links.email}">${site.links.email}</a>
  <a class="btn" href="${site.links.linkedin}">LinkedIn</a><a class="btn" href="${site.links.upwork}">Upwork</a><a class="btn" href="${site.links.github}">GitHub</a></div></div></div></section>
</main>`;
  return layout({ lang, sub: '', title: t.title, desc: t.desc, og: lang === 'ru' ? 'assets/og/ru/home.png' : 'assets/og/home.png', body });
}

function projectPage(lang, p, idx) {
  const t = site[lang], c = p[lang];
  const sub = `p/${p.id}/`;
  const r = up(pagePath(lang, sub));
  const next = projects[(idx + 1) % projects.length];
  const body = `<main>
<section class="phero"><img class="hero-art" src="${art(p, r)}" alt="" width="1600" height="1200"><div class="aurora" aria-hidden="true"><i></i><i></i></div>
<div class="wrap">
<a class="back" href="${prefix(lang, r)}#demos">${esc(t.back)}</a>
<div class="eyebrow"><span class="ping"></span>${esc(p.name)}</div>
<h1 class="ph">${esc(c.title)}</h1>
<p class="lead">${esc(c.tag)}</p>
<div class="stats">${p.stats.map(s => `<div class="stat reveal"><div class="sv">${esc(lang === 'ru' && s[3] ? s[3] : s[0])}</div><div class="sl">${esc(lang === 'ru' ? s[2] : s[1])}</div></div>`).join('')}</div>
</div></section>
<div class="wrap">
<section class="demo reveal" id="demo"><div class="demo-h"><span class="live"><i></i>${esc(p.demo === 'distillery' ? t.badge_real : t.badge_demo)}</span><h2>${esc(c.demo_title)}</h2></div><p class="sub">${esc(c.demo_intro)}</p>
  <div id="demo-root" data-demo="${p.demo}" data-lang="${lang}"><noscript>JavaScript is required for the live demo.</noscript></div>
  <p class="note">${esc(t.demo_note)}</p></section>
<div class="two">
  <div class="reveal"><h2>${esc(t.what_h)}</h2><p>${esc(c.problem)}</p></div>
  <div class="reveal"><h2>${esc(t.how_h)}</h2><ol>${c.how.map(h => `<li>${esc(h)}</li>`).join('')}</ol></div>
</div>
<section class="verdict reveal"><h2>${esc(t.verdict_h)}</h2><p>${esc(c.verdict)}</p></section>
<div class="cta"><a class="btn primary" href="${p.repo}">${esc(t.repo_btn)} ↗</a>
  <button class="btn" id="copy" data-ok="${esc(t.copied)}">${esc(t.copy)}</button>
  <a class="btn" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${SITE_URL}/${pagePath(lang, sub)}`)}">LinkedIn</a></div>
<div class="chips" style="margin-top:18px">${p.stack.map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div>
<a class="nextcard" href="${prefix(lang, r)}p/${next.id}/"><img src="${art(next, r)}" alt="" loading="lazy"><span>${esc(t.next_h)}</span><b>${esc(next.name)} →</b></a>
</div></main>`;
  return layout({ lang, sub, title: `${p.name} — ${c.title}`, desc: c.tag, og: lang === 'ru' ? p.og.replace('assets/og/', 'assets/og/ru/') : p.og, body, demo: true });
}

fs.rmSync(dist, { recursive: true, force: true });
const write = (rel, data) => { const f = path.join(dist, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const copyDir = (from, to) => fs.cpSync(path.join(root, from), path.join(dist, to), { recursive: true });

for (const lang of ['en', 'ru']) {
  write(pagePath(lang, '') + 'index.html', homePage(lang));
  projects.forEach((p, i) => write(pagePath(lang, `p/${p.id}/`) + 'index.html', projectPage(lang, p, i)));
}
copyDir('src', 'assets');
copyDir('assets/og', 'assets/og');
copyDir('assets/art', 'assets/art');
fs.copyFileSync(path.join(root, 'assets/favicon.svg'), path.join(dist, 'assets/favicon.svg'));
const urls = ['', ...projects.map(p => `p/${p.id}/`)].flatMap(s => ['en', 'ru'].map(l => `${SITE_URL}/${pagePath(l, s)}`));
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
write('.nojekyll', '');
console.log(`built ${urls.length} pages -> ${dist}`);
