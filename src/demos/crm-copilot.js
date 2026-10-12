// Browser version of the CRM Copilot pattern: typed, workspace-scoped tools; writes are proposals that a human approves.
// A keyword router stands in for the model (like the project's fake provider); the data is made up.
const DEALS = [
  { id: 1, company: 'Acme', stage: 'NEGOTIATION', value: 48000, ws: 'mine' }, { id: 2, company: 'Globex', stage: 'PROPOSAL', value: 12000, ws: 'mine' },
  { id: 3, company: 'Initech', stage: 'NEGOTIATION', value: 7000, ws: 'mine' }, { id: 4, company: 'Umbrella', stage: 'LEAD', value: 30000, ws: 'mine' },
  { id: 5, company: 'Rival Corp', stage: 'PROPOSAL', value: 99000, ws: 'other' },
];
const STAGES = [
  { k: 'LEAD', en: 'Lead', ru: 'Лид', re: /\blead|лид/ }, { k: 'QUALIFIED', en: 'Qualified', ru: 'Квалификация', re: /qualif|квалиф/ },
  { k: 'PROPOSAL', en: 'Proposal', ru: 'Предложение', re: /proposal|предложени/ }, { k: 'NEGOTIATION', en: 'Negotiation', ru: 'Переговоры', re: /negotiat|переговор/ },
];
export default function mount(el, { lang, t, esc }) {
  const money = n => '$' + n.toLocaleString(lang === 'ru' ? 'ru' : 'en');
  const sl = k => { const s = STAGES.find(x => x.k === k); return t(s.en, s.ru); };
  const nMine = DEALS.filter(d => d.ws === 'mine').length;
  let deals, pending;
  const reset = () => { deals = DEALS.map(d => ({ ...d, v: 0 })); pending = null; };
  reset();
  const P = [t('Show deals in negotiation over $10k', 'Покажи сделки на стадии «Переговоры» свыше $10k'), t('Move Globex to Negotiation', 'Переведи Globex в «Переговоры»'), t('Move Acme to Negotiation', 'Переведи Acme в «Переговоры»'), t('Delete all deals', 'Удали все сделки'), t("Show Rival Corp's deals", 'Покажи сделки Rival Corp')];
  const TOOLS = t('The real copilot has seven typed tools: searchDeals, getCompany, listActivities, getPipelineStats (read) and proposeDealStageChange, proposeDealUpdate, proposeActivity (propose-only write). This demo implements three: searchDeals, getCompany, proposeDealStageChange.',
    'У настоящего копилота семь типизированных инструментов: searchDeals, getCompany, listActivities, getPipelineStats (чтение) и proposeDealStageChange, proposeDealUpdate, proposeActivity (запись только как предложение). В демо реализованы три: searchDeals, getCompany, proposeDealStageChange.');
  el.innerHTML = `<div class="cols2"><div><label id="tl">${t(`Your workspace: ${nMine} deals (made-up data)`, `Ваше рабочее пространство: ${nMine} сделки (вымышленные данные)`)}</label><div id="tb"></div><div class="row"><button id="rs">${t('Reset data', 'Сбросить данные')}</button></div></div>
  <div><label for="q">${t('Copilot (a keyword router, not an LLM)', 'Копилот (роутер по ключевым словам, не LLM)')}</label><div class="row"><input type="text" id="q" autocomplete="off" aria-label="${t('Copilot command', 'Команда копилоту')}"><button class="go" id="go">${t('Send', 'Отправить')}</button></div>
  <div class="row">${P.map((x, i) => `<button data-p="${i}">${esc(x)}</button>`).join('')}</div>
  <div role="status" aria-live="polite"><div class="out" id="call">—</div><div id="res"></div></div></div></div>
  <p class="muted">${t('Made-up data, one deal per company. In the real app “the Acme deal” can match several deals: the server narrows it to your own open deals and, if it is still ambiguous, returns the candidates so the model can ask. A second workspace (Rival Corp) exists behind the scenes; the tools cannot reach it.',
    'Вымышленные данные, одна сделка на компанию. В настоящем приложении «сделка Acme» может подойти к нескольким сделкам: сервер сужает выбор до ваших открытых сделок, а если неоднозначность остаётся, возвращает кандидатов, и модель уточняет. Второе рабочее пространство (Rival Corp) существует «за кулисами»; инструменты до него не дотягиваются.')}</p>
  <p class="muted">${t('This is a keyword router, not a model, so it always “understands” you. Real models sometimes misread a request: in the project’s README runs a free model (Nemotron) returned a schema-valid but wrong natural-language filter both times, and an ambiguous “Move the Acme deal to Proposal” went differently in two runs. That is why writes are only proposals you approve.',
    'Это роутер по ключевым словам, а не модель, поэтому он всегда «понимает» запрос. Настоящие модели иногда понимают запрос неверно: в прогонах из README бесплатная модель (Nemotron) оба раза вернула валидный по схеме, но неверный фильтр на естественном языке, а неоднозначную команду «Move the Acme deal to Proposal» в двух прогонах обработали по-разному. Поэтому запись — только предложение, которое подтверждаете вы.')}</p>`;
  const $ = s => el.querySelector(s);
  const draw = () => { $('#tb').innerHTML = `<table aria-labelledby="tl"><tr><th scope="col">${t('Company', 'Компания')}</th><th scope="col">${t('Stage', 'Стадия')}</th><th scope="col">${t('Amount', 'Сумма')}</th></tr>${deals.filter(d => d.ws === 'mine').map(d => `<tr><td>${esc(d.company)}</td><td>${sl(d.stage)}</td><td>${money(d.value)}</td></tr>`).join('')}</table>`; };
  draw();
  const show = (call, html) => { $('#call').innerHTML = call; $('#res').innerHTML = html; };
  const fmt = (name, args) => `${name}(${esc(JSON.stringify(args)).replace(/,/g, ',<wbr>')})`;
  const note = (cls, msg) => `<p class="${cls}">${msg}</p>`;
  const done = (cls, msg) => { pending = null; $('#res').innerHTML = note(cls, msg); };
  function handle(q) {
    pending = null; const s = q.toLowerCase();
    const company = DEALS.map(d => d.company).find(c => s.includes(c.toLowerCase()));
    const st = STAGES.find(x => x.re.test(s));
    const m = s.match(/(\d+)\s*[kк](?![a-zа-я])/), min = m ? +m[1] * 1000 : 0;
    if (/delet|drop|remove|wipe|удал|сотр|очист/.test(s)) return show(`<span class="bad">${t('no such tool', 'такого инструмента нет')}</span>`, note('warn', t('The copilot has no delete tool, so it cannot do this — by design. ', 'У копилота нет инструмента удаления, поэтому он не может этого сделать — так задумано. ') + TOOLS));
    if (/\b(move|change|set|mark)\b|перев|перенес|смени|измени|постав/.test(s)) {
      if (!company || !st) return show('—', note('muted', t('Name a deal and a stage, e.g. “Move Globex to Proposal”. (A real model would ask.)', 'Назовите сделку и стадию, например «Переведи Globex в Предложение». (Настоящая модель уточнила бы.)')));
      const d = deals.find(x => x.company === company), call = fmt('proposeDealStageChange', { deal: company, stage: st.k });
      if (d.ws !== 'mine') return show(call, note('bad', t('Rejected: no such deal in your workspace. A deal in another workspace is rejected exactly like one that does not exist, and no proposal is stored.', 'Отклонено: в вашем рабочем пространстве нет такой сделки. Сделка из другого пространства отклоняется так же, как несуществующая; предложение не создаётся.')));
      if (d.stage === st.k) return show(call, note('bad', t(`Rejected: no change, ${company} is already in ${sl(d.stage)}. No proposal is stored.`, `Отклонено: изменений нет, ${company} уже на стадии «${sl(d.stage)}». Предложение не создаётся.`)));
      pending = { id: d.id, to: st.k, v: d.v, expired: false };
      show(call, `<div class="out"><b>${t('Move deal to', 'Перевести сделку в')} ${sl(st.k)}</b> · ${esc(company)}\n<span class="bad">- ${t('Stage', 'Стадия')}: ${sl(d.stage)}</span>\n<span class="good">+ ${t('Stage', 'Стадия')}: ${sl(st.k)}</span>\n<span class="muted">${t('status: pending · expires in 15 min', 'статус: ожидает · истекает через 15 мин')}</span></div>` +
        note('muted', t('Nothing changed yet. Only a normal authenticated click applies it, and the server then re-checks ownership, expiry (15 min) and that the deal has not changed since.', 'Пока ничего не изменилось. Применяет только обычный авторизованный клик — после повторной проверки владельца, срока действия (15 мин) и того, что сделка не менялась.')) +
        `<div class="row"><button class="ok" id="ap">${t('Approve', 'Подтвердить')}</button><button class="no" id="rj">${t('Reject', 'Отклонить')}</button></div>
        <div class="row"><span class="muted">${t('Simulate:', 'Имитация:')}</span><button id="sx">${t('a colleague edits the deal', 'коллега правит сделку')}</button><button id="se">${t('15 minutes pass', 'проходит 15 минут')}</button></div><p class="warn" id="sim"></p>`);
      $('#ap').onclick = () => {
        const cur = deals.find(x => x.id === pending.id);
        if (pending.expired) return done('bad', t('Refused (409, expired): the proposal is older than 15 minutes. Nothing was written.', 'Отказ (409, истекло): предложению больше 15 минут. Ничего не записано.'));
        if (cur.v !== pending.v) return done('bad', t('Refused (409, stale): the deal changed after the proposal was made, so applying it would overwrite that edit. Nothing was written.', 'Отказ (409, устарело): сделка изменилась после предложения, и применение затёрло бы эту правку. Ничего не записано.'));
        cur.stage = pending.to; cur.v++; draw();
        done('good', '✓ ' + t('Applied by you with a normal authenticated request, not by the model.', 'Применено вами обычным авторизованным запросом, а не моделью.'));
      };
      $('#rj').onclick = () => done('muted', t('Rejected. Nothing was written.', 'Отклонено. Ничего не записано.'));
      $('#sx').onclick = () => { const cur = deals.find(x => x.id === pending.id); cur.value += 5000; cur.v++; draw(); $('#sim').textContent = t(`A colleague changed the amount to ${money(cur.value)}. Now click Approve.`, `Коллега изменил сумму на ${money(cur.value)}. Теперь нажмите «Подтвердить».`); };
      $('#se').onclick = () => { pending.expired = true; $('#sim').textContent = t('15 minutes have passed. Now click Approve.', 'Прошло 15 минут. Теперь нажмите «Подтвердить».'); };
      return;
    }
    if (company) {
      const call = fmt('getCompany', { name: company }), d = deals.find(x => x.company === company);
      if (d.ws !== 'mine') return show(call, note('bad', t('Not found in your workspace — the same answer as for a name that does not exist. The tool is scoped in code to the workspace from your session, so the model never sees another customer’s data.', 'Не найдено в вашем рабочем пространстве — тот же ответ, что и для несуществующего имени. Инструмент ограничен в коде рабочим пространством из вашей сессии, поэтому модель не видит данные другого клиента.')));
      return show(call, `<div class="out">${esc(company)}: ${t('1 open deal', '1 открытая сделка')}, ${money(d.value)} ${t('pipeline', 'в воронке')}\n${sl(d.stage)} · ${money(d.value)}</div>`);
    }
    if (st || min || /show|find|list|deal|покаж|сделк|найд|список/.test(s)) {
      const args = { ...(st ? { stages: [st.k] } : {}), ...(min ? { minAmount: min } : {}) };
      const r = deals.filter(d => d.ws === 'mine' && (!st || d.stage === st.k) && d.value >= min);
      return show(fmt('searchDeals', args), `<div class="out">${r.length ? r.map(d => `${esc(d.company)} · ${sl(d.stage)} · ${money(d.value)}`).join('\n') : t('No deals match.', 'Нет подходящих сделок.')}</div>` +
        note('muted', t('The workspace is not an argument: it comes from the signed-in session, and a model-supplied workspaceId would be rejected by the strict schema.', 'Рабочее пространство — не аргумент: оно берётся из сессии пользователя, а workspaceId от модели строгая схема отклонила бы.')));
    }
    show('—', note('muted', t('No tool call: this keyword router did not recognise the request. Try a preset. ', 'Вызова инструмента нет: роутер по ключевым словам не распознал запрос. Попробуйте пресет. ') + TOOLS));
  }
  $('#go').onclick = () => { const v = $('#q').value.trim(); v && handle(v); }; $('#q').onkeydown = e => e.key === 'Enter' && $('#go').click();
  $('#rs').onclick = () => { reset(); draw(); show('—', ''); };
  el.querySelectorAll('[data-p]').forEach(b => (b.onclick = () => { $('#q').value = P[b.dataset.p]; handle(P[b.dataset.p]); }));
}
