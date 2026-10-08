const Stocktake = (() => {
  const KEY = 'st_current';
  let rows = []; // {id, itemId, name, no, barcode, cost, unit, qty}
  let saved = null;

  async function loadSaved(){
    saved = await DB.get('meta', KEY) || null;
    return saved;
  }

  function addFromItem(item, qty=1){
    const existing = rows.find(r => r.itemId === item.id);
    if(existing){ existing.qty = (existing.qty||0) + qty; }
    else rows.push({ id: U.uid(), itemId:item.id, name:item.name, no:item.no, barcode:item.barcode, cost:item.cost, unit:item.unit, qty });
    render(); updateStats(); persistDebounced();
  }

  function removeRow(id){
    rows = rows.filter(r => r.id !== id);
    render(); updateStats(); persistDebounced();
  }

  function setQty(id, qty){
    const r = rows.find(x => x.id === id);
    if(r){ r.qty = U.toNumber(qty); updateStats(); persistDebounced(); }
  }

  const persistDebounced = U.debounce(persist, 400);
  async function persist(){
    await DB.put('meta', {key:KEY, rows, updatedAt:Date.now()});
  }

  function render(){
    const box = document.getElementById('stRows');
    if(!rows.length){
      box.innerHTML = `<div class="empty-state">لا توجد صفوف بعد. ابدأ بالمسح أو الإضافة.</div>`;
      return;
    }
    box.innerHTML = rows.map(r => `
      <div class="st-row" data-id="${r.id}">
        <div class="st-info">
          <strong>${U.escapeHtml(r.name)}</strong>
          <span class="muted small">رقم: ${U.escapeHtml(r.no||'-')} — باركود: ${U.escapeHtml(r.barcode||'-')}</span>
          <span class="muted small">التكلفة: ${U.formatMoney(r.cost)} — الوحدة: ${U.escapeHtml(r.unit||'-')}</span>
        </div>
        <div class="st-qty">
          <button data-dec>-</button>
          <input type="number" inputmode="decimal" value="${r.qty}" />
          <button data-inc>+</button>
        </div>
        <button class="st-del" title="حذف">✖️</button>
      </div>`).join('');
    box.querySelectorAll('.st-row').forEach(el => {
      const id = el.getAttribute('data-id');
      el.querySelector('[data-dec]').addEventListener('click', ()=>{ const r=rows.find(x=>x.id===id); r.qty=Math.max(0,(r.qty||0)-1); render(); updateStats(); persistDebounced(); });
      el.querySelector('[data-inc]').addEventListener('click', ()=>{ const r=rows.find(x=>x.id===id); r.qty=(r.qty||0)+1; render(); updateStats(); persistDebounced(); });
      el.querySelector('input').addEventListener('input', e => setQty(id, e.target.value));
      el.querySelector('.st-del').addEventListener('click', ()=>removeRow(id));
    });
  }

  function updateStats(){
    const done = rows.length;
    const total = Items.cache.length;
    const value = rows.reduce((s,r)=>s + (U.toNumber(r.cost) * U.toNumber(r.qty)), 0);
    document.getElementById('stTotal').textContent = total;
    document.getElementById('stDone').textContent = done;
    document.getElementById('stRemain').textContent = Math.max(0, total - done);
    document.getElementById('stValue').textContent = U.formatMoney(value);
  }

  async function clear(){
    rows = [];
    await DB.del('meta', KEY);
    render(); updateStats();
  }

  async function save(){
    if(!Perm.can('stocktake')) throw new Error('لا تملك صلاحية الجرد');
    await persist();
    Audit.log('stocktake_save','stocktake', null, {count: rows.length});
    UI.toast('تم حفظ الجرد');
  }

  function exportCsv(){
    const header = ['رقم الصنف','اسم الصنف','الباركود','التكلفة','الوحدة','الكمية','القيمة'];
    const lines = [header.join(',')];
    rows.forEach(r => {
      lines.push([
        csvCell(r.no), csvCell(r.name), csvCell(r.barcode),
        r.cost, csvCell(r.unit), r.qty,
        (U.toNumber(r.cost)*U.toNumber(r.qty)).toFixed(2)
      ].join(','));
    });
    const blob = new Blob(['\uFEFF'+lines.join('\r\n')], {type:'text/csv;charset=utf-8;'});
    downloadBlob(blob, `جرد_${U.today()}.csv`);
    Audit.log('stocktake_export','stocktake',null,{count:rows.length});
  }

  function csvCell(v){ const s=String(v??''); return s.includes(',')||s.includes('"') ? '"'+s.replace(/"/g,'""')+'"' : s; }
  function downloadBlob(blob, name){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
  }

  function getRows(){ return rows; }
  function setRows(r){ rows = r || []; render(); updateStats(); persist(); }

  return { loadSaved, addFromItem, removeRow, setQty, render, updateStats, clear, save, exportCsv, getRows, setRows, KEY };
})();