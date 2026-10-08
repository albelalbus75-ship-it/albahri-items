const Items = (() => {
  let cache = [];
  let loaded = false;

  async function load(force=false){
    if(loaded && !force) return cache;
    cache = await DB.all('items');
    loaded = true;
    Search.build(cache);
    return cache;
  }

  async function get(id){
    return (await load()).find(x => x.id === id) || null;
  }

  async function getByBarcode(bc){
    const b = U.normalizeBarcode(bc);
    if(!b) return null;
    return (await load()).find(x => U.normalizeBarcode(x.barcode) === b) || null;
  }

  async function save(data, id=null){
    const u = Auth.getSession();
    if(!u) throw new Error('غير مسجل دخول');
    const now = Date.now();
    if(id){
      if(!Perm.can('edit')) throw new Error('لا تملك صلاحية التعديل');
      const prev = await get(id);
      if(!prev) throw new Error('الصنف غير موجود');
      const merged = {
        ...prev, ...data,
        id,
        updatedAt: now,
        updatedBy: u.name,
        version: (prev.version || 1) + 1
      };
      await DB.put('items', merged);
      Audit.log('edit_item', 'items', id, {name: merged.name});
      if(Cloud.enabled) Cloud.pushItems([merged]);
      return merged;
    } else {
      if(!Perm.can('add')) throw new Error('لا تملك صلاحية الإضافة');
      // تحقق من الباركود المكرر
      const bc = U.normalizeBarcode(data.barcode);
      if(bc){
        const dup = await getByBarcode(bc);
        if(dup) throw new Error('الباركود مستخدم بالفعل');
      }
      const item = {
        id: U.uid(),
        barcode: bc,
        no: U.cleanSpaces(data.no),
        name: U.cleanSpaces(data.name),
        model: U.cleanSpaces(data.model),
        cost: U.toNumber(data.cost),
        retail: U.toNumber(data.retail),
        whole: U.toNumber(data.whole),
        unit: U.cleanSpaces(data.unit),
        branch: U.cleanSpaces(data.branch),
        special: '',
        package: '',
        col2: '',
        retail2: 0,
        saleBranch: '',
        createdAt: now,
        updatedAt: now,
        createdBy: u.name,
        updatedBy: u.name,
        version: 1,
        deleted: false
      };
      if(!item.name) throw new Error('اسم الصنف إجباري');
      await DB.put('items', item);
      Audit.log('add_item', 'items', item.id, {name: item.name});
      if(Cloud.enabled) Cloud.pushItems([item]);
      return item;
    }
  }

  async function remove(id){
    if(!Perm.can('delete')) throw new Error('لا تملك صلاحية الحذف');
    const prev = await get(id);
    if(!prev) return;
    // Soft delete
    const soft = {...prev, deleted:true, deletedAt:Date.now(), deletedBy:Auth.getSession()?.name, updatedAt:Date.now()};
    await DB.put('items', soft);
    Audit.log('delete_item', 'items', id, {name: prev.name});
    if(Cloud.enabled) Cloud.deleteItem(id);
  }

  async function clearAll(){
    if(!Perm.can('clearAll')) throw new Error('لا تملك صلاحية الحذف الكامل');
    await DB.clear('items');
    cache = []; loaded = false; Search.build([]);
    Audit.log('clear_all_items', 'items', null, null);
  }

  async function bulkUpsert(rows){
    const u = Auth.getSession();
    if(!u) throw new Error('غير مسجل دخول');
    if(!Perm.can('import')) throw new Error('لا تملك صلاحية الاستيراد');
    const now = Date.now();
    const existing = await load();
    const byBarcode = new Map();
    existing.forEach(it => { if(it.barcode) byBarcode.set(U.normalizeBarcode(it.barcode), it); });
    const adds = [], updates = [];
    let ignored = 0;
    const toPush = [];
    for(const r of rows){
      const name = U.cleanSpaces(r.name);
      if(!name){ ignored++; continue; }
      const bc = U.normalizeBarcode(r.barcode);
      const prev = bc ? byBarcode.get(bc) : null;
      if(prev){
        const merged = {
          ...prev,
          no: r.no || prev.no,
          name,
          model: r.model || prev.model,
          cost: r.cost !== '' && r.cost != null ? U.toNumber(r.cost) : prev.cost,
          retail: r.retail !== '' && r.retail != null ? U.toNumber(r.retail) : prev.retail,
          whole: r.whole !== '' && r.whole != null ? U.toNumber(r.whole) : prev.whole,
          unit: r.unit || prev.unit,
          branch: r.branch || prev.branch,
          updatedAt: now, updatedBy: u.name,
          version: (prev.version || 1) + 1
        };
        updates.push(merged);
        toPush.push(merged);
      } else {
        const item = {
          id: U.uid(),
          barcode: bc,
          no: U.cleanSpaces(r.no),
          name,
          model: U.cleanSpaces(r.model),
          cost: U.toNumber(r.cost),
          retail: U.toNumber(r.retail),
          whole: U.toNumber(r.whole),
          unit: U.cleanSpaces(r.unit),
          branch: U.cleanSpaces(r.branch),
          special:'', package:'', col2:'', retail2:0, saleBranch:'',
          createdAt: now, updatedAt: now,
          createdBy: u.name, updatedBy: u.name,
          version: 1, deleted: false
        };
        adds.push(item);
        toPush.push(item);
        if(bc) byBarcode.set(bc, item);
      }
    }
    if(adds.length) await DB.bulkPut('items', adds);
    if(updates.length) await DB.bulkPut('items', updates);
    loaded = false; await load(true);
    if(Cloud.enabled && toPush.length) await Cloud.pushItems(toPush);
    Audit.log('import_items','items',null,{added:adds.length, updated:updates.length, ignored});
    return {added: adds.length, updated: updates.length, ignored};
  }

  return { load, get, getByBarcode, save, remove, clearAll, bulkUpsert, get cache(){return cache;}, markDirty(){loaded=false;} };
})();