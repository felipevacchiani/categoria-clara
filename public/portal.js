// Portal "Mi facturación": todo queda en el navegador (localStorage). Nada se envía al servidor.
const root = document.querySelector('#portal');
if (root) {
  const KEY = 'cc:facturacion:v1';
  const $ = sel => root.querySelector(sel);
  const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  const fmtMoney = n => '$ ' + (Math.round(n * 100) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = iso => iso.split('-').reverse().join('/');
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Números: acepta 1.234,56 / 1234,56 / 1234.56 / 1.234.567
  const num = raw => {
    let v = String(raw ?? '').replace(/[^\d,.-]/g, '');
    if (!v) return 0;
    const lc = v.lastIndexOf(','), ld = v.lastIndexOf('.');
    if (lc >= 0 && ld >= 0) v = lc > ld ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
    else if (lc >= 0) v = v.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const isoDate = raw => {
    const s = String(raw).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return '';
  };

  let state = { actividad: 'servicios', categoria: '', facturas: [] };
  try { state = { ...state, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} render(); };

  // Período que mira ARCA en la próxima recategorización (febrero y agosto).
  const periodo = (d = new Date()) => {
    const y = d.getFullYear(), iso = d.toISOString().slice(0, 10);
    if (iso <= `${y}-02-05`) return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, vence: `${y}-02-05` };
    if (iso <= `${y}-08-05`) return { from: `${y - 1}-07-01`, to: `${y}-06-30`, vence: `${y}-08-05` };
    return { from: `${y}-01-01`, to: `${y}-12-31`, vence: `${y + 1}-02-05` };
  };
  const meses = p => { const out = []; let [y, m] = p.from.split('-').map(Number); for (let i = 0; i < 12; i++) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } } return out; };
  const signed = f => (f.tipo === 'NC' ? -1 : 1) * f.monto;
  const sumBetween = (from, to) => state.facturas.filter(f => f.fecha >= from && f.fecha <= to).reduce((t, f) => t + signed(f), 0);

  let TABLA = null;
  fetch('/tabla.json').then(r => r.json()).then(t => { TABLA = t; render(); }).catch(() => {});
  const catFor = total => TABLA?.categorias.find(c => total <= c.ingresos) ?? null;

  function render() {
    $('#cfg-actividad').value = state.actividad;
    $('#cfg-categoria').value = state.categoria;
    const p = periodo();
    const total = sumBetween(p.from, p.to);
    const hoy = new Date().toISOString().slice(0, 10);
    const hace12 = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
    const rolling = sumBetween(hace12, hoy);
    $('#k-periodo').textContent = `${fmtDate(p.from)} al ${fmtDate(p.to)}`;
    $('#k-total').textContent = fmtMoney(total);
    $('#k-vence').textContent = fmtDate(p.vence);
    $('#k-rolling').textContent = fmtMoney(rolling);
    const corresponde = TABLA ? catFor(total) : null;
    const actual = TABLA?.categorias.find(c => c.cat === state.categoria);
    const kCat = $('#k-cat'), kNote = $('#k-cat-note');
    if (!TABLA) { kCat.textContent = '…'; kNote.textContent = ''; }
    else if (!corresponde) { kCat.textContent = 'Fuera del régimen'; kNote.textContent = 'Superás el tope de la categoría K.'; }
    else {
      kCat.textContent = 'Categoría ' + corresponde.cat;
      kNote.textContent = !actual ? 'Elegí tu categoría actual para comparar.'
        : corresponde.cat === actual.cat ? 'Igual a la actual: por ingresos no cambiás.'
        : corresponde.cat > actual.cat ? `Subís desde la ${actual.cat}.` : `Podrías bajar desde la ${actual.cat}.`;
    }
    // Barra de progreso contra el tope de la categoría actual (o la que corresponde)
    const ref = actual || corresponde;
    const bar = $('#k-bar'), barTxt = $('#k-bar-txt');
    if (ref) {
      const pct = Math.min(100, total / ref.ingresos * 100);
      bar.style.width = pct.toFixed(1) + '%';
      bar.classList.toggle('over', total > ref.ingresos);
      barTxt.textContent = total > ref.ingresos
        ? `Te pasaste ${fmtMoney(total - ref.ingresos)} del tope de la categoría ${ref.cat} (${fmtMoney(ref.ingresos)}).`
        : `Te quedan ${fmtMoney(ref.ingresos - total)} para llegar al tope de la categoría ${ref.cat} (${fmtMoney(ref.ingresos)}).`;
    } else { bar.style.width = '0'; barTxt.textContent = ''; }
    if (TABLA) $('#k-tabla').textContent = `Tabla ${TABLA.id}. ARCA la actualiza en enero y julio.`;

    // Gráfico mensual
    const ms = meses(p);
    const porMes = ms.map(m => state.facturas.filter(f => f.fecha.startsWith(m)).reduce((t, f) => t + signed(f), 0));
    const max = Math.max(1, ...porMes);
    const chart = $('#chart'); chart.replaceChildren();
    ms.forEach((m, i) => {
      const col = el('div', { className: 'bar-col', title: `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}: ${fmtMoney(porMes[i])}` });
      const fill = el('div', { className: 'bar-fill' }); fill.style.height = Math.max(0, porMes[i] / max * 100) + '%';
      col.append(el('div', { className: 'bar-track' }, fill), el('span', { textContent: MESES[Number(m.slice(5)) - 1] }));
      chart.append(col);
    });

    // Tabla de comprobantes
    const list = [...state.facturas].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const body = $('#rows'); body.replaceChildren();
    $('#empty').hidden = list.length > 0;
    $('#count').textContent = `${list.length} comprobante${list.length === 1 ? '' : 's'}`;
    for (const f of list.slice(0, 500)) {
      const del = el('button', { type: 'button', className: 'link', textContent: 'Borrar' });
      del.addEventListener('click', () => { state.facturas = state.facturas.filter(x => x.id !== f.id); save(); });
      body.append(el('tr', {},
        el('td', { textContent: fmtDate(f.fecha) }),
        el('td', { textContent: f.tipo === 'NC' ? 'Nota de crédito' : 'Factura' }),
        el('td', { textContent: f.numero || '—' }),
        el('td', { textContent: f.cliente || '—' }),
        el('td', { className: 'right' + (f.tipo === 'NC' ? ' neg' : ''), textContent: (f.tipo === 'NC' ? '− ' : '') + fmtMoney(f.monto) }),
        el('td', {}, del)));
    }

    // Llevar los números al informe pago
    const decI = ms.slice(-1)[0];
    const decSum = porMes[11];
    const params = new URLSearchParams({ actividad: state.actividad, ...(state.categoria ? { categoria: state.categoria } : {}),
      ingresos: (total - decSum).toFixed(2), ...(decSum ? { diciembre: decSum.toFixed(2) } : {}) });
    $('#to-report').href = '/servicios/monotributocheck?' + params + '#form';
    $('#to-report-note').textContent = `Lleva al informe lo facturado de ${MESES[Number(ms[0].slice(5)) - 1]} a ${MESES[Number(ms[10].slice(5)) - 1]} (${fmtMoney(total - decSum)})` + (decSum ? ` y ${MESES[Number(decI.slice(5)) - 1]} (${fmtMoney(decSum)}).` : '.');
  }

  // Configuración
  $('#cfg-actividad').addEventListener('change', e => { state.actividad = e.target.value; save(); });
  $('#cfg-categoria').addEventListener('change', e => { state.categoria = e.target.value; save(); });

  // Alta manual
  const form = $('#add');
  form.fecha.value = new Date().toISOString().slice(0, 10);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const monto = num(form.monto.value);
    if (!form.fecha.value || monto <= 0) { $('#add-msg').textContent = 'Completá la fecha y un monto mayor a cero.'; return; }
    state.facturas.push({ id: crypto.randomUUID(), fecha: form.fecha.value, tipo: form.tipo.value, numero: form.numero.value.trim().slice(0, 40), cliente: form.cliente.value.trim().slice(0, 80), monto });
    $('#add-msg').textContent = 'Comprobante agregado.';
    form.monto.value = ''; form.numero.value = ''; form.cliente.value = '';
    form.monto.focus();
    save();
  });

  // Importar CSV de "Mis Comprobantes" (Emitidos)
  const splitCsv = (line, d) => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === d && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim()); };
  const norm = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  $('#csv').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    const text = (await file.text()).replace(/^﻿/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const hi = lines.findIndex(l => /fecha/i.test(l) && /total/i.test(l));
    if (hi < 0) { $('#csv-msg').textContent = 'No encontré las columnas «Fecha» e «Imp. Total». Descargá el archivo desde Mis Comprobantes → Emitidos.'; return; }
    const d = (lines[hi].match(/;/g) || []).length > (lines[hi].match(/,/g) || []).length ? ';' : ',';
    const head = splitCsv(lines[hi], d).map(norm);
    const col = (...names) => head.findIndex(h => names.some(n => h.includes(n)));
    const cFecha = col('fecha'), cTotal = col('imp. total', 'importe total', 'total'), cTipo = col('tipo de comprobante', 'tipo'),
      cPv = col('punto de venta'), cNum = col('numero desde', 'nro', 'numero'), cRec = col('denominacion', 'receptor'),
      cMon = col('moneda'), cCambio = col('tipo cambio', 'tipo de cambio');
    const keys = new Set(state.facturas.map(f => f.key).filter(Boolean));
    let added = 0, skipped = 0;
    for (const line of lines.slice(hi + 1)) {
      const r = splitCsv(line, d);
      const fecha = isoDate(r[cFecha] ?? ''); let monto = Math.abs(num(r[cTotal]));
      if (!fecha || !monto) { skipped++; continue; }
      const tipoTxt = norm(r[cTipo] ?? ''); const code = parseInt(tipoTxt, 10);
      const nc = /credito/.test(tipoTxt) || [3, 8, 13, 53, 113, 203, 208, 213].includes(code);
      const moneda = norm(r[cMon] ?? ''); const cambio = num(r[cCambio]);
      if (moneda && !/pes|ars|\$/.test(moneda) && cambio > 0) monto *= cambio;
      const numero = [r[cPv], r[cNum]].filter(Boolean).join('-');
      const key = [fecha, code || tipoTxt, numero, monto.toFixed(2)].join('|');
      if (keys.has(key)) { skipped++; continue; }
      keys.add(key);
      state.facturas.push({ id: crypto.randomUUID(), key, fecha, tipo: nc ? 'NC' : 'F', numero, cliente: (r[cRec] ?? '').slice(0, 80), monto });
      added++;
    }
    e.target.value = '';
    $('#csv-msg').textContent = `Importados ${added} comprobantes${skipped ? ` (${skipped} repetidos o sin monto, salteados)` : ''}.`;
    save();
  });

  // Respaldo
  $('#export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `mi-facturacion-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
  });
  $('#import').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.facturas)) throw 0;
      state = { actividad: data.actividad === 'bienes' ? 'bienes' : 'servicios', categoria: String(data.categoria || ''),
        facturas: data.facturas.filter(f => isoDate(f.fecha) && num(f.monto) > 0).map(f => ({ id: crypto.randomUUID(), key: f.key, fecha: isoDate(f.fecha), tipo: f.tipo === 'NC' ? 'NC' : 'F', numero: String(f.numero || '').slice(0, 40), cliente: String(f.cliente || '').slice(0, 80), monto: num(f.monto) })) };
      $('#backup-msg').textContent = `Respaldo restaurado: ${state.facturas.length} comprobantes.`;
      save();
    } catch { $('#backup-msg').textContent = 'Ese archivo no es un respaldo válido.'; }
    e.target.value = '';
  });
  $('#wipe').addEventListener('click', () => {
    const btn = $('#wipe');
    if (btn.dataset.confirm !== '1') { btn.dataset.confirm = '1'; btn.textContent = 'Tocá de nuevo para borrar todo'; setTimeout(() => { btn.dataset.confirm = ''; btn.textContent = 'Borrar todo'; }, 4000); return; }
    state.facturas = []; btn.dataset.confirm = ''; btn.textContent = 'Borrar todo'; save();
  });

  render();
}
