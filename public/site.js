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
