const QR = (() => {
  function showForItem(item){
  const base = location.origin + location.pathname.replace(/index\.html.*$/,'index.html');
  const shareUrl = `${base}?item=${encodeURIComponent(item.id)}`;

  // محتوى QR: الرابط (يسهل فتحه بأي هاتف)
  const payload = shareUrl;

  const m = UI.modal({
    title: 'رمز QR',
    bodyHTML: `
      <div style="text-align:center;">
        <h3 style="margin:.3rem 0;">${U.escapeHtml(item.name)}</h3>
        <p class="muted small">رقم: ${U.escapeHtml(item.no||'-')} — باركود: ${U.escapeHtml(item.barcode||'-')}</p>
        <div id="qrCanvas" style="margin:1rem auto;background:#fff;padding:10px;border-radius:12px;display:inline-block;"></div>
        <p class="muted tiny" style="word-break:break-all;max-width:300px;margin:.5rem auto;">${U.escapeHtml(shareUrl)}</p>
      </div>`,
    footHTML: `
      <button class="btn ghost" data-print>🖨️ طباعة</button>
      <button class="btn ghost" data-share>📤 مشاركة</button>
      <button class="btn primary" data-close2>إغلاق</button>`
  });
  const el = m.element.querySelector('#qrCanvas');
  QRCode.toCanvas(payload, {width: 220, margin:1}, (err, canvas)=>{
    if(!err) el.appendChild(canvas);
    else el.textContent = 'تعذّر إنشاء الرمز';
  });
  m.element.querySelector('[data-close2]').addEventListener('click', m.close);
  m.element.querySelector('[data-print]').addEventListener('click', () => {
    const c = el.querySelector('canvas');
    if(!c) return;
    const w = window.open('', '_blank');
    w.document.write(`<html dir="rtl"><head><title>${U.escapeHtml(item.name)}</title></head><body style="text-align:center;font-family:Tahoma;">
      <h2>${U.escapeHtml(item.name)}</h2>
      <p>رقم: ${U.escapeHtml(item.no||'-')} — باركود: ${U.escapeHtml(item.barcode||'-')}</p>
      <img src="${c.toDataURL()}" />
    </body></html>`);
    w.document.close();
    setTimeout(()=>{w.print();},300);
  });
  m.element.querySelector('[data-share]').addEventListener('click', () => shareItem(item));
}

 function shareItem(item){
  const rate = Settings.rate();
  const yem = U.formatMoney((item.retail||0) * rate);

  const txt = `📦 ${item.name}
رقم الصنف: ${item.no || '-'}
الباركود: ${item.barcode || '-'}

💰 سعر البيع: ${U.formatMoney(item.retail)}
🇾🇪 بالريال اليمني: ${yem}
💵 سعر الجملة: ${U.formatMoney(item.whole)}
💵 التكلفة: ${U.formatMoney(item.cost)}`;

  if(navigator.share){
    navigator.share({
      title: item.name,
      text: txt
    }).catch(()=>{});
  } else {
    navigator.clipboard.writeText(txt)
      .then(()=> UI.toast('✅ تم نسخ معلومات الصنف'))
      .catch(()=> UI.toast('⚠️ تعذّر النسخ','warn'));
  }
}
  return { showForItem, shareItem };
})();
