// Browser version of the CRM Copilot pattern: typed, workspace-scoped tools; writes are proposals that a human approves.
const DEALS = [
  { id: 1, company: 'Acme', stage: 'Negotiation', value: 48000, ws: 'mine' }, { id: 2, company: 'Globex', stage: 'Proposal', value: 12000, ws: 'mine' },
  { id: 3, company: 'Initech', stage: 'Negotiation', value: 7000, ws: 'mine' }, { id: 4, company: 'Umbrella', stage: 'Lead', value: 30000, ws: 'mine' },
  { id: 5, company: 'Rival Corp', stage: 'Won', value: 99000, ws: 'other' },
];
const STAGES = ['Lead', 'Proposal', 'Negotiation', 'Won'];
export default function mount(el, { lang, t, esc }) {
  let deals = DEALS.map(d => ({ ...d })), pending = null;
  const P = [t('Show deals in negotiation over $10k', 'Покажи сделки в Negotiation свыше $10k'), t('Move Globex to Negotiation', 'Переведи Globex в Negotiation'), t('Delete all deals', 'Удали все сделки'), t("Show Rival Corp's deals", 'Покажи сделки Rival Corp')];
  el.innerHTML = `<div class="cols2"><div><label>${t('Your workspace (3 of the rows you can see)', 'Ваше рабочее пространство')}</label><div class="out" id="tb"></div></div>
  <div><label>${t('Copilot', 'Копилот')}</label><div class="row"><input type="text" id="q" aria-label="Copilot command"><button class="go" id="go">${t('Send', 'Отправить')}</button></div>
  <div class="row">${P.map((x, i) => `<button data-p="${i}">${esc(x)}</button>`).join('')}</div>
  <div class="out" id="call" role="status" aria-live="polite">—</div><div id="res"></div></div></div>`;
  const $ = s => el.querySelector(s);
  const draw = () => { $('#tb').innerHTML = `<table><tr><th>${t('Company', 'Компания')}</th><th>${t('Stage', 'Стадия')}</th><th>$</th></tr>${deals.filter(d => d.ws === 'mine').map(d => `<tr><td>${d.company}</td><td>${d.stage}</td><td>${d.value.toLocaleString('en')}</td></tr>`).join('')}</table>`; };
  draw();
  const show = (call, html) => { $('#call').innerHTML = call; $('#res').innerHTML = html; };
  function handle(q) {
    pending = null; const s = q.toLowerCase();
    const company = DEALS.map(d => d.company).find(c => s.includes(c.toLowerCase()));
    const stage = STAGES.find(x => s.includes(x.toLowerCase()));
    const min = (s.match(/(\d+)\s*k\b/) || [])[1];
    if (/delete|drop|remove all|удали|удалить/.test(s)) return show(`<span class="bad">no such tool</span>`, `<p class="warn">${t('The copilot has no delete tool, so it cannot do this — by design. It can only call searchDeals, getCompany and proposeStageChange.', 'У копилота нет инструмента удаления, поэтому он не может этого сделать — так задумано. Ему доступны только searchDeals, getCompany и proposeStageChange.')}</p>`);
    if (/(move|change|set|перев)/.test(s) && company && stage) {
      const d = deals.find(x => x.company === company);
      if (d.ws !== 'mine') return show(`proposeStageChange({ deal: "${company}" })`, `<p class="bad">${t('Rejected: that deal is in another workspace.', 'Отклонено: эта сделка в другом рабочем пространстве.')}</p>`);
      pending = { d, stage };
      show(`proposeStageChange({ dealId: ${d.id}, stage: "${stage}" })`, `<div class="out"><span class="bad">- ${d.stage}</span>\n<span class="good">+ ${stage}</span></div><p class="muted">${t('Nothing changed yet. A normal authenticated click applies it — after re-checking permissions.', 'Пока ничего не изменилось. Применяет обычный авторизованный клик — после повторной проверки прав.')}</p><div class="row"><button class="ok" id="ap">${t('Approve', 'Подтвердить')}</button><button class="no" id="rj">${t('Reject', 'Отклонить')}</button></div>`);
      $('#ap').onclick = () => { const cur = deals.find(x => x.id === pending.d.id); cur.stage = pending.stage; pending = null; draw(); $('#res').innerHTML = `<p class="good">✓ ${t('Applied by the user, not by the model.', 'Применено пользователем, а не моделью.')}</p>`; };
      $('#rj').onclick = () => { pending = null; $('#res').innerHTML = `<p class="muted">${t('Dismissed. No change.', 'Отклонено. Без изменений.')}</p>`; };
      return;
    }
    if (company && deals.find(x => x.company === company).ws !== 'mine') return show(`getCompany({ name: "${company}" })`, `<p class="bad">${t('Not found in your workspace. The tool is scoped in code — the model never sees another customer’s data.', 'Не найдено в вашем рабочем пространстве. Инструмент ограничен в коде — модель никогда не видит данные другого клиента.')}</p>`);
    if (/(show|find|list|deal|покажи|сделк)/.test(s)) {
      const args = { workspace: 'current', ...(stage ? { stage } : {}), ...(min ? { minValue: +min * 1000 } : {}) };
      const r = deals.filter(d => d.ws === 'mine' && (!stage || d.stage === stage) && (!min || d.value >= min * 1000) && (!company || d.company === company));
      return show(`searchDeals(${esc(JSON.stringify(args))})`, `<div class="out">${r.length ? r.map(d => `${d.company} · ${d.stage} · $${d.value.toLocaleString('en')}`).join('\n') : t('No deals match.', 'Нет подходящих сделок.')}</div>`);
    }
    show('—', `<p class="muted">${t('I can only use typed tools: searchDeals, getCompany, proposeStageChange.', 'Я могу пользоваться только типизированными инструментами: searchDeals, getCompany, proposeStageChange.')}</p>`);
  }
  $('#go').onclick = () => $('#q').value && handle($('#q').value); $('#q').onkeydown = e => e.key === 'Enter' && $('#go').click();
  el.querySelectorAll('[data-p]').forEach(b => (b.onclick = () => { $('#q').value = P[b.dataset.p]; handle(P[b.dataset.p]); }));
}
