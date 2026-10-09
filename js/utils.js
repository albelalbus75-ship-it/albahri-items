/* Utility functions - ASCII only to avoid encoding issues */
const U = (() => {
  const AR_DIGITS = {
    '\u0660':'0','\u0661':'1','\u0662':'2','\u0663':'3','\u0664':'4',
    '\u0665':'5','\u0666':'6','\u0667':'7','\u0668':'8','\u0669':'9'
  };
  function toEnglishDigits(s){
    if(s==null) return '';
    return String(s).replace(/[\u0660-\u0669]/g, d => AR_DIGITS[d] || d);
  }
  function normalizeArabic(s){
    if(s==null) return '';
    return toEnglishDigits(String(s))
      .replace(/[\u064B-\u0652\u0670\u0640]/g,'')
      .replace(/[\u0623\u0625\u0622\u0671]/g,'\u0627')
      .replace(/\u0649/g,'\u064A')
      .replace(/\u0624/g,'\u0648')
      .replace(/\u0626/g,'\u064A')
      .replace(/\u0629/g,'\u0647')
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

  // Arabic number words → digits (Unicode escapes)
  const AR_WORDS = {
    '\u0635\u0641\u0631': '0',
    '\u0648\u0627\u062D\u062F': '1',
    '\u0627\u062B\u0646\u064A\u0646': '2',
    '\u0627\u062B\u0646\u062A\u064A\u0646': '2',
    '\u062B\u0644\u0627\u062B\u0629': '3',
    '\u062B\u0644\u0627\u062B': '3',
    '\u0623\u0631\u0628\u0639\u0629': '4',
    '\u0623\u0631\u0628\u0639': '4',
    '\u062E\u0645\u0633\u0629': '5',
    '\u062E\u0645\u0633': '5',
    '\u0633\u062A\u0629': '6',
    '\u0633\u062A': '6',
    '\u0633\u0628\u0639\u0629': '7',
    '\u0633\u0628\u0639': '7',
    '\u062B\u0645\u0627\u0646\u064A\u0629': '8',
    '\u062B\u0645\u0627\u0646\u064A': '8',
    '\u062A\u0633\u0639\u0629': '9',
    '\u062A\u0633\u0639': '9'
  };
  function fixArabicNumbers(text){
    if(!text) return text;
    const pattern = new RegExp('\\b(' + Object.keys(AR_WORDS).join('|') + ')\\b', 'g');
    return String(text)
      .replace(pattern, m => AR_WORDS[m] || m)
      .replace(/[\u0660-\u0669]/g, d => AR_DIGITS[d]);
  }

  return {
    toEnglishDigits, normalizeArabic, cleanSpaces, toNumber,
    normalizeBarcode, formatMoney, debounce, uid, escapeHtml,
    today, beep, vibrate, fixArabicNumbers
  };
})();
