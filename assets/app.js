// ==========================================================================
// نظام المحل — آدم وحواء
// البحث حسب الصنف (الاسم / الكود / QR / الصورة)، صفحة المنتوج والمخزون، الإضافة بالصور، المعطيات.
// ==========================================================================
import { embed, MODEL_TAG } from './vision.js';

const app = document.getElementById('app');
const S = { cats: [], fabrics: [], sizes: [], branches: [], settings: {}, products: [], cat: 0,
  q: '', f: { fabric: '', size: '', color: '', avail: false }, pendingPhoto: null };
const KIND = { full: 'المنتوج كامل', neck: 'العنق', hand: 'فاليد / التفاصيل', other: 'صورة أخرى' };

// ---------- أدوات ----------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').toLowerCase().replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا')
  .replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
const money = (p) => (p == null || p === '' ? '—' : Number(p).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' DH');
const list = (csv) => String(csv || '').split(',').map((x) => x.trim()).filter(Boolean);
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const ICON = {
  search: '<svg class="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  plus: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  data: '<svg class="ico" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
  qr: '<svg class="ico" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>',
  camera: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  back: '<svg class="ico" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
};

async function api(action, data, isForm) {
  const opt = data === undefined ? {} : isForm ? { method: 'POST', body: data }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
  let res, j;
  try { res = await fetch('api.php?action=' + action, opt); j = await res.json(); }
  catch (e) { throw new Error('ما قدرتش نتصل بالسيرفر — واش XAMPP خدام؟'); }
  if (!res.ok || j.error) throw new Error(j.message || 'وقع مشكل.');
  return j;
}

function toast(msg, bad) {
  const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), bad ? 5000 : 2600);
}

function confirmBox(text, okLabel = 'تأكيد', danger = true) {
  return new Promise((done) => {
    const m = modal(`<div class="sheet-head"><h3>تأكيد</h3></div><p style="margin:0 0 16px">${esc(text)}</p>
      <div class="actions" style="justify-content:flex-end"><button class="btn" data-no>إلغاء</button>
      <button class="btn ${danger ? 'btn-bad' : 'btn-main'}" data-yes>${esc(okLabel)}</button></div>`, () => done(false));
    $('[data-no]', m.el).onclick = () => { m.close(); done(false); };
    $('[data-yes]', m.el).onclick = () => { m.close(); done(true); };
  });
}

function modal(html, onClose) {
  const el = document.createElement('div'); el.className = 'modal';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') { close(); onClose && onClose(); } };
  document.addEventListener('keydown', key);
  el.addEventListener('click', (e) => { if (e.target === el) { close(); onClose && onClose(); } });
  return { el, close };
}

// صورة كبيرة من الهاتف → JPEG خفيف (أقصى 1280px) قبل ما تتصيفط
async function shrink(file, max = 1280) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
}

// ---------- البيانات ----------
async function loadAll() {
  const j = await api('init');
  Object.assign(S, { cats: j.categories, fabrics: j.fabrics, sizes: j.sizes, branches: j.branches, settings: j.settings, products: j.products });
  if (!S.cats.some((c) => +c.id === +S.cat)) S.cat = +(localStorage.getItem('mg.cat') || 0) || (S.cats[0] ? +S.cats[0].id : 0);
  renderTop();
}
const productByCode = (code) => { const k = norm(code); return S.products.find((p) => norm(p.code) === k); };
const catName = (id) => (S.cats.find((c) => +c.id === +id) || {}).name || '—';
const branchName = (id) => (S.branches.find((b) => +b.id === +id) || {}).name || '—';

function renderTop() {
  const sel = $('#branch');
  sel.innerHTML = (S.branches.length ? '' : '<option value="0">— ما كاين حتى فرع —</option>') +
    S.branches.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
  sel.value = String(S.settings.current_branch || (S.branches[0] && S.branches[0].id) || 0);
}
$('#branch').addEventListener('change', async (e) => {
  try { await api('setting_set', { k: 'current_branch', v: +e.target.value }); await loadAll(); route(); toast('الفرع: ' + branchName(e.target.value)); }
  catch (err) { toast(err.message, true); }
});

// ==========================================================================
// 1) البحث داخل كل صنف
// ==========================================================================
function viewSearch() {
  const inCat = S.products.filter((p) => +p.category_id === +S.cat);
  const fabrics = [...new Set(inCat.map((p) => p.fabric).filter(Boolean))].sort();
  const colors = [...new Set(inCat.flatMap((p) => list(p.colors)))].sort();
  app.innerHTML = `
    <div class="cats">${S.cats.map((c) => `<button class="cat${+c.id === +S.cat ? ' on' : ''}" data-cat="${c.id}">${esc(c.name)}<span>${S.products.filter((p) => +p.category_id === +c.id).length}</span></button>`).join('')}</div>
    <div class="search">
      <input class="input" id="q" type="search" autocomplete="off" placeholder="الاسم ولا الكود… (ولا امسح بالمسدس)" value="${esc(S.q)}">
      <button class="btn" id="scanQr" title="مسح الباركود ولا QR بالكاميرا">${ICON.qr}<span>سكان</span></button>
      <button class="btn btn-main" id="photo" title="البحث بالصورة">${ICON.camera}<span>صورة</span></button>
    </div>
    <div class="filters">
      <select class="input" id="fFabric"><option value="">كل الأثواب</option>${fabrics.map((x) => `<option>${esc(x)}</option>`).join('')}</select>
      <select class="input" id="fSize"><option value="">كل المقاسات</option>${S.sizes.map((x) => `<option>${esc(x.name)}</option>`).join('')}</select>
      <select class="input" id="fColor"><option value="">كل الألوان</option>${colors.map((x) => `<option>${esc(x)}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="fAvail"${S.f.avail ? ' checked' : ''}> المتوفر هنا</label>
    </div>
    <div class="count"><span id="cnt"></span><a href="#" id="clearF" class="muted">مسح الفلاتر</a></div>
    <div class="list" id="res"></div>`;
  $('#fFabric').value = S.f.fabric; $('#fSize').value = S.f.size; $('#fColor').value = S.f.color;
  $$('.cat').forEach((b) => b.onclick = () => { S.cat = +b.dataset.cat; localStorage.setItem('mg.cat', S.cat); S.f = { fabric: '', size: '', color: '', avail: S.f.avail }; location.hash = '#/c/' + S.cat; });
  let t; $('#q').oninput = (e) => { S.q = e.target.value; clearTimeout(t); t = setTimeout(renderResults, 120); };
  $('#q').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const p = productByCode(e.target.value); if (p) showScanCard(p); } };
  $('#fFabric').onchange = (e) => { S.f.fabric = e.target.value; renderResults(); };
  $('#fSize').onchange = (e) => { S.f.size = e.target.value; renderResults(); };
  $('#fColor').onchange = (e) => { S.f.color = e.target.value; renderResults(); };
  $('#fAvail').onchange = (e) => { S.f.avail = e.target.checked; renderResults(); };
  $('#clearF').onclick = (e) => { e.preventDefault(); S.q = ''; S.f = { fabric: '', size: '', color: '', avail: false }; viewSearch(); };
  $('#scanQr').onclick = openQr;
  $('#photo').onclick = () => openPhotoSearch();
  renderResults();
  if (matchMedia('(pointer:fine)').matches) $('#q').focus();
}

function filtered() {
  const q = norm(S.q);
  let rows = S.products.filter((p) => +p.category_id === +S.cat);
  if (q) rows = rows.filter((p) => norm(p.name).includes(q) || norm(p.code).includes(q) || norm(p.fabric).includes(q));
  if (S.f.fabric) rows = rows.filter((p) => p.fabric === S.f.fabric);
  if (S.f.size) rows = rows.filter((p) => list(p.sizes).includes(S.f.size) || p.sizes_here.includes(S.f.size));
  if (S.f.color) rows = rows.filter((p) => list(p.colors).includes(S.f.color) || p.colors_here.includes(S.f.color));
  if (S.f.avail) rows = rows.filter((p) => p.stock_here > 0);
  if (q) rows.sort((a, b) => (norm(b.code) === q) - (norm(a.code) === q));   // الكود بالضبط فالأول
  return rows;
}

function itemHtml(p, extra = '') {
  const st = p.stock_here > 0 ? `<span class="pill pill-ok">متوفر: ${p.stock_here}</span>`
    : p.stock_all > 0 ? `<span class="pill pill-soft">كاين ففرع آخر</span>` : `<span class="pill pill-no">ما كاينش</span>`;
  return `<a class="card item" href="#/p/${p.id}">
    ${p.thumb ? `<img class="thumb" src="${esc(p.thumb)}" alt="" loading="lazy">` : '<div class="thumb">بلا صورة</div>'}
    <div><div class="name">${esc(p.name)}</div><div class="meta"><span class="code">${esc(p.code)}</span>${p.fabric ? ' · ' + esc(p.fabric) : ''}</div>${extra}</div>
    <div class="side"><div class="price">${money(p.price)}</div>${st}</div></a>`;
}

function renderResults() {
  const rows = filtered(), box = $('#res'); if (!box) return;
  $('#cnt').textContent = rows.length + ' منتوج';
  if (!rows.length) {
    box.innerHTML = `<div class="card empty"><b>ما لقيت حتى منتوج</b>جرّب كلمة أخرى، امسح الفلاتر، ولا قلّب بالصورة.
      <div class="actions" style="justify-content:center;margin-top:12px"><a class="btn" href="#/add?cat=${S.cat}${S.q ? '&code=' + encodeURIComponent(S.q) : ''}">${ICON.plus} زيد منتوج</a></div></div>`;
    return;
  }
  box.innerHTML = rows.map((p) => itemHtml(p)).join('');
}

// ---------- مسح QR بالكاميرا ----------
async function openQr() {
  const m = modal(`<div class="sheet-head"><h3>سكان الباركود / QR</h3><button class="close" data-x>×</button></div>
    <div id="qrv" class="qr-box"></div><div class="status" id="qrs">وجّه الكاميرا للباركود ديال القطعة…</div>`, () => stop());
  let scanner = null;
  const stop = () => { if (scanner) { scanner.stop().catch(() => {}); scanner = null; } };
  $('[data-x]', m.el).onclick = () => { stop(); m.close(); };
  try {
    if (!window.Html5Qrcode) await loadScript('https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js');
    const F = window.Html5QrcodeSupportedFormats;
    scanner = new window.Html5Qrcode('qrv', { formatsToSupport: [F.CODE_128, F.EAN_13, F.EAN_8, F.CODE_39, F.UPC_A, F.QR_CODE], verbose: false });
    await scanner.start({ facingMode: 'environment' }, { fps: 12, qrbox: { width: 290, height: 150 } }, (text) => { stop(); m.close(); handleCode(text); });
  } catch (e) { $('#qrs').className = 'status bad'; $('#qrs').textContent = 'ما قدرتش نحل الكاميرا. استعمل مسدس الـPOS ولا اكتب الكود.'; }
}
function loadScript(src) { return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }); }

// الكود جا من QR ولا من المسدس
function handleCode(raw) {
  const code = String(raw || '').trim(); if (!code) return;
  const p = productByCode(code);
  if (p) { showScanCard(p); return; }
  S.q = code; location.hash = '#/c/' + S.cat; route();
  toast('الكود «' + code + '» ما كاينش', true);
}

// ---------- نافذة المنتوج بعد السكان: الصورة، الثمن، وكل التفاصيل ----------
let scanCard = null;
async function showScanCard(lite) {
  if (scanCard) scanCard.close();
  let p; try { p = await api('product&id=' + lite.id); } catch (e) { toast(e.message, true); return; }
  const br = +S.settings.current_branch;
  const here = p.stock.filter((r) => r.branch_id === br && r.qty > 0);
  const hereTotal = here.reduce((t, r) => t + r.qty, 0);
  const others = S.branches.filter((b) => +b.id !== br).map((b) => ({ b, n: p.stock.filter((r) => r.branch_id === +b.id).reduce((t, r) => t + r.qty, 0) })).filter((x) => x.n > 0);
  const img0 = p.images[0];
  const m = modal(`
    <div class="sheet-head"><h3>${esc(catName(p.category_id))}</h3><button class="close" data-x aria-label="إغلاق">×</button></div>
    <div class="sc">
      <div class="sc-media">
        ${img0 ? `<img class="sc-main" id="scMain" src="${esc(img0.path)}" alt="">` : '<div class="sc-main sc-noimg">بلا صورة</div>'}
        ${p.images.length > 1 ? `<div class="sc-thumbs">${p.images.map((i, k) => `<button type="button" class="${k ? '' : 'on'}" data-src="${esc(i.path)}" title="${esc(KIND[i.kind] || '')}"><img src="${esc(i.path)}" alt=""></button>`).join('')}</div>` : ''}
      </div>
      <div class="sc-info">
        <div class="sc-name">${esc(p.name)}</div>
        <div class="code sc-code">${esc(p.code)}</div>
        <div class="sc-price">${money(p.price)}</div>
        <dl class="sc-kv">
          <dt>الثوب</dt><dd>${esc(p.fabric || '—')}</dd>
          <dt>المقاسات</dt><dd>${esc(list(p.sizes).join('، ') || '—')}</dd>
          <dt>الألوان</dt><dd>${esc(list(p.colors).join('، ') || '—')}</dd>
          ${p.note ? `<dt>ملاحظة</dt><dd>${esc(p.note)}</dd>` : ''}
        </dl>
        <div class="sc-stock">
          <div class="sc-stock-h"><span>المخزون — ${esc(branchName(br))}</span>${hereTotal ? `<span class="pill pill-ok">${hereTotal} قطعة</span>` : '<span class="pill pill-no">ما كاينش هنا</span>'}</div>
          ${here.length ? `<div class="sc-sizes">${here.map((r) => `<span class="sc-size"><b>${esc(r.size || '—')}</b>${r.color ? `<i>${esc(r.color)}</i>` : ''}<em>${r.qty}</em></span>`).join('')}</div>` : ''}
          ${others.length ? `<div class="muted sc-others">ففروع أخرى: ${others.map((x) => esc(x.b.name) + ' <b>' + x.n + '</b>').join(' · ')}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="actions" style="margin-top:14px"><a class="btn btn-main" href="#/p/${p.id}" data-open>فتح صفحة المنتوج</a><button class="btn" data-again>سكان آخر</button></div>`, () => { scanCard = null; });
  scanCard = m;
  m.el.querySelector('.sheet').classList.add('sheet-scan');
  const close = () => { m.close(); scanCard = null; };
  $('[data-x]', m.el).onclick = close;
  $('[data-open]', m.el).onclick = close;
  $('[data-again]', m.el).onclick = () => { close(); const q = $('#q'); if (q) { q.value = ''; q.focus(); } };
  $$('.sc-thumbs button', m.el).forEach((b) => b.onclick = () => { $('#scMain', m.el).src = b.dataset.src; $$('.sc-thumbs button', m.el).forEach((x) => x.classList.toggle('on', x === b)); });
}

// مسدس الـPOS كيكتب الكود بسرعة كبيرة بحال الكلافيي ومن بعد Enter
(function posScanner() {
  let buf = '', last = 0;
  document.addEventListener('keydown', (e) => {
    const now = performance.now();
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) { buf = now - last < 50 ? buf + e.key : e.key; last = now; return; }
    if (e.key === 'Enter' && buf.length >= 3 && now - last < 80) {
      const code = buf; buf = '';
      const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
      if (!typing || t.id === 'q') { e.preventDefault(); if (t && t.id === 'q') t.value = ''; S.q = ''; handleCode(code); }
    }
  }, true);
})();

// ---------- البحث بالصورة ----------
function openPhotoSearch() {
  const indexed = S.products.filter((p) => +p.indexed > 0);
  const m = modal(`<div class="sheet-head"><h3>البحث بالصورة</h3><button class="close" data-x>×</button></div>
    <p class="muted" style="margin:0 0 12px">صوّر القطعة (فاليد، على العنق، ولا كاملة). المطابقة بالشكل ماشي باللون.</p>
    <label class="check" style="margin-bottom:12px"><input type="checkbox" id="onlyCat" checked> غير فـ«${esc(catName(S.cat))}»</label>
    <input type="file" accept="image/*" id="pf" hidden>
    <button class="btn btn-main" id="pick" style="width:100%">${ICON.camera} صوّر ولا اختار صورة</button>
    <div id="pout"></div>`);
  $('[data-x]', m.el).onclick = () => m.close();
  $('#pick', m.el).onclick = () => $('#pf', m.el).click();
  if (!indexed.length) $('#pout', m.el).innerHTML = '<div class="status bad">ما كاين حتى منتوج عندو صور مسجّلة مازال. زيد الصور للمنتوجات أولاً.</div>';
  $('#pf', m.el).onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const out = $('#pout', m.el), blob = await shrink(file, 1024);
    out.innerHTML = `<img class="preview" src="${URL.createObjectURL(blob)}" alt=""><div class="status" id="pst">جاري التحليل…<div class="bar"><i id="pbar"></i></div></div>`;
    try {
      const emb = await embed(blob, (r) => { $('#pst', m.el).firstChild.textContent = 'كنحمّل نموذج الذكاء الاصطناعي (مرة وحدة فهاد الجهاز)… ' + Math.round(r * 100) + '%'; $('#pbar', m.el).style.width = Math.round(r * 100) + '%'; });
      const j = await api('search_image', { embedding: emb, model: MODEL_TAG, category_id: $('#onlyCat', m.el).checked ? S.cat : 0, limit: 6 });
      showMatches(m, out, j, blob);
    } catch (err) { $('#pst', m.el).className = 'status bad'; $('#pst', m.el).textContent = err.message || 'وقع مشكل فالتحليل.'; }
    e.target.value = '';
  };
}

function showMatches(m, out, j, blob) {
  const byId = (id) => S.products.find((p) => +p.id === +id);
  const good = j.matches.filter((x) => x.score >= j.threshold);
  const row = (x, dim) => { const p = byId(x.product_id); return p ? itemHtml(p, `<div class="score">التشابه: ${Math.round(x.score * 100)}% · ${KIND[x.kind] || ''}</div>`).replace('class="card item"', `class="card item"${dim ? ' style="opacity:.6"' : ''}`) : ''; };
  if (good.length) {
    out.innerHTML = `<div class="status ok">لقيت ${good.length === 1 ? 'القطعة' : good.length + ' قطع شبيهة'}:</div><div class="list">${good.map((x) => row(x)).join('')}</div>`;
  } else {
    out.innerHTML = `<div class="status bad"><b>هاد المنتوج ما كاينش فالقاعدة.</b></div>
      <div class="actions"><button class="btn" id="near">ورّيني الأقرب</button><a class="btn" id="addThis" href="#/add?cat=${S.cat}">${ICON.plus} زيد هاد المنتوج</a></div><div class="list" id="nearList" style="margin-top:10px"></div>`;
    const n = $('#near', out); if (n) n.onclick = () => { $('#nearList', out).innerHTML = j.matches.slice(0, 3).map((x) => row(x, true)).join('') || '<div class="muted">ما كاين والو.</div>'; n.remove(); };
    $('#addThis', out).onclick = () => { S.pendingPhoto = blob; };
  }
  $$('a.item', out).forEach((a) => a.addEventListener('click', () => m.close()));
  $$('#addThis', out).forEach((a) => a.addEventListener('click', () => m.close()));
}

// ==========================================================================
// 2) صفحة المنتوج + المخزون
// ==========================================================================
async function viewProduct(id) {
  app.innerHTML = '<div class="empty">جاري التحميل…</div>';
  let p; try { p = await api('product&id=' + id); } catch (e) { app.innerHTML = `<div class="card empty"><b>${esc(e.message)}</b></div>`; return; }
  const sizes = list(p.sizes).length ? list(p.sizes) : [''];
  const colors = list(p.colors).length ? list(p.colors) : [''];
  const br = +S.settings.current_branch;
  const qty = (b, s, c) => (p.stock.find((r) => r.branch_id === b && r.size === s && r.color === c) || {}).qty || 0;
  const others = S.branches.filter((b) => +b.id !== br).map((b) => ({ b, n: p.stock.filter((r) => r.branch_id === +b.id).reduce((t, r) => t + r.qty, 0) })).filter((x) => x.n);
  app.innerHTML = `
    <a class="back" href="#/c/${p.category_id || S.cat}">${ICON.back} رجوع</a>
    <div class="card p-head"><div class="muted">${esc(catName(p.category_id))}</div><h1>${esc(p.name)}</h1>
      <div><span class="code">${esc(p.code)}</span> · <span class="price">${money(p.price)}</span></div></div>
    ${p.images.length ? `<div class="gallery">${p.images.map((i) => `<div class="shot"><img src="${esc(i.path)}" alt="" loading="lazy"><span class="tag">${KIND[i.kind] || ''}</span></div>`).join('')}</div>`
      : `<div class="card empty" style="margin-bottom:12px">ما كاين حتى صورة — <a href="#/edit/${p.id}">زيد الصور</a> باش يتلقى بالبحث بالصورة.</div>`}
    <dl class="card kv">
      <dt>الثوب</dt><dd>${esc(p.fabric || '—')}</dd>
      <dt>المقاسات</dt><dd>${esc(list(p.sizes).join('، ') || '—')}</dd>
      <dt>الألوان</dt><dd>${esc(list(p.colors).join('، ') || '—')}</dd>
      ${p.note ? `<dt>ملاحظة</dt><dd>${esc(p.note)}</dd>` : ''}
    </dl>
    <div class="card section">
      <div class="h2">المخزون — ${esc(branchName(br))}</div>
      ${br ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${colors[0] ? 'اللون' : ''}</th>${sizes.map((s) => `<th>${esc(s || 'الكمية')}</th>`).join('')}<th>المجموع</th></tr></thead><tbody>
        ${colors.map((c) => `<tr><td>${esc(c || '—')}</td>${sizes.map((s) => `<td><input class="input" type="number" min="0" inputmode="numeric" data-s="${esc(s)}" data-c="${esc(c)}" value="${qty(br, s, c) || ''}" placeholder="0"></td>`).join('')}<td class="rt"></td></tr>`).join('')}
        </tbody></table></div>
        <div class="actions" style="margin-top:10px"><button class="btn btn-main" id="saveStock">حفظ المخزون</button></div>`
      : '<div class="muted">اختار الفرع ديال هاد الحاسوب من الفوق (ولا زيدو فـ«المعطيات ← الفروع»).</div>'}
      ${others.length ? `<div style="margin-top:12px" class="muted">ففروع أخرى: ${others.map((x) => esc(x.b.name) + ': <b>' + x.n + '</b>').join(' · ')}</div>` : ''}
    </div>
    <div class="card section">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;margin-bottom:10px">
        <div class="h2" style="margin:0">الملصق</div>
        <div class="seg" role="group" aria-label="نوع الكود"><button type="button" data-lt="barcode">باركود</button><button type="button" data-lt="qr">QR</button></div>
      </div>
      <div class="lbl-opts">
        <span class="label" style="margin:0">شنو يبان فالملصق:</span>
        <div class="chips" id="lblChips">${LABEL_FIELDS.map((f) => `<button type="button" class="chip" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>
        <div class="row" style="flex-wrap:wrap">
          <input class="input" id="lblExtra" maxlength="80" placeholder="كتابة إضافية (اختياري) — مثلاً: تخفيض 10%" style="flex:1 1 220px">
          <button type="button" class="btn btn-sm" id="lblOnly">غير الباركود</button>
          <button type="button" class="btn btn-sm" id="lblAll">كلشي</button>
        </div>
      </div>
      <div class="tag-label" id="qrLabel">
        <div class="tl-code" id="tlCode"></div>
        <div class="tl-info" id="tlInfo"></div>
      </div>
      <div class="muted" id="tlNote" style="font-size:13px;margin-top:6px"></div>
      <button class="btn btn-sm" id="printQr" style="margin-top:10px">طباعة الملصق</button>
    </div>
    <div class="actions" style="margin-top:12px"><a class="btn" href="#/edit/${p.id}">تعديل</a><button class="btn btn-bad" id="delP">حذف المنتوج</button></div>`;

  const sumRows = () => $$('.tbl tbody tr').forEach((tr) => { tr.querySelector('.rt').textContent = $$('input', tr).reduce((t, i) => t + (+i.value || 0), 0); });
  sumRows(); $$('.tbl input').forEach((i) => i.oninput = sumRows);
  const ss = $('#saveStock'); if (ss) ss.onclick = async () => {
    const rows = $$('.tbl input').map((i) => ({ size: i.dataset.s, color: i.dataset.c, qty: +i.value || 0 }));
    if (rows.some((r) => r.qty < 0)) { toast('الكمية ما تقدرش تكون ناقص', true); return; }
    ss.disabled = true;
    try { await api('stock_save', { product_id: p.id, branch_id: br, rows }); await loadAll(); toast('تم حفظ المخزون ✓'); }
    catch (e) { toast(e.message, true); } finally { ss.disabled = false; }
  };
  $('#delP').onclick = async () => {
    if (!(await confirmBox('واش بغيتي تحذف «' + p.name + '» (' + p.code + ') مع الصور والمخزون ديالو؟', 'حذف'))) return;
    try { await api('product_delete', { id: p.id }); await loadAll(); toast('تم الحذف'); location.hash = '#/c/' + (p.category_id || S.cat); }
    catch (e) { toast(e.message, true); }
  };
  // --- الملصق: المستعمل كيختار شنو يبان (ولا غير الباركود بوحدو) ---
  const O = labelOpts();
  let type = S.settings.label_type === 'qr' ? 'qr' : 'barcode', saveT;
  const saveOpts = () => { S.settings.label_opts = Object.assign({}, O); clearTimeout(saveT);
    saveT = setTimeout(() => api('setting_set', { k: 'label_opts', v: O }).catch(() => {}), 500); };
  const drawInfo = () => {
    $$('#lblChips .chip').forEach((b) => b.classList.toggle('on', !!O[b.dataset.f]));
    const meta = [O.meta ? catName(p.category_id) : '', O.meta ? p.fabric : ''].filter(Boolean).join(' · ');
    const rows = [O.name ? `<div class="tl-name">${esc(p.name)}</div>` : '', meta ? `<div class="tl-meta">${esc(meta)}</div>` : '',
      O.sizes && list(p.sizes).length ? `<div class="tl-meta">المقاسات: ${esc(list(p.sizes).join(' · '))}</div>` : '',
      O.colors && list(p.colors).length ? `<div class="tl-meta">الألوان: ${esc(list(p.colors).join(' · '))}</div>` : '',
      O.extra ? `<div class="tl-extra">${esc(O.extra)}</div>` : '',
      O.price && p.price != null ? `<div class="tl-price">${money(p.price)}</div>` : ''].join('');
    $('#tlInfo').innerHTML = rows; $('#tlInfo').hidden = !rows;
    $('#qrLabel').classList.toggle('tl-only', !rows);
  };
  const drawCode = async () => {
    $$('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.lt === type));
    const box = $('#tlCode'), note = $('#tlNote'); note.textContent = '';
    // الباركود Code 128 كيقبل غير الحروف اللاتينية والأرقام؛ إلا كان فالكود شي حرف آخر كنستعملو QR
    if (type === 'barcode' && /^[\x20-\x7E]+$/.test(p.code)) {
      const svg = await makeBarcode(p.code, O.code);
      if (svg) { box.className = 'tl-code tl-bar'; box.innerHTML = ''; box.appendChild(svg); return; }
    } else if (type === 'barcode') note.textContent = 'الكود فيه حروف ما كيقبلهاش الباركود، فاستعملت QR.';
    const src = await makeQr(p.code);
    box.className = 'tl-code tl-qr'; box.innerHTML = src ? `<img src="${src}" alt="QR">${O.code ? `<div class="code tl-qrtext">${esc(p.code)}</div>` : ''}` : '';
  };
  $$('.seg button').forEach((b) => b.onclick = async () => {
    type = b.dataset.lt; S.settings.label_type = type; drawCode();
    try { await api('setting_set', { k: 'label_type', v: type }); } catch (e) {}
  });
  $$('#lblChips .chip').forEach((b) => b.onclick = () => { O[b.dataset.f] = !O[b.dataset.f]; drawInfo(); if (b.dataset.f === 'code') drawCode(); saveOpts(); });
  $('#lblExtra').value = O.extra || '';
  $('#lblExtra').oninput = (e) => { O.extra = e.target.value.slice(0, 80); drawInfo(); saveOpts(); };
  const setAll = (on) => { LABEL_FIELDS.forEach((f) => { O[f[0]] = on; }); if (!on) { O.extra = ''; $('#lblExtra').value = ''; } drawInfo(); drawCode(); saveOpts(); };
  $('#lblOnly').onclick = () => setAll(false);
  $('#lblAll').onclick = () => setAll(true);
  drawInfo(); drawCode();
  $('#printQr').onclick = () => { const l = $('#qrLabel'); l.classList.add('print-me'); window.print(); setTimeout(() => l.classList.remove('print-me'), 500); };
}

// شنو يبان فالملصق — بشكل عادي كلشي ظاهر؛ المستعمل كيبدّل كيف بغا
const LABEL_FIELDS = [['code', 'الكود تحت الباركود'], ['name', 'السمية'], ['meta', 'الصنف والثوب'], ['sizes', 'المقاسات'], ['colors', 'الألوان'], ['price', 'الثمن']];
function labelOpts() {
  const saved = S.settings.label_opts || {}, o = {};
  LABEL_FIELDS.forEach((f) => { o[f[0]] = saved[f[0]] === undefined ? true : !!saved[f[0]]; });
  o.extra = typeof saved.extra === 'string' ? saved.extra : '';
  return o;
}

async function makeBarcode(text, showText = true) {
  try {
    if (!window.JsBarcode) await loadScript('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    window.JsBarcode(svg, String(text), { format: 'CODE128', height: 64, width: 2, margin: 0, fontSize: 16, font: 'Consolas, monospace', textMargin: 4, displayValue: showText });
    return svg;
  } catch (e) { return null; }
}

async function makeQr(text) {
  try {
    if (!window.qrcode) await loadScript('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js');
    const q = window.qrcode(0, 'M'); q.addData(String(text)); q.make();
    return q.createDataURL(6, 2);
  } catch (e) { return null; }
}

// ==========================================================================
// 3) إضافة / تعديل منتوج (بالصور بالترتيب)
// ==========================================================================
async function viewForm(id, params) {
  let p = { id: 0, category_id: +(params.get('cat') || S.cat), code: params.get('code') || '', name: '', fabric: '', price: '', sizes: '', colors: '', note: '', images: [] };
  if (id) { try { p = await api('product&id=' + id); } catch (e) { app.innerHTML = `<div class="card empty"><b>${esc(e.message)}</b></div>`; return; } }
  const F = { sizes: list(p.sizes), colors: list(p.colors) };
  const queue = [];                // صور منتوج جديد كتتسجّل من بعد الحفظ
  if (!id && S.pendingPhoto) { queue.push({ kind: 'full', blob: S.pendingPhoto }); S.pendingPhoto = null; }
  const names = [...new Set(S.products.map((x) => x.name))];

  app.innerHTML = `
    <a class="back" href="${id ? '#/p/' + id : '#/c/' + S.cat}">${ICON.back} رجوع</a>
    <div class="card form">
      <div class="h2" style="margin:0">${id ? 'تعديل المنتوج' : 'منتوج جديد'}</div>
      <div class="grid2">
        <div><label class="label">الصنف</label><select class="input" id="fCat">${S.cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
        <div><label class="label">الكود *</label><input class="input code" id="fCode" dir="ltr" autocomplete="off" value="${esc(p.code)}" placeholder="256KT"><div class="err" id="eCode"></div></div>
        <div><label class="label">الاسم *</label><input class="input" id="fName" list="dlNames" autocomplete="off" value="${esc(p.name)}" placeholder="مثال: نرفين"><div class="err" id="eName"></div></div>
        <div><label class="label">الثوب</label><input class="input" id="fFab" list="dlFab" autocomplete="off" value="${esc(p.fabric)}" placeholder="اكتب: مك ← مكرش"></div>
        <div><label class="label">الثمن (DH)</label><input class="input" id="fPrice" dir="ltr" inputmode="decimal" value="${p.price == null ? '' : esc(p.price)}" placeholder="0"><div class="err" id="ePrice"></div></div>
        <div><label class="label">ملاحظة</label><input class="input" id="fNote" value="${esc(p.note || '')}" placeholder="اختياري"></div>
      </div>
      <datalist id="dlNames">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <datalist id="dlFab">${S.fabrics.map((f) => `<option value="${esc(f.name)}">`).join('')}</datalist>
      <div><label class="label">المقاسات</label><div class="chips" id="sizes"></div>
        <div class="row" style="margin-top:8px"><input class="input" id="newSize" placeholder="مقاس آخر" style="max-width:180px"><button class="btn btn-sm" id="addSize">${ICON.plus}</button></div></div>
      <div><label class="label">الألوان</label><div class="chips" id="colors"></div>
        <div class="row" style="margin-top:8px"><input class="input" id="newColor" placeholder="مثال: أسود" style="max-width:180px"><button class="btn btn-sm" id="addColor">${ICON.plus}</button></div></div>
      <div><label class="label">الصور — بهاد الترتيب باش البحث بالصورة يكون دقيق</label><div class="slots" id="slots"></div></div>
      <div class="actions"><button class="btn btn-main" id="save" style="min-width:140px">حفظ</button><a class="btn" href="${id ? '#/p/' + id : '#/c/' + S.cat}">إلغاء</a></div>
    </div>`;
  $('#fCat').value = String(p.category_id || S.cat);

  const drawSizes = () => {
    const all = [...new Set([...S.sizes.map((s) => s.name), ...F.sizes])];
    $('#sizes').innerHTML = all.map((s) => `<button type="button" class="chip${F.sizes.includes(s) ? ' on' : ''}" data-s="${esc(s)}">${esc(s)}</button>`).join('');
    $$('#sizes .chip').forEach((b) => b.onclick = () => { const s = b.dataset.s; F.sizes = F.sizes.includes(s) ? F.sizes.filter((x) => x !== s) : [...F.sizes, s]; drawSizes(); });
  };
  const drawColors = () => {
    $('#colors').innerHTML = F.colors.map((c) => `<span class="chip-x">${esc(c)}<button type="button" data-c="${esc(c)}" aria-label="حيّد">×</button></span>`).join('') || '<span class="muted">بلا ألوان (اختياري)</span>';
    $$('#colors button').forEach((b) => b.onclick = () => { F.colors = F.colors.filter((x) => x !== b.dataset.c); drawColors(); });
  };
  const addFrom = (inp, arr, draw) => { const v = $(inp).value.trim(); if (v && !F[arr].includes(v)) F[arr].push(v); $(inp).value = ''; draw(); };
  $('#addSize').onclick = () => addFrom('#newSize', 'sizes', drawSizes);
  $('#addColor').onclick = () => addFrom('#newColor', 'colors', drawColors);
  $('#newSize').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addFrom('#newSize', 'sizes', drawSizes); } };
  $('#newColor').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addFrom('#newColor', 'colors', drawColors); } };
  drawSizes(); drawColors();

  // --- الصور: 1 كامل ← 2 العنق ← 3 فاليد ← صور أخرى ---
  const images = id ? p.images.slice() : [];
  const drawSlots = () => {
    const box = $('#slots'); const used = new Set();
    const slotFor = (kind, n, title, hint) => {
      const img = images.find((i) => i.kind === kind && !used.has(i)) || null; if (img) used.add(img);
      const q = queue.find((x) => x.kind === kind && !used.has(x)) || null; if (q) used.add(q);
      if (img || q) return `<div class="slot filled"><img src="${img ? esc(img.path) : URL.createObjectURL(q.blob)}" alt=""><span class="tag">${n ? n + '. ' : ''}${esc(title)}</span>
        <button type="button" class="del" ${img ? `data-img="${img.id}"` : `data-q="${queue.indexOf(q)}"`} aria-label="حذف">×</button>${q && q.busy ? `<div class="busy">${esc(q.busy)}</div>` : ''}</div>`;
      return `<div class="slot" data-kind="${kind}"><span class="n">${n || '+'}</span><span class="t">${esc(title)}</span><span class="s">${esc(hint)}</span></div>`;
    };
    let html = slotFor('full', 1, KIND.full, 'القطعة كاملة') + slotFor('neck', 2, KIND.neck, 'من جهة العنق') + slotFor('hand', 3, KIND.hand, 'فاليد ولا تفصيلة');
    images.filter((i) => !used.has(i)).concat(queue.filter((x) => !used.has(x))).forEach((x) => {
      const isImg = 'path' in x;
      html += `<div class="slot filled"><img src="${isImg ? esc(x.path) : URL.createObjectURL(x.blob)}" alt=""><span class="tag">${esc(KIND[x.kind] || KIND.other)}</span>
        <button type="button" class="del" ${isImg ? `data-img="${x.id}"` : `data-q="${queue.indexOf(x)}"`} aria-label="حذف">×</button>${!isImg && x.busy ? `<div class="busy">${esc(x.busy)}</div>` : ''}</div>`;
    });
    html += `<div class="slot" data-kind="other"><span class="n">+</span><span class="t">صورة أخرى</span><span class="s">اختياري</span></div>`;
    box.innerHTML = html;
    $$('.slot[data-kind]', box).forEach((s) => s.onclick = () => pickImage(s.dataset.kind));
    $$('.del[data-q]', box).forEach((b) => b.onclick = (e) => { e.stopPropagation(); queue.splice(+b.dataset.q, 1); drawSlots(); });
    $$('.del[data-img]', box).forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      if (!(await confirmBox('نحذف هاد الصورة؟', 'حذف'))) return;
      try { await api('image_delete', { id: +b.dataset.img }); images.splice(images.findIndex((i) => +i.id === +b.dataset.img), 1); drawSlots(); }
      catch (err) { toast(err.message, true); }
    });
  };
  const pickImage = (kind) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return;
      const blob = await shrink(file);
      if (!id) { queue.push({ kind, blob }); drawSlots(); return; }
      const item = { kind, blob, busy: 'جاري الحفظ…' }; queue.push(item); drawSlots();
      try { const r = await uploadImage(id, kind, blob, (t) => { item.busy = t; drawSlots(); }); images.push({ id: r.id, kind, path: r.path, indexed: r.indexed }); }
      catch (err) { toast(err.message, true); }
      queue.splice(queue.indexOf(item), 1); drawSlots();
    };
    inp.click();
  };
  drawSlots();

  // --- التحقق + الحفظ (بلا ضغط مزدوج) ---
  const errs = () => {
    const code = $('#fCode').value.trim(), name = $('#fName').value.trim(), price = $('#fPrice').value.trim().replace(',', '.');
    const dup = code && S.products.find((x) => norm(x.code) === norm(code) && +x.id !== +id);
    const e = { code: !code ? 'الكود ضروري.' : dup ? 'هاد الكود كاين ديجا عند «' + dup.name + '».' : '', name: !name ? 'الاسم ضروري.' : '',
      price: price && isNaN(+price.replace(/dh/i, '')) ? 'الثمن خاصو يكون رقم.' : '' };
    $('#eCode').textContent = e.code; $('#fCode').setAttribute('aria-invalid', e.code ? 'true' : 'false');
    $('#eName').textContent = e.name; $('#fName').setAttribute('aria-invalid', e.name ? 'true' : 'false');
    $('#ePrice').textContent = e.price; $('#fPrice').setAttribute('aria-invalid', e.price ? 'true' : 'false');
    return e.code || e.name || e.price;
  };
  $('#fCode').onblur = errs;
  // سمية معروفة ← كنعمّرو الثوب أوتوماتيكياً (إلا كان خاوي)
  $('#fName').onchange = () => { const k = S.products.find((x) => x.name === $('#fName').value.trim()); if (k && !$('#fFab').value) $('#fFab').value = k.fabric || ''; };
  const save = $('#save');
  save.onclick = async () => {
    if (save.disabled) return;
    if (errs()) { toast('صحّح الخانات اللي باينين بالأحمر', true); return; }
    save.disabled = true; save.textContent = 'جاري الحفظ…';
    try {
      const r = await api('product_save', { id: +id || 0, category_id: +$('#fCat').value, code: $('#fCode').value, name: $('#fName').value,
        fabric: $('#fFab').value, price: $('#fPrice').value, sizes: F.sizes, colors: F.colors, note: $('#fNote').value });
      for (let i = 0; i < queue.length; i++) {
        const q = queue[i]; q.busy = 'صورة ' + (i + 1) + '/' + queue.length + '…'; drawSlots();
        try { await uploadImage(r.id, q.kind, q.blob, (t) => { q.busy = t; drawSlots(); }); } catch (err) { toast(err.message, true); }
      }
      await loadAll();
      toast(id ? 'تم حفظ التعديلات ✓' : 'تمت إضافة المنتوج ✓');
      location.hash = '#/p/' + r.id;
    } catch (e) { toast(e.message, true); save.disabled = false; save.textContent = 'حفظ'; }
  };
}

// الصورة كتتصيفط مع البصمة ديالها. إلا فشل الذكاء الاصطناعي (مثلاً بلا إنترنت) الصورة كتتسجّل وتتحسب البصمة من بعد.
async function uploadImage(pid, kind, blob, onBusy) {
  let emb = null;
  try { emb = await embed(blob, (r) => onBusy && onBusy('كنحمّل النموذج… ' + Math.round(r * 100) + '%')); }
  catch (e) { toast('الصورة تسجّلات بلا بصمة (ما تحمّلش النموذج). عاود من «المعطيات ← الإعدادات».', true); }
  onBusy && onBusy('جاري الحفظ…');
  const fd = new FormData(); fd.append('product_id', pid); fd.append('kind', kind); fd.append('image', blob, 'photo.jpg');
  if (emb) { fd.append('embedding', emb); fd.append('model', MODEL_TAG); }
  return api('image_add', fd, true);
}

// ==========================================================================
// 4) المعطيات: الثوب، الأكواد، المقاسات، الفروع، الأصناف، الإعدادات
// ==========================================================================
const DATA_TABS = [['fabrics', 'الثوب'], ['codes', 'الأكواد'], ['sizes', 'المقاسات'], ['branches', 'الفروع'], ['categories', 'الأصناف'], ['settings', 'الإعدادات']];
function viewData(tab) {
  if (!DATA_TABS.some((t) => t[0] === tab)) tab = 'fabrics';
  const head = `<div class="h2">المعطيات</div><div class="tabs">${DATA_TABS.map((t) => `<a class="tab${t[0] === tab ? ' on' : ''}" href="#/data/${t[0]}">${t[1]}</a>`).join('')}</div>`;
  if (tab === 'codes') return viewCodes(head);
  if (tab === 'settings') return viewSettings(head);
  const rows = S[tab] || [];
  const used = (r) => tab === 'fabrics' ? S.products.filter((p) => p.fabric === r.name).length
    : tab === 'categories' ? S.products.filter((p) => +p.category_id === +r.id).length
    : tab === 'sizes' ? S.products.filter((p) => list(p.sizes).includes(r.name)).length : null;
  const label = { fabrics: 'الثوب', sizes: 'المقاس', branches: 'الفرع', categories: 'الصنف' }[tab];
  app.innerHTML = head + `
    <div class="addrow"><input class="input" id="nw" placeholder="${label} جديد…" style="max-width:340px"><button class="btn btn-main" id="add">${ICON.plus} زيد</button></div>
    <div class="dtable"><table><thead><tr><th>${label}</th>${tab !== 'branches' ? '<th style="width:120px">المنتوجات</th>' : ''}<th style="width:44px"></th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td><input class="input" data-id="${r.id}" value="${esc(r.name)}"></td>${tab !== 'branches' ? `<td class="muted">${used(r) ?? ''}</td>` : ''}<td><button class="x" data-del="${r.id}" aria-label="حذف">×</button></td></tr>`).join('')}
    </tbody></table>${rows.length ? '' : '<div class="empty">ما كاين والو مازال.</div>'}</div>`;
  const add = async () => {
    const name = $('#nw').value.trim(); if (!name) { toast('اكتب السمية أولاً', true); return; }
    try { await api('list_add', { type: tab, name }); await loadAll(); viewData(tab); toast('تمت الإضافة ✓'); $('#nw').focus(); } catch (e) { toast(e.message, true); }
  };
  $('#add').onclick = add; $('#nw').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
  $$('.dtable input[data-id]').forEach((i) => i.onchange = async () => {
    try { await api('list_rename', { type: tab, id: +i.dataset.id, name: i.value }); await loadAll(); toast('تم الحفظ ✓'); } catch (e) { toast(e.message, true); viewData(tab); }
  });
  $$('.dtable [data-del]').forEach((b) => b.onclick = async () => {
    const r = rows.find((x) => +x.id === +b.dataset.del);
    const warn = tab === 'branches' ? ' (المخزون ديال هاد الفرع غادي يتمسح)' : '';
    if (!(await confirmBox('نحذف «' + r.name + '»' + warn + '؟', 'حذف'))) return;
    try { await api('list_delete', { type: tab, id: r.id }); await loadAll(); viewData(tab); toast('تم الحذف'); } catch (e) { toast(e.message, true); }
  });
}

function viewCodes(head) {
  app.innerHTML = head + `<div class="addrow"><input class="input" id="cq" placeholder="قلّب فالأكواد…" style="max-width:340px" autocomplete="off"></div>
    <div class="dtable"><table><thead><tr><th>الكود</th><th>الاسم</th><th>الصنف</th><th>الثوب</th><th>الثمن</th></tr></thead><tbody id="ct"></tbody></table></div>`;
  const draw = () => {
    const q = norm($('#cq').value);
    $('#ct').innerHTML = S.products.filter((p) => !q || norm(p.code + ' ' + p.name).includes(q))
      .map((p) => `<tr style="cursor:pointer" data-id="${p.id}"><td class="code" style="padding:9px 12px">${esc(p.code)}</td><td>${esc(p.name)}</td><td>${esc(catName(p.category_id))}</td><td>${esc(p.fabric)}</td><td class="price">${money(p.price)}</td></tr>`).join('');
    $$('#ct tr').forEach((tr) => tr.onclick = () => { location.hash = '#/p/' + tr.dataset.id; });
  };
  $('#cq').oninput = draw; draw();
}

async function viewSettings(head) {
  const thr = S.settings.match_threshold || 0.86;
  const missing = S.products.reduce((t, p) => t + (+p.images - +p.indexed), 0);
  app.innerHTML = head + `
    <div class="card section"><div class="h2">الفرع ديال هاد الحاسوب</div>
      <select class="input" id="sBr" style="max-width:340px">${S.branches.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select>
      <p class="muted" style="margin:8px 0 0">المخزون اللي كيتبدّل فهاد الجهاز كيتسجّل لهاد الفرع.</p></div>
    <div class="card section"><div class="h2">دقة البحث بالصورة</div>
      <input type="range" id="sThr" min="0.70" max="0.97" step="0.01" value="${thr}" style="width:100%;max-width:420px">
      <div><b id="sThrV">${Math.round(thr * 100)}%</b> <span class="muted">— كلما طلعات، النظام كيولّي أصعب وكيقول «ما كاينش» بسهولة. إلا كان كيطلّع قطع غالطين طلّعها، وإلا ما كيلقاش قطع كاينين نقّصها.</span></div>
      <button class="btn" id="sThrSave" style="margin-top:10px">حفظ</button></div>
    <div class="card section"><div class="h2">بصمات الصور</div>
      <p class="muted" style="margin:0 0 10px">${missing ? missing + ' صورة بلا بصمة (ما كتبانش فالبحث بالصورة).' : 'كل الصور عندها بصمة ✓'}</p>
      <button class="btn" id="reindex"${missing ? '' : ' disabled'}>حساب البصمات الناقصة</button><div id="riSt"></div></div>`;
  $('#sBr').value = String(S.settings.current_branch || '');
  $('#sBr').onchange = async (e) => { try { await api('setting_set', { k: 'current_branch', v: +e.target.value }); await loadAll(); toast('تم ✓'); } catch (err) { toast(err.message, true); } };
  $('#sThr').oninput = (e) => { $('#sThrV').textContent = Math.round(e.target.value * 100) + '%'; };
  $('#sThrSave').onclick = async () => { try { await api('setting_set', { k: 'match_threshold', v: +$('#sThr').value }); await loadAll(); toast('تم الحفظ ✓'); } catch (e) { toast(e.message, true); } };
  $('#reindex').onclick = async (ev) => {
    ev.target.disabled = true; const st = $('#riSt');
    let done = 0;
    for (const p of S.products.filter((x) => +x.images > +x.indexed)) {
      const full = await api('product&id=' + p.id);
      for (const img of full.images.filter((i) => !+i.indexed)) {
        try {
          st.innerHTML = `<div class="status">صورة ${done + 1}/${missing}…</div>`;
          const blob = await (await fetch(img.path)).blob();
          const emb = await embed(blob, (r) => { st.innerHTML = `<div class="status">كنحمّل النموذج… ${Math.round(r * 100)}%</div>`; });
          await api('image_embedding', { id: img.id, embedding: emb, model: MODEL_TAG }); done++;
        } catch (e) { st.innerHTML = `<div class="status bad">${esc(e.message || 'وقع مشكل')}</div>`; ev.target.disabled = false; return; }
      }
    }
    await loadAll(); viewData('settings'); toast('تم حساب ' + done + ' بصمة ✓');
  };
}

// ==========================================================================
// التنقّل
// ==========================================================================
function route() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?'); const params = new URLSearchParams(qs || '');
  const parts = path.split('/').filter(Boolean);
  const tab = parts[0] === 'add' ? 'add' : parts[0] === 'data' ? 'data' : 'search';
  $$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  window.scrollTo(0, 0);
  if (parts[0] === 'p') return viewProduct(+parts[1]);
  if (parts[0] === 'add') return viewForm(0, params);
  if (parts[0] === 'edit') return viewForm(+parts[1], params);
  if (parts[0] === 'data') return viewData(parts[1]);
  if (parts[0] === 'c' && +parts[1]) { S.cat = +parts[1]; localStorage.setItem('mg.cat', S.cat); }
  viewSearch();
}
window.addEventListener('hashchange', route);
$('#navSearch').addEventListener('click', (e) => { e.preventDefault(); location.hash = '#/c/' + S.cat; });

(async function start() {
  try { await loadAll(); route(); }
  catch (e) { app.innerHTML = `<div class="card empty"><b>${esc(e.message)}</b>شغّل Apache و MySQL فـXAMPP ومن بعد حدّث الصفحة.</div>`; }
})();
