// Browser version of Scout's claim checker: every claim in a draft must trace to a saved quote.
// Only the deterministic layer is re-implemented (numbers, dates, names, old-signal-called-recent). The model verifier is not in the demo.
// Larkspur Freight and Wayline's offer are fictional; the "today" date is the README's default SCOUT_TODAY.
// Simplifications (also stated on the page): the README says "every number, date and name must exist in the research or the offer; numbers
// must be in the cited quotes". Treating years and month names as "dates" (anywhere in the research) and other numbers as "numbers"
// (in the cited quotes) is this demo's split, not the project's.
const EV = {
  F1: { k: ['Hiring signal', 'Сигнал: найм'], q: 'We are hiring a Fleet Safety Lead to coach our drivers.', pg: '/careers', d: '5 September 2026', dr: '5 сентября 2026', a: ['26 days old', '26 дней назад'] },
  F2: { k: ['Fleet size', 'Размер парка'], q: 'Larkspur Freight runs 85 trucks out of two depots.', pg: '/about', d: '' },
  F3: { k: ['Hiring signal', 'Сигнал: найм'], q: 'Now hiring: Fleet Manager.', pg: '/careers', d: '1 February 2026', dr: '1 февраля 2026', a: ['8 months old', '8 месяцев назад'], old: 1 },
  F4: { k: ['Funding', 'Финансирование'], q: 'Larkspur closed a $12 million round.', pg: '/news', d: 'March 2023', dr: 'март 2023', a: ['over 3 years old', 'больше 3 лет назад'], old: 1 },
  O1: { k: ['Seller offer', 'Оффер продавца'], q: 'Wayline: driver-safety coaching and fuel reports for fleets of 40 to 2,000 vehicles, from its first week.', pg: 'approved offer', pgr: 'утверждённый оффер', d: '' },
};
const IDS = Object.keys(EV), txt = i => EV[i].q + ' ' + EV[i].d;
const MONTH = /^(january|february|march|april|may|june|july|august|september|october|november|december)$/i;
const RECENT = /\b(recent(ly)?|new(ly)?|currently|just|now|latest|today|right now|last (week|month)|this (week|month))\b/i;
// Capitalised first words that are ordinary words, not names.
const STARTERS = new Set('i with the a an in on at as if is are do does how what why when this that these those just since given your you we our it hi hello hey dear thanks thank great congrats congratulations saw noticed also and but so now for from by to my because while after before looks looking hiring fuel'.split(' '));
// A number is digits with optional thousands groups and decimals, so "In 2026, ..." does not swallow the comma.
const NUM = /\d+(?:,\d{3})*(?:\.\d+)?/g;
const nums = s => (s.match(NUM) || []).map(n => n.replace(/,/g, ''));
const words = s => s.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/gu) || [];
const capWords = s => s.match(/\p{Lu}\p{L}*(?:-\p{L}+)*/gu) || [];
const P = [ // label EN, label RU, sentence, evidence ids
  ['Grounded', 'Обоснованное', 'I saw Larkspur Freight posted a Fleet Safety Lead role on 5 September.', ['F1']],
  ['Stale called recent', 'Старое как свежее', "I saw you're currently hiring a Fleet Manager.", ['F3']],
  ['Wrong number', 'Неверное число', 'With 310 trucks, fuel costs must hurt.', ['F2']],
  ['Invented funding', 'Выдуманный раунд', 'Congrats on your Series B.', []],
  ['Wrong day', 'Неверный день', 'I saw you posted that role on 12 September.', ['F1']],
  ['Exaggeration', 'Преувеличение', 'Congrats on doubling your fleet.', ['F2']],
  ['Overstated offer', 'Преувеличенный оффер', 'Wayline makes coaching visible right away.', ['O1']],
];

// The deterministic layer: every number, date and name must exist in the research or the offer; numbers must be in the cited quotes; an old signal may not be called recent.
function check(text, cites) {
  const toks = [], re = new RegExp(NUM.source + '|\\p{Lu}\\p{L}*(?:-\\p{L}+)*', 'gu');
  let m;
  while ((m = re.exec(text))) {
    const w = m[0], num = /^\d/.test(w), lw = w.toLowerCase(), n = w.replace(/,/g, ''), before = text.slice(0, m.index);
    const first = /^[\s"“'(]*$/.test(before) || /[.!?]["”')]*\s+["“'(]*$/.test(before);
    // A capitalised word that opens a sentence may be an ordinary word ("Hiring", "Fuel"). The demo checks it only as part of a longer
    // capitalised name, as a month, or when the research also writes it with a capital; a lone unknown one is skipped.
    const lone = !/^\s+(?!I\b)\p{Lu}/u.test(text.slice(m.index + w.length)) && !(MONTH.test(w) && lw !== 'may') && !IDS.some(i => capWords(txt(i)).includes(w));
    if (!num && (w === 'I' || (first && (!/^[A-Z]/.test(w) || STARTERS.has(lw) || lone)))) continue;
    const kind = num ? (/^(19|20)\d\d$/.test(w) ? 'date' : 'number') : MONTH.test(w) ? 'date' : 'name';
    const has = i => (num ? nums(txt(i)).includes(n) : words(txt(i)).includes(lw));
    const where = cites.find(has) || IDS.find(has);
    toks.push({ w, i: m.index, kind, where, ok: kind === 'number' ? cites.some(has) : !!where });
  }
  const rec = RECENT.exec(text), old = rec ? cites.filter(i => EV[i].old) : [];
  return { toks, rec: rec && rec[0], old, fails: toks.filter(k => !k.ok).length + old.length + (cites.length ? 0 : 1) };
}

export default function mount(el, { t, esc, copyText, url }) {
  const $ = s => el.querySelector(s);
  const tag = (c, s) => `<span class="tag ${c}">${s}</span>`;
  const step = (c, h, b) => `<div class="step ${c}"><b>${h}</b> ${b}</div>`;
  const KIND = { number: t('number', 'число'), date: t('date', 'дата'), name: t('name', 'имя') };
  const meta = i => { const e = EV[i], pg = e.pgr ? t(e.pg, e.pgr) : e.pg, d = e.d ? t(e.d, e.dr) : ''; return `${pg}${d ? ' · ' + d : ''}`; };
  el.innerHTML = `<div class="cols2"><div>
    <p class="muted" style="margin:0 0 4px;font-size:14px">${t('Pick a ready-made claim, or write your own below.', 'Выберите готовое утверждение или напишите своё ниже.')}</p>
    <div class="row" id="chips" style="margin-top:0">${P.map((p, i) => `<button data-i="${i}">${esc(t(p[0], p[1]))}</button>`).join('')}</div>
    <label for="s">${t('One sentence of the email (the fictional company’s pages are in English)', 'Одно предложение письма (страницы вымышленной компании на английском)')}</label>
    <input type="text" id="s" autocomplete="off" spellcheck="false">
    <div class="row"><span class="muted" style="font-size:13px">${t('Cites:', 'Ссылается на:')}</span>${IDS.map(i => `<label class="switch" style="margin:0"><input type="checkbox" data-e="${i}" aria-label="${t('Cites', 'Ссылается на')} ${i}"> ${i}</label>`).join('')}
      <button class="go" id="go">${t('Check the claim', 'Проверить утверждение')}</button></div>
    <div id="res" role="status" aria-live="polite"></div>
    <p class="muted" style="font-size:13px">${t('Simplified: the demo checks numbers, dates, capitalised names and the old-signal rule only. Its name check is cruder than the project’s: a lone capitalised word that opens a sentence is skipped, because the demo cannot tell a name from an ordinary word there. Years and month names only have to exist somewhere in the research or the offer, while other numbers must be in the quotes the claim cites; that split is a simplification of the project’s rule.', 'Упрощённо: демо проверяет только числа, даты, имена с заглавной буквы и правило про старые сигналы. Проверка имён грубее, чем в проекте: одиночное слово с заглавной буквы в начале предложения пропускается, потому что демо не отличает там имя от обычного слова. Годы и названия месяцев должны лишь встречаться где-то в исследовании или оффере, а остальные числа — в цитатах, на которые ссылается утверждение; это упрощение правила проекта.')}</p>
  </div><div>
    <label>${t('Saved research: Larkspur Freight (fictional)', 'Сохранённое исследование: Larkspur Freight (вымышленная компания)')}</label>
    <div class="out" id="ev">${IDS.map(i => { const e = EV[i]; return `<div style="padding:4px 0"><b>${i}</b> ${i[0] === 'O' ? tag('', t('offer', 'оффер')) : e.old ? tag('amber', t('stale', 'устарел')) : tag('green', t('current', 'свежий'))} <span class="muted">${t(...e.k)}${e.a ? ' · ' + t(...e.a) : ''}</span><br>“${esc(e.q)}” <span class="muted">${esc(meta(i))}</span></div>`; }).join('')}</div>
    <p class="muted" style="font-size:13px">${t('“Today” in the demo is 2026-10-01. Freshness is preset here; Scout computes it from the date on the page. Stale signals score zero points.', '«Сегодня» в демо — 2026-10-01. Свежесть здесь задана заранее; Scout считает её по дате на странице. Устаревшие сигналы получают ноль баллов.')}</p>
  </div></div>`;

  let cur = '', cur1 = [];
  function run() {
    const text = $('#s').value.trim(), R = $('#res');
    if (!text) { R.innerHTML = ''; return; }
    const cites = IDS.filter(i => $(`[data-e=${i}]`).checked), r = check(text, cites), bad = r.fails > 0;
    cur = text; cur1 = cites;
    let hl = '', at = 0;
    for (const k of r.toks) { hl += esc(text.slice(at, k.i)) + tag(k.ok ? 'green' : 'red', esc(k.w)); at = k.i + k.w.length; }
    hl += esc(text.slice(at));
    const lines = r.toks.map(k => `<div>${tag(k.ok ? 'green' : 'red', KIND[k.kind])} <b>${esc(k.w)}</b> ${k.ok ? '→ ' + k.where : k.where ? t(`is in ${k.where}, but not in the quotes this claim cites`, `есть в ${k.where}, но не в цитатах, на которые ссылается утверждение`) : t('is not in the research or the offer', 'нет ни в исследовании, ни в оффере')}</div>`);
    if (r.old.length) lines.push(`<div>${tag('red', t('stale', 'устарело'))} ${r.old.join(', ')}: ${t(`an old signal may not be called recent (“${esc(r.rec)}”)`, `старый сигнал нельзя называть свежим («${esc(r.rec)}»)`)}</div>`);
    if (!lines.length) lines.push(`<span class="muted">${t('Nothing mechanical to check: no numbers, dates or names.', 'Проверять механически нечего: нет чисел, дат и имён.')}</span>`);
    const skip = `<span class="muted">${t('not reached', 'не достигнуто')}</span>`;
    R.innerHTML = `<div class="out">${hl}</div>`
      + (cites.length ? step('on', t('1 · Evidence declared', '1 · Заявленные доказательства'), cites.map(i => `<br><b>${i}</b> “${esc(EV[i].q)}” <span class="muted">${esc(meta(i))}</span>`).join(''))
        : step('stop', t('1 · Evidence declared', '1 · Заявленные доказательства'), `${tag('red', t('none', 'нет'))} ${t('A claim must cite known evidence: tick at least one box.', 'Утверждение должно ссылаться на известные доказательства: отметьте хотя бы одну.')}`))
      + step(r.toks.some(k => !k.ok) || r.old.length ? 'stop' : 'on', t('2 · Deterministic rules', '2 · Детерминированные правила'), lines.join(''))
      + step(bad ? '' : 'stop', t('3 · Model verifier', '3 · Модель-верификатор'), bad ? skip : t('Not in this demo: there is no model here. In Scout a model reads each claim against its evidence and lists statements the draft never declared. This is the layer for exaggeration and invented opinions, which no rule can read.', 'Нет в этом демо: здесь нет модели. В Scout модель сверяет каждое утверждение с его доказательствами и перечисляет высказывания, которые черновик не объявил. Этот слой ловит преувеличения и выдуманные мнения, которые правилами не прочитать.'))
      + step(bad ? '' : 'stop', t('4 · Human approval', '4 · Одобрение человеком'), bad ? skip : t('The draft waits for a person to approve, edit or reject it. Nothing is sent, and even after approval mail goes only to a capture server (Mailpit).', 'Черновик ждёт, пока человек одобрит, исправит или отклонит его. Ничего не отправлено, а после одобрения письмо уходит только на capture-сервер (Mailpit).'))
      + (bad ? `<p class="bad" style="margin:12px 0 4px">✗ ${t('Blocked by the rules. It would not reach the approval queue like this.', 'Заблокировано правилами. В таком виде в очередь одобрения оно бы не попало.')}</p><p class="muted" style="margin:0;font-size:14px">${t('In Scout the variant goes back to the model with these issues as feedback (up to 2 rewrites). As a last resort the offending sentences are removed.', 'В Scout вариант возвращается модели с этими замечаниями (до 2 переписываний). В крайнем случае проблемные предложения удаляются.')}</p>`
        : `<p class="warn" style="margin:12px 0 4px">! ${t('Passed the rules. That is not the same as true.', 'Прошло правила. Это ещё не значит, что это правда.')}</p><p class="muted" style="margin:0 0 6px;font-size:14px">${t('You are the verifier now: read the quote above. Does it really say what your sentence says?', 'Теперь верификатор — вы: прочитайте цитату выше. Она действительно говорит то, что сказано в вашем предложении?')}</p>
        <div class="row"><button data-v="1">${t('Yes, it supports the sentence', 'Да, подтверждает')}</button><button data-v="0">${t('No, it does not', 'Нет, не подтверждает')}</button></div><div id="vd"></div>`);
  }
  const use = i => { const p = P[i]; $('#s').value = p[2]; IDS.forEach(k => ($(`[data-e=${k}]`).checked = p[3].includes(k))); run(); };
  $('#chips').onclick = e => { const b = e.target.closest('button'); if (b) use(+b.dataset.i); };
  // addEventListener, not onkeydown: a handler that returns false would cancel every keystroke.
  $('#go').onclick = run; $('#s').addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
  el.querySelectorAll('[data-e]').forEach(c => (c.onchange = run));

  // The answer to "does the quote support this?" depends on what the README reports. Wording is conditional for sentences the demo has no record of.
  const FIRST_WEEK = t('The offer says “from its first week”, the sentence says “right away”. The README reports that this kind of overstatement of the seller’s own offer still reached final drafts (“visible right away”, “tracking from day one”), so a reviewer has to catch it.', 'Оффер говорит «from its first week» (с первой недели), а предложение — «right away» (сразу). README сообщает, что такие преувеличения оффера самого продавца всё же доходили до финальных черновиков («visible right away», «tracking from day one»), и их приходится ловить проверяющему.');
  const DOUBLING = t('The quote says 85 trucks, not that the fleet doubled. In the project’s own claim test the model verifier caught “congrats on doubling your fleet”; a rule cannot read it.', 'В цитате 85 грузовиков, а не удвоение парка. В собственном тесте проекта модель-верификатор поймала «congrats on doubling your fleet»; правилами это не прочитать.');
  const QUEUE = t('go on to the model verifier and, if that agrees, to the approval queue with the sentence highlighted and linked to its quote, so a reviewer can check it in seconds.', 'пошло бы к модели-верификатору и, если та согласна, в очередь одобрения: фраза подсвечена и связана со своей цитатой, и проверяющий сверяет её за пару секунд.');
  const TEST = t('In the project’s own test (57 synthetic claims) the rules alone caught 25 of 29 bad claims (86.2% recall, no false alarm) and the model verifier alone 26 of 29. Together they caught all 29, at the price of 3 false alarms on harmless colour (precision 100% → 90.6%). A reviewer is the last layer.', 'В собственном тесте проекта (57 синтетических утверждений) одни правила поймали 25 из 29 плохих (recall 86,2%, ни одной ложной тревоги), а одна модель-верификатор — 26 из 29. Вместе поймали все 29, ценой 3 ложных тревог на безобидные оговорки (precision 100% → 90,6%). Последний слой — проверяющий человек.');
  const OFFER_GAP = t('This is the gap the README reports: the checker is much stricter about claims on the prospect than about paraphrases of the seller’s own offer.', 'Это пробел, о котором пишет README: проверка куда строже к утверждениям о клиенте, чем к пересказам оффера самого продавца.');
  $('#res').onclick = e => {
    const b = e.target.closest('button'), vd = $('#vd'); if (!b || !vd) return;
    const pi = P.findIndex(p => p[2] === cur && p[3].join() === cur1.join()); // which ready-made sentence this is, -1 for your own
    if (b.dataset.v === '1') {
      const [cls, mark, msg] = pi === 0 ? ['good', '✓', t('Yes: the job post on /careers is dated 5 September, so the sentence is supported. In Scout it would still ', 'Да: вакансия на /careers датирована 5 сентября, так что предложение подтверждено. В Scout оно всё равно ') + QUEUE]
        : pi === 5 ? ['warn', '!', t('Look again. ', 'Присмотритесь. ') + DOUBLING]
        : pi === 6 ? ['warn', '!', t('Look again. ', 'Присмотритесь. ') + FIRST_WEEK]
        : ['good', '✓', t('If it really is supported, then in Scout it would ', 'Если оно действительно подтверждено, то в Scout оно ') + QUEUE];
      vd.innerHTML = `<p class="${cls}" style="margin-top:8px">${mark} ${msg}</p>`;
    } else if (b.dataset.v === '0') {
      if (pi === 0) { vd.innerHTML = `<p class="warn" style="margin-top:8px">! ${t('Look again: the quote is a Fleet Safety Lead job post on /careers dated 5 September, so this sentence is supported. Passing the rules is the right result here.', 'Присмотритесь: в цитате — вакансия Fleet Safety Lead на /careers от 5 сентября, так что предложение подтверждено. Здесь правила пропускают его правильно.')}</p>`; return; }
      const head = pi < 0 ? t('Your sentence passes the rules, and you judge it unsupported.', 'Ваше предложение проходит правила, а вы считаете его неподтверждённым.') : t('Right: the rules cannot catch this one.', 'Верно: правила это не ловят.');
      const why = pi === 5 ? DOUBLING : pi === 6 ? FIRST_WEEK : t('If you are right, this is the gap the rules leave: they check numbers, dates, names and old signals, not meaning. A model verifier may catch it.', 'Если вы правы, это тот пробел, который оставляют правила: они проверяют числа, даты, имена и старые сигналы, но не смысл. Модель-верификатор может его поймать.');
      const msg = t(`Here is a sentence that passes the deterministic rules of Scout, an AI sales agent, but that I judge unsupported by its research: “${cur.slice(0, 90)}”. Can you tell why? ${url}`, `Вот предложение, которое проходит детерминированные правила Scout, AI-агента для продаж, но которое я считаю не подтверждённым его исследованием: «${cur.slice(0, 90)}». Сможете понять почему? ${url}`);
      vd.innerHTML = `<div class="share"><b class="warn">${head}</b><br><span class="muted">${why}${pi < 0 && cur1.includes('O1') ? ' ' + OFFER_GAP : ''}<br><br>${TEST}</span><br><button id="sh" style="margin-top:8px">${t('Copy a challenge for friends', 'Скопировать вызов для друзей')}</button></div>`;
      $('#sh').onclick = async ev => { if (await copyText(msg)) ev.target.textContent = t('Copied!', 'Скопировано!'); };
    }
  };
  use(1);
}
