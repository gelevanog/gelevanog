// Browser imitation of three of Notewell's deterministic guards on an INVENTED visit and a HAND-WRITTEN draft note. No model, no network.
// Not a medical device. Simplified on purpose (also stated on the page): the project checks verbatim quotes, 94 concepts and 177 drugs;
// this demo uses word overlap, 7 concepts and 6 drugs, and has no dose limits. It does not check codes, E/M levels or the after-visit summary.
const T = [ // [speaker, text]; the turn number is the index + 1
  ['Clinician', 'Good morning, Mr. Heller. This is your blood pressure follow-up, right?'],
  ['Patient', 'Yes. My date of birth is March 4, 1961, in case you need it for the form.'],
  ['Clinician', 'How is the blood pressure medicine going?'],
  ['Patient', 'I take lisinopril 10 milligrams every morning. No wait, it was raised to 20 milligrams.'],
  ['Patient', 'And levothyroxine, 75 micrograms, for my thyroid.'],
  ['Clinician', 'Any chest pain?'],
  ['Patient', 'No, none.'],
  ['Clinician', 'Any shortness of breath or dizziness?'],
  ['Patient', 'A little breathless on the stairs. And the room kind of swims when I stand up fast.'],
  ['Clinician', 'Any numbness in your feet?'],
  ['Patient', 'No, nothing like that.'],
  ['Patient', 'My father had a heart attack at 58, if that matters.'],
  ['Clinician', 'Your blood pressure today is 148 over 92.'],
  ['Patient', 'My neighbor Royal drives me on Tuesdays. You can reach me at 555-0142.'],
];
const ORIG = [ // [section, line, cited turns]
  ['S', 'Takes lisinopril 20 mg every morning.', [4]], ['S', 'Takes levothyroxine 75 mcg.', [5]], ['S', 'Denies chest pain.', [6, 7]],
  ['S', 'Reports shortness of breath on stairs.', [9]], ['S', 'Reports dizziness when standing up fast.', [9]], ['S', 'Denies numbness in the feet.', [10, 11]],
  ['S', 'Father had a heart attack at age 58.', [12]], ['O', 'Blood pressure 148/92.', [13]],
];
const P = [ // [button, row, corrupted line, what the README reports for this kind of corruption]
  ['Change a number', 7, 'Blood pressure 184/92.', 'In the project’s test (not this demo) of 236 deliberately corrupted notes, a changed number was caught in 96.6% of 29 trials.'],
  ['Dose ×10', 0, 'Takes lisinopril 200 mg every morning.', 'In the project’s test (not this demo), a dose multiplied by 10 was caught in 96.7% of 30 trials. This demo only knows that nobody said 200; the project also checks per-dose and daily maximums, which the demo leaves out.'],
  ['Swap the unit', 1, 'Takes levothyroxine 75 mg.', 'In the project’s test (not this demo), a swapped dose unit (mg and mcg) was caught in 100% of 26 trials.'],
  ['Uncorrected dose', 0, 'Takes lisinopril 10 mg every morning.', 'The README’s own example of a fluent but wrong note: “10 milligrams, no wait, 20” becomes 10. The number 10 was said, so a plain number check passes. Here the correction check is what catches it.'],
  ['Flip a denial', 2, 'Reports chest pain.', 'In the project’s test (not this demo), “Denies X” flipped to “Reports X” was caught in only 53.1% of 32 trials (46.9% before two concepts seen in the misses were added): the hardest corruption. Chest pain is in this demo’s lexicon, so this demo catches it.'],
  ['Flip a denial it lacks', 5, 'Reports numbness in the feet.', 'This one gets through on purpose. The negation guard only knows the findings in its lexicon, and numbness is not in this demo’s seven. The project’s lexicon has 94 concepts with lay synonyms and still caught only 53.1% in its test; its README names flips of “no oozing or crusting” and “warts don’t hurt” as unnoticed. You are the guard now: read turns 10 and 11.'],
  ['Wrong person', 6, 'Had a heart attack at age 58.', 'A relative’s condition stated as the patient’s (the README’s other example: the father’s heart attack becomes the patient’s). In the project’s main run with the free model this kind of trap error (family history, hypotheticals and the like) happened 0 times in 91, on synthetic data; the second free model tried made 2 of 91, and the rule-based baseline 6 of 91.'],
  ['Invented line', 3, 'Rash on both forearms for two weeks.', 'A line that is not in the conversation. The project tested something different (not this demo): objective or assessment lines copied from another specialty’s visit were caught in 90.6% of 32 trials, and the misses were generic lines that happen to be true in the other visit too. This demo’s line is simply invented.'],
];
const DRUGS = { lisinopril: 'mg', levothyroxine: 'mcg', metformin: 'mg', atorvastatin: 'mg', amlodipine: 'mg', aspirin: 'mg' }; // drug -> its dose unit
const LEX = [['chest pain', /chest (pain|pressure|tightness)/i], ['shortness of breath', /short(ness)? of breath|breathless/i], ['dizziness', /dizz|lightheaded|room (kind of )?swims|woozy/i],
  ['cough', /cough/i], ['headache', /headache/i], ['nausea', /nause|queasy/i], ['palpitations', /palpitat|heart (racing|pounding)/i]];
const FAM = /\b(father|mother|dad|mom|brother|sister|grandfather|grandmother|uncle|aunt|son|daughter|wife|husband)\b/i;
const STOP = new Set('takes reports denies with that this from have been when your were what does there about they also into than then some'.split(' '));
const words = s => (s.toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !STOP.has(w)).map(w => w.slice(0, 5));
const nums = s => s.toLowerCase().replace(/(\d+)\s*(?:over|\/)\s*(\d+)/g, '$1/$2').match(/\d+(?:\/\d+)?/g) || [];
const REG = [[/\b(?:Mr\. )?Heller\b/g, '[PATIENT]'], [/March 4, 1961/g, '[DOB]'], [/555-0142/g, '[PHONE_1]']]; // the registered identifiers of the invented patient
const mask = tx => REG.reduce((s, [re, ph]) => s.replace(re, ph), tx);

// What the cited turns say about a finding: 'denied' or 'present' (a clinician's question is read together with the answer that follows it).
function said(re, cites) {
  for (const n of cites) {
    const [who, tx] = T[n - 1], m = re.exec(tx); if (!m) continue;
    if (who === 'Clinician') { if (!tx.endsWith('?') || !T[n]) continue; return [/^(no|nope|none|not)\b/i.test(T[n][1]) ? 'denied' : 'present', n + 1]; }
    return [/\b(no|not|never|denies|without|nothing)\b[^.]*$/i.test(tx.slice(0, m.index)) ? 'denied' : 'present', n];
  }
  return null;
}
// The three guards. Each flag is { g: guard index, lvl: 'error' | 'check', msg }.
function check(s, cites) {
  const F = [], cited = cites.map(n => T[n - 1][1]), at = cites.join(', '), add = (g, lvl, msg) => F.push({ g, lvl, msg });
  const ws = words(s), cw = new Set(cited.flatMap(words)), hit = ws.filter(w => cw.has(w)).length, drugs = Object.keys(DRUGS).filter(d => new RegExp(d, 'i').test(s)), seen = [];
  // 1 Grounding: the line must be about what the cited turns say; its numbers and drug names must have been said there.
  if (!s.trim()) add(0, 'check', 'The line is empty, so there is nothing to ground.');
  else if (!ws.length) add(0, 'check', `No content word (four letters or more, not filler such as “takes” or “denies”) to compare with the cited turn${cites.length > 1 ? 's' : ''} ${at}, so this demo could not ground the line${nums(s).length || drugs.length ? `; its ${[nums(s).length && 'numbers', drugs.length && 'drug names'].filter(Boolean).join(' and ')} were still checked` : ''}.`);
  else if (hit * 2 < ws.length) {
    const best = T.map((t, i) => [ws.filter(w => words(t[1]).includes(w)).length, i + 1]).filter(b => !cites.includes(b[1])).sort((a, b) => b[0] - a[0])[0];
    if (best && best[0] >= 2 && best[0] * 2 >= ws.length) add(0, 'check', `Most of this line is not in the cited turn ${at}, but turn ${best[1]} fits it: the citation would move there.`);
    else add(0, 'error', `Unsupported: most words of this line are not in the cited turn ${at}, and no other turn fits them.`);
  }
  const cn = new Set(cited.flatMap(nums));
  for (const n of nums(s)) if (!cn.has(n)) add(0, 'error', `The number ${n} was not said in the cited turn ${at}.`);
  for (const d of drugs) if (!cited.some(c => new RegExp(d, 'i').test(c))) add(0, 'error', `${d} was not said in the cited turn ${at}.`);
  // 2 Negation and attribution: the line must keep the polarity of the finding, and must not move a relative's condition onto the patient.
  for (const [name, re] of LEX) {
    const m = re.exec(s), pol = m && said(re, cites); if (!pol) continue;
    const denied = /\b(denies|no|not|without|negative)\b[^.]*$/i.test(s.slice(0, m.index)); seen.push(name);
    if (denied !== (pol[0] === 'denied')) add(1, 'error', `The line ${denied ? 'denies' : 'reports'} ${name}, but turn ${pol[1]} (“${T[pol[1] - 1][1]}”) says it was ${pol[0]}.`);
  }
  for (const n of cites) { const tx = T[n - 1][1], f = FAM.exec(tx);
    if (f && !FAM.test(s) && words(s).some(w => words(tx).includes(w))) add(1, 'error', `Turn ${n} is about the patient’s ${f[1].toLowerCase()}, but the line states it as the patient’s.`); }
  // 3 Medications: the unit must fit the drug; a dose the patient corrected must not come back uncorrected.
  for (const d of drugs) {
    const u = new RegExp(`${d}\\D{0,15}?\\d+(?:\\.\\d+)?\\s*(mg|mcg|g)\\b`, 'i').exec(s);
    if (u && u[1].toLowerCase() !== DRUGS[d]) add(2, 'error', `${d} is dosed in ${DRUGS[d]} in this demo’s drug list, so “${u[1]}” is an impossible unit.`);
  }
  for (const n of cites) {
    const tx = T[n - 1][1], i = tx.search(/no,? wait|actually|i mean|sorry/i); if (i < 0) continue;
    const b = nums(tx.slice(0, i)), a = nums(tx.slice(i));
    for (const x of nums(s)) {
      if (b.includes(x) && !a.includes(x)) add(2, 'error', `${x} is the dose from before the patient corrected it (turn ${n}: ${b} → ${a}).`);
      else if (a.includes(x) && !b.includes(x)) add(2, 'check', `A dose was corrected during the conversation (turn ${n}: ${b} → ${a}). A clinician should confirm ${x} is the final one.`);
    }
  }
  const info = [`${hit} of ${ws.length} content words appear in the cited turn${cites.length > 1 ? 's' : ''}${nums(s).length ? `; numbers ${nums(s).join(', ')} checked` : ''}${drugs.length ? `; drug ${drugs.join(', ')} checked` : ''}.`,
    seen.length ? `Findings checked: ${seen.join(', ')}.` : `No finding from this demo’s ${LEX.length}-concept lexicon in this line, so nothing was checked here.`,
    drugs.length ? `Drugs checked: ${drugs.join(', ')} (unit and corrected doses only; this demo has no dose limits).` : 'No drug from this demo’s list in this line.'];
  return { F, info };
}

export default function mount(el, { esc }) {
  const $ = s => el.querySelector(s), tag = (c, s) => `<span class="tag ${c}">${s}</span>`;
  const err = f => f.some(x => x.lvl === 'error'), G = ['1 · Grounding', '2 · Negation and attribution', '3 · Medications'];
  let note, sel = 0, cur = -1, masked = false, timer, lastV = '';
  const reset = () => { note = ORIG.map(([sec, text, cites]) => ({ sec, text, cites })); cur = -1; };
  el.innerHTML = `<div class="share" role="note" style="margin:0 0 14px"><b class="warn">Not a medical device. Demo only, not for clinical use.</b> The visit, the patient and the draft note below are invented for this demo, and the draft was written by hand, not by a model. Nothing here is medical advice, and no number on this page is a clinical accuracy figure.</div>
  <div class="cols2"><div>
    <p class="muted" style="margin:0 0 4px;font-size:14px">Corrupt a line of the draft note, or select a line and type your own edit.</p>
    <div class="row" id="pre" role="group" aria-label="Ready-made corruptions" style="margin-top:0">${P.map((p, i) => `<button data-p="${i}" aria-pressed="false">${p[0]}</button>`).join('')}</div>
    <div id="note" role="group" aria-label="Draft note, excerpt"></div>
    <label for="ed">Selected line (edit it)</label>
    <div class="row"><input type="text" id="ed" autocomplete="off" spellcheck="false"><button id="rs">Reset note</button></div>
    <div id="res"></div><div id="vd" role="status" aria-live="polite"></div><div id="rt"></div>
  </div><div>
    <b id="tl" style="display:block;font-size:13px;color:var(--muted);margin:12px 0 4px">Visit transcript (invented, English only)</b>
    <div class="row" style="margin:4px 0"><label class="switch" style="margin:0;font-weight:400"><input type="checkbox" id="mk"> What the AI sees (identifiers masked)</label></div>
    <div class="out" id="tr" role="group" aria-labelledby="tl" style="white-space:normal"></div>
    <p class="muted" id="mn" style="font-size:13px"></p>
  </div></div>
  <p class="muted" style="font-size:13px;margin-top:14px"><b>What this imitates.</b> Three of Notewell’s deterministic guards, each much smaller: grounding (here: word overlap with the cited turns, plus numbers and drug names said there; the project checks verbatim quotes), negation and attribution (here: ${LEX.length} concepts; the project has 94 with lay synonyms) and medications (here: ${Object.keys(DRUGS).length} drugs, units and corrected doses; the project has 177 drugs with per-dose and daily maximums). Not here: ICD-10-CM and E/M checks, the after-visit summary check, speech recognition, and the model that drafts the note. The 8 lines are an excerpt, not a full SOAP note.</p>
  <p class="muted" style="font-size:13px"><b>Masking, simplified.</b> The masked view replaces only the three registered values of the invented patient (name, date of birth, phone). Notewell also uses patterns, name lists and cue phrases, and on unseen phrasing its detector found 79% of identifiers (134 of 169). That is why every outgoing request is checked again for the registered ones, and one that still contains any is not sent.</p>`;
  const render = () => {
    const all = note.map(n => check(n.text, n.cites)), r = all[sel], n = note[sel];
    $('#note').innerHTML = note.map((x, i) => { const f = all[i].F;
      return `<button data-i="${i}" aria-pressed="${i === sel}" class="${i === sel ? 'sel' : ''}" style="display:block;width:100%;text-align:left;margin:4px 0"><span class="tag">${x.sec}</span> ${esc(x.text) || '(empty)'} <span class="muted" style="font-size:12px">· turn ${x.cites.join(', ')}</span> ${err(f) ? tag('red', 'error') : f.length ? tag('amber', 'check') : tag('green', 'no flag')}</button>`; }).join('');
    $('#tr').innerHTML = T.map(([who, tx], i) => {
      let h = esc(masked ? mask(tx) : tx);
      if (masked) h = h.replace(/\[(PATIENT|DOB|PHONE_1)\]/g, '<span class="tag green">[$1]</span>').replace('Royal', '<mark>Royal</mark>');
      return `<div style="padding:3px 6px;margin:2px 0;border-radius:6px${n.cites.includes(i + 1) ? ';background:color-mix(in srgb,var(--accent2) 14%,transparent)' : ''}"><span class="muted">${i + 1} · ${who}</span><br>${h}</div>`; }).join('');
    $('#mn').innerHTML = masked ? '<mark>Royal</mark> is highlighted by this demo: here it is not masked, because the name is not registered and this simple masker has no cue rules. The project’s own held-out misses include ordinary-word names such as “Royal and I got married young”; the project may or may not mask this exact phrase.' : 'The lines cited by the selected note line are shaded.';
    const steps = G.map((h, g) => { const f = r.F.filter(x => x.g === g);
      return `<div class="step ${f.length ? 'stop' : 'on'}"><b>${h}</b> ${f.length ? f.map(x => `<div>${tag(x.lvl === 'error' ? 'red' : 'amber', x.lvl)} ${esc(x.msg)}</div>`).join('') : `<span class="good">✓</span> <span class="muted">${esc(r.info[g])}</span>`}</div>`; }).join('');
    const quotes = n.cites.map(c => `turn ${c} · ${T[c - 1][0]}: “${esc(T[c - 1][1])}”`).join('<br>');
    const E = all.filter(a => err(a.F)).length, C = all.filter(a => a.F.length && !err(a.F)).length;
    const ln = `Line ${sel + 1} · `, orig = n.text === ORIG[sel][1];
    const [vc, vt] = err(r.F) ? ['bad', '✗ Flagged in red. In Notewell the clinician would have to fix it or explicitly acknowledge it.']
      : orig ? (r.F.length ? ['warn', 'The original line carries a check for the clinician.'] : ['good', '✓ The original line is supported by the cited turns.'])
      : r.F.length ? ['warn', 'Raised only a check for the clinician (see above); it did not hit an error. A check is not a pass: read the cited turns and judge the line yourself.']
      : ['warn', 'Passed every guard in this demo. That is not the same as true: read the cited turns above and judge it yourself.'];
    const vh = `<p class="${vc}" style="margin:12px 0 4px">${ln}${vt}</p>`;
    if (vh !== lastV) { $('#vd').innerHTML = vh; lastV = vh; } // the live region only changes when the verdict does
    $('#res').innerHTML = `<div class="out" style="white-space:normal"><span class="muted">Cited:</span><br>${quotes}</div>${steps}`;
    $('#rt').innerHTML = `${cur >= 0 ? `<p class="muted" style="margin:0 0 8px;font-size:14px">${esc(P[cur][3])}</p>` : ''}
      <p class="muted" style="font-size:13px;margin:0">Open for the clinician: <b class="${E ? 'bad' : ''}">${E} line${E === 1 ? '' : 's'} with errors</b>, <b class="${C ? 'warn' : ''}">${C} with checks</b>. In Notewell, sign-off stays disabled until every section is accepted and every error is resolved or acknowledged, and it needs an attestation. This demo has no sign button and signs nothing.</p>`;
    el.querySelectorAll('#pre button').forEach(b => { const on = +b.dataset.p === cur; b.setAttribute('aria-pressed', on); b.classList.toggle('sel', on); });
  };
  const pick = i => { sel = i; $('#ed').value = note[i].text; };
  $('#pre').onclick = e => { const b = e.target.closest('button'); if (!b) return; const p = P[b.dataset.p]; note[p[1]].text = p[2]; cur = +b.dataset.p; pick(p[1]); render(); };
  $('#note').onclick = e => { const b = e.target.closest('button'); if (!b) return; cur = -1; pick(+b.dataset.i); render(); $(`#note [data-i="${sel}"]`).focus(); };
  $('#rs').onclick = () => { reset(); pick(0); render(); };
  $('#mk').onchange = e => { masked = e.target.checked; render(); };
  $('#ed').addEventListener('input', e => { note[sel].text = e.target.value; cur = -1; clearTimeout(timer); timer = setTimeout(render, 300); });
  reset(); pick(0); render();
}
