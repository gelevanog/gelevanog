// Browser stand-in for DocExtract: a regex "reader" (a further simplified version of the repo's offline `fake` provider, not an LLM, deliberately naive)
// fills a fixed form with a confidence and a verbatim evidence quote; plain rules validate it; a router approves the record or sends it to a person.
const KESTREL = `Invoice number: KFL-88412
Invoice date: 12.03.2026
Supplier: Kestrel Freight Logistics B.V.
VAT number: NL853746291B01

Pallet transport Rotterdam - Berlin     4     210,00     840,00
Customs documentation                   1      75,00      75,00
Fuel surcharge                          1      42,50      42,50

Net amount:    957,50 EUR
VAT 21%:       201,08 EUR
Total amount:  1.158,58 EUR`;
const TYPO = KESTREL.replace(/(210,00\s+)840,00/, '$1480,00');
// Modelled on the README's sample 05 (shop name, "Ref PH-88213" and the total are from it); the date line is made up for the demo.
const RECEIPT = 'PINECREST HARDWARE\nRef PH-88213\nDate 2026-03-14\nTotal 427.98 USD';
const ISO = new Set('EUR USD GBP CHF JPY CAD AUD NZD SEK NOK DKK PLN CZK HUF RON BGN TRY INR CNY BRL MXN ZAR'.split(' '));
const NOTCUR = new Set('VAT TAX GST NET INC DUE QTY PCS'.split(' ')); // capitalised words that are not currencies
const TAXID = { NL: /^NL\d{9}B\d{2}$/, DE: /^DE\d{9}$/, GB: /^GB(\d{9}|\d{12})$/, FR: /^FR[A-Z0-9]{2}\d{9}$/, ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/, IT: /^IT\d{11}$/ };
// The README names two of the seeded vendors (Kestrel, matched by tax ID; Northwind, "Northwind Traders Limited"); the repo seeds three.
const VENDORS = [['Kestrel Freight Logistics B.V.', 'NL853746291B01'], ['Northwind Traders Limited', '']];
const nm = s => s.toLowerCase().replace(/\bltd\b/g, 'limited').replace(/[^a-z0-9]/g, '');
const norm = s => s.replace(/\s+/g, ' ').trim();
let DEC = '.'; // decimal mark of the prose: "." in English, "," in Russian (set in mount)
const f2 = x => x.toFixed(2).replace('.', DEC);
const fk = x => x.toFixed(2); // code-like key=value fragments keep the dot
const fq = x => String(x).replace('.', DEC);
const off = (a, b) => Math.abs(Math.round(a * 100) - Math.round(b * 100)) > 2; // AMOUNT_TOLERANCE 0.02
// "1.158,58" and "1,158.58" both mean 1158.58
const num = s => { const d = s.lastIndexOf(','), p = s.lastIndexOf('.'), k = Math.max(d, p); const th = k < 0 || ((d < 0 || p < 0) && (s.split(s[k]).length > 2 || s.length - k - 1 === 3)); return th ? +s.replace(/[.,]/g, '') : +(s.slice(0, k).replace(/[.,]/g, '') + '.' + s.slice(k + 1)); };
// Dates are day-first; with "/" they are month-first only when the day part cannot be a month (03/14/2026).
const iso = s => { const a = s.match(/^(\d{4})-(\d\d)-(\d\d)$/), b = s.match(/^(\d{1,2})([./])(\d{1,2})\2(\d{4})$/); const us = b && b[2] === '/' && +b[3] > 12 && +b[1] <= 12; const r = a ? s : b ? `${b[4]}-${(us ? b[1] : b[3]).padStart(2, '0')}-${(us ? b[3] : b[1]).padStart(2, '0')}` : ''; const d = new Date(r); return r && !isNaN(d) && d.toISOString().slice(0, 10) === r ? r : null; };

// 1. READ: label-based regexes. Unlabeled references and names without a legal suffix get low confidence, like the repo's fake provider.
function read(text, o) {
  const F = {}, m = re => text.match(re), ln = re => m(re)?.[0].trim() ?? null;
  // last amount on a line, ignoring "(...)" and "21%" so that "Total 100 EUR (21% VAT)" gives 100
  const last = s => s && (s.replace(/\([^)]*\)/g, ' ').replace(/\d+(?:[.,]\d+)?\s*%/g, ' ').match(/\d+(?:[.,]\d+)*/g) || []).pop();
  const put = (k, value, conf, quote) => (F[k] = { value: value ?? null, conf: o.over ? 1 : value == null ? .9 : conf, quote: value == null ? null : quote });
  const tl = ln(/^[^\n]*\btotal\b[^\n]*$/im), sl = ln(/^[^\n]*\b(?:net[ \t]+amount|subtotal|net)\b[^\n]*$/im);
  const xl0 = ln(/^[^\n]*\b(?:vat|tax)\b(?![ \t]*(?:id|number|no\b))[^\n]*\d[^\n]*$/im), xl = xl0 === tl ? null : xl0; // "Total incl. VAT: 100 EUR" is the total, not a tax line
  const D = '(\\d{4}-\\d\\d-\\d\\d|\\d{1,2}[./]\\d{1,2}[./]\\d{4})';
  let a = [...text.matchAll(/^[ \t]*(?:supplier|vendor|from)[ \t]*:[ \t]*(\S[^\n]*)/gim)].find(x => !x[1].includes('@')); // a "From:" address is not a vendor name
  const first = (text.split('\n').map(s => s.trim()).find(Boolean) || '').split(/\s{2,}/)[0];
  if (a) put('vendor_name', a[1].trim(), .92, a[0].trim());
  else if (first && !/:|^(invoice|date|total|ref)/i.test(first)) put('vendor_name', first, /\b(gmbh|ltd|limited|llc|inc|corp|ag)\b|b\.v\.|s\.a\./i.test(first) ? .9 : .55, first);
  else put('vendor_name', null);
  a = m(/(?:vat(?:[ \t]*(?:number|id|no\b\.?))?|tax[ \t]*id)[ \t]*:?[ \t]*([A-Z]{2}(?=[A-Z0-9]*\d)[A-Z0-9]{4,14})\b/i);
  put('vendor_tax_id', a && a[1].toUpperCase(), .95, a?.[0]);
  a = m(/invoice[ \t]*(?:number|no\b\.?|#)[ \t]*[:#]?[ \t]*([A-Z0-9][\w-]*)/i);
  const ref = m(/\bref\b\.?[ \t]*[:#]?[ \t]*([A-Z0-9][\w-]{2,})/i);
  if (a) put('invoice_number', a[1], .95, a[0]); else if (ref) put('invoice_number', ref[1], .6, ref[0]); else put('invoice_number', null);
  if (o.hall && F.invoice_number.value) { const v = F.invoice_number.value, nv = v.replace(/.$/, c => (/\d/.test(c) ? (+c + 1) % 10 : 'X')); F.invoice_number.value = nv; F.invoice_number.quote = F.invoice_number.quote.replace(v, nv); }
  a = m(new RegExp('(?<!due[ \\t])\\b(?:invoice[ \\t]+)?date[ \\t]*:?[ \\t]*' + D, 'i'));
  put('issue_date', a && iso(a[1]), .95, a?.[0]);
  a = m(new RegExp('due[ \\t]*date[ \\t]*:?[ \\t]*' + D, 'i'));
  put('due_date', a && iso(a[1]), .95, a?.[0]);
  const caps = tl ? tl.match(/\b[A-Z]{3}\b/g) || [] : []; // a known ISO code wins; else the first capitalised word that is not VAT/TAX/...; else a symbol
  put('currency', tl && (caps.find(c => ISO.has(c)) || caps.find(c => !NOTCUR.has(c)) || { '€': 'EUR', $: 'USD', '£': 'GBP' }[tl.match(/[€$£]/)?.[0]]), .95, tl);
  [['subtotal', sl], ['tax', xl], ['total', tl]].forEach(([k, l]) => put(k, last(l) ? num(last(l)) : null, .95, l));
  const items = text.split('\n').map(s => s.trim()).flatMap(s => {
    const r = s.length < 300 && s.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)*)\s+(\d+(?:[.,]\d+)*)$/);
    return r ? [{ d: r[1], q: num(r[2]), u: num(r[3]), a: num(r[4]), conf: o.over ? 1 : .9, quote: s }] : [];
  });
  return { F, items };
}

// 2. CHECK: small deterministic rules; codes, severities and the 0.02 tolerance follow the README (tax-ID formats and currencies are a short list here).
function validate(t, text, F, items, o) {
  const out = [], add = (code, sev, field, msg) => out.push({ code, sev, field, msg }), v = k => F[k].value;
  const tax = v('vendor_tax_id'), cc = tax?.slice(0, 2), name = v('vendor_name');
  const known = !!name && VENDORS.some(([n, x]) => (tax && x === tax) || nm(n) === nm(name));
  for (const k of ['vendor_name', 'invoice_number', 'issue_date', 'currency', 'total']) if (v(k) == null) add('missing_required_field', 'error', k, t(`Required field "${k}" was not found in the document.`, `Обязательное поле «${k}» не найдено в документе.`));
  const sum = items.reduce((s, i) => s + i.a, 0), base = v('subtotal') ?? (v('total') != null && v('tax') != null ? v('total') - v('tax') : null);
  if (items.length && base != null && off(sum, base)) add('line_items_sum_mismatch', 'error', 'subtotal', t(`Line items add up to ${f2(sum)} but the subtotal is ${f2(base)} (difference ${f2(sum - base)}).`, `Позиции в сумме дают ${f2(sum)}, а подытог — ${f2(base)} (разница ${f2(sum - base)}).`));
  if (v('subtotal') != null && v('tax') != null && v('total') != null && off(v('subtotal') + v('tax'), v('total'))) add('totals_mismatch', 'error', 'total', t(`Subtotal ${f2(v('subtotal'))} + tax ${f2(v('tax'))} = ${f2(v('subtotal') + v('tax'))}, but the total is ${f2(v('total'))}.`, `Подытог ${f2(v('subtotal'))} + налог ${f2(v('tax'))} = ${f2(v('subtotal') + v('tax'))}, а итог — ${f2(v('total'))}.`));
  if (v('issue_date') && v('due_date') && v('due_date') < v('issue_date')) add('due_before_issue', 'error', 'due_date', t('The due date is earlier than the issue date.', 'Срок оплаты раньше даты счёта.'));
  if (v('currency') && !ISO.has(v('currency'))) add('invalid_currency', 'error', 'currency', t(`"${v('currency')}" is not an ISO 4217 code (this demo knows a short list).`, `«${v('currency')}» — не код ISO 4217 (в демо короткий список).`));
  if (o.dup && v('invoice_number') && name) add('duplicate_invoice', 'error', 'invoice_number', t(`An earlier, non-rejected invoice ${v('invoice_number')} from the same vendor is already in the system.${known ? '' : ' The vendor is not on this demo’s short list; the repo can still hold it (master data, or an earlier copy awaiting review).'}`, `В системе уже есть более ранний неотклонённый счёт ${v('invoice_number')} от того же поставщика.${known ? '' : ' Поставщика нет в коротком списке демо; в репозитории он всё равно может быть (справочник или более ранняя копия, ожидающая проверки).'}`));
  items.forEach((i, n) => off(i.q * i.u, i.a) && add('line_item_amount_mismatch', 'warning', 'line_items.' + n, t(`Line ${n + 1}: ${fq(i.q)} x ${f2(i.u)} = ${f2(i.q * i.u)}, but the line amount is ${f2(i.a)}.`, `Строка ${n + 1}: ${fq(i.q)} x ${f2(i.u)} = ${f2(i.q * i.u)}, а сумма строки — ${f2(i.a)}.`)));
  if (!v('due_date')) add('missing_due_date', 'warning', 'due_date', t('No due date on the document.', 'В документе нет срока оплаты.'));
  if (!items.length) add('no_line_items', 'warning', 'line_items', t('No line items extracted.', 'Позиции не извлечены.'));
  if (!tax) add('missing_tax_id', 'info', 'vendor_tax_id', t('No tax ID found.', 'Налоговый номер не найден.'));
  else if (!TAXID[cc]) add('unrecognized_tax_id', 'info', 'vendor_tax_id', t(`Tax ID ${tax}: this demo does not know the format of that country.`, `Налоговый номер ${tax}: формат этой страны демо не знает.`));
  else if (!TAXID[cc].test(tax)) add('invalid_tax_id_format', 'warning', 'vendor_tax_id', t(`Tax ID ${tax} does not match the ${cc} format.`, `Налоговый номер ${tax} не соответствует формату ${cc}.`));
  for (const [k, x] of [...Object.entries(F), ...items.map((i, n) => ['line_items.' + n, i])]) if (x.quote && !norm(text).includes(norm(x.quote))) add('evidence_not_found', 'warning', k, t(`The quote for ${k} does not occur in the document (possible hallucination).`, `Цитаты для ${k} нет в документе (возможная галлюцинация).`));
  if (name && !known) add('new_vendor', 'info', 'vendor_name', t(`'${name}' is not in this demo’s short vendor list (Kestrel, Northwind; the repo seeds three vendors); a vendor record would be created on approval.`, `«${name}» нет в коротком списке поставщиков демо (Kestrel, Northwind; в репозитории их три); запись о нём создалась бы при одобрении.`));
  return out.sort((a, b) => 'error warning info'.indexOf(a.sev) - 'error warning info'.indexOf(b.sev));
}

// 3. ROUTE: errors or any field under 0.75 -> review; the two policy switches are real settings of the repo.
function route(t, F, items, issues, o) {
  const why = [], codes = s => [...new Set(issues.filter(i => i.sev === s).map(i => i.code))], errs = issues.filter(i => i.sev === 'error').length;
  if (errs) why.push(t(`${errs} error-level issue(s): ${codes('error').join(', ')}`, `ошибок: ${errs} (${codes('error').join(', ')})`));
  const low = [...Object.entries(F), ...items.map((i, n) => ['line_items.' + n, i])].filter(([, x]) => x.conf < .75).map(([k, x]) => `${k}=${fk(x.conf)}`);
  if (low.length) why.push(t(`confidence below 0.75: ${low.join(', ')}`, `уверенность ниже 0,75: ${low.join(', ')}`));
  if (o.warn && codes('warning').length) why.push(t(`warnings (REVIEW_ON_WARNINGS=true): ${codes('warning').join(', ')}`, `предупреждения (REVIEW_ON_WARNINGS=true): ${codes('warning').join(', ')}`));
  if (o.newv && codes('info').includes('new_vendor')) why.push(t('first invoice from an unknown vendor (REVIEW_NEW_VENDORS=true)', 'первый счёт от неизвестного поставщика (REVIEW_NEW_VENDORS=true)'));
  return why;
}

export default function mount(el, { t, esc, copyText, url }) {
  DEC = t('.', ',');
  const OPT = ['over', 'hall', 'dup', 'warn', 'newv'];
  const SC = [[t('Clean supplier email', 'Чистое письмо поставщика'), KESTREL, {}], [t("Numbers that don't add up", 'Цифры не сходятся'), TYPO, {}], [t('Re-sent copy', 'Повторно присланная копия'), KESTREL, { dup: 1 }],
    [t('Till receipt (modelled on sample 05)', 'Кассовый чек (по образцу 05)'), RECEIPT, {}], [t('Overconfident reader (same receipt)', 'Самоуверенный «читатель» (тот же чек)'), RECEIPT, { over: 1 }]];
  const SEV = { error: t('error', 'ошибка'), warning: t('warning', 'предупреждение'), info: t('info', 'инфо') };
  const LBL = 'display:block;font-size:13px;color:var(--muted);margin:12px 0 4px;font-weight:600'; // look of the demo's <label>, for headings that label no single control
  const VH = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap'; // visually hidden text for screen readers
  const sw = (id, txt) => `<label class="switch" style="display:flex;margin:6px 0"><input type="checkbox" id="${id}" aria-label="${esc(txt)}"> ${esc(txt)}</label>`;
  const grid = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:0 14px';
  el.innerHTML = `<div id="scl" style="${LBL}">${t('Pick a scenario, or just edit the text', 'Выберите сценарий или просто правьте текст')}</div>
  <div class="row" id="sc" role="group" aria-labelledby="scl">${SC.map((s, i) => `<button data-i="${i}" aria-pressed="false">${esc(s[0])}</button>`).join('')}</div>
  <div style="display:flex;flex-wrap:wrap;gap:0 14px"><div style="flex:1.3 1 340px;min-width:0"><label for="doc">${t('The document: change a digit, delete a label, paste your own', 'Документ: поменяйте цифру, удалите подпись, вставьте свой текст')}</label>
    <textarea id="doc" spellcheck="false" maxlength="4000" style="min-height:clamp(160px,45vw,250px);font-size:13px"></textarea></div>
  <div style="flex:1 1 280px;min-width:0"><div id="rsl" style="${LBL}">${t('Result', 'Результат')}</div><div class="out" id="res" role="group" aria-labelledby="rsl" style="margin-top:0"></div><div id="live" role="status" aria-live="polite" style="${VH}"></div><div id="sh"></div></div></div>
  <div style="${grid}"><div role="group" aria-labelledby="wgl"><div id="wgl" style="${LBL}">${t('What goes wrong (simulated)', 'Что идёт не так (имитация)')}</div>
    ${sw('over', t('Simulated: the reader reports 1.00 on every field', 'Имитация: читатель ставит 1,00 каждому полю'))}${sw('hall', t('Simulated: the reader makes up an invoice number', 'Имитация: читатель выдумывает номер счёта'))}${sw('dup', t('An earlier copy is already in the system', 'Более ранняя копия уже есть в системе'))}</div>
  <div role="group" aria-labelledby="pgl"><div id="pgl" style="${LBL}">${t('Routing policy (settings from the repo)', 'Политика маршрутизации (настройки из репозитория)')}</div>
    ${sw('warn', t('REVIEW_ON_WARNINGS: warnings go to a person too', 'REVIEW_ON_WARNINGS: предупреждения тоже идут человеку'))}${sw('newv', t('REVIEW_NEW_VENDORS: a new vendor’s first invoice goes to a person', 'REVIEW_NEW_VENDORS: первый счёт нового поставщика идёт человеку'))}</div></div>
  <div id="fxl" style="${LBL}">${t('What the reader extracted: value, confidence, verbatim quote', 'Что извлёк читатель: значение, уверенность, дословная цитата')}</div><div id="fld" role="group" aria-labelledby="fxl" style="${grid}"></div><div id="src"></div>
  <p class="muted" style="font-size:13px;margin-top:14px">${t('The reader here is a regex stand-in, a further simplified version of the repo’s offline fake provider (“a test double, not a production extractor”), and deliberately naive: dates are read day-first (month-first only when the day is above 12), the currency is the first ISO-looking code on the total line, and a From: line with an address is not taken as a vendor name. Its confidences are its own, not an LLM’s. The 0.75 threshold, rule names, severities and the 0.02 tolerance follow the README; tax-ID formats, currencies and vendor matching are shortened (two vendors, not the repo’s three). The till receipt is modelled on the README’s sample 05 (shop name, reference and total are from it; the date is made up). English route reasons and rule messages follow the README’s wording where it quotes them; the Russian text is translated. Real free model on the 8 sample documents: 4 approved, 4 needs_review. All of those documents are fictional.', 'Читатель здесь — regex-имитация, ещё более упрощённая версия офлайн-провайдера fake из репозитория («тестовая заглушка, а не боевой экстрактор»), и намеренно наивная: даты читает день-первым (месяц-первым, только если число больше 12), валюта — первый похожий на ISO код в строке итога, а строка From: с адресом не считается названием поставщика. Её уверенность — своя собственная, не LLM. Порог 0,75, названия правил, уровни серьёзности и допуск 0,02 взяты из README; форматы налоговых номеров, валюты и сопоставление поставщиков сокращены (два поставщика, а не три, как в репозитории). Кассовый чек сделан по образцу 05 из README (название магазина, номер и сумма оттуда, дата выдумана). Английские причины маршрутизации и тексты правил следуют формулировкам README там, где он их приводит; русский текст — перевод. Реальная бесплатная модель на 8 тестовых документах: 4 approved, 4 needs_review. Все эти документы вымышлены.')}</p>`;
  const $ = s => el.querySelector(s), chips = [...el.querySelectorAll('#sc button')];
  let last = '', said = '', pending = '', timer;
  const mark = i => chips.forEach((b, j) => { b.classList.toggle('sel', j === i); b.setAttribute('aria-pressed', String(j === i)); });
  // Screen readers get one short, debounced summary instead of the whole result rewritten on every keystroke.
  const say = txt => { pending = txt; clearTimeout(timer); if (txt !== said) timer = setTimeout(() => { said = txt; $('#live').textContent = txt; }, 800); };
  const run = () => {
    const text = $('#doc').value, o = Object.fromEntries(OPT.map(k => [k, $('#' + k).checked]));
    const { F, items } = read(text, o), issues = validate(t, text, F, items, o), why = route(t, F, items, issues, o), ok = !why.length;
    const has = c => issues.some(i => i.code === c);
    const hallTip = ok && o.hall && has('evidence_not_found');
    const tip = hallTip ? t('The made-up number is flagged as a warning (its quote is not in the document), but by the README’s defaults a warning does not route to review (REVIEW_ON_WARNINGS=false), so this would pass. That is read from the README’s rule table; the README does not show this exact case. REVIEW_ON_WARNINGS=true would stop it.', 'Выдуманный номер помечен предупреждением (его цитаты нет в документе), но по умолчанию из README предупреждение не отправляет на проверку (REVIEW_ON_WARNINGS=false), так что этот счёт прошёл бы. Это следует из таблицы правил в README; такого случая README не показывает. REVIEW_ON_WARNINGS=true его бы остановил.')
      : ok && has('new_vendor') && !o.newv ? (o.over ? t('A reader that is always sure gives the router no signal. The safety net is REVIEW_NEW_VENDORS=true.', 'Читатель, который всегда уверен, не даёт роутеру сигнала. Страховка — REVIEW_NEW_VENDORS=true.') : t('Consistent numbers from an unknown vendor pass by default. REVIEW_NEW_VENDORS=true would send its first invoice to a person.', 'Согласованные цифры от неизвестного поставщика проходят по умолчанию. REVIEW_NEW_VENDORS=true отправил бы его первый счёт человеку.')) : '';
    const head = ok ? `<span class="tag green">approved</span> <b class="good">${t('Auto-approved. Nobody had to look at it.', 'Одобрено автоматически. Человеку смотреть не пришлось.')}</b><br><span class="muted">${t('No errors, and every field at or above 0.75 confidence.', 'Нет ошибок, и у каждого поля уверенность не ниже 0,75.')}</span>`
      : `<span class="tag amber">needs_review</span> <b class="warn">${t('Sent to a person.', 'Отправлено человеку.')}</b><br><span class="muted">${esc(why.join(' · '))}</span>`;
    const TG = { error: 'red', warning: 'amber', info: '' };
    const html = head + issues.map(i => `<div class="step" style="border-color:${i.sev === 'error' ? 'var(--bad)' : i.sev === 'warning' ? 'var(--warn)' : 'var(--line)'}"><span class="tag ${TG[i.sev]}">${SEV[i.sev]}</span> <b>${i.code}</b> <span class="muted">${esc(i.field)}</span><br>${esc(i.msg)}</div>`).join('') + (tip ? `<div class="step on">${esc(tip)}</div>` : '');
    if (html !== last) { $('#res').innerHTML = html; last = html; }
    say(ok ? t('Auto-approved.', 'Одобрено автоматически.') : t('Sent to a person: ', 'Отправлено человеку: ') + why.join('; '));
    const msg = t(`A simulated reader invented an invoice number and this demo’s router still auto-approved it, because a warning alone does not stop it by default. Try it: ${url}`, `Имитация «читателя» выдумала номер счёта, а роутер в этом демо всё равно одобрил его автоматически: одно предупреждение по умолчанию не останавливает. Попробуйте: ${url}`);
    $('#sh').innerHTML = hallTip ? `<div class="share"><b class="warn">${t('Share this result', 'Поделиться результатом')}</b><br><button id="cp" style="margin-top:8px">${t('Copy a message for friends', 'Скопировать сообщение для друзей')}</button></div>` : '';
    const cp = $('#cp'); if (cp) cp.onclick = async () => { if (await copyText(msg)) cp.textContent = t('Copied!', 'Скопировано!'); };
    const rows = [...Object.entries(F).map(([k, x]) => [k, x.value, x]), ...items.map((i, n) => ['line_items.' + n, `${i.d}: ${fq(i.q)} x ${f2(i.u)} = ${f2(i.a)}`, i])];
    $('#fld').innerHTML = rows.map(([k, val, x]) => `<div class="step ${x.conf < .75 ? 'stop' : 'on'}"><span class="muted" style="font-size:12px">${k} · ${t('confidence', 'уверенность')} ${f2(x.conf)}</span><br><b>${val == null ? '—' : esc(typeof val === 'number' ? f2(val) : val)}</b>${x.quote ? `<br><span class="muted" style="font-size:12.5px">“${esc(x.quote)}” ${norm(text).includes(norm(x.quote)) ? `<span class="good"><span aria-hidden="true">✓</span><span style="${VH}">${t('found in the document', 'найдено в документе')}</span></span>` : `<span class="bad"><span aria-hidden="true">✗</span> ${t('not in the document', 'нет в документе')}</span>`}</span>` : ''}</div>`).join('');
    const sp = [...new Set(rows.map(r => r[2].quote).filter(Boolean))].map(q => [text.indexOf(q), q.length]).filter(s => s[0] >= 0).sort((a, b) => a[0] - b[0]);
    let h = '', p = 0; for (const [s, l] of sp) if (s >= p) { h += esc(text.slice(p, s)) + `<mark>${esc(text.slice(s, s + l))}</mark>`; p = s + l; }
    $('#src').innerHTML = ok ? '' : `<div id="srl" style="${LBL}">${t('What the reviewer sees: the values sit next to the text they came from', 'Что видит проверяющий: значения рядом с текстом, откуда они взяты')}</div><div class="out" role="group" aria-labelledby="srl" style="overflow:hidden">${h + esc(text.slice(p))}</div>`;
  };
  chips.forEach((b, i) => (b.onclick = () => { $('#doc').value = SC[i][1]; OPT.forEach(k => ($('#' + k).checked = !!SC[i][2][k])); mark(i); run(); }));
  $('#doc').oninput = () => { mark(-1); run(); };
  OPT.forEach(k => ($('#' + k).onchange = run));
  chips[0].click();
  clearTimeout(timer); said = pending; // the first result is not announced on load
}
