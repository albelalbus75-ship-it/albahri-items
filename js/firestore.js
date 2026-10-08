/* طبقة المزامنة السحابية. إذا لم يُضبط firebaseConfig يتحول التطبيق لوضع محلي كامل. */
const Cloud = (() => {
  // ⚠️ ضع إعدادات Firebase هنا لتفعيل المزامنة السحابية
  const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  };
  let db = null;
  let enabled = false;
  const listeners = [];
  const state = { status:'offline', lastSync:null };

  function onStatus(fn){ listeners.push(fn); }
  function emit(){ listeners.forEach(fn => fn({...state})); }
  function setStatus(s){ state.status = s; emit(); }

  function init(){
    if(!firebaseConfig.apiKey || !firebaseConfig.projectId){
      setStatus('offline');
      return false;
    }
    try{
      if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
      enabled = true;
      window.addEventListener('online', () => setStatus('online'));
      window.addEventListener('offline', () => setStatus('offline'));
      setStatus(navigator.onLine ? 'online' : 'offline');
      return true;
    }catch(e){ console.warn('Firebase init failed', e); setStatus('error'); return false; }
  }

  async function pushItems(items){
    if(!enabled || !db) return {ok:false, reason:'disabled'};
    setStatus('syncing');
    try{
      const batch = db.batch();
      items.forEach(it => batch.set(db.collection('items').doc(it.id), it, {merge:true}));
      await batch.commit();
      state.lastSync = Date.now();
      setStatus('synced');
      return {ok:true, count: items.length};
    }catch(e){ setStatus('error'); return {ok:false, reason:e.message}; }
  }

  async function pullItems(){
    if(!enabled || !db) return [];
    try{
      const snap = await db.collection('items').get();
      return snap.docs.map(d => ({id:d.id, ...d.data()}));
    }catch(e){ setStatus('error'); return []; }
  }

  async function deleteItem(id){
    if(!enabled || !db) return;
    try{ await db.collection('items').doc(id).delete(); }catch(e){}
  }

  async function pushSettings(settings){
    if(!enabled || !db) return;
    try{ await db.collection('settings').doc('main').set(settings, {merge:true}); }catch(e){}
  }

  async function pullSettings(){
    if(!enabled || !db) return null;
    try{
      const doc = await db.collection('settings').doc('main').get();
      return doc.exists ? doc.data() : null;
    }catch(e){ return null; }
  }

  async function pushAudit(log){
    if(!enabled || !db) return;
    try{ await db.collection('audit_logs').add(log); }catch(e){}
  }

  return { init, onStatus, pushItems, pullItems, deleteItem, pushSettings, pullSettings, pushAudit, get enabled(){return enabled;}, get state(){return {...state};} };
})();