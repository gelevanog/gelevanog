// Browser version of DocuChat's idea: retrieve, cite, and say "I don't know" when nothing relevant is found.
const DOCS = [
  { file: 'handbook.md', page: 1, sec: 'Vacation', text: 'Every employee gets 24 vacation days per year. Vacation days must be requested at least 14 days in advance in the HR portal. Unused days carry over until March 31 of the next year.' },
  { file: 'handbook.md', page: 2, sec: 'Remote work', text: 'Employees may work remotely up to three days per week. The core hours for meetings are 11:00 to 16:00 in the Berlin time zone. A stable internet connection is required.' },
  { file: 'handbook.md', page: 3, sec: 'Expenses', text: 'Expenses over 50 euros need manager approval before purchase. Receipts must be uploaded within 30 days. Travel is booked through the company travel portal only.' },
  { file: 'security.md', page: 1, sec: 'Passwords', text: 'Passwords must be at least 14 characters and are stored in the company password manager. Two-factor authentication is mandatory for all accounts.' },
  { file: 'security.md', page: 2, sec: 'Laptops', text: 'Company laptops use full-disk encryption. Lost or stolen devices must be reported to the security team within 24 hours.' },
  { file: 'onboarding.md', page: 1, sec: 'First week', text: 'On the first day you get your laptop, accounts and a buddy. The first week includes security training and a meeting with your manager to set goals for the first 90 days.' },
];
const STOP = new Set('a an the is are of to in on for and or do does how what when can i my we you it be at by with from per'.split(' '));
const tok = s => s.toLowerCase().match(/[a-z0-9]+/g)?.filter(w => !STOP.has(w)).map(w => w.replace(/(ing|ed|s)$/, '')) || [];
function search(q) {
  const qt = tok(q); const N = DOCS.length; const docs = DOCS.map(d => tok(d.text + ' ' + d.sec));
  const df = {}; docs.forEach(ts => new Set(ts).forEach(w => (df[w] = (df[w] || 0) + 1)));
  const avg = docs.reduce((a, d) => a + d.length, 0) / N;
  return DOCS.map((d, i) => { let s = 0; for (const w of new Set(qt)) { const f = docs[i].filter(x => x === w).length; if (!f) continue; const idf = Math.log(1 + (N - df[w] + .5) / (df[w] + .5)); s += idf * (f * 2.2) / (f + 1.2 * (.25 + .75 * docs[i].length / avg)); } return { d, s, i }; }).sort((a, b) => b.s - a.s);
}
export default function mount(el, { t, esc }) {
  const Q = [t('How many vacation days do I get?', 'Сколько у меня дней отпуска?'), t('How many days can I work from home?', 'Сколько дней можно работать удалённо?'), t('What if my laptop is stolen?', 'Что делать, если ноутбук украли?'), t('What is the CEO salary?', 'Какая зарплата у CEO?')];
  el.innerHTML = `<label>${t('Question (the handbook is in English)', 'Вопрос (справочник на английском)')}</label>
  <div class="row"><input type="text" id="q" aria-label="Question" placeholder="${t('Ask about vacation, remote work, expenses, passwords…', 'Спросите про отпуск, удалёнку, расходы, пароли…')}"><button class="go" id="ask">${t('Ask', 'Спросить')}</button></div>
  <div class="row">${Q.map((x, i) => `<button data-q="${i}">${esc(x)}</button>`).join('')}</div>
  <div id="ans" role="status" aria-live="polite"></div>
  <label>${t('Documents', 'Документы')}</label><div class="out" id="docs"></div>`;
  const $ = s => el.querySelector(s);
  const renderDocs = hl => { $('#docs').innerHTML = DOCS.map((d, i) => `<div id="d${i}" style="${hl.includes(i) ? 'background:rgba(56,225,196,.14);border-radius:6px;padding:4px 6px;margin:2px 0' : 'padding:4px 6px'}"><b>${d.file}</b> · p.${d.page} · ${d.sec}<br><span class="muted">${esc(d.text)}</span></div>`).join(''); };
  renderDocs([]);
  const ask = qs => {
    const q = qs || $('#q').value.trim(); if (!q) return; $('#q').value = q;
    const r = search(q); const top = r[0];
    if (top.s < 1.5) { $('#ans').innerHTML = `<div class="out"><b>${t("I don't know.", 'Я не знаю.')}</b> ${t('Nothing in the uploaded documents answers this question, so I will not guess.', 'В загруженных документах нет ответа на этот вопрос, поэтому я не буду гадать.')}<br><span class="muted">${t('best match score', 'лучшая оценка')}: ${top.s.toFixed(2)} &lt; 1.50</span></div>`; renderDocs([]); return; }
    const used = r.filter(x => x.s >= top.s * .6 && x.s >= 1.5).slice(0, 2);
    const qt = new Set(tok(q));
    const sents = used.flatMap((u, n) => u.d.text.split(/(?<=\.)\s+/).map(s => ({ s, n: n + 1, sc: tok(s).filter(w => qt.has(w)).length })));
    const best = sents.filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 2);
    $('#ans').innerHTML = `<div class="out">${best.map(x => `${esc(x.s)} <a href="#d${used[x.n - 1].i}" data-d="${used[x.n - 1].i}">[${x.n}]</a>`).join(' ')}</div>
    <div class="muted" style="font-size:13px;margin-top:6px">${used.map((u, n) => `[${n + 1}] ${u.d.file} · p.${u.d.page} · ${u.d.sec} — score ${u.s.toFixed(2)}`).join('<br>')}</div>`;
    renderDocs(used.map(u => u.i));
    $('#ans').querySelectorAll('a[data-d]').forEach(a => (a.onclick = e => { e.preventDefault(); el.querySelector('#d' + a.dataset.d).scrollIntoView({ block: 'center', behavior: 'smooth' }); }));
  };
  $('#ask').onclick = () => ask(); $('#q').onkeydown = e => e.key === 'Enter' && ask();
  el.querySelectorAll('[data-q]').forEach(b => (b.onclick = () => ask(Q[b.dataset.q])));
}
