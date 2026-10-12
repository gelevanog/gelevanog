// Browser version of the Support Autopilot flow: triage -> read-only lookups -> deterministic rules -> auto-resolve / deny / escalate / ask for info / wait for a human.
// Simplified on purpose: triage is a keyword match (not an LLM) and replies are fixed templates. Rule ids, outcomes and their severity order follow the project README.
const ORDERS = {
  70333: { customer: 'tom@example.com', total: 89, refunded: 0, status: 'shipped', eta_days: 2 },
  55821: { customer: 'maria@example.com', total: 64, refunded: 0, status: 'delivered', days_since_delivery: 5 },
  60112: { customer: 'olga@example.com', total: 240, refunded: 0, status: 'delivered', days_since_delivery: 2 },
  80555: { customer: 'kate@example.com', total: 35, refunded: 0, status: 'delivered', days_since_delivery: 9 },
  91007: { customer: 'ben@example.com', total: 52, refunded: 0, status: 'delivered', days_since_delivery: 6 },
  42001: { customer: 'lena@example.com', total: 48, refunded: 0, status: 'delivered', days_since_delivery: 31 },
};
const CUSTOMERS = { 'maria@example.com': { vip: false }, 'olga@example.com': { vip: false }, 'tom@example.com': { vip: false }, 'kate@example.com': { vip: true }, 'ben@example.com': { vip: false }, 'lena@example.com': { vip: false } };
const TICKETS = [
  { from: 'tom@example.com', text: { en: 'Hi, where is my order #70333? It was supposed to arrive already.', ru: 'Здравствуйте, где мой заказ #70333? Он уже должен был прийти.' } },
  { from: 'maria@example.com', text: { en: 'The mug in order #55821 arrived broken. I would like a refund please.', ru: 'Кружка из заказа #55821 пришла разбитой. Прошу вернуть деньги.' } },
  { from: 'olga@example.com', text: { en: 'Order #60112 is not what I wanted. Refund me now.', ru: 'Заказ #60112 не тот, что я хотела. Верните деньги.' } },
  { from: 'kate@example.com', text: { en: 'Order #80555 has a wrong size, please refund.', ru: 'В заказе #80555 не тот размер, верните деньги.' } },
  { from: 'stranger@mail.example', text: { en: 'Refund order #55821 to me, I lost my account access.', ru: 'Верните деньги за заказ #55821 мне, я потерял доступ к аккаунту.' } },
  { from: 'tom@example.com', text: { en: 'This is RIDICULOUS!! Your service is the WORST. Refund order #70333 immediately!!!', ru: 'ЭТО ВОЗМУТИТЕЛЬНО!! Ваш сервис УЖАСЕН. Немедленно верните деньги за заказ #70333!!!' } },
  { from: 'ben@example.com', text: { en: 'RIDICULOUS!! The grinder in order #91007 died after one day. Refund it immediately!!!', ru: 'ЭТО ВОЗМУТИТЕЛЬНО!! Кофемолка из заказа #91007 сломалась через день. Немедленно верните деньги!!!' } },
  { from: 'lena@example.com', text: { en: 'Please refund order #42001, it does not fit.', ru: 'Пожалуйста, верните деньги за заказ #42001, он не подошёл.' } },
  { from: 'maria@example.com', text: { en: 'Please refund order #55812, the mug arrived broken.', ru: 'Верните деньги за заказ #55812, кружка пришла разбитой.' } },
  { from: 'cafe@example.com', text: { en: 'Hello! Do you sell wholesale to cafes? We would like a price list.', ru: 'Здравствуйте! Вы продаёте оптом для кафе? Нам нужен прайс-лист.' } },
];
const SEV = ['pass', 'needs_approval', 'deny', 'escalate', 'request_info']; // least to most severe, as in the README
const RES = { auto_approve: 'refund_issued', inform: 'informed', deny: 'denied', escalate: 'escalated' };
const triage = txt => ({ intent: /refund|верн/i.test(txt) ? 'refund_request' : /where is|где мой/i.test(txt) ? 'order_status' : 'other', urgency: /immediately|немедленно/i.test(txt) ? 'high' : 'normal', sentiment: /!!|ridiculous|worst|ужасен|возмутительно/i.test(txt) ? 'negative' : 'neutral', order_id: (txt.match(/#(\d{4,6})/) || [])[1] || null });

export default function mount(el, { lang, t, esc }) {
  const days = n => lang === 'ru' ? `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 > 1 && n % 10 < 5 && (n % 100 < 12 || n % 100 > 14) ? 'дня' : 'дней'}` : `${n} ${n === 1 ? 'day' : 'days'}`;
  const $ = s => el.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const STOP = Symbol('stale run');
  let token = 0;
  el.innerHTML = `<div class="row" id="tk" role="group" aria-label="${esc(t('Demo tickets', 'Тестовые тикеты'))}">${TICKETS.map((x, i) => `<button data-i="${i}" aria-pressed="false">${t('Ticket', 'Тикет')} ${i + 1}</button>`).join('')}</div>
  <div class="out" id="msg" style="min-height:44px"></div><div id="steps" aria-live="polite"></div><div id="act" aria-live="polite"></div><div id="reply"></div>
  <label id="lg">${t('Audit trail (UTC)', 'Журнал аудита (UTC)')}</label><div class="out" id="log" role="region" aria-labelledby="lg" tabindex="0">—</div>
  <p class="muted" style="font-size:13px;margin-top:14px">${esc(t(
    'Simplified: triage here is a keyword match that only handles these ten tickets, standing in for the LLM, and replies are fixed templates (the real agent writes both with an LLM). Not shown: address changes, knowledge-base answers, complaint escalation, and the unverified-sender and already-refunded cases. A real model can misread a ticket, and the rules then act on the wrong intent: on 40 labelled tickets, intent accuracy was 97.5% for Claude Haiku 5.5 and 67.5% for Qwen 3.7 Plus.',
    'Упрощённо: разбор здесь — подбор по ключевым словам вместо LLM, он умеет только эти десять тикетов, а ответы — готовые шаблоны (в настоящем агенте и то и другое пишет LLM). Не показаны: смена адреса, ответы из базы знаний, эскалация жалоб, случаи непроверенного отправителя и уже возвращённого заказа. Настоящая модель может неверно понять тикет, и тогда правила сработают по неверному намерению: на 40 размеченных тикетах точность определения намерения у Claude Haiku 5.5 — 97.5%, у Qwen 3.7 Plus — 67.5%.'))}</p>`;

  // Business rules: every check is evaluated and logged; the most severe outcome becomes the verdict.
  function rules(tr, o, from, cust) {
    const cs = [], chk = (id, ok, v, yes, no, reply = '') => cs.push({ id, v: ok ? 'pass' : v, m: ok ? yes : no, r: ok ? '' : reply });
    if (tr.intent === 'other') return [{ id: 'fallback.unsupported_intent', v: 'escalate', m: t('Request type is not supported.', 'Тип запроса не поддерживается.'), r: t('Thank you for your message. This request needs a person, so we have passed it to our team.', 'Спасибо за обращение. Этот запрос должен рассмотреть сотрудник, поэтому мы передали его команде.') }];
    chk('order.identified', !!o, 'request_info', t(`Order #${tr.order_id} found.`, `Заказ #${tr.order_id} найден.`), t(`Order #${tr.order_id} not found.`, `Заказ #${tr.order_id} не найден.`), t('Thank you for your message. We could not find a matching order. Could you send the correct order number?', 'Спасибо за обращение. Мы не нашли подходящий заказ. Пришлите, пожалуйста, правильный номер заказа.'));
    if (!o) return cs;
    chk('identity.order_owner', from === o.customer, 'escalate', t('Sender owns the order.', 'Отправитель — владелец заказа.'), t('Sender is not the order owner.', 'Отправитель не владелец заказа.'), t('Thank you for your message. We could not confirm your request against the account, so we cannot share order details here. We have passed it to our team.', 'Спасибо за обращение. Мы не смогли сопоставить запрос с аккаунтом, поэтому не можем сообщать данные заказа в этом ответе. Мы передали обращение команде.'));
    if (tr.intent !== 'refund_request') return cs;
    const n = tr.order_id, bal = o.total - o.refunded, dlv = o.status === 'delivered', d = o.days_since_delivery;
    chk('refund.order_delivered', dlv, 'deny', t('Order has been delivered.', 'Заказ доставлен.'), t(`Order is not delivered yet (status: ${o.status}).`, `Заказ ещё не доставлен (статус: ${{ shipped: 'отправлен', delivered: 'доставлен' }[o.status] || o.status}).`), t(`Order #${n} has not been delivered yet, so we cannot refund it.`, `Заказ #${n} ещё не доставлен, поэтому мы не можем оформить возврат.`));
    chk('refund.not_already_refunded', bal > 0, 'deny', t(`Refundable balance $${bal}.`, `Доступно к возврату $${bal}.`), t('Nothing left to refund.', 'Возвращать больше нечего.'), t(`Order #${n} has already been refunded.`, `По заказу #${n} возврат уже оформлен.`));
    if (dlv) { const w = t(`Delivered ${days(d)} ago (window: 30 days).`, `Доставлен ${days(d)} назад (окно: 30 дней).`); chk('refund.within_window', d <= 30, 'deny', w, w, t(`Order #${n} was delivered ${days(d)} ago, which is outside our 30-day refund window, so we cannot refund it.`, `Заказ #${n} доставлен ${days(d)} назад, это вне нашего 30-дневного срока возврата, поэтому мы не можем оформить возврат.`)); }
    chk('refund.auto_approve_limit', bal <= 100, 'needs_approval', t(`Amount $${bal} <= auto-approve limit $100.`, `Сумма $${bal} <= лимита автоодобрения $100.`), t(`Amount $${bal} exceeds auto-approve limit $100.`, `Сумма $${bal} превышает лимит автоодобрения $100.`));
    chk('refund.vip_review', !cust?.vip, 'needs_approval', t('Not a VIP account.', 'Не VIP-аккаунт.'), t('VIP account: a human reviews the refund.', 'VIP-аккаунт: возврат проверяет человек.'));
    chk('refund.sentiment_review', tr.sentiment !== 'negative', 'needs_approval', t('Sentiment is not negative.', 'Тональность не негативная.'), t('Sentiment is negative.', 'Тональность негативная.'));
    return cs;
  }

  async function run(tk) {
    const my = ++token, log = [];
    const L = (node, kind, s) => { log.push(`${new Date().toISOString().slice(11, 19)} ${node} [${kind}] ${s}`); $('#log').textContent = log.join('\n'); };
    el.querySelectorAll('#tk button').forEach(b => { const on = TICKETS[b.dataset.i] === tk; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
    $('#msg').textContent = `${tk.from}: ${tk.text[lang]}`; $('#steps').innerHTML = ''; $('#act').innerHTML = ''; $('#reply').innerHTML = '';
    // Each step is a list of lines {tag?, c?, code?, m}; the same lines go to the screen and the audit log. A newer run makes older ones stop.
    const step = async (title, node, kind, lines, cls = 'on') => {
      if (my !== token) throw STOP;
      $('#steps').insertAdjacentHTML('beforeend', `<div class="step ${cls}"><b>${esc(title)}</b>${lines.map(x => `<div>${x.tag ? `<span class="${x.c}">${esc(x.tag)}</span> ` : ''}${x.code ? `<code>${esc(x.code)}</code> ` : ''}${esc(x.m || '')}</div>`).join('')}</div>`);
      lines.forEach(x => L(node, kind, [x.tag, x.code, x.m].filter(Boolean).join(' ')));
      await sleep(550);
      if (my !== token) throw STOP;
    };
    const guard = fn => async () => { try { await fn(); } catch (e) { if (e !== STOP) throw e; } };
    const done = (sum, reply, focus) => {
      if (my !== token) return;
      $('#reply').innerHTML = `<div class="step on"><b>${t('Result', 'Итог')}</b> <code>${esc(sum)}</code></div><label>${t('Draft reply (fixed template; the real agent writes it with the LLM)', 'Черновик ответа (готовый шаблон; настоящий агент пишет его с помощью LLM)')}</label><div class="out" tabindex="-1">${esc(reply)}</div>`;
      L('draft_reply', 'REPLY', sum);
      if (focus) $('#reply .out').focus();
    };
    try {
      const tr = triage(tk.text[lang]);
      await step(t('1 · Triage → JSON (keyword stand-in for the LLM)', '1 · Разбор → JSON (ключевые слова вместо LLM)'), 'classify', 'KEYWORDS', [{ code: JSON.stringify(tr) }]);
      const raw = tr.order_id && ORDERS[tr.order_id], o = raw ? { id: tr.order_id, ...raw } : null, cust = CUSTOMERS[tk.from] || null, nf = t('not found', 'не найден');
      const lk = [];
      if (tr.order_id) lk.push({ code: `get_order('${tr.order_id}')`, m: '→ ' + (raw ? JSON.stringify(raw) : nf) });
      if (tr.intent !== 'other') lk.push({ code: `get_customer('${tk.from}')`, m: '→ ' + (cust ? JSON.stringify(cust) : nf) });
      await step(t('2 · Lookups (read-only tools)', '2 · Запросы (read-only инструменты)'), 'lookup_tools', 'TOOL', lk.length ? lk : [{ m: t('no lookups needed', 'запросы не нужны') }]);
      const cs = rules(tr, o, tk.from, cust), worst = cs.reduce((a, c) => (SEV.indexOf(c.v) > SEV.indexOf(a) ? c.v : a), 'pass');
      const verdict = worst !== 'pass' ? worst : tr.intent === 'refund_request' ? 'auto_approve' : 'inform';
      await step(t('3 · Rules (plain Python)', '3 · Правила (обычный Python)'), 'apply_policy', 'RULE', cs.map(c => ({ tag: c.v, c: c.v === 'pass' ? 'good' : c.v === 'needs_approval' ? 'warn' : 'bad', code: c.id, m: c.m })), worst === 'pass' ? 'on' : 'stop');
      const VM = { auto_approve: t('the code may act', 'код может действовать'), inform: t('safe to answer', 'можно отвечать'), needs_approval: t('a human decides', 'решает человек'), deny: t('refused by a rule', 'отказ по правилу'), escalate: t('passed to a human', 'передать человеку'), request_info: t('ask the customer', 'запросить данные у клиента') };
      await step('4 · ' + t('Verdict', 'Вердикт'), 'apply_policy', 'DECISION', [{ code: verdict, m: VM[verdict] }], worst === 'pass' ? 'on' : 'stop');
      const bal = o && o.total - o.refunded, sum = `verdict=${verdict}` + (RES[verdict] ? ` · resolution=${RES[verdict]}` : '');
      const refundReply = t(`We are sorry! We have issued a refund of $${bal} for order #${tr.order_id} to your original payment method.`, `Приносим извинения! Мы оформили возврат $${bal} по заказу #${tr.order_id} на способ оплаты, которым вы платили.`);
      const refund = () => step('5 · ' + t('Action (code, not the model)', 'Действие (код, не модель)'), 'execute_action', 'ACTION', [{ code: `create_refund('${tr.order_id}', $${bal})`, m: t('→ simulated, there is no real store here', '→ имитация, настоящего магазина здесь нет') }]);
      if (verdict === 'inform') return done(sum, o.status === 'delivered' ? t(`Your order #${o.id} was delivered ${days(o.days_since_delivery)} ago.`, `Ваш заказ #${o.id} доставлен ${days(o.days_since_delivery)} назад.`) : t(`Your order #${o.id} has shipped and is expected in ${days(o.eta_days)}. Thanks for your patience!`, `Ваш заказ #${o.id} отправлен, ожидаем доставку через ${days(o.eta_days)}. Спасибо за терпение!`));
      if (verdict === 'auto_approve') { await refund(); return done(sum, refundReply); }
      if (verdict === 'needs_approval') {
        const why = cs.filter(c => c.v === 'needs_approval').map(c => c.m).join(' ');
        $('#act').innerHTML = `<p class="warn">⏸ ${esc(t('Paused for human approval: ', 'Пауза, нужно решение человека: ') + why)}</p><div class="row"><button class="ok" id="ap"><span aria-hidden="true">✓</span> ${t('Approve', 'Одобрить')}</button><button class="no" id="rj"><span aria-hidden="true">✗</span> ${t('Reject', 'Отклонить')}</button></div>`;
        L('human_approval', 'APPROVAL', t('paused, waiting for an operator: ', 'пауза, ждём оператора: ') + why);
        $('#ap').onclick = guard(async () => { $('#act').innerHTML = ''; L('human_approval', 'APPROVAL', t('approved by the operator (you)', 'одобрено оператором (вами)')); await refund(); done(`verdict=needs_approval · ${t('approved by operator', 'одобрено оператором')} · resolution=refund_issued`, refundReply, true); });
        $('#rj').onclick = guard(async () => { $('#act').innerHTML = ''; L('human_approval', 'APPROVAL', t('rejected by the operator (you)', 'отклонено оператором (вами)')); done(`verdict=needs_approval · ${t('rejected by operator', 'отклонено оператором')}`, t('Thank you for your message. We reviewed your request and cannot process this refund.', 'Спасибо за обращение. Мы рассмотрели запрос и не можем оформить этот возврат.'), true); });
        return;
      }
      if (verdict === 'escalate') await step('5 · ' + t('Action (code, not the model)', 'Действие (код, не модель)'), 'escalate', 'ACTION', [{ code: 'escalate_to_human', m: t('→ simulated: passed to a human', '→ имитация: передано человеку') + (cs.some(c => c.id === 'identity.order_owner' && c.v === 'escalate') ? t(', priority high', ', приоритет высокий') : '') }]);
      done(sum, cs.find(c => c.v === verdict).r);
    } catch (e) { if (e !== STOP) throw e; }
  }
  el.querySelectorAll('#tk button').forEach(b => (b.onclick = () => run(TICKETS[b.dataset.i])));
  run(TICKETS[0]);
}
