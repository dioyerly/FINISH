<?php
/**
 * FINISH · API de guardado en MySQL.
 * Solo responde si hay sesión iniciada (la misma de index.php).
 *  GET  api.php?a=load   -> {"version":N,"data":{...}}  (data = null si todavía no hay nada)
 *  POST api.php?a=save   -> cuerpo {"version":N,"data":{...}}, cabecera X-CSRF. 409 si otro dispositivo guardó antes.
 * Los datos de conexión están en private/db.php (no se sube a Git).
 */
declare(strict_types=1);

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
$base  = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/') . '/';
session_name('finish_sid');
session_set_cookie_params(['lifetime' => 0, 'path' => $base, 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

function out(int $code, array $a): never { http_response_code($code); echo json_encode($a, JSON_UNESCAPED_UNICODE); exit; }

if (empty($_SESSION['ok']) || (time() - (int)($_SESSION['last'] ?? 0)) > 12 * 3600) out(401, ['error' => 'auth']);
$_SESSION['last'] = time();
$csrf = (string)($_SESSION['csrf'] ?? '');
session_write_close();

$cfgFile = __DIR__ . '/private/db.php';

/* Conectar la base una sola vez: la contraseña se escribe acá (no en el chat ni en Git) y se guarda en private/db.php */
if (($_GET['a'] ?? '') === 'setup_db' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($csrf, (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) out(400, ['error' => 'csrf']);
    if (is_file($cfgFile)) { $old = @include $cfgFile; if (is_array($old)) { try { new PDO('mysql:host=' . $old['host'] . ';port=' . $old['port'] . ';dbname=' . $old['name'], $old['user'], $old['pass']); out(409, ['error' => 'ya']); } catch (Throwable $e) {} } }
    $in = json_decode((string)file_get_contents('php://input'), true);
    $c = ['host' => '127.0.0.1', 'port' => 3306, 'name' => trim((string)($in['name'] ?? '')), 'user' => trim((string)($in['user'] ?? '')), 'pass' => (string)($in['pass'] ?? '')];
    if (!preg_match('/^[A-Za-z0-9_]{3,64}$/', $c['name']) || !preg_match('/^[A-Za-z0-9_]{3,64}$/', $c['user']) || $c['pass'] === '') out(400, ['error' => 'datos']);
    try { new PDO('mysql:host=127.0.0.1;port=3306;dbname=' . $c['name'] . ';charset=utf8mb4', $c['user'], $c['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    catch (Throwable $e) { out(422, ['error' => 'conexion']); }
    if (@file_put_contents($cfgFile, "<?php\nreturn " . var_export($c, true) . ";\n", LOCK_EX) === false) out(500, ['error' => 'escribir']);
    @chmod($cfgFile, 0600);
    out(200, ['ok' => 1]);
}
if (!is_file($cfgFile)) out(503, ['error' => 'sin_db']);
$c = @include $cfgFile;
if (!is_array($c)) out(503, ['error' => 'db', 'detalle' => 'private/db.php existe pero no devuelve un arreglo (revisá que empiece con <?php y tenga return [ ... ];)']);

$pdo = null; $lastErr = '';
foreach (array_unique([(string)($c['host'] ?? '127.0.0.1'), '127.0.0.1', 'localhost']) as $hst) {
    try {
        $pdo = new PDO(
            'mysql:host=' . $hst . ';port=' . ($c['port'] ?? 3306) . ';dbname=' . ($c['name'] ?? '') . ';charset=utf8mb4',
            (string)($c['user'] ?? ''), (string)($c['pass'] ?? ''),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
        break;
    } catch (Throwable $e) { $lastErr = $hst . ': ' . $e->getMessage(); }
}
if (!$pdo) out(503, ['error' => 'db', 'detalle' => $lastErr]);
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS finish_state (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        version INT UNSIGNED NOT NULL DEFAULT 0,
        data LONGTEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS finish_backup (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        version INT UNSIGNED NOT NULL,
        data LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Throwable $e) {
    out(503, ['error' => 'db', 'detalle' => $e->getMessage()]);
}

$a = $_GET['a'] ?? '';

if ($a === 'load' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $r = $pdo->query('SELECT version, data FROM finish_state WHERE id = 1')->fetch();
    http_response_code(200);
    echo $r ? '{"version":' . (int)$r['version'] . ',"data":' . $r['data'] . '}' : '{"version":0,"data":null}';
    exit;
}

if ($a === 'save' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($csrf, (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) out(400, ['error' => 'csrf']);
    $raw = (string)file_get_contents('php://input');
    if (strlen($raw) > 12 * 1024 * 1024) out(413, ['error' => 'grande']);
    $in = json_decode($raw, true);
    if (!is_array($in) || !isset($in['data']) || !is_array($in['data']) || !isset($in['data']['rem']) || !is_array($in['data']['rem'])) out(400, ['error' => 'datos']);
    $clientVer = (int)($in['version'] ?? 0);
    $json = json_encode($in['data'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) out(400, ['error' => 'datos']);

    $pdo->beginTransaction();
    try {
        $r = $pdo->query('SELECT version, data FROM finish_state WHERE id = 1 FOR UPDATE')->fetch();
        if ($r && (int)$r['version'] !== $clientVer) { $pdo->rollBack(); out(409, ['error' => 'version', 'version' => (int)$r['version']]); }
        if (!$r) {
            $new = 1;
            $pdo->prepare('INSERT INTO finish_state (id, version, data) VALUES (1, ?, ?)')->execute([$new, $json]);
        } else {
            // copia de seguridad: como mucho una por hora, quedan las últimas 40
            $last = $pdo->query('SELECT UNIX_TIMESTAMP(MAX(created_at)) t FROM finish_backup')->fetch();
            if (!$last || !$last['t'] || time() - (int)$last['t'] > 3600) {
                $pdo->prepare('INSERT INTO finish_backup (version, data) VALUES (?, ?)')->execute([(int)$r['version'], $r['data']]);
                $pdo->exec('DELETE FROM finish_backup WHERE id NOT IN (SELECT id FROM (SELECT id FROM finish_backup ORDER BY id DESC LIMIT 40) x)');
            }
            $new = (int)$r['version'] + 1;
            $pdo->prepare('UPDATE finish_state SET version = ?, data = ? WHERE id = 1')->execute([$new, $json]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        out(500, ['error' => 'guardar']);
    }
    out(200, ['version' => $new]);
}

if ($a === 'mailst' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    require_once __DIR__ . '/private/lib.php'; finish_mail_table($pdo);
    $r = $pdo->query('SELECT SUM(sent_at IS NULL AND tries < 3) p, SUM(sent_at IS NOT NULL) s, SUM(tries >= 3 AND sent_at IS NULL) f FROM finish_mail')->fetch();
    $e = $pdo->query('SELECT err FROM finish_mail WHERE err IS NOT NULL ORDER BY send_at DESC LIMIT 1')->fetch();
    out(200, ['config' => finish_mail_cfg() !== null, 'pend' => (int)$r['p'], 'sent' => (int)$r['s'], 'fail' => (int)$r['f'], 'err' => $e['err'] ?? '']);
}

if ($a === 'mailtest' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($csrf, (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) out(400, ['error' => 'csrf']);
    require_once __DIR__ . '/private/lib.php';
    $cfg = finish_mail_cfg(); if (!$cfg) out(412, ['error' => 'sin_mail']);
    $in = json_decode((string)file_get_contents('php://input'), true);
    $to = trim((string)($in['to'] ?? ''));
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) out(400, ['error' => 'mail']);
    $e = smtp_send($cfg, $to, 'Finish · mail de prueba', '<div style="font-family:Arial,sans-serif;font-size:15px"><b>Funciona.</b> Los avisos de Finish van a llegar a este correo.</div>');
    $e ? out(502, ['error' => 'envio', 'detalle' => $e]) : out(200, ['ok' => 1]);
}

if ($a === 'outbox' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($csrf, (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) out(400, ['error' => 'csrf']);
    require_once __DIR__ . '/private/lib.php'; finish_mail_table($pdo);
    $in = json_decode((string)file_get_contents('php://input'), true);
    $items = is_array($in['items'] ?? null) ? array_slice($in['items'], 0, 400) : null;
    if ($items === null) out(400, ['error' => 'datos']);
    $pdo->beginTransaction();
    try {
        $pdo->exec('DELETE FROM finish_mail WHERE sent_at IS NULL AND tries < 3');   // se reemplaza lo pendiente; lo ya enviado se conserva
        $ins = $pdo->prepare('INSERT IGNORE INTO finish_mail (k, send_at, to_list, subject, body) VALUES (?, ?, ?, ?, ?)');
        $n = 0;
        foreach ($items as $it) {
            $to = array_values(array_filter((array)($it['to'] ?? []), fn($x) => is_string($x) && filter_var($x, FILTER_VALIDATE_EMAIL)));
            $k = (string)($it['k'] ?? ''); $at = (int)($it['at'] ?? 0);
            if ($k === '' || !$to || $at < 1e9) continue;
            $ins->execute([substr(sha1($k), 0, 40), $at, json_encode($to), mb_substr((string)($it['subj'] ?? ''), 0, 290), mb_substr((string)($it['html'] ?? ''), 0, 60000)]);
            $n += $ins->rowCount();
        }
        $pdo->commit();
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); out(500, ['error' => 'guardar']); }
    out(200, ['ok' => 1, 'n' => $n]);
}

out(404, ['error' => 'ruta']);
