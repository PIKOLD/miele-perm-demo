/* Слой данных. В демо всё хранится в localStorage браузера.
   На рабочем сайте эти же функции (load/save/addLead) переключаются на сервер — остальной код не меняется. */
(function () {
  'use strict';
  var PKEY = 'mp.products.v3', SKEY = 'mp.settings.v3', LKEY = 'mp.leads.v2', CKEY = 'mp.cart';
  var IMG = 'assets/img/products/';
  var KKEY = 'mp.key';
  /* Хеш ключа доступа к кабинету (SHA-256). Сам ключ есть только в ссылке, которую передают владельцу. */
  var ACCESS = '6b8e63984b5bcaf4b482b44258e408e772e1350aecc44cf39d8b94197ea740f7';
  /* Пароль кабинета: в коде только хеш PBKDF2. Сменённый пароль хранится так же, хешем. */
  var PASSKEY = 'mp.pass', UNKEY = 'mp.unlocked';
  var PASS = { salt: '45f74115bb01e4ad5a013987a7cb45c7', hash: 'f8ab82c841877c0b0621d7ba81d27f48238980b46147ba46d841ad0236cf6a73' };
  function toHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function fromHex(str) { var a = new Uint8Array(str.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(str.substr(i * 2, 2), 16); return a; }
  function pbkdf(pw, salt) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits'])
      .then(function (k) { return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(salt), iterations: 150000 }, k, 256); }).then(toHex);
  }

  var SEED = [
    {
      id: 'wq1000', title: 'Стиральная машина WQ 1000 WPS Nova Edition', model: 'WQ 1000 WPS', sku: '12698670',
      category: 'Стиральные машины', country: 'Германия', price: 309000, stock: 2, low: 2, high: 5,
      images: [IMG + 'wq1000-1.webp', IMG + 'wq1000-2.webp', IMG + 'wq1000-3.webp'],
      description: 'Флагман новой серии W2. Машина сама дозирует моющее средство, подбирает расход воды и энергии под объём белья и управляется с цветного сенсорного дисплея M Touch Pro. Дверца открывается лёгким касанием.',
      features: ['TwinDos — автоматическое двухфазное дозирование', 'PowerWash — экономичная стирка малых загрузок', 'SteamCare — разглаживание паром', 'Барабан InfinityCare для бережной стирки', 'Защита от протечек Waterproof (WPS)', 'Инверторный мотор ProfiEco'],
      specs: [['Загрузка', '9 кг'], ['Отжим', 'до 1600 об/мин'], ['Класс энергоэффективности', 'A'], ['Шум при отжиме', '70 дБ(А)'], ['Управление', 'сенсорный дисплей M Touch Pro'], ['Размеры (В×Ш×Г)', '85 × 59,6 × 62 см'], ['Цвет', 'белый лотос']]
    },
    {
      id: 'tq1000', title: 'Сушильная машина TQ 1000 WP Nova Edition', model: 'TQ 1000 WP', sku: '12698890',
      category: 'Сушильные машины', country: 'Чехия', price: 309000, stock: 5, low: 2, high: 5,
      images: [IMG + 'tq1000-1.webp', IMG + 'tq1000-2.webp', IMG + 'tq1000-3.webp'],
      description: 'Сушильная машина серии T2 с тепловым насосом — пара к WQ 1000. Точно определяет остаточную влажность, получает данные о программе стирки от стиральной машины и подбирает сушку сама. Конденсат уходит прямо в слив.',
      features: ['PerfectDry — точная сушка без пересушивания', 'Wash2Dry — программа подбирается по стирке', 'EcoSpeed — быстрее при низком расходе энергии', 'FragranceDos — аромат для белья', 'Сотовый барабан, бережный к тканям', 'Встроенный слив конденсата'],
      specs: [['Загрузка', '9 кг'], ['Тип сушки', 'тепловой насос'], ['Класс энергоэффективности', 'B'], ['Управление', 'сенсорный дисплей M Touch Pro'], ['Размеры (В×Ш×Г)', '85 × 59,6 × 64,3 см'], ['Вес', '55 кг'], ['Цвет', 'белый лотос']]
    },
    {
      id: 'wtv601', title: 'Монтажный комплект WTV 601 для колонны W2/T2', model: 'WTV 601', sku: '',
      category: 'Аксессуары и бытовая химия', country: 'Германия', price: 14900, oldPrice: 17900, stock: 8, low: 2, high: 5,
      images: [IMG + 'wtv601-1.webp', IMG + 'wtv601-2.webp', IMG + 'wtv601-3.webp'],
      description: 'Соединительный комплект для установки сушильной машины на стиральную в колонну. Подходит для серии Nova Edition (W2/T2). Колонна занимает площадь одной машины и надёжно фиксирует оба прибора.',
      features: ['Для стиральных машин и сушильных машин Nova Edition', 'Высота комплекта — 2,5 см', 'Надёжная фиксация приборов в колонне'],
      specs: [['Совместимость', 'W2 / T2 Nova Edition'], ['Высота', '2,5 см'], ['Назначение', 'установка в колонну']]
    },
    {
      id: 'wwg880', title: 'Стиральная машина WWG 880 WCS White Edition', model: 'WWG 880 WCS', sku: '',
      category: 'Стиральные машины', country: 'Польша', price: null, stock: 1, low: 2, high: 5,
      images: [IMG + 'wwg880-1.webp', IMG + 'wwg880-2.webp'],
      description: 'Машина серии W1 с автоматическим дозированием TwinDos и паровой обработкой. PowerWash экономит воду и энергию на небольших загрузках, а бельё можно добавить уже после старта программы.',
      features: ['TwinDos — автоматическое дозирование', 'PowerWash — эффективная стирка малых загрузок', 'SteamCare — меньше складок после стирки', 'AddLoad — дозагрузка белья после старта', 'CapDosing — капсулы для особых тканей', 'Защита от протечек Watercontrol'],
      specs: [['Загрузка', '9 кг'], ['Отжим', 'до 1400 об/мин'], ['Класс энергоэффективности', 'A'], ['Управление', 'DirectSensor'], ['Размеры (В×Ш×Г)', '85 × 59,6 × 64,3 см'], ['Цвет', 'белый лотос']]
    },
    {
      id: 'twh780', title: 'Сушильная машина TWH 780 WP White Edition', model: 'TWH 780 WP', sku: '',
      category: 'Сушильные машины', country: 'Чехия', price: null, stock: 3, low: 2, high: 5,
      images: [IMG + 'twh780-1.webp', IMG + 'twh780-2.webp', IMG + 'twh780-3.webp'],
      description: 'Сушильная машина серии T1 с тепловым насосом — пара к WWG 880. Бережно сушит при низкой температуре, а реверс барабана и защита от сминания оставляют бельё ровным.',
      features: ['PerfectDry — точная сушка с учётом жёсткости воды', 'EcoSpeed — короче цикл, меньше расход', 'DryCare 40 — деликатная сушка при 40 °C', 'HygieneDry — гигиеническая сушка', 'Wash2Dry — программа подбирается по стирке', 'Защита от сминания'],
      specs: [['Загрузка', '9 кг'], ['Тип сушки', 'тепловой насос'], ['Управление', 'DirectSensor'], ['Размеры (В×Ш×Г)', '85 × 59,6 × 64,3 см'], ['Вес', '55 кг'], ['Цвет', 'белый лотос']]
    },
    {
      id: 'wtv502', title: 'Монтажный комплект WTV 502 для колонны W1/T1', model: 'WTV 502', sku: '',
      category: 'Аксессуары и бытовая химия', country: 'Германия', price: null, stock: 6, low: 2, high: 5,
      images: [IMG + 'wtv502-1.webp', IMG + 'wtv502-2.webp'],
      description: 'Соединительный комплект для установки сушильной машины T1 на стиральную машину W1 в колонну. Цвет — белый лотос, в тон приборам White Edition.',
      features: ['Для стиральных машин W1 и сушильных машин T1 White Edition', 'Высота комплекта — 2,5 см', 'Цвет — белый лотос'],
      specs: [['Совместимость', 'W1 / T1 White Edition'], ['Высота', '2,5 см'], ['Цвет', 'белый лотос']]
    },
    {
      id: 'h2861', title: 'Духовой шкаф H 2861 BP, чёрный обсидиан', model: 'H 2861 BP OBSW', sku: '12146720',
      category: 'Духовые шкафы', country: 'Германия', price: 205000, stock: 4, low: 2, high: 5,
      images: [IMG + 'h2861-1.webp', IMG + 'h2861-3.webp', IMG + 'h2861-2.webp'],
      description: 'Встраиваемый духовой шкаф с пиролитической очисткой: камера очищается сама при высокой температуре. Покрытие PerfectClean не даёт пригорать, а дверца плавно открывается и закрывается.',
      features: ['Пиролитическая самоочистка', 'Покрытие PerfectClean', 'Режим AirFry — хрустящая корочка без масла', 'SoftOpen и SoftClose — плавный ход дверцы', 'Управление EasyControl Plus', 'Холодный фронт — защита от ожогов'],
      specs: [['Объём камеры', '76 л'], ['Очистка', 'пиролитическая'], ['Температура', '30–300 °C'], ['Ниша для встраивания', '60 см'], ['Размеры (В×Ш×Г)', '59,6 × 59,5 × 56,8 см'], ['Цвет', 'чёрный обсидиан']]
    },
    {
      id: 'km8462', title: 'Индукционная панель KM 8462 FL', model: 'KM 8462 FL', sku: '12911380',
      category: 'Варочные панели', country: 'Германия', price: 145000, stock: 0, low: 1, high: 3,
      images: [IMG + 'km8462-1.webp', IMG + 'km8462-2.webp', IMG + 'km8462-3.webp'],
      description: 'Индукционная панель шириной 62 см с гибкой зоной PowerFlex под крупную посуду. Встраивается сверху или заподлицо со столешницей. Распознаёт посуду и подаёт энергию только под дно.',
      features: ['Зона PowerFlex для большой посуды', 'Booster — быстрый нагрев', 'Stop & Go — пауза одним касанием', 'Автоматика закипания', 'Поддержание тепла', 'Монтаж сверху или заподлицо'],
      specs: [['Тип', 'индукционная'], ['Зоны нагрева', '4, включая PowerFlex'], ['Мощность', '7,36 кВт'], ['Размеры (Ш×Г×В)', '62 × 52 × 5,1 см'], ['Встраивание', 'сверху или заподлицо'], ['Цвет', 'чёрная стеклокерамика']]
    },
    {
      id: 'g7191', title: 'Посудомоечная машина G 7191 SCVi 125 Edition', model: 'G 7191 SCVi AD', sku: '12480510',
      category: 'Посудомоечные машины', country: 'Чехия', price: 200000, stock: 2, low: 2, high: 5,
      images: [IMG + 'g7191-1.webp', IMG + 'g7191-2.webp', IMG + 'g7191-3.webp'],
      description: 'Полностью встраиваемая посудомоечная машина шириной 60 см из юбилейной серии 125 Edition. Сама дозирует моющее средство и приоткрывает дверцу в конце программы, чтобы посуда высохла.',
      features: ['AutoDos — автоматическое дозирование с PowerDisk', 'AutoOpen — дверца приоткрывается для сушки', 'SensorDry — сушка с учётом температуры в комнате', 'BrilliantGlassCare — бережно к стеклу', 'Защита от протечек Waterproof', 'Тихая программа — 39 дБ(А)'],
      specs: [['Вместимость', '14 комплектов'], ['Класс энергоэффективности', 'B'], ['Шум', '43 дБ(А)'], ['Расход воды (Eco)', '8,4 л'], ['Ширина', '60 см, полностью встраиваемая'], ['Размеры (В×Ш×Г)', '80,5 × 59,8 × 55 см']]
    }
  ];
  SEED.forEach(function (p) { p.visible = true; p.orderable = true; });

  var DEFAULTS = {
    showCount: true,          // показывать покупателям «2 шт.», когда осталось мало
    lowDefault: 2,            // порог «мало» для новых товаров
    highDefault: 5,           // порог «много» для новых товаров
    leadTime: 'от 5 дней',    // срок для товаров «под заказ»
    phone: '+7 (342) 241-14-94',
    phone2: '+7 951 936-94-78',
    whatsapp: '79519369478',
    telegram: '79519369478',  // номер (только цифры) или имя пользователя без @
    address: 'Пермь, ул. Сибирская, 61',
    hours: 'Пн–Чт 11:00–19:00, Пт 11:00–18:00',
    /* Разделы каталога: показываются вкладками, даже если товаров в разделе пока нет */
    cats: ['Стиральные машины', 'Сушильные машины', 'Гладильные системы', 'Духовые шкафы', 'Варочные панели', 'Микроволновые печи', 'Вытяжки', 'Посудомоечные машины', 'Кофемашины', 'Пылесосы', 'Аксессуары и бытовая химия', 'Сувенирная продукция'],
    /* Скидка за объём заказа в корзине: от суммы — процент */
    discounts: [{ from: 700000, pct: 3 }, { from: 1000000, pct: 5 }],
    gis: 'https://2gis.ru/perm/firm/70000001026549959',
    ymaps: 'https://yandex.ru/maps/org/miele/121722485798/',
    sets: [
      { title: 'Колонна Nova Edition', note: 'Серия W2/T2', ids: ['wq1000', 'tq1000', 'wtv601'] },
      { title: 'Колонна White Edition', note: 'Серия W1/T1', ids: ['wwg880', 'twh780', 'wtv502'] }
    ]
  };

  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var Store = {
    products: function () { return read(PKEY, null) || clone(SEED); },
    saveProducts: function (list) { return write(PKEY, list); },
    product: function (id) { return Store.products().filter(function (p) { return p.id === id; })[0] || null; },
    settings: function () {
      var s = read(SKEY, {}), out = clone(DEFAULTS);
      Object.keys(s).forEach(function (k) { out[k] = s[k]; });
      return out;
    },
    saveSettings: function (s) { return write(SKEY, s); },
    leads: function () { return read(LKEY, []); },
    saveLeads: function (l) { return write(LKEY, l); },
    key: function () { try { return localStorage.getItem(KKEY) || ''; } catch (e) { return ''; } },
    check: function (key) {
      if (!key || !window.crypto || !crypto.subtle) return Promise.resolve(false);
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('') === ACCESS;
      });
    },
    unlocked: function () { try { return localStorage.getItem(UNKEY) === '1'; } catch (e) { return false; } },
    unlock: function () { try { localStorage.setItem(UNKEY, '1'); } catch (e) {} },
    isOwner: function () { return Store.check(Store.key()).then(function (ok) { return ok && Store.unlocked(); }); },
    checkPass: function (pw) { var p = read(PASSKEY, null) || PASS; return pbkdf(pw, p.salt).then(function (h) { return h === p.hash; }); },
    setPass: function (pw) {
      var salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
      return pbkdf(pw, salt).then(function (h) { return write(PASSKEY, { salt: salt, hash: h }); });
    },
    activate: function (key) { return Store.check(key).then(function (ok) { if (ok) { try { localStorage.setItem(KKEY, key); } catch (e) {} } return ok; }); },
    deactivate: function () { try { localStorage.removeItem(KKEY); localStorage.removeItem(UNKEY); } catch (e) {} },
    /* Разделы каталога: список из настроек + разделы, которые есть у товаров, но не внесены в список */
    cats: function () {
      var out = (Store.settings().cats || []).slice();
      Store.products().forEach(function (p) { if (p.category && out.indexOf(p.category) < 0) out.push(p.category); });
      return out;
    },
    onSale: function (p) { return typeof p.price === 'number' && typeof p.oldPrice === 'number' && p.oldPrice > p.price; },
    tgLink: function () { var t = String(Store.settings().telegram || '').replace(/^@|\s/g, ''); return t ? 'https://t.me/' + (/^\d+$/.test(t) ? '+' : '') + t : ''; },
    /* Корзина покупателя: { id товара: количество } */
    cart: function () { var c = read(CKEY, {}); return c && typeof c === 'object' ? c : {}; },
    saveCart: function (c) { return write(CKEY, c); },
    cartSet: function (id, qty) { var c = Store.cart(); qty = Math.min(99, Math.max(0, parseInt(qty, 10) || 0)); if (qty) c[id] = qty; else delete c[id]; Store.saveCart(c); return qty; },
    cartAdd: function (id) { return Store.cartSet(id, (Store.cart()[id] || 0) + 1); },
    cartCount: function () { return Store.cartCalc().count; },
    /* Состав и сумма корзины со скидкой за объём */
    cartCalc: function () {
      var c = Store.cart(), rows = [], sum = 0, count = 0, ask = 0;
      Store.products().forEach(function (p) {
        var q = c[p.id]; if (!q || p.visible === false) return;
        var known = typeof p.price === 'number';
        rows.push({ p: p, qty: q, sum: known ? p.price * q : null });
        count += q; if (known) sum += p.price * q; else ask += q;
      });
      var tiers = (Store.settings().discounts || []).filter(function (t) { return t.from > 0 && t.pct > 0; }).sort(function (a, b) { return a.from - b.from; });
      var pct = 0, next = null;
      tiers.forEach(function (t) { if (sum >= t.from) pct = t.pct; else if (!next) next = { pct: t.pct, need: t.from - sum }; });
      var discount = Math.round(sum * pct / 100);
      return { rows: rows, count: count, ask: ask, sum: sum, pct: pct, discount: discount, total: sum - discount, next: next, tiers: tiers };
    },
    addLead: function (lead) {
      var l = Store.leads();
      lead.id = 'l' + Date.now().toString(36);
      lead.ts = new Date().toISOString();
      lead.done = false;
      l.unshift(lead);
      return Store.saveLeads(l);
    },
    reset: function () { [PKEY, SKEY, LKEY].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} }); },
    exportAll: function () { return { products: Store.products(), settings: Store.settings(), leads: Store.leads(), exported: new Date().toISOString() }; },

    /* Система остатков: количество в штуках + два порога на каждый товар.
       0 → под заказ / нет · 1..low → мало · выше high → много · между ними → в наличии */
    status: function (p) {
      var n = Math.max(0, parseInt(p.stock, 10) || 0);
      var low = Math.max(1, parseInt(p.low, 10) || 1);
      var high = Math.max(low + 1, parseInt(p.high, 10) || low + 1);
      if (n === 0) return p.orderable === false
        ? { key: 'out', level: 0, label: 'Нет в наличии', admin: 'Нет' }
        : { key: 'order', level: 0, label: 'Под заказ', admin: 'Под заказ' };
      if (n <= low) return { key: 'low', level: 1, label: 'Осталось мало', admin: 'Мало' };
      if (n >= high) return { key: 'many', level: 3, label: 'В наличии', admin: 'Много' };
      return { key: 'ok', level: 2, label: 'В наличии', admin: 'Достаточно' };
    },
    price: function (v) {
      if (v === null || v === undefined || v === '' || isNaN(v)) return 'Цена по запросу';
      return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
    },
    plural: function (n, one, few, many) {
      var a = Math.abs(n) % 100, b = a % 10;
      if (a > 10 && a < 20) return many;
      if (b > 1 && b < 5) return few;
      if (b === 1) return one;
      return many;
    },
    esc: function (s) {
      return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
  };
  window.Store = Store;
})();
