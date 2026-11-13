<?php
/**
 * FINISH · puerta de entrada con correo y contraseña.
 * - Primera vez (sin acceso creado): pide crear correo + contraseña.
 * - Después: solo entra quien tenga el correo y la contraseña.
 * La app vive en private/app.html y solo se sirve si hay sesión iniciada.
 */
declare(strict_types=1);

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
$base  = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/') . '/';

session_name('finish_sid');
session_set_cookie_params(['lifetime' => 0, 'path' => $base, 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

const IDLE_SECONDS = 12 * 3600;   // cierra la sesión tras 12 h sin uso
const MAX_FAILS    = 5;           // intentos fallidos...
const LOCK_SECONDS = 900;         // ...y bloqueo de 15 min

/* ---------- dónde se guarda el acceso (fuera de la carpeta pública si se puede) ---------- */
function auth_paths(): array {
    return [dirname(__DIR__) . '/.finish_auth.php', __DIR__ . '/private/auth.php'];
}
function auth_load(): ?array {
    foreach (auth_paths() as $p) {
        if (is_file($p)) { $c = @include $p; if (is_array($c) && isset($c['email'], $c['hash'])) return $c; }
    }
    return null;
}
function auth_save(string $email, string $hash): bool {
    $code = "<?php\nreturn " . var_export(['email' => $email, 'hash' => $hash, 'created' => date('c')], true) . ";\n";
    foreach (auth_paths() as $p) {
        if (@file_put_contents($p, $code, LOCK_EX) !== false) { @chmod($p, 0600); return true; }
    }
    return false;
}

/* ---------- freno a intentos repetidos (por IP) ---------- */
function fails_file(): string { return sys_get_temp_dir() . '/finish_fails_' . md5(__DIR__) . '.json'; }
function fails_get(): array { $f = fails_file(); $d = is_file($f) ? json_decode((string)@file_get_contents($f), true) : []; return is_array($d) ? $d : []; }
function fails_put(array $d): void { @file_put_contents(fails_file(), json_encode($d), LOCK_EX); }
function ip_key(): string { return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '0') . __DIR__); }
function locked(): int {
    $d = fails_get(); $k = ip_key();
    if (isset($d[$k]) && $d[$k]['n'] >= MAX_FAILS) { $left = $d[$k]['t'] + LOCK_SECONDS - time(); if ($left > 0) return $left; unset($d[$k]); fails_put($d); }
    return 0;
}
function fail_add(): void { $d = fails_get(); $k = ip_key(); $d[$k] = ['n' => ($d[$k]['n'] ?? 0) + 1, 't' => time()]; fails_put($d); }
function fail_clear(): void { $d = fails_get(); unset($d[ip_key()]); fails_put($d); }

/* ---------- CSRF ---------- */
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
function csrf_ok(): bool { return isset($_POST['csrf']) && hash_equals($_SESSION['csrf'], (string)$_POST['csrf']); }
function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

/* ---------- salir ---------- */
if (isset($_GET['salir'])) {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) { $p = session_get_cookie_params(); setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'] ?? '', $p['secure'], $p['httponly']); }
    session_destroy();
    header('Location: ' . $base); exit;
}

$cfg = auth_load();
$msg = '';

/* ---------- sesión válida? ---------- */
$logged = !empty($_SESSION['ok']) && $cfg && hash_equals((string)($_SESSION['who'] ?? ''), hash('sha256', $cfg['email'] . $cfg['hash']));
if ($logged && (time() - (int)($_SESSION['last'] ?? 0)) > IDLE_SECONDS) { $logged = false; $_SESSION = ['csrf' => $_SESSION['csrf']]; $msg = 'Tu sesión venció. Entrá de nuevo.'; }

/* ---------- acciones POST ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok()) { http_response_code(400); $msg = 'Se venció el formulario. Probá de nuevo.'; }
    elseif (!$cfg && ($_POST['a'] ?? '') === 'setup') {
        $em = strtolower(trim((string)($_POST['email'] ?? ''))); $p1 = (string)($_POST['p1'] ?? ''); $p2 = (string)($_POST['p2'] ?? '');
        if (!filter_var($em, FILTER_VALIDATE_EMAIL)) $msg = 'Poné un correo válido.';
        elseif (strlen($p1) < 10) $msg = 'La contraseña tiene que tener al menos 10 caracteres.';
        elseif (!hash_equals($p1, $p2)) $msg = 'Las contraseñas no coinciden.';
        elseif (!auth_save($em, password_hash($p1, PASSWORD_DEFAULT))) $msg = 'No pude guardar el acceso: el servidor no deja escribir. Revisá los permisos de la carpeta private/.';
        else { $cfg = auth_load(); session_regenerate_id(true); $_SESSION['ok'] = 1; $_SESSION['who'] = hash('sha256', $cfg['email'] . $cfg['hash']); $_SESSION['last'] = time(); $_SESSION['csrf'] = bin2hex(random_bytes(32)); header('Location: ' . $base); exit; }
    }
    elseif ($cfg && ($_POST['a'] ?? '') === 'login') {
        if (($wait = locked()) > 0) { $msg = 'Demasiados intentos. Esperá ' . ceil($wait / 60) . ' min.'; }
        else {
            $em = strtolower(trim((string)($_POST['email'] ?? ''))); $pw = (string)($_POST['pw'] ?? '');
            $okMail = hash_equals($cfg['email'], $em);
            $okPass = password_verify($pw, $cfg['hash']);   // siempre se verifica, para no dar pistas
            if ($okMail && $okPass) {
                fail_clear(); session_regenerate_id(true);
                $_SESSION['ok'] = 1; $_SESSION['who'] = hash('sha256', $cfg['email'] . $cfg['hash']); $_SESSION['last'] = time(); $_SESSION['csrf'] = bin2hex(random_bytes(32));
                header('Location: ' . $base); exit;
            }
            fail_add(); usleep(600000); $msg = 'Correo o contraseña incorrectos.';
        }
    }
}

/* ---------- entra a la app ---------- */
if ($logged) {
    $_SESSION['last'] = time();
    $html = (string)file_get_contents(__DIR__ . '/private/app.html');
    foreach (['assets/app.css', 'assets/app.js'] as $a) { $v = @filemtime(__DIR__ . '/' . $a) ?: 1; $html = str_replace($a . '"', $a . '?v=' . $v . '"', $html); }
    $html = str_replace('<head>', '<head><base href="' . h($base) . '">', $html);
    $html = str_replace('</body>', '<a class="salir" href="' . h($base) . '?salir=1">Salir</a></body>', $html);
    echo $html; exit;
}

/* ---------- pantalla de acceso ---------- */
$setup = ($cfg === null);
?><!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><base href="<?= h($base) ?>">
<title>Finish · acceso</title>
<link rel="stylesheet" href="assets/app.css">
<style>
body{display:grid;place-items:center;padding:24px}
.gate{width:100%;max-width:420px;background:#fff;border-radius:28px;padding:34px 30px;box-shadow:0 30px 80px -30px rgba(14,17,32,.35)}
.gate .logo{margin-bottom:6px}.gate h1{font:600 34px/1.1 var(--serif);letter-spacing:-.02em;margin:14px 0 6px}
.gate p{color:var(--mut);font-size:14px;margin-bottom:20px}
.gate .btn{width:100%;justify-content:center;padding:13px;font-size:15px;margin-top:6px}
.err{background:#ffe0d8;color:#a8290c;border-radius:12px;padding:10px 12px;font-size:13.5px;margin-bottom:14px;font-weight:500}
</style></head><body>
<form class="gate" method="post" autocomplete="on">
  <span class="logo"><i></i>Finish</span>
  <h1><?= $setup ? 'Creá tu acceso' : 'Entrá' ?></h1>
  <p><?= $setup ? 'Primera vez acá. Elegí el correo y la contraseña con los que vas a entrar.' : 'Agenda, recordatorios y pagos.' ?></p>
  <?php if ($msg): ?><div class="err"><?= h($msg) ?></div><?php endif; ?>
  <input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>">
  <input type="hidden" name="a" value="<?= $setup ? 'setup' : 'login' ?>">
  <label class="fld"><span>Correo</span><input class="i" type="email" name="email" required autofocus autocomplete="username"></label>
  <?php if ($setup): ?>
    <label class="fld"><span>Contraseña (mínimo 10 caracteres)</span><input class="i" type="password" name="p1" required minlength="10" autocomplete="new-password"></label>
    <label class="fld"><span>Repetí la contraseña</span><input class="i" type="password" name="p2" required minlength="10" autocomplete="new-password"></label>
    <button class="btn c" type="submit">Crear acceso y entrar</button>
  <?php else: ?>
    <label class="fld"><span>Contraseña</span><input class="i" type="password" name="pw" required autocomplete="current-password"></label>
    <button class="btn c" type="submit">Entrar</button>
  <?php endif; ?>
</form></body></html>
