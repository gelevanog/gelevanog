// Browser imitation of Shelfwise's two checks. (1) A photo is read blind and each attribute is decided against the supplier's row. (2) A sentence for the
// listing is checked against the facts that survive. No vision model, no copy model, no LLM. The "photo" is an SVG drawn from a few parameters and the
// "blind reading" is those parameters (the project's renders are drawn the same way, so their labels are exact; its real vision model is far less reliable).
// The three products, the brand and the supplier rows are invented for this demo. Word lists are short stand-ins for the project's configs/store.yaml,
// and the demo's close shades are the two pairs the README names. The photo always yields every attribute here, so "feed only" and "missing" never occur.
// The first run's "color family" map is not in the README (only two wrongly agreeing pairs are), so "As first run" models just those two pairs.
const HEX = { pink: '#e88fb0', red: '#c0392b', burgundy: '#7a1f3d', navy: '#1f2f5c', blue: '#3b6fd8', 'light blue': '#8fc1ec', teal: '#1f8a8a', olive: '#6b7a2a', green: '#3f9a58', mustard: '#d6a419', yellow: '#f2d541', beige: '#d9c4a0', brown: '#7a5233', white: '#f4f4f4', gray: '#8c8f99', black: '#202226' };
const SYN = { nvy: 'navy', blk: 'black', 'navy blue': 'navy', grey: 'gray', charcoal: 'gray' };
const CLOSE = [['navy', 'blue'], ['olive', 'green']], FIRST = [['pink', 'burgundy'], ['light blue', 'teal']]; // FIRST: the pairs the README says the first run's family rule let through
const pair = (L, a, b) => L.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
const MAT = ['ceramic', 'porcelain', 'stoneware', 'glass', 'wood', 'steel', 'cotton', 'linen', 'bamboo'];
const NW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const BAN = [[/\b(best|finest|greatest|unbeatable)\b|#1/i, 'superlative'], [/\bguarantee[ds]?\b/i, 'guarantee'], [/\b(relieves?|cures?|heals?|pain|insomnia|stress|antibacterial|hypoallergenic)\b/i, 'medical or health claim'],
  [/\bfda\b/i, 'FDA'], [/\beco-?friendly\b|\bsustainable\b/i, 'generic green claim']];
const NEED = ['dishwasher safe', 'microwave safe', 'organic', 'recycled', 'bpa free', 'leak proof', 'made in portugal', 'handmade'];
const LATE = ['resists stains', 'stain resistant', 'breathable', 'relaxed fit', 'softens', 'zip', 'food safe', 'heat resistant']; // the README says the judge spot check led to these rules
const FLUFF = /\b(ideal for|suitable for|great for|for added comfort|everyday|lightweight|soft to the touch)\b/g;
const ATT = [['color', 'Color', 1], ['pat', 'Pattern', 1], ['pack', 'Pack size', 1], ['mat', 'Material', 0]];
const LIST = { color: Object.keys(HEX), pat: ['solid', 'stripes', 'floral'], pack: ['2', '3', '4', '5', '6'], mat: MAT };
const PR = [
  { name: 'Ashby Side Plates', n: 4, c: 'pink', pat: 'solid', mat: 'ceramic', kg: 2, cm: 20, feed: ['Pink', '', '5', ''], notes: 'Microwave safe. Best seller!! Guaranteed to last a lifetime',
    note: 'Modelled on the README’s example: a plate set sold as “Set of 5” whose photo shows four. The supplier’s notes contain claims that must never reach the copy.' },
  { name: 'Linden Dinner Plates', n: 6, c: 'light blue', pat: 'solid', mat: 'ceramic', kg: 3.6, cm: 24, feed: ['Teal', 'Solid', '6', 'Ceramic'], notes: 'Dishwasher safe. Eco-friendly and sustainable',
    note: 'A planted color error: the photo is light blue, the row says teal. The first run let exactly this kind of pair through (try “As first run”).' },
  { name: 'Moor Salad Plates', n: 3, c: 'green', paint: 'olive', c2: 'white', pat: 'stripes', mat: 'porcelain', kg: 1.2, cm: 18, feed: ['Olive', '', '3', 'Stoneware'], notes: 'Heat-resistant. Antibacterial and hypoallergenic',
    note: 'Drawn olive, read as green: the run counted 5 such misses in 64 products. Olive and green are close shades, so they agree. The photo also guesses porcelain; the row says stoneware.' },
];
const agree = (a, b, first) => a === b || pair(CLOSE, a, b) || (first && pair(FIRST, a, b));
// numbers with a unit: g, kg, cm, mm, ml, inches (also spelled out); "1,2 kg" is a decimal comma, "1,200 g" a thousands comma.
// A dimension expression such as "30 x 20 cm" is one match and every number in it is checked (the README's checker reads "8 x 11 cm" the same way).
const N1 = String.raw`(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)`;
const NUM = new RegExp(`(${N1}(?:\\s?[x\u00d7]\\s?${N1})*)\\s?(kilograms?|kg|grams?|g|centimet(?:er|re)s?|cm|millimet(?:er|re)s?|mm|millilit(?:er|re)s?|ml|inch(?:es)?|")(?![a-z])`, 'g');
const toNum = raw => (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.')) * 1;
const UN = q => /^(kg|kilo)/.test(q) ? ['g', 1000] : /^(g|gram)/.test(q) ? ['g', 1] : /^(cm|cent)/.test(q) ? ['c', 1] : /^(mm|millimet)/.test(q) ? ['c', .1] : /^(inch|")/.test(q) ? ['c', 2.54] : ['x', 0];
// a weight "per item": each/every/per/apiece followed by an item noun (not set, pack, box) in the same clause, with no set/pack/box/total between it and the number.
// A clause ends at . , ; ! ? but not at a decimal point or comma inside a number ("24.5 cm", "3,6 kg", "1,200 g").
const CLAUSE = /[.,](?!\d)|[;!?]/;
const ITEMQ = /\b(?:each|every|per)\s+(?!(?:set|pack|box|whole|entire)\b)[a-z]+|\bapiece\b/g;
const perItem = (s, i, n) => { const a = s.slice(0, i).split(CLAUSE).pop(), b = s.slice(i + n).split(CLAUSE)[0], qa = [...a.matchAll(ITEMQ)].pop();
  return (!!qa && !/\b(set|pack|box|whole|total)\b/.test(a.slice(qa.index + qa[0].length))) || [...b.matchAll(ITEMQ)].length > 0; };
const norm = (k, raw) => { let s = raw.trim().toLowerCase().replace(/\s+/g, ' '); if (k === 'color') s = SYN[s] || s; if (k === 'pat') s = s.replace(/^stripe.*/, 'stripes'); if (k === 'pack') return /^[1-9]\d?$/.test(s) ? s : ''; return LIST[k].includes(s) ? s : ''; };
const rx = (words) => new RegExp('\\b(' + [...words].sort((a, b) => b.length - a.length).join('|') + ')\\b', 'g');
const CW = rx([...Object.keys(HEX), ...Object.keys(SYN)]), MW = rx(MAT);

function photo(p) {
  const n = p.n, cols = n < 4 ? n : n === 4 ? 2 : 3, rows = Math.ceil(n / cols), W = 250, H = rows * 78 + 10, fill = HEX[p.paint || p.c], s2 = p.c2 ? HEX[p.c2] : '';
  const dots = Array.from({ length: n }, (_, i) => { const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), x = W / 2 + ((i % cols) - (inRow - 1) / 2) * 78, y = 44 + r * 78;
    return `<circle cx="${x}" cy="${y + 3}" r="35" fill="rgba(0,0,0,.18)"/><circle cx="${x}" cy="${y}" r="34" fill="${fill}"/>${p.pat === 'stripes' ? `<circle cx="${x}" cy="${y}" r="34" fill="url(#st)"/>` : ''}<circle cx="${x}" cy="${y}" r="22" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2"/>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Product photo: ${n} plates" style="width:100%;max-width:260px"><defs><pattern id="st" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="6" height="12" fill="${s2}"/></pattern></defs><rect width="${W}" height="${H}" rx="10" fill="#eceae4"/>${dots}</svg>`;
}

// The claims check: every number with a unit, pack size, color, pattern, material and claim phrase must trace to a usable fact. Banned claims fail whatever the evidence.
function check(s, p, U, first) {
  const low = s.toLowerCase(), nl = low.replace(/-/g, ' '), it = [], add = (i, w, k, ok, msg, c) => it.push({ i, w, k, c: c || (ok ? 'green' : 'red'), msg });
  const miss = (k, nm) => (U[k] ? `the usable ${nm} is ${U[k]}` : 'no usable value yet: the feed/photo conflict is still open');
  for (const [re, why] of BAN) for (const m of low.matchAll(new RegExp(re.source, 'g'))) add(m.index, m[0], 'banned', 0, `banned claim (${why}): never allowed, whatever the evidence`);
  for (const m of low.matchAll(NUM)) {
    const [kind, f] = UN(m[2]), ref = kind === 'g' ? p.kg * 1000 : p.cm, raws = m[1].match(new RegExp(N1, 'g')), bad = raws.filter(r => !(kind !== 'x' && Math.abs(toNum(r) * f - ref) <= 0.02 * ref)), ok = !bad.length, multi = raws.length > 1;
    const has = `it has Wt ${p.kg} kg for the whole set and ${p.cm} cm`;
    if (ok && kind === 'g' && !first && perItem(low, m.index, m[0].length)) add(m.index, m[0], 'number', 0, `${p.kg} kg is the weight of the whole set, not of one item`);
    else add(m.index, m[0], 'number', ok, ok ? `${multi ? 'every number in the expression ' : ''}matches the feed (${kind === 'g' ? `Wt ${p.kg} kg, the whole set` : `${p.cm} cm`})`
      : multi ? `every number of an “a x b” expression is checked: ${[...new Set(bad)].join(' and ')} ${new Set(bad).size > 1 ? 'are' : 'is'} not in the feed (${has})` : `the feed has no such number (${has})`);
  }
  for (const m of low.matchAll(/\b(?:set|pack|box) of (\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\b|\b(\d+)[- ]pack\b/g)) {
    const raw = m[1] || m[2], n = String(NW[raw] ?? raw); add(m.index, m[0], 'pack size', U.pack === n, U.pack === n ? 'matches the usable pack size' : miss('pack', 'pack size'));
  }
  for (const m of low.matchAll(CW)) { const c = SYN[m[0]] || m[0], main = !!U.color && agree(c, U.color, first), second = !main && !!p.c2 && c === p.c2;
    add(m.index, m[0], 'color', main || second, main ? `matches the usable color (${U.color})` : second ? `matches the photo’s second color (${p.c2})` : miss('color', 'color')); }
  for (const m of low.matchAll(/\b(stripe[sd]?|striped|solid|floral)\b/g)) { const k = m[0].replace(/^stripe.*/, 'stripes'); add(m.index, m[0], 'pattern', U.pat === k, U.pat === k ? 'matches the usable pattern' : miss('pat', 'pattern')); }
  for (const m of low.matchAll(MW)) {
    const ok = U.mat === m[0], why = U.mat ? `the feed says ${U.mat}${m[0] === p.mat ? '; the photo’s guess is only a hint' : ''}` : m[0] === p.mat ? 'only the photo suggests it, and a photo-only material never enters the copy' : 'the feed gives no material';
    add(m.index, m[0], 'material', ok, ok ? 'matches the feed’s material' : why);
  }
  for (const ph of [...NEED, ...(first ? [] : LATE)]) { const i = nl.indexOf(ph); if (i < 0) continue; const hit = U.facts.find(f => f.toLowerCase().replace(/-/g, ' ').includes(ph));
    add(i, ph, 'claim', !!hit, hit ? `backed by the supplier notes (“${hit}”)` : `“${ph}” is not backed by the feed${LATE.includes(ph) ? ' (a rule added after the judge spot check)' : ''}`); }
  for (const m of low.matchAll(FLUFF)) add(m.index, m[0], 'not checked', 0, 'benefit or subjective wording: no code reads it', 'amber');
  return it;
}

export default function mount(el, { esc }) {
  const $ = s => el.querySelector(s), tag = (c, s) => `<span class="tag ${c}">${s}</span>`, sm = 'font-size:13px', LB = 'display:block;font-size:13px;color:var(--muted);margin:12px 0 4px;font-weight:600';
  const put = (n, h) => { if (n._h !== h) { n._h = h; n.innerHTML = h; } }; // re-render only when the text changed, so a live region is not re-announced for nothing
  const step = (c, k, h, b) => `<div class="step ${c}" data-k="${k}" tabindex="-1"><b>${h}</b> ${b}</div>`;
  let cur = 0, first = false, res = {}, U = { facts: [] }, timer;
  const fv = i => $('#f' + i).value.trim().toLowerCase();
  const CH = [['What the spreadsheet says', p => `A set of ${fv(2)} ${fv(0)} plates, ${p.cm} cm across.`], ['What the photo shows', p => `A set of ${p.n} ${p.c} plates, ${p.cm} cm across.`],
    ['Weight per plate', p => `Each plate weighs ${p.kg} kg.`], ['Unbacked claims', () => 'Dishwasher safe ceramic plates with a glaze that resists stains.'],
    ['Supplier hype', () => 'Our best-selling plates, guaranteed to last a lifetime, are eco-friendly.'], ['Unchecked fluff', () => 'Ideal for picnics, lightweight and soft to the touch.']];
  el.innerHTML = `<p class="muted" style="margin:0 0 4px;${sm}">Pick a product, edit the supplier row, then write your own sentence for the listing.</p>
  <div class="row" id="pre" role="group" aria-label="Example product" style="margin-top:0">${PR.map((p, i) => `<button data-p="${i}" aria-pressed="false">${p.name}</button>`).join('')}</div>
  <div class="cols2"><div>
    <p id="phl" style="${LB};margin-top:0">The photo, read by a model that never sees the row</p>
    <div class="out" style="text-align:center;padding:8px" id="ph"></div>
    <p class="muted" id="pn" style="${sm};margin:6px 0 0"></p>
    <p id="srl" style="${LB}">Supplier row (editable)</p>
    <div role="group" aria-labelledby="srl" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0 10px">${ATT.map(([k, n], i) => `<div><label for="f${i}">${n} (feed)</label><input type="text" id="f${i}" list="dl${i}" placeholder="blank" autocomplete="off" spellcheck="false"><datalist id="dl${i}">${LIST[k].map(x => `<option value="${x}">`).join('')}</datalist></div>`).join('')}</div>
    <label for="nt">Supplier notes</label><input type="text" id="nt" autocomplete="off" spellcheck="false">
    <p class="muted" id="fx" style="${sm};margin:6px 0 0"></p>
  </div><div><div id="dec"></div><div id="gate" role="status" aria-live="polite"></div></div></div>
  <div class="row" role="group" aria-label="Checker version"><span class="muted" style="${sm}">Checker:</span><button data-v="0" aria-pressed="true">After the fixes</button><button data-v="1" aria-pressed="false">As first run</button></div>
  <p class="muted" id="vn" style="${sm};margin:0"></p>
  <label for="s">One sentence for the listing</label>
  <div class="row" style="margin-top:0"><input type="text" id="s" autocomplete="off" spellcheck="false" style="flex:1;min-width:200px"><button class="go" id="go">Check the sentence</button></div>
  <div class="row" id="chips" role="group" aria-label="Example sentences">${CH.map((c, i) => `<button data-c="${i}">${c[0]}</button>`).join('')}</div>
  <div id="res" role="status" aria-live="polite"></div>
  <p class="muted" style="${sm};margin:12px 0 0"><b>What this imitates.</b> Shelfwise reads each photo with a vision model that never sees the feed, decides every attribute (agree, conflict, feed only, photo only or missing), and checks the copy in code. There is no model here: the photo is a drawing and the “reading” is what it was drawn with, so it is always right. In the project’s run, one free vision model read the right main color 75.0% of the time (92.2% within the color family) and the right material 23.4%, on 64 synthetic renders drawn by the same agent that wrote the labels. The products, the brand and the supplier rows are invented for this demo, and the word lists are shorter than the project’s.</p>
  <p class="muted" style="${sm};margin:8px 0 0"><b>What is left out.</b> The model that writes the copy and its one corrective round (only described), translations, the store’s length rules, the review screen, and every claim the real checker knows beyond this demo’s list. The “feed only” and “missing” decisions never occur here, because the drawing always supplies every attribute. The real checker is also blind to what no phrase list covers, which the “Unchecked fluff” sentence shows. The row here gives one dimension per plate, so each number in an “a x b cm” expression is checked against it.</p>`;

  function cross() {
    const p = PR[cur], ph = { color: p.c, pat: p.pat, pack: String(p.n), mat: p.mat }; let open = 0;
    U = { facts: [] };
    const rows = ATT.map(([k, n, vis], i) => {
      const raw = $('#f' + i).value, f = norm(k, raw), v = ph[k], r = res[k];
      const d = !f ? 'photo only' : f === v || (k === 'color' && agree(f, v, first)) ? 'agree' : vis ? 'conflict' : 'feed wins';
      const u = d === 'agree' || d === 'feed wins' ? f : d === 'photo only' ? (vis ? v : '') : r === 'feed' ? f : r === 'photo' ? v : '';
      U[k] = u; if (d === 'conflict' && !r) open++;
      const unm = raw.trim() && !f ? ` <span class="muted">(“${esc(raw.trim())}” is not in this demo’s list, so it counts as blank)</span>` : '';
      const why = d === 'agree' ? (f === v ? '' : first && pair(FIRST, f, v) ? ' The first run counted this pair as one color family and let it agree (the demo models only the pairs the README names).' : ' Close shades agree.') : d === 'conflict' ? (r ? ` The ${r}’s value is used.` : ' Visual attribute: when the model is confident the photo’s value is suggested, and the product waits for a person.')
        : d === 'feed wins' ? ' A material is a spec: the feed wins and the photo’s guess is only a hint.' : vis ? ' The photo fills the gap.' : ' A material seen only in the photo is a hint for the reviewer and never enters the copy.';
      const rb = w => `<button data-r="${k}:${w}" aria-label="Use ${w} value for ${n}" aria-pressed="${r === w}"${r === w ? ' class="sel"' : ''}>Use ${w}</button>`, btn = d === 'conflict' ? `<br>${rb('photo')} ${rb('feed')}` : '';
      return step(d === 'agree' ? 'on' : d === 'conflict' && !r ? 'stop' : '', k, `${n}: ${tag(d === 'agree' ? 'green' : d === 'conflict' && !r ? 'red' : 'amber', d === 'conflict' && r ? 'decided by a person' : d)}`,
        `feed ${f ? `<b>${esc(f)}</b>` : 'blank'} · photo ${vis ? '' : 'guesses '}<b>${esc(v)}</b>${unm}.<span class="muted">${why}</span> ${u ? `→ usable: <b>${esc(u)}</b>` : '→ <span class="muted">not usable</span>'}${btn}`);
    });
    const st = $('#nt').value.split(/[.!;|]+/).map(x => x.trim()).filter(Boolean).map(x => [x, BAN.find(b => b[0].test(x))]);
    U.facts = st.filter(x => !x[1]).map(x => x[0]);
    const notes = step('', 'notes', 'Supplier notes:', st.length ? st.map(([x, b]) => `<br>${b ? tag('red', 'ignored') : tag('green', 'fact')} “${esc(x)}”${b ? ` <span class="muted">${b[1]}</span>` : ''}`).join('') : '<span class="muted">none</span>');
    const gate = open ? `<p class="bad" style="margin:12px 0 4px">✗ Approval refused: ${open} open feed/photo conflict${open > 1 ? 's' : ''}.</p><p class="muted" style="margin:0;${sm}">A disputed value is not a usable fact, and nothing is exported until a person decides.</p>`
      : `<p class="good" style="margin:12px 0 4px">✓ No open conflict.</p><p class="muted" style="margin:0;${sm}">In Shelfwise a person still approves each listing in the review screen, and only approved products are exported.</p>`;
    put($('#dec'), rows.join('') + notes); put($('#gate'), gate);
    $('#fx').textContent = `Also in the row, fixed in this demo: dimensions ${p.cm} cm, Wt ${p.kg} kg for the whole set.`;
  }
  function claims() {
    const s = $('#s').value.trim(), R = $('#res'); if (!s) { put(R, ''); return; }
    const it = check(s, PR[cur], U, first), bad = it.filter(x => x.c === 'red').length, soft = it.filter(x => x.c === 'amber').length; let hl = '', at = 0;
    if (s.toLowerCase().length === s.length) for (const x of [...it].sort((a, b) => a.i - b.i)) { if (x.i < at) continue; hl += esc(s.slice(at, x.i)) + tag(x.c, esc(s.slice(x.i, x.i + x.w.length))); at = x.i + x.w.length; }
    hl += esc(s.slice(at));
    const lines = it.sort((a, b) => a.i - b.i).map(x => `<div>${tag(x.c, x.k)} <b>${esc(x.w)}</b> <span class="${x.c === 'red' ? '' : 'muted'}">${x.c === 'green' ? '→ ' : ''}${esc(x.msg)}</span></div>`);
    const end = bad ? `<p class="bad" style="margin:12px 0 4px">✗ ${bad} problem${bad > 1 ? 's' : ''}.</p><p class="muted" style="margin:0;${sm}">In Shelfwise the copy model gets exactly these problems in one corrective round. If one is left, the listing cannot be approved until a person fixes it, and a reviewer can never waive an unsupported claim.</p>`
      : it.some(x => x.c === 'green') ? `<p class="good" style="margin:12px 0 4px">✓ Every statement the checker knows traces to a fact.</p><p class="muted" style="margin:0;${sm}">That means no statement of the kinds it knows is unsupported, not that no statement is.</p>`
      : soft ? '' : `<p class="warn" style="margin:12px 0 4px">! Nothing here is a kind of claim the checker reads, so nothing is flagged.</p>`;
    put(R, `<div class="out">${hl}</div><div style="margin-top:8px;font-size:14px">${lines.join('') || '<span class="muted">No numbers with units, pack sizes, colors, patterns, materials or claim phrases found.</span>'}</div>${end}`
      + (soft ? `<p class="warn" style="margin:8px 0 0;${sm}">! The amber words pass: no code checks benefit or subjective wording. In the README’s judge spot check, 38 such benefit phrases turned up in the 20 sampled listings; the README counts “lightweight” separately, as a claim that is still unchecked.</p>` : ''));
  }
  const run = () => { cross(); claims(); };
  const later = () => { clearTimeout(timer); timer = setTimeout(run, 250); };
  const now = () => { clearTimeout(timer); run(); }; // a pending row edit is applied before the sentence is checked
  function load(i) {
    cur = i; res = {}; const p = PR[i];
    p.feed.forEach((x, j) => ($('#f' + j).value = x)); $('#nt').value = p.notes; $('#ph').innerHTML = photo(p);
    $('#pn').innerHTML = `Blind reading: ${tag('', 'color: ' + p.c)}${p.c2 ? tag('', 'second color: ' + p.c2) : ''}${tag('', 'pattern: ' + p.pat)}${tag('', 'items: ' + p.n)}${tag('', 'material: ' + p.mat + ' (a guess)')}<br>${esc(p.note)}`;
    el.querySelectorAll('[data-p]').forEach(b => { const on = +b.dataset.p === i; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
    $('#s').value = CH[0][1](p); run();
  }
  function version(v) {
    first = !!v; el.querySelectorAll('[data-v]').forEach(b => { const on = +b.dataset.v === v; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
    $('#vn').textContent = first ? 'As in the first run: a color family counted as agreement, which let two planted supplier errors through (pink vs burgundy and light blue vs teal; 9 of 11 caught). The README does not list the rest of that family map, so this demo models only those two pairs. The claim phrases added after the judge spot check are unknown, and a pack’s weight stated per item is not an error. The first run also raised 2 false alarms, which this demo does not model.'
      : 'As in the final code: colors agree only when they are the same or an explicit close pair (navy and blue, olive and green), the judge spot check’s phrases are known, and a pack’s weight stated per item is an error.';
    run();
  }
  ATT.forEach(([k], i) => ($('#f' + i).oninput = () => { delete res[k]; later(); })); $('#nt').oninput = later;
  $('#dec').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; const [k, w] = b.dataset.r.split(':'); res[k] = w; now(); $(`#dec [data-r="${k}:${w}"]`)?.focus({ preventScroll: true }); };
  el.querySelectorAll('[data-p]').forEach(b => (b.onclick = () => load(+b.dataset.p)));
  el.querySelectorAll('[data-v]').forEach(b => (b.onclick = () => version(+b.dataset.v)));
  el.querySelectorAll('[data-c]').forEach(b => (b.onclick = () => { $('#s').value = CH[b.dataset.c][1](PR[cur]); now(); }));
  $('#go').onclick = now; $('#s').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) now(); });
  version(0); load(0);
}
