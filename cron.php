<?php
/**
 * FINISH · envío de avisos por mail. Se ejecuta desde la tarea programada (cron) de Hostinger, cada 5 minutos:
 *   php /ruta/al/sitio/public_html/cron.php
 * No funciona desde el navegador.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/private/lib.php';

$pdo = finish_db($err);
if (!$pdo) { fwrite(STDERR, "Sin base de datos: $err\n"); exit(1); }
$cfg = finish_mail_cfg();
if (!$cfg) { fwrite(STDERR, "Falta private/mail.php\n"); exit(1); }
finish_mail_table($pdo);

if (!$pdo->query("SELECT GET_LOCK('finish_mail', 0) l")->fetch()['l']) exit(0);   // ya hay otro envío corriendo

$now = time();
$q = $pdo->prepare('SELECT * FROM finish_mail WHERE sent_at IS NULL AND tries < 3 AND send_at <= ? AND send_at >= ? ORDER BY send_at LIMIT 40');
$q->execute([$now, $now - 6 * 3600]);   // no manda avisos de hace más de 6 horas
$ok = 0; $bad = 0;
foreach ($q->fetchAll() as $m) {
    $errs = [];
    foreach (json_decode($m['to_list'], true) ?: [] as $to) {
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) continue;
        if ($e = smtp_send($cfg, $to, $m['subject'], $m['body'])) $errs[] = $to . ': ' . $e;
    }
    if ($errs) { $bad++; $pdo->prepare('UPDATE finish_mail SET tries = tries + 1, err = ? WHERE k = ?')->execute([substr(implode(' | ', $errs), 0, 290), $m['k']]); }
    else { $ok++; $pdo->prepare('UPDATE finish_mail SET sent_at = ?, err = NULL WHERE k = ?')->execute([time(), $m['k']]); }
}
$pdo->prepare('DELETE FROM finish_mail WHERE sent_at IS NOT NULL AND sent_at < ?')->execute([$now - 60 * 86400]);
echo date('c') . " enviados: $ok, con error: $bad\n";
