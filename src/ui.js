// Page polish: scroll reveal, count-up numbers, typing terminal, cursor glow. Works without JS (content is plain HTML).
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
document.documentElement.classList.add('js');

// reveal on scroll
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
$$('.reveal').forEach(el => (reduce ? el.classList.add('in') : io.observe(el)));

// count-up
const co = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return; co.unobserve(e.target);
  const el = e.target, to = +el.dataset.count, t0 = performance.now(), dur = 1400;
  const tick = t => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}), { threshold: 0.6 });
if (!reduce) $$('[data-count]').forEach(el => { el.textContent = '0'; co.observe(el); });

// typing terminal
const term = document.getElementById('term');
if (term) {
  const lines = JSON.parse(term.dataset.lines);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const render = (done, cur) => { term.innerHTML = done.map(([c, o]) => `<span class="p">$</span> ${c}\n<span class="o">${o}</span>\n`).join('\n') + (cur !== null ? `\n<span class="p">$</span> ${cur}<span class="caret"></span>` : ''); };
  if (reduce) render(lines.slice(0, innerWidth < 900 ? 2 : 3), null);
  else (async () => {
    let done = [];
    for (let i = 0; ; i = (i + 1) % lines.length) {
      const [cmd, out] = lines[i];
      for (let k = 1; k <= cmd.length; k++) { render(done, cmd.slice(0, k)); await sleep(24); }
      await sleep(350);
      done = [...done, [cmd, out]].slice(innerWidth < 900 ? -2 : -3); render(done, ''); await sleep(2600);
    }
  })();
}

// cursor glow + card spotlight
const g = document.querySelector('.glow-cursor');
if (g && !reduce && matchMedia('(pointer:fine)').matches) {
  addEventListener('pointermove', e => { g.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; g.style.opacity = 1; });
  $$('.card, .stat').forEach(c => c.addEventListener('pointermove', e => { const b = c.getBoundingClientRect(); c.style.setProperty('--mx', e.clientX - b.left + 'px'); c.style.setProperty('--my', e.clientY - b.top + 'px'); }));
}
