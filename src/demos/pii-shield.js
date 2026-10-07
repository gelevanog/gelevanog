// Browser version of PII Shield's pattern layer (regex + validators) plus a tiny name heuristic standing in for NER.
const SAMPLE = `Hi, my name is Maria Ivanova and I was charged twice.
Card: 4111 1111 1111 1111, order #55821. Please write to maria.ivanova@example.com or call +49 151 2345 6789.
Refund to IBAN DE89 3704 0044 0532 0130 00. My API key is sk-live-9fA3kQ72LmP0xZ81vB.
— Maria`;
const luhn = s => { const d = s.replace(/\D/g, ''); if (d.length < 13 || d.length > 19) return false; let sum = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; } return sum % 10 === 0; };
const iban = s => { const c = s.replace(/\s/g, '').toUpperCase(); if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(c)) return false; const r = (c.slice(4) + c.slice(0, 4)).replace(/[A-Z]/g, ch => ch.charCodeAt(0) - 55); let rem = 0; for (const ch of r) rem = (rem * 10 + +ch) % 97; return rem === 1; };
const DET = [
  { type: 'EMAIL', re: /[\w.+-]+@[\w-]+(\.[\w-]+)+/g },
  { type: 'API_KEY', re: /\b(sk-[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,})\b/g },
  { type: 'IBAN', re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g, ok: iban },
  { type: 'CARD', re: /\b(?:\d[ -]?){13,19}\b/g, ok: luhn },
  { type: 'PHONE', re: /\+\d[\d ()-]{8,16}\d/g },
  { type: 'IP', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
];
const NAME = /(?:my name is|I'?m|I am|Dear|Hi|Hello|Regards,|—|Sincerely,|меня зовут)\s+((?:[A-ZА-Я][a-zа-яё]+)(?:\s+[A-ZА-Я][a-zа-яё]+)?)/g;

function find(text, names) {
  const found = [];
  for (const d of DET) for (const m of text.matchAll(d.re)) if (!d.ok || d.ok(m[0])) found.push({ s: m.index, e: m.index + m[0].length, type: d.type, v: m[0] });
  if (names) {
    for (const m of text.matchAll(NAME)) { const s = m.index + m[0].lastIndexOf(m[1]); found.push({ s, e: s + m[1].length, type: 'PERSON', v: m[1] }); }
    // every other occurrence of a found name (e.g. "— Maria" after "Maria Ivanova")
    for (const f of [...found].filter(x => x.type === 'PERSON')) for (const part of f.v.split(' ')) for (const m of text.matchAll(new RegExp(`\\b${part}\\b`, 'g'))) found.push({ s: m.index, e: m.index + part.length, type: 'PERSON', v: part, key: f.v });
  }
  found.sort((a, b) => a.s - b.s || b.e - a.e);
  const out = []; let end = -1;
  for (const f of found) if (f.s >= end) { out.push(f); end = f.e; }
  return out;
}

export default function mount(el, { t, esc }) {
  el.innerHTML = `
  <label>${t('1. Your text (never leaves your browser)', '1. Ваш текст (не покидает браузер)')}</label>
  <textarea id="in" aria-label="Text to redact" spellcheck="false">${esc(SAMPLE)}</textarea>
  <div class="row"><label class="switch"><input type="checkbox" id="ner" checked> ${t('Name detector (stand-in for the NER model)', 'Детектор имён (замена NER-модели)')}</label></div>
  <div class="cols2"><div><label>${t('2. Detected', '2. Найдено')}</label><div class="out" id="hl"></div></div>
  <div><label>${t('3. The only text the provider sees', '3. Единственный текст, который видит провайдер')}</label><div class="out" id="red"></div></div></div>
  <div class="cols2"><div><label>${t("4. Model's raw answer", '4. Сырой ответ модели')}</label><div class="out" id="raw"></div></div>
  <div><label>${t('5. What your user gets (placeholders restored)', '5. Что получит пользователь (плейсхолдеры возвращены)')}</label><div class="out" id="res"></div></div></div>
  <p class="muted" id="sum" style="margin-top:12px"></p>`;
  const $ = s => el.querySelector(s);
  const run = () => {
    const text = $('#in').value, names = $('#ner').checked;
    const f = find(text, names);
    const map = new Map(), counters = {};
    const ph = x => { const key = x.type + ':' + (x.key || x.v); if (!map.has(key)) { counters[x.type] = (counters[x.type] || 0) + 1; map.set(key, { tag: `[${x.type}_${counters[x.type]}]`, v: x.key || x.v }); } return map.get(key).tag; };
    let hl = '', red = '', pos = 0;
    for (const x of f) { hl += esc(text.slice(pos, x.s)) + `<mark>${esc(x.v)}</mark><span class="tag">${x.type}</span>`; red += esc(text.slice(pos, x.s)) + `<span class="tag green">${ph(x)}</span>`; pos = x.e; }
    hl += esc(text.slice(pos)); red += esc(text.slice(pos));
    $('#hl').innerHTML = hl; $('#red').innerHTML = red;
    const tags = [...map.values()];
    const pick = k => tags.find(x => x.tag.startsWith(`[${k}_`));
    const p = pick('PERSON'), em = pick('EMAIL'), c = pick('CARD');
    const raw = `${p ? `Hi ${p.tag}, ` : t('Hello, ', 'Здравствуйте, ')}${t('I am sorry about the double charge. ', 'Приношу извинения за двойное списание. ')}${c ? t(`We will refund the card ${c.tag} within 3 days. `, `Мы вернём деньги на карту ${c.tag} в течение 3 дней. `) : ''}${em ? t(`A confirmation goes to ${em.tag}.`, `Подтверждение отправим на ${em.tag}.`) : ''}`;
    $('#raw').textContent = raw;
    let res = esc(raw); for (const x of tags) res = res.split(esc(x.tag)).join(`<span class="good">${esc(x.v)}</span>`);
    $('#res').innerHTML = res;
    const leakSuspect = !names && /(?:my name is|Hi|Dear)\s+[A-ZА-Я]/.test(text);
    $('#sum').innerHTML = t(`${f.length} values replaced. `, `Заменено значений: ${f.length}. `) + (leakSuspect ? `<span class="bad">${t('Names went through to the provider. This is why patterns alone leaked 57% of the gold values in the real evaluation.', 'Имена дошли до провайдера. Поэтому одни паттерны пропустили 57% эталонных значений в настоящей оценке.')}</span>` : t('Real project: patterns + GLiNER NER, F1 0.96 on 202 documents.', 'Настоящий проект: паттерны + GLiNER NER, F1 0,96 на 202 документах.'));
  };
  $('#in').oninput = run; $('#ner').onchange = run; run();
}
