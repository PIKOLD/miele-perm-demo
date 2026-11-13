<?php
/* Действия сайта: вход в кабинет, сохранение каталога и настроек, заявки, загрузка фото, смена пароля. */
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('X-Content-Type-Options: nosniff');
$do = (string)($_GET['do'] ?? '');
$in = mp_body();

switch ($do) {

    /* ---------- Вход: ключ из ссылки + пароль. Не больше 8 неверных попыток за 15 минут с одного адреса ---------- */
    case 'login':
        if (!mp_https()) mp_fail(400, 'Вход в кабинет работает только по защищённому адресу https://');
        if (mp_hits('login', 900) >= 8) mp_fail(429, 'Слишком много попыток. Подождите 15 минут.');
        $key = mp_str($in['key'] ?? '', 200);
        $pw = is_string($in['password'] ?? null) ? (string)$in['password'] : '';
        [$salt, $hash] = mp_pass();
        $ok = hash_equals(MP_ACCESS, hash('sha256', $key)) && strlen($pw) <= 200 && hash_equals($hash, mp_pbkdf($pw, $salt));
        if (!$ok) {
            mp_hits('login', 900, true);
            usleep(600000);
            mp_fail(401, 'Неверный пароль');
        }
        mp_session();
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        $_SESSION['seen'] = time();
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        mp_ok();

    case 'logout':
        if (isset($_COOKIE['mpsid'])) {
            mp_session();
            $_SESSION = [];
            session_destroy();
            setcookie('mpsid', '', ['expires' => time() - 3600, 'path' => '/', 'secure' => mp_https(), 'httponly' => true, 'samesite' => 'Strict']);
        }
        mp_ok();

    /* ---------- Сохранение каталога и настроек ---------- */
    case 'save':
        mp_need_admin();
        $h = mp_lock();
        $st = mp_read('state', []);
        if (!is_array($st)) $st = [];
        if (array_key_exists('products', $in)) {
            $list = $in['products'];
            if (!is_array($list) || count($list) > 3000) mp_fail(400, 'Неверный список товаров');
            foreach ($list as $p) {
                if (!is_array($p) || !isset($p['id']) || !is_string($p['id']) || $p['id'] === '') mp_fail(400, 'У товара нет номера');
                foreach ((array)($p['images'] ?? []) as $src) {
                    if (!is_string($src) || strncmp($src, 'data:', 5) === 0) mp_fail(400, 'Фото товара «' . mp_str($p['title'] ?? '', 60) . '» не загружено на сервер. Добавьте фото заново.');
                }
            }
            $st['products'] = array_values($list);
        }
        if (array_key_exists('settings', $in)) {
            if (!is_array($in['settings'])) mp_fail(400, 'Неверные настройки');
            $st['settings'] = $in['settings'];
        }
        if (array_key_exists('seedrev', $in)) $st['seedrev'] = max(1, (int)$in['seedrev']);
        $st['updated'] = date('c');
        mp_backup();
        $ok = mp_write('state', $st);
        if ($h) { flock($h, LOCK_UN); fclose($h); }
        if (!$ok) mp_fail(500, 'Не удалось записать данные');
        mp_ok();

    /* ---------- Заявка с сайта ---------- */
    case 'lead':
        if (mp_str($in['hp'] ?? '', 50) !== '' || (int)($in['ms'] ?? 0) < 1500) mp_ok();   // похоже на робота: молча не сохраняем
        if (empty($in['agree'])) mp_fail(400, 'Нужно согласие на обработку персональных данных');
        $name = mp_str($in['name'] ?? '', 100);
        $phone = mp_str($in['phone'] ?? '', 40);
        if (mb_strlen($name) < 2 || strlen(preg_replace('/\D/', '', $phone) ?? '') < 10) mp_fail(400, 'Проверьте имя и телефон');
        if (mp_hits('lead', 3600) >= 5) mp_fail(429, 'Слишком много заявок подряд. Позвоните нам, пожалуйста.');
        if (mp_hits('lead-all', 86400, false, true) >= 300) mp_fail(429, 'Форма временно недоступна. Позвоните нам, пожалуйста.');
        mp_hits('lead', 3600, true);
        mp_hits('lead-all', 86400, true, true);
        $lead = [
            'id' => 'l' . base_convert((string)(int)(microtime(true) * 1000), 10, 36) . bin2hex(random_bytes(2)),
            'ts' => gmdate('Y-m-d\TH:i:s\Z'),
            'done' => false,
            'name' => $name,
            'phone' => $phone,
            'comment' => mp_str($in['comment'] ?? '', 2000),
            'productId' => mp_str($in['productId'] ?? '', 80),
            'product' => mp_str($in['product'] ?? '', 300),
            'order' => mp_str($in['order'] ?? '', 6000),
            'cart' => mp_cart($in['cart'] ?? null),
            'agree' => gmdate('Y-m-d\TH:i:s\Z'),      // когда дано согласие на обработку данных
        ];
        $h = mp_lock();
        $leads = mp_read('leads', []);
        if (!is_array($leads)) $leads = [];
        array_unshift($leads, $lead);
        $ok = mp_write('leads', array_slice($leads, 0, 5000));
        if ($h) { flock($h, LOCK_UN); fclose($h); }
        if (!$ok) mp_fail(500, 'Не удалось сохранить заявку');
        mp_ok();

    case 'lead_update':
    case 'lead_delete':
    case 'leads_set':
        mp_need_admin();
        $h = mp_lock();
        $leads = mp_read('leads', []);
        if (!is_array($leads)) $leads = [];
        if ($do === 'leads_set') {
            if (!is_array($in['leads'] ?? null) || count($in['leads']) > 5000) mp_fail(400, 'Неверный список заявок');
            $leads = array_values(array_filter($in['leads'], 'is_array'));
        } else {
            $id = mp_str($in['id'] ?? '', 60);
            foreach ($leads as $i => $l) {
                if (($l['id'] ?? '') !== $id) continue;
                if ($do === 'lead_delete') unset($leads[$i]); else $leads[$i]['done'] = !empty($in['done']);
            }
            $leads = array_values($leads);
        }
        $ok = mp_write('leads', $leads);
        if ($h) { flock($h, LOCK_UN); fclose($h); }
        if (!$ok) mp_fail(500, 'Не удалось записать заявки');
        mp_ok();

    /* ---------- Фото товара: принимается картинка, сохраняется в папку uploads под случайным именем ---------- */
    case 'upload':
        mp_need_admin();
        $data = is_string($in['data'] ?? null) ? $in['data'] : '';
        if (!preg_match('#^data:image/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$#', $data, $m)) mp_fail(400, 'Нужен файл изображения');
        $bin = base64_decode($m[2], true);
        if ($bin === false || strlen($bin) > 3000000) mp_fail(400, 'Файл слишком большой');
        $info = @getimagesizefromstring($bin);
        $types = [IMAGETYPE_WEBP => 'webp', IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png'];
        if (!$info || !isset($types[$info[2]]) || $info[0] > 4000 || $info[1] > 4000) mp_fail(400, 'Файл не похож на изображение');
        $dir = dirname(__DIR__) . '/uploads';
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) mp_fail(500, 'Нет папки для фото');
        if (!is_file($dir . '/.htaccess')) file_put_contents($dir . '/.htaccess', "Options -Indexes\n<FilesMatch \"\\.(php\\d?|phtml|phar|cgi|pl|py|sh)$\">\n  Require all denied\n</FilesMatch>\n");
        $name = date('Ymd') . '-' . bin2hex(random_bytes(8)) . '.' . $types[$info[2]];
        if (file_put_contents($dir . '/' . $name, $bin, LOCK_EX) === false) mp_fail(500, 'Не удалось сохранить фото');
        mp_ok(['url' => 'uploads/' . $name]);

    /* ---------- Смена пароля кабинета ---------- */
    case 'passwd':
        mp_need_admin();
        $pw = is_string($in['password'] ?? null) ? (string)$in['password'] : '';
        if (mb_strlen($pw) < 8 || strlen($pw) > 200) mp_fail(400, 'Пароль должен быть не короче 8 знаков');
        $salt = bin2hex(random_bytes(16));
        if (!mp_write('auth', ['salt' => $salt, 'hash' => mp_pbkdf($pw, $salt), 'changed' => date('c')])) mp_fail(500, 'Не удалось сохранить пароль');
        mp_ok();

    default:
        mp_fail(404, 'Неизвестное действие');
}
