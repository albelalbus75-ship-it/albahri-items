const Audit = (() => {
  async function log(action, entity, entityId, details){
    const u = Auth.getSession();
    const entry = {
      id: U.uid(),
      userId: u?.id || 'guest',
      userName: u?.name || 'زائر',
      action, entity, entityId: entityId || null,
      timestamp: Date.now(),
      device: navigator.userAgent.slice(0,120),
      details: details || null
    };
    try{ await DB.put('audit_logs', entry); }catch(e){}
    if(Cloud.enabled) Cloud.pushAudit(entry);
  }
  async function list(limit=200){
    const all = await DB.all('audit_logs');
    return all.sort((a,b)=>b.timestamp-a.timestamp).slice(0,limit);
  }
  return {log, list};
})();