// Browser stand-in for Recut's cutting step, run on text: fit a model's pick to 20-60 s by whole sentences, cut in the quietest 30 ms of the silence
// before the first word and after the last, check every cut, lint the opening and ending. No audio, video or model is involved.
// Word times, pauses and audio levels are MADE UP here (Recut measures them with faster-whisper and from the audio itself). The "model" is the visitor,
// who picks sentences. The episode is fictional; it is not one of the project's test videos.
const EP = [ // [speaker, sentence, pause before it in s, quietest level in that pause in dB vs speech, where in the pause the quiet sits 0..1]
  ['S1', 'Hi everyone, welcome back to the show.', .5, -36, .5],
  ['S1', 'Today we are talking to Mara, who runs a small bike repair shop.', .55, -35, .45],
  ['S2', 'Thanks for having me, I have been fixing bikes for twelve years now.', .87, -34, .5],
  ['S1', 'So what is the one thing that surprised you most about running the shop?', .5, -37, .55],
  ['S2', 'Honestly, the biggest surprise was how much a flat tire teaches you about customers and the way they talk about their own bikes.', .8, -34, .4],
  ['S2', 'Most people do not come in for the repair, they come in because they feel stuck somewhere between home and work.', .62, -35, .5],
  ['S2', 'So I stopped quoting a price first and started asking where they ride and what they want from the ride.', .48, -33, .6],
  ['S2', 'That question changed what I sold, because riders who describe their route pick the right tire.', .55, -36, .5],
  ['S1', 'Wait, so you changed the question, not the tire?', .06, -30, .5], // S1 jumps in: a very short pause
  ['S2', 'Exactly, the tire was never the problem, the missing conversation was.', .42, -32, .5],
  ['S2', 'And nobody walks in wanting a part, they walk in wanting the ride they imagined for themselves.', .5, -31, .5],
  ['S2', 'He told me last spring that he would never ride in the rain again, and then he came in soaked on a Tuesday asking about fenders.', .6, -34, .5],
  ['S2', 'So I sold him a fender and a story about winter commuting, and he has been back every single month since then to say thanks.', .7, -9, .5], // laughter in this pause
  ['S2', 'As I said before, a part is never the product, the ride is, and the ride starts with a question about where you plan to go next weekend.', .52, -33, .5],
  ['S1', 'Mara, thank you so much for coming on the show today, and we will be right back after the short break with your questions about tires, chains and brakes', .5, -35, .5],
];
const PICKS = [['A clean pick', 5, 7], ['Too short', 5, 6], ['Cut in a tight pause', 5, 8], ['Cut on a laugh', 6, 12], ['Opens on “And”', 11, 13], ['Opens with a greeting', 1, 5], ['Ends on a question', 6, 9], ['Closing banter', 14, 15]];
const core = w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''), letters = w => w.replace(/[^\p{L}\p{N}]/gu, '').length;
function build(rows) { // made-up word times: 0.16 s + 0.045 s per letter, 30 ms between words
  let t = 0; const S = [], G = [];
  rows.forEach(([sp, text, pause, db, c]) => {
    G.push({ a: t, b: t + pause, db, c }); t += pause;
    const words = text.split(/\s+/).map(w => { const o = { w, a: t, b: t + .16 + .045 * letters(w) }; t = o.b + .03; return o; });
    t -= .03; S.push({ sp, text, words, a: words[0].a, b: t });
  });
  G.push({ a: t, b: t + .6, db: -38, c: .5 }); // G[k] = the pause before sentence k, G[n] = after the last one
  return { S, G, W: S.flatMap(s => s.words) };
}
// A pause is cut into 30 ms slices; the made-up level is lowest at `c` and rises towards the words on both sides.
const slices = g => { const n = Math.max(1, Math.floor((g.b - g.a) / .03 + 1e-6)); return Array.from({ length: n }, (_, k) => g.db + Math.round(22 * Math.abs((k + .5) / n - g.c))); };
const quietest = g => { const v = slices(g), k = v.indexOf(Math.min(...v)); return { k, v, db: v[k], t: g.a + (k + .5) * (g.b - g.a) / v.length }; };
function probe(M, t) { // what Recut's cut checks see at time t
  const inside = M.W.find(w => t > w.a && t < w.b), g = M.G.find(g => t >= g.a && t <= g.b), v = g && slices(g);
  return { inside, near: Math.min(...M.W.flatMap(w => [Math.abs(t - w.a), Math.abs(t - w.b)])), db: inside ? 0 : v ? v[Math.min(v.length - 1, Math.floor((t - g.a) / (g.b - g.a) * v.length))] : -20 };
}
function plan(M, i, j) { // the snapper: whole sentences only, 20-60 s; too short grows forward then back, too long drops from the end (the demo's own rules)
  const ci = k => quietest(M.G[k]), co = k => quietest(M.G[k + 1]), len = () => co(j).t - ci(i).t, L0 = len(), add = [], drop = [];
  while (len() < 20 && (j < M.S.length - 1 || i > 0)) add.push(j < M.S.length - 1 ? ++j + 1 : --i + 1);
  while (len() > 60 && j > i) drop.push(j-- + 1);
  const back = add.filter(n => drop.includes(n)); // added, then dropped again because it pushed the clip past 60 s
  return { i, j, L0, L: len(), add: add.filter(n => !back.includes(n)), drop: drop.filter(n => !back.includes(n)), back, ci: ci(i), co: co(j) };
}
// Lint on the first sentence, the last sentence and the clip text. Word lists: README names And, So, He, That, "as I said", greetings, questions, no full stop; the rest is the demo's.
const CONN = /^(and|so|but|because|or|then)\b/i, PRON = /^(he|she|they|that|this|these|those)\b/i, HELLO = /^(hi|hello|hey|welcome|good (morning|afternoon|evening))\b/i, SAID = /\bas i (said|mentioned)\b/i;
function lint(texts) {
  const a = texts[0].replace(/^[^\p{L}\p{N}]+/u, ''), z = texts[texts.length - 1].trim(), w = (a.match(/^[\p{L}']+/u) || [''])[0], out = [];
  if (CONN.test(a)) out.push(`opens with “${w}”: may continue a thought from before the clip`);
  if (PRON.test(a)) out.push(`opens with “${w}”: a pronoun with nothing before it to point at`);
  if (HELLO.test(a)) out.push('opens with a greeting');
  if (SAID.test(texts.join(' '))) out.push('says “as I said”: points at something outside the clip');
  if (/\?["”')]*$/.test(z)) out.push('ends on a question');
  else if (!/[.!]["”')]*$/.test(z)) out.push('ends without a full stop');
  return out;
}
const hash = s => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const CAP = 400; // characters per line; a longer line is cut at a word boundary and keeps its own final . ! or ? so the ending lint still judges what you wrote
const parse = txt => { // your own lines: pauses 0.3-0.9 s and levels -40..-29 dB are derived from the text
  const raw = txt.split('\n').map(l => l.trim()).filter(Boolean); let cut = 0;
  const rows = raw.slice(0, 60).map(l => {
    const m = l.match(/^(S\d+):\s*(.*)$/); let s = m ? m[2] : l;
    if (s.length > CAP) { cut++; s = s.slice(0, CAP).replace(/\s+\S*$/, '').trimEnd() + (s.match(/[.!?]["”')]*$/) || [''])[0]; }
    const h = hash(s);
    return [m ? m[1] : 'S1', s, .3 + (h % 7) * .1, -40 + ((h >>> 4) % 12), .3 + ((h >>> 8) % 5) * .1]; // >>> not >>: the hash is unsigned, a signed shift would turn hashes of 2^31 and up negative
  }).filter(r => r[1]);
  return Object.assign(rows, { cut, extra: Math.max(0, raw.length - 60) });
};

export default function mount(el, { esc }) {
  const $ = s => el.querySelector(s);
  const tag = (c, s) => `<span class="tag ${c}">${s}</span>`;
  const list = a => { // sentence numbers as runs of consecutive ones, ascending: [11, 12, 9, 8, 7, 6] -> "6 to 9 and 11 to 12" (a growing pick can add on both sides)
    const runs = []; [...a].sort((x, y) => x - y).forEach(n => { const l = runs[runs.length - 1]; if (l && n === l[1] + 1) l[1] = n; else runs.push([n, n]); });
    if (runs.length === 1 && runs[0][1] === runs[0][0] + 1) return `${runs[0][0]} and ${runs[0][1]}`;
    const t = runs.map(([x, y]) => x === y ? `${x}` : `${x} to ${y}`);
    return t.length > 2 ? `${t.slice(0, -1).join(', ')} and ${t[t.length - 1]}` : t.join(' and ');
  }, f1 =x => x.toFixed(1), f2 = x => x.toFixed(2), dB = d => `${d < 0 ? '−' : ''}${Math.abs(d)} dB`;
  const rng = (a, b) => a === b ? `sentence ${a + 1}` : `sentences ${a + 1} to ${b + 1}`, mmss = x => { const q = Math.round(x * 10); return `${String(Math.floor(q / 600)).padStart(2, '0')}:${((q % 600) / 10).toFixed(1).padStart(4, '0')}`; };
  const step = (c, who, h, b) => `<div class="step ${c}">${tag(who === 'model' ? 'amber' : who === 'you' ? '' : 'green', who)} <b>${h}</b><br>${b}</div>`;
  const sel = 'flex:1 1 220px;min-width:0';
  const field = 'width:100%;font:inherit;font-size:16px;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:var(--code);color:var(--fg)';
  let M = build(EP), mine = false;

  el.innerHTML = `<p class="muted" style="margin:0 0 6px;font-size:14px">The model answers with a range of sentence numbers, never with times. Pick an example or set the range yourself.</p>
  <div class="row" id="chips" role="group" aria-label="Example picks">${PICKS.map((p, i) => `<button data-p="${i}" aria-pressed="false">${p[0]}</button>`).join('')}</div>
  <div class="row" style="align-items:flex-end"><div style="${sel}"><label for="a">First sentence of the pick</label><select id="a" style="${field}"></select></div><div style="${sel}"><label for="b">Last sentence of the pick</label><select id="b" style="${field}"></select></div></div>
  <div class="cols2"><div id="res" role="status" aria-live="polite"></div><div><label id="trl">Made-up episode, no audio (word times and levels are invented)</label><div class="out" id="tr" role="group" aria-labelledby="trl"></div></div></div>
  <label for="mine">Or paste your own transcript: one sentence per line, up to 60 lines of 400 characters each (optional “S2:” prefix)</label>
  <textarea id="mine" spellcheck="false" placeholder="And this is the part I always forget to mention.&#10;He sent it back twice before we figured out why."></textarea>
  <div class="row"><button class="go" id="use">Use my transcript</button><button id="back">Back to the made-up episode</button></div>
  <p class="muted" id="note" role="status" aria-live="polite" style="font-size:13px;margin:0"></p>
  <p class="muted" style="font-size:13px;margin:10px 0 0"><b>What this imitates.</b> Recut’s snapper and standalone lint, on text. In Recut the model also returns a title, the hook, why the clip works and scores for hook, payoff, standalone, clarity and virality; there is no model here, so none of that. Your own transcript gets made-up word times (0.16 s + 0.045 s per letter), pauses of 0.3-0.9 s and levels of −40 to −29 dB, so only the lint and the clip length come from what you write; the pauses and levels are made up from a hash of each line. Lines over 400 characters are cut at a word boundary and keep their final . ! or ?. The lint’s word lists are mine except the ones the README names (And, So, He, That, “as I said”, greetings, questions, no full stop); the README shows a too-short pick growing by one later sentence (“add sentence 48”) and says only that code fits each pick “to 20-60 s by whole sentences”, so growing backward once the last sentence is reached, and trimming a too-long pick from the end, are the demo’s own rules. Nothing is rendered: no framing, no captions, no -14 LUFS.</p>
  <p class="muted" style="font-size:13px;margin:8px 0 0"><b>What the project measured.</b> Across 13 videos, 0 of 96 model-picked cut points fell inside a word by Whisper’s word times (the snapper also works from those times, and the rule baseline scored 0 of 102 too); transcribing the 48 rendered clips again found the first and last word intact in 47 of 48. 3 cut points were within 30 ms of a word and 7 were on audio louder than −12 dB vs speech (the median cut sat at −37 dB). Lint warnings hit 23% of the model’s clips. These numbers are not produced by this demo.</p>`;

  const fillSel = () => ['a', 'b'].forEach((id, n) => { $('#' + id).innerHTML = M.S.map((s, k) => `<option value="${k}">${k + 1} · ${esc(s.text.slice(0, 34))}${s.text.length > 34 ? '…' : ''}</option>`).join(''); });
  const pickChip = on => el.querySelectorAll('[data-p]').forEach(b => { const s = +b.dataset.p === on; b.classList.toggle('sel', s); b.setAttribute('aria-pressed', s); });

  function run(pi = -1) {
    let i = +$('#a').value, j = +$('#b').value;
    if (i > j) [i, j] = [j, i];
    $('#a').value = i; $('#b').value = j; pickChip(pi);
    const r = plan(M, i, j), S = M.S, texts = S.slice(r.i, r.j + 1).map(s => s.text);
    const chk = (name, q) => { const p = probe(M, q.t), ms = Math.round(p.near * 1000), bits = [];
      if (p.inside) return ['red', `${name} ${f2(q.t)} s lands inside the word “${esc(core(p.inside.w))}”`];
      if (p.near < .03) bits.push(`only ${ms} ms from the nearest word (limit 30 ms)`);
      if (p.db > -12) bits.push(`on loud audio, ${dB(p.db)} vs speech (limit −12 dB)`);
      return bits.length ? ['amber', `${name} ${f2(q.t)} s: ${bits.join('; ')}`] : ['green', `${name} ${f2(q.t)} s: in silence, ${ms} ms from the nearest word, ${dB(p.db)} vs speech`]; };
    const checks = [chk('cut-in', r.ci), chk('cut-out', r.co)], bars = (q, g, what) => `<div class="muted" style="font-size:12px;margin-top:6px">${what}: a ${f2(g.b - g.a)} s pause, ${q.v.length} slice${q.v.length > 1 ? 's' : ''}</div><div role="img" aria-label="Loudness of the 30 ms slices of the pause ${what}; the quietest is at ${f2(q.t)} s" style="display:flex;align-items:flex-end;gap:1px;height:30px;margin:2px 0">${q.v.map((d, k) => `<i style="flex:1 1 0;max-width:14px;min-width:2px;height:${4 + (45 + Math.max(-45, d)) * .58}px;background:${k !== q.k ? 'var(--muted)' : d > -12 ? 'var(--warn)' : 'var(--accent2)'};opacity:${k === q.k ? 1 : .4}"></i>`).join('')}</div>`;
    const finds = [...checks.filter(c => c[0] !== 'green').map(c => [c[0], c[1]]), ...lint(texts).map(m => ['amber', m])];
    if (r.L < 20 || r.L > 60) finds.push(['red', `length ${f1(r.L)} s is outside 20-60 s`]);
    const errs = finds.filter(f => f[0] === 'red').length;
    const short = r.L < 20, long = r.L > 60, bits = [], pl = a => `sentence${a.length > 1 ? 's' : ''} ${list(a)}`; // short/long: still outside 20-60 s after fitting
    if (r.add.length) bits.push(`added ${pl(r.add)}`);
    if (r.drop.length) bits.push(`dropped ${pl(r.drop)} from the end`);
    if (r.back.length) bits.push(`left out ${pl(r.back)} because adding it would pass 60 s`);
    const why = short ? (r.back.length ? 'the next sentence would pass 60 s' : 'there is no sentence left to add') : 'a single sentence cannot be trimmed';
    const fit = `${f1(r.L0)} s is ${r.L0 < 20 ? 'too short' : r.L0 > 60 ? 'too long' : 'inside 20-60 s'}`
      + (bits.length ? `: ${bits.join(', ')}. Now ${rng(r.i, r.j)}, ${f1(r.L)} s.` : short || long ? '.' : ': kept as picked.')
      + (short || long ? ` ${bits.length ? 'Still' : 'So it is'} ${short ? 'under 20 s' : 'over 60 s'}: ${why}, so this pick cannot be fitted to 20-60 s.` : '');
    // The comparison: the same sentences cut at their start and end times rounded to whole seconds, standing in for a model that answers in timestamps.
    const nv = [['cut-in', Math.round(S[r.i].a)], ['cut-out', Math.round(S[r.j].b)]].map(([n, t]) => ({ n, t, p: probe(M, t) })), split = new Map();
    nv.forEach(x => x.p.inside && split.set(x.p.inside, (x.t - x.p.inside.a) / (x.p.inside.b - x.p.inside.a)));
    const nvLine = x => x.p.inside ? `${tag('red', 'inside a word')} ${x.n} ${x.t} s cuts “${esc(core(x.p.inside.w))}” in two`
      : `${tag(x.p.near < .03 || x.p.db > -12 ? 'amber' : 'green', 'in a gap')} ${x.n} ${x.t} s falls in a pause (${x.p.near < .03 ? 'only ' + Math.round(x.p.near * 1000) + ' ms from a word' : dB(x.p.db)}), this time`;
    $('#res').innerHTML =
      step('on', 'model', `Your pick: ${rng(Math.min(i, j), Math.max(i, j))}`, `<span class="muted">Sentence numbers only. Recut’s code turns them into times.</span>`)
      + step(bits.length || short || long ? 'stop' : 'on', 'code', 'Fit to 20-60 s by whole sentences', fit)
      + step('on', 'code', 'Cut in the quietest 30 ms of the pause', `<span class="muted">Each bar is a 30 ms slice of the pause (made-up levels); the lit one is the cut.</span>${bars(r.ci, M.G[r.i], 'before the first word')}${bars(r.co, M.G[r.j + 1], 'after the last word')}`)
      + step(checks.some(c => c[0] !== 'green') ? 'stop' : 'on', 'code', 'Check every cut', checks.map(c => `<div>${tag(c[0], c[0] === 'green' ? 'ok' : c[0] === 'red' ? 'error' : 'warning')} ${c[1].replace(/^(cut-\w+) /, '<b>$1</b> ')}</div>`).join(''))
      + step(lint(texts).length ? 'stop' : 'on', 'code', 'Standalone lint', lint(texts).length ? lint(texts).map(m => `<div>${tag('amber', 'warning')} ${m}</div>`).join('') + '<span class="muted">Flagged, ranked lower and shown to the reviewer. A model asked whether its own pick stands alone says yes almost every time, which is why this is plain code.</span>' : `${tag('green', 'ok')} <span class="muted">Nothing flagged in the opening, the ending or the text.</span>`)
      + step('', 'you', 'Review screen', errs ? `${tag('red', 'error')} ${finds.filter(f => f[0] === 'red').map(f => f[1]).join('; ')}: approving needs an explicit force.` : finds.length ? `${finds.length} warning${finds.length > 1 ? 's' : ''} shown next to the clip. A person trims, fixes a caption word and approves. Not in this demo: nothing is rendered or downloadable.` : 'No findings. A person still has to approve: nothing can be downloaded before that. Not in this demo: nothing is rendered.')
      + `<div class="out" style="margin-top:10px"><b>Same sentences, cut by timestamps instead</b> <span class="muted">(a stand-in for a model that answers in times: each is the sentence’s time rounded to a whole second)</span><br>${nv.map(nvLine).join('<br>')}<br><span class="muted">Whole-second rounding sometimes lands in a pause and sometimes not; try other picks. This is not a measurement of any model. Recut never asks for times: its cuts go in the quietest 30 ms of a pause, and by Whisper’s word times none of the 96 model-picked cuts landed inside a word. Whisper’s word times are also what the snapper starts from, so that is not an independent check; a mid-word cut would still be an error that needs an explicit force to approve.</span></div>`;
    const cutLine = (n, q, c) => `<div style="padding:2px 6px;font-size:13px" class="${c[0] === 'green' ? 'good' : 'warn'}">✂ ${n} ${f2(q.t)} s · ${dB(q.db)} vs speech</div>`;
    $('#tr').innerHTML = S.map((s, k) => {
      const inC = k >= r.i && k <= r.j, words = s.words.map(w => { if (!split.has(w)) return esc(w.w); const c = core(w.w), n = Math.min(Math.max(c.length - 1, 1), Math.max(1, Math.round(split.get(w) * c.length))), at = w.w.indexOf(c) + n; return `${esc(w.w.slice(0, at))}<b class="bad" role="img" aria-label="mid-word cut" title="timestamp cut" style="background:color-mix(in srgb,var(--bad) 30%,transparent);border-radius:3px;padding:0 2px">✂</b>${esc(w.w.slice(at))}`; }).join(' ');
      return (k === r.i ? cutLine('cut-in', r.ci, checks[0]) : '') + `<div style="padding:4px 6px;margin:2px 0;border-radius:6px;${inC ? 'background:color-mix(in srgb,var(--accent2) 14%,transparent)' : ''}"><span class="muted">[${k + 1}] ${mmss(s.a)} ${s.sp}</span> ${r.add.includes(k + 1) ? tag('amber', 'added') : r.drop.includes(k + 1) ? tag('', 'dropped') : ''} ${words}</div>` + (k === r.j ? cutLine('cut-out', r.co, checks[1]) : '');
    }).join('');
  }

  fillSel();
  const usePick = n => { const [, a, b] = PICKS[n]; $('#a').value = a - 1; $('#b').value = b - 1; run(n); };
  $('#chips').onclick = e => { const b = e.target.closest('button'); if (b && !mine) usePick(+b.dataset.p); };
  $('#a').onchange = $('#b').onchange = () => run();
  $('#use').onclick = () => {
    const rows = parse($('#mine').value);
    if (!rows.length) return $('#mine').focus();
    M = build(rows); mine = true; fillSel(); $('#a').value = 0; $('#b').value = Math.min(rows.length - 1, 3); $('#chips').style.display = 'none'; // .dm .row sets display:flex, which beats [hidden]
    const notes = [rows.cut && `${rows.cut} line${rows.cut > 1 ? 's' : ''} over ${CAP} characters ${rows.cut > 1 ? 'were' : 'was'} cut at a word boundary (the final . ! or ? was kept).`, rows.extra && `Only the first 60 lines were used; ${rows.extra} more ${rows.extra > 1 ? 'were' : 'was'} left out.`].filter(Boolean);
    $('#note').textContent = notes.join(' '); run();
  };
  $('#back').onclick = () => { M = build(EP); mine = false; fillSel(); $('#chips').style.display = ''; $('#note').textContent = ''; usePick(0); };
  usePick(0);
}
