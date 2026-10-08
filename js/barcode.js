const Scanner = (() => {
  let h5 = null;
  let last = { code:null, t:0 };
  let continuous = true;
  let onResult = null;

  async function open(opts={}){
    onResult = opts.onResult || null;
    continuous = document.getElementById('scanContinuous')?.checked ?? true;
    const root = document.getElementById('scannerRoot');
    root.hidden = false;
    document.getElementById('scanContinuous').checked = continuous;
    h5 = new Html5Qrcode('scannerView', { verbose:false });
    try{
      await h5.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: {width:280, height:180}, aspectRatio: 1.0 },
        onScan, () => {}
      );
    }catch(e){
      UI.toast('تعذّر فتح الكاميرا: ' + (e?.message||e), 'error', 4000);
      close();
    }
  }

  function onScan(text){
    const now = Date.now();
    if(text === last.code && now - last.t < 1500) return;
    last = { code: text, t: now };
    U.beep(980, 100);
    U.vibrate([40]);
    const hint = document.getElementById('scanHint');
    if(hint){ hint.textContent = '✅ ' + text; }
    if(onResult) onResult(text);
    if(!continuous) close();
  }

  function close(){
    const root = document.getElementById('scannerRoot');
    root.hidden = true;
    if(h5){
      h5.stop().then(()=>h5.clear()).catch(()=>{}).finally(()=>{h5=null;});
    } else { h5 = null; }
  }

  function setContinuous(v){ continuous = !!v; }

  return { open, close, setContinuous };
})();