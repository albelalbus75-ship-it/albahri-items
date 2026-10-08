const CSV = (() => {
  const HEADERS = ['الباركود','رقم الصنف','اسم الصنف','الموديل','التكلفة','سعر البيع','سعر الجملة','الوحدة','الفرع'];
  const FIELD_ALIASES = {
    'باركود':'barcode','الباركود':'barcode','barcode':'barcode',
    'رقم':'no','رقم الصنف':'no','no':'no','code':'no',
    'اسم':'name','اسم الصنف':'name','name':'name','item':'name',
    'موديل':'model','الموديل':'model','model':'model',
    'تكلفة':'cost','التكلفة':'cost','cost':'cost','سعر التكلفة':'cost',
    'بيع':'retail','سعر البيع':'retail','retail':'retail','price':'retail',
    'جملة':'whole','سعر الجملة':'whole','whole':'whole','wholesale':'whole',
    'وحدة':'unit','الوحدة':'unit','unit':'unit',
    'فرع':'branch','الفرع':'branch','branch':'branch'
  };

  function detectSeparator(sample){
    const commas = (sample.match(/,/g)||[]).length;
    const semis = (sample.match(/;/g)||[]).length;
    return semis > commas ? ';' : ',';
  }

  function parse(text){
    // إزالة BOM
    if(text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const sample = text.slice(0, 2000);
    const sep = detectSeparator(sample);
    const rows = [];
    let cur = '', row = [], inQ = false;
    for(let i=0;i<text.length;i++){
      const c = text[i];
      if(inQ){
        if(c === '"' && text[i+1] === '"'){ cur += '"'; i++; }
        else if(c === '"') inQ = false;
        else cur += c;
      } else {
        if(c === '"') inQ = true;
        else if(c === sep){ row.push(cur); cur=''; }
        else if(c === '\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
        else if(c === '\r'){ /* skip */ }
        else cur += c;
      }
    }
    if(cur !== '' || row.length){ row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim() !== ''));
  }

  function mapHeader(headerRow){
    const map = {};
    headerRow.forEach((h, idx) => {
      const key = U.normalizeArabic(h).replace(/\s+/g,'');
      for(const alias in FIELD_ALIASES){
        if(U.normalizeArabic(alias).replace(/\s+/g,'') === key){
          map[FIELD_ALIASES[alias]] = idx; return;
        }
      }
    });
    return map;
  }

  function toRecords(rows){
    if(!rows.length) return [];
    const headerMap = mapHeader(rows[0]);
    const hasHeader = Object.keys(headerMap).length >= 2;
    const data = hasHeader ? rows.slice(1) : rows;
    const fallbackOrder = ['barcode','no','name','model','cost','retail','whole','unit','branch'];
    return data.map(r => {
      const rec = {};
      if(hasHeader){
        for(const k in headerMap) rec[k] = (r[headerMap[k]] ?? '').toString().trim();
      } else {
        fallbackOrder.forEach((k,i) => rec[k] = (r[i] ?? '').toString().trim());
      }
      return rec;
    });
  }

  async function readFile(file){
    const buf = await file.arrayBuffer();
    let text;
    // جرب UTF-8 أولاً
    try{ text = new TextDecoder('utf-8', {fatal:true}).decode(buf); }
    catch(e){ text = new TextDecoder('windows-1256').decode(buf); }
    // إذا ظهرت رموز غريبة كثيرة، جرب windows-1256
    const badChars = (text.match(/\uFFFD/g)||[]).length;
    if(badChars > 5){ text = new TextDecoder('windows-1256').decode(buf); }
    return text;
  }

  async function importFile(file){
    const text = await readFile(file);
    const records = toRecords(parse(text));
    if(!records.length) throw new Error('ملف فارغ أو تنسيق غير صحيح');
    const result = await Items.bulkUpsert(records);
    return result;
  }

  function exportAll(){
    const items = Items.cache.filter(i => !i.deleted);
    const lines = [HEADERS.join(',')];
    items.forEach(it => {
      lines.push([
        csvCell(it.barcode), csvCell(it.no), csvCell(it.name), csvCell(it.model),
        it.cost ?? '', it.retail ?? '', it.whole ?? '', csvCell(it.unit), csvCell(it.branch)
      ].join(','));
    });
    const blob = new Blob(['\uFEFF'+lines.join('\r\n')], {type:'text/csv;charset=utf-8;'});
    downloadBlob(blob, `اصناف_${U.today()}.csv`);
    Audit.log('export_items','items',null,{count:items.length});
  }

  function downloadTemplate(){
    const blob = new Blob(['\uFEFF'+HEADERS.join(',')+'\r\n'], {type:'text/csv;charset=utf-8;'});
    downloadBlob(blob, 'قالب_الاستيراد.csv');
  }

  function csvCell(v){ const s=String(v??''); return s.includes(',')||s.includes('"')||s.includes('\n') ? '"'+s.replace(/"/g,'""')+'"' : s; }
  function downloadBlob(blob, name){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
  }

  return { importFile, exportAll, downloadTemplate, HEADERS };
})();