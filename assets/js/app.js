(function () {
  'use strict';
  var S = window.Store, esc = S.esc, cfg = S.settings();
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var tel = '+' + cfg.phone.replace(/\D/g, '');
  var wa = function (text) { return 'https://wa.me/' + cfg.whatsapp + (text ? '?text=' + encodeURIComponent(text) : ''); };
  var visible = function () { return S.products().filter(function (p) { return p.visible !== false; }); };

  function stockHtml(p) {
    var st = S.status(p), text = st.label;
    if (st.key === 'low' && cfg.showCount) text += ' · ' + p.stock + ' шт.';
    if (st.key === 'order' && cfg.leadTime) text += ' · ' + cfg.leadTime;
    return '<span class="stock stock--' + st.key + '"><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>' + esc(text) + '</span>';
  }
  function priceHtml(p) {
    var ask = p.price === null || p.price === undefined || p.price === '';
    return '<span class="price' + (ask ? ' price--ask' : '') + '">' + S.price(p.price) + '</span>';
  }

  /* ---------- Шапка, подвал, cookie ---------- */
  function layout() {
    var home = $('body').dataset.page === 'home' ? '' : 'index.html';
    var links = [['#catalog', 'Каталог'], ['#sets', 'Комплекты'], ['#service', 'Сервис'], ['#salon', 'Салон']];
    var nav = links.map(function (l) { return '<a href="' + home + l[0] + '">' + l[1] + '</a>'; }).join('');
    $('#hdr').innerHTML =
      '<a class="skip" href="#main">Перейти к содержимому</a>' +
      '<header class="hdr"><div class="wrap hdr__in">' +
        '<div><button class="burger" aria-expanded="false" aria-controls="mnav" aria-label="Меню"><span></span></button><nav class="nav" aria-label="Основная навигация">' + nav + '</nav></div>' +
        '<a class="logo" href="index.html" aria-label="Miele Пермь — на главную"><img class="logo__img" src="assets/img/miele-logo.svg" alt="Miele" width="104" height="40"><span class="logo__city">Пермь</span></a>' +
        '<div class="hdr__right"><a class="hdr__tel" href="tel:' + tel + '">' + esc(cfg.phone) + '</a><a class="hdr__cta" href="' + home + '#ask">Оставить заявку</a>' +
          '<a class="hdr__icon" href="tel:' + tel + '" aria-label="Позвонить: ' + esc(cfg.phone) + '"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg></a></div>' +
      '</div></header>' +
      '<nav class="mnav" id="mnav" aria-label="Меню">' + nav + '<a href="' + home + '#ask">Оставить заявку</a><a class="mnav__tel" href="tel:' + tel + '">' + esc(cfg.phone) + '</a></nav>';

    var cats = [];
    visible().forEach(function (p) { if (cats.indexOf(p.category) < 0) cats.push(p.category); });
    $('#ftr').innerHTML =
      '<footer class="ftr"><div class="wrap"><div class="ftr__grid">' +
        '<div><a class="logo" href="index.html"><img class="logo__img" src="assets/img/miele-logo.svg" alt="Miele" width="104" height="40"><span class="logo__city">Пермь</span></a><p class="ftr__about">Фирменный салон бытовой техники Miele в Перми. Подбор, доставка, установка и сервис.</p></div>' +
        '<div><h3>Каталог</h3><ul>' + cats.map(function (c) { return '<li><a href="index.html?cat=' + encodeURIComponent(c) + '#catalog">' + esc(c) + '</a></li>'; }).join('') + '</ul></div>' +
        '<div><h3>Покупателям</h3><ul><li><a href="' + home + '#service">Доставка и установка</a></li><li><a href="' + home + '#salon">Как нас найти</a></li><li><a href="privacy.html">Политика обработки персональных данных</a></li><li><a href="consent.html">Согласие на обработку данных</a></li><li><a href="privacy.html#cookies">Файлы cookie</a></li></ul></div>' +
        '<div><h3>Контакты</h3><ul><li><a href="tel:' + tel + '">' + esc(cfg.phone) + '</a></li><li><a href="' + wa() + '" target="_blank" rel="noopener">WhatsApp</a></li><li>' + esc(cfg.address) + '</li><li>' + esc(cfg.hours) + '</li></ul></div>' +
      '</div><div class="ftr__legal">' +
        '<p>© ' + new Date().getFullYear() + ' Салон Miele, Пермь. Реквизиты продавца (наименование, ИНН, ОГРН) указываются здесь перед запуском сайта.</p>' +
        '<p>Информация на сайте носит справочный характер и не является публичной офертой (ст. 437 ГК РФ). Наличие, цены и характеристики уточняйте у консультантов салона. Miele — зарегистрированный товарный знак Miele &amp; Cie. KG.</p>' +
      '</div></div></footer>' +
      '<div class="ck" role="region" aria-label="Уведомление о cookie"><p>Сайт использует только технические файлы cookie и локальное хранилище — они нужны для его работы. <a href="privacy.html#cookies">Подробнее</a></p><button type="button">Понятно</button></div>';

    var burger = $('.burger'), mnav = $('#mnav');
    function toggle(open) { burger.setAttribute('aria-expanded', open ? 'true' : 'false'); mnav.classList.toggle('on', open); document.body.style.overflow = open ? 'hidden' : ''; }
    burger.addEventListener('click', function () { toggle(burger.getAttribute('aria-expanded') !== 'true'); });
    mnav.addEventListener('click', function (e) { if (e.target.closest('a')) toggle(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });

    var ck = $('.ck'), seen = false;
    try { seen = localStorage.getItem('mp.ck') === '1'; } catch (e) {}
    if (!seen) ck.classList.add('on');
    $('button', ck).addEventListener('click', function () { ck.classList.remove('on'); try { localStorage.setItem('mp.ck', '1'); } catch (e) {} });
  }

  /* ---------- Каталог ---------- */
  function catalog() {
    var grid = $('#grid'); if (!grid) return;
    var list = visible(), cat = new URLSearchParams(location.search).get('cat') || '', only = false, sort = 'default';
    var num = function (p) { return typeof p.price === 'number'; };
    var SORT = {
      stock: function (a, b) { return S.status(b).level - S.status(a).level || (b.stock || 0) - (a.stock || 0); },
      'price-asc': function (a, b) { return num(a) && num(b) ? a.price - b.price : num(b) - num(a); },
      'price-desc': function (a, b) { return num(a) && num(b) ? b.price - a.price : num(b) - num(a); },
      name: function (a, b) { return a.title.localeCompare(b.title, 'ru'); }
    };
    try { sort = sessionStorage.getItem('mp.sort') || 'default'; } catch (e) {}
    if (!SORT[sort]) sort = 'default';
    $('#sort').value = sort;
    var cats = []; list.forEach(function (p) { if (cats.indexOf(p.category) < 0) cats.push(p.category); });
    if (cats.indexOf(cat) < 0) cat = '';
    var filters = $('#filters');
    function draw() {
      filters.innerHTML = [''].concat(cats).map(function (c) {
        return '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (c === cat) + '">' + esc(c || 'Все товары') + '</button>';
      }).join('');
      var shown = list.filter(function (p) { return (!cat || p.category === cat) && (!only || S.status(p).level > 0); });
      if (SORT[sort]) shown = shown.map(function (p, i) { return [p, i]; }).sort(function (a, b) { return SORT[sort](a[0], b[0]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
      $('#count').textContent = shown.length + ' ' + S.plural(shown.length, 'товар', 'товара', 'товаров');
      grid.innerHTML = shown.length ? shown.map(function (p) {
        return '<a class="card" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
          '<div class="card__pic"><img src="' + esc((p.images || [])[0] || '') + '" alt="' + esc(p.title) + '" loading="lazy" width="600" height="600"></div>' +
          '<div class="card__body"><span class="card__cat">' + esc(p.category) + '</span><span class="card__title">' + esc(p.title) + '</span>' +
          '<div class="card__foot">' + stockHtml(p) + priceHtml(p) + '</div></div></a>';
      }).join('') : '<div class="empty"><p>По этим условиям сейчас ничего нет в наличии. Нужную модель привезём под заказ.</p><button type="button" class="btn btn--line" id="reset">Показать все товары</button></div>';
    }
    filters.addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (b) { cat = b.dataset.cat; draw(); } });
    $('#only').addEventListener('change', function (e) { only = e.target.checked; draw(); });
    $('#sort').addEventListener('change', function (e) { sort = e.target.value; try { sessionStorage.setItem('mp.sort', sort); } catch (er) {} draw(); });
    grid.addEventListener('click', function (e) { if (e.target.id === 'reset') { cat = ''; only = false; $('#only').checked = false; draw(); } });
    draw();
  }

  /* ---------- Комплекты ---------- */
  function sets() {
    var box = $('#setlist'); if (!box) return;
    var html = cfg.sets.map(function (set) {
      var items = set.ids.map(S.product).filter(function (p) { return p && p.visible !== false; });
      if (items.length < 2) return '';
      var known = items.every(function (p) { return typeof p.price === 'number'; });
      var sum = items.reduce(function (a, p) { return a + (p.price || 0); }, 0);
      return '<div class="set"><div class="set__top"><h3>' + esc(set.title) + '</h3><span class="price' + (known ? '' : ' price--ask') + '">' + (known ? S.price(sum) : 'Цена по запросу') + '</span></div>' +
        '<p class="set__note">' + esc(set.note) + '</p><ul>' + items.map(function (p) {
          return '<li><a href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.title) + '</a><span>' + (typeof p.price === 'number' ? S.price(p.price) : 'по запросу') + '</span></li>';
        }).join('') + '</ul></div>';
    }).join('');
    if (html) box.innerHTML = html; else $('#sets').hidden = true;
  }

  /* ---------- Заявка ---------- */
  function leadForm(box, product) {
    if (!box) return;
    box.innerHTML =
      '<form class="form" novalidate>' +
        (product ? '<p class="ask__about">Товар: <b>' + esc(product.title) + '</b></p>' : '') +
        '<div class="fld"><label for="f-name">Имя</label><input id="f-name" name="name" autocomplete="given-name" required><p class="err" id="e-name">Напишите, как к вам обращаться</p></div>' +
        '<div class="fld"><label for="f-phone">Телефон</label><input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" required><p class="err" id="e-phone">Проверьте номер: нужно не меньше 10 цифр</p></div>' +
        '<div class="fld"><label for="f-msg">Комментарий <span style="color:var(--muted);font-weight:400">— необязательно</span></label><textarea id="f-msg" name="comment" rows="3"></textarea></div>' +
        '<label class="agree"><input type="checkbox" name="agree" required><span>Я даю <a href="consent.html" target="_blank">согласие на обработку персональных данных</a> и ознакомлен(а) с <a href="privacy.html" target="_blank">политикой обработки персональных данных</a></span></label>' +
        '<button class="btn btn--m" type="submit">Отправить заявку</button>' +
        '<p class="form__note">Перезвоним в рабочее время: ' + esc(cfg.hours) + '.</p>' +
      '</form>';
    var form = $('form', box), name = form.elements.name, phone = form.elements.phone, agree = form.elements.agree;
    var okName = function () { return name.value.trim().length >= 2; };
    var okPhone = function () { return phone.value.replace(/\D/g, '').length >= 10; };
    function mark(input, ok, errId) {
      input.closest('.fld').classList.toggle('bad', !ok);
      input.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (ok) input.removeAttribute('aria-describedby'); else input.setAttribute('aria-describedby', errId);
      return ok;
    }
    name.addEventListener('blur', function () { if (name.value) mark(name, okName(), 'e-name'); });
    phone.addEventListener('blur', function () { if (phone.value) mark(phone, okPhone(), 'e-phone'); });
    name.addEventListener('input', function () { if (okName()) mark(name, true); });
    phone.addEventListener('input', function () { if (okPhone()) mark(phone, true); });
    agree.addEventListener('change', function () { if (agree.checked) agree.closest('.agree').classList.remove('bad'); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var a = mark(name, okName(), 'e-name'), b = mark(phone, okPhone(), 'e-phone');
      agree.closest('.agree').classList.toggle('bad', !agree.checked);
      if (!a) return name.focus();
      if (!b) return phone.focus();
      if (!agree.checked) return agree.focus();
      S.addLead({ name: name.value.trim(), phone: phone.value.trim(), comment: form.elements.comment.value.trim(), productId: product ? product.id : '', product: product ? product.title : '' });
      box.innerHTML = '<div class="done" role="status" tabindex="-1"><h3>Заявка принята</h3><p>Спасибо, ' + esc(name.value.trim()) + '. Перезвоним в рабочее время: ' + esc(cfg.hours) + '.</p>' + '</div>';
      $('.done', box).focus();
    });
  }

  /* ---------- Страница товара ---------- */
  function productPage() {
    var root = $('#product'); if (!root) return;
    var p = S.product(new URLSearchParams(location.search).get('id'));
    if (!p || p.visible === false) {
      root.innerHTML = '<div class="wrap doc"><h1>Товар не найден</h1><p class="lead">Возможно, его сняли с продажи. Посмотрите каталог или спросите нас — подберём замену.</p><p style="margin-top:28px"><a class="btn" href="index.html#catalog">Открыть каталог</a></p></div>';
      return;
    }
    document.title = p.title + ' — Miele Пермь';
    var imgs = p.images && p.images.length ? p.images : [''];
    var meta = [p.model && 'Модель ' + p.model, p.sku && 'Арт. ' + p.sku, p.country && 'Производство: ' + p.country].filter(Boolean).join(' · ');
    var st = S.status(p);
    root.innerHTML =
      '<div class="wrap"><nav class="crumbs" aria-label="Навигация"><a href="index.html">Главная</a> / <a href="index.html?cat=' + encodeURIComponent(p.category) + '#catalog">' + esc(p.category) + '</a> / ' + esc(p.model || p.title) + '</nav>' +
      '<div class="pd"><div class="gal"><div class="gal__main"><img id="gal-main" src="' + esc(imgs[0]) + '" alt="' + esc(p.title) + '" width="900" height="900"></div>' +
        (imgs.length > 1 ? '<div class="gal__th">' + imgs.map(function (src, i) { return '<button type="button" data-i="' + i + '" aria-current="' + (i === 0) + '" aria-label="Фото ' + (i + 1) + '"><img src="' + esc(src) + '" alt="" loading="lazy"></button>'; }).join('') + '</div>' : '') + '</div>' +
      '<div class="pd__info"><p class="eyebrow">' + esc(p.category) + '</p><h1>' + esc(p.title) + '</h1><p class="pd__meta">' + esc(meta) + '</p>' +
        '<div class="pd__buy">' + priceHtml(p) + stockHtml(p) +
          '<div class="pd__btns"><a class="btn" href="#ask">' + (st.level > 0 ? 'Оставить заявку' : 'Заказать') + '</a><a class="btn btn--line" target="_blank" rel="noopener" href="' + wa('Здравствуйте! Интересует ' + p.title + '. Подскажите по наличию.') + '">WhatsApp</a></div>' +
          '<p class="pd__hint">' + (st.level > 0 ? 'Товар можно посмотреть в салоне: ' + esc(cfg.address) + '.' : 'Привезём под заказ' + (cfg.leadTime ? ' — ' + esc(cfg.leadTime) : '') + '. Точный срок назовёт консультант.') + '</p></div>' +
        (p.features && p.features.length ? '<ul class="feat">' + p.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
      '</div></div></div>' +
      '<section class="sec sec--soft"><div class="wrap pd__more"><div><h2>Описание</h2><p>' + esc(p.description) + '</p></div>' +
        (p.specs && p.specs.length ? '<div><h2>Характеристики</h2><table class="specs"><tbody>' + p.specs.map(function (s) { return '<tr><th scope="row">' + esc(s[0]) + '</th><td>' + esc(s[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      '</div></section>' +
      '<section class="sec" id="ask"><div class="wrap ask"><div><p class="eyebrow">Заявка</p><h2>Узнать о наличии и заказать</h2><p class="lead">Оставьте телефон — консультант подтвердит наличие, расскажет об условиях доставки и установки.</p></div><div id="lead"></div></div></section>';
    var main = $('#gal-main'), wrapEl = main.parentNode;
    function fit() { wrapEl.classList.toggle('cover', main.naturalWidth > main.naturalHeight * 1.25); }
    main.addEventListener('load', fit); if (main.complete) fit();
    root.addEventListener('click', function (e) {
      var b = e.target.closest('.gal__th button'); if (!b) return;
      main.src = imgs[+b.dataset.i];
      root.querySelectorAll('.gal__th button').forEach(function (x) { x.setAttribute('aria-current', x === b ? 'true' : 'false'); });
    });
    leadForm($('#lead'), p);
  }

  /* ---------- Контакты салона на главной ---------- */
  function contacts() {
    document.querySelectorAll('[data-cfg]').forEach(function (el) {
      var k = el.dataset.cfg;
      if (k === 'tel') { el.textContent = cfg.phone; el.href = 'tel:' + tel; }
      else if (k === 'wa') el.href = wa('Здравствуйте! Хочу проконсультироваться по технике Miele.');
      else if (k === 'gis' || k === 'ymaps') el.href = cfg[k];
      else el.textContent = cfg[k];
    });
  }

  layout(); catalog(); sets(); contacts(); productPage();
  S.isOwner().then(function (ok) {
    if (!ok) return;
    var bar = document.createElement('div'); bar.className = 'demo';
    bar.innerHTML = 'Кабинет включён на этом устройстве. <a href="kabinet.html">Товары, остатки и заявки</a>';
    $('#hdr').insertBefore(bar, $('#hdr .hdr'));
  });
  leadForm($('#lead-home'));
})();
