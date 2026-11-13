#!/bin/sh
# Самопроверка серверной части. Запускается в терминале хостинга: sh tools/selftest.sh
# Поднимает временную копию серверной части на этом же сервере (127.0.0.1) с ТЕСТОВЫМИ ключом и паролем,
# проверяет вход, сохранение, заявки, загрузку фото, смену пароля и ограничения, затем удаляет копию.
# Рабочие данные сайта (папка mp-data рядом с www) не читает и не меняет.
set -u
SITE="$(cd "$(dirname "$0")/.." && pwd)"
T="$HOME/mp-selftest"
PORT=8917
U="http://127.0.0.1:$PORT/api"
if [ -e "$T" ]; then echo "Папка $T уже существует — удалите её и запустите снова"; exit 1; fi
mkdir -p "$T/a/site" "$T/mp-data" || exit 1
cp -r "$SITE/api" "$T/a/site/" || exit 1
KEY="selftest-key-$(date +%s)"
PW="selftest-pass-1"
KH=$(printf '%s' "$KEY" | sha256sum | cut -d' ' -f1)
sed -i "s/^const MP_ACCESS = '[0-9a-f]*'/const MP_ACCESS = '$KH'/" "$T/a/site/api/lib.php"
php -r '$s=bin2hex(random_bytes(16)); echo json_encode(["salt"=>$s,"hash"=>hash_pbkdf2("sha256",$argv[1],hex2bin($s),150000,64)]);' "$PW" > "$T/mp-data/auth.json"
php -S 127.0.0.1:$PORT -t "$T/a/site" > "$T/server.log" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null; rm -rf "${T:?}"' EXIT
sleep 1

PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo "PASS $1"; }
no() { FAIL=$((FAIL+1)); echo "FAIL $1 :: $2"; }
has() { case "$2" in *"$3"*) ok "$1";; *) no "$1" "$(printf '%s' "$2" | cut -c1-160)";; esac; }
hasnt() { case "$2" in *"$3"*) no "$1" "$(printf '%s' "$2" | cut -c1-160)";; *) ok "$1";; esac; }
SID=""; CSRF=""
post() { curl -s -m 30 -H 'X-Forwarded-Proto: https' -H 'Content-Type: application/json' -H "Cookie: mpsid=$SID" -H "X-CSRF: $CSRF" -X POST -d "$2" "$U/act.php?do=$1"; }
state() { curl -s -m 30 -H 'X-Forwarded-Proto: https' -H "Cookie: mpsid=$SID" "$U/state.php"; }
login() {
  R=$(curl -si -m 30 -H 'X-Forwarded-Proto: https' -H 'Content-Type: application/json' -X POST -d "{\"key\":\"$1\",\"password\":\"$2\"}" "$U/act.php?do=login")
  S=$(printf '%s' "$R" | grep -i '^set-cookie: mpsid=' | tail -1 | sed 's/.*mpsid=\([^;]*\).*/\1/' | tr -d '\r')
  printf '%s' "$S" > "$T/sid"
  printf '%s' "$R" | tail -1
}

has "посетитель: состояние без входа" "$(state)" '"admin":false'
has "вход с неверным паролем отклонён" "$(login "$KEY" wrong)" 'Неверный пароль'
has "вход с неверным ключом отклонён" "$(login wrongkey "$PW")" 'Неверный пароль'
has "вход по http запрещён" "$(curl -s -m 30 -H 'Content-Type: application/json' -X POST -d '{}' "$U/act.php?do=login")" 'https'
has "вход с верными ключом и паролем" "$(login "$KEY" "$PW")" '"ok":true'
SID=$(cat "$T/sid")
ST=$(state); has "после входа: режим владельца" "$ST" '"admin":true'
TOKEN=$(printf '%s' "$ST" | sed 's/.*"csrf":"\([^"]*\)".*/\1/')
has "сохранение без защитного кода отклонено" "$(post save '{"settings":{"phone":"1"}}')" 'Сеанс устарел'
CSRF="$TOKEN"
has "сохранение каталога и настроек" "$(post save '{"products":[{"id":"a","title":"Видимый","visible":true,"images":["assets/x.webp"]},{"id":"b","title":"Скрытый","visible":false}],"settings":{"phone":"+7 000"},"seedrev":7}')" '"ok":true'
ST=$(state); has "владелец видит скрытый товар" "$ST" 'Скрытый'; has "настройки сохранены" "$ST" '+7 000'
SIDA="$SID"; SID=""; ST=$(state); has "посетитель видит товар" "$ST" 'Видимый'; hasnt "посетитель не видит скрытый товар" "$ST" 'Скрытый'; hasnt "посетитель не видит заявки" "$ST" '"leads"'
has "сохранение без входа отклонено" "$(post save '{"products":[]}')" 'Нужен вход'
SID="$SIDA"
has "фото внутри записи товара отклонено" "$(post save '{"products":[{"id":"a","title":"T","images":["data:image/png;base64,AAAA"]}]}')" 'не загружено на сервер'
has "товар без номера отклонён" "$(post save '{"products":[{"title":"T"}]}')" 'нет номера'
[ -f "$T/mp-data/state.json" ] && ok "файл данных лежит вне папки сайта" || no "файл данных" "нет state.json"

SID=""
has "заявка без согласия отклонена" "$(post lead '{"name":"Иван","phone":"+79001112233","ms":5000}')" 'согласие'
has "заявка с коротким телефоном отклонена" "$(post lead '{"name":"Иван","phone":"123","agree":true,"ms":5000}')" 'Проверьте'
has "заявка принята" "$(post lead '{"name":"Иван Тестов","phone":"+79001112233","comment":"<script>x</script>","agree":true,"ms":5000,"hp":"","cart":{"items":[{"id":"a","title":"Позиция заказа","img":"assets/img/products/a-1.webp?2","qty":2,"price":100,"sum":200},{"id":"b","title":"Чужая картинка","img":"https://evil.example/x.png","qty":1,"price":null,"sum":null}],"total":200,"goods":200}}')" '"ok":true'
post lead '{"name":"Робот","phone":"+79001112233","agree":true,"ms":5000,"hp":"spam"}' > /dev/null
SID="$SIDA"
ST=$(state); has "владелец видит заявку" "$ST" 'Иван Тестов'; has "состав заказа сохранён" "$ST" 'Позиция заказа'; has "фото позиции сохранено" "$ST" 'a-1.webp?2'; hasnt "чужая картинка в заказе отброшена" "$ST" 'evil.example'; hasnt "заявка робота не сохранена" "$ST" 'Робот'
LID=$(printf '%s' "$ST" | sed 's/.*"leads":\[{"id":"\([^"]*\)".*/\1/')
has "заявка отмечена обработанной" "$(post lead_update "{\"id\":\"$LID\",\"done\":true}")" '"ok":true'
has "отметка сохранилась" "$(state)" '"done":true'
has "заявка удалена" "$(post lead_delete "{\"id\":\"$LID\"}")" '"ok":true'
hasnt "удалённой заявки нет" "$(state)" 'Иван Тестов'
SID=""; for i in 1 2 3 4; do post lead '{"name":"Иван","phone":"+79001112233","agree":true,"ms":5000}' > /dev/null; done
has "шестая заявка подряд с одного адреса отклонена" "$(post lead '{"name":"Иван","phone":"+79001112233","agree":true,"ms":5000}')" 'Слишком много'
SID="$SIDA"

PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
R=$(post upload "{\"data\":\"data:image/png;base64,$PNG\"}"); has "фото загружено" "$R" '"url":"uploads'
F=$(printf '%s' "$R" | sed 's/.*"url":"\([^"]*\)".*/\1/'); [ -f "$T/a/site/$F" ] && ok "файл фото создан" || no "файл фото" "$F"
has "не картинка отклонена" "$(post upload '{"data":"data:image/png;base64,PD9waHAgZWNobyAxOyA/Pg=="}')" 'не похож'
has "чужой формат отклонён" "$(post upload '{"data":"data:text/html;base64,AAAA"}')" 'Нужен файл изображения'

has "короткий пароль отклонён" "$(post passwd '{"password":"123"}')" 'не короче'
has "пароль изменён" "$(post passwd '{"password":"new-selftest-pass-2"}')" '"ok":true'
has "выход" "$(post logout '{}')" '"ok":true'
has "после выхода сеанс не действует" "$(state)" '"admin":false'
has "старый пароль больше не подходит" "$(login "$KEY" "$PW")" 'Неверный пароль'
has "новый пароль подходит" "$(login "$KEY" new-selftest-pass-2)" '"ok":true'
R=""; for i in 1 2 3 4 5 6 7 8 9; do R=$(login "$KEY" wrong); done
has "после 8 неверных попыток вход блокируется" "$R" 'Слишком много попыток'
has "запрос с чужого сайта отклонён" "$(curl -s -m 30 -H 'Origin: https://evil.example' -H 'Content-Type: application/json' -X POST -d '{}' "$U/act.php?do=lead")" 'другого сайта'
has "служебные данные не лежат в папке сайта" "$(ls "$T/a/site")" 'api'; hasnt "в папке сайта нет файлов данных" "$(ls -R "$T/a/site")" 'state.json'

echo "ИТОГО: пройдено $PASS, ошибок $FAIL"
