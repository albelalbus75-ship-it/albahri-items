const Perm = (() => {
  const ROLES = {
    admin: ['view','add','edit','delete','import','export','manageUsers','changeRate','clearAll','stocktake','viewCost','viewWhole','share','qr','scan','sync','audit','backup'],
    employee: ['view','search','scan','stocktake','share','qr']
  };
  function can(action, user){
    const u = user || Auth.getSession();
    if(!u) return false;
    const list = ROLES[u.role] || [];
    return list.includes(action);
  }
  function applyToDOM(root=document){
    const u = Auth.getSession();
    root.querySelectorAll('[data-perm]').forEach(el=>{
      const p = el.getAttribute('data-perm');
      el.hidden = !can(p, u);
    });
    root.querySelectorAll('[data-admin]').forEach(el=>{
      el.hidden = !(u && u.role === 'admin');
    });
  }
  return {can, applyToDOM, ROLES};
})();