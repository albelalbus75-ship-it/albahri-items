const Users = (() => {
  async function list(){
    const arr = await DB.all('users');
    return arr.sort((a,b)=>(a.name||'').localeCompare(b.name||'','ar'));
  }

  async function create({name, username, password, role}){
    if(!Perm.can('manageUsers')) throw new Error('لا تملك صلاحية');
    name = U.cleanSpaces(name); username = U.cleanSpaces(username).toLowerCase();
    if(!name || !username) throw new Error('الاسم واسم المستخدم مطلوبان');
    if(!password || password.length < 6) throw new Error('كلمة المرور قصيرة');
    const all = await DB.all('users');
    if(all.some(u => (u.username||'').toLowerCase() === username)) throw new Error('اسم المستخدم مستخدم');
    const salt = Auth.randomSalt();
    const passHash = await Auth.hash(password, salt);
    const user = {
      id: U.uid(), name, username, salt, passHash,
      role: role || 'employee', active: true,
      createdAt: Date.now(), updatedAt: Date.now(),
      createdBy: Auth.getSession()?.name
    };
    await DB.put('users', user);
    Audit.log('user_created','users', user.id, {name, role});
    return user;
  }

  async function update(id, patch){
    if(!Perm.can('manageUsers')) throw new Error('لا تملك صلاحية');
    const user = await DB.get('users', id);
    if(!user) throw new Error('غير موجود');
    if(patch.password){
      const salt = Auth.randomSalt();
      user.salt = salt;
      user.passHash = await Auth.hash(patch.password, salt);
      delete patch.password;
    }
    Object.assign(user, patch, {updatedAt: Date.now()});
    await DB.put('users', user);
    Audit.log('user_updated','users', id, patch);
    return user;
  }

  async function toggleActive(id){
    if(!Perm.can('manageUsers')) throw new Error('لا تملك صلاحية');
    const u = await DB.get('users', id);
    if(!u) throw new Error('غير موجود');
    u.active = !u.active; u.updatedAt = Date.now();
    await DB.put('users', u);
    Audit.log(u.active ? 'user_enabled':'user_disabled','users',id,null);
  }

  async function remove(id){
    if(!Perm.can('manageUsers')) throw new Error('لا تملك صلاحية');
    const session = Auth.getSession();
    if(session && session.id === id) throw new Error('لا يمكنك حذف حسابك الحالي');
    await DB.del('users', id);
    Audit.log('user_deleted','users',id,null);
  }

  return { list, create, update, toggleActive, remove };
})();