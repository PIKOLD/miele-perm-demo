(function () {
  'use strict';
  var S = window.Store, esc = S.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  /* ---------- Доступ: кабинет работает только на устройствах, где открыли личную ссылку ---------- */
  var login = $('#login'), app = $('#app'), gate = $('#gate');
  function show(ok) {
    login.hidden = ok; app.hidden = !ok; gate.hidden = true;
    document.title = ok ? 'Кабинет салона — Miele Пермь' : 'Страница не найдена';
    if (ok) { renderAll(); openTab(location.hash === '#leads' ? 'leads' : 'products'); }
  }
  var link = location.hash.match(/^#k=([A-Za-z0-9_-]{20,})$/);
  (link ? S.activate(link[1]) : S.check(S.key())).then(function (ok) {
    if (link) history.replaceState(null, '', location.pathname);
    if (ok && !S.unlocked()) { gate.hidden = false; document.title = 'Кабинет салона — Miele Пермь'; return $('#pw').focus(); }
    show(ok);
  });
  $('form', gate).addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('button', gate); btn.disabled = true;
    S.checkPass($('#pw').value).then(function (ok) {
      btn.disabled = false; $('#pw-wrap').classList.toggle('bad', !ok);
      if (!ok) return $('#pw').focus();
      $('#pw').value = ''; S.unlock(); show(true);
    });
  });
  $('#pw').addEventListener('input', function () { $('#pw-wrap').classList.remove('bad'); });

  /* ---------- Общие ---------- */
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
    ['products', 'leads', 'settings', 'users'].forEach(function (n) { $('#tab-' + n).hidden = n !== name; });
  }
  $$('.tab').forEach(function (b) { b.addEventListener('click', function () { openTab(b.dataset.tab); }); });

  /* ---------- Товары ---------- */
  var filter = 'all', query = '', asort = 'default';
  var num = function (p) { return typeof p.price === 'number'; };
  var ASORT = {
    'stock-asc': function (a, b) { return (a.stock || 0) - (b.stock || 0); },
    'stock-desc': function (a, b) { return (b.stock || 0) - (a.stock || 0); },
    'price-asc': function (a, b) { return num(a) && num(b) ? a.price - b.price : num(b) - num(a); },
    'price-desc': function (a, b) { return num(a) && num(b) ? b.price - a.price : num(b) - num(a); },
    name: function (a, b) { return a.title.localeCompare(b.title, 'ru'); },
    cat: function (a, b) { return a.category.localeCompare(b.category, 'ru') || a.title.localeCompare(b.title, 'ru'); }
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

    var q = query.trim().toLowerCase();
    var list = all.filter(function (p) {
      if (filter === 'hidden' ? p.visible !== false : filter !== 'all' && bucket(p) !== filter) return false;
      return !q || (p.title + ' ' + (p.model || '') + ' ' + (p.sku || '')).toLowerCase().indexOf(q) >= 0;
    });
    if (ASORT[asort]) list = list.map(function (p, i) { return [p, i]; }).sort(function (a, b) { return ASORT[asort](a[0], b[0]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
    if (!all.length) { $('#list').innerHTML = '<div class="none"><p>В каталоге пока нет товаров.</p><button class="abtn abtn--pri" type="button" data-add>+ Добавить первый товар</button></div>'; return; }
    if (!list.length) { $('#list').innerHTML = '<div class="none"><p>Под этот фильтр ничего не подходит.</p><button class="abtn" type="button" data-clear>Показать все товары</button></div>'; return; }
    $('#list').innerHTML = '<table class="tbl"><thead><tr><th></th><th>Товар</th><th>Категория</th><th>Цена</th><th>Остаток, шт.</th><th>Уровень</th><th>На сайте</th><th></th></tr></thead><tbody>' +
      list.map(function (p) {
        var st = S.status(p);
        return '<tr data-id="' + esc(p.id) + '"' + (p.visible === false ? ' class="hid"' : '') + '>' +
          '<td><div class="thumb">' + ((p.images || [])[0] ? '<img src="' + esc(p.images[0]) + '" alt="">' : '') + '</div></td>' +
          '<td class="c-name"><div class="pname">' + esc(p.title) + '<small>' + esc(p.model || '') + '</small></div></td>' +
          '<td class="c-cat">' + esc(p.category) + '</td>' +
          '<td class="c-price num">' + S.price(p.price) + '</td>' +
          '<td class="c-stock"><div class="step"><button type="button" data-d="-1" aria-label="Уменьшить остаток">−</button><input type="number" min="0" step="1" inputmode="numeric" value="' + (parseInt(p.stock, 10) || 0) + '" aria-label="Остаток: ' + esc(p.title) + '"><button type="button" data-d="1" aria-label="Увеличить остаток">+</button></div></td>' +
          '<td class="c-lvl"><span class="lvl">' + bars(st) + '<small>мало ≤ ' + (p.low || 1) + ' · много ≥ ' + (p.high || 2) + '</small></span></td>' +
          '<td class="c-vis"><label class="sw"><input type="checkbox" data-vis' + (p.visible !== false ? ' checked' : '') + ' aria-label="Показывать на сайте: ' + esc(p.title) + '"><span></span></label></td>' +
          '<td class="acts"><button class="abtn abtn--ghost" type="button" data-edit>Изменить</button><button class="abtn abtn--ghost" type="button" data-del>Удалить</button></td></tr>';
      }).join('') + '</tbody></table>';
  }

  function patch(id, fn) {
    var list = S.products(), p = list.filter(function (x) { return x.id === id; })[0];
    if (!p) return; fn(p); if (save(list)) renderProducts();
  }
  $('#tiles').addEventListener('click', function (e) { var b = e.target.closest('.tile'); if (b) { filter = b.dataset.f; renderProducts(); } });
  $('#q').addEventListener('input', function (e) { query = e.target.value; renderProducts(); });
  $('#asort').addEventListener('change', function (e) { asort = e.target.value; renderProducts(); });
  $('#add').addEventListener('click', function () { edit(null); });
  $('#list').addEventListener('click', function (e) {
    if (e.target.closest('[data-add]')) return edit(null);
    if (e.target.closest('[data-clear]')) { filter = 'all'; query = ''; $('#q').value = ''; return renderProducts(); }
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
    if (e.target.matches('[data-vis]')) return patch(tr.dataset.id, function (p) { p.visible = e.target.checked; });
    if (e.target.matches('.step input')) return patch(tr.dataset.id, function (p) { p.stock = Math.max(0, parseInt(e.target.value, 10) || 0); });
  });

  /* ---------- Редактор ---------- */
  var ed = $('#editor'), ef = $('form', ed), editing = null, pics = [];
  function drawPics() {
    $('#e-pics').innerHTML = pics.length ? pics.map(function (src, i) {
      return '<div class="pic"><img src="' + esc(src) + '" alt=""><button type="button" data-rm="' + i + '" aria-label="Убрать фото ' + (i + 1) + '">×</button></div>';
    }).join('') : '<p class="hint" style="margin:0">Фото пока нет.</p>';
  }
  function drawNow() {
    var st = S.status({ stock: ef.elements.stock.value, low: ef.elements.low.value, high: ef.elements.high.value, orderable: ef.elements.orderable.checked });
    $('#e-now').innerHTML = 'На сайте сейчас: ' + '<span class="stock stock--' + st.key + '"><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>' + esc(st.label) + '</span><span style="color:var(--muted)">(' + esc(st.admin.toLowerCase()) + ')</span>';
  }
  function edit(id) {
    var cfg = S.settings();
    var p = id ? S.product(id) : { title: '', model: '', sku: '', category: '', country: '', price: null, stock: 0, low: cfg.lowDefault, high: cfg.highDefault, orderable: true, visible: true, images: [], description: '', features: [], specs: [] };
    editing = id; pics = (p.images || []).slice();
    $('#ed-title').textContent = id ? 'Изменить товар' : 'Новый товар';
    var el = ef.elements;
    el.title.value = p.title; el.model.value = p.model || ''; el.sku.value = p.sku || ''; el.category.value = p.category || ''; el.country.value = p.country || '';
    el.price.value = typeof p.price === 'number' ? p.price : '';
    el.stock.value = parseInt(p.stock, 10) || 0; el.low.value = p.low || cfg.lowDefault; el.high.value = p.high || cfg.highDefault;
    el.orderable.checked = p.orderable !== false; el.visible.checked = p.visible !== false;
    el.description.value = p.description || '';
    el.features.value = (p.features || []).join('\n');
    el.specs.value = (p.specs || []).map(function (s) { return s[0] + ': ' + s[1]; }).join('\n');
    var cats = []; S.products().forEach(function (x) { if (cats.indexOf(x.category) < 0) cats.push(x.category); });
    $('#cats').innerHTML = cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
    $$('.bad', ef).forEach(function (n) { n.classList.remove('bad'); });
    drawPics(); drawNow(); ed.showModal(); $('.editor__b', ed).scrollTop = 0; el.title.focus();
  }
  ['stock', 'low', 'high'].forEach(function (n) { ef.elements[n].addEventListener('input', drawNow); });
  ef.elements.orderable.addEventListener('change', drawNow);
  ef.elements.title.addEventListener('input', function () { if (this.value.trim()) $('#w-title').classList.remove('bad'); });
  ef.elements.category.addEventListener('input', function () { if (this.value.trim()) $('#w-cat').classList.remove('bad'); });
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
        pics.push(data); drawPics(); URL.revokeObjectURL(url);
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
    var low = Math.max(1, parseInt(el.low.value, 10) || 1);
    var data = {
      title: title, model: el.model.value.trim(), sku: el.sku.value.trim(), category: cat, country: el.country.value.trim(),
      price: el.price.value === '' ? null : Math.max(0, Math.round(+el.price.value)),
      stock: Math.max(0, parseInt(el.stock.value, 10) || 0), low: low, high: Math.max(low + 1, parseInt(el.high.value, 10) || low + 1),
      orderable: el.orderable.checked, visible: el.visible.checked, images: pics.slice(),
      description: el.description.value.trim(),
      features: el.features.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      specs: el.specs.value.split('\n').map(function (s) { var i = s.indexOf(':'); return i > 0 ? [s.slice(0, i).trim(), s.slice(i + 1).trim()] : null; }).filter(function (s) { return s && s[0] && s[1]; })
    };
    var list = S.products();
    if (editing) list = list.map(function (p) { if (p.id !== editing) return p; data.id = p.id; return data; });
    else { data.id = 'p' + Date.now().toString(36); list.unshift(data); }
    if (!save(list)) return;
    ed.close(); filter = 'all'; renderProducts(); toast(editing ? 'Изменения сохранены' : 'Товар добавлен');
  });

  /* ---------- Заявки ---------- */
  function renderLeads() {
    var l = S.leads(), fresh = l.filter(function (x) { return !x.done; }).length, badge = $('#lead-badge');
    badge.hidden = !fresh; badge.textContent = fresh;
    $('#leads').innerHTML = l.length ? '<div class="leads">' + l.map(function (x) {
      var d = new Date(x.ts), when = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return '<div class="ld' + (x.done ? ' done' : '') + '" data-id="' + esc(x.id) + '"><div class="ld__who">' + esc(x.name) + '<a href="tel:+' + esc(x.phone.replace(/\D/g, '')) + '">' + esc(x.phone) + '</a></div>' +
        '<div class="ld__meta">' + esc(when) + (x.product ? ' · ' + esc(x.product) : ' · общий вопрос') + (x.done ? ' · обработана' : '') + '</div>' +
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

  /* ---------- Настройки и данные ---------- */
  var sf = $('#set-form');
  function renderSettings() {
    var c = S.settings(), el = sf.elements;
    ['lowDefault', 'highDefault', 'leadTime', 'phone', 'whatsapp', 'address', 'hours'].forEach(function (k) { el[k].value = c[k]; });
    el.showCount.checked = !!c.showCount;
  }
  sf.addEventListener('submit', function (e) {
    e.preventDefault();
    var c = S.settings(), el = sf.elements;
    c.lowDefault = Math.max(1, parseInt(el.lowDefault.value, 10) || 1);
    c.highDefault = Math.max(c.lowDefault + 1, parseInt(el.highDefault.value, 10) || c.lowDefault + 1);
    c.showCount = el.showCount.checked;
    ['leadTime', 'phone', 'address', 'hours'].forEach(function (k) { c[k] = el[k].value.trim(); });
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
    confirmBox('Сбросить демо?', 'Каталог вернётся к исходным 9 товарам, заявки и настройки будут очищены.', 'Сбросить демо', function () { S.reset(); filter = 'all'; renderAll(); toast('Демо-данные восстановлены'); });
  });

  /* ---------- Вкладка «Доступ» ---------- */
  function renderAccess() { $('#a-link').value = location.origin + location.pathname + '#k=' + S.key(); }
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
    S.setPass(pw).then(function () { $('#n-pw').value = ''; toast('Пароль изменён. Передайте новый пароль тем, у кого есть ссылка'); });
  });
  $('#a-off').addEventListener('click', function () {
    confirmBox('Отключить кабинет на этом устройстве?', 'Чтобы снова включить его здесь, понадобятся ссылка доступа и пароль.', 'Отключить кабинет', function () { S.deactivate(); location.href = 'index.html'; });
  });

  function renderAll() { renderProducts(); renderLeads(); renderSettings(); renderAccess(); }
  window.addEventListener('storage', function () { if (!app.hidden) { renderProducts(); renderLeads(); } });
})();
