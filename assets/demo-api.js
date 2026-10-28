// ==========================================================================
// النسخة التجريبية: كتقلّد api.php داخل المتصفح (نفس الطلبات ونفس الأجوبة).
// النظام الحقيقي كيخدم بـPHP + MySQL — شوف «كود السيرفر» فالفوق.
// البيانات كتبقى غير فهاد المتصفح (localStorage).
// ==========================================================================
(function () {
  'use strict';
  var KEY = 'mg.demo.v1';
  var SEED = {"categories":[{"id":1,"name":"العبايات","sort":0},{"id":2,"name":"الخمارات","sort":1},{"id":3,"name":"النقابات","sort":2},{"id":4,"name":"السبنية","sort":3}],"fabrics":[{"id":26,"name":"أسود"},{"id":8,"name":"الزوم"},{"id":10,"name":"الليزر"},{"id":5,"name":"النجم رويال"},{"id":17,"name":"النجم مزوق"},{"id":11,"name":"الوسام"},{"id":28,"name":"برادا"},{"id":16,"name":"تويد"},{"id":4,"name":"روزا"},{"id":23,"name":"ريحانة"},{"id":27,"name":"سلطانة"},{"id":1,"name":"طرحة"},{"id":12,"name":"طرحة أصلي"},{"id":2,"name":"طرحة أصيلي"},{"id":13,"name":"طرحة جديد"},{"id":9,"name":"قاطيفة"},{"id":14,"name":"قطيفة"},{"id":15,"name":"كريب زارا"},{"id":3,"name":"كريب طرحة"},{"id":20,"name":"لولان"},{"id":22,"name":"لولان 22"},{"id":24,"name":"لولان ريي"},{"id":21,"name":"لولان سكريش"},{"id":18,"name":"لولان صلب"},{"id":6,"name":"مكرش"},{"id":19,"name":"مكرش+روزا"},{"id":25,"name":"نوارا"},{"id":7,"name":"ويسام"}],"sizes":[{"id":1,"name":"S","sort":0},{"id":2,"name":"M","sort":1},{"id":3,"name":"L","sort":2},{"id":4,"name":"XL","sort":3},{"id":5,"name":"XXL","sort":4},{"id":6,"name":"1","sort":5},{"id":7,"name":"2","sort":6},{"id":8,"name":"3","sort":7}],"branches":[{"id":1,"name":"الفرع 1"},{"id":2,"name":"الفرع 2"},{"id":3,"name":"الفرع 3"},{"id":4,"name":"الفرع 4"},{"id":5,"name":"الفرع 5"},{"id":6,"name":"الفرع 6"}],"products":[{"id":1,"category_id":1,"code":"256KT","name":"نرفين","fabric":"قطيفة","price":200,"colors":"","sizes":"M,L,XL","note":""},{"id":4,"category_id":2,"code":"108W","name":"خيمار ماليزي","fabric":"كريب طرحة","price":null,"colors":"","sizes":"1,2,3","note":""},{"id":5,"category_id":3,"code":"50M","name":"لتام مغربي","fabric":"طرحة","price":null,"colors":"","sizes":"","note":""},{"id":6,"category_id":3,"code":"54M","name":"نقاب كاسكيط","fabric":"طرحة جديد","price":null,"colors":"","sizes":"","note":""},{"id":7,"category_id":3,"code":"274M","name":"نقاب سارة","fabric":"طرحة جديد","price":32,"colors":"","sizes":"","note":""},{"id":8,"category_id":4,"code":"47M","name":"سبنية1.5","fabric":"طرحة","price":null,"colors":"","sizes":"","note":""},{"id":9,"category_id":4,"code":"43M","name":"سبنية1.25","fabric":"طرحة","price":null,"colors":"","sizes":"","note":""},{"id":10,"category_id":4,"code":"66MA","name":"شال 2\/1","fabric":"طرحة أصلي","price":65,"colors":"","sizes":"","note":""}]};
  var D = null;

  function fresh() {
    var d = JSON.parse(JSON.stringify(SEED));
    d.images = []; d.stock = []; d.settings = { current_branch: d.branches[0] ? d.branches[0].id : 0, match_threshold: 0.86, label_type: 'barcode' };
    d.seq = { products: 1000, images: 1, fabrics: 1000, sizes: 1000, branches: 1000, categories: 1000 };
    return d;
  }
  function load() {
    try { var s = localStorage.getItem(KEY); if (s) { D = JSON.parse(s); return; } } catch (e) {}
    D = fresh();
  }
  var warned = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(D)); }
    catch (e) { if (!warned) { warned = true; console.warn('التخزين ممتلئ: الصور الجديدة كتبقى غير حتى تسدّ الصفحة.'); } }
  }
  load();
  window.__demoReset = function () { try { localStorage.removeItem(KEY); } catch (e) {} D = fresh(); save(); };

  // ---------- أدوات بحال PHP ----------
  function clean(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 200); }
  function csv(v) {
    var a = Array.isArray(v) ? v : String(v || '').split(',');
    var seen = {}, out = [];
    a.forEach(function (x) { x = clean(x, 60); if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out.join(',');
  }
  function vec(b64) {
    try {
      var bin = atob(b64 || ''); if (bin.length < 64 || bin.length % 4) return null;
      var bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var f = new Float32Array(bytes.buffer), n = 0; for (i = 0; i < f.length; i++) n += f[i] * f[i];
      n = Math.sqrt(n); if (!n) return null;
      var o = new Array(f.length); for (i = 0; i < f.length; i++) o[i] = f[i] / n; return o;
    } catch (e) { return null; }
  }
  function err(msg, code, e) { return [code || 400, { error: e || 'bad_request', message: msg }]; }
  function byId(list, id) { return list.find(function (x) { return +x.id === +id; }); }
  var KINDS = ['full', 'neck', 'hand', 'other'];
  function imgsOf(pid) {
    return D.images.filter(function (i) { return +i.product_id === +pid; })
      .sort(function (a, b) { return KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.id - b.id; });
  }
  function blobToDataUrl(blob) { return new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.readAsDataURL(blob); }); }

  // ---------- العمليات (نفس api.php) ----------
  var A = {
    init: function () {
      var br = +D.settings.current_branch;
      var products = D.products.slice().sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); }).map(function (p) {
        var im = imgsOf(p.id), st = D.stock.filter(function (s) { return +s.product_id === +p.id && s.qty; });
        var here = st.filter(function (s) { return +s.branch_id === br; });
        var sz = {}, co = {}; here.forEach(function (s) { if (s.qty > 0) { sz[s.size] = 1; co[s.color] = 1; } });
        return Object.assign({}, p, { thumb: im[0] ? im[0].path : null, images: im.length, indexed: im.filter(function (i) { return i.embedding; }).length,
          stock_here: here.reduce(function (t, s) { return t + s.qty; }, 0), stock_all: st.reduce(function (t, s) { return t + s.qty; }, 0),
          sizes_here: Object.keys(sz), colors_here: Object.keys(co) });
      });
      return [200, { categories: D.categories, fabrics: D.fabrics.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }),
        sizes: D.sizes, branches: D.branches, settings: { current_branch: br, match_threshold: +D.settings.match_threshold, label_type: D.settings.label_type === 'qr' ? 'qr' : 'barcode', label_opts: D.settings.label_opts || {} }, products: products }];
    },
    product: function (q) {
      var p = byId(D.products, q.get('id')); if (!p) return err('المنتوج ما كاينش.', 404, 'not_found');
      return [200, Object.assign({}, p, {
        images: imgsOf(p.id).map(function (i) { return { id: i.id, kind: i.kind, path: i.path, indexed: i.embedding ? 1 : 0 }; }),
        stock: D.stock.filter(function (s) { return +s.product_id === +p.id; }).map(function (s) { return { branch_id: +s.branch_id, size: s.size, color: s.color, qty: s.qty }; }) })];
    },
    product_save: function (q, b) {
      var id = +b.id || 0, code = clean(b.code, 60), name = clean(b.name, 200);
      var price = String(b.price == null ? '' : b.price).replace(/,/g, '.').replace(/\s|dh/gi, '');
      if (!code) return err('الكود ضروري.');
      if (!name) return err('الاسم ضروري.');
      if (price !== '' && isNaN(+price)) return err('الثمن خاصو يكون رقم.');
      var dup = D.products.find(function (p) { return p.code === code && +p.id !== id; });
      if (dup) return err('الكود «' + code + '» كاين ديجا عند «' + dup.name + '».', 409, 'duplicate_code');
      var rec = { category_id: +b.category_id || null, code: code, name: name, fabric: clean(b.fabric, 150), price: price === '' ? null : Math.round(+price * 100) / 100,
        colors: csv(b.colors), sizes: csv(b.sizes), note: clean(b.note, 1000) };
      if (id) Object.assign(byId(D.products, id), rec);
      else { id = D.seq.products++; D.products.push(Object.assign({ id: id }, rec)); }
      if (rec.fabric && !D.fabrics.some(function (f) { return f.name === rec.fabric; })) D.fabrics.push({ id: D.seq.fabrics++, name: rec.fabric });
      rec.sizes.split(',').filter(Boolean).forEach(function (s) { if (!D.sizes.some(function (x) { return x.name === s; })) D.sizes.push({ id: D.seq.sizes++, name: s, sort: 100 }); });
      save(); return [200, { ok: true, id: id }];
    },
    product_delete: function (q, b) {
      D.products = D.products.filter(function (p) { return +p.id !== +b.id; });
      D.images = D.images.filter(function (i) { return +i.product_id !== +b.id; });
      D.stock = D.stock.filter(function (s) { return +s.product_id !== +b.id; });
      save(); return [200, { ok: true }];
    },
    image_add: async function (q, b, form) {
      var pid = +form.get('product_id'), kind = form.get('kind');
      if (!byId(D.products, pid)) return err('المنتوج ما كاينش.', 404, 'not_found');
      var file = form.get('image'); if (!file || !file.size) return err('ما وصلات حتى صورة.');
      if (!/^image\/(jpeg|png|webp)$/.test(file.type || 'image/jpeg')) return err('الملف خاصو يكون صورة (JPG / PNG / WEBP).');
      var emb = form.get('embedding'); emb = vec(emb) ? emb : null;
      var rec = { id: D.seq.images++, product_id: pid, kind: KINDS.indexOf(kind) >= 0 ? kind : 'other', path: await blobToDataUrl(file),
        embedding: emb, model: emb ? clean(form.get('model'), 80) : null };
      D.images.push(rec); save();
      return [200, { ok: true, id: rec.id, path: rec.path, indexed: !!emb }];
    },
    image_delete: function (q, b) { D.images = D.images.filter(function (i) { return +i.id !== +b.id; }); save(); return [200, { ok: true }]; },
    image_embedding: function (q, b) {
      if (!vec(b.embedding)) return err('البصمة غير صالحة.');
      var i = byId(D.images, b.id); if (i) { i.embedding = b.embedding; i.model = clean(b.model, 80); save(); }
      return [200, { ok: true }];
    },
    search_image: function (q, b) {
      var qv = vec(b.embedding); if (!qv) return err('البصمة غير صالحة.');
      var cat = +b.category_id || 0, best = {};
      D.images.forEach(function (i) {
        if (!i.embedding || (b.model && i.model !== b.model)) return;
        var p = byId(D.products, i.product_id); if (!p || (cat && +p.category_id !== cat)) return;
        var v = vec(i.embedding); if (!v || v.length !== qv.length) return;
        var s = 0; for (var k = 0; k < qv.length; k++) s += qv[k] * v[k];
        if (!best[p.id] || s > best[p.id].score) best[p.id] = { product_id: p.id, score: Math.round(s * 10000) / 10000, image_id: i.id, kind: i.kind };
      });
      var m = Object.keys(best).map(function (k) { return best[k]; }).sort(function (a, c) { return c.score - a.score; });
      return [200, { matches: m.slice(0, Math.max(1, Math.min(20, +b.limit || 8))), threshold: +D.settings.match_threshold }];
    },
    stock_save: function (q, b) {
      var pid = +b.product_id, bid = +b.branch_id; if (!pid || !bid) return err('اختار الفرع أولاً.');
      var rows = b.rows || [];
      if (rows.some(function (r) { return (+r.qty || 0) < 0; })) return err('الكمية ما تقدرش تكون ناقص.');
      D.stock = D.stock.filter(function (s) { return !(+s.product_id === pid && +s.branch_id === bid); });
      rows.forEach(function (r) { var n = parseInt(r.qty, 10) || 0; if (n) D.stock.push({ product_id: pid, branch_id: bid, size: clean(r.size, 50), color: clean(r.color, 60), qty: n }); });
      save(); return [200, { ok: true }];
    },
    list_add: function (q, b) { return list('add', b); }, list_rename: function (q, b) { return list('rename', b); }, list_delete: function (q, b) { return list('delete', b); },
    setting_set: function (q, b) {
      if (b.k === 'current_branch') D.settings.current_branch = +b.v;
      else if (b.k === 'label_opts') { var o = b.v || {}, c = {}; ['code', 'name', 'meta', 'sizes', 'colors', 'price'].forEach(function (f) { c[f] = !!o[f]; }); c.extra = clean(o.extra, 80); D.settings.label_opts = c; }
      else if (b.k === 'label_type') D.settings.label_type = b.v === 'qr' ? 'qr' : 'barcode';
      else if (b.k === 'match_threshold') D.settings.match_threshold = Math.max(0.5, Math.min(0.99, +b.v));
      else return err('إعداد غير معروف.');
      save(); return [200, { ok: true }];
    }
  };
  function list(op, b) {
    var t = { fabrics: 1, sizes: 1, branches: 1, categories: 1 }[b.type] ? b.type : null; if (!t) return err('نوع غير معروف.');
    var L = D[t], name = clean(b.name, 150);
    if (op !== 'delete' && !name) return err('اكتب السمية.');
    if (op === 'add') {
      if (L.some(function (x) { return x.name === name; })) return err('«' + name + '» كاين ديجا.', 409, 'duplicate');
      var r = { id: D.seq[t]++, name: name }; if (t === 'sizes' || t === 'categories') r.sort = 100; L.push(r); save(); return [200, { ok: true, id: r.id }];
    }
    var row = byId(L, b.id);
    if (op === 'rename') {
      if (L.some(function (x) { return x.name === name && +x.id !== +b.id; })) return err('«' + name + '» كاين ديجا.', 409, 'duplicate');
      if (row) { if (t === 'fabrics') D.products.forEach(function (p) { if (p.fabric === row.name) p.fabric = name; }); row.name = name; }
      save(); return [200, { ok: true }];
    }
    if (t === 'categories' && D.products.some(function (p) { return +p.category_id === +b.id; }))
      return err('ما يمكنش تحذف صنف فيه منتوجات. بدّل الصنف ديال المنتوجات أولاً.', 409, 'in_use');
    D[t] = L.filter(function (x) { return +x.id !== +b.id; });
    if (t === 'branches') D.stock = D.stock.filter(function (s) { return +s.branch_id !== +b.id; });
    save(); return [200, { ok: true }];
  }

  // ---------- كنعترضو fetch('api.php?...') ----------
  var realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('api.php') !== 0) return realFetch(input, init);
    var q = new URLSearchParams(url.split('?')[1] || ''), action = q.get('action') || '';
    var form = init && init.body instanceof FormData ? init.body : null, body = {};
    if (init && typeof init.body === 'string') { try { body = JSON.parse(init.body); } catch (e) {} }
    var fn = A[action], res;
    if (!fn) res = err('العملية ما معروفاش.', 400, 'unknown_action');
    else { try { res = await fn(q, body, form); } catch (e) { console.error(e); res = err('وقع مشكل.', 500, 'server_error'); } }
    await new Promise(function (r) { setTimeout(r, 60); });   // بحال السيرفر
    return new Response(JSON.stringify(res[1]), { status: res[0], headers: { 'Content-Type': 'application/json' } });
  };
})();
