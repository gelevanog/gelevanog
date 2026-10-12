// Real numbers from the repository README (80 hand-labeled tickets, run of 2026-10-05; paid teachers 2026-10-12). Not a simulation.
// Each row: [EN name, RU name, exact match %, bar colour, [EN detail, RU detail]] - shown on hover / tap / focus.
const ROWS = [
  ['Teacher (120B, free tier)', 'Учитель (120B, free tier)', 75.0, 'var(--accent)', [
    'Valid JSON and schema: 100%. Accuracy by field: intent 96.2%, urgency 90.0%, sentiment 87.5%, product area 100%, order id 100%. Its 20 misses are mostly borderline calls that the hand-made labels make differently (sentiment of factual problem reports, urgency one level off). A student trained on its labels inherits them, so about 75% is roughly the ceiling for that student on these tickets.',
    'Валидный JSON и схема: 100%. Точность по полям: intent 96,2%, urgency 90,0%, sentiment 87,5%, product area 100%, order id 100%. Его 20 промахов — в основном пограничные случаи, которые ручная разметка оценивает иначе (sentiment у фактических жалоб, urgency на уровень мимо). Ученик, обученный на его разметке, наследует их, поэтому около 75% — примерно потолок такого ученика на этих тикетах.']],
  ['Student 0.5B, zero-shot', 'Ученик 0,5B, zero-shot', 1.2, 'var(--bad)', [
    'The 0.5B model got the teacher\'s full labeling guide plus the exact output format. 90.0% of its answers are valid JSON, but only 22.5% pass the schema, and intent accuracy is 10.0%. An invalid answer counts as wrong in every field.',
    'Модели 0,5B дали полное руководство по разметке от учителя и точный формат ответа. 90,0% её ответов — валидный JSON, но схему проходят лишь 22,5%, а точность intent — 10,0%. Невалидный ответ считается ошибкой по каждому полю.']],
  ['Student 0.5B + LoRA', 'Ученик 0,5B + LoRA', 46.2, 'var(--warn)', [
    'Trained on 384 synthetic examples in 57 minutes on a 16-core CPU. Accuracy by field: intent 67.5%, urgency 58.8%, sentiment 78.8%, product area 81.2%, order id 86.2%. Urgency collapses toward "medium": 12 of 14 "high" tickets were predicted "medium" (only 10% of the training data is "high"). Fine-tuning works, but 0.5B is still too small.',
    'Обучение на 384 синтетических примерах заняло 57 минут на 16-ядерном CPU. Точность по полям: intent 67,5%, urgency 58,8%, sentiment 78,8%, product area 81,2%, order id 86,2%. Urgency сползает к «medium»: 12 из 14 тикетов «high» предсказаны как «medium» (в обучающих данных «high» лишь 10%). Дообучение работает, но 0,5B всё равно слишком мало.']],
  ['Router: student first, teacher fallback', 'Роутер: сначала ученик, затем учитель', 73.8, 'var(--accent2)', [
    'Threshold 0.77, calibrated on the 51 validation tickets for 80% exact match on the answers the student keeps (on the 80 tickets it reached 76.5%). The student keeps 21.2% of the tickets; the other 78.8% go to the teacher, including all 11 schema-invalid student answers. The student alone, on every ticket, scores 46.2%.',
    'Порог 0,77 подобран на 51 валидационном тикете под 80% exact match на ответах, которые остаются у ученика (на 80 тикетах вышло 76,5%). Ученику остаётся 21,2% тикетов; остальные 78,8% идут учителю, включая все 11 ответов ученика, не прошедших схему. Один ученик на всех тикетах даёт 46,2%.']],
];
// Same 80 tickets, only the teacher swapped: [EN name, RU name, teacher alone %, router %, [EN cost, RU cost] per 1k tickets, batched]
const PAID = [
  ['Free tier (nemotron), baseline', 'Бесплатный nemotron (база)', 75.0, 73.8, ['$0', '$0']],
  ['Claude Haiku 5.5', 'Claude Haiku 5.5', 83.8, 82.5, ['$0.12', '$0,12']],
  ['Claude Opus 5.5', 'Claude Opus 5.5', 88.8, 85.0, ['$3.16', '$3,16']],
  ['Qwen 3.7 Plus', 'Qwen 3.7 Plus', 75.0, 73.8, ['n/a', 'н/д']],
];
export default function mount(el, { lang, t, esc }) {
  const ru = lang === 'ru', N = x => (ru ? String(x).replace('.', ',') : String(x));
  const pct = v => N(v.toFixed(1)) + '%', L = i => (ru ? i[1] : i[0]);
  const th = s => `<th scope="col">${s}</th>`, rh = s => `<th scope="row" style="font-weight:400">${esc(s)}</th>`;
  el.innerHTML = `${ROWS.map((r, i) => `<div class="barrow" data-i="${i}" tabindex="0" role="button" aria-controls="dist-detail" style="cursor:pointer;border-radius:6px"><div>${esc(L(r))}</div><div><div class="bar" style="width:0;background:${r[3]}" data-w="${r[2]}"></div></div><div><b>${pct(r[2])}</b></div></div>`).join('')}
  <div class="share" id="dist-detail" aria-live="polite"></div>
  <p class="muted" style="margin-top:14px">${t('Exact match on all 5 fields, n = 80 tickets: the 95% interval is about ±7–10 pts, so 73.8% vs 75.0% (one ticket) is well inside it. The router lets the student answer 21.2% of tickets (it scores 76.5% on those) and falls back to the teacher for the rest.', 'Exact match по всем 5 полям, n = 80 тикетов: 95%-й интервал около ±7–10 п.п., так что 73,8% против 75,0% (один тикет) — далеко внутри него. Роутер оставляет ученику 21,2% тикетов (на них он набирает 76,5%), остальные уходят учителю.')}</p>
  <p class="muted" style="margin-top:8px">${t('Student after LoRA: only 86.2% of its answers pass the schema (11 of 80 invent an intent outside the list), urgency accuracy is 58.8%, and it learned from just 384 synthetic examples. The router sends every invalid answer to the teacher.', 'Ученик после LoRA: схему проходят лишь 86,2% его ответов (в 11 из 80 он выдумывает intent вне списка), точность urgency — 58,8%, а учился он всего на 384 синтетических примерах. Роутер отправляет каждый невалидный ответ учителю.')}</p>
  <table style="margin-top:10px" aria-label="${esc(t('Latency and cost', 'Задержка и стоимость'))}"><tr><th></th>${th(t('One ticket (p50)', 'Один тикет (p50)'))}${th(t('Batched, 8 per batch', 'Батчем по 8'))}${th(t('Cost / 1,000 tickets', 'Стоимость / 1000 тикетов'))}</tr>
  <tr>${rh(t('Teacher, free tier', 'Учитель, free tier'))}<td>${N('4.2')} ${t('s', 'с')}</td><td>${N('2.3')} ${t('s', 'с')}</td><td>${t('$0 free tier; $0.29 paid list price', '$0 free tier; $0,29 по платному прайсу')}</td></tr>
  <tr>${rh(t('Student + LoRA, CPU', 'Ученик + LoRA, CPU'))}<td>${N('8.7')} ${t('s', 'с')}</td><td>${N('3.7')} ${t('s', 'с')}</td><td>${t('$0.70 (assumed $0.68/h VM)', '$0,70 (VM по допущению $0,68/ч)')}</td></tr></table>
  <p class="muted" style="margin-top:8px">${t('Like for like, the CPU student is slower than the free-tier teacher and not cheaper than its paid price. Teacher $0.29 = measured tokens per single-ticket request × list price; student $0.70 = measured 3.72 s/ticket × an assumed VM price.', 'При честном сравнении ученик на CPU медленнее учителя на бесплатном тарифе и не дешевле его платного прайса. Учитель $0,29 = измеренные токены на запрос с одним тикетом × прайс; ученик $0,70 = измеренные 3,72 с/тикет × допущенная цена VM.')}</p>
  <p style="margin:18px 0 6px"><b>${t('Stronger paid teachers, same 80 tickets', 'Платные учителя посильнее, те же 80 тикетов')}</b> <span class="muted">${t('(exact match; $ per 1,000 tickets, batched)', '(exact match; $ за 1000 тикетов, батчем)')}</span></p>
  <table aria-label="${esc(t('Paid teacher comparison', 'Сравнение платных учителей'))}"><tr><th></th>${th(t('Teacher alone', 'Учитель сам'))}${th(t('With router', 'С роутером'))}${th(t('$ / 1k', '$ / 1000'))}</tr>
  ${PAID.map(p => `<tr>${rh(L(p))}<td>${pct(p[2])}</td><td>${pct(p[3])}</td><td>${esc(L(p[4]))}</td></tr>`).join('')}</table>
  <p class="muted" style="margin-top:8px">${t('Only the teacher was swapped; the student was NOT retrained on these teachers\' labels, and the router replays its saved predictions at the same 0.77 threshold. Opus vs Haiku is suggestive, not proven (±7–10 pts at n = 80); free vs Opus is a clear gap. The student now holds the router back: its 76.5% on the tickets it keeps costs 3.8 pts against Opus alone.', 'Заменён только учитель; ученик НЕ переобучался на разметке этих учителей, а роутер заново прогоняет его сохранённые предсказания с тем же порогом 0,77. Opus против Haiku — намёк, а не доказательство (±7–10 п.п. при n = 80); бесплатный против Opus — явный разрыв. Теперь роутер тянет вниз ученик: его 76,5% на оставшихся тикетах на 3,8 п.п. хуже, чем у одного Opus.')}</p>`;
  const rows = [...el.querySelectorAll('.barrow')], panel = el.querySelector('#dist-detail');
  let cur = -1;
  const show = i => {
    if (i === cur) return;
    cur = i;
    rows.forEach((r, k) => (r.style.boxShadow = k === i ? '0 0 0 5px color-mix(in srgb,var(--accent2) 16%,transparent)' : 'none'));
    panel.textContent = L(ROWS[i][4]);
  };
  const pick = e => { const r = e.target.closest('.barrow'); if (r) show(+r.dataset.i); };
  ['click', 'mouseover', 'focusin'].forEach(ev => el.addEventListener(ev, pick));
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });
  show(3);
  requestAnimationFrame(() => setTimeout(() => el.querySelectorAll('.bar').forEach(b => (b.style.width = b.dataset.w + '%')), 50));
}
