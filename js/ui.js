const UI = (() => {
  function toast(msg, type='success', ttl=3000){
    const root = document.getElementById('toastRoot');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(), 300); }, ttl);
  }

  function modal({title, bodyHTML, footHTML, onMount, onClose}){
    const root = document.getElementById('modalRoot');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${U.escapeHtml(title)}</h3>
          <button class="icon-btn" data-close>✖️</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ''}
      </div>`;
    root.appendChild(overlay);
    const close = () => { overlay.remove(); onClose && onClose(); };
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.addEventListener('click', e => { if(e.target === overlay) close(); });
    onMount && onMount(overlay, close);
    return { close, element: overlay };
  }

  function confirm(message, opts={}){
    return new Promise(resolve => {
      const m = modal({
        title: opts.title || 'تأكيد',
        bodyHTML: `<p style="margin:.5rem 0;">${U.escapeHtml(message)}</p>`,
        footHTML: `
          <button class="btn ghost" data-cancel>إلغاء</button>
          <button class="btn ${opts.danger?'danger':'primary'}" data-ok>${opts.okText||'تأكيد'}</button>`
      });
      m.element.querySelector('[data-cancel]').addEventListener('click',()=>{m.close();resolve(false);});
      m.element.querySelector('[data-ok]').addEventListener('click',()=>{m.close();resolve(true);});
    });
  }

function setCloudStatus(status){
  const el = document.getElementById('cloudStatus');
  const txt = document.getElementById('cloudText');
  if(!el || !txt) return;
  const map = {
    online: {txt:'متصل', cls:'online'},
    syncing:{txt:'مزامنة...', cls:'syncing'},
    synced: {txt:'متزامن', cls:'online'},
    offline:{txt:'محلي', cls:''},
    error:  {txt:'خطأ', cls:'error'}
  };
  const s = map[status] || map.offline;
  txt.textContent = s.txt;
  el.className = 'cloud-pill ' + s.cls;
}
  return { toast, modal, confirm, setCloudStatus };
})();