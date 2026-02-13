/* Personal Manager - Vanilla JS (localStorage) */
'use strict';

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

function fmtEUR(n){
  const v = Number(n || 0);
  return v.toLocaleString('es-ES', { style:'currency', currency:'EUR' });
}
function fmtDateISO(d){ // Date -> YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function parseISO(s){
  const [y,m,d] = (s||'').split('-').map(x=>parseInt(x,10));
  if(!y||!m||!d) return null;
  return new Date(y, m-1, d);
}
function monthName(m){
  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m];
}
function dowShort(){
  return ['L','M','X','J','V','S','D'];
}
function startOfWeekMonday(d){
  const day = d.getDay(); // 0 Sun..6 Sat
  const diff = (day === 0 ? -6 : 1 - day);
  const r = new Date(d);
  r.setDate(d.getDate()+diff);
  r.setHours(0,0,0,0);
  return r;
}

const STORAGE_KEY = 'pm_data_v1';

const defaults = {
  app: { name: 'Personal Manager' },
  work: {
    config: {
      jobName: 'Trabajo',
      contractStart: fmtDateISO(new Date()),
      contractEnd: '',
      hourly: 14.35,
      irpf: 12,
      extraRate: 15,
      nightRate: 18.5,
    },
    turns: {
      M: { name:'Mañana', color:'#22c55e', hours: 8 },
      T: { name:'Tarde',  color:'#f59e0b', hours: 8 },
      N: { name:'Noche',  color:'#60a5fa', hours: 8 },
      L: { name:'Libre',  color:'#9ca3af', hours: 0 },
      V: { name:'Velada', color:'#a855f7', hours: 0 },
    },
    rotation: ['M','M','T','T','N','N','L','L'],
    days: {} // YYYY-MM-DD -> {turn, hoursOverride, extraHours, extraRate, nightHours, nightRate}
  },
  economy: {
    accounts: [
      { id: uid(), name:'Cuenta principal', bank:'', initialBalance: 0, createdAt: Date.now() }
    ],
    movements: {
      // accountId: [ {id, date, type, amount, title, note} ]
    }
  },
  agenda: {
    events: [
      // {id, date, title, time, note}
    ]
  }
};

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return structuredClone(defaults);
    const parsed = JSON.parse(raw);
    // light merge to keep new defaults
    return {
      ...structuredClone(defaults),
      ...parsed,
      work: { ...structuredClone(defaults.work), ...(parsed.work||{}),
        config: { ...structuredClone(defaults.work.config), ...((parsed.work||{}).config||{}) },
        turns: { ...structuredClone(defaults.work.turns), ...((parsed.work||{}).turns||{}) },
        rotation: Array.isArray((parsed.work||{}).rotation) ? (parsed.work.rotation) : structuredClone(defaults.work.rotation),
        days: (parsed.work||{}).days || {}
      },
      economy: { ...structuredClone(defaults.economy), ...(parsed.economy||{}),
        accounts: Array.isArray((parsed.economy||{}).accounts) ? parsed.economy.accounts : structuredClone(defaults.economy.accounts),
        movements: (parsed.economy||{}).movements || {}
      },
      agenda: { ...structuredClone(defaults.agenda), ...(parsed.agenda||{}),
        events: Array.isArray((parsed.agenda||{}).events) ? parsed.agenda.events : []
      }
    };
  }catch(e){
    console.warn('loadData error', e);
    return structuredClone(defaults);
  }
}
function saveData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}
function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(()=> t.classList.add('hidden'), 1700);
}

/* -------- Modal -------- */
function openModal(title, bodyNode, footNode){
  $('#modalTitle').textContent = title;
  const body = $('#modalBody');
  const foot = $('#modalFoot');
  body.innerHTML = '';
  foot.innerHTML = '';
  body.appendChild(bodyNode);
  foot.appendChild(footNode);
  $('#overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal(){
  $('#overlay').classList.add('hidden');
  document.body.style.overflow = '';
}
$('#modalClose').addEventListener('click', closeModal);
$('#overlay').addEventListener('click', (e)=>{
  if(e.target.id === 'overlay') closeModal();
});

/* -------- Router / State -------- */
const state = {
  data: loadData(),
  view: 'home', // home | work | economy | account | agenda
  params: {},
  navStack: [],
  toastTimer: null,
  now: new Date(),
  workMonth: new Date().getMonth(),
  workYear: new Date().getFullYear(),
  ecoMonth: new Date().getMonth(),
  ecoYear: new Date().getFullYear(),
  agendaMonth: new Date().getMonth(),
  agendaYear: new Date().getFullYear(),
};

function setTopbar({title, subtitle, canBack, showQuickAdd}){
  $('#brandTitle').textContent = title;
  $('#viewSubtitle').textContent = subtitle || '';
  $('#btnBack').style.visibility = canBack ? 'visible' : 'hidden';
  $('#btnQuickAdd').style.visibility = showQuickAdd ? 'visible' : 'hidden';
}

function pushView(view, params={}){
  state.navStack.push({view: state.view, params: state.params});
  state.view = view;
  state.params = params;
  render();
}
function popView(){
  const prev = state.navStack.pop();
  if(!prev){ state.view = 'home'; state.params = {}; render(); return; }
  state.view = prev.view;
  state.params = prev.params;
  render();
}

$('#btnBack').addEventListener('click', ()=> popView());

$('#btnSettings').addEventListener('click', ()=>{
  const wrap = document.createElement('div');
  wrap.className = 'form';
  const f1 = fieldText('Nombre de la app', state.data.app.name, 'Nombre visible', (v)=>{
    state.data.app.name = v || 'Personal Manager';
  });
  wrap.appendChild(f1);
  wrap.appendChild(help('Esto solo cambia el título.'));
  const foot = modalFoot([
    { text:'Cerrar', kind:'btn', onClick: ()=>{ saveData(); closeModal(); render(); } },
    { text:'Reset (borrar todo)', kind:'btn bad', onClick: ()=>{
      if(confirm('¿Seguro? Esto borrará TODO.')){
        localStorage.removeItem(STORAGE_KEY);
        state.data = loadData();
        state.navStack = [];
        state.view = 'home';
        toast('Datos reiniciados');
        closeModal();
        render();
      }
    }}
  ]);
  openModal('Ajustes', wrap, foot);
});

/* Quick add changes by view */
$('#btnQuickAdd').addEventListener('click', ()=>{
  if(state.view === 'economy') return openAddAccount();
  if(state.view === 'account') return openAddMovement(state.params.accountId);
  if(state.view === 'agenda') return openAddEvent();
  if(state.view === 'work') return openWorkConfig();
  // home: open chooser
  const wrap = document.createElement('div');
  wrap.className = 'form';
  wrap.appendChild(help('¿Qué quieres añadir?'));
  const foot = modalFoot([
    { text:'Cuenta', kind:'btn primary', onClick: ()=>{ closeModal(); openAddAccount(); } },
    { text:'Movimiento', kind:'btn', onClick: ()=>{ closeModal(); pushView('economy'); openAddAccount(); } },
    { text:'Evento', kind:'btn', onClick: ()=>{ closeModal(); openAddEvent(); } },
  ]);
  openModal('Añadir', wrap, foot);
});

function render(){
  saveData(); // keep it safe
  const main = $('#main');
  main.innerHTML = '';
  const appName = state.data.app.name || 'Personal Manager';

  if(state.view === 'home'){
    setTopbar({title: appName, subtitle:'', canBack:false, showQuickAdd:false});
    main.appendChild(renderHome());
  } else if(state.view === 'work'){
    setTopbar({title:'Trabajo', subtitle:'Turnos', canBack:true, showQuickAdd:true});
    main.appendChild(renderWork());
  } else if(state.view === 'economy'){
    setTopbar({title:'Economía', subtitle:'Resumen + cuentas', canBack:true, showQuickAdd:true});
    main.appendChild(renderEconomy());
  } else if(state.view === 'account'){
    const acc = getAccount(state.params.accountId);
    setTopbar({title: acc ? acc.name : 'Cuenta', subtitle:'Movimientos', canBack:true, showQuickAdd:true});
    main.appendChild(renderAccount(state.params.accountId));
  } else if(state.view === 'agenda'){
    setTopbar({title:'Agenda', subtitle:'Eventos', canBack:true, showQuickAdd:true});
    main.appendChild(renderAgenda());
  }
}

/* ---------- UI helpers ---------- */
function el(tag, attrs={}, children=[]){
  const n = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k === 'class') n.className = v;
    else if(k === 'text') n.textContent = v;
    else if(k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  }
  for(const c of children){
    if(typeof c === 'string') n.appendChild(document.createTextNode(c));
    else if(c) n.appendChild(c);
  }
  return n;
}
function help(text){ return el('div', {class:'minihelp', text}); }
function modalFoot(buttons){
  const wrap = el('div', {});
  for(const b of buttons){
    const btn = el('button', {class:`${b.kind||'btn'}`, text:b.text});
    btn.addEventListener('click', b.onClick);
    wrap.appendChild(btn);
  }
  return wrap;
}
function fieldText(label, value, placeholder, onChange, type='text'){
  const wrap = el('div', {class:'field'});
  wrap.appendChild(el('div', {class:'label', text:label}));
  const inp = el('input', {class:'input', value: value ?? '', placeholder: placeholder ?? '', type});
  inp.addEventListener('input', ()=> onChange(inp.value));
  wrap.appendChild(inp);
  return wrap;
}
function fieldNumber(label, value, placeholder, onChange, step='0.01', min=''){
  const wrap = el('div', {class:'field'});
  wrap.appendChild(el('div', {class:'label', text:label}));
  const inp = el('input', {class:'input', value: value ?? '', placeholder: placeholder ?? '', type:'number', step, min});
  inp.addEventListener('input', ()=> onChange(inp.value === '' ? '' : Number(inp.value)));
  wrap.appendChild(inp);
  return wrap;
}
function fieldDate(label, value, onChange){
  const wrap = el('div', {class:'field'});
  wrap.appendChild(el('div', {class:'label', text:label}));
  const inp = el('input', {class:'input', value: value ?? '', type:'date'});
  inp.addEventListener('input', ()=> onChange(inp.value));
  wrap.appendChild(inp);
  return wrap;
}
function fieldSelect(label, value, options, onChange){
  const wrap = el('div', {class:'field'});
  wrap.appendChild(el('div', {class:'label', text:label}));
  const sel = el('select', {class:'select'});
  for(const opt of options){
    const o = el('option', {value: opt.value, text: opt.label});
    if(String(opt.value) === String(value)) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', ()=> onChange(sel.value));
  wrap.appendChild(sel);
  return wrap;
}
function fieldTextarea(label, value, placeholder, onChange){
  const wrap = el('div', {class:'field'});
  wrap.appendChild(el('div', {class:'label', text:label}));
  const ta = el('textarea', {class:'textarea', placeholder: placeholder ?? ''});
  ta.value = value ?? '';
  ta.addEventListener('input', ()=> onChange(ta.value));
  wrap.appendChild(ta);
  return wrap;
}

/* ---------- HOME ---------- */
function renderHome(){
  const wrap = el('div', {class:'card'});
  const body = el('div', {class:'card__body'});
  const tiles = el('div', {class:'bigtiles'});

  tiles.appendChild(tile('Calendario de trabajo', '🗓️', ()=> pushView('work')));
  tiles.appendChild(tile('Economía', '💳', ()=> pushView('economy')));
  tiles.appendChild(tile('Agenda', '📌', ()=> pushView('agenda')));

  body.appendChild(tiles);
  wrap.appendChild(body);
  return wrap;
}
function tile(title, icon, onClick){
  const t = el('div', {class:'tile'});
  t.addEventListener('click', onClick);
  t.appendChild(el('div', {class:'tile__title', text:title}));
  t.appendChild(el('div', {class:'tile__badge', text:icon}));
  return t;
}

/* ---------- WORK ---------- */
function getTurn(code){
  return state.data.work.turns[code] || {name: code, color:'#9ca3af', hours:0};
}
function getWorkDay(iso){
  return state.data.work.days[iso] || null;
}
function ensureWorkDay(iso){
  if(!state.data.work.days[iso]) state.data.work.days[iso] = { turn:'', hoursOverride:'', extraHours:0, extraRate:'', nightHours:0, nightRate:'' };
  return state.data.work.days[iso];
}
function inferTurnByRotation(iso){
  const cfg = state.data.work.config;
  const rot = state.data.work.rotation || [];
  if(!cfg.contractStart || rot.length === 0) return '';
  const start = parseISO(cfg.contractStart);
  if(!start) return '';
  const d = parseISO(iso);
  if(!d) return '';
  const diffDays = Math.floor((d - start) / (1000*60*60*24));
  if(diffDays < 0) return '';
  return rot[diffDays % rot.length] || '';
}
function workStatsForMonth(y, m){
  // compute based on each day shown in month (including overrides).
  const cfg = state.data.work.config;
  const daysInMonth = new Date(y, m+1, 0).getDate();
  let baseHours = 0, extraHours = 0, nightHours = 0;
  for(let day=1; day<=daysInMonth; day++){
    const iso = fmtDateISO(new Date(y,m,day));
    const rec = getWorkDay(iso);
    const turnCode = rec?.turn || inferTurnByRotation(iso) || '';
    const turn = getTurn(turnCode);
    const h = (rec && rec.hoursOverride !== '' && rec.hoursOverride != null) ? Number(rec.hoursOverride||0) : Number(turn.hours||0);
    baseHours += h;
    extraHours += Number(rec?.extraHours||0);
    nightHours += Number(rec?.nightHours||0);
  }
  const gross = (baseHours * Number(cfg.hourly||0)) + (extraHours * Number(cfg.extraRate||cfg.hourly||0)) + (nightHours * Number(cfg.nightRate||cfg.hourly||0));
  const net = gross * (1 - (Number(cfg.irpf||0)/100));
  return { baseHours, extraHours, nightHours, gross, net };
}

function renderWork(){
  const wrap = el('div', {class:'grid cols-1'});

  const cfg = state.data.work.config;

  // Controls card
  const controls = el('div', {class:'card'});
  const head = el('div', {class:'card__head'}, [
    el('div', {}, [
      el('div', {class:'card__title', text: cfg.jobName || 'Trabajo'}),
    ]),
    el('div', {class:'row'}, [
      el('button', {class:'btn primary', text:'Turnos'}, []),
    ])
  ]);
  head.querySelector('button').addEventListener('click', openWorkConfig);
  const body = el('div', {class:'card__body'});

  const stats = workStatsForMonth(state.workYear, state.workMonth);
  const kpi = el('div', {class:'kpi'});
  kpi.appendChild(kpiItem('Horas trabajadas', stats.baseHours.toFixed(2), 'Incluye horas base (turnos)'));
  kpi.appendChild(kpiItem('Horas extra', stats.extraHours.toFixed(2), 'Pagadas a su tarifa'));
  kpi.appendChild(kpiItem('Horas velada', stats.nightHours.toFixed(2), 'Marcadas manualmente'));
  kpi.appendChild(kpiItem('Cash neto', fmtEUR(stats.net), `Ya descontado IRPF (${Number(cfg.irpf||0)}%)`));
  body.appendChild(kpi);

  body.appendChild(el('div', {class:'hr'}));

  const picker = el('div', {class:'toolbar'});
  const left = el('div', {class:'row'});
  const months = Array.from({length:12}, (_,i)=> ({value:i, label: monthName(i)}));
  const years = Array.from({length:7}, (_,i)=> {
    const y = new Date().getFullYear() - 3 + i;
    return {value:y, label:String(y)};
  });
  left.appendChild(fieldSelect('Mes', state.workMonth, months, (v)=>{ state.workMonth = Number(v); render(); }));
  left.appendChild(fieldSelect('Año', state.workYear, years, (v)=>{ state.workYear = Number(v); render(); }));
  const right = el('div', {class:'row'});
  right.appendChild(el('button', {class:'btn', text:'Hoy', onclick: ()=>{
    const n = new Date();
    state.workMonth = n.getMonth(); state.workYear = n.getFullYear();
    render();
  }}));
  picker.appendChild(left);
  picker.appendChild(right);
  body.appendChild(picker);

  // Calendar
  body.appendChild(renderWorkCalendar(state.workYear, state.workMonth));

  controls.appendChild(head);
  controls.appendChild(body);

  wrap.appendChild(controls);
  return wrap;
}

function kpiItem(label, value, hint){
  const it = el('div', {class:'kpi__item'});
  it.appendChild(el('div', {class:'kpi__label', text:label}));
  it.appendChild(el('div', {class:'kpi__value', text:value}));
  it.appendChild(el('div', {class:'kpi__hint', text:hint}));
  return it;
}

function renderWorkCalendar(y, m){
  const cal = el('div', {class:'calendar'});
  const head = el('div', {class:'cal__head'});
  for(const d of dowShort()) head.appendChild(el('div', {text:d}));
  const grid = el('div', {class:'cal__grid'});

  const first = new Date(y, m, 1);
  const start = startOfWeekMonday(first);
  for(let i=0;i<42;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    const iso = fmtDateISO(d);
    const inMonth = d.getMonth() === m;
    const cell = el('div', {class:`day ${inMonth?'':'muted'}`});
    cell.appendChild(el('div', {class:'day__num', text:String(d.getDate())}));

    const rec = getWorkDay(iso);
    const turnCode = rec?.turn || inferTurnByRotation(iso) || '';
    if(turnCode){
      const turn = getTurn(turnCode);
      const pill = el('div', {class:'pill'});
      const dot = el('span', {class:'dot'});
      dot.style.background = turn.color || '#7c3aed';
      pill.appendChild(dot);
      pill.appendChild(el('span', {text: turnCode}));
      if(Number(rec?.extraHours||0) > 0) pill.appendChild(el('span', {text:'• +' + Number(rec.extraHours).toFixed(1)}));
      if(Number(rec?.nightHours||0) > 0) pill.appendChild(el('span', {text:'• V'}));
      cell.appendChild(pill);
    }

    cell.addEventListener('click', ()=> openWorkDayEditor(iso));
    grid.appendChild(cell);
  }

  cal.appendChild(head);
  cal.appendChild(grid);
  return cal;
}

function openWorkConfig(){
  const wrap = el('div', {class:'form'});
  const cfg = structuredClone(state.data.work.config);
  const turns = structuredClone(state.data.work.turns);
  let rot = Array.isArray(state.data.work.rotation) ? [...state.data.work.rotation] : [];

  wrap.appendChild(fieldText('Nombre del trabajo', cfg.jobName, 'Ej: Stellantis', (v)=> cfg.jobName = v));
  wrap.appendChild(fieldDate('Inicio de contrato', cfg.contractStart, (v)=> cfg.contractStart = v));
  wrap.appendChild(fieldDate('Fin de contrato (opcional)', cfg.contractEnd, (v)=> cfg.contractEnd = v));

  const two1 = el('div', {class:'two'});
  two1.appendChild(fieldNumber('Salario por hora (€)', cfg.hourly, '0', (v)=> cfg.hourly = v, '0.01', '0'));
  two1.appendChild(fieldNumber('IRPF aplicado (%)', cfg.irpf, '0', (v)=> cfg.irpf = v, '0.1', '0'));
  wrap.appendChild(two1);

  const two2 = el('div', {class:'two'});
  two2.appendChild(fieldNumber('Tarifa extra por defecto (€/h)', cfg.extraRate, '0', (v)=> cfg.extraRate = v, '0.01', '0'));
  two2.appendChild(fieldNumber('Tarifa velada por defecto (€/h)', cfg.nightRate, '0', (v)=> cfg.nightRate = v, '0.01', '0'));
  wrap.appendChild(two2);

  wrap.appendChild(el('div', {class:'hr'}));
  wrap.appendChild(el('div', {class:'card__title', text:'Turnos'}));
  wrap.appendChild(help('Edita nombre, color y horas base de cada turno.'));

  for(const code of Object.keys(turns)){
    const t = turns[code];
    const box = el('div', {class:'card', style:'box-shadow:none;'});
    const b = el('div', {class:'card__body'});
    b.appendChild(el('div', {class:'card__title', text:`${code} — ${t.name}`}));
    const row = el('div', {class:'two'});
    row.appendChild(fieldText('Nombre', t.name, '', (v)=> t.name = v));
    row.appendChild(fieldNumber('Horas base', t.hours, '0', (v)=> t.hours = v, '0.5', '0'));
    b.appendChild(row);
    const cfield = fieldText('Color (hex)', t.color, '#22c55e', (v)=> t.color = v);
    b.appendChild(cfield);
    box.appendChild(b);
    wrap.appendChild(box);
  }

  wrap.appendChild(el('div', {class:'hr'}));
  wrap.appendChild(el('div', {class:'card__title', text:'Rotación (fácil)'}));
  wrap.appendChild(help('Pulsa para añadir turnos a tu secuencia. Puedes deshacer o vaciar.'));

  const rotWrap = el('div', {class:'card', style:'box-shadow:none;'});
  const rotBody = el('div', {class:'card__body'});
  const preview = el('div', {class:'badge', text: rot.length ? rot.join(' · ') : 'Vacío'});
  rotBody.appendChild(preview);

  const btnRow = el('div', {class:'row', style:'margin-top:10px;'});
  for(const code of Object.keys(turns)){
    const t = turns[code];
    const b = el('button', {class:'btn', text: code});
    b.style.borderColor = 'rgba(255,255,255,0.12)';
    b.addEventListener('click', ()=>{
      rot.push(code);
      preview.textContent = rot.join(' · ');
    });
    btnRow.appendChild(b);
  }
  rotBody.appendChild(btnRow);

  const row2 = el('div', {class:'row', style:'margin-top:10px;'});
  const undo = el('button', {class:'btn', text:'Deshacer'});
  undo.addEventListener('click', ()=>{
    rot.pop();
    preview.textContent = rot.length ? rot.join(' · ') : 'Vacío';
  });
  const clear = el('button', {class:'btn bad', text:'Vaciar'});
  clear.addEventListener('click', ()=>{
    rot = [];
    preview.textContent = 'Vacío';
  });
  row2.appendChild(undo);
  row2.appendChild(clear);
  rotBody.appendChild(row2);

  rotWrap.appendChild(rotBody);
  wrap.appendChild(rotWrap);

  const foot = modalFoot([
    {text:'Cancelar', kind:'btn', onClick: ()=> closeModal()},
    {text:'Guardar', kind:'btn primary', onClick: ()=>{
      state.data.work.config = cfg;
      state.data.work.turns = turns;
      state.data.work.rotation = rot;
      toast('Turnos guardados');
      closeModal();
      render();
    }}
  ]);
  openModal('Turnos', wrap, foot);
}

function openWorkDayEditor(iso){
  const cfg = state.data.work.config;
  const turns = state.data.work.turns;
  const rec = structuredClone(getWorkDay(iso) || { turn:'', hoursOverride:'', extraHours:0, extraRate:'', nightHours:0, nightRate:'' });

  const d = parseISO(iso);
  const title = d ? `${d.getDate()} ${monthName(d.getMonth())} ${d.getFullYear()}` : iso;

  const wrap = el('div', {class:'form'});

  // Turn selector
  const opts = [{value:'', label:'(Auto por rotación)'}].concat(
    Object.keys(turns).map(code => ({value:code, label:`${code} — ${turns[code].name}`}))
  );
  wrap.appendChild(fieldSelect('Turno', rec.turn, opts, (v)=> rec.turn = v));

  const inferred = inferTurnByRotation(iso);
  if(!rec.turn && inferred){
    wrap.appendChild(help(`Auto por rotación: ${inferred} — ${getTurn(inferred).name}`));
  }

  wrap.appendChild(fieldNumber('Horas trabajadas (opcional)', rec.hoursOverride, 'Dejar vacío para usar horas del turno', (v)=> rec.hoursOverride = v, '0.5', '0'));

  wrap.appendChild(el('div', {class:'hr'}));
  wrap.appendChild(el('div', {class:'card__title', text:'Extras'}));

  const two = el('div', {class:'two'});
  two.appendChild(fieldNumber('Horas extra', rec.extraHours, '0', (v)=> rec.extraHours = v, '0.5', '0'));
  two.appendChild(fieldNumber('Tarifa extra €/h (opcional)', rec.extraRate, String(cfg.extraRate||0), (v)=> rec.extraRate = v, '0.01', '0'));
  wrap.appendChild(two);

  wrap.appendChild(el('div', {class:'hr'}));
  wrap.appendChild(el('div', {class:'card__title', text:'Velada'}));

  const two2 = el('div', {class:'two'});
  two2.appendChild(fieldNumber('Horas velada', rec.nightHours, '0', (v)=> rec.nightHours = v, '0.5', '0'));
  two2.appendChild(fieldNumber('Tarifa velada €/h (opcional)', rec.nightRate, String(cfg.nightRate||0), (v)=> rec.nightRate = v, '0.01', '0'));
  wrap.appendChild(two2);

  const foot = modalFoot([
    {text:'Cerrar', kind:'btn', onClick: ()=> closeModal()},
    {text:'Guardar', kind:'btn primary', onClick: ()=>{
      // normalize numbers
      const day = ensureWorkDay(iso);
      day.turn = rec.turn || '';
      day.hoursOverride = (rec.hoursOverride === '' ? '' : Number(rec.hoursOverride||0));
      day.extraHours = Number(rec.extraHours||0);
      day.extraRate = (rec.extraRate === '' ? '' : Number(rec.extraRate||0));
      day.nightHours = Number(rec.nightHours||0);
      day.nightRate = (rec.nightRate === '' ? '' : Number(rec.nightRate||0));
      toast('Día guardado');
      closeModal();
      render();
    }},
    {text:'Limpiar día', kind:'btn bad', onClick: ()=>{
      if(confirm('¿Borrar ajustes de este día?')){
        delete state.data.work.days[iso];
        toast('Día limpiado');
        closeModal();
        render();
      }
    }}
  ]);
  openModal(title, wrap, foot);
}

/* ---------- ECONOMY ---------- */
function getAccount(id){
  return state.data.economy.accounts.find(a=>a.id===id) || null;
}
function getMovements(accountId){
  const m = state.data.economy.movements[accountId];
  if(!Array.isArray(m)) state.data.economy.movements[accountId] = [];
  return state.data.economy.movements[accountId];
}
function accountBalance(accountId){
  const acc = getAccount(accountId);
  if(!acc) return 0;
  const movs = getMovements(accountId);
  const sum = movs.reduce((s, x)=>{
    const amt = Number(x.amount||0);
    return s + (x.type === 'income' ? amt : -amt);
  }, 0);
  return Number(acc.initialBalance||0) + sum;
}
function economyTotals(){
  const total = state.data.economy.accounts.reduce((s,a)=> s + accountBalance(a.id), 0);
  return { total };
}

function renderEconomy(){
  const wrap = el('div', {class:'grid cols-1'});

  // Summary
  const sumCard = el('div', {class:'card'});
  const sumBody = el('div', {class:'card__body'});
  const totals = economyTotals();

  const kpi = el('div', {class:'kpi'});
  kpi.appendChild(kpiItem('Saldo total', fmtEUR(totals.total), 'Suma de todas las cuentas'));
  kpi.appendChild(kpiItem('Cuentas', String(state.data.economy.accounts.length), 'Bancarias / efectivo'));
  kpi.appendChild(kpiItem('Mes', `${monthName(state.ecoMonth)} ${state.ecoYear}`, 'Cambiar mes afecta a filtros (próx.)'));
  kpi.appendChild(kpiItem('Pendiente', fmtEUR(0), 'Bloque preparado (próx.)'));
  sumBody.appendChild(kpi);

  sumBody.appendChild(el('div', {class:'hr'}));
  const picker = el('div', {class:'toolbar'});
  const left = el('div', {class:'row'});
  const months = Array.from({length:12}, (_,i)=> ({value:i, label: monthName(i)}));
  const years = Array.from({length:7}, (_,i)=> {
    const y = new Date().getFullYear() - 3 + i;
    return {value:y, label:String(y)};
  });
  left.appendChild(fieldSelect('Mes', state.ecoMonth, months, (v)=>{ state.ecoMonth = Number(v); render(); }));
  left.appendChild(fieldSelect('Año', state.ecoYear, years, (v)=>{ state.ecoYear = Number(v); render(); }));
  picker.appendChild(left);
  picker.appendChild(el('div', {class:'row'}, [
    el('button', {class:'btn', text:'Añadir cuenta', onclick: ()=> openAddAccount()}),
  ]));
  sumBody.appendChild(picker);

  sumCard.appendChild(sumBody);

  // Accounts list
  const listCard = el('div', {class:'card'});
  const listBody = el('div', {class:'card__body'});
  listBody.appendChild(el('div', {class:'card__title', text:'Cuentas'}));
  listBody.appendChild(el('div', {class:'card__subtitle', text:'Entra en una cuenta para ver y gestionar sus movimientos.'}));

  const list = el('div', {class:'list', style:'margin-top:12px;'});
  for(const acc of state.data.economy.accounts){
    const bal = accountBalance(acc.id);
    const it = el('div', {class:'item'});
    it.appendChild(el('div', {class:'item__main'}, [
      el('div', {class:'item__title', text: acc.name}),
      el('div', {class:'item__meta', text: acc.bank ? acc.bank : 'Cuenta'}),
    ]));
    const right = el('div', {class:'item__right'});
    right.appendChild(el('span', {class:'badge', text: fmtEUR(bal)}));
    const openBtn = el('button', {class:'btn primary', text:'Abrir'});
    openBtn.addEventListener('click', ()=> pushView('account', {accountId: acc.id}));
    const editBtn = el('button', {class:'btn', text:'Editar'});
    editBtn.addEventListener('click', ()=> openEditAccount(acc.id));
    right.appendChild(openBtn);
    right.appendChild(editBtn);
    it.appendChild(right);
    list.appendChild(it);
  }
  listBody.appendChild(list);
  listCard.appendChild(listBody);

  wrap.appendChild(sumCard);
  wrap.appendChild(listCard);
  return wrap;
}

function openAddAccount(){
  const draft = { name:'', bank:'', initialBalance:0 };
  const wrap = el('div', {class:'form'});
  wrap.appendChild(fieldText('Nombre', draft.name, 'Ej: Santander', v=> draft.name=v));
  wrap.appendChild(fieldText('Banco (opcional)', draft.bank, 'Ej: BBVA', v=> draft.bank=v));
  wrap.appendChild(fieldNumber('Saldo inicial', draft.initialBalance, '0', v=> draft.initialBalance=v, '0.01', ''));

  const foot = modalFoot([
    {text:'Cancelar', kind:'btn', onClick: ()=> closeModal()},
    {text:'Crear', kind:'btn primary', onClick: ()=>{
      if(!draft.name.trim()){ toast('Pon un nombre'); return; }
      state.data.economy.accounts.push({ id: uid(), name: draft.name.trim(), bank: draft.bank.trim(), initialBalance: Number(draft.initialBalance||0), createdAt: Date.now() });
      toast('Cuenta creada');
      closeModal();
      render();
    }}
  ]);
  openModal('Nueva cuenta', wrap, foot);
}

function openEditAccount(accountId){
  const acc = getAccount(accountId);
  if(!acc) return;
  const draft = structuredClone(acc);
  const wrap = el('div', {class:'form'});
  wrap.appendChild(fieldText('Nombre', draft.name, '', v=> draft.name=v));
  wrap.appendChild(fieldText('Banco (opcional)', draft.bank, '', v=> draft.bank=v));
  wrap.appendChild(fieldNumber('Saldo inicial', draft.initialBalance, '0', v=> draft.initialBalance=v, '0.01', ''));

  const foot = modalFoot([
    {text:'Cerrar', kind:'btn', onClick: ()=> closeModal()},
    {text:'Guardar', kind:'btn primary', onClick: ()=>{
      acc.name = (draft.name||'').trim() || acc.name;
      acc.bank = (draft.bank||'').trim();
      acc.initialBalance = Number(draft.initialBalance||0);
      toast('Cuenta guardada');
      closeModal();
      render();
    }},
    {text:'Borrar cuenta', kind:'btn bad', onClick: ()=>{
      if(!confirm('¿Borrar cuenta y sus movimientos?')) return;
      state.data.economy.accounts = state.data.economy.accounts.filter(a=>a.id!==accountId);
      delete state.data.economy.movements[accountId];
      toast('Cuenta borrada');
      closeModal();
      // go back if inside
      if(state.view === 'account') popView();
      render();
    }}
  ]);
  openModal('Editar cuenta', wrap, foot);
}

function renderAccount(accountId){
  const acc = getAccount(accountId);
  if(!acc) return el('div', {class:'card'}, [el('div', {class:'card__body', text:'Cuenta no encontrada.'})]);

  const wrap = el('div', {class:'grid cols-1'});

  const top = el('div', {class:'card'});
  const topBody = el('div', {class:'card__body'});
  const bal = accountBalance(accountId);
  const kpi = el('div', {class:'kpi'});
  kpi.appendChild(kpiItem('Saldo actual', fmtEUR(bal), 'Saldo inicial + movimientos'));
  kpi.appendChild(kpiItem('Saldo inicial', fmtEUR(acc.initialBalance||0), 'Edita desde “Editar”'));
  kpi.appendChild(kpiItem('Movimientos', String(getMovements(accountId).length), 'Ingresos y gastos'));
  kpi.appendChild(kpiItem('Mes', `${monthName(state.ecoMonth)} ${state.ecoYear}`, 'Filtro visual (próx.)'));
  topBody.appendChild(kpi);

  topBody.appendChild(el('div', {class:'hr'}));
  const row = el('div', {class:'row'});
  row.appendChild(el('button', {class:'btn primary', text:'Añadir movimiento', onclick: ()=> openAddMovement(accountId)}));
  row.appendChild(el('button', {class:'btn', text:'Editar cuenta', onclick: ()=> openEditAccount(accountId)}));
  topBody.appendChild(row);
  top.appendChild(topBody);

  const listCard = el('div', {class:'card'});
  const listBody = el('div', {class:'card__body'});
  listBody.appendChild(el('div', {class:'card__title', text:'Movimientos (de esta cuenta)'}));
  listBody.appendChild(el('div', {class:'card__subtitle', text:'Puedes editar fecha, importe, tipo y descripción.'}));

  const list = el('div', {class:'list', style:'margin-top:12px;'});
  const movs = getMovements(accountId).slice().sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  if(movs.length === 0){
    list.appendChild(el('div', {class:'minihelp', text:'Aún no hay movimientos. Pulsa “Añadir movimiento”.'}));
  }
  for(const mv of movs){
    const it = el('div', {class:'item'});
    const left = el('div', {class:'item__main'});
    left.appendChild(el('div', {class:'item__title', text: mv.title || '(sin título)'}));
    left.appendChild(el('div', {class:'item__meta', text: `${mv.date || ''} • ${mv.type === 'income' ? 'Ingreso' : 'Gasto'}${mv.note ? ' • ' + mv.note : ''}` }));
    const right = el('div', {class:'item__right'});
    right.appendChild(el('span', {class:`badge ${mv.type==='income'?'good':'bad'}`, text: (mv.type==='income' ? '+' : '-') + fmtEUR(mv.amount)}));
    const edit = el('button', {class:'btn', text:'Editar'});
    edit.addEventListener('click', ()=> openEditMovement(accountId, mv.id));
    const del = el('button', {class:'btn bad', text:'Borrar'});
    del.addEventListener('click', ()=>{
      if(!confirm('¿Borrar movimiento?')) return;
      state.data.economy.movements[accountId] = getMovements(accountId).filter(x=>x.id!==mv.id);
      toast('Movimiento borrado');
      render();
    });
    right.appendChild(edit);
    right.appendChild(del);
    it.appendChild(left);
    it.appendChild(right);
    list.appendChild(it);
  }
  listBody.appendChild(list);
  listCard.appendChild(listBody);

  wrap.appendChild(top);
  wrap.appendChild(listCard);
  return wrap;
}

function openAddMovement(accountId){
  const draft = { date: fmtDateISO(new Date()), type:'expense', amount:'', title:'', note:'' };
  const wrap = el('div', {class:'form'});
  wrap.appendChild(fieldDate('Fecha', draft.date, v=> draft.date=v));
  wrap.appendChild(fieldSelect('Tipo', draft.type, [
    {value:'expense', label:'Gasto'},
    {value:'income', label:'Ingreso'}
  ], v=> draft.type=v));
  wrap.appendChild(fieldNumber('Importe (€)', draft.amount, '0', v=> draft.amount=v, '0.01', '0'));
  wrap.appendChild(fieldText('Título', draft.title, 'Ej: Glovo', v=> draft.title=v));
  wrap.appendChild(fieldTextarea('Nota (opcional)', draft.note, 'Detalles…', v=> draft.note=v));

  const foot = modalFoot([
    {text:'Cancelar', kind:'btn', onClick: ()=> closeModal()},
    {text:'Guardar', kind:'btn primary', onClick: ()=>{
      if(!draft.amount || Number(draft.amount)<=0){ toast('Importe inválido'); return; }
      const arr = getMovements(accountId);
      arr.push({ id: uid(), date: draft.date, type: draft.type, amount: Number(draft.amount), title: (draft.title||'').trim(), note: (draft.note||'').trim() });
      toast('Movimiento guardado');
      closeModal();
      render();
    }}
  ]);
  openModal('Nuevo movimiento', wrap, foot);
}

function openEditMovement(accountId, movementId){
  const arr = getMovements(accountId);
  const mv = arr.find(x=>x.id===movementId);
  if(!mv) return;
  const draft = structuredClone(mv);

  const wrap = el('div', {class:'form'});
  wrap.appendChild(fieldDate('Fecha', draft.date, v=> draft.date=v));
  wrap.appendChild(fieldSelect('Tipo', draft.type, [
    {value:'expense', label:'Gasto'},
    {value:'income', label:'Ingreso'}
  ], v=> draft.type=v));
  wrap.appendChild(fieldNumber('Importe (€)', draft.amount, '0', v=> draft.amount=v, '0.01', '0'));
  wrap.appendChild(fieldText('Título', draft.title, 'Ej: Paypal', v=> draft.title=v));
  wrap.appendChild(fieldTextarea('Nota (opcional)', draft.note, 'Detalles…', v=> draft.note=v));

  const foot = modalFoot([
    {text:'Cerrar', kind:'btn', onClick: ()=> closeModal()},
    {text:'Guardar cambios', kind:'btn primary', onClick: ()=>{
      if(!draft.amount || Number(draft.amount)<=0){ toast('Importe inválido'); return; }
      mv.date = draft.date;
      mv.type = draft.type;
      mv.amount = Number(draft.amount);
      mv.title = (draft.title||'').trim();
      mv.note = (draft.note||'').trim();
      toast('Movimiento actualizado');
      closeModal();
      render();
    }}
  ]);
  openModal('Editar movimiento', wrap, foot);
}

/* ---------- AGENDA ---------- */
function renderAgenda(){
  const wrap = el('div', {class:'grid cols-1'});

  const card = el('div', {class:'card'});
  const body = el('div', {class:'card__body'});

  const picker = el('div', {class:'toolbar'});
  const left = el('div', {class:'row'});
  const months = Array.from({length:12}, (_,i)=> ({value:i, label: monthName(i)}));
  const years = Array.from({length:7}, (_,i)=> {
    const y = new Date().getFullYear() - 3 + i;
    return {value:y, label:String(y)};
  });
  left.appendChild(fieldSelect('Mes', state.agendaMonth, months, (v)=>{ state.agendaMonth = Number(v); render(); }));
  left.appendChild(fieldSelect('Año', state.agendaYear, years, (v)=>{ state.agendaYear = Number(v); render(); }));
  picker.appendChild(left);
  picker.appendChild(el('div', {class:'row'}, [
    el('button', {class:'btn primary', text:'Añadir evento', onclick: ()=> openAddEvent()}),
  ]));

  body.appendChild(picker);
  body.appendChild(el('div', {class:'hr'}));
  body.appendChild(renderAgendaCalendar(state.agendaYear, state.agendaMonth));
  card.appendChild(body);

  // list
  const listCard = el('div', {class:'card'});
  const listBody = el('div', {class:'card__body'});
  listBody.appendChild(el('div', {class:'card__title', text:'Eventos'}));
  const list = el('div', {class:'list', style:'margin-top:12px;'});
  const events = state.data.agenda.events
    .filter(e=>{
      const d = parseISO(e.date);
      return d && d.getFullYear()===state.agendaYear && d.getMonth()===state.agendaMonth;
    })
    .slice()
    .sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time));

  if(events.length===0) list.appendChild(el('div', {class:'minihelp', text:'No hay eventos este mes.'}));

  for(const ev of events){
    const it = el('div', {class:'item'});
    it.appendChild(el('div', {class:'item__main'}, [
      el('div', {class:'item__title', text: ev.title || '(sin título)'}),
      el('div', {class:'item__meta', text: `${ev.date}${ev.time? ' • '+ev.time:''}${ev.note? ' • '+ev.note:''}`})
    ]));
    const right = el('div', {class:'item__right'});
    right.appendChild(el('span', {class:'badge', text:'Evento'}));
    const edit = el('button', {class:'btn', text:'Editar'});
    edit.addEventListener('click', ()=> openEditEvent(ev.id));
    const del = el('button', {class:'btn bad', text:'Borrar'});
    del.addEventListener('click', ()=>{
      if(!confirm('¿Borrar evento?')) return;
      state.data.agenda.events = state.data.agenda.events.filter(x=>x.id!==ev.id);
      toast('Evento borrado');
      render();
    });
    right.appendChild(edit);
    right.appendChild(del);
    it.appendChild(right);
    list.appendChild(it);
  }
  listBody.appendChild(list);
  listCard.appendChild(listBody);

  wrap.appendChild(card);
  wrap.appendChild(listCard);
  return wrap;
}

function renderAgendaCalendar(y, m){
  const cal = el('div', {class:'calendar'});
  const head = el('div', {class:'cal__head'});
  for(const d of dowShort()) head.appendChild(el('div', {text:d}));
  const grid = el('div', {class:'cal__grid'});

  const first = new Date(y, m, 1);
  const start = startOfWeekMonday(first);
  const eventsByDate = {};
  for(const ev of state.data.agenda.events){
    if(!eventsByDate[ev.date]) eventsByDate[ev.date] = 0;
    eventsByDate[ev.date]++;
  }

  for(let i=0;i<42;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    const iso = fmtDateISO(d);
    const inMonth = d.getMonth() === m;
    const cell = el('div', {class:`day ${inMonth?'':'muted'}`});
    cell.appendChild(el('div', {class:'day__num', text:String(d.getDate())}));
    const count = eventsByDate[iso] || 0;
    if(count>0){
      const pill = el('div', {class:'pill'});
      const dot = el('span', {class:'dot'});
      dot.style.background = '#a855f7';
      pill.appendChild(dot);
      pill.appendChild(el('span', {text: `${count} evt`}));
      cell.appendChild(pill);
    }
    cell.addEventListener('click', ()=> openAddEvent(iso));
    grid.appendChild(cell);
  }

  cal.appendChild(head);
  cal.appendChild(grid);
  return cal;
}

function openAddEvent(prefDate=''){
  const draft = { date: prefDate || fmtDateISO(new Date()), time:'', title:'', note:'' };
  const wrap = el('div', {class:'form'});
  wrap.appendChild(fieldDate('Fecha', draft.date, v=> draft.date=v));
  wrap.appendChild(fieldText('Hora (opcional)', draft.time, 'Ej: 19:30', v=> draft.time=v));
  wrap.appendChild(fieldText('Título', draft.title, 'Ej: Médico', v=> draft.title=v));
  wrap.appendChild(fieldTextarea('Nota (opcional)', draft.note, 'Detalles…', v=> draft.note=v));

  const foot = modalFoot([
    {text:'Cancelar', kind:'btn', onClick: ()=> closeModal()},
    {text:'Guardar', kind:'btn primary', onClick: ()=>{
      if(!draft.title.trim()){ toast('Pon un título'); return; }
      state.data.agenda.events.push({ id: uid(), date: draft.date, time: (draft.time||'').trim(), title: draft.title.trim(), note: (draft.note||'').trim() });
      toast('Evento guardado');
      closeModal();
      render();
    }}
  ]);
  openModal('Nuevo evento', wrap, foot);
}

function openEditEvent(eventId){
  const ev = state.data.agenda.events.find(x=>x.id===eventId);
  if(!ev) return;
  const draft = structuredClone(ev);

  const wrap = el('div', {class:'form'});
  wrap.appendChild(fieldDate('Fecha', draft.date, v=> draft.date=v));
  wrap.appendChild(fieldText('Hora (opcional)', draft.time, 'Ej: 19:30', v=> draft.time=v));
  wrap.appendChild(fieldText('Título', draft.title, 'Ej: Quedada', v=> draft.title=v));
  wrap.appendChild(fieldTextarea('Nota (opcional)', draft.note, 'Detalles…', v=> draft.note=v));

  const foot = modalFoot([
    {text:'Cerrar', kind:'btn', onClick: ()=> closeModal()},
    {text:'Guardar cambios', kind:'btn primary', onClick: ()=>{
      if(!draft.title.trim()){ toast('Pon un título'); return; }
      ev.date = draft.date;
      ev.time = (draft.time||'').trim();
      ev.title = draft.title.trim();
      ev.note = (draft.note||'').trim();
      toast('Evento actualizado');
      closeModal();
      render();
    }}
  ]);
  openModal('Editar evento', wrap, foot);
}

/* ---------- PWA files live next to app ---------- */
// done

// initial render
render();
