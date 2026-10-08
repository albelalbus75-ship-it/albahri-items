const Auth = (() => {
  const SESSION_KEY = 'albahri_session';
  let currentUser = null;

  // Hashing بسيط عبر Web Crypto (SHA-256 + Salt)
  // ⚠️ للإنتاج: استخدم Firebase Authentication
  async function hash(password, salt){
    const data = new TextEncoder().encode(`${salt}::${password}`);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function randomSalt(){
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function ensureDefaultAdmin(){
    const users = await DB.all('users');
    if(users.length) return;
    const salt = randomSalt();
    const passHash = await hash('admin123', salt);
    await DB.put('users', {
      id:'u_admin_default',
      name:'المدير العام',
      username:'admin',
      salt, passHash,
      role:'admin',
      active:true,
      mustChangePass:true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  async function login(username, password){
    const u = U.cleanSpaces(username).toLowerCase();
    if(!u || !password) throw new Error('أدخل اسم المستخدم وكلمة المرور');
    const users = await DB.all('users');
    const user = users.find(x => (x.username||'').toLowerCase() === u);
    if(!user) throw new Error('المستخدم غير موجود');
    if(user.active === false) throw new Error('الحساب موقوف');
    const ph = await hash(password, user.salt);
    if(ph !== user.passHash) throw new Error('كلمة المرور خاطئة');
    const session = {
      id: user.id, name: user.name, username: user.username,
      role: user.role, active: user.active, mustChangePass: !!user.mustChangePass,
      loginAt: Date.now()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    currentUser = session;
    return session;
  }

  function logout(){
    localStorage.removeItem(SESSION_KEY);
    currentUser = null;
  }

  function getSession(){
    if(currentUser) return currentUser;
    try{
      const s = localStorage.getItem(SESSION_KEY);
      if(!s) return null;
      currentUser = JSON.parse(s);
      return currentUser;
    }catch(e){ return null; }
  }

  async function changePassword(userId, oldPass, newPass){
    const user = await DB.get('users', userId);
    if(!user) throw new Error('المستخدم غير موجود');
    const oh = await hash(oldPass, user.salt);
    if(oh !== user.passHash) throw new Error('كلمة المرور الحالية خاطئة');
    if(!newPass || newPass.length < 6) throw new Error('كلمة المرور الجديدة قصيرة (6 أحرف على الأقل)');
    const salt = randomSalt();
    const passHash = await hash(newPass, salt);
    user.salt = salt; user.passHash = passHash;
    user.mustChangePass = false;
    user.updatedAt = Date.now();
    await DB.put('users', user);
    return true;
  }

  return { ensureDefaultAdmin, login, logout, getSession, changePassword, hash, randomSalt };
})();