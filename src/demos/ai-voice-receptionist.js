// Browser version of Callie's core idea: rules run before the model, tools are the only source of facts,
// and nothing is written to the calendar without a read-back and a clear yes. A keyword matcher plays the model; speech is skipped.
const DAY = 864e5, D0 = Date.UTC(2026, 9, 12), NOW = D0 + 10 * 36e5; // frozen demo clock: Mon 12 Oct 2026, 10:00 (the real project can freeze its clock for demos)
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], WDN = WD.map(d => d.slice(0, 3).toLowerCase());
const MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const fmtD = ms => { const d = new Date(ms); return `${WD[d.getUTCDay()]}, ${MO[d.getUTCMonth()]} ${d.getUTCDate()}`; };
const fmtT = m => `${((m / 60) | 0) % 12 || 12}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}`;
const fmtW = w => (w.exact ? fmtT(w.from) : `${fmtT(w.from)}–${fmtT(w.to)}`);
const list = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' or ' + a.at(-1));
const iso = (day, m) => new Date(day + m * 6e4).toISOString().slice(0, 16);
const SR = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap'; // visually hidden, for the screen-reader announcement
const LBL = 'display:block;font-size:13px;color:var(--muted);margin:12px 0 4px;font-weight:600'; // same look as .dm label, for captions that name a region instead of a field
const TAGRU = { rules: 'правила', model: 'модель', tool: 'инструмент', gate: 'защита', stt: 'речь→текст' };
// rules that run on every transcript BEFORE the model sees it. The word lists are this demo's own; the project's lists are not published.
const EMERG = /emergenc|bleed|can'?t breathe|chest pain|unconscious|knocked.?out|swollen|severe pain|911/i;
const PERSON = /\b(human|real person|a person|(talk|speak) to (someone|somebody)|front desk|operator|representative)\b/i;
const ANGRY = /\b(furious|ridiculous|unacceptable|useless|terrible|worst|stupid|hate|angry|fed up|sick of)\b|!{2,}/i;
const YES = /^\W*(yes|yeah|yep|yup|correct|that('?s| is) (right|correct)|go ahead|please do|sounds good)\W*(please|thanks|thank you)?\W*$/i;
const BYE = /\b(bye|goodbye|that'?s all|that is all|that'?s it)\b/i, NOPE = /^\W*(no|nope|wrong|incorrect|not (right|correct)|that'?s not)\b/i;
const WANT = /\b(book|appointment|schedule|come in|see (a|the) dentist)\b/i, SVC = /(cleaning|check-?up|filling|whitening)/i;
const NOTNAME = /^(no|yes|nope|not|wrong|that|the|this|it|is|am|please|thanks|okay|what|how|can|do|you|your|book|appointment|first|second|third|last|one)$/i; // single words that are not a name on their own
const KB = [[/\b(hours?|open|closing|close)\b/i, 'We are open Monday to Friday, 9 AM to 5 PM, with a lunch break from 12 to 1.'], [/park/i, 'There is free parking behind the building.'], [/insur|coverage/i, 'Bring your insurance card to your first visit and the front desk will check your plan.']];
const nextWd = n => { let x = D0 + DAY; while (new Date(x).getUTCDay() !== n) x += DAY; return x; };
function parseDay(s, notes) { // deterministic date normalization, as in the real project: the model passes the caller's words, code resolves them
  let m;
  if (/\btomorrow\b/.test(s)) return D0 + DAY;
  if (/\btoday\b/.test(s)) return D0;
  if ((m = s.match(/\b(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?\b/))) {
    const wk = /week from/.test(s);
    notes.push(wk ? ['“a week from” = that weekday + 7 days', '«a week from» = этот день недели + 7 дней'] : ['the first such weekday after today', 'ближайший такой день недели после сегодняшнего']);
    return nextWd(WDN.indexOf(m[1].slice(0, 3))) + (wk ? 7 * DAY : 0);
  }
  if ((m = s.match(/\bthe (\d{1,2})(?:st|nd|rd|th)\b/)) && +m[1] > 0 && +m[1] < 29) {
    notes.push(['this month, or next month if the date has passed', 'этот месяц или следующий, если дата уже прошла']);
    const x = Date.UTC(2026, 9, +m[1]); return x >= D0 ? x : Date.UTC(2026, 10, +m[1]);
  }
  return null;
}
function parseTime(s, notes) {
  let m, h, mi = 0, ap = '';
  if ((m = s.match(/half past (\w+)/))) { h = HW[m[1]] || +m[1]; mi = 30; }
  else if ((m = s.match(/\b(\d{1,2})(?::(\d\d))?\s*([ap])\.?m\b/))) { h = +m[1]; mi = +(m[2] || 0); ap = m[3]; }
  else if ((m = s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/))) { h = +m[1]; mi = +m[2]; }
  else if (/\bnoon\b/.test(s)) { h = 12; ap = 'p'; }
  if (h) {
    if (ap === 'p' && h < 12) h += 12; else if (ap === 'a' && h === 12) h = 0;
    else if (!ap && h <= 12) { if (h < 9) h += 12; notes.push(['AM/PM assumed from the clinic hours', 'AM/PM определено по часам работы клиники']); }
    return { from: h * 60 + mi, to: h * 60 + mi + 30, exact: 1 };
  }
  return /after lunch|afternoon/.test(s) ? { from: 780, to: 1020 } : /morning/.test(s) ? { from: 540, to: 720 } : /evening|after work/.test(s) ? { from: 1020, to: 1260 } : null;
}
// demo calendar: Mon-Fri, 9:00-17:00 in 30-minute steps, lunch 12:00-13:00, some slots already taken
const slotsOf = (day, taken) => { const wd = new Date(day).getUTCDay(), out = []; if (wd % 6) for (let m = 540; m < 1020; m += 30) if ((m < 720 || m >= 780) && day + m * 6e4 > NOW && (new Date(day).getUTCDate() * 5 + m / 30) % 4 && !taken.has(iso(day, m))) out.push(m); return out; };
function checkAvail(words, prevDay, taken) { // the only source of availability
  const s = words.toLowerCase(), notes = [], day = parseDay(s, notes) ?? prevDay, win = parseTime(s, notes);
  if (day == null) return { day };
  const free = slotsOf(day, taken), c = win ? (win.from + win.to) / 2 : 780;
  let pool = win ? free.filter(m => m >= win.from && m < win.to) : free, near = false;
  if (win && !pool.length) { near = true; pool = [...free].sort((a, b) => Math.abs(a - c) - Math.abs(b - c)).slice(0, 3).sort((a, b) => a - b); }
  else if (pool.length > 3) pool = [pool[0], pool[pool.length >> 1], pool.at(-1)];
  return { day, win, near, notes, slots: pool.map(m => ({ id: iso(day, m), day, m })) };
}
const pickIdx = (s, off) => {
  const o = /\b(first|1st)\b/.test(s) ? 0 : /\b(second|2nd)\b/.test(s) ? 1 : /\b(third|3rd)\b/.test(s) ? 2 : /\blast\b/.test(s) ? off.length - 1 : null;
  if (o != null) return o < off.length ? o : null;
  const tm = parseTime(s, []), i = tm?.exact ? off.findIndex(x => x.m === tm.from) : -1; return i < 0 ? null : i;
};
const NW = "\\p{L}[\\p{L}'’-]*", NAME = new RegExp(`^${NW}( ${NW}){0,2}$`, 'u'); // one to three words, any alphabet
const nameOf = x => {
  const trust = /^\W*my name('s| is)\s+/i.test(x), n = x.replace(/^\W*(my name is|my name's|this is|it's|it is|under)\s+/i, '').replace(/[.!?,]+$/, '').trim(), w = n.split(' ');
  // whole words, not substrings: "Can Yilmaz" and "Do Nguyen" are names, "can you book" is not (a stop word needs a capitalised non-stop word beside it)
  const ok = NAME.test(n) && (trust || w.every(v => !NOTNAME.test(v)) || (w.length > 1 && w.some(v => !NOTNAME.test(v)) && w.every(v => /^\p{Lu}/u.test(v))));
  return ok ? n.replace(/(^|[ '’-])(\p{Ll})/gu, (_, a, c) => a + c.toUpperCase()) : null;
};
const SWAP = { a: 'u', e: 'i', i: 'e', u: 'o', а: 'о', о: 'а', е: 'и', и: 'е', у: 'о', ы: 'и', э: 'е', я: 'а', ю: 'у', ё: 'е' }; // vowels a recognizer confuses, Latin and Cyrillic (a Latin o falls through to a/u below)
const garble = n => { // every other vowel of the last word is swapped; a last word with no such vowel (Lynn, Ng, other alphabets) loses its last letter, so a noisy name always differs
  const w = n.split(' '), z = w.length - 1; let k = 0;
  w[z] = w[z].replace(/[aeiouаеёиоуыэюя]/gi, v => { const i = k++, l = v.toLowerCase(), r = i % 2 ? l : SWAP[l] || (i ? 'u' : 'a'); return v === l ? r : r.toUpperCase(); });
  const g = w.join(' ');
  return g === n && w[z].length > 1 ? n.slice(0, -1) : g;
};

export default function mount(el, { t, esc, copyText, url }) {
  const fresh = () => ({ log: [['callie', "Thank you for calling Brightside Dental. I'm Callie, an AI assistant, and this call may be recorded. How can I help?"]], trace: [], n: 0, svc: null, day: null, offered: [], pick: null, name: null, said: null, pending: null, dropped: false, step: null, circles: 0, taken: new Set(), ended: false, done: false, share: '' });
  let S = fresh();
  el.innerHTML = `<div class="row"><label class="switch"><input type="checkbox" id="open" checked aria-label="${t('Front desk open', 'Стойка открыта')}"> ${t('Front desk open', 'Стойка открыта')}</label>
  <label class="switch"><input type="checkbox" id="noisy" aria-label="${t('Recognizer mishears names', 'Распознавание путает имена')}"> ${t('Recognizer mishears names', 'Распознавание путает имена')}</label></div>
  <p class="muted" style="font-size:13px">${t('The second switch garbles the last word of a name, like the real run where Whisper heard “Okafor” as “Akafur”. The read-back shows the error, but only a caller who notices it helps: in that run the simulated caller answered “That’s correct” and the misspelled name was booked (booked names exact / misspelled: 3 / 1). Phone digits were the other weak spot of the real run; this demo does not simulate them.', 'Второй переключатель искажает последнее слово имени, как в реальном прогоне, где Whisper услышал «Okafor» как «Akafur». Повтор деталей показывает ошибку, но помогает, только если звонящий её заметил: в том прогоне симулированный звонящий ответил «That’s correct», и имя с ошибкой было записано (записанные имена верно / с ошибкой: 3 / 1). Цифры телефона были вторым слабым местом реального прогона; демо их не имитирует.')}</p>
  <div class="cols2"><div>
    <div id="l-call" style="${LBL}">${t('Call (you are the caller, the call is in English)', 'Звонок (вы — звонящий, разговор по-английски)')}</div>
    <div class="out" id="call" role="log" aria-live="off" aria-labelledby="l-call" tabindex="0" style="min-height:170px;max-height:300px;overflow:auto"></div>
    <div class="row"><input type="text" id="txt" style="flex:1 1 200px;width:auto" aria-label="${t('What the caller says', 'Что говорит звонящий')}" placeholder="${t('Say something…', 'Скажите что-нибудь…')}" autocomplete="off"><button class="go" id="send">${t('Say it', 'Сказать')}</button></div>
    <div class="row" id="sugg" role="group" aria-label="${t('Suggested replies', 'Готовые реплики')}"></div>
    <p class="muted" style="font-size:13px">${t('Clinic, calendar and knowledge base are made up, and the clock is frozen at Mon Oct 12, 10:00. The knowledge base here has three entries (hours, parking, insurance); the real one also covers prices and services. This demo only books, and its read-back has no phone number; the real project also moves and cancels, and reads the phone number back.', 'Клиника, календарь и база знаний вымышлены, часы остановлены на пн, 12 окт., 10:00. В базе знаний здесь три записи (часы, парковка, страховка); в настоящей есть ещё цены и услуги. Демо только записывает, и в его повторе деталей нет номера телефона; настоящий проект ещё переносит и отменяет и повторяет номер телефона.')}</p>
  </div><div>
    <div id="l-tr" style="${LBL}">${t('Under the hood, newest first', 'Под капотом, новое сверху')}</div>
    <div id="tr" role="region" aria-labelledby="l-tr" tabindex="0" style="min-height:170px;max-height:420px;overflow:auto"></div>
    <div id="l-slip" style="${LBL}">${t('Make the model slip', 'Заставить модель ошибиться')}</div>
    <div class="row" role="group" aria-labelledby="l-slip"><button id="slip1">${t('Book an unoffered time', 'Записать неназванное время')}</button><button id="slip2">${t('Book without a yes', 'Записать без «да»')}</button><button id="rst">${t('Reset', 'Сбросить')}</button></div>
    <p class="muted" style="font-size:13px">${t('The stand-in model never slips by itself. These buttons force the mistakes the gates exist for; they unlock once Callie has offered times, and once you picked one. The refusal texts are scripted from the project’s gate rules: there is no lock here to pick.', 'Модель-заменитель сама не ошибается. Кнопки вызывают ошибки, ради которых существуют защиты; они доступны, когда Callie назвала время, и когда вы выбрали одно. Тексты отказов написаны по правилам защиты проекта: взламывать здесь нечего.')}</p>
  </div></div><div id="share"></div><div id="live" role="status" aria-live="polite" style="${SR}"></div>`;
  const $ = q => el.querySelector(q);
  const say = x => { const lv = $('#live'); lv.textContent = ''; setTimeout(() => (lv.textContent = x), 60); }; // announce only what is new, not the whole rebuilt transcript
  const mk = (text, path) => { const B = { n: ++S.n, text, path, lines: [], stop: false }; return [B, (tag, cls, html) => B.lines.push(`<div><span class="tag ${cls}">${t(tag, TAGRU[tag])}</span> ${html}</div>`)]; };
  const sug = () => S.ended ? [] : S.step === 'msg' ? ['Please ask the dentist to call me back about my crown.', 'No, thanks'] : S.pending ? ['Yes', 'No, that is wrong'] : S.step === 'name' ? ['Maria Okafor'] : S.offered.length && !S.pick ? ['The second one', 'How about 3 AM?', 'Friday morning instead'] : S.done ? ['Book another cleaning on Friday morning', 'That is all, bye'] : ['Book a cleaning next Tuesday after lunch', 'What are your hours?', 'Which dentist would do my crown?', 'My face is swollen and bleeding', 'I want to talk to a human'];

  function render() {
    const call = $('#call'), ch = sug();
    call.innerHTML = S.log.map(([w, x]) => w === 'sys' ? `<div class="warn">${esc(x)}</div>` : `<div><span class="tag ${w === 'you' ? '' : 'green'}">${w === 'you' ? t('You', 'Вы') : 'Callie'}</span> ${esc(x)}</div>`).join('');
    call.scrollTop = call.scrollHeight;
    $('#tr').innerHTML = S.trace.map(b => `<div class="step ${b.stop ? 'stop' : 'on'}"><b>#${b.n}</b> ${esc(b.text)}${b.path ? ` <span class="muted">· ${b.path === 'rule' ? t('rules only, no model call · voice to voice in the real runs: 1.4 s (p50)', 'только правила, без вызова модели · в реальных прогонах 1,4 с (p50)') : t('model + tools · voice to voice in the real runs: 4.7 s (p50)', 'модель + инструменты · в реальных прогонах 4,7 с (p50)')}</span>` : ''}${b.lines.join('')}</div>`).join('');
    $('#sugg').innerHTML = ch.map((x, i) => `<button data-i="${i}">${esc(x)}</button>`).join('');
    $('#sugg').querySelectorAll('button').forEach(b => (b.onclick = e => { turn(ch[b.dataset.i]); if (e.detail === 0) $('#txt').focus(); }));
    $('#slip1').disabled = S.ended || !S.offered.length; $('#slip2').disabled = S.ended || !S.pick;
    $('#txt').disabled = $('#send').disabled = S.ended;
    $('#txt').placeholder = S.ended ? t('The call is over. Press Reset.', 'Звонок окончен. Нажмите «Сбросить».') : t('Say something…', 'Скажите что-нибудь…');
    const head = { slip: [t('The gate refused the slip.', 'Защита остановила ошибку.'), 'good'], wrong: [t('Booked, but under the misheard name: the read-back showed it, and your “yes” confirmed it.', 'Записано, но на неверно услышанное имя: повтор деталей это показал, а ваше «да» подтвердило.'), 'warn'], done: [t('Booked: a read-back first, then your “yes”.', 'Записано: сначала повтор деталей, потом ваше «да».'), 'good'] }[S.share];
    $('#share').innerHTML = head ? `<div class="share"><b class="${head[1]}">${head[0]}</b><br><span class="muted">${t('In the real evaluation (23 simulated calls) every one of the 8 calendar changes had a read-back and a yes, and 0 bookings were made on a time no tool offered. That is a check of the process, not of the outcome: one booked name was still misspelled by the recognizer, and only 16 of 23 calls passed. Five of the 7 failures were speech-recognition errors.', 'В реальной оценке (23 симулированных звонка) каждое из 8 изменений календаря шло после повтора деталей и «да», а записей на время, которого не предлагал инструмент, было 0. Это проверка процесса, а не результата: одно записанное имя всё равно распознано с ошибкой, и прошли только 16 из 23 звонков. Пять из 7 провалов — ошибки распознавания речи.')}</span><br><button id="sh" style="margin-top:8px">${t('Copy a note to share', 'Скопировать текст для друзей')}</button></div>` : '';
    const sh = $('#sh'); if (sh) sh.onclick = async e => { if (await copyText(t(`See how a voice receptionist is stopped from booking a time it never offered. A simplified demo in the browser: ${url}`, `Посмотрите, как голосовому ресепшионисту не дают записать время, которого он не предлагал. Упрощённое демо в браузере: ${url}`))) e.target.textContent = t('Copied!', 'Скопировано!'); };
  }

  function turn(raw) {
    const text = raw.trim(); if (!text || S.ended) return;
    const s = text.toLowerCase(), open = $('#open').checked, noisy = $('#noisy').checked, dayHit = parseDay(s, []) != null;
    const [B, L] = mk(text, 'llm'), C = x => S.log.push(['callie', x]);
    S.log.push(['you', text]);
    const from = S.log.length;
    const escal = kind => {
      B.path = 'rule'; B.stop = true;
      const own = t(' (the word list is this demo’s own)', ' (список слов в демо — собственный)');
      L('rules', 'amber', { emergency: t('Emergency words: the escalation rule fires before the model sees the text', 'Слова об экстренной ситуации: правило эскалации срабатывает до того, как текст увидит модель') + own, person: t('The caller asked for a person: escalation rule, no model', 'Звонящий просит человека: правило эскалации, без модели') + own, angry: t('The caller sounds angry: escalation rule, no model', 'Звонящий раздражён: правило эскалации, без модели') + own, circles: t('Repeated misunderstanding: the conversation is going in circles, so a person takes over (this demo hands over after 3 in a row)', 'Повторное непонимание: разговор ходит по кругу, поэтому подключается человек (в демо — после 3 подряд)') }[kind]);
      if (S.pending) { S.pending = null; S.dropped = true; L('rules', 'amber', t('The pending read-back is dropped: only a clear “yes” as the caller’s very next reply could confirm it, and this reply was not one', 'Ожидавший повтор деталей отброшен: подтвердить его могло только чёткое «да» в самой следующей реплике, а эта реплика им не была')); }
      const pre = kind === 'emergency' ? 'If this is a medical emergency, please hang up and call 911 right now. ' : '';
      if (open) { L('tool', '', 'transfer_to_human()'); S.ended = true; C(pre + "I'm transferring you to a person now."); S.log.push(['sys', t('☎ Transferred to the front desk. The call is over.', '☎ Звонок переведён на администратора. Разговор окончен.')]); }
      else { L('tool', 'amber', t('Front desk closed: the transfer becomes take_message', 'Стойка закрыта: перевод превращается в take_message')); S.step = 'msg'; C(pre + "The front desk is closed, so I can't transfer you. May I take a message so the team can call you back?"); }
    };
    const setName = x => {
      const n = nameOf(x); if (!n) return false;
      S.said = n; S.name = noisy ? garble(n) : n;
      if (S.name !== n) L('stt', 'amber', t(`the caller said “${esc(n)}”, the recognizer heard “${esc(S.name)}”`, `звонящий сказал «${esc(n)}», распознано «${esc(S.name)}»`));
      return true;
    };
    const readback = () => {
      const p = S.pick; S.pending = { slot: p, name: S.name, said: S.said }; S.dropped = false;
      L('model', '', `book_appointment(slot_id="${p.id}", name="${esc(S.name)}", confirmed=false)`);
      L('tool', 'green', t('returns a read-back built from the row that would be written, spoken by code. Nothing is written yet', 'возвращает повтор деталей из строки, которую собираются записать; его произносит код. Пока ничего не записано'));
      C(`Let me read that back: ${S.name}, ${S.svc}, ${fmtD(p.day)} at ${fmtT(p.m)}. Is that right?`);
    };
    const search = words => {
      const sv = words.match(SVC), r = checkAvail(words, S.day, S.taken);
      if (sv) S.svc = sv[1].toLowerCase().replace('checkup', 'check-up');
      L('model', '', `check_availability(service="${S.svc || 'cleaning'}", when="${esc(words.slice(0, 60))}")`);
      if (r.day == null) { L('tool', 'amber', t('no day in the words: ask, never guess', 'в словах нет дня: переспросить, а не угадывать')); return C('Which day would you like? You can say things like "next Tuesday after lunch" or "the 21st".'); }
      if (!S.svc) { S.svc = 'cleaning'; r.notes.push(['service not stated: "cleaning" assumed in this demo', 'услуга не названа: в демо принята «cleaning»']); }
      Object.assign(S, { day: r.day, offered: r.slots, pick: null, pending: null, dropped: false, step: null });
      L('tool', 'green', `${t('dates are parsed by code, not by the model', 'даты разбирает код, а не модель')}: ${fmtD(r.day)}${r.win ? ', ' + fmtW(r.win) : ''}${r.notes.length ? ` (${t('assumed', 'допущения')}: ${r.notes.map(n => t(...n)).join('; ')})` : ''}`);
      L('tool', r.slots.length ? 'green' : 'amber', r.slots.length ? 'slot_ids: ' + r.slots.map(x => x.id).join(', ') : t('no free slots that day', 'в этот день нет свободных слотов'));
      const times = list(r.slots.map(x => fmtT(x.m)));
      C(!r.slots.length ? `I have nothing on ${fmtD(r.day)}. Would another day work?` : r.near ? `I don't have an opening ${r.win.exact ? 'at ' + fmtT(r.win.from) : 'then'} on ${fmtD(r.day)}. The closest are ${times}. Which would you like?` : `On ${fmtD(r.day)} I have ${times}. Which would you like?`);
    };
    let dropped = false, lost = false;
    const run = () => {
      const kind = EMERG.test(s) ? 'emergency' : PERSON.test(s) ? 'person' : ANGRY.test(s) ? 'angry' : null;
      if (kind) return escal(kind);
      if (S.pending && YES.test(text)) {
        const p = S.pending; B.path = 'rule';
        L('rules', 'green', t('A clear “yes” right after a read-back: handled by a rule, no model call', 'Чёткое «да» сразу после повтора деталей: решает правило, без вызова модели'));
        L('tool', '', `book_appointment(slot_id="${p.slot.id}", name="${esc(p.name)}", confirmed=true)`);
        L('gate', 'green', t('passed: the details match the read-back, the previous turn was that read-back, the caller said yes', 'пройден: детали совпадают с повтором, предыдущий ход был этим повтором, звонящий сказал «да»'));
        L('tool', 'green', 'send_confirmation_sms() → ' + t('dry-run outbox in this demo (no Twilio credentials): no text is really sent', 'тестовая очередь в демо (без ключей Twilio): SMS на самом деле не отправляется'));
        const wrong = p.name !== p.said;
        if (wrong) L('gate', 'amber', t(`The gate compares the booking with the read-back, not with what the caller meant: the caller said “${esc(p.said)}”, the recognizer heard “${esc(p.name)}”, and “${esc(p.name)}” is what got booked. In the real run the simulated caller also answered “That’s correct” to a wrong read-back.`, `Защита сверяет запись с повтором деталей, а не с тем, что имел в виду звонящий: он сказал «${esc(p.said)}», распознано «${esc(p.name)}», и записано «${esc(p.name)}». В реальном прогоне симулированный звонящий тоже ответил «That’s correct» на неверный повтор.`));
        S.taken.add(p.slot.id); Object.assign(S, { pending: null, pick: null, offered: [], name: null, said: null, dropped: false, share: wrong ? 'wrong' : 'done', done: true, step: null });
        C(`You're all set: ${p.name}, ${S.svc}, ${fmtD(p.slot.day)} at ${fmtT(p.slot.m)}. A confirmation text goes out to you. Is there anything else?`);
        return S.log.push(['sys', t('✉ Demo: the confirmation text is a dry-run, nothing is sent.', '✉ Демо: подтверждение по SMS — тестовая очередь, ничего не отправляется.')]);
      }
      if (!S.pending && BYE.test(s)) { B.path = 'rule'; S.ended = true; L('rules', 'green', t('Goodbye: end_call, handled by a rule', 'Прощание: end_call, решает правило')); return C('Thank you for calling Brightside Dental. Goodbye!'); }
      if (S.pending) {
        S.pending = null; S.dropped = dropped = true; L('rules', 'amber', t('Not a clear “yes”: the read-back is dropped, nothing is written', 'Это не чёткое «да»: повтор деталей отброшен, ничего не записано'));
        if (NOPE.test(text) && pickIdx(s, S.offered) == null && !dayHit) { // the real flow sends "no or a change" back to the model; the canned re-ask below is the demo's own
          S.name = null; S.step = 'name'; L('model', '', t('after a “no” the real project lets the model decide what to ask; this canned re-ask is the demo’s own', 'после «нет» в настоящем проекте решает модель, что спросить; этот готовый переспрос — собственный, демо'));
          return C('Sorry about that, nothing was booked. What name should I put it under?');
        }
      }
      if (S.step === 'msg') {
        if (YES.test(text)) { L('model', '', t('take_message needs the text of the message, so the next step is to ask for it', 'для take_message нужен текст сообщения, поэтому следующий шаг — спросить его')); return C('Of course. What should I tell the team?'); }
        S.step = null; if (/^\W*(no|nope)\b/.test(s)) return C('No problem. Is there anything else I can help with?');
        if (!(dayHit || WANT.test(s))) {
          L('model', '', `take_message(text="${esc(text.slice(0, 50))}")`); L('tool', 'green', t('message saved for the team', 'сообщение сохранено для команды'));
          return C('Thank you, I have passed that on to the team. Is there anything else?');
        }
      }
      if (S.step === 'name' && S.pick && !dayHit && !parseTime(s, []) && setName(text)) { S.step = null; return readback(); } // checked before the slot picker, so a name such as "Last" is not taken for "the last one" (day and time words are never a name)
      if (S.offered.length) {
        const i = dayHit ? null : pickIdx(s, S.offered);
        if (i != null) {
          S.pick = S.offered[i]; S.dropped = false; L('model', '', `slot_id="${S.pick.id}" ← ${t('one of the ids the tool returned', 'один из id, которые вернул инструмент')}`);
          if (S.name) return readback();
          S.step = 'name'; return C('Great. What name should I put it under?');
        }
      }
      if (dayHit || WANT.test(s) || (S.offered.length && parseTime(s, []))) return search(text);
      const kb = KB.find(([re]) => re.test(s));
      if (kb || /\?|^(how|what|when|where|do you|does|can you|is there|which)\b/.test(s)) {
        L('model', '', `answer_faq(query="${esc(text.slice(0, 50))}")`);
        if (kb) { L('tool', 'green', t('answers only from the knowledge base (BM25 in the real project, keywords here)', 'отвечает только из базы знаний (в проекте BM25, здесь ключевые слова)')); return C(kb[1]); }
        L('tool', 'amber', t('nothing in the knowledge base: no invented answer, a message is offered instead', 'в базе знаний ничего нет: ответ не выдумывается, вместо него предлагается сообщение'));
        S.step = 'msg'; return C("I don't have that information. May I take a message for the team?");
      }
      if (SVC.test(s)) return search(text);
      if (dropped) return C('No problem, nothing was booked. Which day or time would you like instead?');
      lost = true; L('model', '', t('no tool fits this', 'ни один инструмент не подошёл')); L('rules', 'amber', t(`misunderstanding ${S.circles + 1} in a row (this demo hands over at 3)`, `непонимание ${S.circles + 1} подряд (в демо передача человеку на 3-м)`));
      return ++S.circles >= 3 ? escal('circles') : C("Sorry, I didn't catch that. I can book an appointment, answer questions about the clinic, or take a message.");
    };
    run(); if (!lost) S.circles = 0; // only misunderstandings in a row count; any step that worked starts the count again
    S.trace.unshift(B); render();
    say(S.log.slice(from).map(([w, x]) => (w === 'callie' ? 'Callie: ' : '') + x).join(' '));
  }

  function slip(kind) { // the stand-in model never misbehaves on its own; these force the mistakes the gates exist for
    if (S.ended) return;
    const title = kind === 'slot' ? t('Slip: the model books a time nobody offered', 'Сбой: модель записывает время, которого никто не предлагал') : t('Slip: the model books without a read-back and a yes', 'Сбой: модель записывает без повтора деталей и «да»'), [B, L] = mk(title, null);
    const nm = esc(S.name || 'Maria Okafor'); B.stop = true;
    let why;
    if (kind === 'slot') {
      const m = slotsOf(S.day, S.taken).find(x => !S.offered.some(o => o.m === x));
      L('model', 'red', `book_appointment(slot_id="${iso(S.day, m ?? 180)}", name="${nm}", confirmed=true)`);
      why = t('Refused: check_availability has not returned this slot_id during this phone call', 'Отказ: check_availability не возвращал этот slot_id за время этого телефонного разговора') + (m == null ? '' : t(' (the calendar has it free, which is not enough)', ' (в календаре оно свободно, но этого мало)'));
    } else {
      L('model', 'red', `book_appointment(slot_id="${S.pick.id}", name="${nm}", confirmed=true)`);
      why = S.pending ? t('Refused: the caller has not yet answered the read-back with a clear yes', 'Отказ: звонящий ещё не ответил на повтор деталей чётким «да»')
        : S.dropped ? t('Refused: the earlier read-back was dropped because the caller’s reply was not a clear yes; the details have to be read back again', 'Отказ: прошлый повтор деталей отброшен, потому что ответ звонящего не был чётким «да»; детали нужно повторить заново')
          : t('Refused: the details have not been read back yet, and only the caller’s very next reply, if it is a clear yes, lets a confirmed call through', 'Отказ: детали ещё не повторяли, а подтверждённый вызов пропустит только самая следующая реплика звонящего, если она чёткое «да»');
    }
    L('gate', 'red', why);
    L('tool', '', t('The error goes back to the model. The calendar is unchanged', 'Ошибка возвращается модели. Календарь не изменён'));
    S.share = 'slip'; S.trace.unshift(B); render(); say(title + '. ' + why);
  }
  $('#send').onclick = () => { const v = $('#txt').value; $('#txt').value = ''; turn(v); };
  $('#txt').onkeydown = e => { if (e.key === 'Enter') $('#send').click(); }; // a handler returning false would swallow Tab
  $('#slip1').onclick = () => slip('slot'); $('#slip2').onclick = () => slip('yes');
  $('#rst').onclick = () => { S = fresh(); render(); say(t('The call was reset.', 'Звонок сброшен.')); };
  render();
}
