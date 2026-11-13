(function () {
  'use strict';
  var S = window.Store, esc = S.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  /* ---------- Доступ: кабинет работает только на устройствах, где открыли личную ссылку ---------- */
  var login = $('#login'), app = $('#app'), gate = $('#gate');
  function show(ok) {
    login.hidden = ok; app.hidden = !ok; gate.hidden = true;
    document.title = ok ? 'Кабинет шоурума — Miele Пермь' : 'Страница не найдена';
    if (ok) { renderAll(); openTab(location.hash === '#leads' ? 'leads' : 'products'); }
  }
  var hash0 = location.hash, link = hash0.match(/^#k=([A-Za-z0-9_-]{20,})$/);
  /* Причина отказа — в журнал сервера (без самого ключа): длина хвоста адреса, есть ли в нём ключ, подошёл ли формат, работает ли шифрование, сохранён ли ключ на устройстве */
  function why() { try { new Image().src = 'assets/img/miele-logo.svg?kab=' + [hash0.length, /^#k=/.test(hash0) ? 1 : 0, link ? 1 : 0, window.crypto && crypto.subtle ? 1 : 0, S.key() ? 1 : 0, location.protocol === 'https:' ? 1 : 0].join('-'); } catch (e) {} }
  /* Ссылку с ключом вставили в уже открытую вкладку с этой страницей: браузер меняет только хвост адреса и страницу не перезагружает — перезагружаем сами */
  window.addEventListener('hashchange', function () { if (app.hidden && /^#k=[A-Za-z0-9_-]{20,}$/.test(location.hash)) location.reload(); });
  /* Личная ссылка открыта по http: проверка ключа и вход работают только по https — открываем её же по https */
  if (link && location.protocol === 'http:' && !(window.crypto && crypto.subtle)) return location.replace('https://' + location.host + location.pathname + location.hash);
  /* На сервере открытого сеанса кабинета достаточно: он создаётся только после входа по ключу и паролю */
  (link ? S.activate(link[1]) : S.server && S.unlocked() ? Promise.resolve(true) : S.check(S.key())).then(function (ok) {
    /* Верный ключ остаётся в адресной строке: тогда адрес, скопированный из браузера, тоже открывает кабинет на другом устройстве */
    if (link && !ok) history.replaceState(null, '', location.pathname);
    if (!ok) why();
    if (ok && !S.unlocked()) { gate.hidden = false; document.title = 'Кабинет шоурума — Miele Пермь'; return $('#pw').focus(); }
    show(ok);
  });
  $('form', gate).addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('button', gate); btn.disabled = true;
    S.checkPass($('#pw').value).then(function (ok) {
      btn.disabled = false; $('#pw-wrap').classList.toggle('bad', !ok);
      var em = $('#pw-wrap .errm'); if (em) { if (!em.dataset.t) em.dataset.t = em.textContent; em.textContent = !ok && S.lastError ? S.lastError : em.dataset.t; }
      if (!ok) return $('#pw').focus();
      $('#pw').value = '';
      if (S.server) return location.reload();
      S.unlock(); show(true);
    });
  });
  $('#pw').addEventListener('input', function () { $('#pw-wrap').classList.remove('bad'); });

  /* ---------- Общие ---------- */
  window.MP_onSaveError = function (msg) { toast(msg, true); };
  var toastT;
  function toast(msg, err) {
    var t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' err' : '');
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = 'toast'; }, err ? 5000 : 2400);
  }
  function save(list) {
    if (S.saveProducts(list)) return true;
    toast('Не сохранилось: в браузере закончилось место. Удалите часть загруженных фото.', true); return false;
  }
  var cf = $('#confirm'), cfYes = null;
  function confirmBox(title, text, yes, fn) {
    $('#cf-title').textContent = title; $('#cf-text').textContent = text; $('#cf-yes').textContent = yes; cfYes = fn; cf.showModal(); $('#cf-no').focus();
  }
  $('#cf-no').addEventListener('click', function () { cf.close(); });
  $('#cf-yes').addEventListener('click', function () { cf.close(); if (cfYes) cfYes(); });

  function openTab(name) {
    $$('.tab').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === name ? 'true' : 'false'); });
    ['products', 'kits', 'leads', 'settings', 'users'].forEach(function (n) { $('#tab-' + n).hidden = n !== name; });
    if (name === 'kits' && !kdirty) { kitsLoad(); renderKits(); }
  }
  $$('.tab').forEach(function (b) { b.addEventListener('click', function () { openTab(b.dataset.tab); }); });

  /* ---------- Товары ---------- */
  var filter = 'all', query = '', asort = 'default', acat = '', closed = {};
  var num = function (p) { return typeof p.price === 'number'; };
  var ASORT = {
    'stock-asc': function (a, b) { return (a.stock || 0) - (b.stock || 0); },
    'stock-desc': function (a, b) { return (b.stock || 0) - (a.stock || 0); },
    'price-asc': function (a, b) { return num(a) && num(b) ? a.price - b.price : num(b) - num(a); },
    'price-desc': function (a, b) { return num(a) && num(b) ? b.price - a.price : num(b) - num(a); },
    name: function (a, b) { return a.title.localeCompare(b.title, 'ru'); }
  };
  function bucket(p) { var k = S.status(p).key; return k === 'many' || k === 'ok' ? 'ok' : k === 'low' ? 'low' : 'out'; }
  function bars(st) { return '<span class="stock stock--' + st.key + '"><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>' + esc(st.admin) + '</span>'; }

  function renderProducts() {
    var all = S.products();
    var c = { all: all.length, ok: 0, low: 0, out: 0, hidden: 0 };
    all.forEach(function (p) { c[bucket(p)]++; if (p.visible === false) c.hidden++; });
    var tiles = [['all', 'Всего товаров', ''], ['ok', 'В наличии', 'tile--ok'], ['low', 'Осталось мало', 'tile--low'], ['out', 'Нет / под заказ', 'tile--out'], ['hidden', 'Скрыто с сайта', '']];
    $('#tiles').innerHTML = tiles.map(function (t) {
      return '<button type="button" class="tile ' + t[2] + '" data-f="' + t[0] + '" aria-pressed="' + (filter === t[0]) + '"><b>' + c[t[0]] + '</b><span>' + t[1] + '</span></button>';
    }).join('');

    /* Разделы в том же порядке, что и папки на сайте; товары без раздела — отдельной группой в конце */
    var cats = S.cats(), per = {};
    all.forEach(function (p) { var c = p.category || ''; per[c] = (per[c] || 0) + 1; });
    if (per['']) cats.push('');
    if (cats.indexOf(acat) < 0) acat = '';
    $('#acat').innerHTML = '<option value="">Все разделы</option>' + cats.map(function (c) {
      return c ? '<option value="' + esc(c) + '"' + (c === acat ? ' selected' : '') + '>' + esc(c) + ' — ' + (per[c] || 0) + '</option>' : '';
    }).join('');

    var q = query.trim().toLowerCase();
    var list = all.filter(function (p) {
      if (acat && p.category !== acat) return false;
      if (filter === 'hidden' ? p.visible !== false : filter !== 'all' && bucket(p) !== filter) return false;
      return !q || (p.title + ' ' + (p.model || '') + ' ' + (p.sku || '')).toLowerCase().indexOf(q) >= 0;
    });
    if (ASORT[asort]) list = list.map(function (p, i) { return [p, i]; }).sort(function (a, b) { return ASORT[asort](a[0], b[0]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
    if (!all.length) { $('#list').innerHTML = '<div class="none"><p>В каталоге пока нет товаров.</p><button class="abtn abtn--pri" type="button" data-add>+ Добавить первый товар</button></div>'; return; }
    if (!list.length) { $('#list').innerHTML = '<div class="none"><p>Под этот фильтр ничего не подходит.</p><button class="abtn" type="button" data-clear>Показать все товары</button></div>'; return; }
    function row(p) {
        var st = S.status(p);
        return '<tr data-id="' + esc(p.id) + '"' + (p.visible === false ? ' class="hid"' : '') + '>' +
          '<td><div class="thumb">' + ((p.images || [])[0] ? '<img src="' + esc(p.images[0]) + '" alt="">' : '') + '</div></td>' +
          '<td class="c-name"><div class="pname">' + esc(p.title) + '<small>' + esc(p.model || '') + '</small></div></td>' +
          '<td class="c-price num">' + (S.onSale(p) ? '<s>' + S.price(p.oldPrice) + '</s><br>' : '') + S.price(p.price) + '</td>' +
          '<td class="c-stock"><div class="step"><button type="button" data-d="-1" aria-label="Уменьшить остаток">−</button><input type="number" min="0" step="1" inputmode="numeric" value="' + (parseInt(p.stock, 10) || 0) + '" aria-label="Остаток: ' + esc(p.title) + '"><button type="button" data-d="1" aria-label="Увеличить остаток">+</button></div></td>' +
          '<td class="c-lvl"><span class="lvl">' + bars(st) + '<small>мало ≤ ' + (p.low || 1) + ' · много ≥ ' + (p.high || 2) + '</small></span></td>' +
          '<td class="c-show"><label class="sw"><input type="checkbox" data-show' + (p.showroom ? ' checked' : '') + ' aria-label="Есть в шоуруме: ' + esc(p.title) + '"><span></span></label></td>' +
          '<td class="c-vis"><label class="sw"><input type="checkbox" data-vis' + (p.visible !== false ? ' checked' : '') + ' aria-label="Показывать на сайте: ' + esc(p.title) + '"><span></span></label></td>' +
          '<td class="acts"><button class="abtn abtn--ghost" type="button" data-edit>Изменить</button><button class="abtn abtn--ghost" type="button" data-del>Удалить</button></td></tr>';
    }
    /* Товары идут группами по разделам; группу можно свернуть. При поиске все группы раскрыты */
    $('#list').innerHTML = '<table class="tbl"><thead><tr><th></th><th>Товар</th><th>Цена</th><th>Остаток, шт.</th><th>Уровень</th><th>В шоуруме</th><th>На сайте</th><th></th></tr></thead>' +
      cats.map(function (c) {
        var rows = list.filter(function (p) { return (p.category || '') === c; });
        if (!rows.length) return '';
        var open = !closed[c] || !!q;
        return '<tbody class="grp"><tr class="grp__h"><td colspan="8"><div class="grp__in">' +
          '<button type="button" class="grp__t" data-g="' + esc(c) + '" aria-expanded="' + open + '"><i aria-hidden="true"></i>' + esc(c || 'Без раздела') + '<span>' + rows.length + ' ' + S.plural(rows.length, 'товар', 'товара', 'товаров') + '</span></button>' +
          (c ? '<button type="button" class="abtn abtn--ghost" data-addto="' + esc(c) + '">+ Товар в раздел</button>' : '') + '</div></td></tr>' +
          (open ? rows.map(row).join('') : '') + '</tbody>';
      }).join('') + '</table>';
  }

  function patch(id, fn) {
    var list = S.products(), p = list.filter(function (x) { return x.id === id; })[0];
    if (!p) return; fn(p); if (save(list)) renderProducts();
  }
  $('#tiles').addEventListener('click', function (e) { var b = e.target.closest('.tile'); if (b) { filter = b.dataset.f; renderProducts(); } });
  $('#q').addEventListener('input', function (e) { query = e.target.value; renderProducts(); });
  $('#asort').addEventListener('change', function (e) { asort = e.target.value; renderProducts(); });
  $('#acat').addEventListener('change', function (e) { acat = e.target.value; if (acat) closed[acat] = false; renderProducts(); });
  $('#add').addEventListener('click', function () { edit(null); });
  $('#list').addEventListener('click', function (e) {
    if (e.target.closest('[data-add]')) return edit(null);
    if (e.target.closest('[data-clear]')) { filter = 'all'; query = ''; acat = ''; $('#q').value = ''; return renderProducts(); }
    var grp = e.target.closest('[data-g]');
    if (grp) { closed[grp.dataset.g] = !closed[grp.dataset.g]; return renderProducts(); }
    var addTo = e.target.closest('[data-addto]');
    if (addTo) return edit(null, addTo.dataset.addto);
    var tr = e.target.closest('tr[data-id]'); if (!tr) return;
    var id = tr.dataset.id, step = e.target.closest('[data-d]');
    if (step) return patch(id, function (p) { p.stock = Math.max(0, (parseInt(p.stock, 10) || 0) + +step.dataset.d); });
    if (e.target.closest('[data-edit]')) return edit(id);
    if (e.target.closest('[data-del]')) {
      var p = S.product(id);
      confirmBox('Удалить товар?', '«' + p.title + '» исчезнет из каталога и с сайта. Если товар просто закончился, лучше поставить остаток 0 или скрыть его.', 'Удалить товар', function () {
        if (save(S.products().filter(function (x) { return x.id !== id; }))) { renderProducts(); toast('Товар удалён'); }
      });
    }
  });
  $('#list').addEventListener('change', function (e) {
    var tr = e.target.closest('tr[data-id]'); if (!tr) return;
    if (e.target.matches('[data-show]')) return patch(tr.dataset.id, function (p) { p.showroom = e.target.checked; });
    if (e.target.matches('[data-vis]')) return patch(tr.dataset.id, function (p) { p.visible = e.target.checked; });
    if (e.target.matches('.step input')) return patch(tr.dataset.id, function (p) { p.stock = Math.max(0, parseInt(e.target.value, 10) || 0); });
  });

  /* ---------- Редактор ---------- */
  var ed = $('#editor'), ef = $('form', ed), editing = null, pics = [], KITS = 'Комплекты';
  function drawPics() {
    $('#e-pics').innerHTML = pics.length ? pics.map(function (src, i) {
      return '<div class="pic"><img src="' + esc(src) + '" alt=""><button type="button" data-rm="' + i + '" aria-label="Убрать фото ' + (i + 1) + '">×</button></div>';
    }).join('') : '<p class="hint" style="margin:0">Фото пока нет.</p>';
  }
  function drawNow() {
    var st = S.status({ stock: ef.elements.stock.value, low: ef.elements.low.value, high: ef.elements.high.value, orderable: ef.elements.orderable.checked });
    $('#e-now').innerHTML = 'На сайте сейчас: ' + '<span class="stock stock--' + st.key + '"><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>' + esc(st.label) + '</span><span style="color:var(--muted)">(' + esc(st.admin.toLowerCase()) + ')</span>';
  }
  function edit(id, cat) {
    var cfg = S.settings();
    var p = id ? S.product(id) : { title: '', model: '', sku: '', category: cat || '', country: '', price: null, stock: 0, low: cfg.lowDefault, high: cfg.highDefault, orderable: true, visible: true, showroom: false, images: [], description: '', features: [], specs: [] };
    editing = id; pics = (p.images || []).slice();
    $('#ed-title').textContent = id ? 'Изменить товар' : 'Новый товар';
    var el = ef.elements;
    el.title.value = p.title; el.model.value = p.model || ''; el.sku.value = p.sku || ''; el.category.value = p.category || ''; el.country.value = p.country || '';
    el.price.value = typeof p.price === 'number' ? p.price : ''; el.oldPrice.value = typeof p.oldPrice === 'number' ? p.oldPrice : '';
    el.stock.value = parseInt(p.stock, 10) || 0; el.low.value = p.low || cfg.lowDefault; el.high.value = p.high || cfg.highDefault;
    el.orderable.checked = p.orderable !== false; el.visible.checked = p.visible !== false; el.showroom.checked = !!p.showroom;
    el.description.value = p.description || '';
    el.features.value = (p.features || []).join('\n');
    el.specs.value = (p.specs || []).map(function (s) { return s[0] + ': ' + s[1]; }).join('\n');
    $('#cats').innerHTML = S.cats().map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
    /* Дополнительные разделы товара: все разделы каталога и папка «Комплекты» */
    var also = p.also || [], sec = S.cats(); if (sec.indexOf(KITS) < 0) sec.push(KITS);
    $('#e-also').innerHTML = sec.map(function (c) { return '<label class="chk"><input type="checkbox" value="' + esc(c) + '"' + (also.indexOf(c) >= 0 ? ' checked' : '') + '><span>' + esc(c) + '</span></label>'; }).join('');
    $$('.bad', ef).forEach(function (n) { n.classList.remove('bad'); });
    drawPics(); drawNow(); ed.showModal(); $('.editor__b', ed).scrollTop = 0; el.title.focus();
  }
  ['stock', 'low', 'high'].forEach(function (n) { ef.elements[n].addEventListener('input', drawNow); });
  ef.elements.orderable.addEventListener('change', drawNow);
  ef.elements.title.addEventListener('input', function () { if (this.value.trim()) $('#w-title').classList.remove('bad'); });
  ef.elements.category.addEventListener('input', function () { if (this.value.trim()) $('#w-cat').classList.remove('bad'); });
  ef.elements.oldPrice.addEventListener('input', function () { $('#w-old').classList.remove('bad'); });
  $$('[data-close]', ed).forEach(function (b) { b.addEventListener('click', function () { ed.close(); }); });
  $('#e-pics').addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (b) { pics.splice(+b.dataset.rm, 1); drawPics(); } });
  $('#e-upload').addEventListener('click', function () { $('#e-file').click(); });
  $('#e-file').addEventListener('change', function (e) {
    Array.prototype.forEach.call(e.target.files, function (file) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1000 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
        var data = cv.toDataURL('image/webp', .82); if (data.indexOf('data:image/webp') !== 0) data = cv.toDataURL('image/jpeg', .85);
        URL.revokeObjectURL(url);
        S.upload(data).then(function (src) { pics.push(src); drawPics(); }, function (er) { toast('Фото «' + file.name + '» не загрузилось: ' + (er && er.message || 'ошибка'), true); });
      };
      img.onerror = function () { toast('Файл «' + file.name + '» не похож на изображение', true); URL.revokeObjectURL(url); };
      img.src = url;
    });
    e.target.value = '';
  });
  ef.addEventListener('submit', function (e) {
    e.preventDefault();
    var el = ef.elements, title = el.title.value.trim(), cat = el.category.value.trim();
    $('#w-title').classList.toggle('bad', !title); $('#w-cat').classList.toggle('bad', !cat);
    if (!title) return el.title.focus();
    if (!cat) return el.category.focus();
    var price = el.price.value === '' ? null : Math.max(0, Math.round(+el.price.value)), old = el.oldPrice.value === '' ? null : Math.max(0, Math.round(+el.oldPrice.value));
    var badOld = old !== null && (price === null || old <= price);
    $('#w-old').classList.toggle('bad', badOld);
    if (badOld) return el.oldPrice.focus();
    var low = Math.max(1, parseInt(el.low.value, 10) || 1);
    var data = {
      title: title, model: el.model.value.trim(), sku: el.sku.value.trim(), category: cat, country: el.country.value.trim(),
      also: Array.prototype.map.call(document.querySelectorAll('#e-also input:checked'), function (i) { return i.value; }).filter(function (c) { return c !== cat; }),
      price: price, oldPrice: old,
      stock: Math.max(0, parseInt(el.stock.value, 10) || 0), low: low, high: Math.max(low + 1, parseInt(el.high.value, 10) || low + 1),
      orderable: el.orderable.checked, visible: el.visible.checked, showroom: el.showroom.checked, images: pics.slice(),
      description: el.description.value.trim(),
      features: el.features.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      specs: el.specs.value.split('\n').map(function (s) { var i = s.indexOf(':'); return i > 0 ? [s.slice(0, i).trim(), s.slice(i + 1).trim()] : null; }).filter(function (s) { return s && s[0] && s[1]; })
    };
    var list = S.products();
    if (editing) list = list.map(function (p) { if (p.id !== editing) return p; data.id = p.id; return data; });
    else { data.id = 'p' + Date.now().toString(36); list.unshift(data); }
    if (!save(list)) return;
    ed.close(); filter = 'all'; closed[data.category] = false; if (acat && acat !== data.category) acat = ''; renderProducts(); toast(editing ? 'Изменения сохранены' : 'Товар добавлен');
  });

  /* ---------- Заявки ---------- */
  /* Старые заявки хранят заказ одной строкой текста — разбираем её на позиции, фото берём из каталога по названию */
  function parseOrder(t) {
    var m = /^(.*)\. Итого: ([^₽]+)₽(.*)$/.exec(t || ''); if (!m) return null;
    var by = {}; S.products().forEach(function (p) { by[p.title] = p; });
    var num = function (s) { return +String(s).replace(/\D/g, ''); }, bad = false;
    var items = m[1].split('; ').map(function (s) {
      var r = /^(.*) × (\d+)(?: — ([^₽]+)₽| \(цена по запросу\))$/.exec(s); if (!r) { bad = true; return null; }
      var p = by[r[1]], qty = +r[2] || 1, sum = r[3] ? num(r[3]) : null;
      return { title: r[1], sub: p ? [p.model && 'Модель ' + p.model, p.sku && 'арт. ' + p.sku].filter(Boolean).join(', ') : '', img: p ? (p.images || [])[0] || '' : '', qty: qty, price: sum === null ? null : Math.round(sum / qty), sum: sum };
    });
    if (bad) return null;
    var total = num(m[2]), goods = 0, ask = 0; items.forEach(function (it) { if (it.sum === null) ask += it.qty; else goods += it.sum; });
    var kit = /цена комплекта: −([^₽]+)₽/.exec(m[3]), pct = /скидка за объём (\d+)%/.exec(m[3]), off = kit ? num(kit[1]) : 0;
    return { items: items, kits: off ? [{ title: '', n: 1, off: off }] : [], goods: goods, pct: pct ? +pct[1] : 0, discount: Math.max(0, goods - off - total), total: total, ask: ask };
  }
  /* Заказ из корзины — таблицей, как в печатном предложении: фото, название, количество, цена, сумма и итоги */
  function leadOrder(x) {
    var c = x.cart && x.cart.items && x.cart.items.length ? x.cart : parseOrder(x.order), money = S.price;
    if (!c) return x.order ? '<div class="ld__txt">' + esc(x.order) + '</div>' : '';
    var cut = (c.kits && c.kits.length) || c.pct, line = function (t, v, cls) { return '<div' + (cls ? ' class="' + cls + '"' : '') + '><dt>' + t + '</dt><dd>' + v + '</dd></div>'; };
    return '<div class="lo"><div class="lo__head"><span>№</span><span></span><span>Наименование</span><span>Кол-во</span><span>Цена</span><span>Сумма</span></div>' +
      c.items.map(function (it, i) {
        var known = typeof it.price === 'number', price = known ? (it.old ? '<s>' + money(it.old) + '</s> ' : '') + money(it.price) : 'по запросу';
        return '<div class="lo__row"><span class="lo__n">' + (i + 1) + '</span><span class="lo__pic">' + (it.img ? '<img src="' + esc(it.img) + '" alt="" loading="lazy">' : '') + '</span>' +
          '<span class="lo__name">' + esc(it.title) + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span>' +
          '<span class="lo__qty">' + (+it.qty || 1) + '</span><span class="lo__price">' + price + '</span>' +
          '<span class="lo__each">' + (+it.qty || 1) + ' шт.' + (known ? ' × ' + price : '') + '</span>' +
          '<span class="lo__sum">' + (typeof it.sum === 'number' ? money(it.sum) : 'по запросу') + '</span></div>';
      }).join('') +
      '<dl class="lo__tot">' + (cut ? line('Итого', money(c.goods)) : '') +
        (c.kits || []).map(function (k) { return line('Цена комплекта' + (k.title ? ': ' + esc(k.title) : '') + (k.n > 1 ? ' × ' + (+k.n) : ''), '−' + money(k.off)); }).join('') +
        (c.pct ? line('Скидка за объём заказа ' + (+c.pct) + '%', '−' + money(c.discount)) : '') +
        line(cut ? 'Итого со скидкой' : 'Итого', money(c.total), 'lo__total') + '</dl>' +
      (c.ask ? '<p class="lo__note">Позиции с ценой по запросу в сумму не входят.</p>' : '') + '</div>';
  }
  function renderLeads() {
    var l = S.leads(), fresh = l.filter(function (x) { return !x.done; }).length, badge = $('#lead-badge');
    badge.hidden = !fresh; badge.textContent = fresh;
    $('#leads').innerHTML = l.length ? '<div class="leads">' + l.map(function (x) {
      var d = new Date(x.ts), when = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return '<div class="ld' + (x.done ? ' done' : '') + '" data-id="' + esc(x.id) + '"><div class="ld__who">' + esc(x.name) + '<a href="tel:+' + esc(x.phone.replace(/\D/g, '')) + '">' + esc(x.phone) + '</a></div>' +
        '<div class="ld__meta">' + esc(when) + (x.product ? ' · ' + esc(x.product) : x.order ? ' · заказ из корзины' : ' · общий вопрос') + (x.done ? ' · обработана' : '') + '</div>' +
        leadOrder(x) +
        (x.comment ? '<div class="ld__txt">' + esc(x.comment) + '</div>' : '') +
        '<div class="ld__acts"><button class="abtn" type="button" data-done>' + (x.done ? 'Вернуть в работу' : 'Отметить обработанной') + '</button><button class="abtn abtn--ghost" type="button" data-rm>Удалить</button></div></div>';
    }).join('') + '</div>' : '<div class="none"><p>Заявок пока нет. Отправьте пробную с сайта — она появится здесь.</p><a class="abtn" href="index.html#ask" target="_blank">Открыть форму на сайте</a></div>';
  }
  $('#leads').addEventListener('click', function (e) {
    var row = e.target.closest('.ld'); if (!row) return;
    var l = S.leads(), id = row.dataset.id;
    if (e.target.closest('[data-done]')) { l.forEach(function (x) { if (x.id === id) x.done = !x.done; }); S.saveLeads(l); renderLeads(); }
    if (e.target.closest('[data-rm]')) confirmBox('Удалить заявку?', 'Контакт клиента будет удалён без возможности восстановления.', 'Удалить заявку', function () {
      S.saveLeads(S.leads().filter(function (x) { return x.id !== id; })); renderLeads(); toast('Заявка удалена');
    });
  });

  /* ---------- Комплекты ---------- */
  /* Черновик комплектов правится на вкладке и сохраняется целиком кнопкой «Сохранить комплекты» (настройка kitList) */
  var kdraft = [], kdirty = false, klist = $('#kits-list');
  function kitsLoad() {
    kdraft = (S.settings().sets || []).map(function (k) {
      return { title: k.title || '', note: k.note || '', ids: (k.ids || []).slice(), prices: (k.ids || []).map(function (id, n) { var v = (k.prices || [])[n]; return typeof v === 'number' ? v : null; }) };
    });
    kdirty = false;
  }
  function kitCalc(k, by) {
    var sum = 0, full = 0, known = true, n = 0;
    k.ids.forEach(function (id, i) {
      var p = by[id]; if (!p) return;
      n++;
      var own = typeof p.price === 'number' ? p.price : null, sp = k.prices[i];
      var v = typeof sp === 'number' ? (own === null ? sp : Math.min(sp, own)) : own;
      if (v === null || own === null) known = false;
      sum += v || 0; full += own || 0;
    });
    if (n < 2) return 'Добавьте в комплект хотя бы два прибора';
    if (!known) return 'У одного из приборов нет цены — цена комплекта будет «по запросу»';
    return 'Комплектом: ' + S.price(sum) + ' · по отдельности: ' + S.price(full) + (full > sum ? ' · выгода: ' + S.price(full - sum) : '');
  }
  function kitOptions(all, cur) {
    var cats = [], per = {};
    all.forEach(function (p) { var c = p.category || 'Без раздела'; if (!per[c]) { per[c] = []; cats.push(c); } per[c].push(p); });
    return '<option value="">— выберите товар —</option>' + cats.map(function (c) {
      return '<optgroup label="' + esc(c) + '">' + per[c].map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === cur ? ' selected' : '') + '>' + esc(p.title) + '</option>'; }).join('') + '</optgroup>';
    }).join('');
  }
  function renderKits() {
    var all = S.products(), by = {}; all.forEach(function (p) { by[p.id] = p; });
    klist.innerHTML = kdraft.length ? kdraft.map(function (k, i) {
      return '<div class="box f kited" data-k="' + i + '">' +
        '<div class="kited__top"><b>Комплект ' + (i + 1) + '</b><span>' +
          '<button type="button" class="abtn abtn--ghost" data-kup' + (i === 0 ? ' disabled' : '') + ' aria-label="Поднять комплект выше">↑</button>' +
          '<button type="button" class="abtn abtn--ghost" data-kdown' + (i === kdraft.length - 1 ? ' disabled' : '') + ' aria-label="Опустить комплект ниже">↓</button>' +
          '<button type="button" class="abtn abtn--danger" data-kdel>Удалить комплект</button></span></div>' +
        '<div class="row"><div><label for="kt' + i + '">Название</label><input id="kt' + i + '" type="text" data-kf="title" value="' + esc(k.title) + '" placeholder="Например: Колонна WQ 1000 + TQ 1000"></div>' +
        '<div><label for="kn' + i + '">Подпись над названием</label><input id="kn' + i + '" type="text" data-kf="note" value="' + esc(k.note) + '" placeholder="Например: Nova Edition, серия W2/T2"></div></div>' +
        '<div class="kited__rows"><div class="kited__head"><span>Прибор</span><span>Цена в комплекте, ₽</span><span></span></div>' + k.ids.map(function (id, n) {
          var p = by[id], v = k.prices[n];
          return '<div class="kited__r" data-n="' + n + '"><div><select data-kid aria-label="Прибор ' + (n + 1) + '">' + kitOptions(all, id) + '</select>' +
            '<small>' + (p ? 'в каталоге: ' + (typeof p.price === 'number' ? S.price(p.price) : 'по запросу') : (id ? 'товар удалён из каталога' : '')) + '</small></div>' +
            '<input type="number" min="0" step="100" inputmode="numeric" data-kprice value="' + (typeof v === 'number' ? v : '') + '" placeholder="как в каталоге" aria-label="Цена в комплекте, прибор ' + (n + 1) + '">' +
            '<button type="button" class="abtn abtn--ghost" data-krm aria-label="Убрать прибор из комплекта">×</button></div>';
        }).join('') + '</div>' +
        '<div class="kited__foot"><button type="button" class="abtn" data-kaddrow>+ Прибор</button><span class="kited__sum" data-ksum>' + esc(kitCalc(k, by)) + '</span></div></div>';
    }).join('') : '<div class="box"><p>Комплектов нет. Нажмите «+ Комплект», чтобы собрать первый.</p></div>';
    $('#kit-note').textContent = kdirty ? 'Есть несохранённые изменения' : '';
  }
  function kitOf(el) { var box = el.closest('[data-k]'); return box ? +box.dataset.k : -1; }
  function kitTouch(i) {
    kdirty = true; $('#kit-note').textContent = 'Есть несохранённые изменения';
    var by = {}; S.products().forEach(function (p) { by[p.id] = p; });
    var s = klist.querySelector('[data-k="' + i + '"] [data-ksum]'); if (s && kdraft[i]) s.textContent = kitCalc(kdraft[i], by);
  }
  klist.addEventListener('input', function (e) {
    var i = kitOf(e.target), k = kdraft[i]; if (!k) return;
    if (e.target.hasAttribute('data-kf')) k[e.target.getAttribute('data-kf')] = e.target.value;
    if (e.target.hasAttribute('data-kprice')) { var n = +e.target.closest('[data-n]').dataset.n; k.prices[n] = e.target.value === '' ? null : Math.max(0, Math.round(+e.target.value) || 0); }
    kitTouch(i);
  });
  klist.addEventListener('change', function (e) {
    if (!e.target.hasAttribute('data-kid')) return;
    var i = kitOf(e.target), n = +e.target.closest('[data-n]').dataset.n;
    kdraft[i].ids[n] = e.target.value; kdirty = true; renderKits();
  });
  klist.addEventListener('click', function (e) {
    var i = kitOf(e.target), k = kdraft[i]; if (!k) return;
    var move = function (d) { var t = kdraft[i + d]; kdraft[i + d] = k; kdraft[i] = t; };
    if (e.target.closest('[data-kaddrow]')) { k.ids.push(''); k.prices.push(null); }
    else if (e.target.closest('[data-krm]')) { var n = +e.target.closest('[data-n]').dataset.n; k.ids.splice(n, 1); k.prices.splice(n, 1); }
    else if (e.target.closest('[data-kup]') && i > 0) move(-1);
    else if (e.target.closest('[data-kdown]') && i < kdraft.length - 1) move(1);
    else if (e.target.closest('[data-kdel]')) {
      return confirmBox('Удалить комплект?', '«' + (k.title || 'Комплект ' + (i + 1)) + '» исчезнет из папки «Комплекты» после сохранения. Сами товары останутся в каталоге.', 'Удалить комплект', function () { kdraft.splice(i, 1); kdirty = true; renderKits(); });
    } else return;
    kdirty = true; renderKits();
  });
  $('#kit-add').addEventListener('click', function () {
    kdraft.push({ title: '', note: '', ids: ['', ''], prices: [null, null] }); kdirty = true; renderKits();
    var boxes = klist.querySelectorAll('[data-k]'), last = boxes[boxes.length - 1];
    if (last) { last.scrollIntoView({ block: 'center' }); last.querySelector('[data-kf="title"]').focus(); }
  });
  $('#kit-save').addEventListener('click', function () {
    var bad = '';
    kdraft.forEach(function (k, i) {
      var ids = k.ids.filter(Boolean), name = k.title.trim() || 'Комплект ' + (i + 1);
      if (bad) return;
      if (!k.title.trim()) bad = 'У комплекта ' + (i + 1) + ' нет названия.';
      else if (k.ids.some(function (id) { return !id; })) bad = '«' + name + '»: выберите товар в каждой строке или уберите пустую строку.';
      else if (ids.length < 2) bad = '«' + name + '»: в комплекте должно быть не меньше двух приборов.';
      else if (ids.some(function (id, n) { return ids.indexOf(id) !== n; })) bad = '«' + name + '»: один и тот же товар выбран дважды.';
    });
    if (bad) return toast(bad, true);
    var c = S.settings();
    c.kitList = kdraft.map(function (k) { return { title: k.title.trim(), note: k.note.trim(), ids: k.ids.slice(), prices: k.prices.slice() }; });
    delete c.kits;
    S.saveSettings(c); kitsLoad(); renderKits(); toast('Комплекты сохранены');
  });
  $('#kit-reset').addEventListener('click', function () {
    confirmBox('Вернуть стандартные комплекты?', 'Ваши изменения в комплектах будут заменены стандартным набором из пяти колонн.', 'Вернуть стандартные', function () {
      var c = S.settings(); delete c.kitList; delete c.kits; S.saveSettings(c); kitsLoad(); renderKits(); toast('Стандартные комплекты возвращены');
    });
  });

  /* ---------- Настройки и данные ---------- */
  var sf = $('#set-form');
  function renderSettings() {
    var c = S.settings(), el = sf.elements;
    ['lowDefault', 'highDefault', 'leadTime', 'phone', 'phone2', 'whatsapp', 'telegram', 'address', 'hours'].forEach(function (k) { el[k].value = c[k] || ''; });
    var d = c.discounts || [];
    [1, 2, 3].forEach(function (n) { el['d' + n + 'from'].value = d[n - 1] ? d[n - 1].from : ''; el['d' + n + 'pct'].value = d[n - 1] ? d[n - 1].pct : ''; });
    el.cats.value = (c.cats || []).join('\n');
    el.showCount.checked = !!c.showCount;
  }
  sf.addEventListener('submit', function (e) {
    e.preventDefault();
    var c = S.settings(), el = sf.elements;
    c.lowDefault = Math.max(1, parseInt(el.lowDefault.value, 10) || 1);
    c.highDefault = Math.max(c.lowDefault + 1, parseInt(el.highDefault.value, 10) || c.lowDefault + 1);
    c.showCount = el.showCount.checked;
    ['leadTime', 'phone', 'phone2', 'address', 'hours'].forEach(function (k) { c[k] = el[k].value.trim(); });
    c.telegram = el.telegram.value.trim().replace(/^(https?:\/\/)?t\.me\//, '').replace(/^[@+]/, '');
    c.discounts = [[el.d1from, el.d1pct], [el.d2from, el.d2pct], [el.d3from, el.d3pct]].map(function (x) { return { from: Math.round(+x[0].value) || 0, pct: Math.min(90, +x[1].value || 0) }; })
      .filter(function (t) { return t.from > 0 && t.pct > 0; }).sort(function (a, b) { return a.from - b.from; });
    c.cats = el.cats.value.split('\n').map(function (s) { return s.trim(); }).filter(function (s, i, a) { return s && a.indexOf(s) === i; });
    c.whatsapp = el.whatsapp.value.replace(/\D/g, '');
    S.saveSettings(c); renderSettings(); toast('Настройки сохранены');
  });
  $('#export').addEventListener('click', function () {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S.exportAll(), null, 2)], { type: 'application/json' }));
    a.download = 'miele-perm-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('#import').addEventListener('click', function () { $('#import-file').click(); });
  $('#import-file').addEventListener('change', function (e) {
    var file = e.target.files[0]; if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (!Array.isArray(d.products)) throw new Error('no products');
        confirmBox('Загрузить копию?', 'Текущий каталог (' + S.products().length + ' поз.) будет заменён на ' + d.products.length + ' поз. из файла.', 'Заменить каталог', function () {
          if (!save(d.products)) return;
          if (d.settings) S.saveSettings(d.settings);
          if (Array.isArray(d.leads)) S.saveLeads(d.leads);
          renderAll(); toast('Копия загружена');
        });
      } catch (er) { toast('Не удалось прочитать файл. Нужна копия, скачанная из этой панели.', true); }
    };
    r.readAsText(file); e.target.value = '';
  });
  $('#reset').addEventListener('click', function () {
    confirmBox('Сбросить демо?', 'Каталог вернётся к исходному списку товаров, заявки и настройки будут очищены.', 'Сбросить демо', function () { S.reset(); filter = 'all'; renderAll(); toast('Демо-данные восстановлены'); });
  });

  /* ---------- Вкладка «Доступ» ---------- */
  function renderAccess() { $('#a-link').value = S.key() ? location.origin + location.pathname + '#k=' + S.key() : 'Откройте кабинет по личной ссылке — она появится здесь'; }
  $('#a-copy').addEventListener('click', function () {
    var inp = $('#a-link'); inp.focus(); inp.select();
    var done = function () { toast('Ссылка скопирована'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(done, function () { document.execCommand('copy'); done(); });
    else { document.execCommand('copy'); done(); }
  });
  $('#n-gen').addEventListener('click', function () {
    var abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(12)), out = '';
    for (var i = 0; i < 12; i++) out += abc[r[i] % abc.length];
    $('#n-pw').value = out; $('#w-npw').classList.remove('bad'); $('#n-pw').focus(); $('#n-pw').select();
  });
  $('#n-pw').addEventListener('input', function () { $('#w-npw').classList.remove('bad'); });
  $('#pass-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = $('#n-pw').value; $('#w-npw').classList.toggle('bad', pw.length < 8);
    if (pw.length < 8) return $('#n-pw').focus();
    S.setPass(pw).then(function (ok) {
      if (ok === false) return toast('Пароль не изменён: ' + (S.lastError || 'ошибка'), true);
      $('#n-pw').value = ''; toast('Пароль изменён. Передайте новый пароль тем, у кого есть ссылка');
    });
  });
  $('#a-off').addEventListener('click', function () {
    confirmBox('Отключить кабинет на этом устройстве?', 'Чтобы снова включить его здесь, понадобятся ссылка доступа и пароль.', 'Отключить кабинет', function () { S.deactivate(); location.href = 'index.html'; });
  });

  /* На сервере сброса демо нет: данные настоящие */
  if (S.server) { var rb = $('#reset'); if (rb) { rb.parentNode.hidden = true; if (rb.parentNode.previousElementSibling) rb.parentNode.previousElementSibling.hidden = true; } }
  function renderAll() { renderProducts(); kitsLoad(); renderKits(); renderLeads(); renderSettings(); renderAccess(); }
  window.addEventListener('storage', function () { if (!app.hidden) { renderProducts(); renderLeads(); } });
})();
