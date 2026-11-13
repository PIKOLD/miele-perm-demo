<?php
/* Серверная часть сайта: общие функции.
   Данные (каталог, настройки, заявки) лежат в папке mp-data ВНЕ папки сайта — из интернета она недоступна.
   Пароль и ключ доступа здесь не хранятся: только их хеши, те же, что в assets/js/store.js. */
declare(strict_types=1);

const MP_ACCESS = '6b8e63984b5bcaf4b482b44258e408e772e1350aecc44cf39d8b94197ea740f7';   // SHA-256 ключа из ссылки доступа
const MP_PASS_SALT = '45f74115bb01e4ad5a013987a7cb45c7';                                 // пароль по умолчанию: соль
const MP_PASS_HASH = 'f8ab82c841877c0b0621d7ba81d27f48238980b46147ba46d841ad0236cf6a73'; // и хеш PBKDF2-SHA256
const MP_ITER = 150000;
const MP_IDLE = 43200;            // сеанс кабинета живёт 12 часов без действий
const MP_MAX_BODY = 4000000;      // предел размера запроса, байт

function mp_fail(int $code, string $msg): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function mp_ok(array $data = []): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['ok' => true] + $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/* Папка данных: рядом с папкой www, а не внутри сайта */
function mp_dir(): string {
    static $d = null;
    if ($d !== null) return $d;
    $root = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
    if ($root === '' || !is_dir($root)) $root = dirname(__DIR__);
    $d = dirname($root, 2) . '/mp-data';
    foreach ([$d, $d . '/sessions', $d . '/backups'] as $p) {
        if (!is_dir($p) && !@mkdir($p, 0700, true) && !is_dir($p)) mp_fail(500, 'Нет доступа к папке данных');
    }
    return $d;
}

function mp_read(string $name, $def) {
    $f = mp_dir() . '/' . $name . '.json';
    if (!is_file($f)) return $def;
    $v = json_decode((string)file_get_contents($f), true);
    return $v === null ? $def : $v;
}

function mp_write(string $name, $val): bool {
    $f = mp_dir() . '/' . $name . '.json';
    $tmp = $f . '.' . bin2hex(random_bytes(4)) . '.tmp';
    $json = json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false) return false;
    @chmod($tmp, 0600);
    return rename($tmp, $f);
}

/* Одна запись за раз: читать-изменить-записать под общей блокировкой */
function mp_lock() {
    $h = fopen(mp_dir() . '/lock', 'c');
    if ($h) flock($h, LOCK_EX);
    return $h;
}

/* Копия каталога раз в день, хранится 30 последних */
function mp_backup(): void {
    $src = mp_dir() . '/state.json';
    if (!is_file($src)) return;
    $dst = mp_dir() . '/backups/state-' . date('Ymd') . '.json';
    if (is_file($dst)) return;
    @copy($src, $dst);
    $all = glob(mp_dir() . '/backups/state-*.json') ?: [];
    sort($all);
    foreach (array_slice($all, 0, max(0, count($all) - 30)) as $old) @unlink($old);
}

function mp_https(): bool {
    return (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off')
        || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https'
        || (string)($_SERVER['SERVER_PORT'] ?? '') === '443';
}

function mp_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string)MP_IDLE);
    session_save_path(mp_dir() . '/sessions');
    session_name('mpsid');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => mp_https(), 'httponly' => true, 'samesite' => 'Strict']);
    session_start();
    if (!empty($_SESSION['admin'])) {
        if (time() - (int)($_SESSION['seen'] ?? 0) > MP_IDLE) { $_SESSION = []; session_regenerate_id(true); }
        else $_SESSION['seen'] = time();
    }
}

function mp_admin(): bool {
    return session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['admin']);
}

/* Секрет сервера: создаётся один раз, нужен, чтобы не хранить IP-адреса в открытом виде */
function mp_secret(): string {
    $f = mp_dir() . '/secret.txt';
    if (!is_file($f)) { file_put_contents($f, bin2hex(random_bytes(32)), LOCK_EX); @chmod($f, 0600); }
    return trim((string)file_get_contents($f));
}

function mp_ip(): string {
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    if ($ip === '' || preg_match('/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$)/', $ip)) {
        foreach (['HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR'] as $k) {
            $v = trim(explode(',', (string)($_SERVER[$k] ?? ''))[0]);
            if ($v !== '' && filter_var($v, FILTER_VALIDATE_IP)) return $v;
        }
    }
    return $ip;
}

/* Ограничение частоты: сколько событий было с этого адреса за окно и запись нового события */
function mp_hits(string $bucket, int $window, bool $add = false, bool $global = false): int {
    $key = $bucket . ':' . ($global ? 'all' : substr(hash('sha256', mp_ip() . mp_secret()), 0, 20));
    $h = mp_lock();
    $all = mp_read('throttle', []);
    $now = time();
    foreach ($all as $k => $list) {
        $all[$k] = array_values(array_filter((array)$list, function ($t) use ($now) { return $now - (int)$t < 86400; }));
        if (!$all[$k]) unset($all[$k]);
    }
    $mine = array_values(array_filter($all[$key] ?? [], function ($t) use ($now, $window) { return $now - (int)$t < $window; }));
    if ($add) { $all[$key] = array_merge($all[$key] ?? [], [$now]); mp_write('throttle', $all); }
    if ($h) { flock($h, LOCK_UN); fclose($h); }
    return count($mine) + ($add ? 1 : 0);
}

function mp_pass(): array {
    $a = mp_read('auth', null);
    if (is_array($a) && !empty($a['salt']) && !empty($a['hash'])) return [$a['salt'], $a['hash']];
    return [MP_PASS_SALT, MP_PASS_HASH];
}

function mp_pbkdf(string $password, string $saltHex): string {
    return hash_pbkdf2('sha256', $password, (string)hex2bin($saltHex), MP_ITER, 64);
}

/* Тело запроса: только JSON, только с этого же сайта */
function mp_body(): array {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') mp_fail(405, 'Только POST');
    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin !== '' && strcasecmp((string)parse_url($origin, PHP_URL_HOST), (string)explode(':', (string)($_SERVER['HTTP_HOST'] ?? ''))[0]) !== 0) mp_fail(403, 'Запрос с другого сайта');
    $raw = (string)file_get_contents('php://input', false, null, 0, MP_MAX_BODY + 1);
    if (strlen($raw) > MP_MAX_BODY) mp_fail(413, 'Слишком большой запрос');
    $d = json_decode($raw, true);
    if (!is_array($d)) mp_fail(400, 'Неверный формат запроса');
    return $d;
}

/* Действия кабинета: нужен сеанс и защитный код из сеанса */
function mp_need_admin(): void {
    if (isset($_COOKIE['mpsid'])) mp_session();
    if (!mp_admin()) mp_fail(401, 'Нужен вход в кабинет');
    $csrf = (string)($_SERVER['HTTP_X_CSRF'] ?? '');
    if ($csrf === '' || !hash_equals((string)($_SESSION['csrf'] ?? ''), $csrf)) mp_fail(403, 'Сеанс устарел, обновите страницу');
}

function mp_str($v, int $max): string {
    $s = is_scalar($v) ? trim((string)$v) : '';
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $s) ?? '';
    return mb_substr($s, 0, $max);
}
