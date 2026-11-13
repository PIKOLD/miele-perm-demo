<?php
/* Отдаёт странице текущие данные сайта как скрипт: window.MP_STATE = {...}.
   Посетителю — каталог без скрытых товаров и настройки. Владельцу после входа — всё, включая заявки. */
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

if (isset($_COOKIE['mpsid'])) mp_session();
$admin = mp_admin();
$st = mp_read('state', null);
$out = ['server' => true, 'admin' => $admin, 'csrf' => $admin ? (string)$_SESSION['csrf'] : null, 'products' => null, 'settings' => null, 'seedrev' => null];
if (is_array($st)) {
    if (isset($st['products']) && is_array($st['products'])) {
        $list = $st['products'];
        if (!$admin) $list = array_values(array_filter($list, function ($p) { return !(is_array($p) && array_key_exists('visible', $p) && $p['visible'] === false); }));
        $out['products'] = $list;
    }
    if (isset($st['settings']) && is_array($st['settings'])) $out['settings'] = $st['settings'] ?: new stdClass();
    if (isset($st['seedrev'])) $out['seedrev'] = (int)$st['seedrev'];
}
if ($admin) $out['leads'] = mp_read('leads', []);
echo 'window.MP_STATE=' . json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) . ';';
