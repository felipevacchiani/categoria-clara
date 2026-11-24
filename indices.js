// Índices oficiales para actualizar alquileres: ICL diario (BCRA, variable 40) e IPC nacional mensual (INDEC, vía datos.gob.ar).
// Se guardan en memoria y en un archivo, y se refrescan cada 6 horas. Los cálculos leen siempre de la memoria.
import { readFile, writeFile } from 'node:fs/promises';

const state = { icl: new Map(), ipc: new Map(), updated: null };
let file = null;

export function setIndices({ icl = [], ipc = [], updated = new Date().toISOString() }) {
  state.icl = new Map(icl); state.ipc = new Map(ipc); state.updated = updated;
}
export const indicesUpdated = () => state.updated;

// ICL de una fecha (o del último día disponible anterior). Devuelve [fecha, valor] o null.
export function icl(iso) {
  if (state.icl.has(iso)) return [iso, state.icl.get(iso)];
  let best = null;
  for (const [d, v] of state.icl) if (d <= iso && (!best || d > best[0])) best = [d, v];
  return best;
}
export const iclLast = () => { let b = null; for (const e of state.icl) if (!b || e[0] > b[0]) b = e; return b; };
// IPC de un mes 'AAAA-MM'.
export const ipc = ym => state.ipc.has(ym) ? state.ipc.get(ym) : null;
export const ipcLast = () => { let b = null; for (const e of state.ipc) if (!b || e[0] > b[0]) b = e; return b; };

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(url + ' ' + res.status);
  return res.json();
}

export async function refreshIndices() {
  const today = new Date().toISOString().slice(0, 10);
  const icl = [];
  // La API del BCRA devuelve hasta 1000 registros por consulta: se pide por tramos de dos años desde 2020.
  for (let y = 2020; y <= Number(today.slice(0, 4)); y += 2) {
    const data = await getJson(`https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/40?desde=${y}-01-01&hasta=${Math.min(y + 1, Number(today.slice(0, 4)))}-12-31`);
    for (const r of data.results?.[0]?.detalle || []) icl.push([r.fecha, r.valor]);
  }
  const ipcData = await getJson('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&start_date=2019-01-01&limit=1000&format=json');
  const ipc = (ipcData.data || []).map(([d, v]) => [d.slice(0, 7), v]);
  if (icl.length < 100 || ipc.length < 12) throw new Error('Índices incompletos');
  setIndices({ icl, ipc });
  if (file) await writeFile(file, JSON.stringify({ icl, ipc, updated: state.updated }));
}

export async function startIndices(path) {
  file = path;
  try { setIndices(JSON.parse(await readFile(path, 'utf8'))); } catch {}
  const run = () => refreshIndices().catch(e => console.error('No se pudieron actualizar los índices:', e.message));
  await run();
  setInterval(run, 6 * 3600 * 1000).unref();
}
