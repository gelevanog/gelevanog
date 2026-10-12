// Browser imitation of DocuChat's idea: retrieve, cite, and say "I don't know" when nothing matches well enough.
// It imitates only the keyword half of the hybrid search (BM25-like). No vectors, no RRF, no LLM: the answer is extractive.
// Each passage is a list of sentences [English, Russian gloss]. Search and quoting use the English text only.
const DOCS = [
  { file: 'handbook.md', sec: 'Vacation', s: [
    ['Every employee gets 24 vacation days per year.', 'Каждый сотрудник получает 24 дня отпуска в год.'],
    ['Vacation days must be requested at least 14 days in advance in the HR portal.', 'Дни отпуска нужно запрашивать в HR-портале не позднее чем за 14 дней.'],
    ['Unused days carry over until March 31 of the next year.', 'Неиспользованные дни переносятся до 31 марта следующего года.']] },
  { file: 'handbook.md', sec: 'Remote work', s: [
    ['Employees may work remotely up to three days per week.', 'Сотрудники могут работать удалённо до трёх дней в неделю.'],
    ['The core hours for meetings are 11:00 to 16:00 in the Berlin time zone.', 'Основные часы для встреч — с 11:00 до 16:00 по берлинскому времени.'],
    ['A stable internet connection is required.', 'Требуется стабильное интернет-соединение.']] },
  { file: 'handbook.md', sec: 'Expenses', s: [
    ['Expenses over 50 euros need manager approval before purchase.', 'Расходы свыше 50 евро нужно согласовать с руководителем до покупки.'],
    ['Receipts must be uploaded within 30 days.', 'Чеки нужно загрузить в течение 30 дней.'],
    ['Travel is booked through the company travel portal only.', 'Поездки бронируются только через корпоративный портал для командировок.']] },
  { file: 'security.md', sec: 'Passwords', s: [
    ['Passwords must be at least 14 characters and are stored in the company password manager.', 'Пароли должны содержать не менее 14 символов и храниться в корпоративном менеджере паролей.'],
    ['Two-factor authentication is mandatory for all accounts.', 'Двухфакторная аутентификация обязательна для всех учётных записей.']] },
  { file: 'security.md', sec: 'Laptops', s: [
    ['Company laptops use full-disk encryption.', 'На корпоративных ноутбуках включено полное шифрование диска.'],
    ['Lost or stolen devices must be reported to the security team within 24 hours.', 'О потерянных или украденных устройствах нужно сообщить службе безопасности в течение 24 часов.']] },
  { file: 'onboarding.md', sec: 'First week', s: [
    ['On the first day you get your laptop, accounts and a buddy.', 'В первый день вы получаете ноутбук, учётные записи и наставника (buddy).'],
    ['The first week includes security training and a meeting with your manager to set goals for the first 90 days.', 'В первую неделю — тренинг по безопасности и встреча с руководителем, чтобы поставить цели на первые 90 дней.']] },
];
const TH = 1.5; // stand-in for the model's own "I don't know" decision
const STOP = new Set('a an the is are of to in on for and or do does how what when can i my we you it be at by with from per'.split(' '));
const tok = s => s.toLowerCase().match(/[a-z0-9]+/g)?.filter(w => !STOP.has(w)).map(w => w.replace(/(ing|ed|s)$/, '')) || [];
const SENTS = DOCS.flatMap(d => d.s.map(p => new Set(tok(p[0]))));
const sidf = w => { const n = SENTS.filter(s => s.has(w)).length; return Math.log(1 + (SENTS.length - n + .5) / (n + .5)); };
function search(q) {
  const qt = tok(q); const N = DOCS.length; const docs = DOCS.map(d => tok(d.s.map(p => p[0]).join(' ') + ' ' + d.sec));
  const df = {}; docs.forEach(ts => new Set(ts).forEach(w => (df[w] = (df[w] || 0) + 1)));
  const avg = docs.reduce((a, d) => a + d.length, 0) / N;
  return DOCS.map((d, i) => { let s = 0; for (const w of new Set(qt)) { const f = docs[i].filter(x => x === w).length; if (!f) continue; const idf = Math.log(1 + (N - df[w] + .5) / (df[w] + .5)); s += idf * (f * 2.2) / (f + 1.2 * (.25 + .75 * docs[i].length / avg)); } return { d, s, i }; }).sort((a, b) => b.s - a.s);
}
export default function mount(el, { lang, t, esc }) {
  const ru = lang === 'ru';
  const num = x => (ru ? x.toFixed(2).replace('.', ',') : x.toFixed(2));
  const en = s => (ru ? `<span lang="en">${esc(s)}</span>` : esc(s));
  // [English query that is actually searched, Russian button label]. The last one is a deliberate failure.
  const P = [['How many vacation days do I get?', 'Сколько у меня дней отпуска?'], ['How many days can I work from home?', 'Сколько дней можно работать удалённо?'],
    ['What if my laptop is stolen?', 'Что делать, если ноутбук украли?'], ['What is the CEO salary?', 'Какая зарплата у CEO?'], ['How far ahead should I ask for a week off?', 'Насколько заранее нужно просить неделю отдыха?']];
  const CAP = {
    3: t('Not covered by the handbook, so refusing is the intended outcome here.', 'Этого нет в справочнике, поэтому отказ здесь — ожидаемый исход.'),
    4: t('A miss, on purpose. The Vacation section does answer this (“requested at least 14 days in advance”), but the question shares none of its words, and word matching cannot bridge that gap. DocuChat’s vector search is meant to help with paraphrases, yet in the project’s evaluation hybrid search ranked the right chunk first for only 4 of the 12 paraphrased questions with the offline embedder and 6 of 12 with a real embedding model.',
      'Промах — намеренный. Раздел Vacation отвечает на этот вопрос («запрашивать не позднее чем за 14 дней»), но в вопросе нет ни одного его слова, а поиск по словам такой разрыв не перекрывает. Векторный поиск DocuChat как раз должен помогать с перефразировками, но в оценке проекта гибридный поиск ставил нужный фрагмент на первое место лишь в 4 из 12 перефразированных вопросов с офлайн-эмбеддером и в 6 из 12 с настоящей моделью эмбеддингов.'),
  };
  const sm = 'font-size:13px;margin:10px 0 0';
  el.innerHTML = `<label for="q">${t('Question (the handbook and the search are English-only)', 'Вопрос (справочник и поиск — только на английском)')}</label>
  <div class="row"><input type="text" id="q" lang="en" autocomplete="off" placeholder="${esc(t('Ask about vacation, remote work, expenses, passwords…', 'Задайте вопрос по-английски: vacation, remote work, expenses, passwords…'))}"><button class="go" id="ask">${t('Ask', 'Спросить')}</button></div>
  <div class="row" role="group" aria-label="${t('Example questions', 'Примеры вопросов')}">${P.map((x, i) => `<button data-q="${i}" aria-pressed="false"${ru ? ` title="${esc(x[0])}"` : ''}>${esc(t(x[0], x[1]))}</button>`).join('')}</div>
  <div id="ans" role="status" aria-live="polite"></div>
  <label id="dl">${t('Documents', 'Документы')}</label><div class="out" id="docs" role="group" aria-labelledby="dl"></div>
  <p class="muted" style="${sm}"><b>${t('What this imitates.', 'Что здесь имитируется.')}</b> ${t(
    'Only the keyword half of DocuChat’s hybrid search (BM25-like scoring); there are no vectors and no Reciprocal Rank Fusion. The answer is extractive: it quotes the best-matching sentence from each source, like the project’s offline fake provider, while a real model writes fluent, synthesised answers. Quoting can be grounded and still miss the point: in the project’s offline run, “What is the minimum password length?” got a correctly cited sentence about not sharing passwords.',
    'Только поиск по словам — половина гибридного поиска DocuChat (оценка в духе BM25); векторов и Reciprocal Rank Fusion здесь нет. Ответ экстрактивный: демо цитирует лучшее по совпадению слов предложение из каждого источника, как офлайн-провайдер fake в проекте, а настоящая модель пишет связные синтезированные ответы. Цитата может быть привязана верно и всё равно не отвечать на вопрос: в офлайн-прогоне проекта на «What is the minimum password length?» нашлось корректно процитированное предложение о том, что нельзя делиться паролями.')}</p>
  <p class="muted" style="${sm}"><b>${t('Where “I don’t know” comes from.', 'Откуда берётся «Я не знаю».')}</b> ${t(
    `In DocuChat the model decides, following a grounded prompt (cite as [n] or say you don’t know). Here a fixed keyword-score threshold of ${num(TH)} stands in for that decision. The real behaviour is not measured: none of the 30 golden questions is unanswerable, and the free-model run never abstained (0 of 29 answers). The handbook above is invented for this demo; it is not the project’s sample data.`,
    `В DocuChat это решает модель, следуя промпту с требованием ссылаться на источники [n] или сказать, что ответа нет. Здесь эту роль играет фиксированный порог оценки по словам, ${num(TH)}. Настоящее поведение не измерялось: среди 30 эталонных вопросов нет ни одного без ответа, а прогон с бесплатной моделью ни разу не отказался отвечать (0 из 29 ответов). Справочник выше придуман для демо и не является тестовыми данными проекта.`)}</p>`;
  const $ = s => el.querySelector(s);
  const renderDocs = cited => {
    $('#docs').innerHTML = DOCS.map((d, i) => { const n = cited.indexOf(i) + 1;
      return `<div id="d${i}" tabindex="-1" style="padding:4px 6px;margin:2px 0;border-radius:6px${n ? ';background:color-mix(in srgb,var(--accent2) 14%,transparent)' : ''}"><b>${d.file}</b> · ${d.sec}${n ? ` <span class="tag green">[${n}]</span>` : ''}<br><span class="muted">${en(d.s.map(p => p[0]).join(' '))}${ru ? `<br>↳ ${esc(d.s.map(p => p[1]).join(' '))}` : ''}</span></div>`; }).join('');
  };
  const show = (html, cited = [], cap = '') => {
    $('#ans').innerHTML = html + (cap ? `<p class="muted" style="${sm}">${cap}</p>` : '');
    renderDocs(cited);
    $('#ans').querySelectorAll('a[data-d]').forEach(a => (a.onclick = e => {
      e.preventDefault(); const d = $('#d' + a.dataset.d);
      d.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); d.focus({ preventScroll: true });
    }));
  };
  const ask = (q, pi = -1) => {
    q = q.trim(); if (!q) return $('#q').focus(); $('#q').value = q;
    el.querySelectorAll('[data-q]').forEach(b => { const on = +b.dataset.q === pi; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
    const cap = CAP[pi] || '', qt = new Set(tok(q));
    if (!qt.size) return show(`<div class="out">${t('No searchable English words in the question. The handbook and the keyword search are English-only, so type the question in English or pick an example.', 'В вопросе нет английских слов для поиска. Справочник и поиск по словам — только на английском: введите вопрос по-английски или выберите пример.')}</div>`);
    const r = search(q), top = r[0];
    const picks = r.filter(x => x.s >= TH && x.s >= top.s * .6).slice(0, 2).map(u => {
      const best = u.d.s.map(p => { const ts = new Set(tok(p[0])); return { p, c: [...qt].filter(w => ts.has(w)).reduce((a, w) => a + sidf(w), 0) }; }).sort((a, b) => b.c - a.c)[0];
      return { u, p: best.p, c: best.c };
    }).filter(x => x.c > 0);
    if (!picks.length) {
      const why = top.s === 0 ? t('No passage shares a word with the question', 'Ни один фрагмент не содержит слов из вопроса')
        : top.s < TH ? `${t('Best candidate', 'Лучший кандидат')}: ${top.d.file} · ${top.d.sec}` : t('The matching words appear only in section titles', 'Совпавшие слова есть только в заголовках разделов');
      return show(`<div class="out"><b>${t("I don't know.", 'Я не знаю.')}</b> ${t('No passage matched well enough, so I will not guess.', 'Ни один фрагмент не подошёл достаточно хорошо, поэтому я не буду гадать.')}<br><span class="muted">${why} — ${t('keyword score', 'оценка по словам')} ${num(top.s)} ${top.s < TH ? '&lt;' : '≥'} ${num(TH)} (${t('threshold', 'порог')})</span></div>`, [], cap);
    }
    const body = picks.map((x, n) => `<div style="margin:0 0 6px">${en(x.p[0])} <a href="#d${x.u.i}" data-d="${x.u.i}">[${n + 1}]</a>${ru ? `<br><span class="muted">↳ ${esc(x.p[1])}</span>` : ''}</div>`).join('');
    const src = picks.map((x, n) => `[${n + 1}] ${x.u.d.file} · ${x.u.d.sec} — ${t('keyword score', 'оценка по словам')} ${num(x.u.s)}`).join('<br>');
    show(`<div class="out">${body}</div><div class="muted" style="font-size:13px;margin-top:6px">${src}</div>`, picks.map(x => x.u.i), cap);
  };
  $('#ask').onclick = () => ask($('#q').value); $('#q').onkeydown = e => e.key === 'Enter' && !e.isComposing && ask($('#q').value);
  el.querySelectorAll('[data-q]').forEach(b => (b.onclick = () => ask(P[b.dataset.q][0], +b.dataset.q)));
}
