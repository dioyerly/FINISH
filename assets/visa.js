/* FINISH · Visa → Odoo. Lógica pura (no toca la app ni sus datos).
   FinVisa.parseCsv(texto) -> filas (arreglo de arreglos)
   FinVisa.decodificar(arrayBuffer) -> texto (utf-8 o windows-1252)
   FinVisa.preparar(filas) -> { filas:[{FECHA,IMPORTE,ETIQUETA}], omitidas, neto }
   FinVisa.aCsv(filas) -> texto CSV para Odoo (FECHA,IMPORTE,ETIQUETA) */
(function (root) {
  'use strict';
  function decodificar(buf) {
    var u8 = new Uint8Array(buf), t;
    try { t = new TextDecoder('utf-8', { fatal: true }).decode(u8); }
    catch (e) { t = new TextDecoder('windows-1252').decode(u8); }
    return t.replace(/^﻿/, '');
  }
  function parseCsv(txt) {
    var primera = (txt.split(/\r?\n/)[0] || ''), sep = (primera.split(';').length > primera.split(',').length) ? ';' : ',';
    var rows = [], row = [], f = '', q = false, i, c;
    for (i = 0; i < txt.length; i++) {
      c = txt[i];
      if (q) {
        if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === sep) { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  /* mismo criterio que clean_money_value de la app de Python */
  function dinero(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).trim();
    if (!s) return 0;
    s = s.replace(/[^0-9,.\-]/g, '');
    if (!s || ['-', '.', ',', '-.', '-,'].indexOf(s) >= 0) return 0;
    var hasP = s.indexOf('.') >= 0, hasC = s.indexOf(',') >= 0;
    if (hasP && hasC) {
      if (s.lastIndexOf('.') > s.lastIndexOf(',')) s = s.replace(/,/g, '');
      else s = s.replace(/\./g, '').replace(',', '.');
    } else if (hasC) s = s.replace(',', '.');
    else if (hasP) {
      var p = s.split('.');
      if (p.length > 2) s = s.replace(/\./g, '');
      else if (p.length === 2 && p[1].length === 3) s = s.replace('.', '');
    }
    var n = parseFloat(s);
    return isFinite(n) && /^-?\d*\.?\d*$/.test(s) ? n : 0;
  }
  function normCol(c) {
    return String(c == null ? '' : c).replace(/﻿/g, '').trim().toUpperCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  }
  function txt(v) {
    if (v == null) return '';
    if (v instanceof Date) { var p = function (n) { return ('0' + n).slice(-2); }; return p(v.getUTCDate()) + '-' + p(v.getUTCMonth() + 1) + '-' + String(v.getUTCFullYear()).slice(-2); }
    return String(v).trim();
  }
  function preparar(filas) {
    if (!filas.length) throw new Error('El archivo está vacío');
    var cols = filas[0].map(normCol), ix = function (n) { return cols.indexOf(n); };
    var fi = cols.findIndex(function (c) { return c === 'FECHA' || c.indexOf('FECHA ') === 0; });
    if (fi < 0) throw new Error('No encontré una columna FECHA. Columnas: ' + cols.join(', '));
    var datos = filas.slice(1).filter(function (r) { return r[fi] != null && txt(r[fi]) !== ''; });
    var out = [], omitidas = 0, caso1 = ix('IMPORTE') >= 0 && ix('ETIQUETA') >= 0, pi = ix('PESOS');
    if (!caso1 && pi < 0) throw new Error("No hay columnas reconocibles de importes ('IMPORTE' o 'PESOS')");
    var ti = ix('TITULAR'), ri = ix('REFERENCIA') >= 0 ? ix('REFERENCIA') : ix('REFERENCI'), ci = ix('CUOTA'),
        fa = ix('FACTURA') >= 0 ? ix('FACTURA') : ix('FACTURAS');
    datos.forEach(function (r) {
      if (caso1) { out.push({ FECHA: txt(r[fi]), IMPORTE: -dinero(r[ix('IMPORTE')]), ETIQUETA: txt(r[ix('ETIQUETA')]) }); return; }
      var m = dinero(r[pi]);
      if (m === 0) { omitidas++; return; }
      var partes = [ti >= 0 ? txt(r[ti]) : '', ri >= 0 ? txt(r[ri]) : '', ci >= 0 ? txt(r[ci]) : '', fa >= 0 ? txt(r[fa]) : ''].filter(function (p) { return p !== ''; });
      out.push({ FECHA: txt(r[fi]), IMPORTE: -m, ETIQUETA: partes.join(' _ ') });
    });
    return { filas: out, omitidas: omitidas, neto: out.reduce(function (s, x) { return s + x.IMPORTE; }, 0) };
  }
  function num(n) { var s = String(n === 0 ? 0 : n); return /^-?\d+$/.test(s) ? s + '.0' : s; }   // como float de Python: 240000.0
  function celda(s) { s = String(s); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function aCsv(filas) {
    return ['FECHA,IMPORTE,ETIQUETA'].concat(filas.map(function (x) { return [celda(x.FECHA), num(x.IMPORTE), celda(x.ETIQUETA)].join(','); })).join('\r\n') + '\r\n';
  }

  /* ===== Paso 1: PDF de Visa Galicia -> filas =====
     items: [{p,s,x,y,w}] de pdf.js (getTextContent). Columnas por posición, no por regex. */
  var TITULARES = { '2506': 'Corporativa  Jorge Riveros', '6979': 'Corporativa  Jorge Riveros', '2514': 'Corporativa Joaquín Stepansky',
    '6351': 'Corporativa  Susana Bucatar', '4552': 'Corporativa  Juan Pablo Mansilla', '4560': 'Corporativa  Juan Agustín Mansilla',
    '9347': 'Corporativa  Nora Matti', '8799': 'Corporativa  Adriana Martinez', '3893': 'Corporativa  Gabriel Stepansky' };
  function titulo(n) { return n.toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
  function aNum(t) { if (t == null || t === '') return null; var n = dinero(String(t).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : null; }
  function limpiarRef(ref, conUsd) {
    var tk = ref.split(/\s+/).filter(Boolean), out = [], i, t;
    if (conUsd) {
      for (i = 0; i < tk.length; i++) {
        t = tk[i];
        if (/^(USD|CLP)$/i.test(t)) { if (out.length && /\d/.test(out[out.length - 1]) && /^[A-Za-z0-9]{6,}$/.test(out[out.length - 1])) out.pop(); break; }
        if (/(USD|CLP)$/i.test(t) && t.length > 3) break;
        out.push(t);
      }
      tk = out;
    }
    return tk.join(' ');
  }
  function transcribir(items) {
    var filas = [], bloque = [], dentro = false, fin = false, porTarjeta = [], bancos = [], paginas = {};
    items.forEach(function (it) { (paginas[it.p] = paginas[it.p] || []).push(it); });
    Object.keys(paginas).map(Number).sort(function (a, b) { return a - b; }).forEach(function (pg) {
      if (fin) return;
      var lin = {};
      paginas[pg].forEach(function (it) { var k = Math.round(it.y); var kk = Object.keys(lin).find(function (z) { return Math.abs(z - k) <= 2; }); (lin[kk != null ? kk : k] = lin[kk != null ? kk : k] || []).push(it); });
      Object.keys(lin).map(Number).sort(function (a, b) { return b - a; }).forEach(function (y) {
        if (fin) return;
        var its = lin[y].sort(function (a, b) { return a.x - b.x; }), full = its.map(function (i) { return i.s; }).join(' ').replace(/\s+/g, ' ').trim();
        if (/DETALLE DEL CONSUMO/.test(full)) { dentro = true; return; }
        if (!dentro) return;
        if (/^TOTAL A PAGAR/.test(full)) { fin = true; return; }
        var mt = full.match(/^TARJETA\s+(\d{4})\s+Total Consumos de\s+(.+?)\s+(-?[\d.]+,\d{2})\s+(-?[\d.]+,\d{2})$/i);
        if (mt) {
          var nom = TITULARES[mt[1]] || ('Corporativa  ' + titulo(mt[2]));
          bloque.forEach(function (r) { r.TITULAR = nom; r.TARJETA = mt[1]; });
          porTarjeta.push({ tarjeta: mt[1], nombre: nom, pdf: mt[2], totPesos: aNum(mt[3]), totUsd: aNum(mt[4]), filas: bloque });
          bloque = []; return;
        }
        var f = its.filter(function (i) { return /^\d{2}-\d{2}-\d{2}$/.test(i.s) && i.x < 70; })[0];
        if (!f) return;
        var mk = '', ref = [], cuota = '', comp = '', pes = '', dol = '';
        its.forEach(function (i) {
          if (i === f) return;
          var der = i.x + i.w;
          if (i.x < 84) mk = i.s;
          else if (i.x < 315) ref.push(i.s);
          else if (i.x < 360) cuota = i.s;
          else if (i.x < 440) comp = i.s;
          else if (der < 512) pes = i.s;
          else dol = i.s;
        });
        var texto = ref.join(' '), banco = !mk && !comp && !cuota;
        var r = { FECHA: f.s, TITULAR: 'Detalle Banco', REFERENCIA: '', CUOTA: cuota, COMPROBANTE: comp, PESOS: aNum(pes), DOLARES: aNum(dol), TARJETA: '' };
        r.REFERENCIA = (/^[KF]$/.test(mk) ? mk + ' ' : '') + limpiarRef(texto, dol !== '');
        if (banco) bancos.push(r); else bloque.push(r);
      });
    });
    if (bloque.length) { porTarjeta.push({ tarjeta: '', nombre: 'Sin asignar', pdf: '', totPesos: null, totUsd: null, filas: bloque }); bloque.forEach(function (r) { r.TITULAR = 'Corporativa Sin Asignar'; }); }
    /* agrupa por titular (las dos tarjetas de una misma persona van juntas) en orden de aparición */
    var orden = [], mapa = {};
    porTarjeta.forEach(function (b) { if (!mapa[b.nombre]) { mapa[b.nombre] = []; orden.push(b.nombre); } mapa[b.nombre] = mapa[b.nombre].concat(b.filas); });
    orden.forEach(function (n) { filas = filas.concat(mapa[n]); });
    filas = filas.concat(bancos);
    var chk = porTarjeta.filter(function (b) { return b.totPesos != null; }).map(function (b) {
      var sp = b.filas.reduce(function (s, r) { return s + (r.PESOS || 0); }, 0), su = b.filas.reduce(function (s, r) { return s + (r.DOLARES || 0); }, 0);
      return { tarjeta: b.tarjeta, nombre: b.nombre, filas: b.filas.length, pesos: sp, usd: su, totPesos: b.totPesos, totUsd: b.totUsd, ok: Math.abs(sp - b.totPesos) < 0.05 && Math.abs(su - b.totUsd) < 0.05 };
    });
    return { filas: filas, chk: chk, bancos: bancos.length,
      pesos: filas.reduce(function (s, r) { return s + (r.PESOS || 0); }, 0), usd: filas.reduce(function (s, r) { return s + (r.DOLARES || 0); }, 0) };
  }
  /* browser: lee el PDF con pdf.js y devuelve items */
  function leerPdf(pdfjsLib, buf) {
    return pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise.then(function (doc) {
      var out = [], chain = Promise.resolve(), n;
      for (n = 1; n <= doc.numPages; n++) (function (n) {
        chain = chain.then(function () { return doc.getPage(n).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
          tc.items.forEach(function (i) { if (i.str && i.str.trim()) out.push({ p: n, s: i.str, x: i.transform[4], y: i.transform[5], w: i.width }); });
        }); });
      })(n);
      return chain.then(function () { return out; });
    });
  }

  /* ===== Paso 3: tarjeta (FECHA, IMPORTE, ETIQUETA) vs Odoo — mismo criterio que 3____Conciliacion.py ===== */
  function nroComp(t) {
    if (t == null) return null;
    t = String(t).toUpperCase().replace(/ /g, '');
    var m = t.match(/(\d{4,5}-\d{5,8})/);
    if (m) return m[1].split('-')[1].replace(/^0+/, '');
    var f = t.match(/FA-?[A-Z]?0*(\d{4,8})/);
    return f ? f[1].replace(/^0+/, '') : null;
  }
  function subProv(t) {
    if (t == null) return '';
    var p = String(t).split('_');
    if (p.length >= 2) return p[1].toUpperCase().replace('MERPAGO*', '').replace('PROPINA*', '').replace('K ', '').trim().replace(/[^A-Z0-9]/g, '');
    return String(t).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function leerTarjeta(filas) {
    var cols = filas[0].map(normCol), fi = cols.indexOf('FECHA'), ii = cols.indexOf('IMPORTE'), ei = cols.indexOf('ETIQUETA');
    if (fi < 0 || ii < 0 || ei < 0) throw new Error('El archivo de la tarjeta necesita las columnas FECHA, IMPORTE y ETIQUETA (es el CSV del paso 2)');
    return filas.slice(1).filter(function (r) { return r[fi] != null && txt(r[fi]) !== ''; }).map(function (r) { return { FECHA: txt(r[fi]), IMPORTE: typeof r[ii] === 'number' ? r[ii] : dinero(r[ii]), ETIQUETA: txt(r[ei]) }; });
  }
  function leerOdoo(filas) {
    var cols = filas[0].map(function (c) { return String(c == null ? '' : c).trim(); });
    var il = cols.indexOf('Etiqueta') >= 0 ? cols.indexOf('Etiqueta') : cols.indexOf('Número');
    var im = cols.indexOf('Importe') >= 0 ? cols.indexOf('Importe') : cols.indexOf('Total en moneda firmado');
    var ip = cols.indexOf('Nombre del contacto a mostrar en la factura');
    if (il < 0 || im < 0) throw new Error('El Excel de Odoo no tiene columnas reconocibles (Etiqueta/Número e Importe/Total en moneda firmado)');
    return filas.slice(1).filter(function (r) { return r[il] != null && r[il] !== '' && r[im] != null && r[im] !== ''; }).map(function (r) {
      return { lbl: String(r[il]), amt: typeof r[im] === 'number' ? r[im] : dinero(r[im]), prov: ip >= 0 && r[ip] != null ? String(r[ip]) : '' };
    });
  }
  function conciliar(tarj, odoo) {
    var rep = [], sinMatch = [];
    tarj.forEach(function (v) {
      var vl = v.ETIQUETA.toUpperCase(), va = Math.abs(v.IMPORTE), vn = nroComp(vl), vp = subProv(vl), hit = false, k, o, ol, oa, on, op, i, fr;
      for (k = 0; k < odoo.length && !hit; k++) {
        o = odoo[k]; ol = o.lbl.toUpperCase(); oa = Math.abs(o.amt); on = nroComp(ol); op = o.prov ? subProv(o.prov) : subProv(ol);
        var base = { 'FECHA TARJETA': v.FECHA, 'IMPORTE TARJETA': v.IMPORTE, 'ETIQUETA TARJETA': v.ETIQUETA, 'ASIENTO / COMPROBANTE': o.lbl, 'PROVEEDOR / DETALLE ODOO': o.prov || ol, 'MONTO REGISTRADO ODOO': o.amt };
        if (vn && on) {
          if (vn === on) {
            var d = Math.abs(va - oa);
            rep.push(Object.assign({ ESTADO: d <= 5 ? 'EXACTA (Por Nro Comprobante)' : 'POSIBLE (Diferencia de Monto)' }, base, { OBSERVACIONES: 'Match por número. Diferencia: $ ' + (v.IMPORTE - o.amt).toFixed(2) }));
            hit = true;
          }
        } else if (vp !== '' && op !== '' && (vp.indexOf(op) >= 0 || op.indexOf(vp) >= 0)) {
          if (Math.abs(va - oa) <= 5) { rep.push(Object.assign({ ESTADO: 'EXACTA (Por Proveedor y Monto)' }, base, { OBSERVACIONES: 'Importe coincidente.' })); hit = true; }
          else {
            var fr_ = [2, 3, 6, 9, 12, 18, 24];
            for (i = 0; i < fr_.length; i++) { fr = fr_[i]; if (Math.abs(va - oa / fr) <= 25) { rep.push(Object.assign({ ESTADO: 'POSIBLE (Plan de Cuotas)' }, base, { OBSERVACIONES: 'El cobro en tarjeta equivale a la cuota 1/' + fr + ' del registro original de Odoo.' })); hit = true; break; } }
          }
        }
      }
      if (!hit) sinMatch.push(v);
    });
    return { rep: rep, sin: sinMatch };
  }
  var API = { decodificar: decodificar, parseCsv: parseCsv, dinero: dinero, preparar: preparar, aCsv: aCsv, transcribir: transcribir, leerPdf: leerPdf, leerTarjeta: leerTarjeta, leerOdoo: leerOdoo, conciliar: conciliar, nroComp: nroComp, subProv: subProv };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.FinVisa = API;
})(typeof window !== 'undefined' ? window : this);
