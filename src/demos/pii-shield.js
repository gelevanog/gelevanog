// Browser version of PII Shield's pattern layer (regex + validators) plus a tiny name heuristic standing in for the GLiNER NER model.
const SAMPLE_EN = `Hi, my name is Maria Ivanova and I was charged twice.
Card: 4111 1111 1111 1111, order #55821. Please write to maria.ivanova@example.com or call +49 151 2345 6789.
Refund to IBAN DE89 3704 0044 0532 0130 00. My API key is sk-live-9fA3kQ72LmP0xZ81vB.
— Maria`;
const SAMPLE_RU = `Здравствуйте, меня зовут Мария Иванова, мне дважды списали деньги.
Карта: 4111 1111 1111 1111, заказ №55821. Напишите на maria.ivanova@example.com или позвоните +49 151 2345 6789.
Возврат на IBAN DE89 3704 0044 0532 0130 00. Мой API-ключ sk-live-9fA3kQ72LmP0xZ81vB.
— Мария`;
const luhn = s => { const d = s.replace(/\D/g, ''); if (d.length < 13 || d.length > 19) return false; let sum = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; } return sum % 10 === 0; };
const iban = s => { const c = s.replace(/\s/g, '').toUpperCase(); if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(c)) return false; const r = (c.slice(4) + c.slice(0, 4)).replace(/[A-Z]/g, ch => ch.charCodeAt(0) - 55); let rem = 0; for (const ch of r) rem = (rem * 10 + +ch) % 97; return rem === 1; };
const ip = s => s.split('.').every(n => +n < 256) && !/^(127|0)\./.test(s);
const DET = [
  { type: 'EMAIL', re: /[\w.+-]+@[\w-]+(\.[\w-]+)+/g },
  { type: 'SECRET', re: /\b(sk-[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,})\b/g },
  { type: 'IBAN', re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g, ok: iban },
  { type: 'CREDIT_CARD', re: /\b\d(?:[ -]?\d){12,18}\b/g, ok: luhn },
  { type: 'PHONE', re: /\+\d[\d ()-]{8,16}\d/g },
  { type: 'IP_ADDRESS', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, ok: ip },
];
// support-chat: cards and IBANs masked to the last 4, secrets masked, none of it restored. Everything else gets a reversible placeholder.
const last4 = v => v.replace(/[^0-9A-Za-z]/g, '').slice(-4);
const MASKED = { CREDIT_CARD: v => '**** **** **** ' + last4(v), IBAN: v => '**** ' + last4(v), SECRET: () => '****' };
// Names only after trigger phrases (no lookbehind, so it also loads in older Safari); \p{Lu}\p{Ll}+ covers Cyrillic incl. Ё, umlauts, accents.
const W = '\\p{Lu}\\p{Ll}+', N = `(${W}(?: ${W})?)`;
const NAME = new RegExp(`(?:^|[^\\p{L}\\d])(?:(?:[Mm]y name is|[Мм]еня зовут|Здравствуйте,?|I['’]?m|I am|Dear|Hi|Hello) +|(?:[Rr]egards|[Ss]incerely|С уважением),\\s+)${N}|^— *${N}`, 'gmu');
const ROLE = /^(?:customer|client|support|team|sir|madam|all|everyone|user|admin|manager|service|agent|клиент|поддержка|команда|коллеги|все)$/i;

function names(text) {
  const out = [];
  for (const m of text.matchAll(NAME)) {
    const v = m[1] ?? m[2];
    if (v.split(' ').every(w => ROLE.test(w))) continue; // "Dear Customer Support" is not a person
    const s = m.index + m[0].lastIndexOf(v); out.push({ s, e: s + v.length, type: 'PERSON', v });
  }
  return out;
}
function find(text, withNames) {
  const found = [];
  for (const d of DET) for (const m of text.matchAll(d.re)) if (!d.ok || d.ok(m[0])) found.push({ s: m.index, e: m.index + m[0].length, type: d.type, v: m[0] });
  if (withNames) {
    const people = names(text); found.push(...people);
    // every other mention of a found name part (e.g. "— Maria" after "Maria Ivanova"); exact same form only, no Russian cases
    for (const f of people) for (const part of f.v.split(' ')) for (const m of text.matchAll(new RegExp(`(^|[^\\p{L}])(${part})(?!\\p{L})`, 'gu'))) { const s = m.index + m[1].length; found.push({ s, e: s + part.length, type: 'PERSON', v: part, key: f.v }); }
  }
  found.sort((a, b) => a.s - b.s || b.e - a.e || (b.key || '').length - (a.key || '').length); // on a tie the longer name link wins ("— Maria" -> "Maria Ivanova")
  const out = []; let end = -1;
  for (const f of found) if (f.s >= end) { out.push(f); end = f.e; }
  return out;
}

export default function mount(el, { t, esc }) {
  const note = (s, first) => `<p style="margin-top:${first ? 0 : 8}px">${s}</p>`;
  el.innerHTML = `
  <label for="pii-in">${t('1. Your text (never leaves your browser)', '1. Ваш текст (не покидает браузер)')}</label>
  <textarea id="pii-in" spellcheck="false">${esc(t(SAMPLE_EN, SAMPLE_RU))}</textarea>
  <div class="row"><label class="switch"><input type="checkbox" id="pii-ner" checked> ${t('Name heuristic (a crude stand-in for the GLiNER NER model)', 'Эвристика для имён (грубая замена NER-модели GLiNER)')}</label></div>
  <div class="cols2"><div><label id="pii-l2">${t('2. Detected', '2. Найдено')}</label><div class="out" id="pii-hl" role="group" aria-labelledby="pii-l2"></div></div>
  <div><label id="pii-l3">${t('3. The only text the provider sees (green: reversible placeholder, amber: one-way mask)', '3. Единственный текст, который видит провайдер (зелёный: обратимый плейсхолдер, жёлтый: необратимая маска)')}</label><div class="out" id="pii-red" role="group" aria-labelledby="pii-l3"></div></div></div>
  <div class="cols2"><div><label id="pii-l4">${t("4. Model's raw answer (canned stand-in, no LLM)", '4. Сырой ответ модели (шаблон-заглушка, без LLM)')}</label><div class="out" id="pii-raw" role="group" aria-labelledby="pii-l4"></div></div>
  <div><label id="pii-l5">${t('5. What your user gets (placeholders restored, masks stay masked)', '5. Что получит пользователь (плейсхолдеры возвращены, маски остаются)')}</label><div class="out" id="pii-res" role="group" aria-labelledby="pii-l5"></div></div></div>
  <p class="muted" id="pii-sum" style="margin-top:12px"></p>
  <div class="note" style="margin-top:12px">
  ${note(t(`Simplified re-implementation, not the real gateway: only a subset of the detectors (email, phone with a leading +, card with Luhn, IBAN with mod-97, IPv4, API-key prefixes), names only after phrases like “my name is”, “Hi”, “Dear”, “Regards”, and no addresses. Placeholders are written [PERSON_1] here; the gateway uses ${esc('<PERSON_1>')}. Panel 4 is a fixed template, not a model; in the real runs 39 of 39 placeholders in real model answers were restored correctly.`,
    `Упрощённая переделка, а не настоящий шлюз: только часть детекторов (email, телефон с ведущим +, карта с проверкой Luhn, IBAN с mod-97, IPv4, префиксы API-ключей), имена только после фраз вроде «меня зовут», «Hi», «Dear», «Regards», адресов нет. Плейсхолдеры здесь записаны как [PERSON_1], в шлюзе они выглядят как ${esc('<PERSON_1>')}. Панель 4 — фиксированный шаблон, а не модель; в настоящих прогонах 39 из 39 плейсхолдеров в ответах реальных моделей восстановлены верно.`), true)}
  ${note(t('The default support-chat policy masks cards and IBANs to the last 4 and masks pasted passwords, and does not restore them; people and contact data get reversible placeholders. This demo does the same, which is why a reply cannot confirm a masked IBAN.',
    'Политика support-chat по умолчанию маскирует карты и IBAN до последних 4 знаков, маскирует вставленные пароли и не восстанавливает их; люди и контакты получают обратимые плейсхолдеры. Демо делает так же, поэтому ответ не может подтвердить замаскированный IBAN.'))}
  ${note(t('What the real project still misses: a lone first name (“Claire”), a lowercase name, a Russian and a US street address, and secrets like refresh_token=… and SMTP_PASSWORD=…. This demo finds no addresses at all and names only after the trigger phrases, in the same form (no Russian cases).',
    'Что настоящий проект всё же пропускает: одиночное имя без фамилии («Claire»), имя со строчной буквы, русский и американский адреса, секреты вида refresh_token=… и SMTP_PASSWORD=…. Эта демонстрация адреса не находит вообще, а имена — только после фраз-триггеров и в той же форме (без падежей).'))}
  </div>`;
  const $ = s => el.querySelector(s);
  const run = () => {
    const text = $('#pii-in').value, withNames = $('#pii-ner').checked;
    const f = find(text, withNames);
    const map = new Map(), counters = {}, masks = [];
    const ph = x => { const key = x.type + ':' + (x.key || x.v); if (!map.has(key)) { counters[x.type] = (counters[x.type] || 0) + 1; map.set(key, { tag: `[${x.type}_${counters[x.type]}]`, v: x.key || x.v }); } return map.get(key).tag; };
    let hl = '', red = '', pos = 0;
    for (const x of f) {
      const m = MASKED[x.type]?.(x.v); if (m) masks.push({ type: x.type, m });
      hl += esc(text.slice(pos, x.s)) + `<mark>${esc(x.v)}</mark><span class="tag">${x.type}</span>`;
      red += esc(text.slice(pos, x.s)) + `<span class="tag ${m ? 'amber' : 'green'}">${esc(m || ph(x))}</span>`; pos = x.e;
    }
    hl += esc(text.slice(pos)); red += esc(text.slice(pos));
    $('#pii-hl').innerHTML = hl; $('#pii-red').innerHTML = red;
    const tags = [...map.values()];
    const first = k => tags.find(x => x.tag.startsWith(`[${k}_`));
    const mk = k => masks.find(x => x.type === k)?.m;
    const p = first('PERSON'), em = first('EMAIL'), card = mk('CREDIT_CARD'), ib = mk('IBAN');
    const raw = (p ? t(`Hi ${p.tag}, `, `Здравствуйте, ${p.tag}! `) : t('Hello, ', 'Здравствуйте! ')) + t('I am sorry about the double charge. ', 'Приношу извинения за двойное списание. ')
      + (card ? t(`We will refund the card ${card} within 3 days. `, `Мы вернём деньги на карту ${card} в течение 3 дней. `) : '')
      + (ib ? t(`The IBAN reached me masked (${ib}), so I cannot confirm it. `, `IBAN дошёл до меня замаскированным (${ib}), поэтому подтвердить его я не могу. `) : '')
      + (em ? t(`A confirmation goes to ${em.tag}.`, `Подтверждение отправим на ${em.tag}.`) : '');
    $('#pii-raw').textContent = raw;
    let res = esc(raw);
    for (const x of tags) res = res.split(esc(x.tag)).join(`<span class="good">${esc(x.v)}</span>`);
    for (const m of [card, ib]) if (m) res = res.split(esc(m)).join(`<span class="warn">${esc(m)}</span>`);
    $('#pii-res').innerHTML = res;
    const leak = !withNames && names(text).length > 0;
    $('#pii-sum').innerHTML = t(`${f.length} values replaced or masked. `, `Заменено или замаскировано значений: ${f.length}. `) + (withNames
      ? t('Real project: patterns + GLiNER NER, F1 0.96 (partial match) on all 202 documents and on the 36 held-out ones; under support-chat it still let 6 of 330 gold values (1.8%) through.', 'Настоящий проект: паттерны + GLiNER NER, F1 0,96 (частичное совпадение) на всех 202 документах и на 36 отложенных; при политике support-chat 6 из 330 эталонных значений (1,8%) всё же прошли.')
      : `<span class="${leak ? 'bad' : ''}">${leak ? t('Names went through to the provider. ', 'Имена дошли до провайдера. ') : ''}${t('In the real evaluation patterns alone let 57% of the gold values through (189 of 330).', 'В настоящей оценке одни паттерны пропустили 57% эталонных значений (189 из 330).')}</span>`);
  };
  $('#pii-in').oninput = run; $('#pii-ner').onchange = run; run();
}
