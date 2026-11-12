(function () {
  'use strict';
  var S = window.Store, esc = S.esc, cfg = S.settings();
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var digits = function (s) { return '+' + String(s || '').replace(/\D/g, ''); };
  var tel = digits(cfg.phone), tel2 = cfg.phone2 ? digits(cfg.phone2) : '';
  var wa = function (text) { return 'https://wa.me/' + cfg.whatsapp + (text ? '?text=' + encodeURIComponent(text) : ''); };
  var tg = S.tgLink();
  var SALE = 'sale', SETS = 'sets';
  /* Значки мессенджеров для PDF-предложения (Simple Icons, фирменные цвета) */
  var ICON_WA = '<svg viewBox="0 0 24 24" role="img" aria-label="WhatsApp" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
  var ICON_TG = '<svg viewBox="0 0 24 24" role="img" aria-label="Telegram" fill="#26A5E4"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>';
  var visible = function () { return S.products().filter(function (p) { return p.visible !== false; }); };
  var lead = cfg.leadTime ? ' ' + cfg.leadTime : '';

  function stockHtml(p) {
    var st = S.status(p), text = st.label;
    if (st.key === 'low' && cfg.showCount) text += ' · ' + p.stock + ' шт.';
    if (st.key === 'order' && cfg.leadTime) text += ' · ' + cfg.leadTime;
    return '<span class="stock stock--' + st.key + '"><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>' + esc(text) + '</span>';
  }
  /* Цена. Если задана старая цена — она зачёркнута, новая выделена */
  function priceHtml(p) {
    if (S.onSale(p)) return '<span class="price price--sale"><s><span class="sr">Старая цена </span>' + S.price(p.oldPrice) + '</s><b><span class="sr">Цена со скидкой </span>' + S.price(p.price) + '</b></span>';
    var ask = p.price === null || p.price === undefined || p.price === '';
    return '<span class="price' + (ask ? ' price--ask' : '') + '">' + S.price(p.price) + '</span>';
  }
  function saleBadge(p) { return S.onSale(p) ? '<span class="sale">−' + Math.max(1, Math.round((1 - p.price / p.oldPrice) * 100)) + '%</span>' : ''; }
  /* Метка «Есть в шоуруме»: образец выставлен в зале (галочка в кабинете) */
  function showTag(p) { return p.showroom ? '<span class="inshow">Есть в шоуруме</span>' : ''; }
  function addLabel(id) { var n = S.cart()[id]; return n ? 'В корзине · ' + n + ' шт.' : 'В корзину'; }
  function cartCount() {
    var n = S.cartCount();
    document.querySelectorAll('[data-cart-n]').forEach(function (el) { el.textContent = n; el.hidden = !n; });
  }

  /* ---------- Шапка, подвал, cookie ---------- */
  function layout() {
    var home = $('body').dataset.page === 'home' ? '' : 'index.html';
    var links = [[home + '#catalog', 'Каталог', ''], ['index.html?cat=' + SALE + '#catalog', 'Акции', SALE], [home + '#showroom', 'Шоурум', null], [home + '#service', 'Сервис', null]];
    var nav = links.map(function (l) { return '<a href="' + l[0] + '"' + (l[2] !== null ? ' data-cat="' + l[2] + '"' : '') + '>' + l[1] + '</a>'; }).join('');
    var bag = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>';
    $('#hdr').innerHTML =
      '<a class="skip" href="#main">Перейти к содержимому</a>' +
      '<header class="hdr"><div class="wrap hdr__in">' +
        '<div><button class="burger" aria-expanded="false" aria-controls="mnav" aria-label="Меню"><span></span></button><nav class="nav" aria-label="Основная навигация">' + nav + '</nav></div>' +
        '<a class="logo" href="index.html" aria-label="Miele Пермь — на главную"><img class="logo__img" src="assets/img/miele-logo.svg" alt="Miele" width="104" height="40"></a>' +
        '<div class="hdr__right"><a class="hdr__tel" href="tel:' + tel + '">' + esc(cfg.phone) + '</a>' +
          '<a class="hdr__icon" href="tel:' + tel + '" aria-label="Позвонить: ' + esc(cfg.phone) + '"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg></a>' +
          '<a class="hdr__cart" href="cart.html" aria-label="Корзина">' + bag + '<span class="hdr__n" data-cart-n hidden></span></a>' +
          '<a class="hdr__cta" href="' + home + '#ask">Оставить заявку</a></div>' +
      '</div></header>' +
      '<nav class="mnav" id="mnav" aria-label="Меню">' + nav + '<a href="cart.html">Корзина</a><a href="' + home + '#ask">Оставить заявку</a>' +
        '<a class="mnav__tel" href="tel:' + tel + '">' + esc(cfg.phone) + '</a>' + (tel2 ? '<a class="mnav__tel2" href="tel:' + tel2 + '">' + esc(cfg.phone2) + '</a>' : '') + '</nav>';

    $('#ftr').innerHTML =
      '<footer class="ftr"><div class="wrap"><div class="ftr__grid">' +
        '<div><a class="logo" href="index.html"><img class="logo__img" src="assets/img/miele-logo.svg" alt="Miele" width="104" height="40"></a><p class="ftr__about">Фирменный шоурум бытовой техники Miele в Перми. Подбор, доставка, установка и сервис.</p></div>' +
        '<div><h3>Каталог</h3><ul><li><a href="index.html?cat=' + SALE + '#catalog" data-cat="' + SALE + '">Акции</a></li><li><a href="index.html?cat=' + SETS + '#catalog" data-cat="' + SETS + '">Комплекты</a></li>' + S.cats().map(function (c) { return '<li><a href="index.html?cat=' + encodeURIComponent(c) + '#catalog" data-cat="' + esc(c) + '">' + esc(c) + '</a></li>'; }).join('') + '</ul></div>' +
        '<div><h3>Покупателям</h3><ul><li><a href="cart.html">Корзина</a></li><li><a href="' + home + '#service">Доставка и установка</a></li><li><a href="' + home + '#showroom">Как нас найти</a></li><li><a href="privacy.html">Политика обработки персональных данных</a></li><li><a href="consent.html">Согласие на обработку данных</a></li><li><a href="privacy.html#cookies">Файлы cookie</a></li></ul></div>' +
        '<div><h3>Контакты</h3><ul><li><a href="tel:' + tel + '">' + esc(cfg.phone) + '</a></li>' + (tel2 ? '<li><a href="tel:' + tel2 + '">' + esc(cfg.phone2) + '</a></li>' : '') +
          '<li><a href="' + wa() + '" target="_blank" rel="noopener">WhatsApp</a></li>' + (tg ? '<li><a href="' + esc(tg) + '" target="_blank" rel="noopener">Telegram</a></li>' : '') +
          '<li>' + esc(cfg.address) + '</li><li>' + esc(cfg.hours) + '</li></ul></div>' +
      '</div><div class="ftr__legal">' +
        '<p>© ' + new Date().getFullYear() + ' Шоурум Miele, Пермь. Реквизиты продавца (наименование, ИНН, ОГРН) указываются здесь перед запуском сайта.</p>' +
        '<p>Информация на сайте носит справочный характер и не является публичной офертой (ст. 437 ГК РФ). Наличие, цены и характеристики уточняйте у консультантов шоурума. Miele — зарегистрированный товарный знак Miele &amp; Cie. KG.</p>' +
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
    cartCount();
  }

  /* ---------- Каталог: папки разделов, внутри папки — товары ---------- */
  function setItems(set) { return set.ids.map(S.product).filter(function (p) { return p && p.visible !== false; }); }
  function addSet(i) {
    setItems(cfg.sets[i]).forEach(function (p) { if (S.status(p).key !== 'out') S.cartAdd(p.id); });
    cartCount();
  }
  function catalog() {
    var grid = $('#grid'); if (!grid) return;
    var list = visible(), cats = S.cats(), only = false, sort = 'default';
    var folders = $('#folders'), tools = $('#cat-tools'), title = $('#cat-title'), back = $('#cat-back');
    var num = function (p) { return typeof p.price === 'number'; };
    var kits = S.kits();
    var valid = function (c) { return c === SALE || (c === SETS && kits.length > 0) || cats.indexOf(c) >= 0; };
    var fromUrl = function () { var c = new URLSearchParams(location.search).get('cat') || ''; return valid(c) ? c : ''; };
    var cat = fromUrl();
    var NAMES = {}; NAMES[SALE] = 'Акции'; NAMES[SETS] = 'Комплекты';
    var SHOW = /выставочн/i;
    var inCat = function (c) { return list.filter(function (p) { return c === SALE ? S.onSale(p) : p.category === c; }); };
    var SORT = {
      stock: function (a, b) { return S.status(b).level - S.status(a).level || (b.stock || 0) - (a.stock || 0); },
      'price-asc': function (a, b) { return num(a) && num(b) ? a.price - b.price : num(b) - num(a); },
      'price-desc': function (a, b) { return num(a) && num(b) ? b.price - a.price : num(b) - num(a); },
      name: function (a, b) { return a.title.localeCompare(b.title, 'ru'); }
    };
    try { sort = sessionStorage.getItem('mp.sort') || 'default'; } catch (e) {}
    if (!SORT[sort]) sort = 'default';
    $('#sort').value = sort;

    /* Порядок папок: акции, разделы, комплекты — сразу после стиральных и сушильных машин */
    function order() {
      var out = cats.slice(), at = Math.max(out.indexOf('Стиральные машины'), out.indexOf('Сушильные машины')) + 1;
      if (kits.length) out.splice(at, 0, SETS);
      return [SALE].concat(out);
    }
    function folder(c) {
      var n = c === SETS ? kits.length : inCat(c).length, pic, cls = '';
      var count = c === SETS ? n + ' ' + S.plural(n, 'комплект', 'комплекта', 'комплектов')
        : n ? n + ' ' + S.plural(n, 'товар', 'товара', 'товаров') : (c === SALE || SHOW.test(c) ? 'Сейчас нет' : 'Под заказ');
      if (c === SALE) { pic = '<span class="folder__pct" aria-hidden="true">%</span>'; cls = ' folder--sale'; }
      else if (c === SETS) {
        cls = ' folder--duo';
        pic = kits[0].items.slice(0, 2).map(function (p) { return '<img src="' + esc((p.images || [])[0] || '') + '" alt="">'; }).join('');
      } else {
        var src = (cfg.catImages || {})[c] || ((inCat(c)[0] || {}).images || [])[0];
        pic = src ? '<img src="' + esc(src) + '" alt="">' : '<img class="folder__logo" src="assets/img/miele-logo.svg" alt="">';
        if (src && src.indexOf('/mood/') >= 0) cls = ' folder--cover';
      }
      return '<a class="folder' + cls + '" href="index.html?cat=' + encodeURIComponent(c) + '#catalog" data-cat="' + esc(c) + '"><span class="folder__pic">' + pic + '</span>' +
        '<span class="folder__name">' + esc(NAMES[c] || c) + '</span><span class="folder__n">' + count + '</span></a>';
    }
    function kitCard(k) {
      var price = k.sum === null ? '<span class="price price--ask">Цена по запросу</span>'
        : k.off ? '<span class="price price--sale"><s><span class="sr">По отдельности </span>' + S.price(k.full) + '</s><b><span class="sr">Комплектом </span>' + S.price(k.sum) + '</b></span>'
        : '<span class="price">' + S.price(k.sum) + '</span>';
      return '<div class="card kit"><div class="kit__pics">' + k.items.map(function (p) {
          return '<a href="product.html?id=' + encodeURIComponent(p.id) + '" tabindex="-1" aria-hidden="true"><img src="' + esc((p.images || [])[0] || '') + '" alt="" loading="lazy"></a>';
        }).join('') + '</div>' +
        '<div class="card__body"><span class="card__cat">' + esc(k.set.note) + '</span><span class="card__title">' + esc(k.set.title) + '</span>' +
        '<ul class="kit__list">' + k.items.map(function (p, n) {
          return '<li><a href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.title) + '</a><span>' + (k.prices[n] === null ? 'по запросу' : S.price(k.prices[n])) + '</span></li>';
        }).join('') + '</ul>' +
        '<div class="card__foot"><span class="kit__lbl">Комплект</span>' + price + '</div></div>' +
        '<button type="button" class="card__add" data-set="' + k.i + '">Добавить комплект в корзину</button></div>';
    }
    function draw() {
      var root = !cat;
      folders.hidden = !root; grid.hidden = root; back.hidden = root; tools.hidden = root || cat === SETS;
      title.textContent = root ? 'Каталог' : NAMES[cat] || cat;
      if (root) { folders.innerHTML = order().map(folder).join(''); return; }
      grid.classList.toggle('grid--kits', cat === SETS);
      if (cat === SETS) { grid.innerHTML = kits.map(kitCard).join(''); return; }
      var all = inCat(cat);
      var shown = all.filter(function (p) { return !only || S.status(p).level > 0; });
      if (SORT[sort]) shown = shown.map(function (p, i) { return [p, i]; }).sort(function (a, b) { return SORT[sort](a[0], b[0]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
      $('#count').textContent = shown.length + ' ' + S.plural(shown.length, 'товар', 'товара', 'товаров');
      var none = !all.length
        ? (cat === SALE ? 'Сейчас акционных предложений нет. О новых акциях расскажут консультанты шоурума.' : SHOW.test(cat) ? 'Сейчас выставочных образцов в продаже нет. О новых предложениях расскажут консультанты шоурума.' : 'В этом разделе товары скоро появятся на сайте. Нужную модель привезём под заказ' + lead + ' — позвоните или напишите нам.')
        : 'В этом разделе сейчас ничего нет в наличии. Нужную модель привезём под заказ' + lead + '.';
      grid.innerHTML = shown.length ? shown.map(function (p) {
        return '<div class="card"><a class="card__main" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
          '<div class="card__pic">' + saleBadge(p) + '<img src="' + esc((p.images || [])[0] || '') + '" alt="' + esc(p.title) + '" loading="lazy" width="600" height="600"></div>' +
          '<div class="card__body"><span class="card__cat">' + esc(p.category) + '</span><span class="card__title">' + esc(p.title) + '</span>' +
          showTag(p) + '<div class="card__foot">' + stockHtml(p) + priceHtml(p) + '</div></div></a>' +
          (S.status(p).key !== 'out' ? '<button type="button" class="card__add" data-add="' + esc(p.id) + '">' + addLabel(p.id) + '</button>' : '') + '</div>';
      }).join('') : '<div class="empty"><p>' + esc(none) + '</p><button type="button" class="btn btn--line" id="reset">Все разделы</button></div>';
    }
    /* Открыть папку (или вернуться к списку папок). Кнопка «Назад» в браузере возвращает к папкам */
    function go(c, push) {
      cat = valid(c) ? c : ''; only = false; $('#only').checked = false;
      if (push) { try { history.pushState(null, '', (cat ? '?cat=' + encodeURIComponent(cat) : location.pathname) + '#catalog'); } catch (e) {} }
      draw();
      if (push) $('#catalog').scrollIntoView();
    }
    $('#only').addEventListener('change', function (e) { only = e.target.checked; draw(); });
    $('#sort').addEventListener('change', function (e) { sort = e.target.value; try { sessionStorage.setItem('mp.sort', sort); } catch (er) {} draw(); });
    back.addEventListener('click', function () { go('', true); });
    grid.addEventListener('click', function (e) {
      if (e.target.id === 'reset') return go('', true);
      var s = e.target.closest('[data-set]');
      if (s) { addSet(+s.dataset.set); s.textContent = 'Комплект в корзине'; s.classList.add('on'); return; }
      var b = e.target.closest('[data-add]'); if (!b) return;
      S.cartAdd(b.dataset.add); b.textContent = addLabel(b.dataset.add); b.classList.add('on'); cartCount();
    });
    /* Ссылки на разделы из меню и подвала на главной открывают папку без перезагрузки */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-cat]'); if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault(); go(a.dataset.cat, true);
    });
    window.addEventListener('popstate', function () { cat = fromUrl(); draw(); });
    draw();
  }

  /* ---------- Комплекты ---------- */
  function sets() {
    var box = $('#setlist'); if (!box) return;
    var html = cfg.sets.map(function (set, i) {
      var items = set.ids.map(S.product).filter(function (p) { return p && p.visible !== false; });
      if (items.length < 2) return '';
      var known = items.every(function (p) { return typeof p.price === 'number'; });
      var sum = items.reduce(function (a, p) { return a + (p.price || 0); }, 0);
      return '<div class="set"><div class="set__top"><h3>' + esc(set.title) + '</h3><span class="price' + (known ? '' : ' price--ask') + '">' + (known ? S.price(sum) : 'Цена по запросу') + '</span></div>' +
        '<p class="set__note">' + esc(set.note) + '</p><ul>' + items.map(function (p) {
          return '<li><a href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.title) + '</a><span>' + (typeof p.price === 'number' ? S.price(p.price) : 'по запросу') + '</span></li>';
        }).join('') + '</ul><button type="button" class="set__add" data-set="' + i + '">Добавить комплект в корзину</button></div>';
    }).join('');
    if (!html) { $('#sets').hidden = true; return; }
    box.innerHTML = html;
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-set]'); if (!b) return;
      addSet(+b.dataset.set);
      b.outerHTML = '<a class="set__add on" href="cart.html">Комплект в корзине — перейти</a>';
    });
  }

  /* ---------- Заявка ---------- */
  function leadForm(box, product, order) {
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
      S.addLead({ name: name.value.trim(), phone: phone.value.trim(), comment: form.elements.comment.value.trim(), productId: product ? product.id : '', product: product ? product.title : '', order: order ? order() : '' });
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
    var meta = [p.model && 'Модель ' + p.model, p.sku && 'Арт. ' + p.sku].filter(Boolean).join(' · ');
    var st = S.status(p);
    var specs = (p.specs || []).slice();
    if (p.country && !specs.some(function (s) { return /стран/i.test(s[0]); })) specs.unshift(['Страна-производитель', p.country]);
    var ask = 'Здравствуйте! Интересует ' + p.title + '. Подскажите по наличию.';
    root.innerHTML =
      '<div class="wrap"><nav class="crumbs" aria-label="Навигация"><a href="index.html">Главная</a> / <a href="index.html?cat=' + encodeURIComponent(p.category) + '#catalog">' + esc(p.category) + '</a> / ' + esc(p.model || p.title) + '</nav>' +
      '<div class="pd"><div class="gal"><div class="gal__main">' + saleBadge(p) + '<img id="gal-main" src="' + esc(imgs[0]) + '" alt="' + esc(p.title) + '" width="900" height="900"></div>' +
        (imgs.length > 1 ? '<div class="gal__th">' + imgs.map(function (src, i) { return '<button type="button" data-i="' + i + '" aria-current="' + (i === 0) + '" aria-label="Фото ' + (i + 1) + '"><img src="' + esc(src) + '" alt="" loading="lazy"></button>'; }).join('') + '</div>' : '') + '</div>' +
      '<div class="pd__info"><p class="eyebrow">' + esc(p.category) + '</p><h1>' + esc(p.title) + '</h1><p class="pd__meta">' + esc(meta) + '</p>' +
        '<div class="pd__buy">' + priceHtml(p) + stockHtml(p) + showTag(p) +
          '<div class="pd__btns">' + (st.key !== 'out' ? '<button type="button" class="btn" id="pd-add">' + addLabel(p.id) + '</button>' : '') + '<a class="btn btn--line" href="#ask">' + (st.level > 0 ? 'Оставить заявку' : 'Заказать') + '</a></div>' +
          '<p class="pd__go"' + (S.cart()[p.id] ? '' : ' hidden') + '><a href="cart.html">Перейти в корзину</a></p>' +
          '<p class="pd__msg">Написать: <a target="_blank" rel="noopener" href="' + wa(ask) + '">WhatsApp</a>' + (tg ? '<a target="_blank" rel="noopener" href="' + esc(tg) + '">Telegram</a>' : '') + '</p>' +
          '<p class="pd__hint">' + [p.showroom ? 'Товар можно посмотреть в шоуруме: ' + esc(cfg.address) + '.' : st.level > 0 ? 'Товар в наличии. Адрес шоурума: ' + esc(cfg.address) + '.' : '',
            st.level > 0 ? '' : 'Привезём под заказ' + esc(lead) + '. Точный срок назовёт консультант.'].filter(Boolean).join(' ') + '</p></div>' +
        (p.features && p.features.length ? '<ul class="feat">' + p.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
      '</div></div></div>' +
      '<section class="sec sec--soft"><div class="wrap pd__more"><div><h2>Описание</h2><p>' + esc(p.description) + '</p></div>' +
        (specs.length ? '<div><h2>Характеристики</h2><table class="specs"><tbody>' + specs.map(function (s) { return '<tr><th scope="row">' + esc(s[0]) + '</th><td>' + esc(s[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      '</div></section>' +
      '<section class="sec" id="ask"><div class="wrap ask"><div><p class="eyebrow">Заявка</p><h2>Узнать о наличии и заказать</h2><p class="lead">Оставьте телефон — консультант подтвердит наличие, расскажет об условиях доставки и установки.</p></div><div id="lead"></div></div></section>';
    var main = $('#gal-main'), wrapEl = main.parentNode;
    function fit() { wrapEl.classList.toggle('cover', main.naturalWidth > main.naturalHeight * 1.25); }
    main.addEventListener('load', fit); if (main.complete) fit();
    root.addEventListener('click', function (e) {
      if (e.target.id === 'pd-add') { S.cartAdd(p.id); e.target.textContent = addLabel(p.id); $('.pd__go', root).hidden = false; return cartCount(); }
      var b = e.target.closest('.gal__th button'); if (!b) return;
      main.src = imgs[+b.dataset.i];
      root.querySelectorAll('.gal__th button').forEach(function (x) { x.setAttribute('aria-current', x === b ? 'true' : 'false'); });
    });
    leadForm($('#lead'), p);
  }

  /* ---------- Корзина и печатное предложение ---------- */
  function cartPage() {
    var root = $('#cart'); if (!root) return;
    var body = $('#cart-body'), offer = $('#offer'), askSec = $('#ask');
    var money = function (v) { return S.price(v); };
    function tiersText(c) { return c.tiers.map(function (t) { return 'от ' + money(t.from) + ' — ' + t.pct + '%'; }).join(', '); }
    /* Телефоны в шапке предложения: у номера, на котором работают WhatsApp и Telegram, стоят их значки */
    function offerPhones() {
      var fmt = function (v) { return String(v).replace(/^7(\d{3})(\d{3})(\d{2})(\d{2})$/, '+7($1)$2-$3-$4'); };
      var digits = function (v) { return String(v || '').replace(/\D/g, ''); };
      var wa = digits(cfg.whatsapp), t = String(cfg.telegram || '').replace(/^@|\s/g, ''), tgNum = /^\+?\d+$/.test(t) ? digits(t) : '';
      var icons = function (num) { return (wa && num === wa ? ICON_WA : '') + (tgNum && num === tgNum ? ICON_TG : ''); };
      var nums = [cfg.phone, cfg.phone2].filter(Boolean), shown = {};
      var html = '<span class="offer__m">' + nums.map(function (n) { shown[digits(n)] = 1; return '<span>' + esc(n) + icons(digits(n)) + '</span>'; }).join('') + '</span>';
      if (wa && !shown[wa]) html += '<span class="offer__m"><span>' + esc(fmt(wa)) + icons(wa) + '</span></span>';
      if (t && (!tgNum || (!shown[tgNum] && tgNum !== wa))) html += '<span class="offer__m"><span>' + esc(tgNum ? fmt(tgNum) : '@' + t) + ICON_TG + '</span></span>';
      return html;
    }
    function orderText() {
      var c = S.cartCalc();
      return c.rows.map(function (r) { return r.p.title + ' × ' + r.qty + (r.sum === null ? ' (цена по запросу)' : ' — ' + money(r.sum)); }).join('; ') +
        '. Итого: ' + money(c.total) + (c.setOff ? ' (цена комплекта: −' + money(c.setOff) + ')' : '') + (c.pct ? ' (скидка за объём ' + c.pct + '%)' : '');
    }
    function draw() {
      var c = S.cartCalc();
      cartCount();
      askSec.hidden = !c.rows.length;
      if (!c.rows.length) {
        body.innerHTML = '<div class="cart__none"><p>В корзине пока пусто. Добавьте технику из каталога — соберём предложение со скидкой за объём заказа.</p><a class="btn" href="index.html#catalog">Открыть каталог</a></div>';
        offer.innerHTML = ''; return;
      }
      body.innerHTML = '<div class="cart"><div class="cart__list">' + c.rows.map(function (r) {
        var p = r.p, href = 'product.html?id=' + encodeURIComponent(p.id);
        return '<div class="ci" data-id="' + esc(p.id) + '">' +
          '<a class="ci__pic" href="' + href + '" tabindex="-1" aria-hidden="true"><img src="' + esc((p.images || [])[0] || '') + '" alt="" loading="lazy"></a>' +
          '<div class="ci__info"><a class="ci__title" href="' + href + '">' + esc(p.title) + '</a>' + stockHtml(p) + '<span class="ci__each">' + priceHtml(p) + (r.sum !== null ? ' за шт.' : '') + '</span></div>' +
          '<div class="qty"><button type="button" data-q="-1" aria-label="Уменьшить количество">−</button><input type="number" min="1" max="99" step="1" inputmode="numeric" value="' + r.qty + '" aria-label="Количество: ' + esc(p.title) + '"><button type="button" data-q="1" aria-label="Увеличить количество">+</button></div>' +
          '<div class="ci__sum">' + (r.sum === null ? '<span class="price price--ask">по запросу</span>' : '<span class="price">' + money(r.sum) + '</span>') + '</div>' +
          '<button type="button" class="ci__rm" data-rm aria-label="Убрать из корзины: ' + esc(p.title) + '">×</button></div>';
      }).join('') + '</div>' +
      '<aside class="sum"><h2>Ваш заказ</h2><dl>' +
        '<div><dt>Товары, ' + c.count + ' шт.</dt><dd>' + money(c.goods) + '</dd></div>' +
        c.kits.map(function (k) { return '<div class="sum__disc"><dt>Цена комплекта: ' + esc(k.title) + (k.n > 1 ? ' × ' + k.n : '') + '</dt><dd>−' + money(k.off) + '</dd></div>'; }).join('') +
        (c.pct ? '<div class="sum__disc"><dt>Скидка за объём ' + c.pct + '%</dt><dd>−' + money(c.discount) + '</dd></div>' : '') +
        '<div class="sum__total"><dt>Итого</dt><dd>' + money(c.total) + '</dd></div></dl>' +
        (c.ask ? '<p class="sum__note">Товары с ценой по запросу (' + c.ask + ' шт.) в сумму не входят — цену назовёт консультант.</p>' : '') +
        (c.tiers.length ? '<p class="sum__next">' + (c.next ? 'До скидки ' + c.next.pct + '% не хватает ' + money(c.next.need) + '.' : 'Применена максимальная скидка за объём.') + '</p><p class="sum__note">Скидка за объём заказа: ' + tiersText(c) + '.</p>' : '') +
        '<a class="btn btn--wide" href="#ask">Оформить заявку</a>' +
        '<button type="button" class="btn btn--line btn--wide" id="print">Предложение в PDF</button>' +
        '<p class="sum__note">Откроется окно печати: выберите «Сохранить как PDF» или сразу распечатайте.</p>' +
      '</aside></div>';

      var today = new Date().toLocaleDateString('ru-RU');
      /* Поля страницы заданы пустыми строками таблицы (шапка и подвал повторяются на каждом листе): у самой страницы поля нулевые,
         поэтому браузер не печатает свои колонтитулы с датой и адресом сайта */
      var cut = c.kits.length || c.pct;
      offer.innerHTML = '<table class="offer__page"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td>' +
        '<div class="offer__top"><img src="assets/img/miele-logo.svg" alt="Miele" width="130" height="50"><div class="offer__co"><span><b>Шоурум Miele</b> · ' + esc(String(cfg.address).replace(/^Шоурум Miele,?\s*/i, '')) + '</span>' + offerPhones() + '<span>' + esc(cfg.hours) + '</span></div></div>' +
        '<h1>Коммерческое предложение</h1><p class="offer__date">от ' + today + '</p>' +
        '<table class="offer__tbl"><thead><tr><th>№</th><th></th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>' + c.rows.map(function (r, i) {
          var p = r.p, sub = [p.model && 'Модель ' + p.model, p.sku && 'арт. ' + p.sku, p.country && 'страна-производитель: ' + p.country].filter(Boolean).join(', ');
          return '<tr><td>' + (i + 1) + '</td><td class="offer__pic">' + ((p.images || [])[0] ? '<img src="' + esc(p.images[0]) + '" alt="">' : '') + '</td><td>' + esc(p.title) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</td><td>' + r.qty + '</td><td>' + (r.sum === null ? 'по запросу' : (S.onSale(p) ? '<s>' + money(p.oldPrice) + '</s> ' : '') + money(p.price)) + '</td><td>' + (r.sum === null ? 'по запросу' : money(r.sum)) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<table class="offer__sum"><tbody>' + (cut ? '<tr><th>Итого</th><td>' + money(c.goods) + '</td></tr>' : '') +
          c.kits.map(function (k) { return '<tr><th>Цена комплекта: ' + esc(k.title) + (k.n > 1 ? ' × ' + k.n : '') + '</th><td>−' + money(k.off) + '</td></tr>'; }).join('') +
          (c.pct ? '<tr><th>Скидка за объём заказа ' + c.pct + '%</th><td>−' + money(c.discount) + '</td></tr>' : '') +
          '<tr class="offer__total"><th>' + (cut ? 'Итого со скидкой' : 'Итого') + '</th><td>' + money(c.total) + '</td></tr></tbody></table>' +
        (c.ask ? '<p class="offer__p">Позиции с ценой по запросу в сумму не включены — стоимость уточнит консультант.</p>' : '') +
        '<p class="offer__legal">Предложение сформировано на сайте ' + today + ', носит информационный характер и не является публичной офертой (ст. 437 ГК РФ). Цены и наличие действительны на дату формирования — уточняйте у консультантов шоурума.</p>' +
        '</td></tr></tbody></table>';
    }
    body.addEventListener('click', function (e) {
      if (e.target.id === 'print') {
        var t = document.title; document.title = 'Предложение Miele Пермь от ' + new Date().toLocaleDateString('ru-RU');
        window.print(); document.title = t; return;
      }
      var row = e.target.closest('.ci'); if (!row) return;
      var id = row.dataset.id, step = e.target.closest('[data-q]');
      if (step) { S.cartSet(id, Math.max(1, (S.cart()[id] || 1) + +step.dataset.q)); return draw(); }
      if (e.target.closest('[data-rm]')) { S.cartSet(id, 0); draw(); }
    });
    body.addEventListener('change', function (e) {
      var row = e.target.closest('.ci'); if (!row || !e.target.matches('.qty input')) return;
      S.cartSet(row.dataset.id, Math.max(1, parseInt(e.target.value, 10) || 1)); draw();
    });
    window.addEventListener('storage', draw);
    draw();
    leadForm($('#lead'), null, orderText);
  }

  /* ---------- Контакты шоурума на главной ---------- */
  function contacts() {
    document.querySelectorAll('[data-cfg]').forEach(function (el) {
      var k = el.dataset.cfg;
      if (k === 'tel') { el.textContent = cfg.phone; el.href = 'tel:' + tel; }
      else if (k === 'tel2') { if (tel2) { el.textContent = cfg.phone2; el.href = 'tel:' + tel2; } else el.hidden = true; }
      else if (k === 'wa') el.href = wa('Здравствуйте! Хочу проконсультироваться по технике Miele.');
      else if (k === 'tg') { if (tg) el.href = tg; else el.hidden = true; }
      else if (k === 'gis' || k === 'ymaps') el.href = cfg[k];
      else el.textContent = cfg[k];
    });
  }

  layout(); catalog(); sets(); contacts(); productPage(); cartPage();
  S.isOwner().then(function (ok) {
    if (!ok) return;
    var bar = document.createElement('div'); bar.className = 'demo';
    bar.innerHTML = 'Кабинет включён на этом устройстве. <a href="kabinet.html">Товары, остатки и заявки</a>';
    $('#hdr').insertBefore(bar, $('#hdr .hdr'));
  });
  leadForm($('#lead-home'));
})();
