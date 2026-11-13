# FINISH

Agenda, recordatorios, planes, notas y **carga de facturas / pagos** (lee el PDF y trae los datos).

## Estructura
```
index.php          puerta de entrada: correo + contraseña (y sirve la app solo con sesión)
private/app.html   la página de la app (bloqueada para acceso directo)
assets/app.css     diseño
assets/app.js      toda la lógica (recordatorios, calendario, pagos, lectura de PDF)
assets/vendor/     pdf.js y SheetJS (lectura de PDF y de Excel), sin CDN
tools/preview.py   arma un HTML único para ver la app sin servidor
```

## Primera vez en el servidor (Hostinger)
1. Subí/deployá la carpeta tal cual (la raíz del sitio es la carpeta donde está `index.php`).
2. **Abrí la URL enseguida**: la primera vez pide crear tu correo y contraseña (mínimo 10 caracteres). Después de eso nadie más puede crear acceso.
3. Desde ahí, para entrar hace falta correo + contraseña. Tras 5 intentos fallidos se bloquea 15 min. La sesión se cierra sola a las 12 h sin uso.

El acceso se guarda hasheado en `.finish_auth.php` (un nivel arriba de la carpeta pública, si el hosting lo permite) o en `private/auth.php`. Ese archivo **no está en Git**.
Para cambiar el correo o la contraseña: borrá ese archivo y volvé a abrir la URL.

## Datos
Por ahora los datos (recordatorios, pagos, proveedores) se guardan en el navegador de cada equipo (localStorage). Desde Ajustes se puede exportar/importar una copia. La base de datos en el servidor es el siguiente paso.

## Editar
Los cambios van en `assets/app.css`, `assets/app.js` y `private/app.html`. Al subirlos se ven al recargar (el servidor agrega la versión del archivo para evitar caché).

## Avisos por mail
- La app calcula los próximos 14 días de avisos y los guarda en la base (`finish_mail`) cada vez que se guarda algo.
- `cron.php` los envía por SMTP. Se ejecuta con una tarea programada de hPanel cada 5 minutos: `php /home/u748338755/domains/finish.estrategia.site/public_html/cron.php`
- La contraseña de la casilla va en `private/mail.php` (plantilla: `private/mail.example.php`). No se sube a Git.
