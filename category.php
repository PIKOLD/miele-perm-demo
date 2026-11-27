<?php
declare(strict_types=1);
require __DIR__ . '/api/lib.php';

$categories = ['Стиральные машины', 'Сушильные машины', 'Варочные поверхности'];
$category = $_GET['cat'] ?? '';
if (!in_array($category, $categories, true)) {
    http_response_code(404);
    exit('Раздел не найден');
}
$state = mp_read('state', []);
if (!isset($state['products']) || !is_array($state['products'])) {
    http_response_code(503);
    exit('Каталог временно недоступен');
}
function esc_html($value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
$items = [];
$today = (new DateTimeImmutable('now', new DateTimeZone('Asia/Yekaterinburg')))->format('Y-m-d');
foreach ($state['products'] as $item) {
    if (($item['visible'] ?? true) === false) continue;
    if ($item['category'] !== $category && !in_array($category, $item['also'] ?? [], true)) continue;
    if (!empty($item['saleUntil']) && $today > $item['saleUntil'] && is_numeric($item['oldPrice'] ?? null)) {
        $item['price'] = $item['oldPrice'];
    }
    $items[] = $item;
}
usort($items, function ($a, $b) { return ($a['price'] ?? INF) <=> ($b['price'] ?? INF); });
$title = $category . ' Miele в Перми';
$url = 'https://miele-perm.ru/category.php?cat=' . rawurlencode($category);
$cards = '';
foreach ($items as $item) {
    $price = is_numeric($item['price'] ?? null) ? number_format($item['price'], 0, ',', ' ') . ' ₽' : 'Цена по запросу';
    $availability = ($item['stock'] ?? 0) > 0 ? 'В наличии' : (!empty($item['supply']) ? 'Ожидается поставка' : (($item['orderable'] ?? true) ? 'Под заказ' : 'Нет в наличии'));
    $cards .= '<a class="card" href="product.html?id=' . rawurlencode($item['id']) . '"><div class="card__pic"><img loading="lazy" alt="" src="' . esc_html($item['images'][0] ?? '') . '"></div><div class="card__body"><b>' . esc_html($item['title']) . '</b><p>' . $availability . ' · ' . $price . '</p></div></a>';
}
$html = file_get_contents(__DIR__ . '/index.html');
$html = preg_replace('~<title>.*?</title>~s', '<title>' . $title . ' — цены и наличие</title>', $html);
$html = preg_replace('~<meta name="description"[^>]*>~', '<meta name="description" content="' . $title . ': модели, цены и наличие в шоуруме на Сибирской, 61.">', $html);
$html = preg_replace('~<h1>.*?</h1>~s', '<h1>' . $title . '</h1>', $html);
$html = preg_replace('~<div class="folders" id="folders">.*?</div>~s', '<div class="folders" id="folders" hidden></div>', $html);
echo str_replace(['rel="canonical" href="https://miele-perm.ru/"', 'id="cat-title">Каталог', 'id="grid" aria-live="polite" hidden></div>'], ['rel="canonical" href="' . $url . '"', 'id="cat-title">' . $category, 'id="grid" aria-live="polite">' . $cards . '</div>'], $html);