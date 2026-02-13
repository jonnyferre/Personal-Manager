'use strict';

/* ========= Helpers ========= */
const $ = (s, el = document) => el.querySelector(s);
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const fmtEUR = (n) => Number(n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const pad2 = (x) => String(x).padStart(2, '0');
const fmtISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const monthName = (m) => ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m];

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') n.appendChild(document.createTextNode(c));
    else if (c) n.appendChild(c);
  }
  return n;
}

function kpiItem(label, value, hint) {
  return el('div', { class: 'kpi__item' }, [
    el('div', { class: 'kpi__label', text: label }),
    el('div', { class: 'kpi__value', text: value }),
    el('div', { class: 'kpi__hint', text: hint }),
  ]);
}
function help(t) { return el('div', { class: 'minihelp', text: t }); }

function fieldText(label, val, ph, onChange) {
  const w = el('div', { class: 'field' });
  w.appendChild(el('div', { class: 'label', text: label }));
  const i = el('input', { class: 'input', value: val ?? '', placeholder: ph ?? '', type: 'text' });
  i.addEventListener('input', () => onChange(i.value));
  w.appendChild(i);
  return w;
}
function fieldNumber(label, val, ph, onChange, step='0.01') {
  const w = el('div', { class: 'field' });
  w.appendChild(el('div', { class: 'label', text: label }));
  const i = el('input', { class: 'input', value: val ?? '', placeholder: ph ?? '', type: 'number', step });
  i.addEventListener('input', () => onChange(i.value === '' ? '' : Number(i.value)));
  w.appendChild(i);
  return w;
}
function fieldDate(label, val, onChange) {
  const w = el('div', { class: 'field' });
  w.appendChild(el('div', { class: 'label', text: label }));
  const i = el('input', { class: 'input', value: val ?? '', type: 'date' });
  i.addEventListener('input', () => onChange(i.value));
  w.appendChild(i);
  return w;
}
function fieldSelect(label, val, opts, onChange) {
  const w = el('div', { class: 'field' });
  w.appendChild(el('div', { class: 'label', text: label }));
  const s = el('select', { class: 'select' });
  opts.forEach(o => {
    const op = el('option', { value: o.value, text: o.label });
    if (String(o.value) === String(val)) op.selected = true;
    s.appendChild(op);
  });
  s.addEventListener('change', () => onChange(s.value));
  w.appendChild(s);
  return w;
}

function modalFoot(buttons) {
  const w = el('div');
  buttons.forEach(b => {
    const bt = el('button', { class: b.kind || 'btn', text: b.text });
    bt.addEventListener('click', b.onClick);
    w.appendChild(bt);
  });
  return w;
}

/* ========= State / Storage ========= */
const KEY = 'pm_data_v3';

const defaults = {
  app: { name: 'Personal Manager' },
  economy: {
    ui: { tab: 'accounts' },
    accounts: [{ id: uid(), name: 'Cuenta principal', bank: '', initialBalance: 0, cards: [] }],
    movements: {},     // { [accountId]: [ {id,date,type,amount,title,note} ] }
    fixed: [],         // {id,title,amount,day,accountId,note,active}
    credits: [],       // {id,title,amount,day,accountId,note,active}
    goals: [],         // {id,title,target,deadline,accountId,history:[{id,date,type,in/out,amount,note}]}
  }
};

function load() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return structuredClone(defaults);
  try {
    const d = JSON.parse(raw);
    const out = structuredClone(defaults);

    out.app = { ...out.app, ...(d.app || {}) };
    out.economy = { ...out.economy, ...(d.economy || {}) };
    out.economy.ui = { ...out.economy.ui, ...((d.economy || {}).ui || {}) };

    out.economy.accounts = Array.isArray((d.economy || {}).accounts) ? d.economy.accounts : out.economy.accounts;
    out.economy.movements = (d.economy || {}).movements || {};
    out.economy.fixed = Array.isArray((d.economy || {}).fixed) ? d.economy.fixed : [];
    out.economy.credits = Array.isArray((d.economy || {}).credits) ? d.economy.credits : [];
    out.economy.goals = Array.isArray((d.economy || {}).goals) ? d.economy.goals : [];

    out.economy.accounts.forEach(a => { if (!Array.isArray(a.cards)) a.cards = []; });
    return out;
  } catch {
    return structuredClone(defaults);
  }
}

const state = {
  data: load(),
  view: 'home',
  params: {},
  stack: [],
  toastTimer: null,
};

function save() { localStorage.setItem(KEY, JSON.stringify(state.data)); }

/* ========= Toast / Modal ========= */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => t.classList.add('hidden'), 1700);
}

function openModal(title, body, foot) {
  $('#modalTitle').textContent = title;
  const b = $('#modalBody');
  const f = $('#modalFoot');
  b.innerHTML = '';
  f.innerHTML = '';
  b.appendChild(body);
  f.appendChild(foot);
  $('#overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  $('#overlay').classList.add('hidden');
  document.body.style.overflow = '';
}
$('#modalClose').addEventListener('click', closeModal);
$('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') closeModal(); });

/* ========= Topbar / Router ========= */
function setTopbar(title, subtitle, canBack, showAdd) {
  $('#brandTitle').textContent = title;
  $('#viewSubtitle').textContent = subtitle || '';
  $('#btnBack').style.visibility = canBack ? 'visible' : 'hidden';
  $('#btnQuickAdd').style.visibility = showAdd ? 'visible' : 'hidden';
}

function push(view, params = {}) {
  state.stack.push({ view: state.view, params: state.params });
  state.view = view;
  state.params = params;
  render();
}
function pop() {
  const p = state.stack.pop();
  if (!p) { state.view = 'home'; state.params = {}; render(); return; }
  state.view = p.view;
  state.params = p.params;
  render();
}
$('#btnBack').addEventListener('click', pop);

/* ========= Economy helpers ========= */
function getAcc(id) { return state.data.economy.accounts.find(a => a.id === id) || null; }
function movs(id) {
  if (!Array.isArray(state.data.economy.movements[id])) state.data.economy.movements[id] = [];
  return state.data.economy.movements[id];
}
function accBalance(id) {
  const a = getAcc(id);
  if (!a) return 0;
  const delta = movs(id).reduce((t, x) => t + (x.type === 'income' ? Number(x.amount||0) : -Number(x.amount||0)), 0);
  return Number(a.initialBalance || 0) + delta;
}
function totalCardUsed() {
  let u = 0;
  state.data.economy.accounts.forEach(a => (a.cards || []).forEach(c => u += Number(c.used || 0)));
  return u;
}
function totalPending() {
  const fixed = state.data.economy.fixed.filter(x => x.active).reduce((s, x) => s + Number(x.amount || 0), 0);
  const credits = state.data.economy.credits.filter(x => x.active).reduce((s, x) => s + Number(x.amount || 0), 0);
  return { fixed, credits, total: fixed + credits };
}
function totals() {
  const total = state.data.economy.accounts.reduce((s, a) => s + accBalance(a.id), 0);
  const pending = totalPending().total;
  const cardUsed = totalCardUsed();
  const available = total - pending - cardUsed;
  return { total, pending, cardUsed, available };
}
function accOpts() {
  return [{ value: '', label: '(Selecciona cuenta)' }].concat(
    state.data.economy.accounts.map(a => ({ value: a.id, label: a.name }))
  );
}
function tabBtn(label, value, active) {
  const b = el('button', { class: `tab ${active === value ? 'active' : ''}`, text: label });
  b.addEventListener('click', () => { state.data.economy.ui.tab = value; render(); });
  return b;
}

/* ========= Views ========= */
function tile(title, icon, onClick) {
  const t = el('div', { class: 'tile' });
  t.addEventListener('click', onClick);
  t.appendChild(el('div', { class: 'tile__title', text: title }));
  t.appendChild(el('div', { class: 'tile__badge', text: icon }));
  return t;
}

function renderHome() {
  const c = el('div', { class: 'card' });
  const b = el('div', { class: 'card__body' });
  const g = el('div', { class: 'bigtiles' });
  g.appendChild(tile('Economía', '💳', () => push('economy')));
  g.appendChild(tile('Trabajo', '🗓️', () => toast('Trabajo: lo metemos en el siguiente ZIP')));
  g.appendChild(tile('Agenda', '📌', () => toast('Agenda: lo metemos en el siguiente ZIP')));
  b.appendChild(g);
  c.appendChild(b);
  return c;
}

function renderEconomy() {
  const wrap = el('div', { class: 'grid cols-1' });
  const t = totals();

  const sum = el('div', { class: 'card' });
  const body = el('div', { class: 'card__body' });

  const kpi = el('div', { class: 'kpi' });
  kpi.appendChild(kpiItem('Saldo total', fmtEUR(t.total), 'Suma de todas las cuentas'));
  kpi.appendChild(kpiItem('Disponible', fmtEUR(t.available), 'Saldo - pendientes - tarjetas'));
  kpi.appendChild(kpiItem('Pendiente', fmtEUR(t.pending), 'Gastos fijos + créditos'));
  kpi.appendChild(kpiItem('Tarjetas', fmtEUR(t.cardUsed), 'Consumido total en tarjetas'));

  body.appendChild(kpi);
  body.appendChild(el('div', { class: 'hr' }));

  const tabs = el('div', { class: 'tabs' });
  const active = state.data.economy.ui.tab || 'accounts';
  tabs.appendChild(tabBtn('Cuentas', 'accounts', active));
  tabs.appendChild(tabBtn('Gastos fijos', 'fixed', active));
  tabs.appendChild(tabBtn('Créditos', 'credits', active));
  tabs.appendChild(tabBtn('Metas', 'goals', active));
  body.appendChild(tabs);

  sum.appendChild(body);
  wrap.appendChild(sum);

  if (active === 'accounts') wrap.appendChild(renderAccounts());
  if (active === 'fixed') wrap.appendChild(renderFixed());
  if (active === 'credits') wrap.appendChild(renderCredits());
  if (active === 'goals') wrap.appendChild(renderGoals());

  return wrap;
}

/* ========= Accounts list ========= */
function renderAccounts() {
  const card = el('div', { class: 'card' });
  const body = el('div', { class: 'card__body' });

  body.appendChild(el('div', { class: 'card__title', text: 'Cuentas' }));
  body.appendChild(el('div', { class: 'row', style: 'margin-top:10px;' }, [
    el('button', { class: 'btn primary', text: 'Añadir cuenta', onClick: openAddAccount })
  ]));

  const list = el('div', { class: 'list', style: 'margin-top:12px;' });

  state.data.economy.accounts.forEach(a => {
    const it = el('div', { class: 'item' });
    it.appendChild(el('div', { class: 'item__main' }, [
      el('div', { class: 'item__title', text: a.name }),
      el('div', { class: 'item__meta', text: a.bank || 'Cuenta' }),
    ]));
    const right = el('div', { class: 'item__right' });
    right.appendChild(el('span', { class: 'badge', text: fmtEUR(accBalance(a.id)) }));
    right.appendChild(el('button', { class: 'btn primary', text: 'Abrir', onClick: () => push('account', { accountId: a.id }) }));
    right.appendChild(el('button', { class: 'btn', text: 'Editar', onClick: () => openEditAccount(a.id) }));
    it.appendChild(right);
    list.appendChild(it);
  });

  body.appendChild(list);
  card.appendChild(body);
  return card;
}

function openAddAccount() {
  const d = { name: '', bank: '', initialBalance: 0 };
  const w = el('div', { class: 'form' });
  w.appendChild(fieldText('Nombre', d.name, 'Ej: Santander', v => d.name = v));
  w.appendChild(fieldText('Banco (opcional)', d.bank, '', v => d.bank = v));
  w.appendChild(fieldNumber('Saldo inicial', d.initialBalance, '0', v => d.initialBalance = v));

  openModal('Nueva cuenta', w, modalFoot([
    { text: 'Cancelar', kind: 'btn', onClick: closeModal },
    { text: 'Crear', kind: 'btn primary', onClick: () => {
      if (!d.name.trim()) return toast('Pon un nombre');
      state.data.economy.accounts.push({ id: uid(), name: d.name.trim(), bank: (d.bank || '').trim(), initialBalance: Number(d.initialBalance || 0), cards: [] });
      toast('Cuenta creada'); closeModal(); render();
    }},
  ]));
}

function openEditAccount(id) {
  const a = getAcc(id);
  if (!a) return;
  const d = structuredClone(a);

  const w = el('div', { class: 'form' });
  w.appendChild(fieldText('Nombre', d.name, '', v => d.name = v));
  w.appendChild(fieldText('Banco (opcional)', d.bank, '', v => d.bank = v));
  w.appendChild(fieldNumber('Saldo inicial', d.initialBalance, '0', v => d.initialBalance = v));

  openModal('Editar cuenta', w, modalFoot([
    { text: 'Cerrar', kind: 'btn', onClick: closeModal },
    { text: 'Guardar', kind: 'btn primary', onClick: () => {
      a.name = (d.name || '').trim() || a.name;
      a.bank = (d.bank || '').trim();
      a.initialBalance = Number(d.initialBalance || 0);
      toast('Guardado'); closeModal(); render();
    }},
    { text: 'Borrar cuenta', kind: 'btn bad', onClick: () => {
      if (!confirm('¿Borrar cuenta y movimientos?')) return;
      state.data.economy.accounts = state.data.economy.accounts.filter(x => x.id !== id);
      delete state.data.economy.movements[id];
      toast('Cuenta borrada'); closeModal(); render();
    }},
  ]));
}

/* ========= Account detail ========= */
function renderAccount(id) {
  const a = getAcc(id);
  if (!a) return el('div', { class: 'card' }, [el('div', { class: 'card__body', text: 'Cuenta no encontrada.' })]);

  const wrap = el('div', { class: 'grid cols-1' });

  const used = (a.cards || []).reduce((s, c) => s + Number(c.used || 0), 0);

  const top = el('div', { class: 'card' });
  const b = el('div', { class: 'card__body' });

  const k = el('div', { class: 'kpi' });
  k.appendChild(kpiItem('Saldo actual', fmtEUR(accBalance(id)), 'Saldo inicial + movimientos'));
  k.appendChild(kpiItem('Saldo inicial', fmtEUR(a.initialBalance || 0), 'Editable'));
  k.appendChild(kpiItem('Tarjetas (consumido)', fmtEUR(used), 'Dentro de esta cuenta'));
  k.appendChild(kpiItem('Movimientos', String(movs(id).length), 'Ingresos y gastos'));
  b.appendChild(k);
  b.appendChild(el('div', { class: 'hr' }));
  b.appendChild(el('div', { class: 'row' }, [
    el('button', { class: 'btn primary', text: 'Añadir movimiento', onClick: () => openAddMovement(id) }),
    el('button', { class: 'btn', text: 'Añadir tarjeta', onClick: () => openAddCard(id) }),
    el('button', { class: 'btn', text: 'Editar cuenta', onClick: () => openEditAccount(id) }),
  ]));

  top.appendChild(b);
  wrap.appendChild(top);

  // Tarjetas
  const cards = el('div', { class: 'card' });
  const cb = el('div', { class: 'card__body' });
  cb.appendChild(el('div', { class: 'card__title', text: 'Tarjetas' }));
  cb.appendChild(el('div', { class: 'card__subtitle', text: 'Límite, consumido y día de cobro.' }));

  const cl = el('div', { class: 'list', style: 'margin-top:12px;' });
  if (!(a.cards || []).length) cl.appendChild(help('No hay tarjetas.'));
  (a.cards || []).forEach(c => {
    const it = el('div', { class: 'item' });
    it.appendChild(el('div', { class: 'item__main' }, [
      el('div', { class: 'item__title', text: c.title || 'Tarjeta' }),
      el('div', { class: 'item__meta', text: `Límite ${fmtEUR(c.limit||0)} • Consumido ${fmtEUR(c.used||0)} • Cobro día ${c.day||1}` }),
    ]));
    const r = el('div', { class: 'item__right' });
    r.appendChild(el('span', { class: 'badge', text: fmtEUR(Number(c.limit||0) - Number(c.used||0)) }));
    r.appendChild(el('button', { class: 'btn', text: 'Editar', onClick: () => openEditCard(id, c.id) }));
    r.appendChild(el('button', { class: 'btn bad', text: 'Borrar', onClick: () => {
      if (!confirm('¿Borrar tarjeta?')) return;
      a.cards = a.cards.filter(x => x.id !== c.id);
      toast('Tarjeta borrada'); render();
    }}));
    it.appendChild(r);
    cl.appendChild(it);
  });
  cb.appendChild(cl);
  cards.appendChild(cb);
  wrap.appendChild(cards);

  // Movimientos
  const mcard = el('div', { class: 'card' });
  const mb = el('div', { class: 'card__body' });
  mb.appendChild(el('div', { class: 'card__title', text: 'Movimientos' }));

  const ml = el('div', { class: 'list', style: 'margin-top:12px;' });
  const sorted = movs(id).slice().sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  if (!sorted.length) ml.appendChild(help('Aún no hay movimientos.'));

  sorted.forEach(mv => {
    const it = el('div', { class: 'item' });
    it.appendChild(el('div', { class: 'item__main' }, [
      el('div', { class: 'item__title', text: mv.title || '(sin título)' }),
      el('div', { class: 'item__meta', text: `${mv.date || ''} • ${mv.type === 'income' ? 'Ingreso' : 'Gasto'}${mv.note ? ' • ' + mv.note : ''}` }),
    ]));
    const r = el('div', { class: 'item__right' });
    r.appendChild(el('span', { class: `badge ${mv.type === 'income' ? 'good' : 'bad'}`, text: (mv.type === 'income' ? '+' : '-') + fmtEUR(mv.amount) }));
    r.appendChild(el('button', { class: 'btn', text: 'Editar', onClick: () => openEditMovement(id, mv.id) }));
    r.appendChild(el('button', { class: 'btn bad', text: 'Borrar', onClick: () => {
      if (!confirm('¿Borrar movimiento?')) return;
      state.data.economy.movements[id] = movs(id).filter(x => x.id !== mv.id);
      toast('Borrado'); render();
    }}));
    it.appendChild(r);
    ml.appendChild(it);
  });

  mb.appendChild(ml);
  mcard.appendChild(mb);
  wrap.appendChild(mcard);

  return wrap;
}

/* ========= Cards ========= */
function openAddCard(accId) {
  const a = getAcc(accId); if (!a) return;
  const d = { title:'', limit:0, used:0, day:1, note:'' };
  const w = el('div', { class:'form' });
  w.appendChild(fieldText('Nombre', d.title, 'Ej: VISA', v => d.title = v));
  const two = el('div', { class:'two' });
  two.appendChild(fieldNumber('Límite (€)', d.limit, '0', v => d.limit = v));
  two.appendChild(fieldNumber('Consumido (€)', d.used, '0', v => d.used = v));
  w.appendChild(two);
  w.appendChild(fieldNumber('Día de cobro (1-28)', d.day, '1', v => d.day = v, '1'));
  w.appendChild(fieldText('Nota (opcional)', d.note, '', v => d.note = v));
  openModal('Nueva tarjeta', w, modalFoot([
    { text:'Cancelar', kind:'btn', onClick: closeModal },
    { text:'Guardar', kind:'btn primary', onClick: () => {
      a.cards.push({
        id: uid(),
        title: (d.title||'').trim(),
        limit: Number(d.limit||0),
        used: Number(d.used||0),
        day: Math.min(Math.max(Number(d.day||1),1),28),
        note: (d.note||'').trim()
      });
      toast('Tarjeta guardada'); closeModal(); render();
    }}
  ]));
}
function openEditCard(accId, cardId) {
  const a = getAcc(accId); if (!a) return;
  const c = (a.cards || []).find(x => x.id === cardId); if (!c) return;
  const d = structuredClone(c);
  const w = el('div', { class:'form' });
  w.appendChild(fieldText('Nombre', d.title, 'Ej: VISA', v => d.title = v));
  const two = el('div', { class:'two' });
  two.appendChild(fieldNumber('Límite (€)', d.limit, '0', v => d.limit = v));
  two.appendChild(fieldNumber('Consumido (€)', d.used, '0', v => d.used = v));
  w.appendChild(two);
  w.appendChild(fieldNumber('Día de cobro (1-28)', d.day, '1', v => d.day = v, '1'));
  w.appendChild(fieldText('Nota (opcional)', d.note, '', v => d.note = v));
  openModal('Editar tarjeta', w, modalFoot([
    { text:'Cerrar', kind:'btn', onClick: closeModal },
    { text:'Guardar', kind:'btn primary', onClick: () => {
      c.title = (d.title||'').trim();
      c.limit = Number(d.limit||0);
      c.used = Number(d.used||0);
      c.day = Math.min(Math.max(Number(d.day||1),1),28);
      c.note = (d.note||'').trim();
      toast('Tarjeta actualizada'); closeModal(); render();
    }}
  ]));
}

/* ========= Movements ========= */
function openAddMovement(accId) {
  const d = { date: fmtISO(new Date()), type: 'expense', amount: '', title: '', note: '' };
  const w = el('div', { class:'form' });
  w.appendChild(fieldDate('Fecha', d.date, v => d.date = v));
  w.appendChild(fieldSelect('Tipo', d.type, [{value:'expense',label:'Gasto'},{value:'income',label:'Ingreso'}], v => d.type = v));
  w.appendChild(fieldNumber('Importe (€)', d.amount, '0', v => d.amount = v));
  w.appendChild(fieldText('Título', d.title, 'Ej: Glovo', v => d.title = v));
  w.appendChild(fieldText('Nota (opcional)', d.note, '', v => d.note = v));
  openModal('Nuevo movimiento', w, modalFoot([
    { text:'Cancelar', kind:'btn', onClick: closeModal },
    { text:'Guardar', kind:'btn primary', onClick: () => {
      if (!d.amount || Number(d.amount) <= 0) return toast('Importe inválido');
      movs(accId).push({
        id: uid(),
        date: d.date,
        type: d.type,
        amount: Number(d.amount),
        title: (d.title||'').trim(),
        note: (d.note||'').trim()
      });
      toast('Movimiento guardado'); closeModal(); render();
    }}
  ]));
}
function openEditMovement(accId, movId) {
  const m = movs(accId).find(x => x.id === movId); if (!m) return;
  const d = structuredClone(m);
  const w = el('div', { class:'form' });
  w.appendChild(fieldDate('Fecha', d.date, v => d.date = v));
  w.appendChild(fieldSelect('Tipo', d.type, [{value:'expense',label:'Gasto'},{value:'income',label:'Ingreso'}], v => d.type = v));
  w.appendChild(fieldNumber('Importe (€)', d.amount, '0', v => d.amount = v));
  w.appendChild(fieldText('Título', d.title, '', v => d.title = v));
  w.appendChild(fieldText('Nota (opcional)', d.note, '', v => d.note = v));
  openModal('Editar movimiento', w, modalFoot([
    { text:'Cerrar', kind:'btn', onClick: closeModal },
    { text:'Guardar', kind:'btn primary', onClick: () => {
      if (!d.amount || Number(d.amount) <= 0) return toast('Importe inválido');
      m.date = d.date; m.type = d.type; m.amount = Number(d.amount);
      m.title = (d.title||'').trim(); m.note = (d.note||'').trim();
      toast('Actualizado'); closeModal(); render();
    }}
  ]));
}

/* ========= Fixed ========= */
function renderFixed() {
  const card = el('div', { class:'card' });
  const b = el('div', { class:'card__body' });
  b.appendChild(el('div', { class:'card__title', text:'Gastos fijos' }));
  b.appendChild(el('div', { class:'card__subtitle', text:'Suscripciones/recibos con día de cobro + cuenta.' }));

  b.appendChild(el('div', { class:'row', style:'margin-top:10px;' }, [
    el('button', { class:'btn primary', text:'Añadir gasto fijo', onClick: openAddFixed })
  ]));

  const list = el('div', { class:'list', style:'margin-top:12px;' });
  if (!state.data.economy.fixed.length) list.appendChild(help('No hay gastos fijos aún.'));

  state.data.economy.fixed.forEach(f => {
    const a = getAcc(f.accountId);
    const it = el('div', { class:'item' });
    it.appendChild(el('div', { class:'item__main' }, [
      el('div', { class:'item__title', text: f.title }),
      el('div', { class:'item__meta', text: `Día ${f.day} • ${a ? a.name : 'Sin cuenta'}${f.note ? ' • ' + f.note : ''}` }),
    ]));
    const r = el('div', { class:'item__right' });
    r.appendChild(el('span', { class:'badge', text: fmtEUR(f.amount) }));
    r.appendChild(el('span', { class:`badge ${f.active ? 'good' : 'warn'}`, text: f.active ? 'Activo' : 'Pausado' }));
    r.appendChild(el('button', { class:'btn', text:'Editar', onClick: () => openEditFixed(f.id) }));
    r.appendChild(el('button', { class:'btn bad', text:'Borrar', onClick: () => {
      if (!confirm('¿Borrar gasto fijo?')) return;
      state.data.economy.fixed = state.data.economy.fixed.filter(x => x.id !== f.id);
      toast('Borrado'); render();
    }}));
    it.appendChild(r);
    list.appendChild(it);
  });

  b.appendChild(list);
  card.appendChild(b);
  return card;
}

function openAddFixed() {
  const d = { title:'', amount:'', day:1, accountId:'', note:'', active:true };
  const w = el('div', { class:'form' });
  w.appendChild(fieldText('Título', d.title, 'Ej: Netflix', v => d.title = v));
  w.appendChild(fieldNumber('Importe (€)', d.amount, '0', v => d.amount = v));
  w.appendChild(fieldNumber('Día de cobro (1-28)', d.day, '1', v => d.day = v, '1'));
  w.appendChild(fieldSelect('Cuenta asociada', d.accountId, accOpts(), v => d.accountId = v));
  w.appendChild(fieldText('Nota (opcional)', d.note, '', v => d.note = v));
  w.appendChild(fieldSelect('Estado', d.active ? '1' : '0', [{value:'1',label:'Activo'},{value:'0',label:'Pausado'}], v => d.active = (v === '1')));

  openModal('Nuevo gasto fijo', w, modalFoot([
    { text:'Cancelar', kind:'btn', onClick: closeModal },
    { text:'Guardar', kind:'btn primary', onClick: () => {
      if (!d.title.trim()) return toast('Pon un título');
      if (!d.amount || Number(d.amount) <= 0) return toast('Importe inválido');
      state.data.economy.fixed.push({
        id: uid(),
        title: d.title.trim(),
        amount: Number(d.amount),
        day: Math.min(Math.max(Number(d.day||1),1),28),
        accountId: d.accountId,
        note: (d.note||'').trim(),
        active: !!d.active
      });
      toast('Guardado'); closeModal(); render();
    }}
  ]));
}
function openEditFixed(id) {
  const f = state.data.economy.fixed.find(x => x.id === id); if (!f) return;
  const d = structuredClone(f);

  const w = el('div', { class:'form' });
  w.appendChild(fieldText('Título', d.title, '', v => d.title = v));
  w.appendChild(fieldNumber('Importe (€)', d.amount, '0', v => d.amount = v));
  w.appendChild(fieldNumber('Día de cobro (1-28)', d.day, '1', v => d.day = v, '1'));
  w.appendChild(fieldSelect('Cuenta asociada', d.accountId, accOpts(), v => d.accountId = v));
  w.appendChild(fieldText('Nota (opcional)', d.note, '', v => d.note = v));
  w.appendChild(fieldSelect('Estado', d.active ? '1' : '0', [{value:'1',label:'Activo'},{value:'0',label:'Pausado'}], v => d.active = (v === '1')));

  openModal('Editar gasto fijo', w, modalFoot([
    { text:'Cerrar', kind:'btn', onClick: closeModal },
    { text:'Guardar', kind:'btn primary', onClick: () => {
      f.title = (d.title||'').trim() || f.title;
      f.amount = Number(d.amount||0);
      f.day = Math.min(Math.max(Number(d.day||1),1),28);
      f.accountId = d.accountId;
      f.note = (d.note||'').trim();
      f.active = !!d.active;
      toast('Actualizado'); closeModal(); render();
    }}
  ]));
}

/* ========= Credits ========= */
function renderCredits() {
  const card = el('div', { class:'card' });
  const b = el('div', { class:'card__body' });
  b.appendChild(el('div', { class:'card__title', text:'Créditos' }));
  b.appendChild(el('div', { class:'card__subtitle', text:'Cuotas mensuales asociadas a una cuenta.' }));

  b.appendChild(el('div', { class:'row', style:'margin-top:10px;' }, [
    el('button', { class:'btn primary', text:'Añadir crédito', onClick: openAddCredit })
  ]));

  const list = el('div', { class:'list', style:'margin-top:12px;' });
  if (!state.data.economy.credits.length) list.appendChild(help('No hay créditos aún.'));

  state.data.economy.credits.forEach(c => {
    const a = getAcc(c.accountId);
    const it = el('div', { class:'item' });
    it.appendChild(el('div', { class:'item__main' }, [
      el('div', { class:'item__title', text: c.title }),
      el('div', { class:'item__meta', text: `Día ${c.day} • ${a ? a.name : 'Sin cuenta'}${c.note ? ' • ' + c.note : ''}` }),
    ]));
    const r = el('div', { class:'item__right' });
    r.appendChild(el('span', { class:'badge', text: fmtEUR(c.amount) }));
    r.appendChild(el('span', { class:`badge ${c.active ? 'good' : 'warn'}`, text: c.active ? 'Activo' : 'Pausado' }));
    r.appendChild(el('button', { class:'btn', text:'Editar', onClick: () => openEditCredit(c.id) }));
    r.appendChild(el('button', { class:'btn bad', text:'Borrar', onClick: () => {
      if (!confirm('¿Borrar crédito?')) return;
      state.data.economy.credits = state.data.economy.credits.filter(x => x.id !== c.id);
      toast('Borrado'); render();
    }}));
    it.appendChild(r);
    list.appendChild(it);
  });

  b.appendChild(list);
  card.appendChild(b);
  return card;
}
function openAddCredit() {
  const d = { title:'', amount:'', day:1, accountId:'', note:'', active:true };
  const w = el('div', { class:'form' });
  w.appendChild(fieldText('Nombre del crédito', d.title, 'Ej: Préstamo coche', v => d.title = v));
  w.appendChild(fieldNumber('Cuota mensual (€)', d.amount, '0', v => d.amount = v));
  w.appendChild(fieldNumber('Día de cobro (1-28)', d.day, '1', v => d.day = v, '1'));
  w.appendChild(fieldSelect('Cuenta asociada', d.accountId, accOpts(), v => d.accountId = v));
  w.appendChild(fieldText('Nota (opcional)', d.note, '', v => d.note = v));
  w.appendChild(fieldSelect('Estado', d.active ? '1' : '0', [{value:'1',label:'Activo'},{value:'0',label:'Pausado'}], v => d.active = (v === '1')));

  openModal('Nuevo crédito', w, modalFoot([
    { text:'Cancelar', kind:'btn', onClick: closeModal },
    { text:'Guardar', kind:'btn primary', onClick: () => {
      if (!d.title.trim()) return toast('Pon un nombre');
      if (!d.amount || Number(d.amount) <= 0) return toast('Cuota inválida');
      state.data.economy.credits.push({
        id: uid(),
        title: d.title.trim(),
        amount: Number(d.amount),
        day: Math.min(Math.max(Number(d.day||1),1),28),
        accountId: d.accountId,
        note: (d.note||'').trim(),
        active: !!d.active
      });
      toast('Guardado'); closeModal(); render();
    }}
  ]));
}
function openEditCredit(id) {
  const c = state.data.economy.credits.find(x => x.id === id); if (!c) return;
  const d = structuredClone(c);

  const w = el('div', { class:'form' });
  w.appendChild(fieldText('Nombre del crédito', d.title, '', v => d.title = v));
  w.appendChild(fieldNumber('Cuota mensual (€)', d.amount, '0', v => d.amount = v));
  w.appendChild(fieldNumber('Día de cobro (1-28)', d.day, '1', v => d.day = v, '1'));
  w.appendChild(fieldSelect('Cuenta asociada', d.accountId, accOpts(), v => d.accountId = v));
  w.appendChild(fieldText('Nota (opcional)', d.note, '', v => d.note = v));
  w.appendChild(fieldSelect('Estado', d.active ? '1' : '0', [{value:'1',label:'Activo'},{value:'0',label:'Pausado'}], v => d.active = (v === '1')));

  openModal('Editar crédito', w, modalFoot([
    { text:'Cerrar', kind:'btn', onClick: closeModal },
    { text:'Guardar', kind:'btn primary', onClick: () => {
      c.title = (d.title||'').trim() || c.title;
      c.amount = Number(d.amount||0);
      c.day = Math.min(Math.max(Number(d.day||1),1),28);
      c.accountId = d.accountId;
      c.note = (d.note||'').trim();
      c.active = !!d.active;
      toast('Actualizado'); closeModal(); render();
    }}
  ]));
}

/* ========= Goals ========= */
function goalProgress(g) {
  const hist = Array.isArray(g.history) ? g.history : [];
  const saved = hist.reduce((s, h) => s + (h.type === 'in' ? Number(h.amount||0) : -Number(h.amount||0)), 0);
  const target = Number(g.target||0);
  const pct = target > 0 ? Math.max(0, Math.min(1, saved / target)) : 0;
  return { saved, target, pct };
}

function renderGoals() {
  const card = el('div', { class:'card' });
  const b = el('div', { class:'card__body' });
  b.appendChild(el('div', { class:'card__title', text:'Metas' }));
  b.appendChild(el('div', { class:'card__subtitle', text:'Ahorro por objetivos con aportaciones y gastos.' }));

  b.appendChild(el('div', { class:'row', style:'margin-top:10px;' }, [
    el('button', { class:'btn primary', text:'Añadir meta', onClick: openAddGoal })
  ]));

  const list = el('div', { class:'list', style:'margin-top:12px;' });
  if (!state.data.economy.goals.length) list.appendChild(help('No hay metas aún.'));

  state.data.economy.goals.forEach(g => {
    const p = goalProgress(g);
    const it = el('div', { class:'item' });
    it.appendChild(el('div', { class:'item__main' }, [
      el('div', { class:'item__title', text: g.title }),
      el('div', { class:'item__meta', text: `Ahorrado ${fmtEUR(p.saved)} / ${fmtEUR(p.target)} • ${(p.pct*100).toFixed(1)}%` }),
    ]));
    const r = el('div', { class:'item__right' });
    r.appendChild(el('span', { class:'badge', text: fmtEUR(p.target - p.saved) }));
    r.appendChild(el('button', { class:'btn primary', text:'Abrir', onClick: () => openGoalDetail(g.id) }));
    r.appendChild(el('button', { class:'btn', text:'Editar', onClick: () => openEditGoal(g.id) }));
    r.appendChild(el('button', { class:'btn bad', text:'Borrar', onClick: () => {
      if (!confirm('¿Borrar meta?')) return;
      state.data.economy.goals = state.data.economy.goals.filter(x => x.id !== g.id);
      toast('Borrado'); render();
    }}));
    it.appendChild(r);
    list.appendChild(it);
  });

  b.appendChild(list);
  card.appendChild(b);
  return card;
}

function openAddGoal() {
  const d = { title:'', target:'', deadline:'', accountId:'' };
  const w = el('div', { class:'form' });
  w.appendChild(fieldText('Nombre de la meta', d.title, 'Ej: Ahorrar 10k', v => d.title = v));
  w.appendChild(fieldNumber('Objetivo (€)', d.target, '0', v => d.target = v));
  w.appendChild(fieldDate('Fecha objetivo (opcional)', d.deadline, v => d.deadline = v));
  w.appendChild(fieldSelect('Cuenta origen (opcional)', d.accountId, accOpts(), v => d.accountId = v));

  openModal('Nueva meta', w, modalFoot([
    { text:'Cancelar', kind:'btn', onClick: closeModal },
    { text:'Guardar', kind:'btn primary', onClick: () => {
      if (!d.title.trim()) return toast('Pon un nombre');
      if (!d.target || Number(d.target) <= 0) return toast('Objetivo inválido');
      state.data.economy.goals.push({
        id: uid(),
        title: d.title.trim(),
        target: Number(d.target),
        deadline: d.deadline || '',
        accountId: d.accountId || '',
        history: []
      });
      toast('Meta creada'); closeModal(); render();
    }}
  ]));
}

function openEditGoal(id) {
  const g = state.data.economy.goals.find(x => x.id === id); if (!g) return;
  const d = structuredClone(g);

  const w = el('div', { class:'form' });
  w.appendChild(fieldText('Nombre de la meta', d.title, '', v => d.title = v));
  w.appendChild(fieldNumber('Objetivo (€)', d.target, '0', v => d.target = v));
  w.appendChild(fieldDate('Fecha objetivo (opcional)', d.deadline, v => d.deadline = v));
  w.appendChild(fieldSelect('Cuenta origen (opcional)', d.accountId, accOpts(), v => d.accountId = v));

  openModal('Editar meta', w, modalFoot([
    { text:'Cerrar', kind:'btn', onClick: closeModal },
    { text:'Guardar', kind:'btn primary', onClick: () => {
      g.title = (d.title||'').trim() || g.title;
      g.target = Number(d.target||0);
      g.deadline = d.deadline || '';
      g.accountId = d.accountId || '';
      toast('Actualizado'); closeModal(); render();
    }}
  ]));
}

function openGoalDetail(id) {
  const g = state.data.economy.goals.find(x => x.id === id); if (!g) return;
  const p = goalProgress(g);

  const w = el('div', { class:'form' });
  w.appendChild(el('div', { class:'card__title', text: g.title }));
  w.appendChild(help(`Ahorrado: ${fmtEUR(p.saved)} / ${fmtEUR(p.target)} • ${(p.pct*100).toFixed(1)}%`));
  if (g.deadline) w.appendChild(help(`Fecha objetivo: ${g.deadline}`));
  w.appendChild(el('div', { class:'hr' }));

  const list = el('div', { class:'list' });
  const hist = (g.history || []).slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
  if (!hist.length) list.appendChild(help('Sin movimientos en la meta.'));

  hist.forEach(h => {
    const it = el('div', { class:'item' });
    it.appendChild(el('div', { class:'item__main' }, [
      el('div', { class:'item__title', text: h.type === 'in' ? 'Aportación' : 'Gasto' }),
      el('div', { class:'item__meta', text: `${h.date}${h.note ? ' • ' + h.note : ''}` }),
    ]));
    const r = el('div', { class:'item__right' });
    r.appendChild(el('span', { class:`badge ${h.type === 'in' ? 'good' : 'bad'}`, text: (h.type === 'in' ? '+' : '-') + fmtEUR(h.amount) }));
    r.appendChild(el('button', { class:'btn', text:'Editar', onClick: () => { closeModal(); openEditGoalEntry(id, h.id); } }));
    r.appendChild(el('button', { class:'btn bad', text:'Borrar', onClick: () => {
      if (!confirm('¿Borrar movimiento?')) return;
      g.history = (g.history || []).filter(x => x.id !== h.id);
      toast('Borrado'); closeModal(); render();
    }}));
    it.appendChild(r);
    list.appendChild(it);
  });

  w.appendChild(list);

  openModal('Meta', w, modalFoot([
    { text:'Cerrar', kind:'btn', onClick: closeModal },
    { text:'Añadir aportación', kind:'btn primary', onClick: () => { closeModal(); openAddGoalEntry(id, 'in'); } },
    { text:'Añadir gasto', kind:'btn', onClick: () => { closeModal(); openAddGoalEntry(id, 'out'); } },
  ]));
}

function openAddGoalEntry(goalId, type) {
  const g = state.data.economy.goals.find(x => x.id === goalId); if (!g) return;
  const d = { date: fmtISO(new Date()), amount:'', note:'' };

  const w = el('div', { class:'form' });
  w.appendChild(fieldDate('Fecha', d.date, v => d.date = v));
  w.appendChild(fieldNumber('Importe (€)', d.amount, '0', v => d.amount = v));
  w.appendChild(fieldText('Nota (opcional)', d.note, '', v => d.note = v));

  openModal(type === 'in' ? 'Nueva aportación' : 'Nuevo gasto', w, modalFoot([
    { text:'Cancelar', kind:'btn', onClick: closeModal },
    { text:'Guardar', kind:'btn primary', onClick: () => {
      if (!d.amount || Number(d.amount) <= 0) return toast('Importe inválido');
      if (!Array.isArray(g.history)) g.history = [];
      g.history.push({ id: uid(), date: d.date, type: (type === 'in' ? 'in' : 'out'), amount: Number(d.amount), note: (d.note||'').trim() });

      // Reflejo en cuenta (opcional)
      if (g.accountId) {
        movs(g.accountId).push({
          id: uid(),
          date: d.date,
          type: (type === 'in' ? 'expense' : 'income'),
          amount: Number(d.amount),
          title: `Meta: ${g.title}`,
          note: (type === 'in' ? 'Aportación a meta' : 'Retirada de meta'),
        });
      }

      toast('Guardado'); closeModal(); render();
    }}
  ]));
}

function openEditGoalEntry(goalId, entryId) {
  const g = state.data.economy.goals.find(x => x.id === goalId); if (!g) return;
  const h = (g.history || []).find(x => x.id === entryId); if (!h) return;
  const d = structuredClone(h);

  const w = el('div', { class:'form' });
  w.appendChild(fieldDate('Fecha', d.date, v => d.date = v));
  w.appendChild(fieldNumber('Importe (€)', d.amount, '0', v => d.amount = v));
  w.appendChild(fieldText('Nota (opcional)', d.note, '', v => d.note = v));

  openModal('Editar movimiento', w, modalFoot([
    { text:'Cerrar', kind:'btn', onClick: closeModal },
    { text:'Guardar', kind:'btn primary', onClick: () => {
      if (!d.amount || Number(d.amount) <= 0) return toast('Importe inválido');
      h.date = d.date;
      h.amount = Number(d.amount);
      h.note = (d.note||'').trim();
      toast('Actualizado'); closeModal(); render();
    }}
  ]));
}

/* ========= Quick Add + Settings ========= */
$('#btnSettings').addEventListener('click', () => {
  const wrap = el('div', { class:'form' });
  let name = state.data.app.name || 'Personal Manager';
  wrap.appendChild(fieldText('Nombre de la app', name, 'Nombre', v => name = v));
  wrap.appendChild(help('Esto solo cambia el título de la app.'));

  openModal('Ajustes', wrap, modalFoot([
    { text:'Cerrar', kind:'btn', onClick: () => { state.data.app.name = name || 'Personal Manager'; save(); closeModal(); render(); } },
    { text:'Reset (borrar todo)', kind:'btn bad', onClick: () => {
      if (!confirm('¿Seguro? Esto borrará TODO.')) return;
      localStorage.removeItem(KEY);
      state.data = load();
      state.view = 'home';
      state.params = {};
      state.stack = [];
      toast('Datos reiniciados');
      closeModal();
      render();
    }},
  ]));
});

$('#btnQuickAdd').addEventListener('click', () => {
  if (state.view === 'economy') {
    const tab = state.data.economy.ui.tab || 'accounts';
    if (tab === 'accounts') return openAddAccount();
    if (tab === 'fixed') return openAddFixed();
    if (tab === 'credits') return openAddCredit();
    if (tab === 'goals') return openAddGoal();
  }
  if (state.view === 'account') return openAddMovement(state.params.accountId);

  const wrap = el('div', { class:'form' }, [help('¿Qué quieres añadir?')]);
  openModal('Añadir', wrap, modalFoot([
    { text:'Cuenta', kind:'btn primary', onClick: () => { closeModal(); push('economy'); state.data.economy.ui.tab = 'accounts'; openAddAccount(); } },
    { text:'Gasto fijo', kind:'btn', onClick: () => { closeModal(); push('economy'); state.data.economy.ui.tab = 'fixed'; openAddFixed(); } },
    { text:'Crédito', kind:'btn', onClick: () => { closeModal(); push('economy'); state.data.economy.ui.tab = 'credits'; openAddCredit(); } },
    { text:'Meta', kind:'btn', onClick: () => { closeModal(); push('economy'); state.data.economy.ui.tab = 'goals'; openAddGoal(); } },
  ]));
});

/* ========= Render ========= */
function render() {
  save();
  const main = $('#main');
  main.innerHTML = '';

  const appName = state.data.app.name || 'Personal Manager';

  if (state.view === 'home') {
    setTopbar(appName, '', false, false);
    main.appendChild(renderHome());
    return;
  }

  if (state.view === 'economy') {
    setTopbar('Economía', `Mes actual: ${monthName(new Date().getMonth())} ${new Date().getFullYear()}`, true, true);
    main.appendChild(renderEconomy());
    return;
  }

  if (state.view === 'account') {
    const a = getAcc(state.params.accountId);
    setTopbar(a ? a.name : 'Cuenta', 'Movimientos + tarjetas', true, true);
    main.appendChild(renderAccount(state.params.accountId));
    return;
  }

  // fallback
  setTopbar(appName, '', true, false);
  main.appendChild(help('Vista no encontrada.'));
}

render();
