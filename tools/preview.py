#!/usr/bin/env python3
"""Arma un HTML único (sin servidor) para ver la app: python3 tools/preview.py
Resultado: tools/out/finish-preview.html  (no tiene login: es solo para mirar)."""
import base64, os, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(R, p), 'rb').read()
b64 = lambda p: base64.b64encode(rd(p)).decode()
css = rd('assets/app.css').decode()
css = re.sub(r'url\((fonts/[^)]+)\)', lambda m: 'url(data:font/woff2;base64,%s)' % b64('assets/' + m.group(1)), css)
js = rd('assets/app.js').decode()
html = rd('private/app.html').decode()
html = html.replace('<link rel="stylesheet" href="assets/app.css">', '<style>\n%s\n</style>' % css)
libs = ''.join('<script id="%s" type="text/plain">%s</script>' % (i, b64('assets/vendor/' + f))
               for i, f in [('xjl', 'xlsx.full.min.js'), ('pjl', 'pdf.min.js'), ('pjw', 'pdf.worker.min.js')])
html = html.replace('<script src="assets/app.js"></script>', libs + '\n<script>\n%s\n</script>' % js.replace('</script', '<\\/script'))
os.makedirs(os.path.join(R, 'tools', 'out'), exist_ok=True)
out = os.path.join(R, 'tools', 'out', 'finish-preview.html')
open(out, 'w').write(html)
print(out, len(html) // 1024, 'KB')
