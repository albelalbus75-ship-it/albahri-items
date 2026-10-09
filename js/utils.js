/* أدوات مساعدة عامة */
const U = (() => {
  const AR_DIGITS = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  function toEnglishDigits(s){
    if(s==null) return '';
    return String(s).replace(/[٠-٩]/g, d => AR_DIGITS[d] || d);
  }
  function normalizeArabic(s){
    if(s==null) return '';
    return toEnglishDigits(String(s))
      .replace(/[\u064B-\u0652\u0670\u0640]/g,'')
      .replace(/[أإآٱ]/g,'ا')
      .replace(/ى/g,'ي')
      .replace(/ؤ/g,'و')
      .replace(/ئ/g,'ي')
      .replace(/ة/g,'ه')
      .replace(/\s+/g,' ')
      .trim()
      .toLowerCase();
  }
  function cleanSpaces(s){ return String(s??'').replace(/\s+/g,' ').trim(); }
  function toNumber(v){
    if(v==null||v==='') return 0;
    const s = toEnglishDigits(String(v)).replace(/[^\d.\-]/g,'');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function normalizeBarcode(v){
    if(v==null) return '';
    let s = toEnglishDigits(String(v)).trim();
    if(/^[\d.]+e[+\-]?\d+$/i.test(s)){
      const n = Number(s);
      if(Number.isFinite(n) && Math.abs(n) < Number.MAX_SAFE_INTEGER) s = n.toFixed(0);
    }
    if(/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/,'');
    return s;
  }
  function formatMoney(n){
    const v = toNumber(n);
    return v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function debounce(fn, wait=250){
    let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),wait);};
  }
  function uid(){
    return 'i_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  }
  function escapeHtml(s){
    return String(s??'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function today(){
    const d=new Date();
    return d.toISOString().slice(0,10);
  }
  function beep(freq=880, dur=120){
    try{
      const Ctx = window.AudioContext||window.webkitAudioContext;
      if(!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq; o.type='sine';
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + dur/1000);
      o.start(); o.stop(ctx.currentTime + dur/1000);
      setTimeout(()=>ctx.close(), dur+50);
    }catch(e){}
  }
  function vibrate(pattern){ try{ navigator.vibrate && navigator.vibrate(pattern); }catch(e){} }
  function fixArabicNumbers(text){
    if(!text) return text;
    return String(text)
      .replace(/\b(صفر|واحد|اثنين|اثنتين|ثلاثة|ثلاث|أربعة|أربع|خمسة|خمس|ستة|ست|سبعة|سبع|ثمانية|ثماني|تسعة|تسع)\b/g, m => ({
        'صفر':'0','واحد':'1','اثنين':'2','اثنتين':'2','ثلاثة':'3','ثلاث':'3',
        'أربعة':'4','أربع':'4','خمسة':'5','خمس':'5','ستة':'6','ست':'6',
        'سبعة':'7','سبع':'7','ثمانية':'8','ثماني':'8','تسعة':'9','تسع':'9'
      }[m] || m))
      .replace(/[٠-٩]/g, d => AR_DIGITS[d]);
  }
  return {
    toEnglishDigits, normalizeArabic, cleanSpaces, toNumber,
    normalizeBarcode, formatMoney, debounce, uid, escapeHtml,
    today, beep, vibrate, fixArabicNumbers
  };
})();
