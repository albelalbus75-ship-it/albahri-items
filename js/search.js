const Search = (() => {
  let index = []; // { id, blob }
  let built = false;

  function build(items){
    index = items.map(it => ({
      id: it.id,
      blob: U.normalizeArabic([
        it.name, it.no, it.barcode, it.model, it.unit, it.branch,
        it.cost, it.retail, it.whole
      ].join(' | '))
    }));
    built = true;
  }

  function isBuilt(){ return built; }

  function filter(items, query){
    const q = U.normalizeArabic(query || '');
    if(!q) return items;
    if(!built) build(items);
    const idSet = new Set(index.filter(r => r.blob.includes(q)).map(r=>r.id));
    return items.filter(it => idSet.has(it.id));
  }

  function matchAdvanced(item, filter){
    // filter: {field, op, value} — value يمكن أن يكون نصي
    const val = item[filter.field];
    const nval = U.toNumber(val);
    const txt = U.normalizeArabic(val);
    const q = U.normalizeArabic(filter.value);
    if(filter.op === 'contains') return txt.includes(q);
    if(filter.op === 'eq') return nval === U.toNumber(q);
    if(filter.op === 'gt') return nval > U.toNumber(q);
    if(filter.op === 'gte') return nval >= U.toNumber(q);
    if(filter.op === 'lt') return nval < U.toNumber(q);
    if(filter.op === 'lte') return nval <= U.toNumber(q);
    if(filter.op === 'range') return nval >= U.toNumber(filter.min) && nval <= U.toNumber(filter.max);
    return false;
  }

  function parseNumeric(input){
    // يدعم: 100 | >100 | >=100 | <100 | <=100 | 100-500 | 100..500
    const s = U.toEnglishDigits(String(input||'')).trim();
    if(!s) return null;
    let m;
    if((m = s.match(/^>=?\s*([\d.]+)$/))) return {op: s.includes('=')?'gte':'gt', value: parseFloat(m[1])};
    if((m = s.match(/^<=?\s*([\d.]+)$/))) return {op: s.includes('=')?'lte':'lt', value: parseFloat(m[1])};
    if((m = s.match(/^([\d.]+)\s*[-.]{1,2}\s*([\d.]+)$/))) return {op:'range', min:parseFloat(m[1]), max:parseFloat(m[2])};
    if((m = s.match(/^([\d.]+)$/))) return {op:'eq', value: parseFloat(m[1])};
    return {op:'contains', value: s};
  }

  return { build, filter, matchAdvanced, parseNumeric, isBuilt };
})();