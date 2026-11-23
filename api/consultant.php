<?php
declare(strict_types=1);
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !hash_equals(
    'bee6b0a135a5e606fe70e24804480e7efb40ef1fc1eb5c7bd836f2404c782df4',
    hash('sha256', $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '')
)) { http_response_code(403); exit; }
require __DIR__ . '/lib.php';
$update = json_decode(file_get_contents('php://input'), true);
$msg = $update['message'] ?? [];
if (($msg['chat']['type'] ?? '') !== 'private') exit;
$q = mb_strtolower(trim($msg['text'] ?? ''), 'UTF-8');
$state = mp_read('state', []);
$cfg = $state['settings'] ?? [];
$tg = ltrim(trim($cfg['telegram'] ?? '79519369478'), '@+');
$contact = 'Написать консультанту: https://t.me/' . (ctype_digit($tg) ? '+' : '') . $tg;
$reply = "Передайте вопрос консультанту шоурума.\n" . $contact;
if ($q === '/start' || $q === '/help') {
    $reply = 'Здравствуйте! Это консультант шоурума Miele в Перми. Выберите тему или напишите обозначение модели, например G 5050.';
} elseif (preg_match('/адрес|час|доехать|находит|работаете|скольки|пятниц|график/u', $q)) {
    $reply = ($cfg['address'] ?? 'Пермь, ул. Сибирская, 61') . "\n" . ($cfg['hours'] ?? 'Пн–Чт 11:00–19:00, Пт 11:00–18:00') . "\n" . ($cfg['ymaps'] ?? 'https://yandex.ru/maps/org/miele/121722485798/');
} elseif (preg_match('/гарант|ремонт|сломал/u', $q)) {
    $reply = "Гарантия на бытовую технику — 1 год. Обслуживанием и ремонтом занимается технический специалист шоурума.\n" . $contact;
} elseif (preg_match('/достав|подключ|привез|срок/u', $q)) {
    $reply = "Доставка и погрузочно-разгрузочные работы оплачиваются отдельно. Подключение — по прайс-листу. Точный срок поставки подскажет консультант по выбранной модели.\n" . $contact;
} elseif ($q === 'найти модель') {
    $reply = 'Напишите обозначение модели, например G 5050.';
} elseif ($q === 'консультант') {
    $reply = $contact;
} else {
    foreach (($state['products'] ?? []) as $p) {
        if (($p['visible'] ?? true) === false || empty($p['id'])) continue;
        $id = preg_quote($p['id'], '~');
        $pattern = preg_replace('/(?<=[a-z])(?=[0-9])/i', '[ -]*', $id);
        if (preg_match('~(?<![a-z0-9])' . $pattern . '(?![a-z0-9])~i', $q)) {
            $reply = $p['title'] . "\nЦена и наличие в каталоге:\nhttps://miele-perm.ru/product.html?id=" . rawurlencode($p['id']);
            break;
        }
    }
}
header('Content-Type: application/json; charset=UTF-8');
echo json_encode(['method'=>'sendMessage','chat_id'=>$msg['chat']['id'],'text'=>$reply,
    'reply_markup'=>['keyboard'=>[['Найти модель','Адрес и часы'],['Доставка и подключение','Гарантия'],['Консультант']], 'resize_keyboard'=>true]], JSON_UNESCAPED_UNICODE);
