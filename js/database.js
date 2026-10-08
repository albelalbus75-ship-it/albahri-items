const DB = (() => {
  const DB_NAME = 'items_database';
  const DB_VERSION = 2;   // ← رُفع من 1 إلى 2
  const STORES = ['items','users','settings','audit_logs','stocktake','meta'];
  let _db = null;

  function open(){
    if(_db) return Promise.resolve(_db);
    return new Promise((resolve,reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        const ensure = (name, opts) => {
          if(!db.objectStoreNames.contains(name)) {
            return db.createObjectStore(name, opts);
          }
          return e.target.transaction.objectStore(name);
        };
        // items
        const sItems = ensure('items',{keyPath:'id'});
        if(!sItems.indexNames.contains('barcode')) sItems.createIndex('barcode','barcode',{unique:false});
        if(!sItems.indexNames.contains('name')) sItems.createIndex('name','name',{unique:false});
        if(!sItems.indexNames.contains('no')) sItems.createIndex('no','no',{unique:false});
        // users
        const sUsers = ensure('users',{keyPath:'id'});
        if(!sUsers.indexNames.contains('username')) sUsers.createIndex('username','username',{unique:true});
        // الباقي
        ensure('settings',{keyPath:'key'});
        ensure('audit_logs',{keyPath:'id'});
        ensure('stocktake',{keyPath:'id'});
        ensure('meta',{keyPath:'key'});
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  async function tx(store, mode='readonly'){
    const db = await open();
    return db.transaction(store, mode).objectStore(store);
  }

  function wrap(req){
    return new Promise((res,rej)=>{ req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error); });
  }

  async function put(store, value){ return wrap((await tx(store,'readwrite')).put(value)); }
  async function get(store, key){ return wrap((await tx(store)).get(key)); }
  async function del(store, key){ return wrap((await tx(store,'readwrite')).delete(key)); }
  async function all(store){
    const db = await open();
    return wrap(db.transaction(store).objectStore(store).getAll());
  }
  async function clear(store){ return wrap((await tx(store,'readwrite')).clear()); }

  async function bulkPut(store, arr){
    const db = await open();
    return new Promise((res,rej)=>{
      const t = db.transaction(store,'readwrite');
      const s = t.objectStore(store);
      arr.forEach(v => s.put(v));
      t.oncomplete = () => res(arr.length);
      t.onerror = () => rej(t.error);
    });
  }

  async function bulkDelete(store, keys){
    const db = await open();
    return new Promise((res,rej)=>{
      const t = db.transaction(store,'readwrite');
      const s = t.objectStore(store);
      keys.forEach(k => s.delete(k));
      t.oncomplete = () => res(keys.length);
      t.onerror = () => rej(t.error);
    });
  }

  async function count(store){
    const db = await open();
    return wrap(db.transaction(store).objectStore(store).count());
  }

  return { open, put, get, del, all, clear, bulkPut, bulkDelete, count };
})();