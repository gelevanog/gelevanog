// Real numbers from the repository README (80 hand-labeled tickets). Not a simulation.
const ROWS = [
  { n: 'Teacher (120B, free tier)', v: 75.0, ru: 'Учитель (120B, free tier)', c: 'var(--accent)' },
  { n: 'Student 0.5B, zero-shot', v: 1.2, ru: 'Ученик 0,5B, zero-shot', c: 'var(--bad)' },
  { n: 'Student 0.5B + LoRA', v: 46.2, ru: 'Ученик 0,5B + LoRA', c: 'var(--warn)' },
  { n: 'Router: student first, teacher fallback', v: 73.8, ru: 'Роутер: сначала ученик, затем учитель', c: 'var(--accent2)' },
];
export default function mount(el, { lang, t, esc }) {
  el.innerHTML = `${ROWS.map(r => `<div class="barrow" title="${r.v}%"><div>${esc(lang === 'ru' ? r.ru : r.n)}</div><div><div class="bar" style="width:0;background:${r.c}" data-w="${r.v}"></div></div><div><b>${r.v}%</b></div></div>`).join('')}
  <p class="muted" style="margin-top:14px">${t('Exact match on all 5 fields. The router lets the student answer 21% of tickets, and falls back to the teacher for the rest.', 'Exact match по всем 5 полям. Роутер оставляет ученику 21% тикетов, остальные уходят учителю.')}</p>
  <table style="margin-top:10px"><tr><th></th><th>${t('Latency / ticket', 'Задержка / тикет')}</th><th>${t('Cost / 1k tickets', 'Стоимость / 1000 тикетов')}</th></tr>
  <tr><td>${t('Teacher', 'Учитель')}</td><td>4.2 s</td><td>$0.29 ${t('(paid list price)', '(платный прайс)')}</td></tr>
  <tr><td>${t('Student + LoRA, CPU', 'Ученик + LoRA, CPU')}</td><td>3.7 s</td><td>$0.70</td></tr></table>`;
  requestAnimationFrame(() => setTimeout(() => el.querySelectorAll('.bar').forEach(b => (b.style.width = b.dataset.w + '%')), 50));
}
