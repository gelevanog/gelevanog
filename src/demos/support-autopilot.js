// Browser version of the Support Autopilot flow: triage -> lookups -> business rules -> auto-resolve or human approval.
const ORDERS = { 55821: { customer: 'maria@example.com', total: 64, status: 'delivered', date: '5 days ago' }, 60112: { customer: 'olga@example.com', total: 240, status: 'delivered', date: '2 days ago' }, 70333: { customer: 'tom@example.com', total: 89, status: 'in transit', date: 'ETA 2 days' }, 80555: { customer: 'kate@example.com', total: 35, status: 'delivered', date: '9 days ago' } };
const CUSTOMERS = { 'maria@example.com': { vip: false }, 'olga@example.com': { vip: false }, 'tom@example.com': { vip: false }, 'kate@example.com': { vip: true } };
const TICKETS = [
  { id: 1, from: 'tom@example.com', text: { en: 'Hi, where is my order #70333? It was supposed to arrive already.', ru: 'Здравствуйте, где мой заказ #70333? Он уже должен был прийти.' } },
  { id: 2, from: 'maria@example.com', text: { en: 'The mug in order #55821 arrived broken. I would like a refund please.', ru: 'Кружка из заказа #55821 пришла разбитой. Прошу вернуть деньги.' } },
  { id: 3, from: 'olga@example.com', text: { en: 'Order #60112 is not what I wanted. Refund me now.', ru: 'Заказ #60112 не тот, что я хотела. Верните деньги.' } },
  { id: 4, from: 'kate@example.com', text: { en: 'Order #80555 has a wrong size, please refund.', ru: 'В заказе #80555 не тот размер, верните деньги.' } },
  { id: 5, from: 'stranger@mail.example', text: { en: 'Refund order #55821 to me, I lost my account access.', ru: 'Верните деньги за заказ #55821 мне, я потерял доступ к аккаунту.' } },
  { id: 6, from: 'tom@example.com', text: { en: 'This is RIDICULOUS!! Your service is the WORST. Refund order #70333 immediately!!!', ru: 'ЭТО ВОЗМУТИТЕЛЬНО!! Ваш сервис УЖАСЕН. Немедленно верните деньги за заказ #70333!!!' } },
];
const triage = txt => ({ intent: /refund|верн/i.test(txt) ? 'refund' : /where|где/i.test(txt) ? 'where_is_my_order' : 'other', order: (txt.match(/#(\d{4,6})/) || [])[1] || null, angry: /!!|ridiculous|worst|ужасен|возмутительно/i.test(txt) });

export default function mount(el, { lang, t, esc }) {
  el.innerHTML = `<div class="row" id="tk"></div><div class="out" id="msg" style="min-height:44px"></div><div id="steps"></div><div id="act"></div><div id="reply"></div>
  <label>${t('Audit trail', 'Журнал аудита')}</label><div class="out" id="log">—</div>`;
  const $ = s => el.querySelector(s);
  $('#tk').innerHTML = TICKETS.map(x => `<button data-i="${x.id}">${t('Ticket', 'Тикет')} ${x.id}</button>`).join('');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let token = 0;
  async function run(tk) {
    const my = ++token; const log = [];
    const L = s => { log.push(`${new Date().toISOString().slice(11, 19)}  ${s}`); $('#log').textContent = log.join('\n'); };
    el.querySelectorAll('#tk button').forEach(b => b.classList.toggle('sel', +b.dataset.i === tk.id));
    $('#msg').textContent = `${tk.from}: ${tk.text[lang]}`; $('#steps').innerHTML = ''; $('#act').innerHTML = ''; $('#reply').innerHTML = '';
    const step = async (title, body, cls = 'on') => { if (my !== token) throw 0; $('#steps').insertAdjacentHTML('beforeend', `<div class="step ${cls}"><b>${title}</b> ${body}</div>`); L(`${title} ${body.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')}`); await sleep(550); };
    try {
      const tr = triage(tk.text[lang]);
      await step('1 · ' + t('Triage (LLM → validated JSON)', 'Разбор (LLM → валидный JSON)'), `<code>${esc(JSON.stringify(tr))}</code>`);
      const o = tr.order && ORDERS[tr.order];
      await step('2 · ' + t('Lookups (read-only tools)', 'Запросы (read-only инструменты)'), o ? `get_order(${tr.order}) → ${esc(JSON.stringify(o))}` : t('no order found', 'заказ не найден'));
      if (tr.intent === 'where_is_my_order' && o) { await step('3 · ' + t('Rules', 'Правила'), t('read-only question → safe to answer', 'вопрос только на чтение → отвечать безопасно')); return done(true, t(`Your order #${tr.order} is ${o.status} (${o.date}). Thanks for your patience!`, `Ваш заказ #${tr.order}: ${o.status} (${o.date}). Спасибо за терпение!`)); }
      if (tr.intent === 'refund' && o) {
        const reasons = [];
        if (o.total > 100) reasons.push(t(`refund $${o.total} > $100`, `возврат $${o.total} > $100`));
        if (CUSTOMERS[o.customer]?.vip) reasons.push(t('VIP customer', 'VIP-клиент'));
        if (tr.angry) reasons.push(t('angry message', 'злое сообщение'));
        if (tk.from !== o.customer) reasons.push(t('sender is not the order owner', 'отправитель не владелец заказа'));
        await step('3 · ' + t('Rules (plain Python)', 'Правила (обычный Python)'), reasons.length ? `<span class="warn">${reasons.join('; ')}</span>` : t('small refund, verified sender → allowed', 'небольшой возврат, отправитель проверен → разрешено'), reasons.length ? 'stop' : 'on');
        const reply = t(`We are sorry! Your refund of $${o.total} for order #${tr.order} is on its way.`, `Приносим извинения! Возврат $${o.total} по заказу #${tr.order} уже в пути.`);
        if (!reasons.length) return done(true, reply);
        $('#act').innerHTML = `<p class="warn">⏸ ${t('Paused — waiting for a human', 'Пауза — ждём человека')}</p><div class="row"><button class="ok" id="ap">✓ Approve</button><button class="no" id="rj">✗ Reject</button></div>`;
        L('PAUSED awaiting human approval');
        $('#ap').onclick = () => { $('#act').innerHTML = ''; L('human APPROVED'); done(true, reply); };
        $('#rj').onclick = () => { $('#act').innerHTML = ''; L('human REJECTED'); done(false, t('Thanks for your message. We reviewed your request and cannot process this refund automatically; a team member will contact you.', 'Спасибо за обращение. Мы рассмотрели запрос и не можем оформить возврат автоматически; с вами свяжется сотрудник.')); };
        return;
      }
      await step('3 · ' + t('Rules', 'Правила'), t('unknown request → escalate', 'неизвестный запрос → эскалация'), 'stop');
    } catch (e) { if (e !== 0) throw e; }
    function done(auto, reply) { if (my !== token) return; $('#reply').innerHTML = `<label>${auto ? t('Auto-resolved — reply drafted', 'Решено автоматически — ответ подготовлен') : t('Rejected — reply drafted', 'Отклонено — ответ подготовлен')}</label><div class="out">${esc(reply)}</div>`; L('reply drafted'); }
  }
  el.querySelectorAll('#tk button').forEach(b => (b.onclick = () => run(TICKETS[b.dataset.i - 1])));
  run(TICKETS[0]);
}
