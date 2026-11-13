/* FINISH · Conciliador de IVA (ARCA vs Odoo). Lógica pura: no toca la app ni sus datos.
   FinConc.leer(filas)  -> { cols, rows }   (filas = hoja como arreglo de arreglos)
   FinConc.conciliar(arca, odoo) -> { conc, faltaOdoo, faltaArca, tot }
   FinConc.armarHojas(res) -> { conciliacion: aoa, resumen: aoa } */
(function (root) {
  'use strict';
  var COLS = ['FACTURA', 'FECHA', 'NOMBRE', 'CUIT', 'GRAVADO', 'NO GRAVADO', 'IVA 10,5%', 'IVA 21%', 'IVA 27%', 'PERC IVA', 'PERC IIBB', 'GCIA. PERC', 'TOTAL'];
  var NUM = COLS.slice(4);
  function key(s) { return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function num(v) { if (typeof v === 'number') return isFinite(v) ? v : 0; var n = Number(String(v == null ? '' : v).trim()); return isFinite(n) && String(v).trim() !== '' ? n : 0; }
  function limpiarCuit(v) { return v == null ? '' : String(v).replace(/\D/g, ''); }
  function normTxt(t) { if (t == null) return ''; return String(t).toUpperCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9\s]/g, ''); }
  function pvNro(t) {
    if (t == null) return ['', ''];
    var s = String(t), m = s.match(/(\d+)\D+(\d+)/);
    if (m) return [String(parseInt(m[1], 10)), String(parseInt(m[2], 10))];
    m = s.match(/(\d+)/);
    return m ? ['', String(parseInt(m[1], 10))] : ['', ''];
  }
  /* alias por columna final (claves normalizadas); el primero que exista gana */
  var ALIAS = {
    FACTURA: ['FACTURA', 'FACTURAS'],
    FECHA: ['FECHA'],
    NOMBRE: ['NOMBRE', 'DENOMINACIONEMISOR', 'DENOMINACIONVENDEDOR'],
    CUIT: ['CUIT', 'NRODOCEMISOR', 'NRODOCVENDEDOR'],
    GRAVADO: ['GRAVADO', 'NETOGRAVADOTOTAL', 'NETOGRAVADO'],
    'NO GRAVADO': ['NOGRAVADO', 'NETONOGRAVADO'],
    'IVA 10,5%': ['IVA105'],
    'IVA 21%': ['IVA21', 'IVA', 'TOTALIVA'],
    'IVA 27%': ['IVA27'],
    'PERC IVA': ['PERCIVA'],
    'PERC IIBB': ['PERCIIBB'],
    'GCIA. PERC': ['GCIAPERC', 'OTROSTRIBUTOS'],
    TOTAL: ['TOTAL', 'IMPTOTAL']
  };
  var CLAVES_ENC = { FACTURA: 1, FACTURAS: 1, FECHA: 1, CUIT: 1 };

  function leer(filas) {
    var h = -1, i, j;
    for (i = 0; i < Math.min(10, filas.length); i++) {
      var n = 0, seen = {};
      (filas[i] || []).forEach(function (c) { var k = key(c); if (CLAVES_ENC[k] && !seen[k]) { seen[k] = 1; n++; } });
      if (n >= 3) { h = i; break; }
    }
    if (h < 0) h = 0;
    var enc = (filas[h] || []).map(key), idx = {};
    Object.keys(ALIAS).forEach(function (col) {
      for (var a = 0; a < ALIAS[col].length; a++) { var p = enc.indexOf(ALIAS[col][a]); if (p >= 0) { idx[col] = p; break; } }
    });
    /* ARCA original: sin columna de factura, se arma con Punto de Venta + Número Desde */
    var pv = enc.findIndex(function (k) { return k.indexOf('PUNTODEVENTA') === 0; });
    var nd = enc.findIndex(function (k) { return k.indexOf('NUMERODESDE') === 0; });
    if (idx.FACTURA == null && idx.FECHA == null && h === 0 && !enc.length) return { cols: idx, rows: [] };
    var rows = [];
    for (i = h + 1; i < filas.length; i++) {
      var f = filas[i] || [], r = {}, vacia = true;
      f.forEach(function (c) { if (c != null && String(c).trim() !== '') vacia = false; });
      if (vacia) continue;
      COLS.forEach(function (col) { r[col] = idx[col] != null ? f[idx[col]] : undefined; });
      if (idx.FACTURA == null) {
        if (pv >= 0 && nd >= 0 && isFinite(parseInt(f[pv], 10)) && isFinite(parseInt(f[nd], 10))) r.FACTURA = ('00000' + parseInt(f[pv], 10)).slice(-5) + '-' + ('00000000' + parseInt(f[nd], 10)).slice(-8);
        else r.FACTURA = '';
      }
      if (idx.FECHA == null) r.FECHA = f[0];
      rows.push(r);
    }
    return { cols: idx, rows: rows };
  }

  function preparar(rows, esOdoo) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], fac = r.FACTURA;
      if (esOdoo && String(fac == null ? '' : fac).trim().toLowerCase() === 'total') break;   // corta en la fila "Total"
      if (fac == null || String(fac).trim() === '') continue;
      var o = {};
      COLS.forEach(function (c) { o[c] = NUM.indexOf(c) >= 0 ? num(r[c]) : (r[c] == null ? '' : r[c]); });
      o.CUIT_CLEAN = limpiarCuit(r.CUIT);
      o.NOMBRE_NORM = normTxt(r.NOMBRE);
      var p = pvNro(fac);
      o.KEY = p[0] + '_' + p[1];
      out.push(o);
    }
    return out;
  }

  function conciliar(arcaLeido, odooLeido) {
    var arca = preparar(arcaLeido.rows, false), odoo = preparar(odooLeido.rows, true);
    var porKey = {};
    arca.forEach(function (a, i) { (porKey[a.KEY] = porKey[a.KEY] || []).push(i); });
    var mO = {}, mA = {};
    odoo.forEach(function (o, io) {
      var cand = porKey[o.KEY] || [];
      for (var k = 0; k < cand.length; k++) {
        var ia = cand[k], a = arca[ia];
        var cuit = o.CUIT_CLEAN && a.CUIT_CLEAN && o.CUIT_CLEAN === a.CUIT_CLEAN;
        var monto = Math.abs(o.TOTAL - a.TOTAL) < 2.0;
        var po = o.NOMBRE_NORM.split(/\s+/).filter(function (p) { return p.length > 2; });
        var pa = a.NOMBRE_NORM.split(/\s+/).filter(function (p) { return p.length > 2; });
        var nom = po.length ? po.some(function (p) { return pa.indexOf(p) >= 0; }) : false;
        if (cuit || monto || nom || !o.CUIT_CLEAN) { mO[io] = 1; mA[ia] = 1; break; }
      }
    });
    var conc = odoo.filter(function (_, i) { return mO[i]; });
    var faltaArca = odoo.filter(function (_, i) { return !mO[i]; });
    var faltaOdoo = arca.filter(function (_, i) { return !mA[i]; });
    var sum = function (l, c) { return l.reduce(function (s, x) { return s + x[c]; }, 0); };
    var iva = function (l) { return sum(l, 'IVA 10,5%') + sum(l, 'IVA 21%') + sum(l, 'IVA 27%'); };
    var tot = { conc: sum(conc, 'TOTAL'), faltaOdoo: sum(faltaOdoo, 'TOTAL'), faltaArca: sum(faltaArca, 'TOTAL'), ivaOdoo: iva(odoo), ivaArca: iva(arca), nArca: arca.length, nOdoo: odoo.length };
    tot.difIva = tot.ivaArca - tot.ivaOdoo;
    return { conc: conc, faltaOdoo: faltaOdoo, faltaArca: faltaArca, tot: tot };
  }

  function fechaTxt(v) {
    if (v instanceof Date && !isNaN(v)) { var p = function (n) { return ('0' + n).slice(-2); }; return p(v.getUTCDate()) + '/' + p(v.getUTCMonth() + 1) + '/' + v.getUTCFullYear(); }
    return v == null ? '' : v;
  }

  function armarHojas(res) {
    var a = [], t = res.tot;
    function sec(titulo, lista) {
      a.push([titulo]); a.push(COLS.slice());
      if (!lista.length) a.push(['Sin registros']);
      lista.forEach(function (r) { a.push(COLS.map(function (c) { return c === 'FECHA' ? fechaTxt(r[c]) : r[c]; })); });
      var fila = COLS.map(function () { return ''; }); fila[0] = 'TOTAL DE LA SECCION'; fila[COLS.length - 1] = lista.reduce(function (s, x) { return s + x.TOTAL; }, 0);
      a.push(fila); a.push([]);
    }
    sec('FACTURAS CONCILIADAS - PRESENTES EN ODOO Y ARCA', res.conc);
    sec('FALTAN EN ODOO - CARGAR EN EL SISTEMA', res.faltaOdoo);
    sec('FALTAN EN ARCA - REVISAR COMPROBANTES', res.faltaArca);
    var r = [
      ['CONCILIACION IVA - RESUMEN EJECUTIVO', ''], ['Estado', 'Cantidad'],
      ['Conciliadas (en ambos)', res.conc.length], ['Faltan en Odoo', res.faltaOdoo.length], ['Faltan en ARCA', res.faltaArca.length], ['', ''],
      ['Concepto', 'Importe'], ['Total conciliadas', t.conc], ['Total faltan en Odoo', t.faltaOdoo], ['Total faltan en ARCA', t.faltaArca], ['', ''],
      ['IVA total Odoo', t.ivaOdoo], ['IVA total ARCA', t.ivaArca], ['Diferencia IVA (ARCA - Odoo)', t.difIva]
    ];
    return { conciliacion: a, resumen: r };
  }

  var API = { COLS: COLS, leer: leer, conciliar: conciliar, armarHojas: armarHojas, fechaTxt: fechaTxt };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.FinConc = API;
})(typeof window !== 'undefined' ? window : this);
