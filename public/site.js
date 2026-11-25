const search = document.querySelector('#search');
search?.addEventListener('input', () => {
  const normalize = value => value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
  const query = normalize(search.value);
  let visible = 0;
  for(const group of document.querySelectorAll('[data-group]')) {
    let count = 0;
    for(const card of group.querySelectorAll('[data-card]')) {
      card.hidden = !normalize(card.textContent).includes(query);
      if(!card.hidden) count++;
    }
    group.hidden = count === 0;
    visible += count;
  }
  document.querySelector('#results').textContent = `${visible} servicio${visible===1?'':'s'}`;
});
const serviceForm = document.querySelector('form[action^="/servicios/"]');
serviceForm?.addEventListener('input', () => {
  const slug = serviceForm.getAttribute('action').split('/').pop();
  navigator.sendBeacon('/eventos/inicio', new URLSearchParams({slug, origen: serviceForm.elements.origen?.value || 'ficha'}));
}, {once:true});

if(serviceForm && !serviceForm.querySelector('input[type=hidden]')){
  const storeKey = 'gc:' + serviceForm.getAttribute('action');
  try {
    const saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
    if(saved) for(const [name,value] of Object.entries(saved)) {
      const field = serviceForm.elements[name];
      if(field && value && !field.value) field.value = value;
    }
  } catch {}
  serviceForm.addEventListener('input', () => {
    try { sessionStorage.setItem(storeKey, JSON.stringify(Object.fromEntries(new FormData(serviceForm)))); } catch {}
  });
}
// Datos que llegan desde "Mi facturación" (?ingresos=...&categoria=...)
if(serviceForm && location.search){
  const params = new URLSearchParams(location.search);
  let any = false;
  for(const [name,value] of params){
    const field = serviceForm.elements[name];
    if(field && field.type !== 'hidden' && value.length < 40){ field.value = value; any = true; }
  }
  if(any) serviceForm.scrollIntoView({block:'start'});
}
for(const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const text = document.querySelector(button.dataset.copy)?.textContent ?? '';
    try { await navigator.clipboard.writeText(text); button.textContent = 'Copiada'; }
    catch { getSelection().selectAllChildren(document.querySelector(button.dataset.copy)); button.textContent = 'Seleccionada: copiá con Ctrl+C'; }
    setTimeout(() => { button.textContent = 'Copiar nota'; }, 2500);
  });
}
const waiting = document.querySelector('[data-autorefresh]');
if(waiting){
  let tries = 0;
  try { tries = Number(sessionStorage.getItem('gc:refresh:' + location.pathname) || 0); } catch {}
  if(tries < 24) setTimeout(() => {
    try { sessionStorage.setItem('gc:refresh:' + location.pathname, String(tries + 1)); } catch {}
    location.reload();
  }, 5000);
}

// --- Números con formato argentino: 1.250.000,50 ---
const parseAR = text => {
  const [int = '', dec] = String(text).replace(/[^\d,]/g, '').split(',');
  return Number((int || '0') + (dec ? '.' + dec.slice(0, 2) : '')) || 0;
};
const formatAR = (text, decimals) => {
  let clean = String(text).replace(/[^\d,]/g, '');
  const comma = clean.indexOf(',');
  let int = comma < 0 ? clean : clean.slice(0, comma);
  let dec = comma < 0 ? null : clean.slice(comma + 1).replace(/,/g, '').slice(0, decimals ? 2 : 0);
  int = int.replace(/^0+(?=\d)/, '');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals && dec !== null ? grouped + ',' + dec : grouped;
};
const money = n => '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
for (const input of document.querySelectorAll('input[data-num]')) {
  const decimals = input.dataset.num === 'money';
  if (input.value && /^\d+(\.\d{1,2})?$/.test(input.value)) input.value = formatAR(input.value.replace('.', ','), decimals);
  input.addEventListener('input', () => {
    const fromEnd = input.value.length - (input.selectionStart ?? input.value.length);
    input.value = formatAR(input.value, decimals);
    const pos = Math.max(0, input.value.length - fromEnd);
    try { input.setSelectionRange(pos, pos); } catch {}
  });
}

// --- Campos que dependen de otra respuesta (local, venta de productos) ---
const toggles = [...document.querySelectorAll('[data-show]')];
const refreshToggles = () => {
  for (const label of toggles) {
    const form = label.closest('form');
    const [key, value] = label.dataset.show.split(':');
    const visible = form?.elements[key]?.value === value;
    const wasHidden = label.hidden;
    label.hidden = !visible;
    for (const input of label.querySelectorAll('input,select')) {
      input.required = visible;
      if (!visible) input.value = '0';
      else if (wasHidden && input.value === '0') input.value = '';
    }
  }
};
document.addEventListener('change', e => { if (e.target.matches('select')) refreshToggles(); });
refreshToggles();

// --- Calculadora mes a mes ---
for (const box of document.querySelectorAll('[data-sum-into]')) {
  const target = box.closest('form').elements[box.dataset.sumInto];
  const wrap = box.closest('.helper-body');
  const totalEl = wrap.querySelector('[data-sum-total]');
  const sum = () => [...box.querySelectorAll('[data-month]')].reduce((t, i) => t + parseAR(i.value), 0);
  box.addEventListener('input', () => { totalEl.textContent = money(sum()); });
  wrap.querySelector('[data-sum-apply]').addEventListener('click', () => {
    const total = sum();
    target.value = formatAR(total.toFixed(2).replace('.', ',').replace(/,00$/, ''), true);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    box.closest('details').open = false;
    target.focus();
  });
}

// --- Píxel de Meta: solo con consentimiento y solo en páginas públicas ---
(() => {
  const PIXEL = '2022960318665094';
  const KEY = 'cc_px';
  const path = location.pathname;
  const privatePath = /^\/(p\/|cuenta|mi-facturacion|mis-reclamos|admin|api|arrepentimiento)/.test(path);
  const cleanQuery = [...new URLSearchParams(location.search).keys()].every(k => /^(utm_[a-z]+|fbclid|gclid)$/.test(k));
  const publicPage = !privatePath && cleanQuery && (document.querySelector('link[rel=canonical]') || path.startsWith('/servicios/'));
  const get = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch {} };
  const cookiesBtn = document.querySelector('[data-cookies]');
  if (cookiesBtn) {
    cookiesBtn.hidden = false;
    cookiesBtn.addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch {} location.reload(); });
  }
  if (!publicPage) return;
  const load = () => {
    const q = window.fbq = function () { q.callMethod ? q.callMethod.apply(q, arguments) : q.queue.push(arguments); };
    window._fbq = q; q.push = q; q.loaded = true; q.version = '2.0'; q.queue = [];
    const s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
    fbq('set', 'autoConfig', false, PIXEL);
    fbq('init', PIXEL);
    fbq('track', 'PageView');
    const service = path.match(/^\/servicios\/([a-z0-9-]+)$/)?.[1];
    if (service) fbq('track', 'ViewContent', { content_ids: [service], content_type: 'product' });
    const order = document.querySelector('form[data-price]');
    order?.addEventListener('submit', () => fbq('track', 'InitiateCheckout', { content_ids: [service], content_type: 'product', currency: 'ARS', value: Number(order.dataset.price || 0) }), { once: true });
  };
  const decision = get();
  if (decision === '1') return load();
  if (decision === '0') return;
  const bar = document.createElement('div');
  bar.className = 'consent';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Cookies');
  bar.innerHTML = '<p>Usamos el píxel de Meta para medir nuestros anuncios en Instagram y Facebook. No carga hasta que aceptes. <a href="/privacidad">Más info</a></p><div><button type="button" data-v="0" class="ghost">Rechazar</button><button type="button" data-v="1">Aceptar</button></div>';
  bar.addEventListener('click', e => {
    const v = e.target.dataset?.v; if (!v) return;
    set(v); bar.remove(); if (v === '1') load();
  });
  document.body.appendChild(bar);
})();
