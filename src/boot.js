const root = document.getElementById('demo-root');
const lang = root?.dataset.lang === 'ru' ? 'ru' : 'en';
const t = (en, ru) => (lang === 'ru' ? ru : en);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
const ctx = { lang, t, esc, copyText, url: location.href.split('#')[0] };
const btn = document.getElementById('copy');
btn?.addEventListener('click', async () => {
  const old = btn.textContent;
  if (await copyText(ctx.url)) { btn.textContent = btn.dataset.ok; setTimeout(() => (btn.textContent = old), 1500); }
});
if (root?.dataset.demo) {
  import(`./demos/${root.dataset.demo}.js`)
    .then(m => { root.innerHTML = '<div class="dm"></div>'; m.default(root.firstChild, ctx); })
    .catch(e => { root.textContent = 'Demo failed to load: ' + e.message; });
}
