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
  var API = { decodificar: decodificar, parseCsv: parseCsv, dinero: dinero, preparar: preparar, aCsv: aCsv };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.FinVisa = API;
})(typeof window !== 'undefined' ? window : this);
