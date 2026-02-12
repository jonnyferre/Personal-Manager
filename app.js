;(() => {
  // =========================
  // Storage (localStorage)
  // =========================
  const STORAGE_KEY = "jfx_gestiones_v1";

  const defaultState = {
    ui: { lastView: "home" },

    work: {
      job: {
        name: "Trabajo principal",
        contractStart: todayISO(),
        contractEnd: "",
        rotation: ["M", "T", "N", "L"], // Mañana/Tarde/Noche/Libre
        shiftDefs: {
          M: { label: "Mañana", color: "#22c55e", defaultHours: 8 },
          T: { label: "Tarde",  color: "#f59e0b", defaultHours: 8 },
          N: { label: "Noche",  color: "#60a5fa", defaultHours: 8 },
          L: { label: "Libre",  color: "#9ca3af", defaultHours: 0 },
          V: { label: "Velada", color: "#A212C4", defaultHours: 0 },
        },
        salaryPerHour: 12,
        irpf: 15, // %
        overtimeDefaultRate: 15,
        veladaDefaultRate: 10
      },
      overrides: {
        // "YYYY-MM-DD": { shift:"M", hours:8, overtimeHours:2, overtimeRate:15, veladaHours:0, veladaRate:10, note:"" }
      }
    },

    economy: {
      monthCursor: monthCursor(new Date()),

      accounts: [
        { id: uid(), name: "Cuenta principal", bank: "Banco", initialBalance: 0, createdAt: todayISO(), cards: [] }
      ],
      movements: [
        // { id, date:"YYYY-MM-DD", accountId, type:"income|expense|transfer", name, amount, status:"cleared|pending", meta:{} }
      ],
      fixedExpenses: [
        // { id, title, amount, dayOfMonth, accountId, active:true }
      ],
      credits: [
        // { id, title, monthlyFee, dayOfMonth, accountId, active:true }
      ],
      goals: [
        // { id, title, targetAmount, targetDate, accountId, history:[{id,date,type:"add|spend", amount, note}] }
      ]
    },

    agenda: {
      events: [
        // { id, title, date:"YYYY-MM-DD", time:"HH:MM", location:"", notes:"" }
      ]
    }
  };

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      return mergeDeep(structuredClone(defaultState), parsed);
    }catch{
      return structuredClone(defaultState);
    }
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function mergeDeep(target, source){
    for(const k of Object.keys(source || {})){
      if(source[k] && typeof source[k] === "object" && !Array.isArray(source[k])){
        target[k] = mergeDeep(target[k] || {}, source[k]);
      }else{
        target[k] = source[k];
      }
    }
    return target;
  }

  // =========================
  // Utils
  // =========================
  function uid(){
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
  function pad2(n){ return String(n).padStart(2,"0"); }
  function todayISO(){
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }
  function monthCursor(d){
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
  }
  function parseISO(s){
    const [y,m,dd] = s.split("-").map(Number);
    return new Date(y, m-1, dd);
  }
  function money(n){
    const v = Number(n || 0);
    return v.toLocaleString("es-ES", { style:"currency", currency:"EUR" });
  }
  function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
  function safeNum(v, fallback=0){
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function daysInMonth(year, monthIndex0){
    return new Date(year, monthIndex0+1, 0).getDate();
  }
  function startWeekdayMon0(date){ // Monday=0...Sunday=6
    const wd = date.getDay(); // Sun=0
    return (wd + 6) % 7;
  }
  const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
  const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  // =========================
  // UI Helpers
  // =========================
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const main = $("#main");
  const btnBack = $("#btnBack");
  const btnQuickAdd = $("#btnQuickAdd");
  const btnSettings = $("#btnSettings");
  const viewSubtitle = $("#viewSubtitle");

  const overlay = $("#overlay");
  const modalTitle = $("#modalTitle");
  const modalBody = $("#modalBody");
  const modalFoot = $("#modalFoot");
  const modalClose = $("#modalClose");
  const toastEl = $("#toast");

  function setSubtitle(text){ viewSubtitle.textContent = text; }

  function toast(msg){
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), 2200);
  }

  function openModal({ title, bodyHTML, footHTML }){
    modalTitle.textContent = title || "Detalle";
    modalBody.innerHTML = bodyHTML || "";
    modalFoot.innerHTML = footHTML || "";
    overlay.classList.remove("hidden");
  }
  function closeModal(){
    overlay.classList.add("hidden");
    modalBody.innerHTML = "";
    modalFoot.innerHTML = "";
  }
  modalClose.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if(e.target === overlay) closeModal();
  });

  // =========================
  // Router
  // =========================
  const navStack = [];
  let state = loadState();

  function go(view, params={}){
    const current = state.ui.lastView || "home";
    if(current !== view) navStack.push({ view: current, params: state.ui.lastParams || {} });
    state.ui.lastView = view;
    state.ui.lastParams = params;
    saveState();
    render();
  }

  function back(){
    const prev = navStack.pop();
    if(prev){
      state.ui.lastView = prev.view;
      state.ui.lastParams = prev.params;
      saveState();
      render();
    }else{
      state.ui.lastView = "home";
      state.ui.lastParams = {};
      saveState();
      render();
    }
  }

  btnBack.addEventListener("click", back);

  btnSettings.addEventListener("click", () => {
    openModal({
      title: "Ajustes",
      bodyHTML: `
        <div class="form">
          <div class="small">
            Datos guardados en este navegador (localStorage). Si borras caché/datos del navegador, se perderá.
          </div>
          <div class="hr"></div>
          <div class="row">
            <button class="btn bad" id="btnReset">Reiniciar datos</button>
            <div class="spacer"></div>
            <button class="btn" id="btnExport">Exportar JSON</button>
            <button class="btn" id="btnImport">Importar JSON</button>
          </div>
          <input class="input hidden" id="fileImport" type="file" accept="application/json" />
        </div>
      `,
      footHTML: `<button class="btn" id="btnCloseSettings">Cerrar</button>`
    });

    $("#btnCloseSettings").addEventListener("click", closeModal);

    $("#btnReset").addEventListener("click", () => {
      openModal({
        title: "Confirmar reinicio",
        bodyHTML: `<div class="small">Esto borra todo (trabajo, economía y agenda). No hay vuelta atrás.</div>`,
        footHTML: `
          <button class="btn" id="btnCancelReset">Cancelar</button>
          <button class="btn bad" id="btnConfirmReset">Sí, borrar todo</button>
        `
      });
      $("#btnCancelReset").addEventListener("click", closeModal);
      $("#btnConfirmReset").addEventListener("click", () => {
        localStorage.removeItem(STORAGE_KEY);
        state = loadState();
        closeModal();
        toast("Datos reiniciados");
        go("home");
      });
    });

    $("#btnExport").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `jfx_gestiones_export_${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("Exportado");
    });

    $("#btnImport").addEventListener("click", () => $("#fileImport").click());
    $("#fileImport").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if(!file) return;
      try{
        const text = await file.text();
        const parsed = JSON.parse(text);
        state = mergeDeep(structuredClone(defaultState), parsed);
        saveState();
        closeModal();
        toast("Importado");
        render();
      }catch{
        toast("JSON inválido");
      }
    });
  });

  btnQuickAdd.addEventListener("click", () => {
    const view = state.ui.lastView || "home";
    if(view === "work") return openWorkQuickAdd();
    if(view === "economy") return openEconomyQuickAdd();
    if(view === "agenda") return openAgendaQuickAdd();
    openModal({
      title: "Acción rápida",
      bodyHTML: `
        <div class="list">
          <div class="item">
            <div class="item__main">
              <div class="item__title">Añadir evento (Agenda)</div>
              <div class="item__meta">Cita, quedada, recordatorio…</div>
            </div>
            <div class="item__right"><button class="btn primary" id="qaAgenda">Abrir</button></div>
          </div>

          <div class="item">
            <div class="item__main">
              <div class="item__title">Añadir movimiento (Economía)</div>
              <div class="item__meta">Ingreso o gasto rápido</div>
            </div>
            <div class="item__right"><button class="btn primary" id="qaEco">Abrir</button></div>
          </div>

          <div class="item">
            <div class="item__main">
              <div class="item__title">Editar día de trabajo</div>
              <div class="item__meta">Horas / extras / velada</div>
            </div>
            <div class="item__right"><button class="btn primary" id="qaWork">Abrir</button></div>
          </div>
        </div>
      `,
      footHTML: `<button class="btn" id="qaClose">Cerrar</button>`
    });
    $("#qaClose").addEventListener("click", closeModal);
    $("#qaAgenda").addEventListener("click", () => { closeModal(); go("agenda"); openAgendaQuickAdd(); });
    $("#qaEco").addEventListener("click", () => { closeModal(); go("economy"); openEconomyQuickAdd(); });
    $("#qaWork").addEventListener("click", () => { closeModal(); go("work"); openWorkQuickAdd(); });
  });

  // =========================
  // Render
  // =========================
  function render(){
    const view = state.ui.lastView || "home";
    const params = state.ui.lastParams || {};

    btnBack.style.visibility = (view === "home") ? "hidden" : "visible";

    if(view === "home") return renderHome();
    if(view === "work") return renderWork(params);
    if(view === "economy") return renderEconomy(params);
    if(view === "agenda") return renderAgenda(params);

    renderHome();
  }

  // =========================
  // Home
  // =========================
  function renderHome(){
    setSubtitle("Gestiones");
    main.innerHTML = `
      <div class="card">
        <div class="card__head">
          <div>
            <div class="card__title">Pantalla de inicio</div>
            <div class="card__subtitle">3 apartados principales. Diseño limpio, rápido y ampliable.</div>
          </div>
        </div>
        <div class="card__body">
          <div class="bigtiles">
            <div class="tile" id="tileWork">
              <div class="tile__left">
                <div class="tile__title">Calendario de Trabajo</div>
                <div class="tile__desc">Turnos, rotaciones, extras, veladas, total horas y cash neto.</div>
              </div>
              <div class="tile__badge">🗓️</div>
            </div>

            <div class="tile" id="tileEco">
              <div class="tile__left">
                <div class="tile__title">Economía</div>
                <div class="tile__desc">Cuentas, movimientos, gastos fijos, créditos y metas con resumen mensual.</div>
              </div>
              <div class="tile__badge">💳</div>
            </div>

            <div class="tile" id="tileAgenda">
              <div class="tile__left">
                <div class="tile__title">Agenda</div>
                <div class="tile__desc">Estilo Google Calendar: eventos por día, mes navegable, detalles claros.</div>
              </div>
              <div class="tile__badge">📌</div>
            </div>
          </div>
        </div>
      </div>
    `;

    $("#tileWork").addEventListener("click", () => go("work"));
    $("#tileEco").addEventListener("click", () => go("economy"));
    $("#tileAgenda").addEventListener("click", () => go("agenda"));
  }

  // ============================================================
  // WORK (Calendario Trabajo)
  // ============================================================
  function renderWork(params){
    setSubtitle("Calendario de trabajo");

    const now = new Date();
    const cursor = params.cursor || monthCursor(now);
    const [cy, cm] = cursor.split("-").map(Number);
    const viewDate = new Date(cy, cm-1, 1);

    const years = [];
    for(let y = now.getFullYear()-4; y <= now.getFullYear()+4; y++) years.push(y);

    const job = state.work.job;

    const totals = workMonthTotals(cursor);

    main.innerHTML = `
      <div class="grid cols-1">
        <div class="card">
          <div class="card__head">
            <div>
              <div class="card__title">Calendario de Trabajo</div>
              <div class="card__subtitle">${MONTHS_ES[viewDate.getMonth()]} ${viewDate.getFullYear()} · ${escapeHTML(job.name)}</div>
            </div>
            <div class="row">
              <button class="btn" id="btnJob">Trabajo</button>
              <button class="btn primary" id="btnShiftDefs">Turnos</button>
            </div>
          </div>

          <div class="card__body">
            <div class="toolbar">
              <div class="row">
                <select class="select" id="selMonth" aria-label="Mes">
                  ${MONTHS_ES.map((m,idx)=> `<option value="${idx+1}" ${idx===viewDate.getMonth()?"selected":""}>${m}</option>`).join("")}
                </select>
                <select class="select" id="selYear" aria-label="Año">
                  ${years.map(y => `<option value="${y}" ${y===viewDate.getFullYear()?"selected":""}>${y}</option>`).join("")}
                </select>
              </div>

              <div class="row">
                <button class="btn" id="btnToday">Hoy</button>
                <button class="btn" id="btnPrev">←</button>
                <button class="btn" id="btnNext">→</button>
              </div>
            </div>

            <div class="hr"></div>

            <div class="kpi">
              <div class="kpi__item">
                <div class="kpi__label">Horas trabajadas</div>
                <div class="kpi__value">${totals.workHours.toFixed(2)}</div>
                <div class="kpi__hint">Incluye horas base (turnos)</div>
              </div>
              <div class="kpi__item">
                <div class="kpi__label">Horas extra</div>
                <div class="kpi__value">${totals.overtimeHours.toFixed(2)}</div>
                <div class="kpi__hint">Pagadas a su tarifa</div>
              </div>
              <div class="kpi__item">
                <div class="kpi__label">Horas velada</div>
                <div class="kpi__value">${totals.veladaHours.toFixed(2)}</div>
                <div class="kpi__hint">Marcadas manualmente</div>
              </div>
              <div class="kpi__item">
                <div class="kpi__label">Cash neto</div>
                <div class="kpi__value" style="color: var(--good)">${money(totals.net)}</div>
                <div class="kpi__hint">Ya descontado IRPF (${job.irpf}%)</div>
              </div>
            </div>

            <div class="hr"></div>

            ${renderWorkCalendar(viewDate)}
          </div>
        </div>
      </div>
    `;

    // Month/year selection
    $("#selMonth").addEventListener("change", () => {
      const m = Number($("#selMonth").value);
      const y = Number($("#selYear").value);
      go("work", { cursor: `${y}-${pad2(m)}` });
    });
    $("#selYear").addEventListener("change", () => {
      const m = Number($("#selMonth").value);
      const y = Number($("#selYear").value);
      go("work", { cursor: `${y}-${pad2(m)}` });
    });

    $("#btnToday").addEventListener("click", () => go("work", { cursor: monthCursor(new Date()) }));
    $("#btnPrev").addEventListener("click", () => {
      const d = new Date(viewDate);
      d.setMonth(d.getMonth()-1);
      go("work", { cursor: monthCursor(d) });
    });
    $("#btnNext").addEventListener("click", () => {
      const d = new Date(viewDate);
      d.setMonth(d.getMonth()+1);
      go("work", { cursor: monthCursor(d) });
    });

    $("#btnJob").addEventListener("click", () => openJobModal());
    $("#btnShiftDefs").addEventListener("click", () => openShiftDefsModal());

    // day click handlers
    $$(".day[data-date]").forEach(el => {
      el.addEventListener("click", () => openWorkDayModal(el.dataset.date));
    });
  }

  function renderWorkCalendar(firstOfMonth){
    const year = firstOfMonth.getFullYear();
    const m0 = firstOfMonth.getMonth();
    const days = daysInMonth(year, m0);
    const firstWd = startWeekdayMon0(firstOfMonth);
    const prevMonth = new Date(year, m0-1, 1);
    const prevDays = daysInMonth(prevMonth.getFullYear(), prevMonth.getMonth());

    const totalCells = 42; // 6 weeks
    const cells = [];

    for(let i=0; i<totalCells; i++){
      const dayNum = i - firstWd + 1;
      let dateObj, inMonth = true;

      if(dayNum <= 0){
        const dn = prevDays + dayNum;
        dateObj = new Date(year, m0-1, dn);
        inMonth = false;
      }else if(dayNum > days){
        const dn = dayNum - days;
        dateObj = new Date(year, m0+1, dn);
        inMonth = false;
      }else{
        dateObj = new Date(year, m0, dayNum);
      }

      const iso = `${dateObj.getFullYear()}-${pad2(dateObj.getMonth()+1)}-${pad2(dateObj.getDate())}`;
      const { shiftCode, shiftDef } = workShiftForDate(iso);

      const dotColor = shiftDef?.color || "#9ca3af";
      const label = shiftDef?.label || "—";

      const ov = state.work.overrides[iso];
      const hasExtras = ov && safeNum(ov.overtimeHours,0) > 0;
      const hasVelada = ov && safeNum(ov.veladaHours,0) > 0;

      cells.push(`
        <div class="day ${inMonth?"":"muted"}" data-date="${iso}">
          <div class="day__num">${dateObj.getDate()}</div>
          <div class="pill" title="${escapeHTML(label)}">
            <span class="dot" style="background:${dotColor}"></span>
            <span>${escapeHTML(shiftCode || "—")}</span>
          </div>
          ${hasExtras ? `<div class="pill" style="margin-top:6px"><span class="dot" style="background:#f97316"></span><span>Extra</span></div>` : ""}
          ${hasVelada ? `<div class="pill" style="margin-top:6px"><span class="dot" style="background:#A212C4"></span><span>Velada</span></div>` : ""}
        </div>
      `);
    }

    return `
      <div class="calendar">
        <div class="cal__head">
          ${WEEKDAYS.map(d=>`<div>${d}</div>`).join("")}
        </div>
        <div class="cal__grid">
          ${cells.join("")}
        </div>
      </div>
      <div class="small" style="margin-top:10px">
        Tip: pulsa un día para editar turno/horas, marcar extras y veladas.
      </div>
    `;
  }

  function workShiftForDate(iso){
    const job = state.work.job;
    const sd = job.shiftDefs || {};
    if(!job.contractStart) return { shiftCode:"", shiftDef:null };

    const start = parseISO(job.contractStart);
    const d = parseISO(iso);

    if(job.contractEnd){
      const end = parseISO(job.contractEnd);
      if(d > end) return { shiftCode:"", shiftDef:null };
    }

    const rotation = job.rotation?.length ? job.rotation : ["L"];
    const dayDiff = Math.floor((d - start) / (1000*60*60*24));
    if(dayDiff < 0) return { shiftCode:"", shiftDef:null };

    const code = rotation[dayDiff % rotation.length];
    return { shiftCode: code, shiftDef: sd[code] || null };
  }

  function workDayEffective(iso){
    const job = state.work.job;
    const { shiftCode, shiftDef } = workShiftForDate(iso);
    const ov = state.work.overrides[iso] || {};

    const hoursDefault = shiftDef ? safeNum(shiftDef.defaultHours, 0) : 0;

    return {
      shift: ov.shift ?? shiftCode,
      hours: ov.hours ?? hoursDefault,
      overtimeHours: safeNum(ov.overtimeHours, 0),
      overtimeRate: safeNum(ov.overtimeRate, job.overtimeDefaultRate),
      veladaHours: safeNum(ov.veladaHours, 0),
      veladaRate: safeNum(ov.veladaRate, job.veladaDefaultRate),
      note: ov.note || ""
    };
  }

  function workMonthTotals(cursor){
    const [y,m] = cursor.split("-").map(Number);
    const days = daysInMonth(y, m-1);

    let workHours = 0;
    let overtimeHours = 0;
    let veladaHours = 0;

    let gross = 0;
    const job = state.work.job;
    const baseRate = safeNum(job.salaryPerHour, 0);

    for(let d=1; d<=days; d++){
      const iso = `${y}-${pad2(m)}-${pad2(d)}`;
      const eff = workDayEffective(iso);

      if(!eff.shift) continue;

      workHours += safeNum(eff.hours,0);
      overtimeHours += safeNum(eff.overtimeHours,0);
      veladaHours += safeNum(eff.veladaHours,0);

      gross += safeNum(eff.hours,0) * baseRate;
      gross += safeNum(eff.overtimeHours,0) * safeNum(eff.overtimeRate,0);
      gross += safeNum(eff.veladaHours,0) * safeNum(eff.veladaRate,0);
    }

    const irpf = clamp(safeNum(job.irpf,0), 0, 60);
    const net = gross * (1 - irpf/100);

    return { workHours, overtimeHours, veladaHours, gross, net };
  }

  function openJobModal(){
    const job = state.work.job;

    openModal({
      title: "Configurar trabajo",
      bodyHTML: `
        <div class="form">
          <div class="field">
            <div class="label">Nombre del trabajo</div>
            <input class="input" id="jobName" value="${escapeAttr(job.name)}" placeholder="Ej: Stellantis QCP" />
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Inicio de contrato</div>
              <input class="input" id="jobStart" type="date" value="${escapeAttr(job.contractStart || todayISO())}" />
            </div>
            <div class="field">
              <div class="label">Fin de contrato (opcional)</div>
              <input class="input" id="jobEnd" type="date" value="${escapeAttr(job.contractEnd || "")}" />
            </div>
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Salario por hora (€)</div>
              <input class="input" id="jobRate" type="number" step="0.01" value="${escapeAttr(job.salaryPerHour)}" />
            </div>
            <div class="field">
              <div class="label">IRPF aplicado (%)</div>
              <input class="input" id="jobIrpf" type="number" step="0.1" value="${escapeAttr(job.irpf)}" />
            </div>
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Tarifa extra por defecto (€/h)</div>
              <input class="input" id="jobOT" type="number" step="0.01" value="${escapeAttr(job.overtimeDefaultRate)}" />
            </div>
            <div class="field">
              <div class="label">Tarifa velada por defecto (€/h)</div>
              <input class="input" id="jobVel" type="number" step="0.01" value="${escapeAttr(job.veladaDefaultRate)}" />
            </div>
          </div>

          <div class="field">
            <div class="label">Rotación (códigos separados por coma)</div>
            <input class="input" id="jobRot" value="${escapeAttr((job.rotation||[]).join(","))}" placeholder="Ej: M,T,N,L" />
            <div class="small">Usa códigos definidos en Turnos. Ejemplo típico: <b>M,T,N,L</b> (se repite).</div>
          </div>
        </div>
      `,
      footHTML: `
        <button class="btn" id="jobCancel">Cancelar</button>
        <button class="btn primary" id="jobSave">Guardar</button>
      `
    });

    $("#jobCancel").addEventListener("click", closeModal);
    $("#jobSave").addEventListener("click", () => {
      job.name = $("#jobName").value.trim() || "Trabajo";
      job.contractStart = $("#jobStart").value || todayISO();
      job.contractEnd = $("#jobEnd").value || "";
      job.salaryPerHour = safeNum($("#jobRate").value, job.salaryPerHour);
      job.irpf = safeNum($("#jobIrpf").value, job.irpf);
      job.overtimeDefaultRate = safeNum($("#jobOT").value, job.overtimeDefaultRate);
      job.veladaDefaultRate = safeNum($("#jobVel").value, job.veladaDefaultRate);

      const rot = $("#jobRot").value.split(",").map(s=>s.trim()).filter(Boolean);
      job.rotation = rot.length ? rot : ["L"];

      saveState();
      closeModal();
      toast("Trabajo guardado");
      render();
    });
  }

  function openShiftDefsModal(){
    const sd = state.work.job.shiftDefs;

    const rows = Object.entries(sd).map(([code,def]) => `
      <div class="item" data-code="${escapeAttr(code)}">
        <div class="item__main">
          <div class="item__title">${escapeHTML(code)} · ${escapeHTML(def.label)}</div>
          <div class="item__meta">Horas por defecto: ${safeNum(def.defaultHours,0)} · Color: <span style="font-weight:900">${escapeHTML(def.color)}</span></div>
        </div>
        <div class="item__right">
          <span class="badge" style="border-color:${escapeAttr(def.color)}">●</span>
          <button class="btn" data-edit="${escapeAttr(code)}">Editar</button>
        </div>
      </div>
    `).join("");

    openModal({
      title: "Turnos y colores",
      bodyHTML: `
        <div class="small">Aquí puedes cambiar nombres, colores y horas por defecto. También puedes crear nuevos códigos.</div>
        <div class="hr"></div>
        <div class="list">${rows}</div>
        <div class="hr"></div>
        <button class="btn primary" id="addShift">Añadir turno nuevo</button>
      `,
      footHTML: `
        <button class="btn" id="closeShift">Cerrar</button>
      `
    });

    $("#closeShift").addEventListener("click", closeModal);

    $$("[data-edit]").forEach(b => {
      b.addEventListener("click", () => {
        const code = b.getAttribute("data-edit");
        closeModal();
        openShiftEditModal(code);
      });
    });

    $("#addShift").addEventListener("click", () => {
      closeModal();
      openShiftEditModal("");
    });
  }

  function openShiftEditModal(code){
    const sd = state.work.job.shiftDefs;
    const editing = !!code && !!sd[code];
    const def = editing ? sd[code] : { label:"", color:"#9ca3af", defaultHours:0 };

    openModal({
      title: editing ? `Editar turno ${code}` : "Crear turno",
      bodyHTML: `
        <div class="form">
          <div class="two">
            <div class="field">
              <div class="label">Código (ej: M, T, N, L, V...)</div>
              <input class="input" id="sCode" value="${escapeAttr(code)}" ${editing?"disabled":""} placeholder="Ej: X" />
            </div>
            <div class="field">
              <div class="label">Horas por defecto</div>
              <input class="input" id="sHours" type="number" step="0.25" value="${escapeAttr(def.defaultHours)}" />
            </div>
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Nombre visible</div>
              <input class="input" id="sLabel" value="${escapeAttr(def.label)}" placeholder="Ej: Mañana" />
            </div>
            <div class="field">
              <div class="label">Color (hex)</div>
              <input class="input" id="sColor" value="${escapeAttr(def.color)}" placeholder="#22c55e" />
            </div>
          </div>

          <div class="small">Consejo: usa colores consistentes para que el calendario se lea de un vistazo.</div>
        </div>
      `,
      footHTML: `
        <button class="btn" id="sCancel">Cancelar</button>
        ${editing ? `<button class="btn bad" id="sDelete">Eliminar</button>` : ""}
        <button class="btn primary" id="sSave">Guardar</button>
      `
    });

    $("#sCancel").addEventListener("click", closeModal);

    if(editing){
      $("#sDelete").addEventListener("click", () => {
        delete sd[code];
        saveState();
        closeModal();
        toast("Turno eliminado");
        render();
      });
    }

    $("#sSave").addEventListener("click", () => {
      const newCode = ($("#sCode").value || "").trim();
      if(!newCode){
        toast("Código requerido");
        return;
      }
      sd[newCode] = {
        label: ($("#sLabel").value || "").trim() || newCode,
        color: ($("#sColor").value || "").trim() || "#9ca3af",
        defaultHours: safeNum($("#sHours").value, 0)
      };
      saveState();
      closeModal();
      toast("Turno guardado");
      render();
    });
  }

  function openWorkDayModal(iso){
    const job = state.work.job;
    const sd = job.shiftDefs;

    const eff = workDayEffective(iso);
    const { shiftCode } = workShiftForDate(iso);

    const options = Object.keys(sd).sort().map(code =>
      `<option value="${escapeAttr(code)}" ${(eff.shift===code)?"selected":""}>${escapeHTML(code)} · ${escapeHTML(sd[code].label)}</option>`
    ).join("");

    openModal({
      title: `Día ${iso}`,
      bodyHTML: `
        <div class="form">
          <div class="two">
            <div class="field">
              <div class="label">Turno</div>
              <select class="select" id="dShift">
                <option value="">— (sin turno)</option>
                ${options}
              </select>
              <div class="small">Por defecto viene de la rotación (${escapeHTML(shiftCode || "—")}).</div>
            </div>

            <div class="field">
              <div class="label">Horas trabajadas</div>
              <input class="input" id="dHours" type="number" step="0.25" value="${escapeAttr(eff.hours)}" />
            </div>
          </div>

          <div class="hr"></div>

          <div class="two">
            <div class="field">
              <div class="label">Horas extra</div>
              <input class="input" id="dOTHours" type="number" step="0.25" value="${escapeAttr(eff.overtimeHours)}" />
            </div>
            <div class="field">
              <div class="label">Tarifa extra (€/h)</div>
              <input class="input" id="dOTRate" type="number" step="0.01" value="${escapeAttr(eff.overtimeRate)}" />
            </div>
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Horas velada</div>
              <input class="input" id="dVHours" type="number" step="0.25" value="${escapeAttr(eff.veladaHours)}" />
            </div>
            <div class="field">
              <div class="label">Tarifa velada (€/h)</div>
              <input class="input" id="dVRate" type="number" step="0.01" value="${escapeAttr(eff.veladaRate)}" />
            </div>
          </div>

          <div class="field">
            <div class="label">Nota (opcional)</div>
            <input class="input" id="dNote" value="${escapeAttr(eff.note)}" placeholder="Ej: 2h extra por cubrir..." />
          </div>
        </div>
      `,
      footHTML: `
        <button class="btn" id="dCancel">Cancelar</button>
        <button class="btn bad" id="dClear">Limpiar cambios</button>
        <button class="btn primary" id="dSave">Guardar</button>
      `
    });

    $("#dCancel").addEventListener("click", closeModal);

    $("#dClear").addEventListener("click", () => {
      delete state.work.overrides[iso];
      saveState();
      closeModal();
      toast("Cambios borrados");
      render();
    });

    $("#dSave").addEventListener("click", () => {
      const shift = ($("#dShift").value || "").trim();
      const hours = safeNum($("#dHours").value, 0);
      const overtimeHours = safeNum($("#dOTHours").value, 0);
      const overtimeRate = safeNum($("#dOTRate").value, state.work.job.overtimeDefaultRate);
      const veladaHours = safeNum($("#dVHours").value, 0);
      const veladaRate = safeNum($("#dVRate").value, state.work.job.veladaDefaultRate);
      const note = ($("#dNote").value || "").trim();

      state.work.overrides[iso] = { shift, hours, overtimeHours, overtimeRate, veladaHours, veladaRate, note };
      saveState();
      closeModal();
      toast("Día actualizado");
      render();
    });
  }

  function openWorkQuickAdd(){
    openWorkDayModal(todayISO());
  }

  // ============================================================
  // ECONOMY
  // ============================================================
  function renderEconomy(params){
    setSubtitle("Economía");

    const eco = state.economy;
    const cursor = params.cursor || eco.monthCursor || monthCursor(new Date());
    eco.monthCursor = cursor;

    const tab = params.tab || "overview"; // overview/accounts/fixed/credits/goals
    const summary = economySummary(cursor);

    main.innerHTML = `
      <div class="grid cols-1">
        <div class="card">
          <div class="card__head">
            <div>
              <div class="card__title">Economía</div>
              <div class="card__subtitle">Resumen arriba, gestión limpia debajo.</div>
            </div>
            <div class="row">
              ${renderMonthPicker(cursor, "eco")}
            </div>
          </div>

          <div class="card__body">
            <div class="kpi">
              <div class="kpi__item">
                <div class="kpi__label">Saldo total</div>
                <div class="kpi__value">${money(summary.totalBalance)}</div>
                <div class="kpi__hint">Cuentas (saldo actual)</div>
              </div>
              <div class="kpi__item">
                <div class="kpi__label">Disponible (estimado)</div>
                <div class="kpi__value">${money(summary.available)}</div>
                <div class="kpi__hint">Total - pendientes del mes</div>
              </div>
              <div class="kpi__item">
                <div class="kpi__label">Pendientes del mes</div>
                <div class="kpi__value">${money(summary.pendingMonth)}</div>
                <div class="kpi__hint">Fijos + créditos + movimientos pendientes</div>
              </div>
              <div class="kpi__item">
                <div class="kpi__label">Movimientos (mes)</div>
                <div class="kpi__value">${money(summary.netMonth)}</div>
                <div class="kpi__hint">Ingresos - gastos (fecha en mes)</div>
              </div>
            </div>

            <div class="hr"></div>

            <div class="tabs">
              <button class="tab ${tab==="overview"?"active":""}" data-tab="overview">Resumen</button>
              <button class="tab ${tab==="accounts"?"active":""}" data-tab="accounts">Cuentas</button>
              <button class="tab ${tab==="fixed"?"active":""}" data-tab="fixed">Gastos fijos</button>
              <button class="tab ${tab==="credits"?"active":""}" data-tab="credits">Créditos</button>
              <button class="tab ${tab==="goals"?"active":""}" data-tab="goals">Metas</button>
            </div>

            <div class="hr"></div>

            <div id="ecoContent"></div>
          </div>
        </div>
      </div>
    `;

    wireMonthPicker("eco", cursor, (newCursor) => go("economy", { cursor:newCursor, tab }));

    $$(".tab[data-tab]").forEach(t => {
      t.addEventListener("click", () => go("economy", { cursor, tab: t.dataset.tab }));
    });

    const ecoContent = $("#ecoContent");
    if(tab === "overview") ecoContent.innerHTML = renderEcoOverview(cursor);
    if(tab === "accounts") ecoContent.innerHTML = renderEcoAccounts(cursor);
    if(tab === "fixed") ecoContent.innerHTML = renderEcoFixed();
    if(tab === "credits") ecoContent.innerHTML = renderEcoCredits();
    if(tab === "goals") ecoContent.innerHTML = renderEcoGoals(cursor);

    wireEcoActions(cursor, tab);
  }

  function renderMonthPicker(cursor, prefix){
    const [y,m] = cursor.split("-").map(Number);
    const now = new Date();

    const years = [];
    for(let yy = now.getFullYear()-4; yy <= now.getFullYear()+4; yy++) years.push(yy);

    return `
      <select class="select" id="${prefix}_m">
        ${MONTHS_ES.map((name,idx)=> `<option value="${idx+1}" ${idx+1===m?"selected":""}>${name}</option>`).join("")}
      </select>
      <select class="select" id="${prefix}_y">
        ${years.map(yy => `<option value="${yy}" ${yy===y?"selected":""}>${yy}</option>`).join("")}
      </select>
      <button class="btn" id="${prefix}_prev">←</button>
      <button class="btn" id="${prefix}_next">→</button>
    `;
  }
  function wireMonthPicker(prefix, cursor, onChange){
    const [y,m] = cursor.split("-").map(Number);
    const d = new Date(y, m-1, 1);

    $(`#${prefix}_m`).addEventListener("change", () => {
      const mm = Number($(`#${prefix}_m`).value);
      const yy = Number($(`#${prefix}_y`).value);
      onChange(`${yy}-${pad2(mm)}`);
    });
    $(`#${prefix}_y`).addEventListener("change", () => {
      const mm = Number($(`#${prefix}_m`).value);
      const yy = Number($(`#${prefix}_y`).value);
      onChange(`${yy}-${pad2(mm)}`);
    });
    $(`#${prefix}_prev`).addEventListener("click", () => {
      const nd = new Date(d); nd.setMonth(nd.getMonth()-1);
      onChange(monthCursor(nd));
    });
    $(`#${prefix}_next`).addEventListener("click", () => {
      const nd = new Date(d); nd.setMonth(nd.getMonth()+1);
      onChange(monthCursor(nd));
    });
  }

  function accountBalance(accountId){
    const acc = state.economy.accounts.find(a => a.id === accountId);
    if(!acc) return 0;
    let bal = safeNum(acc.initialBalance, 0);
    for(const mv of state.economy.movements){
      if(mv.type === "transfer"){
        if(mv.meta?.from === accountId) bal -= safeNum(mv.amount,0);
        if(mv.meta?.to === accountId) bal += safeNum(mv.amount,0);
        continue;
      }
      if(mv.accountId !== accountId) continue;
      const amt = safeNum(mv.amount, 0);
      if(mv.type === "income") bal += amt;
      if(mv.type === "expense") bal -= amt;
    }
    return bal;
  }

  function economySummary(cursor){
    const [y,m] = cursor.split("-").map(Number);
    const monthStart = new Date(y, m-1, 1);
    const monthEnd = new Date(y, m, 0);

    let totalBalance = 0;
    for(const a of state.economy.accounts){
      totalBalance += accountBalance(a.id);
    }

    let incomes = 0, expenses = 0;
    let pendingMov = 0;

    for(const mv of state.economy.movements){
      const d = parseISO(mv.date);
      if(d < monthStart || d > monthEnd) continue;

      const amt = safeNum(mv.amount,0);
      if(mv.type === "income") incomes += amt;
      if(mv.type === "expense") expenses += amt;

      if(mv.status === "pending" && (mv.type === "expense")) pendingMov += amt;
    }

    let pendingFixed = 0;
    for(const fx of state.economy.fixedExpenses.filter(x=>x.active)){
      pendingFixed += safeNum(fx.amount,0);
    }
    let pendingCredits = 0;
    for(const cr of state.economy.credits.filter(x=>x.active)){
      pendingCredits += safeNum(cr.monthlyFee,0);
    }

    const pendingMonth = pendingFixed + pendingCredits + pendingMov;
    const netMonth = incomes - expenses;

    const available = totalBalance - pendingMonth;

    return { totalBalance, pendingMonth, available, netMonth };
  }

  function renderEcoOverview(cursor){
    const eco = state.economy;

    const pendingList = [];

    for(const fx of eco.fixedExpenses.filter(x=>x.active)){
      pendingList.push({ kind:"Fijo", title: fx.title, amount: fx.amount, day: fx.dayOfMonth });
    }
    for(const cr of eco.credits.filter(x=>x.active)){
      pendingList.push({ kind:"Crédito", title: cr.title, amount: cr.monthlyFee, day: cr.dayOfMonth });
    }

    const [y,m] = cursor.split("-").map(Number);
    const ms = new Date(y, m-1, 1);
    const me = new Date(y, m, 0);

    for(const mv of eco.movements.filter(x => x.status==="pending" && x.type==="expense")){
      const d = parseISO(mv.date);
      if(d>=ms && d<=me){
        pendingList.push({ kind:"Pendiente", title: mv.name, amount: mv.amount, day: d.getDate() });
      }
    }
    pendingList.sort((a,b)=> (a.day||99)-(b.day||99));

    const lastMovs = eco.movements
      .slice()
      .sort((a,b)=> (b.date||"").localeCompare(a.date||""))
      .slice(0, 8);

    return `
      <div class="grid cols-2">
        <div class="card">
          <div class="card__head">
            <div>
              <div class="card__title">Pendientes del mes</div>
              <div class="card__subtitle">Lo que se va a cobrar en el mes seleccionado</div>
            </div>
          </div>
          <div class="card__body">
            ${pendingList.length ? `
              <div class="list">
                ${pendingList.slice(0,10).map(p => `
                  <div class="item">
                    <div class="item__main">
                      <div class="item__title">${escapeHTML(p.title)}</div>
                      <div class="item__meta">${escapeHTML(p.kind)} · Día ${p.day}</div>
                    </div>
                    <div class="item__right">
                      <span class="badge bad">${money(p.amount)}</span>
                    </div>
                  </div>
                `).join("")}
              </div>
            ` : `<div class="small">No hay pendientes configurados.</div>`}
          </div>
        </div>

        <div class="card">
          <div class="card__head">
            <div>
              <div class="card__title">Últimos movimientos</div>
              <div class="card__subtitle">Rápido para revisar</div>
            </div>
          </div>
          <div class="card__body">
            ${lastMovs.length ? `
              <div class="list">
                ${lastMovs.map(mv => `
                  <div class="item">
                    <div class="item__main">
                      <div class="item__title">${escapeHTML(mv.name)}</div>
                      <div class="item__meta">${mv.date} · ${labelMovement(mv)}</div>
                    </div>
                    <div class="item__right">
                      <span class="badge ${mv.type==="income"?"good":"bad"}">${money(mv.amount)}</span>
                      ${mv.status==="pending" ? `<span class="badge warn">Pendiente</span>` : ``}
                    </div>
                  </div>
                `).join("")}
              </div>
            ` : `<div class="small">Aún no hay movimientos. Pulsa “＋” para añadir.</div>`}
          </div>
        </div>
      </div>
    `;
  }

  function renderEcoAccounts(cursor){
    const eco = state.economy;
    const accounts = eco.accounts.slice().sort((a,b)=> a.name.localeCompare(b.name));
    return `
      <div class="toolbar">
        <div class="row">
          <button class="btn primary" id="addAccount">Añadir cuenta</button>
        </div>
        <div class="row">
          <button class="btn good" id="addIncome">Añadir ingreso</button>
          <button class="btn bad" id="addExpense">Añadir gasto</button>
          <button class="btn" id="addTransfer">Transferencia</button>
        </div>
      </div>

      <div class="hr"></div>

      <div class="list">
        ${accounts.map(a => `
          <div class="item">
            <div class="item__main">
              <div class="item__title">${escapeHTML(a.name)}</div>
              <div class="item__meta">${escapeHTML(a.bank || "")} · Saldo: <b>${money(accountBalance(a.id))}</b></div>
            </div>
            <div class="item__right">
              <button class="btn" data-openacc="${escapeAttr(a.id)}">Abrir</button>
              <button class="btn" data-editacc="${escapeAttr(a.id)}">Editar</button>
            </div>
          </div>
        `).join("")}
      </div>

      <div class="small" style="margin-top:10px">
        Consejo: Mantén pocas cuentas aquí y todo el movimiento se gestiona por “Ingresos/Gastos/Transferencias”.
      </div>
    `;
  }

  function renderEcoFixed(){
    const list = state.economy.fixedExpenses.slice().sort((a,b)=> a.dayOfMonth-b.dayOfMonth);
    return `
      <div class="toolbar">
        <div class="row">
          <button class="btn primary" id="addFixed">Añadir gasto fijo</button>
        </div>
      </div>

      <div class="hr"></div>

      ${list.length ? `
        <div class="list">
          ${list.map(f => `
            <div class="item">
              <div class="item__main">
                <div class="item__title">${escapeHTML(f.title)}</div>
                <div class="item__meta">Día ${f.dayOfMonth} · ${f.active ? "Activo" : "Pausado"} · Cuenta: ${escapeHTML(accountName(f.accountId))}</div>
              </div>
              <div class="item__right">
                <span class="badge bad">${money(f.amount)}</span>
                <button class="btn" data-editfixed="${escapeAttr(f.id)}">Editar</button>
              </div>
            </div>
          `).join("")}
        </div>
      ` : `<div class="small">Aún no tienes gastos fijos. Aquí van suscripciones, seguros, etc.</div>`}
    `;
  }

  function renderEcoCredits(){
    const list = state.economy.credits.slice().sort((a,b)=> a.dayOfMonth-b.dayOfMonth);
    return `
      <div class="toolbar">
        <div class="row">
          <button class="btn primary" id="addCredit">Añadir crédito</button>
        </div>
      </div>

      <div class="hr"></div>

      ${list.length ? `
        <div class="list">
          ${list.map(c => `
            <div class="item">
              <div class="item__main">
                <div class="item__title">${escapeHTML(c.title)}</div>
                <div class="item__meta">Día ${c.dayOfMonth} · ${c.active ? "Activo" : "Pausado"} · Cuenta: ${escapeHTML(accountName(c.accountId))}</div>
              </div>
              <div class="item__right">
                <span class="badge bad">${money(c.monthlyFee)}</span>
                <button class="btn" data-editcredit="${escapeAttr(c.id)}">Editar</button>
              </div>
            </div>
          `).join("")}
        </div>
      ` : `<div class="small">Aquí metes préstamos o pagos a plazos: cuota mensual, día de cobro y cuenta.</div>`}
    `;
  }

  function renderEcoGoals(cursor){
    const goals = state.economy.goals.slice().sort((a,b)=> a.title.localeCompare(b.title));
    const listHTML = goals.map(g => {
      const progress = goalProgress(g);
      return `
        <div class="item">
          <div class="item__main">
            <div class="item__title">${escapeHTML(g.title)}</div>
            <div class="item__meta">
              Objetivo: <b>${money(g.targetAmount)}</b> ·
              Ahorrado: <b>${money(progress.saved)}</b> ·
              Falta: <b>${money(progress.remaining)}</b> ·
              ${progress.pct.toFixed(1)}%
            </div>
          </div>
          <div class="item__right">
            <button class="btn" data-opengoal="${escapeAttr(g.id)}">Abrir</button>
            <button class="btn" data-editgoal="${escapeAttr(g.id)}">Editar</button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="toolbar">
        <div class="row">
          <button class="btn primary" id="addGoal">Añadir meta</button>
        </div>
      </div>

      <div class="hr"></div>

      ${goals.length ? `<div class="list">${listHTML}</div>` : `<div class="small">Crea metas: “ahorrar X en Y tiempo” y registra aportes/gastos.</div>`}
    `;
  }

  function wireEcoActions(cursor, tab){
    if(tab === "accounts"){
      $("#addAccount")?.addEventListener("click", openAccountModal);
      $("#addIncome")?.addEventListener("click", () => openMovementModal("income"));
      $("#addExpense")?.addEventListener("click", () => openMovementModal("expense"));
      $("#addTransfer")?.addEventListener("click", openTransferModal);

      $$("[data-editacc]").forEach(b => b.addEventListener("click", () => openAccountModal(b.dataset.editacc)));
      $$("[data-openacc]").forEach(b => b.addEventListener("click", () => openAccountDetail(b.dataset.openacc, cursor)));
    }

    if(tab === "fixed"){
      $("#addFixed")?.addEventListener("click", () => openFixedModal());
      $$("[data-editfixed]").forEach(b => b.addEventListener("click", () => openFixedModal(b.dataset.editfixed)));
    }

    if(tab === "credits"){
      $("#addCredit")?.addEventListener("click", () => openCreditModal());
      $$("[data-editcredit]").forEach(b => b.addEventListener("click", () => openCreditModal(b.dataset.editcredit)));
    }

    if(tab === "goals"){
      $("#addGoal")?.addEventListener("click", () => openGoalModal());
      $$("[data-editgoal]").forEach(b => b.addEventListener("click", () => openGoalModal(b.dataset.editgoal)));
      $$("[data-opengoal]").forEach(b => b.addEventListener("click", () => openGoalDetail(b.dataset.opengoal)));
    }
  }

  function openEconomyQuickAdd(){
    openMovementModal("expense");
  }

  function accountName(id){
    return state.economy.accounts.find(a=>a.id===id)?.name || "—";
  }

  function labelMovement(mv){
    if(mv.type === "income") return "Ingreso";
    if(mv.type === "expense") return "Gasto";
    if(mv.type === "transfer") return "Transferencia";
    return "Movimiento";
  }

  function openAccountModal(accountId){
    const eco = state.economy;
    const editing = !!accountId;
    const acc = editing ? eco.accounts.find(a=>a.id===accountId) : null;

    openModal({
      title: editing ? "Editar cuenta" : "Nueva cuenta",
      bodyHTML: `
        <div class="form">
          <div class="two">
            <div class="field">
              <div class="label">Nombre</div>
              <input class="input" id="accName" value="${escapeAttr(acc?.name || "")}" placeholder="Ej: Caixa nómina" />
            </div>
            <div class="field">
              <div class="label">Banco (opcional)</div>
              <input class="input" id="accBank" value="${escapeAttr(acc?.bank || "")}" placeholder="Ej: BBVA" />
            </div>
          </div>

          <div class="field">
            <div class="label">Saldo inicial (€)</div>
            <input class="input" id="accInit" type="number" step="0.01" value="${escapeAttr(acc?.initialBalance ?? 0)}" />
            <div class="small">Este es el saldo “de partida”. Después, ingresos/gastos lo modifican automáticamente.</div>
          </div>
        </div>
      `,
      footHTML: `
        <button class="btn" id="accCancel">Cancelar</button>
        ${editing ? `<button class="btn bad" id="accDelete">Eliminar</button>` : ""}
        <button class="btn primary" id="accSave">Guardar</button>
      `
    });

    $("#accCancel").addEventListener("click", closeModal);

    if(editing){
      $("#accDelete").addEventListener("click", () => {
        eco.accounts = eco.accounts.filter(a=>a.id!==accountId);
        saveState();
        closeModal();
        toast("Cuenta eliminada");
        render();
      });
    }

    $("#accSave").addEventListener("click", () => {
      const name = ($("#accName").value || "").trim();
      if(!name){ toast("Nombre requerido"); return; }

      const bank = ($("#accBank").value || "").trim();
      const initialBalance = safeNum($("#accInit").value, 0);

      if(editing){
        acc.name = name;
        acc.bank = bank;
        acc.initialBalance = initialBalance;
      }else{
        eco.accounts.push({ id: uid(), name, bank, initialBalance, createdAt: todayISO(), cards: [] });
      }

      saveState();
      closeModal();
      toast("Cuenta guardada");
      render();
    });
  }

  function openMovementModal(type){
    const eco = state.economy;
    const accounts = eco.accounts;

    if(!accounts.length){
      toast("Crea una cuenta primero");
      openAccountModal();
      return;
    }

    openModal({
      title: type === "income" ? "Añadir ingreso" : "Añadir gasto",
      bodyHTML: `
        <div class="form">
          <div class="two">
            <div class="field">
              <div class="label">Cuenta</div>
              <select class="select" id="mvAcc">
                ${accounts.map(a=>`<option value="${escapeAttr(a.id)}">${escapeHTML(a.name)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <div class="label">Fecha</div>
              <input class="input" id="mvDate" type="date" value="${todayISO()}" />
            </div>
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Importe (€)</div>
              <input class="input" id="mvAmt" type="number" step="0.01" placeholder="0.00" />
            </div>
            <div class="field">
              <div class="label">Estado</div>
              <select class="select" id="mvStatus">
                <option value="cleared">Confirmado</option>
                <option value="pending">Pendiente</option>
              </select>
            </div>
          </div>

          <div class="field">
            <div class="label">Nombre / concepto</div>
            <input class="input" id="mvName" placeholder="Ej: Nómina / Luz / Compra..." />
          </div>

          <div class="small">Todo se refleja en el resumen. Si lo marcas como “pendiente”, cuenta como pendiente del mes.</div>
        </div>
      `,
      footHTML: `
        <button class="btn" id="mvCancel">Cancelar</button>
        <button class="btn primary" id="mvSave">Guardar</button>
      `
    });

    $("#mvCancel").addEventListener("click", closeModal);
    $("#mvSave").addEventListener("click", () => {
      const accountId = $("#mvAcc").value;
      const date = $("#mvDate").value || todayISO();
      const amount = safeNum($("#mvAmt").value, NaN);
      const name = ($("#mvName").value || "").trim();
      const status = $("#mvStatus").value;

      if(!name){ toast("Pon un nombre/concepto"); return; }
      if(!Number.isFinite(amount) || amount <= 0){ toast("Importe inválido"); return; }

      eco.movements.push({
        id: uid(),
        date,
        accountId,
        type,
        name,
        amount,
        status,
        meta: {}
      });

      saveState();
      closeModal();
      toast("Movimiento guardado");
      render();
    });
  }

  function openTransferModal(){
    const eco = state.economy;
    const accounts = eco.accounts;
    if(accounts.length < 2){
      toast("Necesitas 2 cuentas para transferir");
      return;
    }

    openModal({
      title: "Transferencia",
      bodyHTML: `
        <div class="form">
          <div class="two">
            <div class="field">
              <div class="label">Desde</div>
              <select class="select" id="trFrom">
                ${accounts.map(a=>`<option value="${escapeAttr(a.id)}">${escapeHTML(a.name)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <div class="label">Hacia</div>
              <select class="select" id="trTo">
                ${accounts.map(a=>`<option value="${escapeAttr(a.id)}">${escapeHTML(a.name)}</option>`).join("")}
              </select>
            </div>
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Fecha</div>
              <input class="input" id="trDate" type="date" value="${todayISO()}" />
            </div>
            <div class="field">
              <div class="label">Importe (€)</div>
              <input class="input" id="trAmt" type="number" step="0.01" placeholder="0.00" />
            </div>
          </div>

          <div class="field">
            <div class="label">Concepto</div>
            <input class="input" id="trName" placeholder="Ej: Traspaso ahorro" />
          </div>
        </div>
      `,
      footHTML: `
        <button class="btn" id="trCancel">Cancelar</button>
        <button class="btn primary" id="trSave">Guardar</button>
      `
    });

    $("#trCancel").addEventListener("click", closeModal);
    $("#trSave").addEventListener("click", () => {
      const from = $("#trFrom").value;
      const to = $("#trTo").value;
      if(from === to){ toast("Elige cuentas distintas"); return; }

      const date = $("#trDate").value || todayISO();
      const amount = safeNum($("#trAmt").value, NaN);
      const name = ($("#trName").value || "").trim() || "Transferencia";

      if(!Number.isFinite(amount) || amount <= 0){ toast("Importe inválido"); return; }

      state.economy.movements.push({
        id: uid(),
        date,
        accountId: "",
        type: "transfer",
        name,
        amount,
        status: "cleared",
        meta: { from, to }
      });

      saveState();
      closeModal();
      toast("Transferencia guardada");
      render();
    });
  }

  function openAccountDetail(accountId, cursor){
    const acc = state.economy.accounts.find(a=>a.id===accountId);
    if(!acc) return;

    const bal = accountBalance(accountId);
    const movs = state.economy.movements
      .filter(mv => mv.type==="transfer"
        ? (mv.meta?.from===accountId || mv.meta?.to===accountId)
        : (mv.accountId===accountId)
      )
      .slice()
      .sort((a,b)=> (b.date||"").localeCompare(a.date||""))
      .slice(0, 50);

    openModal({
      title: `${acc.name}`,
      bodyHTML: `
        <div class="kpi" style="grid-template-columns: repeat(2, minmax(0,1fr));">
          <div class="kpi__item">
            <div class="kpi__label">Saldo actual</div>
            <div class="kpi__value">${money(bal)}</div>
          </div>
          <div class="kpi__item">
            <div class="kpi__label">Saldo inicial</div>
            <div class="kpi__value">${money(acc.initialBalance)}</div>
          </div>
        </div>

        <div class="hr"></div>

        <div class="row">
          <button class="btn good" id="accAddIncome">Ingreso</button>
          <button class="btn bad" id="accAddExpense">Gasto</button>
          <div class="spacer"></div>
          <button class="btn" id="accAddCard">Tarjeta crédito</button>
        </div>

        <div class="hr"></div>

        <div class="card" style="box-shadow:none;">
          <div class="card__head">
            <div>
              <div class="card__title">Movimientos</div>
              <div class="card__subtitle">Últimos 50</div>
            </div>
          </div>
          <div class="card__body">
            ${movs.length ? `
              <div class="list">
                ${movs.map(mv => {
                  let meta = mv.type==="transfer"
                    ? `Transferencia · ${escapeHTML(accountName(mv.meta?.from))} → ${escapeHTML(accountName(mv.meta?.to))}`
                    : `${labelMovement(mv)} · ${mv.status==="pending"?"Pendiente":"Confirmado"}`;
                  const badgeClass = mv.type==="income" ? "good" : (mv.type==="expense" ? "bad" : "");
                  return `
                    <div class="item">
                      <div class="item__main">
                        <div class="item__title">${escapeHTML(mv.name)}</div>
                        <div class="item__meta">${mv.date} · ${meta}</div>
                      </div>
                      <div class="item__right">
                        <span class="badge ${badgeClass}">${money(mv.amount)}</span>
                        <button class="btn" data-delmv="${escapeAttr(mv.id)}">Borrar</button>
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            ` : `<div class="small">Sin movimientos todavía.</div>`}
          </div>
        </div>

        <div class="hr"></div>

        <div class="card" style="box-shadow:none;">
          <div class="card__head">
            <div>
              <div class="card__title">Tarjetas de crédito</div>
              <div class="card__subtitle">Dentro de la cuenta (como pediste)</div>
            </div>
          </div>
          <div class="card__body">
            ${renderCards(accountId)}
          </div>
        </div>
      `,
      footHTML: `<button class="btn" id="accClose">Cerrar</button>`
    });

    $("#accClose").addEventListener("click", closeModal);

    $("#accAddIncome").addEventListener("click", () => { closeModal(); openMovementModal("income"); });
    $("#accAddExpense").addEventListener("click", () => { closeModal(); openMovementModal("expense"); });

    $("#accAddCard").addEventListener("click", () => {
      openCardModal(accountId);
    });

    $$("[data-delmv]").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.dataset.delmv;
        state.economy.movements = state.economy.movements.filter(m => m.id !== id);
        saveState();
        toast("Movimiento borrado");
        closeModal();
        openAccountDetail(accountId, cursor);
      });
    });

    $$("[data-editcard]").forEach(b => b.addEventListener("click", () => openCardModal(accountId, b.dataset.editcard)));
  }

  function renderCards(accountId){
    const acc = state.economy.accounts.find(a=>a.id===accountId);
    const cards = acc?.cards || [];
    if(!cards.length) return `<div class="small">Sin tarjetas. Pulsa “Tarjeta crédito” para añadir.</div>`;

    return `
      <div class="list">
        ${cards.map(c => {
          const available = safeNum(c.limit,0) - safeNum(c.used,0);
          return `
            <div class="item">
              <div class="item__main">
                <div class="item__title">${escapeHTML(c.name)}</div>
                <div class="item__meta">
                  Límite: ${money(c.limit)} · Consumido: ${money(c.used)} · Disponible: ${money(available)} ·
                  Cuota: ${money(c.monthlyFee)} (día ${c.dayOfMonth})
                </div>
              </div>
              <div class="item__right">
                <button class="btn" data-editcard="${escapeAttr(c.id)}">Editar</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function openCardModal(accountId, cardId){
    const acc = state.economy.accounts.find(a=>a.id===accountId);
    if(!acc) return;
    acc.cards = acc.cards || [];

    const editing = !!cardId;
    const card = editing ? acc.cards.find(c=>c.id===cardId) : null;

    openModal({
      title: editing ? "Editar tarjeta" : "Nueva tarjeta",
      bodyHTML: `
        <div class="form">
          <div class="field">
            <div class="label">Nombre</div>
            <input class="input" id="cName" value="${escapeAttr(card?.name||"")}" placeholder="Ej: Visa BBVA" />
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Límite (€)</div>
              <input class="input" id="cLimit" type="number" step="0.01" value="${escapeAttr(card?.limit ?? 0)}" />
            </div>
            <div class="field">
              <div class="label">Consumido (€)</div>
              <input class="input" id="cUsed" type="number" step="0.01" value="${escapeAttr(card?.used ?? 0)}" />
            </div>
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Cuota mensual (€)</div>
              <input class="input" id="cFee" type="number" step="0.01" value="${escapeAttr(card?.monthlyFee ?? 0)}" />
            </div>
            <div class="field">
              <div class="label">Día de cobro</div>
              <input class="input" id="cDay" type="number" min="1" max="31" value="${escapeAttr(card?.dayOfMonth ?? 1)}" />
            </div>
          </div>

          <div class="small">Esto se incluye en “pendientes del mes” si quieres (por ahora lo dejamos informativo).</div>
        </div>
      `,
      footHTML: `
        <button class="btn" id="cCancel">Cancelar</button>
        ${editing ? `<button class="btn bad" id="cDelete">Eliminar</button>` : ""}
        <button class="btn primary" id="cSave">Guardar</button>
      `
    });

    $("#cCancel").addEventListener("click", closeModal);

    if(editing){
      $("#cDelete").addEventListener("click", () => {
        acc.cards = acc.cards.filter(c=>c.id!==cardId);
        saveState();
        toast("Tarjeta eliminada");
        closeModal();
        openAccountDetail(accountId, state.economy.monthCursor);
      });
    }

    $("#cSave").addEventListener("click", () => {
      const name = ($("#cName").value||"").trim();
      if(!name){ toast("Nombre requerido"); return; }

      const limit = safeNum($("#cLimit").value, 0);
      const used = safeNum($("#cUsed").value, 0);
      const monthlyFee = safeNum($("#cFee").value, 0);
      const dayOfMonth = clamp(safeNum($("#cDay").value, 1), 1, 31);

      if(editing){
        card.name = name; card.limit = limit; card.used = used; card.monthlyFee = monthlyFee; card.dayOfMonth = dayOfMonth;
      }else{
        acc.cards.push({ id: uid(), name, limit, used, monthlyFee, dayOfMonth });
      }

      saveState();
      toast("Tarjeta guardada");
      closeModal();
      openAccountDetail(accountId, state.economy.monthCursor);
    });
  }

  function openFixedModal(id){
    const eco = state.economy;
    const editing = !!id;
    const fx = editing ? eco.fixedExpenses.find(x=>x.id===id) : null;

    if(!eco.accounts.length){
      toast("Crea una cuenta primero");
      return openAccountModal();
    }

    openModal({
      title: editing ? "Editar gasto fijo" : "Nuevo gasto fijo",
      bodyHTML: `
        <div class="form">
          <div class="field">
            <div class="label">Título</div>
            <input class="input" id="fxTitle" value="${escapeAttr(fx?.title||"")}" placeholder="Ej: Netflix / Seguro / Gym" />
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Importe (€)</div>
              <input class="input" id="fxAmt" type="number" step="0.01" value="${escapeAttr(fx?.amount ?? 0)}" />
            </div>
            <div class="field">
              <div class="label">Día de cobro</div>
              <input class="input" id="fxDay" type="number" min="1" max="31" value="${escapeAttr(fx?.dayOfMonth ?? 1)}" />
            </div>
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Cuenta asociada</div>
              <select class="select" id="fxAcc">
                ${eco.accounts.map(a=>`<option value="${escapeAttr(a.id)}" ${(fx?.accountId===a.id)?"selected":""}>${escapeHTML(a.name)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <div class="label">Estado</div>
              <select class="select" id="fxActive">
                <option value="true" ${fx?.active!==false?"selected":""}>Activo</option>
                <option value="false" ${fx?.active===false?"selected":""}>Pausado</option>
              </select>
            </div>
          </div>
        </div>
      `,
      footHTML: `
        <button class="btn" id="fxCancel">Cancelar</button>
        ${editing ? `<button class="btn bad" id="fxDelete">Eliminar</button>` : ""}
        <button class="btn primary" id="fxSave">Guardar</button>
      `
    });

    $("#fxCancel").addEventListener("click", closeModal);

    if(editing){
      $("#fxDelete").addEventListener("click", () => {
        eco.fixedExpenses = eco.fixedExpenses.filter(x=>x.id!==id);
        saveState();
        toast("Gasto fijo eliminado");
        closeModal();
        render();
      });
    }

    $("#fxSave").addEventListener("click", () => {
      const title = ($("#fxTitle").value||"").trim();
      const amount = safeNum($("#fxAmt").value, NaN);
      const dayOfMonth = clamp(safeNum($("#fxDay").value, 1), 1, 31);
      const accountId = $("#fxAcc").value;
      const active = $("#fxActive").value === "true";

      if(!title){ toast("Título requerido"); return; }
      if(!Number.isFinite(amount) || amount < 0){ toast("Importe inválido"); return; }

      if(editing){
        fx.title = title; fx.amount = amount; fx.dayOfMonth = dayOfMonth; fx.accountId = accountId; fx.active = active;
      }else{
        eco.fixedExpenses.push({ id: uid(), title, amount, dayOfMonth, accountId, active });
      }

      saveState();
      toast("Guardado");
      closeModal();
      render();
    });
  }

  function openCreditModal(id){
    const eco = state.economy;
    const editing = !!id;
    const cr = editing ? eco.credits.find(x=>x.id===id) : null;

    if(!eco.accounts.length){
      toast("Crea una cuenta primero");
      return openAccountModal();
    }

    openModal({
      title: editing ? "Editar crédito" : "Nuevo crédito",
      bodyHTML: `
        <div class="form">
          <div class="field">
            <div class="label">Título</div>
            <input class="input" id="crTitle" value="${escapeAttr(cr?.title||"")}" placeholder="Ej: Préstamo coche" />
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Cuota mensual (€)</div>
              <input class="input" id="crFee" type="number" step="0.01" value="${escapeAttr(cr?.monthlyFee ?? 0)}" />
            </div>
            <div class="field">
              <div class="label">Día de cobro</div>
              <input class="input" id="crDay" type="number" min="1" max="31" value="${escapeAttr(cr?.dayOfMonth ?? 1)}" />
            </div>
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Cuenta asociada</div>
              <select class="select" id="crAcc">
                ${eco.accounts.map(a=>`<option value="${escapeAttr(a.id)}" ${(cr?.accountId===a.id)?"selected":""}>${escapeHTML(a.name)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <div class="label">Estado</div>
              <select class="select" id="crActive">
                <option value="true" ${cr?.active!==false?"selected":""}>Activo</option>
                <option value="false" ${cr?.active===false?"selected":""}>Pausado</option>
              </select>
            </div>
          </div>
        </div>
      `,
      footHTML: `
        <button class="btn" id="crCancel">Cancelar</button>
        ${editing ? `<button class="btn bad" id="crDelete">Eliminar</button>` : ""}
        <button class="btn primary" id="crSave">Guardar</button>
      `
    });

    $("#crCancel").addEventListener("click", closeModal);

    if(editing){
      $("#crDelete").addEventListener("click", () => {
        eco.credits = eco.credits.filter(x=>x.id!==id);
        saveState();
        toast("Crédito eliminado");
        closeModal();
        render();
      });
    }

    $("#crSave").addEventListener("click", () => {
      const title = ($("#crTitle").value||"").trim();
      const monthlyFee = safeNum($("#crFee").value, NaN);
      const dayOfMonth = clamp(safeNum($("#crDay").value, 1), 1, 31);
      const accountId = $("#crAcc").value;
      const active = $("#crActive").value === "true";

      if(!title){ toast("Título requerido"); return; }
      if(!Number.isFinite(monthlyFee) || monthlyFee < 0){ toast("Cuota inválida"); return; }

      if(editing){
        cr.title = title; cr.monthlyFee = monthlyFee; cr.dayOfMonth = dayOfMonth; cr.accountId = accountId; cr.active = active;
      }else{
        eco.credits.push({ id: uid(), title, monthlyFee, dayOfMonth, accountId, active });
      }

      saveState();
      toast("Guardado");
      closeModal();
      render();
    });
  }

  function goalProgress(g){
    const hist = g.history || [];
    let saved = 0;
    for(const h of hist){
      if(h.type === "add") saved += safeNum(h.amount,0);
      if(h.type === "spend") saved -= safeNum(h.amount,0);
    }
    saved = Math.max(0, saved);
    const target = safeNum(g.targetAmount,0);
    const remaining = Math.max(0, target - saved);
    const pct = target > 0 ? (saved/target*100) : 0;
    return { saved, remaining, pct };
  }

  function openGoalModal(id){
    const eco = state.economy;
    const editing = !!id;
    const g = editing ? eco.goals.find(x=>x.id===id) : null;

    if(!eco.accounts.length){
      toast("Crea una cuenta primero");
      return openAccountModal();
    }

    openModal({
      title: editing ? "Editar meta" : "Nueva meta",
      bodyHTML: `
        <div class="form">
          <div class="field">
            <div class="label">Título</div>
            <input class="input" id="gTitle" value="${escapeAttr(g?.title||"")}" placeholder="Ej: Ahorrar 10k" />
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Objetivo (€)</div>
              <input class="input" id="gTarget" type="number" step="0.01" value="${escapeAttr(g?.targetAmount ?? 0)}" />
            </div>
            <div class="field">
              <div class="label">Fecha objetivo (opcional)</div>
              <input class="input" id="gDate" type="date" value="${escapeAttr(g?.targetDate || "")}" />
            </div>
          </div>

          <div class="field">
            <div class="label">Cuenta origen (de donde sale el dinero)</div>
            <select class="select" id="gAcc">
              ${eco.accounts.map(a=>`<option value="${escapeAttr(a.id)}" ${(g?.accountId===a.id)?"selected":""}>${escapeHTML(a.name)}</option>`).join("")}
            </select>
          </div>

          <div class="small">
            Los aportes/gastos de la meta quedan registrados en su historial, y además pueden reflejarse como movimiento en la cuenta (lo hacemos al registrar el aporte).
          </div>
        </div>
      `,
      footHTML: `
        <button class="btn" id="gCancel">Cancelar</button>
        ${editing ? `<button class="btn bad" id="gDelete">Eliminar</button>` : ""}
        <button class="btn primary" id="gSave">Guardar</button>
      `
    });

    $("#gCancel").addEventListener("click", closeModal);

    if(editing){
      $("#gDelete").addEventListener("click", () => {
        eco.goals = eco.goals.filter(x=>x.id!==id);
        saveState();
        toast("Meta eliminada");
        closeModal();
        render();
      });
    }

    $("#gSave").addEventListener("click", () => {
      const title = ($("#gTitle").value||"").trim();
      const targetAmount = safeNum($("#gTarget").value, NaN);
      const targetDate = $("#gDate").value || "";
      const accountId = $("#gAcc").value;

      if(!title){ toast("Título requerido"); return; }
      if(!Number.isFinite(targetAmount) || targetAmount <= 0){ toast("Objetivo inválido"); return; }

      if(editing){
        g.title = title; g.targetAmount = targetAmount; g.targetDate = targetDate; g.accountId = accountId;
      }else{
        eco.goals.push({ id: uid(), title, targetAmount, targetDate, accountId, history: [] });
      }

      saveState();
      toast("Meta guardada");
      closeModal();
      render();
    });
  }

  function openGoalDetail(goalId){
    const g = state.economy.goals.find(x=>x.id===goalId);
    if(!g) return;

    const prog = goalProgress(g);
    const hist = (g.history || []).slice().sort((a,b)=> (b.date||"").localeCompare(a.date||""));

    openModal({
      title: `Meta: ${g.title}`,
      bodyHTML: `
        <div class="kpi" style="grid-template-columns: repeat(2, minmax(0,1fr));">
          <div class="kpi__item">
            <div class="kpi__label">Ahorrado</div>
            <div class="kpi__value">${money(prog.saved)}</div>
            <div class="kpi__hint">${prog.pct.toFixed(1)}% completado</div>
          </div>
          <div class="kpi__item">
            <div class="kpi__label">Falta</div>
            <div class="kpi__value">${money(prog.remaining)}</div>
            <div class="kpi__hint">Objetivo: ${money(g.targetAmount)}</div>
          </div>
        </div>

        <div class="hr"></div>

        <div class="row">
          <button class="btn good" id="gAdd">Aportar</button>
          <button class="btn bad" id="gSpend">Gastar</button>
          <div class="spacer"></div>
          <button class="btn" id="gClose">Cerrar</button>
        </div>

        <div class="hr"></div>

        <div class="card" style="box-shadow:none;">
          <div class="card__head">
            <div>
              <div class="card__title">Historial</div>
              <div class="card__subtitle">Solo de la meta</div>
            </div>
          </div>
          <div class="card__body">
            ${hist.length ? `
              <div class="list">
                ${hist.map(h => `
                  <div class="item">
                    <div class="item__main">
                      <div class="item__title">${h.type==="add"?"Aporte":"Gasto"} · ${escapeHTML(h.note||"")}</div>
                      <div class="item__meta">${h.date}</div>
                    </div>
                    <div class="item__right">
                      <span class="badge ${h.type==="add"?"good":"bad"}">${money(h.amount)}</span>
                      <button class="btn" data-delhist="${escapeAttr(h.id)}">Borrar</button>
                    </div>
                  </div>
                `).join("")}
              </div>
            ` : `<div class="small">Aún no hay movimientos en esta meta.</div>`}
          </div>
        </div>
      `,
      footHTML: ``
    });

    $("#gClose").addEventListener("click", closeModal);

    $("#gAdd").addEventListener("click", () => openGoalTxn(goalId, "add"));
    $("#gSpend").addEventListener("click", () => openGoalTxn(goalId, "spend"));

    $$("[data-delhist]").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.dataset.delhist;
        g.history = (g.history||[]).filter(x=>x.id!==id);
        saveState();
        toast("Borrado");
        closeModal();
        openGoalDetail(goalId);
      });
    });
  }

  function openGoalTxn(goalId, type){
    const g = state.economy.goals.find(x=>x.id===goalId);
    if(!g) return;

    openModal({
      title: type==="add" ? "Aportar a la meta" : "Gasto desde la meta",
      bodyHTML: `
        <div class="form">
          <div class="two">
            <div class="field">
              <div class="label">Fecha</div>
              <input class="input" id="gtDate" type="date" value="${todayISO()}" />
            </div>
            <div class="field">
              <div class="label">Importe (€)</div>
              <input class="input" id="gtAmt" type="number" step="0.01" placeholder="0.00" />
            </div>
          </div>
          <div class="field">
            <div class="label">Nota</div>
            <input class="input" id="gtNote" placeholder="Ej: Aporte mensual / Compré X..." />
          </div>

          <div class="small">
            Esto queda en el historial de la meta. Además, lo registramos como movimiento en la cuenta origen:
            ${escapeHTML(accountName(g.accountId))} (para que cuadre el resumen total).
          </div>
        </div>
      `,
      footHTML: `
        <button class="btn" id="gtCancel">Cancelar</button>
        <button class="btn primary" id="gtSave">Guardar</button>
      `
    });

    $("#gtCancel").addEventListener("click", closeModal);

    $("#gtSave").addEventListener("click", () => {
      const date = $("#gtDate").value || todayISO();
      const amount = safeNum($("#gtAmt").value, NaN);
      const note = ($("#gtNote").value||"").trim();

      if(!Number.isFinite(amount) || amount <= 0){ toast("Importe inválido"); return; }

      g.history = g.history || [];
      g.history.push({ id: uid(), date, type, amount, note });

      if(type === "add"){
        state.economy.movements.push({
          id: uid(),
          date,
          accountId: g.accountId,
          type: "expense",
          name: `Meta: ${g.title} (aporte)`,
          amount,
          status: "cleared",
          meta: { goalId }
        });
      }else{
        state.economy.movements.push({
          id: uid(),
          date,
          accountId: g.accountId,
          type: "income",
          name: `Meta: ${g.title} (gasto desde meta)`,
          amount,
          status: "cleared",
          meta: { goalId }
        });
      }

      saveState();
      toast("Guardado");
      closeModal();
      openGoalDetail(goalId);
    });
  }

  // ============================================================
  // AGENDA
  // ============================================================
  function renderAgenda(params){
    setSubtitle("Agenda");

    const now = new Date();
    const cursor = params.cursor || monthCursor(now);
    const [cy, cm] = cursor.split("-").map(Number);
    const viewDate = new Date(cy, cm-1, 1);

    const selected = params.selected || todayISO();

    main.innerHTML = `
      <div class="grid cols-1">
        <div class="card">
          <div class="card__head">
            <div>
              <div class="card__title">Agenda</div>
              <div class="card__subtitle">Mes navegable + eventos por día.</div>
            </div>
            <div class="row">
              ${renderMonthPicker(cursor, "ag")}
            </div>
          </div>

          <div class="card__body">
            <div class="row" style="justify-content:space-between;">
              <div class="row">
                <button class="btn primary" id="addEvent">Añadir evento</button>
              </div>
              <div class="row">
                <button class="btn" id="agToday">Hoy</button>
              </div>
            </div>

            <div class="hr"></div>

            ${renderAgendaCalendar(viewDate, selected)}

            <div class="hr"></div>

            <div class="card" style="box-shadow:none;">
              <div class="card__head">
                <div>
                  <div class="card__title">Eventos · ${selected}</div>
                  <div class="card__subtitle">Pulsa para ver/editar</div>
                </div>
              </div>
              <div class="card__body" id="dayEvents">
                ${renderDayEvents(selected)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    wireMonthPicker("ag", cursor, (newCursor) => go("agenda", { cursor:newCursor, selected }));
    $("#agToday").addEventListener("click", () => go("agenda", { cursor: monthCursor(new Date()), selected: todayISO() }));

    $("#addEvent").addEventListener("click", () => openEventModal(null, selected));

    $$(".day[data-date]").forEach(el => {
      el.addEventListener("click", () => {
        go("agenda", { cursor, selected: el.dataset.date });
      });
    });

    $$("[data-openevent]").forEach(b => {
      b.addEventListener("click", () => openEventModal(b.dataset.openevent, selected));
    });
    $$("[data-delevent]").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.dataset.delevent;
        state.agenda.events = state.agenda.events.filter(e=>e.id!==id);
        saveState();
        toast("Evento borrado");
        render();
      });
    });
  }

  function renderAgendaCalendar(firstOfMonth, selectedISO){
    const year = firstOfMonth.getFullYear();
    const m0 = firstOfMonth.getMonth();
    const days = daysInMonth(year, m0);
    const firstWd = startWeekdayMon0(firstOfMonth);
    const prevMonth = new Date(year, m0-1, 1);
    const prevDays = daysInMonth(prevMonth.getFullYear(), prevMonth.getMonth());

    const totalCells = 42;
    const cells = [];

    const eventsByDay = groupAgendaEvents();

    for(let i=0; i<totalCells; i++){
      const dayNum = i - firstWd + 1;
      let dateObj, inMonth = true;

      if(dayNum <= 0){
        const dn = prevDays + dayNum;
        dateObj = new Date(year, m0-1, dn);
        inMonth = false;
      }else if(dayNum > days){
        const dn = dayNum - days;
        dateObj = new Date(year, m0+1, dn);
        inMonth = false;
      }else{
        dateObj = new Date(year, m0, dayNum);
      }

      const iso = `${dateObj.getFullYear()}-${pad2(dateObj.getMonth()+1)}-${pad2(dateObj.getDate())}`;
      const count = (eventsByDay[iso] || []).length;
      const isSelected = iso === selectedISO;

      cells.push(`
        <div class="day ${inMonth?"":"muted"}" data-date="${iso}" style="${isSelected ? "outline:2px solid rgba(162,18,196,0.65); outline-offset:-2px;" : ""}">
          <div class="day__num">${dateObj.getDate()}</div>
          ${count ? `<div class="pill" style="margin-top:8px"><span class="dot" style="background: var(--brand2)"></span><span>${count} evento${count>1?"s":""}</span></div>` : ""}
        </div>
      `);
    }

    return `
      <div class="calendar">
        <div class="cal__head">
          ${WEEKDAYS.map(d=>`<div>${d}</div>`).join("")}
        </div>
        <div class="cal__grid">
          ${cells.join("")}
        </div>
      </div>
    `;
  }

  function groupAgendaEvents(){
    const map = {};
    for(const e of state.agenda.events){
      map[e.date] = map[e.date] || [];
      map[e.date].push(e);
    }
    for(const k of Object.keys(map)){
      map[k].sort((a,b)=> (a.time||"").localeCompare(b.time||""));
    }
    return map;
  }

  function renderDayEvents(iso){
    const list = state.agenda.events
      .filter(e=>e.date===iso)
      .slice()
      .sort((a,b)=> (a.time||"").localeCompare(b.time||""));

    if(!list.length) return `<div class="small">No hay eventos este día.</div>`;

    return `
      <div class="list">
        ${list.map(e => `
          <div class="item">
            <div class="item__main">
              <div class="item__title">${escapeHTML(e.title)}</div>
              <div class="item__meta">${escapeHTML(e.time||"")}${e.location ? " · "+escapeHTML(e.location) : ""}</div>
            </div>
            <div class="item__right">
              <button class="btn" data-openevent="${escapeAttr(e.id)}">Editar</button>
              <button class="btn bad" data-delevent="${escapeAttr(e.id)}">Borrar</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function openAgendaQuickAdd(){
    openEventModal(null, todayISO());
  }

  function openEventModal(eventId, defaultDate){
    const editing = !!eventId;
    const ev = editing ? state.agenda.events.find(e=>e.id===eventId) : null;

    openModal({
      title: editing ? "Editar evento" : "Nuevo evento",
      bodyHTML: `
        <div class="form">
          <div class="field">
            <div class="label">Título</div>
            <input class="input" id="eTitle" value="${escapeAttr(ev?.title||"")}" placeholder="Ej: Médico / Quedada / ITV..." />
          </div>

          <div class="two">
            <div class="field">
              <div class="label">Fecha</div>
              <input class="input" id="eDate" type="date" value="${escapeAttr(ev?.date || defaultDate || todayISO())}" />
            </div>
            <div class="field">
              <div class="label">Hora (opcional)</div>
              <input class="input" id="eTime" type="time" value="${escapeAttr(ev?.time || "")}" />
            </div>
          </div>

          <div class="field">
            <div class="label">Lugar (opcional)</div>
            <input class="input" id="eLoc" value="${escapeAttr(ev?.location||"")}" placeholder="Ej: Vigo centro" />
          </div>

          <div class="field">
            <div class="label">Notas (opcional)</div>
            <input class="input" id="eNotes" value="${escapeAttr(ev?.notes||"")}" placeholder="Ej: llevar documentación..." />
          </div>
        </div>
      `,
      footHTML: `
        <button class="btn" id="eCancel">Cancelar</button>
        ${editing ? `<button class="btn bad" id="eDelete">Eliminar</button>` : ""}
        <button class="btn primary" id="eSave">Guardar</button>
      `
    });

    $("#eCancel").addEventListener("click", closeModal);

    if(editing){
      $("#eDelete").addEventListener("click", () => {
        state.agenda.events = state.agenda.events.filter(e=>e.id!==eventId);
        saveState();
        toast("Evento eliminado");
        closeModal();
        render();
      });
    }

    $("#eSave").addEventListener("click", () => {
      const title = ($("#eTitle").value||"").trim();
      const date = $("#eDate").value || todayISO();
      const time = $("#eTime").value || "";
      const location = ($("#eLoc").value||"").trim();
      const notes = ($("#eNotes").value||"").trim();

      if(!title){ toast("Título requerido"); return; }

      if(editing){
        ev.title = title; ev.date = date; ev.time = time; ev.location = location; ev.notes = notes;
      }else{
        state.agenda.events.push({ id: uid(), title, date, time, location, notes });
      }

      saveState();
      toast("Guardado");
      closeModal();
      render();
    });
  }

  // ============================================================
  // Escape helpers
  // ============================================================
  function escapeHTML(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  function escapeAttr(s){ return escapeHTML(s); }

  // =========================
  // Init
  // =========================
  if(!["home","work","economy","agenda"].includes(state.ui.lastView)){
    state.ui.lastView = "home";
    state.ui.lastParams = {};
  }

  state.economy.monthCursor = state.economy.monthCursor || monthCursor(new Date());

  saveState();
  render();

})();