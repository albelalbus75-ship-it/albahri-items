const Settings = (() => {
  const KEY = 'main';
  let cache = null;

  async function load(){
    if(cache) return cache;
    let s = await DB.get('settings', KEY);
    if(!s){
      s = { key:KEY, exchangeRate: 530, updatedAt: Date.now(), updatedBy: 'system' };
      await DB.put('settings', s);
    }
    cache = s;
    return s;
  }

  async function update(patch){
    const cur = await load();
    const next = {...cur, ...patch, updatedAt: Date.now(), updatedBy: Auth.getSession()?.name || 'system'};
    await DB.put('settings', next);
    cache = next;
    if(Cloud.enabled) Cloud.pushSettings(next);
    return next;
  }

  function get(){ return cache; }
  function rate(){ return cache?.exchangeRate || 530; }

  return { load, update, get, rate };
})();