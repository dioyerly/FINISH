<?php
/* FINISH · utilidades compartidas por api.php y cron.php (conexión a la base y envío SMTP). */
declare(strict_types=1);

function finish_db(?string &$err = null): ?PDO {
    $f = __DIR__ . '/db.php';
    if (!is_file($f)) { $err = 'sin_db'; return null; }
    $c = @include $f;
    if (!is_array($c)) { $err = 'private/db.php no devuelve un arreglo'; return null; }
    foreach (array_unique([(string)($c['host'] ?? '127.0.0.1'), '127.0.0.1', 'localhost']) as $h) {
        try {
            return new PDO('mysql:host=' . $h . ';port=' . ($c['port'] ?? 3306) . ';dbname=' . ($c['name'] ?? '') . ';charset=utf8mb4',
                (string)($c['user'] ?? ''), (string)($c['pass'] ?? ''),
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
        } catch (Throwable $e) { $err = $h . ': ' . $e->getMessage(); }
    }
    return null;
}

function finish_mail_table(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS finish_mail (
        k VARCHAR(64) NOT NULL PRIMARY KEY,
        send_at BIGINT UNSIGNED NOT NULL,
        to_list TEXT NOT NULL,
        subject VARCHAR(300) NOT NULL,
        body MEDIUMTEXT NOT NULL,
        sent_at BIGINT UNSIGNED NULL,
        tries TINYINT UNSIGNED NOT NULL DEFAULT 0,
        err VARCHAR(300) NULL,
        INDEX (send_at), INDEX (sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function finish_mail_cfg(): ?array {
    $f = __DIR__ . '/mail.php';
    if (!is_file($f)) return null;
    $c = @include $f;
    return (is_array($c) && !empty($c['host']) && !empty($c['user']) && isset($c['pass'])) ? $c : null;
}

/* Envío por SMTP (SSL 465 / STARTTLS 587 / sin cifrado). Devuelve null si salió bien, o el error. */
function smtp_send(array $cfg, string $to, string $subject, string $html): ?string {
    $secure = $cfg['secure'] ?? 'ssl';
    $port = (int)($cfg['port'] ?? ($secure === 'ssl' ? 465 : 587));
    $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . $cfg['host'] . ':' . $port, $en, $es, 15);
    if (!$fp) return "no conecta con {$cfg['host']}:$port ($es)";
    stream_set_timeout($fp, 20);
    $read = function () use ($fp): array {
        $all = ''; $code = 0;
        while (($l = fgets($fp, 1024)) !== false) { $all .= $l; $code = (int)substr($l, 0, 3); if (strlen($l) < 4 || $l[3] === ' ') break; }
        return [$code, trim($all)];
    };
    $cmd = function (string $c, array $ok) use ($fp, $read): ?string {
        if ($c !== '') fwrite($fp, $c . "\r\n");
        [$code, $txt] = $read();
        return in_array($code, $ok, true) ? null : "SMTP $code: $txt";
    };
    try {
        if ($e = $cmd('', [220])) return $e;
        if ($e = $cmd('EHLO finish.local', [250])) return $e;
        if ($secure === 'tls') {
            if ($e = $cmd('STARTTLS', [220])) return $e;
            if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) return 'no pude activar TLS';
            if ($e = $cmd('EHLO finish.local', [250])) return $e;
        }
        if (($cfg['user'] ?? '') !== '' && ($cfg['auth'] ?? true)) {
            if ($e = $cmd('AUTH LOGIN', [334])) return $e;
            if ($e = $cmd(base64_encode($cfg['user']), [334])) return $e;
            if ($e = $cmd(base64_encode((string)$cfg['pass']), [235])) return 'usuario o contraseña del correo incorrectos (' . $e . ')';
        }
        $from = $cfg['from'] ?? $cfg['user'];
        if ($e = $cmd("MAIL FROM:<$from>", [250])) return $e;
        if ($e = $cmd("RCPT TO:<$to>", [250, 251])) return $e;
        if ($e = $cmd('DATA', [354])) return $e;
        $name = $cfg['fromName'] ?? 'Finish';
        $head = 'From: =?UTF-8?B?' . base64_encode($name) . "?= <$from>\r\n"
            . "To: <$to>\r\n"
            . 'Subject: =?UTF-8?B?' . base64_encode($subject) . "?=\r\n"
            . 'Date: ' . date('r') . "\r\n"
            . 'Message-ID: <' . bin2hex(random_bytes(10)) . '@' . (substr(strrchr($from, '@') ?: '@finish.local', 1)) . ">\r\n"
            . "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
        fwrite($fp, $head . chunk_split(base64_encode($html)) . "\r\n.\r\n");
        if ($e = $cmd('', [250])) return $e;
        $cmd('QUIT', [221]);
        return null;
    } finally { @fclose($fp); }
}
