const App = (() => {
  let currentPage = 'items';
  let pageSize = 60;
  let shown = 60;
  let activeFilters = {}; // {field: {op,value,min,max}}

  // ==== التهيئة ====
  async function init(){
    // الوضع الداكن
    const theme = localStorage.getItem('albahri_theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeBtn(theme);

    // فحص SW
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    }

    // Cloud
    Cloud.init();
    Cloud.onStatus(s => UI.setCloudStatus(s.status));

    // DB + Admin افتراضي
    await DB.open();
    await Auth.ensureDefaultAdmin();
    await Settings.load();

    // استعادة الجلسة
    const session = Auth.getSession();
    if(session){
      await enterApp();
    } else {
      document.getElementById('loginScreen').hidden = false;
      document.getElementById('appShell').hidden = true;
    }

    bindGlobalEvents();
    updateVersion();

    // فحص رابط Deep Link — بعد تجهيز الواجهة
    handleDeepLink();
  }

  function updateVersion(){
    const el = document.getElementById('appVersion');
    if(el) el.textContent = 'الإصدار 1.0.0';
  }

  function updateThemeBtn(theme){
    const btn = document.getElementById('themeToggle');
    if(btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // ==== الدخول ====
  async function enterApp(){
    document.getElementById('loginScreen').hidden = true;
    document.getElementById('appShell').hidden = false;
    const s = Auth.getSession();
    document.getElementById('userInitial').textContent = (s.name||'؟').trim().charAt(0);
    document.getElementById('menuUserName').textContent = s.name;
    document.getElementById('menuUserRole').textContent = s.role === 'admin' ? 'مدير' : 'موظف';
    Perm.applyToDOM(document);
    await Items.load(true);
    document.getElementById('rateValue').textContent = U.formatMoney(Settings.rate()) + ' ريال/سعودي';
    await renderItems();
    Stocktake.render(); Stocktake.updateStats();
    if(s.mustChangePass){
      setTimeout(()=>UI.toast('يُنصح بتغيير كلمة المرور الافتراضية من قائمة المستخدم','warn',6000), 800);
    }
  }

  // ==== عرض الأصناف ====
  async function renderItems(){
    const all = await Items.load();
    let list = all.filter(it => !it.deleted);

    // فلاتر
    for(const field in activeFilters){
      const f = activeFilters[field];
      list = list.filter(it => Search.matchAdvanced(it, {...f, field}));
    }

    // بحث
    const q = document.getElementById('searchInput').value;
    list = Search.filter(list, q);

    // ترتيب بالاسم
    list.sort((a,b)=>(a.name||'').localeCompare(b.name||'','ar'));

    const slice = list.slice(0, shown);
    const grid = document.getElementById('itemsGrid');
    if(!slice.length){
      grid.innerHTML = `<div class="empty-state">لا توجد أصناف مطابقة.<br>جرّب تعديل البحث أو الفلاتر.</div>`;
    } else {
      grid.innerHTML = slice.map(itemCardHTML).join('');
      wireItemCards();
    }
    document.getElementById('itemsCount').textContent = `${list.length} صنف — معروض ${slice.length}`;
    document.getElementById('loadMoreBtn').hidden = shown >= list.length;
  }

function itemCardHTML(it){
  const rate = Settings.rate();
  const yem = U.formatMoney((it.retail||0) * rate);
  const canEdit = Perm.can('edit');
  const canDel = Perm.can('delete');
  const canCost = Perm.can('viewCost');
  const canWhole = Perm.can('viewWhole');
  return `
    <article class="item-card" data-id="${U.escapeHtml(it.id)}">
      <div class="ic-head">
        <div>
          <div class="ic-name">${U.escapeHtml(it.name)}</div>
          <div class="ic-no">رقم: ${U.escapeHtml(it.no||'-')}</div>
        </div>
      </div>
      <div class="ic-tags">
        <span class="tag-barcode" title="الباركود">📊 ${U.escapeHtml(it.barcode || '—')}</span>
        ${it.unit ? `<span>${U.escapeHtml(it.unit)}</span>`:''}
        ${it.model ? `<span>${U.escapeHtml(it.model)}</span>`:''}
        ${it.branch ? `<span>${U.escapeHtml(it.branch)}</span>`:''}
      </div>
      <div class="ic-prices">
        <div><span class="muted small">سعر البيع</span><strong>${U.formatMoney(it.retail)}</strong></div>
        <div><span class="muted small">ريال يمني</span><strong>${yem}</strong></div>
        ${canWhole ? `<div><span class="muted small">الجملة</span><strong>${U.formatMoney(it.whole)}</strong></div>`:''}
        ${canCost ? `<div><span class="muted small">التكلفة</span><strong>${U.formatMoney(it.cost)}</strong></div>`:''}
      </div>
      <div class="ic-actions">
        <button data-act="qr" class="qr">QR</button>
        <button data-act="share" class="share">📤</button>
        ${canEdit ? `<button data-act="edit" class="edit">تعديل</button>`:''}
        ${canDel ? `<button data-act="del" class="del">حذف</button>`:''}
      </div>
    </article>`;
}

  function wireItemCards(){
    document.querySelectorAll('.item-card').forEach(card => {
      const id = card.getAttribute('data-id');
      card.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', async () => {
          const it = await Items.get(id);
          if(!it) return;
          const act = btn.getAttribute('data-act');
          if(act === 'qr') QR.showForItem(it);
          else if(act === 'share') QR.shareItem(it);
          else if(act === 'edit') openItemForm(it);
          else if(act === 'del') {
            const ok = await UI.confirm(
              `هل أنت متأكد من حذف الصنف «${it.name}»؟\nسيتم حذفه محليًا ومزامنته سحابيًا.`,
              {danger:true, okText:'حذف', title:'تأكيد الحذف'}
            );
            if(ok){
              try{ await Items.remove(id); UI.toast('✅ تم حذف الصنف'); await renderItems(); }
              catch(e){ UI.toast('❌ '+e.message,'error'); }
            }
          }
        });
      });
    });
  }

  // ==== نافذة العرض السريع ====
  function showItemQuickView(it){
    const rate = Settings.rate();
    const yem = U.formatMoney((it.retail||0) * rate);
    const m = UI.modal({
      title: 'تفاصيل الصنف',
      bodyHTML: `
        <div style="text-align:right;">
          <h3 style="color:var(--primary);margin:.2rem 0;">${U.escapeHtml(it.name)}</h3>
          <p class="muted small">رقم: ${U.escapeHtml(it.no||'-')} — باركود: ${U.escapeHtml(it.barcode||'-')}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;background:var(--bg);padding:.8rem;border-radius:12px;margin-top:.6rem;">
            <div><span class="muted small">سعر البيع</span><br><strong style="color:var(--primary);font-size:1.1rem;">${U.formatMoney(it.retail)}</strong></div>
            <div><span class="muted small">ريال يمني</span><br><strong style="color:var(--blue);font-size:1.1rem;">${yem}</strong></div>
            <div><span class="muted small">الجملة</span><br><strong style="color:var(--warning);">${U.formatMoney(it.whole)}</strong></div>
            <div><span class="muted small">التكلفة</span><br><strong>${U.formatMoney(it.cost)}</strong></div>
          </div>
        </div>`,
      footHTML: `
        <button class="btn ghost small" data-qr>📱 QR</button>
        <button class="btn ghost small" data-share>📤 مشاركة</button>
        <button class="btn primary small" data-close2>إغلاق</button>`
    });
    m.element.querySelector('[data-qr]').onclick = () => { m.close(); QR.showForItem(it); };
    m.element.querySelector('[data-share]').onclick = () => { m.close(); QR.shareItem(it); };
    m.element.querySelector('[data-close2]').onclick = m.close;
  }

  // ==== نموذج الصنف ====
  function openItemForm(item=null){
    const isEdit = !!item;
    const it = item || {barcode:'',no:'',name:'',model:'',cost:'',retail:'',whole:'',unit:'',branch:''};
    const m = UI.modal({
      title: isEdit ? 'تعديل صنف' : 'إضافة صنف',
      bodyHTML: `
        <form id="itemForm" autocomplete="off">
          <label>اسم الصنف *
            <input type="text" name="name" required value="${U.escapeHtml(it.name)}" />
          </label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
            <label>الباركود<input type="text" name="barcode" inputmode="numeric" value="${U.escapeHtml(it.barcode)}" /></label>
            <label>رقم الصنف<input type="text" name="no" value="${U.escapeHtml(it.no)}" /></label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
            <label>الموديل<input type="text" name="model" value="${U.escapeHtml(it.model)}" /></label>
            <label>الوحدة<input type="text" name="unit" value="${U.escapeHtml(it.unit)}" /></label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;">
            <label>التكلفة<input type="text" name="cost" inputmode="decimal" value="${it.cost ?? ''}" /></label>
            <label>البيع<input type="text" name="retail" inputmode="decimal" value="${it.retail ?? ''}" /></label>
            <label>الجملة<input type="text" name="whole" inputmode="decimal" value="${it.whole ?? ''}" /></label>
          </div>
          <label>الفرع<input type="text" name="branch" value="${U.escapeHtml(it.branch)}" /></label>
          <div class="err error-box" hidden></div>
        </form>`,
      footHTML: `
        <button class="btn ghost" data-cancel>إلغاء</button>
        <button class="btn primary" data-save>حفظ</button>`
    });
    m.element.querySelector('[data-cancel]').addEventListener('click', m.close);
    m.element.querySelector('[data-save]').addEventListener('click', async () => {
      const f = m.element.querySelector('#itemForm');
      const data = Object.fromEntries(new FormData(f).entries());
      const err = m.element.querySelector('.err');
      err.hidden = true;
      if(!U.cleanSpaces(data.name)){ err.textContent = 'اسم الصنف إجباري'; err.hidden = false; return; }
      try{
        await Items.save(data, isEdit ? it.id : null);
        m.close();
        UI.toast(isEdit ? '✅ تم تعديل الصنف' : '✅ تم إضافة الصنف');
        await renderItems();
      }catch(e){
        err.textContent = e.message; err.hidden = false;
      }
    });
  }

  // ==== الفلاتر ====
  function renderFilters(){
    const panel = document.getElementById('filtersPanel');
    const fields = [
      {k:'barcode', t:'الباركود', type:'text'},
      {k:'no', t:'رقم الصنف', type:'text'},
      {k:'name', t:'الاسم', type:'text'},
      {k:'model', t:'الموديل', type:'text'},
      {k:'unit', t:'الوحدة', type:'text'},
      {k:'branch', t:'الفرع', type:'text'},
      {k:'cost', t:'التكلفة', type:'num'},
      {k:'retail', t:'البيع', type:'num'},
      {k:'whole', t:'الجملة', type:'num'}
    ];
    panel.innerHTML = fields.map(f => `
      <label>${f.t}
        <input type="text" data-field="${f.k}" placeholder="${f.type==='num'?'100 | >100 | 100-500':''}" value="${activeFilters[f.k]?.raw || ''}" />
      </label>`).join('') + `
      <div class="fp-actions">
        <button class="btn ghost small" data-clear>مسح الفلاتر</button>
        <button class="btn primary small" data-apply>تطبيق</button>
      </div>`;
    panel.querySelector('[data-apply]').addEventListener('click', () => {
      const next = {};
      panel.querySelectorAll('input[data-field]').forEach(inp => {
        const v = inp.value.trim();
        if(!v) return;
        const f = fields.find(x => x.k === inp.getAttribute('data-field'));
        if(f.type === 'num'){
          const parsed = Search.parseNumeric(v);
          if(parsed) next[f.k] = {...parsed, raw: v};
        } else {
          next[f.k] = {op:'contains', value: v, raw: v};
        }
      });
      activeFilters = next;
      shown = pageSize;
      renderItems();
      panel.hidden = true;
    });
    panel.querySelector('[data-clear]').addEventListener('click', () => {
      activeFilters = {}; panel.querySelectorAll('input[data-field]').forEach(i => i.value='');
      renderItems();
    });
  }

  // ==== البحث الصوتي ====
  function startVoice(){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){
      UI.toast('البحث الصوتي غير مدعوم في هذا المتصفح.', 'warn', 4000);
      return;
    }
    const rec = new SR();
    rec.lang = 'ar-SA';
    rec.interimResults = true;
    rec.continuous = false;

    const status = document.getElementById('voiceStatus');
    const txt = document.getElementById('voiceText');
    status.hidden = false;
    txt.textContent = 'جاري الاستماع...';

    // زر الإيقاف
    document.getElementById('voiceStop').onclick = () => {
      try{ rec.stop(); }catch(e){}
      status.hidden = true;
    };

    // زر الرجوع — يوقف ويعيد المسح
    document.getElementById('voiceBack').onclick = () => {
      try{ rec.abort(); }catch(e){}
      status.hidden = true;
      document.getElementById('searchInput').value = '';
      renderItems();
    };

    // النتائج
    rec.onresult = e => {
  let t = Array.from(e.results).map(r => r[0].transcript).join(' ');
  // إصلاح الأرقام المعكوسة
  t = U.fixArabicNumbers(t);
  txt.textContent = t;
  document.getElementById('searchInput').value = t;
  renderItems();
};

    // الأخطاء — نتعامل معها بهدوء
    rec.onerror = e => {
      // تجاهل الأخطاء الطبيعية
      if(e.error === 'aborted' || e.error === 'no-speech' || e.error === 'audio-capture'){
        status.hidden = true;
        return;
      }
      // الأخطاء الحقيقية فقط
      if(e.error === 'not-allowed'){
        UI.toast('🚫 تم رفض إذن الميكروفون. اسمح بالوصول من إعدادات المتصفح.', 'error', 5000);
      } else if(e.error === 'network'){
        UI.toast('⚠️ خطأ في الاتصال بالشبكة', 'warn');
      } else {
        console.warn('SpeechRecognition error:', e.error);
      }
      status.hidden = true;
    };

    // عند الانتهاء
    rec.onend = () => {
      setTimeout(() => { status.hidden = true; }, 800);
    };

    try{
      rec.start();
    }catch(e){
      status.hidden = true;
      UI.toast('تعذّر بدء البحث الصوتي','error');
    }
  }

  // ==== الأدوات ====
  function handleTool(action){
    switch(action){
      case 'rate': return editRate();
      case 'sync': return doSync();
      case 'users': return openUsersManager();
      case 'import': return openImportDialog();
      case 'export': CSV.exportAll(); return UI.toast('تم تصدير الملف');
      case 'template': CSV.downloadTemplate(); return UI.toast('تم تنزيل القالب');
      case 'clearFilters':
        activeFilters = {}; document.getElementById('searchInput').value = '';
        renderFilters(); renderItems(); return UI.toast('تم مسح الفلاتر');
      case 'clearAll': return doClearAll();
      case 'audit': return showAudit();
      case 'backup': return backup();
      case 'restore': return restore();
    }
  }

  async function editRate(){
    if(!Perm.can('changeRate')) return UI.toast('🚫 لا تملك الصلاحية','error');
    const cur = Settings.rate();
    const m = UI.modal({
      title:'سعر الصرف',
      bodyHTML:`<label>1 سعودي = ؟ ريال يمني
        <input type="text" id="rateInput" inputmode="decimal" value="${cur}" />
      </label>`,
      footHTML:`<button class="btn ghost" data-cancel>إلغاء</button>
                <button class="btn primary" data-save>حفظ</button>`
    });
    m.element.querySelector('[data-cancel]').onclick = m.close;
    m.element.querySelector('[data-save]').onclick = async () => {
      const v = U.toNumber(m.element.querySelector('#rateInput').value);
      if(v <= 0) return UI.toast('قيمة غير صحيحة','error');
      await Settings.update({exchangeRate: v});
      document.getElementById('rateValue').textContent = U.formatMoney(v)+' ريال/سعودي';
      Audit.log('change_rate','settings',null,{from:cur, to:v});
      m.close(); UI.toast('✅ تم تحديث سعر الصرف');
      renderItems();
    };
  }

  async function doSync(){
    if(!Cloud.enabled) return UI.toast('المزامنة السحابية غير مُهيّأة (أضف إعدادات Firebase)','warn',5000);
    UI.setCloudStatus('syncing');
    try{
      const local = await DB.all('items');
      await Cloud.pushItems(local);
      const remote = await Cloud.pullItems();
      if(remote.length){
        const map = new Map(local.map(i=>[i.id, i]));
        remote.forEach(r => {
          const l = map.get(r.id);
          if(!l || (r.updatedAt||0) > (l.updatedAt||0)) map.set(r.id, r);
        });
        await DB.bulkPut('items', Array.from(map.values()));
      }
      const sRemote = await Cloud.pullSettings();
      if(sRemote && sRemote.exchangeRate) await Settings.update(sRemote);
      Items.markDirty();
      await Items.load(true);
      await renderItems();
      UI.setCloudStatus('synced');
      UI.toast('✅ تمت المزامنة');
      Audit.log('sync','system',null,{items:local.length});
    }catch(e){ UI.setCloudStatus('error'); UI.toast('❌ فشل المزامنة: '+e.message,'error'); }
  }

  async function doClearAll(){
    const ok = await UI.confirm('سيتم حذف جميع الأصناف محليًا ومزامنتها سحابيًا. هل أنت متأكد؟', {danger:true, okText:'حذف الكل', title:'حذف كل الأصناف'});
    if(!ok) return;
    try{
      await Items.clearAll();
      await renderItems();
      UI.toast('🗑️ تم حذف جميع الأصناف');
    }catch(e){ UI.toast('❌ '+e.message,'error'); }
  }

  function openImportDialog(){
    const m = UI.modal({
      title:'📥 استيراد CSV',
      bodyHTML: `
        <p class="muted">يتم تحديث الأصناف عند تطابق الباركود، وإضافة صنف جديد عند عدم وجوده.</p>
        <input type="file" id="csvFile" accept=".csv,text/csv" />
        <div id="importReport" class="muted small" style="margin-top:.6rem;"></div>`,
      footHTML:`<button class="btn ghost" data-cancel>إلغاء</button>
                <button class="btn primary" data-run disabled>استيراد</button>`
    });
    const fileInput = m.element.querySelector('#csvFile');
    const runBtn = m.element.querySelector('[data-run]');
    fileInput.addEventListener('change', ()=>{ runBtn.disabled = !fileInput.files.length; });
    m.element.querySelector('[data-cancel]').onclick = m.close;
    runBtn.onclick = async () => {
      const file = fileInput.files[0];
      if(!file) return;
      runBtn.disabled = true; runBtn.textContent = 'جاري الاستيراد...';
      try{
        const res = await CSV.importFile(file);
        m.element.querySelector('#importReport').innerHTML = `
          ✅ تمت الإضافة: <b>${res.added}</b><br>
          ♻️ تم التحديث: <b>${res.updated}</b><br>
          ⏭️ تم التجاهل: <b>${res.ignored}</b>`;
        UI.toast(`تمت الإضافة ${res.added} — التحديث ${res.updated}`);
        await renderItems();
      }catch(e){
        UI.toast('❌ '+e.message,'error',5000);
      }finally{
        runBtn.disabled = false; runBtn.textContent = 'استيراد';
      }
    };
  }

  async function openUsersManager(){
    const users = await Users.list();
    const m = UI.modal({
      title:'👥 المستخدمون',
      bodyHTML:`
        <button class="btn primary small" id="addUserBtn" style="margin-bottom:.6rem;">+ مستخدم جديد</button>
        <div id="usersList">${users.map(u=>`
          <div class="user-row" data-id="${u.id}" style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--border);">
            <div>
              <strong>${U.escapeHtml(u.name)}</strong>
              <div class="muted small">${U.escapeHtml(u.username)} — ${u.role==='admin'?'مدير':'موظف'} — ${u.active===false?'موقوف':'نشط'}</div>
            </div>
            <div style="display:flex;gap:.3rem;">
              <button data-act="toggle" class="btn ghost small">${u.active===false?'تفعيل':'إيقاف'}</button>
              <button data-act="del" class="btn danger small">حذف</button>
            </div>
          </div>`).join('')}</div>`
    });
    m.element.querySelector('#addUserBtn').onclick = () => { m.close(); openUserForm(); };
    m.element.querySelectorAll('.user-row').forEach(row => {
      const id = row.getAttribute('data-id');
      row.querySelector('[data-act="toggle"]').onclick = async () => {
        try{ await Users.toggleActive(id); m.close(); openUsersManager(); }
        catch(e){ UI.toast('❌ '+e.message,'error'); }
      };
      row.querySelector('[data-act="del"]').onclick = async () => {
        const ok = await UI.confirm('حذف هذا المستخدم؟', {danger:true, okText:'حذف'});
        if(!ok) return;
        try{ await Users.remove(id); m.close(); openUsersManager(); }
        catch(e){ UI.toast('❌ '+e.message,'error'); }
      };
    });
  }

  function openUserForm(){
    const m = UI.modal({
      title:'مستخدم جديد',
      bodyHTML:`
        <label>الاسم<input type="text" name="name" required /></label>
        <label>اسم المستخدم<input type="text" name="username" required /></label>
        <label>كلمة المرور<input type="password" name="password" required minlength="6" /></label>
        <label>الدور
          <select name="role"><option value="employee">موظف</option><option value="admin">مدير</option></select>
        </label>
        <div class="err error-box" hidden></div>`,
      footHTML:`<button class="btn ghost" data-cancel>إلغاء</button>
                <button class="btn primary" data-save>حفظ</button>`
    });
    m.element.querySelector('[data-cancel]').onclick = m.close;
    m.element.querySelector('[data-save]').onclick = async () => {
      const name = m.element.querySelector('[name="name"]').value;
      const username = m.element.querySelector('[name="username"]').value;
      const password = m.element.querySelector('[name="password"]').value;
      const role = m.element.querySelector('[name="role"]').value;
      const err = m.element.querySelector('.err');
      try{
        await Users.create({name, username, password, role});
        UI.toast('✅ تم إنشاء المستخدم');
        m.close();
        openUsersManager();
      }catch(e){ err.textContent = e.message; err.hidden = false; }
    };
  }

  async function showAudit(){
    const logs = await Audit.list(200);
    UI.modal({
      title:'📜 سجل العمليات',
      bodyHTML: logs.length ? logs.map(l => `
        <div style="padding:.4rem 0;border-bottom:1px solid var(--border);font-size:.85rem;">
          <strong>${U.escapeHtml(l.userName)}</strong> — ${U.escapeHtml(l.action)}
          <div class="muted small">${new Date(l.timestamp).toLocaleString('ar-EG')}</div>
        </div>`).join('') : '<div class="muted">لا يوجد سجل.</div>'
    });
  }

  async function backup(){
    const data = {
      version: 1,
      exportedAt: Date.now(),
      items: await DB.all('items'),
      users: await DB.all('users'),
      settings: await DB.all('settings')
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `albahri_backup_${U.today()}.json`; a.click();
    Audit.log('backup','system',null,null);
    UI.toast('✅ تم إنشاء نسخة احتياطية');
  }

  async function restore(){
    const m = UI.modal({
      title:'استعادة نسخة احتياطية',
      bodyHTML:`<input type="file" id="bkFile" accept=".json,application/json" />
                <p class="muted small">سيتم استبدال البيانات الحالية بالكامل.</p>`,
      footHTML:`<button class="btn ghost" data-cancel>إلغاء</button>
                <button class="btn danger" data-ok>استعادة</button>`
    });
    m.element.querySelector('[data-cancel]').onclick = m.close;
    m.element.querySelector('[data-ok]').onclick = async () => {
      const f = m.element.querySelector('#bkFile').files[0];
      if(!f) return UI.toast('اختر ملفًا','warn');
      try{
        const text = await f.text();
        const data = JSON.parse(text);
        if(!data.items) throw new Error('ملف غير صالح');
        await DB.clear('items'); await DB.bulkPut('items', data.items);
        if(data.users){ await DB.clear('users'); await DB.bulkPut('users', data.users); }
        if(data.settings){ await DB.clear('settings'); await DB.bulkPut('settings', data.settings); }
        Items.markDirty(); await Items.load(true);
        await Settings.load();
        Audit.log('restore','system',null,{items:data.items.length});
        m.close(); UI.toast('✅ تمت الاستعادة'); renderItems();
      }catch(e){ UI.toast('❌ '+e.message,'error'); }
    };
  }

  // ==== التنقل ====
  function showPage(name){
    currentPage = name;
    ['items','stocktake','tools'].forEach(p => {
      document.getElementById('page'+p.charAt(0).toUpperCase()+p.slice(1)).hidden = (p !== name);
    });
    document.querySelectorAll('.bottom-nav button').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-page') === name);
    });
    if(name === 'items') renderItems();
    if(name === 'stocktake'){ Stocktake.render(); Stocktake.updateStats(); }
    if(name === 'tools') Perm.applyToDOM(document.getElementById('pageTools'));
  }

  // ==== رابط Deep Link ====
  async function handleDeepLink(){
    const params = new URLSearchParams(location.search);
    const itemId = params.get('item');
    if(!itemId) return;

    // انتظر قليلًا حتى تحمّل الأصناف
    setTimeout(async () => {
      const it = await Items.get(itemId);
      if(!it){
        UI.toast('⚠️ الصنف غير موجود في قاعدة البيانات','warn',4000);
        return;
      }
      showItemQuickView(it);
      history.replaceState({}, '', location.pathname);
    }, 600);
  }

  // ==== ربط الأحداث ====
  function bindGlobalEvents(){
    // Login
    document.getElementById('loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const err = document.getElementById('loginError');
      err.hidden = true;
      try{
        await Auth.login(
          document.getElementById('loginUser').value,
          document.getElementById('loginPass').value
        );
        await enterApp();
      }catch(ex){
        err.textContent = ex.message; err.hidden = false;
      }
    });

    // Theme
    document.getElementById('themeToggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('albahri_theme', next);
      updateThemeBtn(next);
    });

    // User menu
    const menu = document.getElementById('userMenu');
    document.getElementById('userMenuBtn').addEventListener('click', e => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      Perm.applyToDOM(menu);
    });
    document.addEventListener('click', () => { menu.hidden = true; });
    menu.addEventListener('click', e => {
      e.stopPropagation();
      const a = e.target.closest('button')?.getAttribute('data-action');
      if(!a) return;
      menu.hidden = true;
      if(a === 'logout'){
        Auth.logout();
        Audit.log('logout','auth',null,null);
        document.getElementById('appShell').hidden = true;
        document.getElementById('loginScreen').hidden = false;
      } else if(a === 'users'){
        openUsersManager();
      } else if(a === 'changePass'){
        openChangePassword();
      } else if(a === 'profile'){
        const s = Auth.getSession();
        UI.modal({title:'ملفي', bodyHTML:`
          <p><b>الاسم:</b> ${U.escapeHtml(s.name)}</p>
          <p><b>المستخدم:</b> ${U.escapeHtml(s.username)}</p>
          <p><b>الدور:</b> ${s.role==='admin'?'مدير':'موظف'}</p>`});
      }
    });

    // Bottom nav
    document.querySelectorAll('.bottom-nav button').forEach(b => {
      b.addEventListener('click', () => showPage(b.getAttribute('data-page')));
    });

    // Add item
    document.getElementById('addItemBtn').addEventListener('click', () => {
      if(!Perm.can('add')) return UI.toast('🚫 لا تملك الصلاحية','error');
      openItemForm();
    });

    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', U.debounce(() => { shown = pageSize; renderItems(); }, 180));
// زر مسح البحث
const clearSearchBtn = document.getElementById('clearSearchBtn');
searchInput.addEventListener('input', () => {
  clearSearchBtn.hidden = !searchInput.value;
});
clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearSearchBtn.hidden = true;
  shown = pageSize;
  renderItems();
  searchInput.focus();
});
    // Voice
    document.getElementById('voiceBtn').addEventListener('click', startVoice);

    // Camera
    document.getElementById('cameraBtn').addEventListener('click', () => {
      Scanner.open({
        onResult: async code => {
          const it = await Items.getByBarcode(code);
          if(it){
            U.beep(980, 100);
            U.vibrate([40]);
            UI.toast('✅ ' + it.name);
            document.getElementById('searchInput').value = it.name;
            renderItems();
            showItemQuickView(it);
          } else {
            U.beep(300, 200);
            U.vibrate([60, 60, 60]);
            UI.toast('⚠️ باركود غير معروف: ' + code, 'warn', 4000);
          }
        }
      });
    });

    // Filters
    document.getElementById('filterBtn').addEventListener('click', () => {
      const p = document.getElementById('filtersPanel');
      p.hidden = !p.hidden;
      if(!p.hidden) renderFilters();
    });

    // Load more
    document.getElementById('loadMoreBtn').addEventListener('click', () => {
      shown += pageSize; renderItems();
    });

    // Scanner close
    document.getElementById('scannerClose').addEventListener('click', () => Scanner.close());

    // زر الرجوع في الكاميرا
    document.getElementById('scannerBack').addEventListener('click', () => {
      if(window.history.length > 1 && document.referrer.includes(location.hostname)){
        history.back();
      }
      Scanner.close();
    });

    // زر الفلاش
    document.getElementById('scannerTorch').addEventListener('click', async function(){
      this.classList.toggle('active');
      try{
        const stream = document.querySelector('#scannerView video')?.srcObject;
        const track = stream?.getVideoTracks()?.[0];
        if(track && track.getCapabilities && track.getCapabilities().torch){
          await track.applyConstraints({advanced:[{torch: this.classList.contains('active')}]});
        }
      }catch(e){ /* تجاهل */ }
    });

    document.getElementById('scanContinuous').addEventListener('change', e => Scanner.setContinuous(e.target.checked));

    // Stocktake toolbar
    document.getElementById('stScanBtn').addEventListener('click', () => {
      Scanner.open({
        onResult: async code => {
          const it = await Items.getByBarcode(code);
          if(!it){ U.beep(300,200); U.vibrate([60,60,60]); UI.toast('⚠️ باركود غير معروف: '+code,'warn'); return; }
          Stocktake.addFromItem(it, 1);
          UI.toast('✅ أضيف: '+it.name);
        }
      });
    });
    document.getElementById('stAddRowBtn').addEventListener('click', () => {
      const m = UI.modal({
        title:'إضافة صنف للجرد',
        bodyHTML:`<input type="text" id="stSearch" placeholder="ابحث عن صنف..." />
                  <div id="stSuggest" style="max-height:40vh;overflow:auto;"></div>`
      });
      const s = m.element.querySelector('#stSearch');
      const box = m.element.querySelector('#stSuggest');
      s.addEventListener('input', U.debounce(async () => {
        const list = Search.filter(Items.cache, s.value).slice(0,30);
        box.innerHTML = list.map(it => `<button class="tool-item" data-id="${it.id}" style="width:100%;text-align:right;">${U.escapeHtml(it.name)} <span class="muted small">— ${U.escapeHtml(it.no||'')}</span></button>`).join('');
        box.querySelectorAll('button[data-id]').forEach(b => b.onclick = async () => {
          const it = await Items.get(b.getAttribute('data-id'));
          if(it){ Stocktake.addFromItem(it, 1); UI.toast('أضيف: '+it.name); }
          m.close();
        });
      }, 150));
    });
    document.getElementById('stSaveBtn').addEventListener('click', async () => {
      try{ await Stocktake.save(); }catch(e){ UI.toast('❌ '+e.message,'error'); }
    });
    document.getElementById('stExportBtn').addEventListener('click', () => Stocktake.exportCsv());
    document.getElementById('stClearBtn').addEventListener('click', async () => {
      const ok = await UI.confirm('مسح كل الجرد الحالي؟', {danger:true, okText:'مسح'});
      if(ok){ await Stocktake.clear(); UI.toast('تم المسح'); }
    });

    // Tools list
    document.getElementById('pageTools').addEventListener('click', e => {
      const b = e.target.closest('[data-action]');
      if(!b) return;
      handleTool(b.getAttribute('data-action'));
    });

    // Online/offline
    window.addEventListener('online', () => { UI.setCloudStatus('online'); UI.toast('🌐 عاد الاتصال'); });
    window.addEventListener('offline', () => { UI.setCloudStatus('offline'); UI.toast('📴 بدون اتصال — وضع محلي','warn'); });
  }

  function openChangePassword(){
    const m = UI.modal({
      title:'تغيير كلمة المرور',
      bodyHTML:`
        <label>كلمة المرور الحالية<input type="password" name="old" /></label>
        <label>كلمة المرور الجديدة<input type="password" name="new" minlength="6" /></label>
        <div class="err error-box" hidden></div>`,
      footHTML:`<button class="btn ghost" data-cancel>إلغاء</button>
                <button class="btn primary" data-save>حفظ</button>`
    });
    m.element.querySelector('[data-cancel]').onclick = m.close;
    m.element.querySelector('[data-save]').onclick = async () => {
      const o = m.element.querySelector('[name="old"]').value;
      const n = m.element.querySelector('[name="new"]').value;
      const err = m.element.querySelector('.err');
      try{
        await Auth.changePassword(Auth.getSession().id, o, n);
        Audit.log('change_password','auth',Auth.getSession().id,null);
        m.close(); UI.toast('✅ تم تغيير كلمة المرور');
      }catch(e){ err.textContent = e.message; err.hidden = false; }
    };
  }

  // ==== Init عند DOM جاهز ====
  window.addEventListener('DOMContentLoaded', () => {
    init().catch(e => { console.error(e); UI.toast('خطأ في التهيئة: '+e.message,'error',6000); });
  });

  return { showPage, renderItems, openItemForm };
})();
