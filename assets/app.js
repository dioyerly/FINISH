(function(){'use strict';
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var DOWL=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],DOWS=['dom','lun','mar','mié','jue','vie','sáb'],DOWI=['D','L','M','X','J','V','S'];
var MON=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
var CATS={trabajo:{n:'Trabajo',c:'#3b5bdb'},personal:{n:'Personal',c:'#0f7b6c'},pago:{n:'Pago',c:'#2aa7c9'},ideas:{n:'Otro',c:'#8b3f8f'},venc:{n:'Vencimiento',c:'#e0459f'},tarea:{n:'Tarea',c:'#0b7285'},record:{n:'Recordatorio',c:'#6741d9'}};
var NCOL=['#f6d86b','#f4a99a','#a9d6c4','#b9c6f5','#e2c3ea','#ffffff'];
var PCOL=['#3b5bdb','#0f7b6c','#2aa7c9','#8b3f8f','#8a5cff'];
function pad(n){return n<10?'0'+n:''+n}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function pd(s){var p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2])}
function addD(d,n){var x=new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);return x}
function dim(y,m){return new Date(y,m+1,0).getDate()}
function today(){return iso(new Date())}
function uid(){return Math.random().toString(36).slice(2,9)}
function money(n){return '$ '+Math.round(n).toLocaleString('es-AR')}
function fmtD(s,o){return pd(s).toLocaleDateString('es-AR',o||{weekday:'long',day:'numeric',month:'long'})}
/* ===== estado ===== */
var KEY='finish_v2',S=null;
function seed(){return {demo:false,cfg:{name:'',lead:60,digest:true,digestH:'07:30',payDays:[2,4]},ppl:[{id:'me',name:'Yo',email:'',me:true}],rem:[],done:{},day:{},soc:[],bancos:[],prov:[],pagos:[],plans:[],notes:[]}}
function fixS(){if(!S||!S.rem)S=seed();S.day=S.day||{};S.done=S.done||{};['soc','bancos','prov','pagos','plans','notes','ppl'].forEach(function(k){S[k]=S[k]||[]});S.cfg=S.cfg||seed().cfg;var chg=false;S.rem.forEach(function(r){if(r.type==='monthly'&&r.date&&r.dom&&pd(r.date).getDate()!==+r.dom){if(r.src)r.date=nextDom(r.dom,r.date);else r.dom=pd(r.date).getDate();chg=true}});return chg}
function load(){try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){S=null}if(fixS())save()}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}syncSoon()}
/* ===== sincronización con la base de datos (api.php) ===== */
var SYNC={on:false,ver:0,t:null,busy:false,dirty:false,csrf:'',state:'local'};
function syncApi(a,body){return fetch('api.php?a='+a,body?{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF':SYNC.csrf},body:JSON.stringify(body)}:{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json().catch(function(){return {}}).then(function(j){j.status=r.status;return j})})}
function syncSoon(){if(!SYNC.on)return;SYNC.dirty=true;clearTimeout(SYNC.t);SYNC.t=setTimeout(syncPush,700)}
function syncPush(){if(!SYNC.on||SYNC.busy||!SYNC.dirty)return;SYNC.busy=true;SYNC.dirty=false;
 syncApi('save',{version:SYNC.ver,data:S}).then(function(j){SYNC.busy=false;
  if(j.status===200){SYNC.ver=j.version;SYNC.state='ok';if(SYNC.dirty)syncPush();else{syncMark();syncOutbox()}}
  else if(j.status===409){SYNC.dirty=false;syncPull(true)}
  else if(j.status===401){SYNC.on=false;SYNC.state='auth';toast('Tu sesión venció: entrá de nuevo para seguir guardando en la base')}
  else{SYNC.state='err';SYNC.dirty=true;clearTimeout(SYNC.t);SYNC.t=setTimeout(syncPush,15000);syncMark()}
 }).catch(function(){SYNC.busy=false;SYNC.state='err';SYNC.dirty=true;clearTimeout(SYNC.t);SYNC.t=setTimeout(syncPush,15000);syncMark()})}
function syncOutbox(){try{syncApi('outbox',{items:outboxPayload()})}catch(e){}}
function syncMark(){var e=document.getElementById('syncst');if(e)e.innerHTML=syncText()}
function syncText(){return SYNC.state==='ok'?'<b style="color:#0f7b6c">● Guardado en la base de datos</b> (versión '+SYNC.ver+')':SYNC.state==='err'?'<b style="color:#b83a1f">● Sin conexión con la base:</b> guardado en este navegador, reintento solo':SYNC.state==='auth'?'Sesión vencida':SYNC.state==='baddb'?'<b style="color:#b83a1f">No se pudo conectar a la base.</b> Error de MySQL: '+esc(SYNC.det||'sin detalle'):SYNC.state==='nodb'?'Sin base de datos configurada: se guarda solo en este navegador':'Se guarda solo en este navegador'}
function syncPull(conflict){return syncApi('load').then(function(j){if(j.status===200&&j.data&&j.data.rem){var busy=document.getElementById('ov')&&document.getElementById('ov').classList.contains('on');if(!conflict&&(SYNC.dirty||SYNC.busy||busy))return;if(!conflict&&j.version===SYNC.ver)return;S=j.data;fixS();SYNC.ver=j.version;SYNC.state='ok';try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}render();if(conflict)toast('Se actualizó con los cambios hechos desde otro dispositivo')}})}
function syncInit(){var m=document.querySelector('meta[name="finish-csrf"]');if(!m)return;SYNC.csrf=m.content;SYNC.on=true;
 syncApi('load').then(function(j){
  if(j.status===200){SYNC.ver=j.version||0;SYNC.state='ok';
   var has=function(d){return !!d&&['rem','prov','pagos','plans','notes','soc','bancos'].some(function(k){return d[k]&&d[k].length})};
   if(has(j.data)||(j.data&&!has(S))){S=j.data;fixS();try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}render();syncOutbox()}
   else if(has(S)){SYNC.dirty=true;syncPush()}}
  else if(j.status===503){SYNC.on=false;SYNC.state=j.error==='db'?'baddb':'nodb';SYNC.det=j.detalle||'';render()}
  else{SYNC.state='err';syncMark()}
 }).catch(function(){SYNC.state='err';syncMark()});
 document.addEventListener('visibilitychange',function(){if(!document.hidden&&SYNC.on)syncPull(false)})}
/* ===== días hábiles y feriados (Argentina) ===== */
var HOL={'2026-11-23':'Día de la Soberanía Nacional','2026-12-07':'Puente turístico','2026-12-08':'Inmaculada Concepción','2026-12-25':'Navidad',
 '2027-01-01':'Año Nuevo','2027-02-08':'Carnaval','2027-02-09':'Carnaval','2027-03-24':'Día de la Memoria','2027-03-25':'Jueves Santo','2027-03-26':'Viernes Santo','2027-04-02':'Día del Veterano de Malvinas','2027-05-01':'Día del Trabajador','2027-05-25':'Revolución de Mayo','2027-06-21':'Paso a la Inmortalidad de Güemes (trasladado)','2027-06-20':'Día de la Bandera','2027-07-09':'Día de la Independencia','2027-08-16':'Paso a la Inmortalidad de San Martín (trasladado)','2027-10-11':'Diversidad Cultural (trasladado)','2027-11-22':'Día de la Soberanía Nacional (trasladado)','2027-12-08':'Inmaculada Concepción','2027-12-25':'Navidad'};
function holName(ds){if(HOL[ds])return HOL[ds];var f=(S.cfg.fer||[]).filter(function(x){return x.d===ds})[0];return f?(f.n||'Feriado'):''}
function isBiz(ds){var w=pd(ds).getDay();return w!==0&&w!==6&&!holName(ds)}
function shiftable(r){return r.cat==='venc'&&['daily','weekly','biweekly'].indexOf(r.type)<0}
function mvNote(ds){var w=pd(ds).getDay(),h=holName(ds);return (w===0||w===6)?DOWL[w].toLowerCase():(h||'feriado')}
function mvTag(o){return o.mv?'<span class="mv">↪ pasó del '+esc(fmtD(o.mv,{weekday:'short',day:'numeric',month:'short'}))+' ('+esc(mvNote(o.mv))+')</span>':''}
/* ===== recurrencia ===== */
function nextDom(dom,from){var d=pd(from||today()),g=0;while(g++<70){var L=dim(d.getFullYear(),d.getMonth());if(d.getDate()===Math.min(+dom||1,L))return iso(d);d=addD(d,1)}return from||today()}
function matches(r,ds){var d=pd(ds);if(r.type==='once')return r.date===ds;if(ds<r.date)return false;if(r.until&&ds>r.until)return false;
 var dow=d.getDay(),L=dim(d.getFullYear(),d.getMonth()),dm=d.getDate();
 if(r.type==='daily')return true;
 if(r.type==='weekly')return (r.days||[]).indexOf(dow)>=0;
 if(r.type==='monthly')return dm===Math.min(pd(r.date).getDate(),L);
 if(r.type==='bimonthly')return dm===Math.min(+r.dom||1,L)||dm===Math.min(+r.dom2||15,L);
 if(r.type==='yearly'){var y0=pd(r.date);return d.getMonth()===y0.getMonth()&&dm===Math.min(y0.getDate(),L)}
 if(r.type==='biweekly')return Math.round((d-pd(r.date))/864e5)%14===0;
 if(r.type==='nthdow'){if(dow!==+r.dow)return false;return (+r.nth===5)?dm+7>L:Math.ceil(dm/7)===+r.nth}
 return false}
function occ(ds){var out=[];S.rem.forEach(function(r){if(shiftable(r)){if(!isBiz(ds))return;var mv=null;if(!matches(r,ds)){var d=iso(addD(pd(ds),-1)),g=0;while(!isBiz(d)&&g++<12){if(matches(r,d)){mv=d;break}d=iso(addD(pd(d),-1))}if(!mv)return}out.push({r:r,date:ds,mv:mv,key:r.id+'|'+ds,done:!!S.done[r.id+'|'+ds]});return}if(matches(r,ds))out.push({r:r,date:ds,key:r.id+'|'+ds,done:!!S.done[r.id+'|'+ds]})});(S.pagos||[]).forEach(function(p){if(p.fprog===ds){out.push({r:{id:'pg|'+p.id,t:'Pagar · '+pagoNombre(p),note:'',cat:'pago',type:'once',date:ds,time:'10:00',days:[],mail:false,to:[],amt:p.monto,pay:true},date:ds,key:'pg|'+p.id,done:p.estado==='pagado'})}});
 out.sort(function(a,b){return a.r.time<b.r.time?-1:a.r.time>b.r.time?1:0});return out}
function repLabel(r){if(r.type==='once')return 'Una vez';if(r.type==='daily')return 'Todos los días';
 if(r.type==='weekly'){var d=(r.days||[]).slice().sort(function(a,b){return ((a+6)%7)-((b+6)%7)});if(d.length===7)return 'Todos los días';return 'Cada '+d.map(function(x){return DOWL[x].slice(0,3).toLowerCase()}).join(' y ').replace(/ y ([^y]+) y /g,', $1 y ')}
 if(r.type==='monthly')return 'Día '+pd(r.date).getDate()+' de cada mes';if(r.type==='bimonthly')return 'Quincenal · días '+r.dom+' y '+r.dom2;if(r.type==='biweekly')return 'Cada 14 días';if(r.type==='yearly'){var yd=pd(r.date);return 'Cada año el '+yd.getDate()+' de '+MON[yd.getMonth()].toLowerCase()}if(r.type==='nthdow')return ['','Primer','Segundo','Tercer','Cuarto','Último'][+r.nth||1]+' '+DOWL[+r.dow||0].toLowerCase()+' del mes';return ''}
function cc(r){return CATS[r.cat]?CATS[r.cat].c:'#8b3f8f'}
/* ===== iconos ===== */
var IC={hoy:'<path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',mes:'<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',plan:'<path d="M5 21V4M5 4h12l-3 4.5 3 4.5H5"/>',nota:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',pago:'<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M3 10h18M7 15h3"/>',ajuste:'<path d=\"M4 7h9M19 7h1M4 17h1M11 17h9\"/><circle cx=\"16\" cy=\"7\" r=\"2.5\"/><circle cx=\"8\" cy=\"17\" r=\"2.5\"/>',plus:'<path d="M12 5v14M5 12h14"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 8 8 6 8-6"/>',rep:'<path d="M17 2l3 3-3 3M3 11V9a4 4 0 0 1 4-4h13M7 22l-3-3 3-3M21 13v2a4 4 0 0 1-4 4H4"/>',up:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'};
function ico(n,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(w||2)+'" stroke-linecap="round" stroke-linejoin="round">'+IC[n]+'</svg>'}
var CHK='<svg viewBox="0 0 24 24" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';
/* ===== navegación ===== */
var HA=true,VIEW='hoy',CAL=new Date(),Q='';
var NAV=[['hoy','Hoy','hoy'],['mes','Mes','mes'],['plan','Planes','plan'],['nota','Notas','nota'],['pago','Pagos','pago'],['ajuste','Ajustes','ajuste']];
function dock(){$('#dock').innerHTML=NAV.slice(0,3).map(nb).join('')+'<button class="plus" data-act="new" aria-label="Nuevo recordatorio">'+ico('plus',2.6)+'</button>'+NAV.slice(3).map(nb).join('')}
function nb(n){return '<button data-v="'+n[0]+'" class="'+(VIEW===n[0]||(VIEW==='conc'&&n[0]==='pago')?'on':'')+'" aria-label="'+n[1]+'">'+ico(n[2])+'<span>'+n[1]+'</span></button>'}
function go(v){VIEW=v;HA=true;if(typeof INL!=='undefined')INL=null;dock();render();window.scrollTo(0,0)}
function render(){if(INL)INL.pull();var f={hoy:vHoy,mes:vMes,plan:vPlan,nota:vNota,pago:vPago,ajuste:vSet,conc:vConc}[VIEW];$('#app').innerHTML='<div class="top"><span class="logo"><i></i>Finish</span></div>'+(S.demo&&VIEW!=='ajuste'?'<div class="demo"><span><b>Datos de ejemplo.</b> Todo lo que cargues se guarda en este navegador. Para empezar limpio: Ajustes → Borrar ejemplos.</span></div>':'')+f();after()}
/* ===== HOY ===== */
function greet(){var h=new Date().getHours();return h<6?'Buenas noches':h<13?'Buen día':h<20?'Buenas tardes':'Buenas noches'}
function dial(items){var W=420,cx=210,cy=214,r=168,now=new Date(),nt=now.getHours()+now.getMinutes()/60;
 function pt(t,rr){t=Math.max(6,Math.min(24,t));var a=Math.PI*(1-(t-6)/18);return [cx+(rr||r)*Math.cos(a),cy-(rr||r)*Math.sin(a)]}
 var s='<svg viewBox="0 0 '+W+' 250" role="img" aria-label="Arco del día">';
 s+='<path d="M'+(cx-r)+' '+cy+'A'+r+' '+r+' 0 0 1 '+(cx+r)+' '+cy+'" fill="none" stroke="#dde2ef" stroke-width="16" stroke-linecap="round"/>';
 var np=pt(nt);if(nt>6)s+='<path class="arc" pathLength="100" d="M'+(cx-r)+' '+cy+'A'+r+' '+r+' 0 0 1 '+np[0].toFixed(1)+' '+np[1].toFixed(1)+'" fill="none" stroke="#0e1120" stroke-width="16" stroke-linecap="round"/>';
 [6,9,12,15,18,21,24].forEach(function(h){var p=pt(h,r-34);s+='<text x="'+p[0].toFixed(1)+'" y="'+(p[1]+4).toFixed(1)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#9aa1b6" font-family="SG,sans-serif">'+(h===24?'24':h)+'</text>'});
 var last=-9,lv=0;items.forEach(function(o){var t=+o.r.time.slice(0,2)+(+o.r.time.slice(3,5))/60;lv=(t-last<.7)?lv+1:0;last=t;var p=pt(t,r+lv*24);
  s+='<g><circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="9" fill="'+(o.done?'#ffffff':cc(o.r))+'" stroke="'+(o.done?'#9aa1b6':'#ffffff')+'" stroke-width="3"/>'+(o.done?'<path d="m'+(p[0]-3.5).toFixed(1)+' '+(p[1]).toFixed(1)+' 2.5 2.5 4.5-5" stroke="#0f7b6c" stroke-width="2" fill="none" stroke-linecap="round"/>':'')+'</g>'});
 if(nt>=6&&nt<=24)s+='<circle class="pulse" cx="'+np[0].toFixed(1)+'" cy="'+np[1].toFixed(1)+'" r="7" fill="#8a5cff"/><circle cx="'+np[0].toFixed(1)+'" cy="'+np[1].toFixed(1)+'" r="8" fill="#8a5cff" stroke="#ffffff" stroke-width="3"/>';
 return s+'</svg>'}
function itemHTML(o,showDate){var r=o.r,c=cc(r);return '<div class="it'+(o.done?' done':'')+'" style="--c:'+c+'"><div class="tm">'+(showDate?esc(DOWS[pd(o.date).getDay()]+' '+pd(o.date).getDate())+'<br>':'')+esc(r.time)+'</div><div class="ln"><b></b></div>'
 +'<div class="bd"><button class="ck" data-act="tog" data-k="'+esc(o.key)+'" aria-label="Marcar hecho">'+CHK+'</button><button class="tx" style="text-align:left" data-act="edit" data-id="'+r.id+'"><div class="tt">'+esc(r.t)+'</div><div class="meta"><span>'+esc(CATS[r.cat]?CATS[r.cat].n:'')+'</span>'+(r.type!=='once'?'<span>↻ '+esc(repLabel(r))+'</span>':'')+(r.mail?'<span>✉ '+r.to.length+'</span>':'')+(r.amt?'<span class="amt">'+money(r.amt)+'</span>':'')+mvTag(o)+'</div></button></div></div>'}
function overdue(){var T=today(),nowT=pad(new Date().getHours())+':'+pad(new Date().getMinutes()),out=[];for(var i=7;i>=0;i--){var ds=iso(addD(new Date(),-i));occ(ds).forEach(function(o){if(!o.done&&(ds<T))out.push(o)})}
 return out.filter(function(o){return o.r.type==='once'||o.r.cat==='pago'}).sort(function(a,b){return a.date<b.date?1:-1})}
function vHoy(){var T=today(),list=occ(T),n=new Date(),d=list.filter(function(o){return o.done}).length,od=overdue();
 var rib='';for(var i=0;i<14;i++){var dt=addD(n,i),ds=iso(dt),oc=occ(ds),pay=oc.some(function(o){return o.r.cat==='pago'});rib+='<button class="day'+(i===0?' today':'')+(pay?' pay':'')+'" data-act="day" data-d="'+ds+'"><small>'+DOWS[dt.getDay()]+'</small><b>'+dt.getDate()+'</b><i>'+oc.slice(0,3).map(function(o){return '<u style="background:'+cc(o.r)+'"></u>'}).join('')+'</i></button>'}
 var nxt='',cnt=0;for(var k=1;k<=7&&cnt<8;k++){var ds2=iso(addD(n,k));occ(ds2).forEach(function(o){if(cnt>=8||o.r.type==='daily')return;cnt++;nxt+='<button class="rw" style="--c:'+cc(o.r)+'" data-act="edit" data-id="'+o.r.id+'"><span class="dd">'+DOWS[pd(ds2).getDay()]+'<b>'+pd(ds2).getDate()+'</b></span><i></i><span class="tx" style="flex:1;min-width:0"><div class="tt">'+esc(o.r.t)+'</div><div class="meta"><span>'+esc(o.r.time)+'</span>'+(o.r.amt?'<span class="amt">'+money(o.r.amt)+'</span>':'')+'</div></span></button>'})}
 var mails=outbox(1).length;
 var en=HA;HA=false;return '<div class="hoy'+(en?' enter':'')+'"><div class="head"><div class="bigd"><b>'+n.getDate()+'</b><div><small>'+DOWL[n.getDay()]+'</small><span>'+MON[n.getMonth()]+'<br>'+n.getFullYear()+'</span></div></div><div class="hi"><p>'+greet()+(S.cfg.name?', <b>'+esc(S.cfg.name)+'</b>':'')+'.<br>'+(list.length?(d===list.length?'Día completo. Bien hecho.':'Te quedan '+(list.length-d)+' por hacer hoy.'):'Hoy no tenés nada agendado.')+'</p></div></div>'
 +'<div class="qa"><label><span class="sl">+</span><input id="qa" placeholder="Escribí natural: pagar luz martes y jueves 10:00 @ana" autocomplete="off"><kbd>Enter</kbd></label><div class="chips" id="qchips"></div></div>'
 +'<div class="ribbon">'+rib+'</div>'
 +'<div class="grid2"><div><div class="card"><div class="dial">'+dial(list)+'<div class="mid"><b>'+d+'<i>/'+list.length+'</i></b><small>hechos hoy</small></div></div>'
 +'<div class="sum"><div><b>'+od.length+'</b><span>atrasados</span></div><div><b>'+mails+'</b><span>mails hoy</span></div><div><b>'+list.filter(function(o){return o.r.cat==='pago'}).length+'</b><span>pagos hoy</span></div></div></div>'
 +'<div class="card next" style="margin-top:18px"><h3>Próximos 7 días</h3>'+(nxt||'<div class="empty">Semana tranquila.</div>')+'</div></div>'
 +'<div>'+(od.length?'<div class="late"><h3>Atrasados · '+od.length+'</h3><div class="thread">'+od.map(function(o){return itemHTML(o,true)}).join('')+'</div></div>':'')
 +'<div class="card"><h3>Hoy · hilo del día</h3>'+(list.length?'<div class="thread">'+list.map(function(o){return itemHTML(o)}).join('')+'</div>':'<div class="empty">Nada para hoy. Escribí arriba para agregar algo.</div>')+'</div></div></div></div>'}

/* ===== CONCILIACIÓN IVA (ARCA vs Odoo) · usa assets/conc.js; no toca ningún otro dato ===== */
var CN={a:null,o:null,an:'',on:'',res:null,tab:'conc'};
function cnLoad(w,file){if(!file)return;if(!/\.xlsx?$/i.test(file.name)){toast('Subí un Excel (.xlsx)');return}
 loadXlsx().then(function(X){return file.arrayBuffer().then(function(buf){var wb=X.read(buf,{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]],L=FinConc.leer(X.utils.sheet_to_json(ws,{header:1,raw:true,defval:null}));
  if(!L.rows.length||L.cols.FACTURA==null&&L.cols.FECHA==null){toast('No reconozco las columnas de ese Excel');return}
  CN[w]=L;CN[w+'n']=file.name;CN.res=null;if(CN.a&&CN.o){try{CN.res=FinConc.conciliar(CN.a,CN.o);CN.tab='conc'}catch(e){toast('No pude conciliar: '+e.message)}}render()})}).catch(function(){toast('No pude leer ese archivo')})}
function cnRows(l){var n=l.length>300?300:l.length;return '<div class="ctw"><table class="ctab"><thead><tr><th>Factura</th><th>Fecha</th><th>Nombre</th><th>CUIT</th><th class="r">Gravado</th><th class="r">IVA</th><th class="r">Total</th></tr></thead><tbody>'
 +(l.slice(0,300).map(function(x){return '<tr><td>'+esc(x.FACTURA)+'</td><td>'+esc(FinConc.fechaTxt(x.FECHA))+'</td><td>'+esc(x.NOMBRE)+'</td><td>'+esc(x.CUIT_CLEAN)+'</td><td class="r">'+esc(money(x.GRAVADO))+'</td><td class="r">'+esc(money(x['IVA 10,5%']+x['IVA 21%']+x['IVA 27%']))+'</td><td class="r">'+esc(money(x.TOTAL))+'</td></tr>'}).join('')||'<tr><td colspan="7" class="empty">Sin registros</td></tr>')+'</tbody></table></div>'+(l.length>n?'<p class="hint">Se muestran las primeras 300. El Excel trae todas ('+l.length+').</p>':'')}
function vConc(){var R=CN.res,h='<div class="head"><div><h2 style="font-size:clamp(34px,6vw,56px)">Conciliación IVA</h2><p class="empty" style="padding:6px 0">Cruzá lo que dice ARCA con lo cargado en Odoo.</p></div><button class="btn lite" data-fa="cnback">← Pagos</button></div>';
 var up=function(w,t,sub){var L=CN[w];return '<div class="card cnup'+(L?' ok':'')+'"><h3>'+t+'</h3><p class="hint">'+sub+'</p>'+(L?'<p class="cnf"><b>'+esc(CN[w+'n'])+'</b><span>'+L.rows.length+' filas</span></p>':'')+'<button class="btn '+(L?'lite':'c')+'" data-fa="cnpick" data-w="'+w+'">'+(L?'Cambiar archivo':'Elegir Excel')+'</button><input type="file" id="cn'+w+'" accept=".xlsx,.xls" hidden></div>'};
 h+='<div class="cnups">'+up('a','1 · ARCA','El Excel de comprobantes recibidos.')+up('o','2 · Odoo','El Excel de facturas de proveedor.')+'</div>';
 if(!R)return h+(CN.a||CN.o?'<p class="empty">Falta subir el otro archivo para conciliar.</p>':'<p class="empty">Subí los dos archivos tal como los descargás, sin modificarlos.</p>');
 var T=R.tot,k=function(c,t,n,m){return '<div class="cnk '+c+'"><span>'+t+'</span><b>'+n+'</b><small>'+esc(money(m))+'</small></div>'};
 h+='<div class="cnks">'+k('ok','Conciliadas',R.conc.length,T.conc)+k('wo','Faltan en Odoo',R.faltaOdoo.length,T.faltaOdoo)+k('wa','Faltan en ARCA',R.faltaArca.length,T.faltaArca)+'</div>'
 +'<div class="cniva"><div><span>IVA en Odoo</span><b>'+esc(money(T.ivaOdoo))+'</b></div><div><span>IVA en ARCA</span><b>'+esc(money(T.ivaArca))+'</b></div><div class="'+(Math.abs(T.difIva)<1?'':'bad')+'"><span>Diferencia (ARCA − Odoo)</span><b>'+esc(money(T.difIva))+'</b></div></div>'
 +'<div class="seg stabs">'+[['conc','Conciliadas',R.conc.length],['fo','Faltan en Odoo',R.faltaOdoo.length],['fa','Faltan en ARCA',R.faltaArca.length]].map(function(t){return '<button data-fa="cntab" data-t="'+t[0]+'" class="'+(CN.tab===t[0]?'on':'')+'">'+t[1]+' · '+t[2]+'</button>'}).join('')+'</div>'
 +'<div class="card">'+cnRows(CN.tab==='fo'?R.faltaOdoo:CN.tab==='fa'?R.faltaArca:R.conc)+'</div>'
 +'<div class="acts" style="justify-content:flex-start;margin-top:14px"><button class="btn c" data-fa="cnxls">Descargar Excel</button><button class="btn lite" data-fa="cnreset">Empezar de nuevo</button></div>';
 return h}
var EJP=null;
function loadExcelJs(){if(window.ExcelJS)return Promise.resolve(window.ExcelJS);if(EJP)return EJP;EJP=new Promise(function(res,rej){var sc=document.createElement('script'),el=$('#ejl');sc.src=el?URL.createObjectURL(new Blob([b2u(el.textContent)],{type:'text/javascript'})):'assets/vendor/exceljs.min.js';sc.onload=function(){res(window.ExcelJS)};sc.onerror=function(){EJP=null;rej()};document.head.appendChild(sc)});return EJP}
function cnExport(){if(!CN.res)return;loadExcelJs().then(function(E){var R=CN.res,T=R.tot,C=FinConc.COLS,N=C.length,wb=new E.Workbook(),ws=wb.addWorksheet('Conciliacion',{views:[{state:'frozen',ySplit:0}]}),MON='$#,##0.00;[Red]-$#,##0.00',
 INK='FF0E1120',BONE='FFE8ECF5',LINE='FFD9DEEB',bd={bottom:{style:'thin',color:{argb:LINE}}},WH={color:{argb:'FFFFFFFF'},bold:true},
 fill=function(c){return {type:'pattern',pattern:'solid',fgColor:{argb:c}}},
 TOR={type:'gradient',gradient:'angle',degree:0,stops:[{position:0,color:{argb:'FF4F7CFF'}},{position:.28,color:{argb:'FF8A5CFF'}},{position:.56,color:{argb:'FFD24FE0'}},{position:.74,color:{argb:'FFFF62B4'}},{position:1,color:{argb:'FF2FC4D9'}}]};
 C.forEach(function(c,i){ws.getColumn(i+1).width=c==='NOMBRE'||c==='FACTURA'?30:c==='FECHA'?12:c==='CUIT'?15:16});
 function sec(titulo,lista,color){var r=ws.addRow([titulo]);ws.mergeCells(r.number,1,r.number,N);var t=r.getCell(1);t.fill=fill(color);t.font=Object.assign({size:13},WH);t.alignment={vertical:'middle'};r.height=26;
  var h=ws.addRow(C);h.height=30;h.eachCell(function(c){c.fill=fill(INK);c.font=WH;c.alignment={horizontal:'center',vertical:'middle',wrapText:true};c.border=bd});
  if(!lista.length){var e=ws.addRow(['Sin registros']);ws.mergeCells(e.number,1,e.number,N);e.getCell(1).font={italic:true,color:{argb:'FF6A7186'}}}
  lista.forEach(function(x,k){var row=ws.addRow(C.map(function(c){return c==='FECHA'?FinConc.fechaTxt(x[c]):c==='CUIT'?x.CUIT_CLEAN:x[c]}));row.eachCell({includeEmpty:true},function(c,n){c.border=bd;c.alignment={vertical:'middle'};if(n>=5)c.numFmt=MON;if(k%2)c.fill=fill('FFF6F8FC')})});
  var tr=ws.addRow(C.map(function(c,i){return i===0?'TOTAL DE LA SECCION':i===N-1?lista.reduce(function(a,y){return a+y.TOTAL},0):''}));tr.eachCell({includeEmpty:true},function(c,n){c.fill=fill(BONE);c.font={bold:true};c.border=bd;if(n===N)c.numFmt=MON});ws.addRow([])}
 sec('FACTURAS CONCILIADAS - PRESENTES EN ODOO Y ARCA',R.conc,'FF2FB58A');sec('FALTAN EN ODOO - CARGAR EN EL SISTEMA',R.faltaOdoo,'FFE0459F');sec('FALTAN EN ARCA - REVISAR COMPROBANTES',R.faltaArca,'FFD23A1D');
 var rs=wb.addWorksheet('Resumen');rs.getColumn(1).width=38;rs.getColumn(2).width=22;
 var t=rs.addRow(['CONCILIACION IVA - RESUMEN EJECUTIVO']);rs.mergeCells(1,1,1,2);t.height=32;t.getCell(1).fill=TOR;t.getCell(1).font={color:{argb:'FFFFFFFF'},bold:true,size:15};t.getCell(1).alignment={horizontal:'center',vertical:'middle'};
 function hdr(a,b){var r=rs.addRow([a,b]);r.eachCell(function(c){c.fill=fill(INK);c.font=WH});return r}
 function lin(a,b,col,money){var r=rs.addRow([a,b]);r.eachCell(function(c){c.border=bd});if(col){r.getCell(1).fill=fill(col);r.getCell(1).font=WH}if(money)r.getCell(2).numFmt=MON;r.getCell(2).alignment={horizontal:'right'};return r}
 hdr('Estado','Cantidad');lin('Conciliadas (en ambos)',R.conc.length,'FF2FB58A');lin('Faltan en Odoo',R.faltaOdoo.length,'FFE0459F');lin('Faltan en ARCA',R.faltaArca.length,'FFD23A1D');rs.addRow([]);
 hdr('Concepto','Importe');lin('Total conciliadas',T.conc,null,1);lin('Total faltan en Odoo',T.faltaOdoo,null,1);lin('Total faltan en ARCA',T.faltaArca,null,1);rs.addRow([]);
 lin('IVA total Odoo',T.ivaOdoo,null,1);lin('IVA total ARCA',T.ivaArca,null,1);var d=lin('Diferencia IVA (ARCA - Odoo)',T.difIva,null,1);d.eachCell(function(c){c.fill=fill(BONE);c.font={bold:true}});
 return wb.xlsx.writeBuffer()}).then(function(buf){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download='Resultado_Conciliacion_IVA.xlsx';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1500);toast('Excel descargado')}).catch(function(){toast('No pude generar el Excel')})}
/* ===== MES ===== */
function vMes(){var y=CAL.getFullYear(),m=CAL.getMonth(),first=new Date(y,m,1),off=(first.getDay()+6)%7,L=dim(y,m),T=today();
 var h='<div class="mhead"><h2>'+MON[m]+' <i>'+y+'</i></h2><div class="nav"><button class="btn lite sq" data-act="mprev" aria-label="Mes anterior">‹</button><button class="btn lite s" data-act="mtoday">Hoy</button><button class="btn lite sq" data-act="mnext" aria-label="Mes siguiente">›</button></div></div><div class="cal">';
 ['lun','mar','mié','jue','vie','sáb','dom'].forEach(function(x){h+='<div class="dw">'+x+'</div>'});
 var total=Math.ceil((off+L)/7)*7;
 for(var i=0;i<total;i++){var dt=new Date(y,m,1-off+i),ds=iso(dt),out=dt.getMonth()!==m,oc=out?[]:occ(ds),ev='',dots='';
  oc.slice(0,3).forEach(function(o){ev+='<span class="ev'+(o.done?' dn':'')+'" data-act="edit" data-id="'+esc(o.r.id)+'" title="Tocar para editar" style="--c:'+cc(o.r)+'">'+esc(o.r.time)+' '+esc(o.r.t)+'</span>'});
  oc.forEach(function(o){dots+='<u style="--c:'+cc(o.r)+'"></u>'});
  var payd=oc.some(function(o){return o.r.cat==='pago'});
  h+='<button class="cell'+(out?' out':'')+(ds===T?' today':'')+(S.day[ds]?' hasnote':'')+'" '+(out?'':'data-act="day" data-d="'+ds+'"')+'><div class="n"><span>'+dt.getDate()+'</span>'+(payd?'<em>PAGO</em>':'')+'</div>'+ev+(oc.length>3?'<span class="more">+'+(oc.length-3)+' más</span>':'')+'<div class="dots">'+dots.slice(0,400)+'</div></button>'}
 return h+'</div>'}
/* ===== PLANES ===== */
function vPlan(){var h='<div class="head"><div><h2 style="font-size:clamp(34px,6vw,56px)">Planes de trabajo</h2><p class="empty" style="padding:6px 0">Lo grande, partido en pasos chicos.</p></div><button class="btn" data-act="newplan">'+ico('plus',2.4).replace('<svg','<svg width="18" height="18"')+' Nuevo plan</button></div><div class="plans">';
 S.plans.forEach(function(p){var dn=p.steps.filter(function(s){return s.done}).length,pc=p.steps.length?Math.round(dn/p.steps.length*100):0,C=2*Math.PI*26;
  h+='<div class="plan" style="--c:'+p.c+'"><div class="top"><div><h2>'+esc(p.t)+'</h2>'+(p.due?'<div class="due">Meta: '+esc(fmtD(p.due,{day:'numeric',month:'short'}))+' · '+daysTo(p.due)+'</div>':'')+'</div><div class="ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="#dde2ef" stroke-width="7"/><circle cx="32" cy="32" r="26" fill="none" stroke="'+p.c+'" stroke-width="7" stroke-linecap="round" stroke-dasharray="'+(C*pc/100).toFixed(1)+' '+C.toFixed(1)+'"/></svg><b>'+pc+'%</b></div></div>'
  +(p.goal?'<p class="goal">'+esc(p.goal)+'</p>':'')
  +p.steps.map(function(s){return '<div class="st'+(s.done?' done':'')+'"><button class="ck" data-act="stog" data-p="'+p.id+'" data-s="'+s.id+'">'+CHK+'</button><span>'+esc(s.t)+'</span><button class="x" data-act="sdel" data-p="'+p.id+'" data-s="'+s.id+'" aria-label="Quitar paso">×</button></div>'}).join('')
  +'<div class="addst"><input placeholder="Agregar paso y Enter" data-p="'+p.id+'" class="stin"></div><div class="acts" style="margin-top:10px"><button class="btn s lite" data-act="eplan" data-p="'+p.id+'">Editar plan</button></div></div>'});
 if(!S.plans.length)h+='<div class="empty">Todavía no tenés planes. Creá el primero.</div>';
 return h+'</div>'}
function daysTo(ds){var n=Math.round((pd(ds)-pd(today()))/864e5);return n===0?'es hoy':n>0?'faltan '+n+' días':'pasó hace '+(-n)+' días'}
/* ===== NOTAS ===== */
function vNota(){var q=Q.toLowerCase(),l=S.notes.filter(function(n){return !q||(n.t+' '+n.body).toLowerCase().indexOf(q)>=0}).sort(function(a,b){return (b.pin?1:0)-(a.pin?1:0)||b.ts-a.ts});
 return '<div class="head"><div><h2 style="font-size:clamp(34px,6vw,56px)">Notas</h2></div><button class="btn" data-act="newnote">'+ico('plus',2.4).replace('<svg','<svg width="18" height="18"')+' Nueva nota</button></div><div class="tools"><input class="search" id="nq" placeholder="Buscar en tus notas" value="'+esc(Q)+'"></div><div class="notes">'
 +l.map(function(n){return '<button class="note" style="--nc:'+n.c+'" data-act="enote" data-id="'+n.id+'">'+(n.pin?'<span class="pin">📌</span>':'')+'<h4>'+esc(n.t||'Sin título')+'</h4><p>'+esc(n.body)+'</p><small>'+esc(new Date(n.ts).toLocaleDateString('es-AR',{day:'numeric',month:'short'}))+'</small></button>'}).join('')+'</div>'+(l.length?'':'<div class="empty">No hay notas'+(q?' con ese texto':' todavía')+'.</div>')}
/* ===== FINISH · tesorería: facturas y pagos ===== */
var FORMAS=['Transferencia','Cheques / eCheqs','Servicios / Pagos Directos','VEP','Efectivo','Tarjeta'];
var FSERV=['Servicio','Servicios','Servicios / Pagos Directos','VEP','Efectivo','Tarjeta'],FCHQ=['Cheque','Cheques','Cheques / eCheqs'];
var INL=null,PF={soc:'',forma:'',fecha:'',est:'pend',q:''},SEL={};
function normCuit(c){return String(c==null?'':c).replace(/\D/g,'')}
function payDays(){var d=(S.cfg&&S.cfg.payDays)||[2,4];return d.length?d:[2,4]}
function nearestPay(){var h=new Date(),best=null;payDays().forEach(function(dw){var df=(dw-h.getDay()+7)%7;if(best===null||df<best)best=df});return iso(addD(h,best||0))}
function nextDow(dw){var h=new Date(),df=dw-h.getDay();if(df<=0)df+=7;return iso(addD(h,df))}
function byId(a,id){return a.filter(function(x){return x.id===id})[0]}
function pagoNombre(p){var pr=p.pid?byId(S.prov,p.pid):null;if(pr)return pr.nombre;if(p.tipo==='servicio')return p.desc||(p.nro.indexOf('-')>=0?p.nro.split('-')[0]:'Servicio');return 'Sin registrar'}
function formaOk(p,f){if(!f)return true;if(f==='Cheques / eCheqs'||f==='Cheques'||f==='Cheque')return FCHQ.indexOf(p.forma)>=0;if(f==='Servicios / Pagos Directos')return FSERV.indexOf(p.forma)>=0;return p.forma===f}
function detectVep(nro,desc,forma){var t=((nro||'')+' '+(desc||'')+' '+(forma||'')).toLowerCase();return ['vep','afip','arca','ganancia','iva','iibb','monotributo','sicore'].some(function(k){return t.indexOf(k)>=0})}
/* ---- lectura del PDF (pdf.js embebido, se carga solo la primera vez) ---- */
function b2u(b64){var b=atob(b64),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
var XLP=null;
function loadXlsx(){if(window.XLSX)return Promise.resolve(window.XLSX);if(XLP)return XLP;XLP=new Promise(function(res,rej){var sc=document.createElement('script'),el=$('#xjl');sc.src=el?URL.createObjectURL(new Blob([b2u(el.textContent)],{type:'text/javascript'})):'assets/vendor/xlsx.full.min.js';sc.onload=function(){res(window.XLSX)};sc.onerror=rej;document.head.appendChild(sc)});return XLP}
function importProv(file){if(!file)return;if(!/\.(xlsx?|csv)$/i.test(file.name)){toast('Subí un Excel (.xlsx) o CSV');return}
 file.arrayBuffer().then(function(buf){return loadXlsx().then(function(X){var rows;if(/\.csv$/i.test(file.name)){var tx=new TextDecoder('utf-8').decode(buf).replace(/^\uFEFF/,''),sp=(tx.split('\n')[0].split(';').length>1)?';':',';rows=tx.split(/\r?\n/).filter(function(l){return l.trim()}).map(function(l){return l.split(sp).map(function(c){return c.replace(/^"|"$/g,'').trim()})})}else{var wb=X.read(buf,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]];rows=X.utils.sheet_to_json(ws,{header:1,defval:''})}
  if(!rows.length)throw new Error('vacío');var H=rows[0].map(function(c){return String(c||'').trim().toUpperCase()});
  var ic=H.findIndex(function(c){return c.indexOf('CUIT')>=0}),inom=H.findIndex(function(c){return c.indexOf('NOMBRE')>=0||c.indexOf('RAZON')>=0||c.indexOf('RAZÓN')>=0||c.indexOf('PROVEEDOR')>=0}),ib=H.findIndex(function(c){return c.indexOf('CBU')>=0||c.indexOf('ALIAS')>=0||c.indexOf('CUENTA')>=0}),im=H.findIndex(function(c){return c.indexOf('MAIL')>=0});
  if(ic<0||inom<0){toast('El Excel necesita las columnas CUIT y NOMBRE (o RAZÓN SOCIAL)');return}
  var nu=0,up=0,om=0;rows.slice(1).forEach(function(r){var cu=normCuit(r[ic]),nm=String(r[inom]||'').trim(),cb=ib>=0?String(r[ib]||'').trim():'',ml=im>=0?String(r[im]||'').trim():'';if(!cu||!nm){om++;return}
   var ex=S.prov.filter(function(p){return normCuit(p.cuit)===cu})[0];if(ex){ex.nombre=nm;if(cb)ex.cbu=cb;if(ml)ex.mail=ml;up++}else{S.prov.push({id:uid(),nombre:nm,cuit:cu,cbu:cb,mail:ml});nu++}});
  save();render();toast(nu+' nuevos, '+up+' actualizados'+(om?', '+om+' sin CUIT o nombre':''))})}).catch(function(e){console.error(e);toast('No pude leer ese Excel')})}
function plantillaProv(){loadXlsx().then(function(X){var ws=X.utils.aoa_to_sheet([['CUIT','NOMBRE','CBU/ALIAS'],['30712345678','Ejemplo Distribuidora S.A.','mi.alias.ejemplo']]),wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,'Proveedores');X.writeFile(wb,'Plantilla_Proveedores.xlsx')})}
var PDFP=null;
function loadPdfJs(){if(PDFP)return PDFP;PDFP=new Promise(function(res,rej){try{var s=document.createElement('script');var el=$('#pjl'),ew=$('#pjw');s.src=el?URL.createObjectURL(new Blob([b2u(el.textContent)],{type:'text/javascript'})):'assets/vendor/pdf.min.js';s.onload=function(){window.pdfjsLib.GlobalWorkerOptions.workerSrc=ew?URL.createObjectURL(new Blob([b2u(ew.textContent)],{type:'text/javascript'})):'assets/vendor/pdf.worker.min.js';res(window.pdfjsLib)};s.onerror=rej;document.head.appendChild(s)}catch(e){rej(e)}});return PDFP}
function pdfText(doc){return Promise.resolve(doc).then(function(doc){var pr=[];for(var i=1;i<=doc.numPages;i++)pr.push(doc.getPage(i).then(function(pg){return pg.getTextContent()}));return Promise.all(pr)}).then(function(pages){
 return pages.map(function(c){var it=c.items.filter(function(x){return x.str&&x.str.trim()!==''||x.str===' '}).map(function(x){return {s:x.str,x:x.transform[4],y:x.transform[5],w:x.width||0}});it.sort(function(a,b){return Math.abs(a.y-b.y)<2.5?a.x-b.x:b.y-a.y});
  var lines=[],cur=null;it.forEach(function(t){if(cur&&Math.abs(cur.y-t.y)<2.5){var gap=t.x-cur.end;cur.t+=(gap>1.5&&!/\s$/.test(cur.t)&&!/^\s/.test(t.s)?' ':'')+t.s;cur.end=t.x+t.w}else{cur={y:t.y,t:t.s,end:t.x+t.w};lines.push(cur)}});return lines.map(function(l){return l.t}).join('\n')}).join('\n')})}
/* ---- motor de extracción (portado de tu app.py) ---- */
var BASURA=['FACTURA','FACTURA A','FACTURA B','FACTURA C','FACTURA EX','A FACTURA','B FACTURA','C FACTURA','EX FACTURA','ORIGINAL','DUPLICADO','TRIPLICADO','COMPROBANTE','DOCUMENTO','INVOICE','PUNTO DE VENTA','COD. 01','COD. 001','COD.01','COD.001','CÓDIGO Nº','CODIGO Nº','HOJA','HOJA 1 DE 1','CALIDAD CERTIFICADA','RAZON SOCIAL:','RAZÓN SOCIAL:','CLIENTE:','SEÑOR(ES):','SENOR(ES):','SEÑOR/ES','SENOR/ES','SRES.','SRES:','PROVEEDOR / SERVICIO','PROVEEDOR NO IDENTIFICADO','S/N'];
var TSOC=[/\bS\.?\s?A\.?\b/i,/\bS\.?\s?R\.?\s?L\.?\b/i,/\bS\.?\s?A\.?\s?S\.?\b/i,/\bS\.?\s?A\.?\s?U\.?\b/i,/\bS\.?\s?C\.?\b/i,/\bS\.?\s?C\.?\s?S\.?\b/i,/\bS\.?\s?C\.?\s?A\.?\b/i,/\bS\.?\s?E\.?\b/i,/\bS\.?\s?A\.?\s?M\.?\b/i,/\bSOCIEDAD ANÓNIMA\b/i,/\bSOCIEDAD ANONIMA\b/i,/\bSOCIEDAD DE RESPONSABILIDAD LIMITADA\b/i,/\bSOCIEDAD EN COMANDITA\b/i];
function escRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function parseMonto(v){if(!v)return null;var s=String(v).trim().replace('$','').replace(/ /g,'');if(!s)return null;var c=s.indexOf(',')>=0,p=s.indexOf('.')>=0,q;
 if(c&&p){if(s.lastIndexOf(',')>s.lastIndexOf('.'))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'')}
 else if(c){q=s.split(',');s=q[q.length-1].length===2?q.slice(0,-1).join('')+'.'+q[q.length-1]:s.replace(/,/g,'')}
 else if(p){q=s.split('.');s=q[q.length-1].length===2?q.slice(0,-1).join('')+'.'+q[q.length-1]:s.replace(/\./g,'')}
 var n=parseFloat(s);return isFinite(n)?n:null}
function nombreMalo(n){if(!n||n.trim().length<3)return true;var u=n.trim().toUpperCase();if(/^\d{4,5}[-\s]\d{6,8}$/.test(u)||/^N[°ºO]*\s*\d/.test(u))return true;return BASURA.some(function(b){return u===b||u==='A '+b||u===b+' A'})}
function limpiarEmisor(t){var res=t.trim();
 for(var i=0;i<TSOC.length;i++){var m=TSOC[i].exec(res);if(m){var fin=m.index+m[0].length;if(res.charAt(fin)==='.')fin++;var hasta=res.slice(0,fin).trim();
  /* ojo: acá recorto solo prefijos que traen números/hora/ERP; el original sacaba también la primera palabra del nombre */
  var izq=hasta.replace(/^.*?\d[\d\/:\s,-]*(?:ERP|GLOBALBLUEPOINT|SISTEMA|PÁGINA|PAGE)?\s*[-–—]?\s*/i,'').trim();return izq.length>=3?izq:hasta}}
 BASURA.forEach(function(b){if(res.toUpperCase().indexOf(b)===0)res=res.replace(new RegExp('^'+escRe(b)+'\\s*','i'),'').trim()});
 return res.split(/FECHA|CUIT|INICIO|CONDICI|DOMICILIO|CÓDIGO|CODIGO/i)[0].trim()}
function extraer(texto){var U=texto.toUpperCase(),lineas=texto.split('\n').map(function(l){return l.trim()}).filter(Boolean);
 var r={cuit:'',monto:0,nro:'S/N',razon:'',tipo:'proveedor',fvenc:'',vep:false,prov:null},m,esVep=false;
 function sv(nom,razon,nro){esVep=true;r.tipo='servicio';r.cuit='';r.razon=razon;if(nro)r.nro=nro}
 if(U.indexOf('VOLANTE ELECTRÓNICO DE PAGO')>=0||U.indexOf('ARCA VEP')>=0||U.indexOf('NRO. VEP:')>=0||/VOLANTE ELECTR.NICO DE PAGO/.test(U)){m=U.match(/NRO\.?\s*VEP:\s*(\d+)/);sv(0,'ARCA',m?'VEP-'+m[1]:null)}
 else if(U.indexOf('COMARB')>=0||U.indexOf('SIFERE')>=0){m=U.match(/N°?\s*VERIFICADOR:\s*(\d+)/);sv(0,'COMARB / SIFERE',m?'VERIF-'+m[1]:null)}
 else if(/UNION\s+OBRERA\s+DE\s+LA\s+CONSTRUCCION/.test(U)||(/NOTA\s+DE\s+CREDITO/.test(U)&&U.indexOf('UOCRA')>=0)||(/CUOTA\s+SINDICAL/.test(U)&&U.indexOf('UOCRA')>=0)){m=texto.match(/Nro:\s*(\d+)/i);sv(0,'UOCRA',m?'UOCRA-'+m[1]:null)}
 else if(/UNION\s+EMPLEADOS\s+DE\s+LA\s+CONSTRUCCION/.test(U)||(U.indexOf('UECARA')>=0&&/RESOLUCION\s+D\.N\.A\.S\s+5\/92/.test(U))){m=texto.match(/Cuenta\s+Nro:\s*(\d+[\/]\d+)/i)||texto.match(/Formulario\s+Nro:\s*(\d+)/i);sv(0,'UECARA',m?'UECARA-'+m[1]:null)}
 else if(/INSTITUTO\s+DE\s+ESTADISTICA\s+Y\s+REGISTRO/.test(U)||(U.indexOf('IERIC')>=0&&/FONDO\s+CESE\s+LABORAL/.test(U))){m=texto.match(/N.?\s*IERIC:\s*(\d+)/i)||texto.match(/N[uú]mero\s+de\s+Boleta:\s*(\d+)/i);sv(0,'IERIC',m?'IERIC-'+m[1]:null)}
 var propios=S.soc.map(function(s){return normCuit(s.cuit)}).filter(Boolean),prov=null;
 if(!esVep){var cab=texto.split(/CLIENTE:|SEÑOR\(ES\):|SEÑOR\/ES|SR\(ES\):|SRES\.:|SRES:|DATOS DEL COMPRADOR/i)[0];
  var re=/\b\d{11}\b|\b\d{2}-\d{8}-\d\b/g,cand=(cab.match(re)||[]).filter(function(c){return propios.indexOf(normCuit(c))<0});
  if(!cand.length)cand=(texto.match(re)||[]).filter(function(c){return propios.indexOf(normCuit(c))<0});
  if(cand.length)r.cuit=normCuit(cand[0]);
  if(r.cuit)prov=S.prov.filter(function(p){return normCuit(p.cuit)===r.cuit})[0]||null;
  if(!prov){var tl=U.replace(/[^A-Z0-9\s]/g,'');prov=S.prov.filter(function(p){var nb=p.nombre.toUpperCase().replace(/\b(SA|SRL|SH|SAS|SOCIEDAD ANONIMA)\b/g,'').trim().replace(/[^A-Z0-9\s]/g,'');return nb.length>3&&tl.indexOf(nb)>=0})[0]||null}
  if(prov){r.razon=prov.nombre;r.cuit=prov.cuit}}
 r.prov=prov;
 if(!prov){
  /* solo miro el encabezado (lo que está antes de "CLIENTE:" / "Señor(es):"): ahí está el emisor, no el comprador */
  var MK=/CLIENTE\s*:|SE[ÑN]OR\(ES\)|SE[ÑN]OR\/ES|SR\(ES\)|SRES\.?\s*:|DATOS DEL COMPRADOR|DESTINATARIO\s*:/i,hdr=[],stop=false;
  lineas.forEach(function(l){if(stop)return;var parte=l.split(MK)[0].trim();if(MK.test(l))stop=true;if(parte)hdr.push(parte)});
  var propioN=function(n){var x=n.toUpperCase().replace(/[^A-Z0-9]/g,'');return S.soc.some(function(o){var y=o.nombre.toUpperCase().replace(/[^A-Z0-9]/g,'');return y.length>3&&(x.indexOf(y)>=0||y.indexOf(x)>=0&&x.length>5)})};
  var okN=function(n){return !nombreMalo(n)&&!propioN(n)};
  var mr=hdr.join('\n').match(/(?:RAZÓN SOCIAL|RAZON SOCIAL|EMISOR)[:\s]*([^\n]+)/i);
  if(mr){var rs=mr[1].trim().split(/FECHA|CUIT|CONDICIÓN/i)[0].trim();rs=limpiarEmisor(rs);if(okN(rs))r.razon=rs}
  if(!r.razon||!okN(r.razon)){r.razon='';for(var i=0;i<Math.min(15,hdr.length);i++){var lu=hdr[i].toUpperCase();if(TSOC.some(function(p){return p.test(lu)})){var ll=limpiarEmisor(hdr[i]);if(okN(ll)){r.razon=ll;break}}}}
  if(!r.razon){for(var j=0;j<Math.min(12,hdr.length);j++){var L=hdr[j].toUpperCase();if(L.indexOf('RESPONSABLE INSCRIPTO')>=0||L.indexOf('EXENTO')>=0||L.indexOf('MONOTRIBUTO')>=0){if(j>0){var cd=limpiarEmisor(hdr[j-1]);if(okN(cd)&&!/^[\d\s\-\/:]+$/.test(cd)){r.razon=cd;break}}}}}}
 if(!r.razon||nombreMalo(r.razon)||(!r.cuit&&!prov)){
  function cli(rx){var q=U.match(rx);return q?'CTE-'+q[1]:null}
  if(/\bAYSA\b/.test(U)||U.indexOf('AGUA Y SANEAMIENTOS')>=0){r.tipo='servicio';r.razon='AySA S.A.';m=U.match(/CUENTA DE SERVICIOS\s*(\d+)/)||U.match(/LSP\s*(\d+)/);if(m)r.nro='CTA-'+m[1]}
  else if(/\bEDESUR\b/.test(U)){r.tipo='servicio';r.razon='Edesur S.A.';m=cli(/CLIENTE:\s*(\d+)/);if(m)r.nro=m}
  else if(/\bEDENOR\b/.test(U)){r.tipo='servicio';r.razon='Edenor S.A.';m=cli(/N[°ºO]*\s*CLIENTE:?\s*(\d+)/);if(m)r.nro=m}
  else if(/\bMETROGAS\b/.test(U)||/\bCAMUZZI\b/.test(U)||U.indexOf('GAS NATURAL')>=0){r.tipo='servicio';r.razon=U.indexOf('METROGAS')>=0?'Metrogas S.A.':'Camuzzi Gas';m=cli(/N[°ºO]*\s*CLIENTE:?\s*(\d+)/);if(m)r.nro=m}
  else if(/\bTELECOM\b|\bPERSONAL\b|\bMOVISTAR\b|\bCLARO\b/.test(U)||U.indexOf('TELEFONICA')>=0||U.indexOf('TELEFÓNICA')>=0){r.tipo='servicio';r.razon=U.indexOf('TELECOM')>=0?'Telecom Argentina S.A.':U.indexOf('PERSONAL')>=0?'Telecom Personal S.A.':/MOVISTAR|TELEF/.test(U)?'Telefónica Móviles Argentina S.A. (Movistar)':'AMX Argentina S.A. (Claro)';m=cli(/N[°ºO]*\s*CLIENTE:?\s*(\d+)/)||cli(/CUENTA:?\s*(\d+)/);if(m)r.nro=m}
  else if(/\bAGIP\b/.test(U)||U.indexOf('INMOBILIARIO Y ABL')>=0){r.tipo='servicio';r.razon='AGIP / ABL';m=U.match(/PARTIDA\s*(\d+)/);if(m)r.nro='PAR-'+m[1]}
  else if(U.indexOf('CARGAS SOCIALES')>=0||U.indexOf('FORMULARIO 931')>=0||/\bF\.?\s*931\b/.test(U)||U.indexOf('SUSS')>=0){r.tipo='servicio';r.razon='AFIP/ARCA - Cargas Sociales (F.931)';m=U.match(/PER[IÍ]ODO:?\s*(\d{2}\/\d{4}|\d{6})/);if(m)r.nro='F931-'+m[1]}
  else if(/\bIERIC\b/.test(U)){r.tipo='servicio';r.razon='IERIC';m=U.match(/N[ºO°]*\s*IERIC:?\s*(\d+)/)||U.match(/CTA\.?\s*([\d\/]+)/);if(m)r.nro='IERIC-'+m[1]}
  else if(U.replace(/[^A-Z]/g,'').indexOf('UOCRA')>=0){r.tipo='servicio';r.razon='UOCRA';m=U.match(/CUENTA[^\d]{0,15}([\d\/]+)/)||U.match(/NOTA DE CREDITO\s*NRO:?\s*(\d+)/);if(m)r.nro='UOCRA-'+m[1]}
  else if(U.replace(/[^A-Z]/g,'').indexOf('UECARA')>=0){r.tipo='servicio';r.razon='UECARA';m=U.match(/CUENTA[^\d]{0,15}([\d\/]+)/);if(m)r.nro='UECARA-'+m[1]}}
 if(nombreMalo(r.razon))r.razon='';
 if(r.nro==='S/N'){var pv=U.match(/PUNTO DE VENTA:\s*(\d{1,5})/),cp=U.match(/COMP\.?\s*N[RÓO]*:\s*(\d{1,8})/),z=function(s,n){return ('00000000'+s).slice(-n)};
  if(pv&&cp)r.nro=z(pv[1],5)+'-'+z(cp[1],8);
  else if(m=texto.match(/(\d{4,5})\s*-\s*(\d{8})/))r.nro=z(m[1],5)+'-'+z(m[2],8);
  else if(m=texto.match(/(\d{5})\s+(\d{8})/))r.nro=m[1]+'-'+m[2];
  else{var pats=[/\bN[°ºO]*\s*(\d{1,5})\s*[-:]\s*(\d{1,8})/,/[A-C]\s*[-:]?\s*(\d{1,5})\s*[-:]\s*(\d{1,8})/,/(?:NÚMERO|NUMERO|COMPROBANTE|FACTURA)\s*[:#°]*\s*([A-Z]*[-]?\d{1,5}[-]\d{1,8}|\d{1,5}[-]\d{1,8})/,/NÚMERO DE FACTURA\s*([A-Z0-9]+[-]\d+)/];
   for(var k=0;k<pats.length;k++){var mc=U.match(pats[k]);if(mc){r.nro=mc.length>=3&&mc[2]!==undefined?z(mc[1],5)+'-'+z(mc[2],8):mc[1].trim();break}}}}
 var pv2=[/FECHA DE VTO\.?\s*PARA EL PAGO:\s*(\d{2}\/\d{2}\/\d{2,4})/,/VENCIMIENTO[:\s]*(\d{2}\/\d{2}\/\d{2,4})/,/F\.?\s*VTO\.?[:\s]*(\d{2}\/\d{2}\/\d{2,4})/,/EXPIRA EN[:\s]*(\d{4}-\d{2}-\d{2})/];
 for(var a=0;a<pv2.length;a++){var vm=U.match(pv2[a]);if(vm){var fr=vm[1];if(fr.indexOf('-')>=0){r.fvenc=fr;break}var pp=fr.split('/');if(pp[2].length===2)pp[2]='20'+pp[2];r.fvenc=pp[2]+'-'+pp[1]+'-'+pp[0];break}}
 var T0='(?:\\$|ARS|US\\$)?[\\s]{0,5}([\\d\\.\\,]+[.,]\\d{2})',lab=['IMPORTE TOTAL A PAGAR[\\s:]{0,15}','IMPORTE TOTAL C/IVA[\\s:]{0,15}','IMPORTE TOTAL[\\s:]{0,15}','TOTAL A PAGAR\\s*\\(1[°º]?\\s*VENCIMIENTO\\)[\\s:]{0,10}','TOTAL A PAGAR[\\s:]{0,15}','TOTAL VENTA[\\s:]{0,15}','TOTAL COMPROBANTE[\\s:]{0,15}','MONTO TOTAL[\\s:]{0,15}','TOTAL LIQUIDACI[OÓ]N[\\s:]{0,15}','\\bTOTAL\\b[\\s:]{0,15}'];
 for(var b=0;b<lab.length;b++){var mm=texto.match(new RegExp(lab[b]+T0,'gi'));if(mm){var vals=mm.map(function(x){return parseMonto(x.replace(new RegExp('^'+lab[b],'i'),''))}).filter(function(v){return v&&v>0});if(vals.length){r.monto=Math.max.apply(null,vals);break}}}
 if(!r.monto){var br=texto.match(/\d{1,3}(?:[.,]\d{3})+[.,]\d{2}\b|\d+[.,]\d{2}\b/g)||[],vs=br.map(parseMonto).filter(function(v){return v&&v>0});if(vs.length)r.monto=Math.max.apply(null,vs)}
 r.vep=esVep;return r}
/* ---- pantalla Pagos ---- */
function pagosFilt(){var q=PF.q.toLowerCase();return S.pagos.filter(function(p){if(PF.soc&&p.sid!==PF.soc)return false;if(PF.fecha&&p.fprog!==PF.fecha)return false;if(PF.est==='pend'&&p.estado==='pagado')return false;if((PF.est==='pag'||PF.est==='hist')&&p.estado!=='pagado')return false;if(!formaOk(p,PF.forma))return false;if(q&&(pagoNombre(p)+' '+p.nro+' '+p.desc).toLowerCase().indexOf(q)<0)return false;return true}).sort(function(a,b){if(PF.est==='hist'){var x=(a.fpago||a.fprog||''),y=(b.fpago||b.fprog||'');return x<y?1:x>y?-1:0}return (a.fprog||'9999')<(b.fprog||'9999')?-1:(a.fprog||'9999')>(b.fprog||'9999')?1:0})}
function vPago(){var T=today(),pend=S.pagos.filter(function(p){return p.estado!=='pagado'}),sum=function(a){return a.reduce(function(x,p){return x+(+p.monto||0)},0)};
 var wk=iso(addD(new Date(),7)),sem=pend.filter(function(p){return p.fprog&&p.fprog>=T&&p.fprog<=wk}),atr=pend.filter(function(p){return p.fprog&&p.fprog<T}),mes=today().slice(0,7),pg=S.pagos.filter(function(p){return p.estado==='pagado'&&(p.fprog||'').slice(0,7)===mes});
 var L=pagosFilt(),by={},ks=[];L.forEach(function(p){var k=PF.est==='hist'?((p.fpago||p.fprog||'sin').slice(0,10)):(p.fprog||'sin');if(!by[k]){by[k]=[];ks.push(k)}by[k].push(p)});
 var nsel=Object.keys(SEL).filter(function(k){return SEL[k]}).length,selSum=sum(S.pagos.filter(function(p){return SEL[p.id]}));
 var h='<div class="head"><div><h2 style="font-size:clamp(34px,6vw,56px)">Pagos</h2><p class="empty" style="padding:6px 0">Subí la factura y Finish lee los datos.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn lite" data-fa="goconc">Conciliar IVA</button><button class="btn lite" data-fa="pexp">Exportar Excel</button><button class="btn lite" data-fa="manual">Pago manual</button><button class="btn c" data-fa="upload">'+ico('up',2.4).replace('<svg','<svg width="18" height="18"')+' Subir factura PDF</button></div></div>'
 +'<input type="file" id="pdfin" accept="application/pdf,.pdf" hidden><div id="inl"></div>'
 +(INL?'':'<div class="drop" id="drop"><div>'+ico('up',1.6)+'</div><div><b>Soltá la factura acá</b><span>PDF de factura, VEP o servicio. Leo el CUIT, el monto, el número y el vencimiento.</span></div></div>')
 +'<div class="paybar"><div class="a"><span>Por pagar</span><b>'+money(sum(pend))+'</b></div><div><span>Próximos 7 días</span><b>'+money(sum(sem))+'</b></div><div class="'+(atr.length?'bad':'')+'"><span>Vencidos sin pagar</span><b>'+money(sum(atr))+'</b></div><div><span>Pagado este mes</span><b>'+money(sum(pg))+'</b></div></div>'
 +'<div class="tools"><div class="seg" id="pest">'+[['pend','Pendientes'],['pag','Pagados'],['hist','Historial'],['todos','Todos']].map(function(x){return '<button data-e="'+x[0]+'" class="'+(PF.est===x[0]?'on':'')+'">'+x[1]+'</button>'}).join('')+'</div>'
 +'<input class="search" id="pq" placeholder="Buscar proveedor o factura" value="'+esc(PF.q)+'"><select class="i" id="pfs" style="width:auto"><option value="">Todas las sociedades</option>'+S.soc.map(function(s){return '<option value="'+s.id+'"'+(PF.soc===s.id?' selected':'')+'>'+esc(s.nombre)+'</option>'}).join('')+'</select><select class="i" id="pff" style="width:auto"><option value="">Toda forma de pago</option><option'+(PF.forma==='Transferencia'?' selected':'')+'>Transferencia</option><option'+(PF.forma==='Cheques / eCheqs'?' selected':'')+'>Cheques / eCheqs</option><option'+(PF.forma==='Servicios / Pagos Directos'?' selected':'')+'>Servicios / Pagos Directos</option></select><input class="i" type="date" id="pfd" value="'+esc(PF.fecha)+'" style="width:auto"></div>';
 if(nsel)h+='<div class="bulk"><b>'+nsel+' seleccionado'+(nsel>1?'s':'')+' · '+money(selSum)+'</b><button class="btn s lite" data-fa="bpaid">Marcar pagados</button><button class="btn s lite" data-fa="bpend">Volver a pendiente</button><button class="btn s lite" data-fa="bdate">Mover fecha</button><button class="btn s red" data-fa="bdel">Eliminar</button><button class="btn s o" data-fa="bnone" style="margin-left:auto">Quitar selección</button></div>';
 ks.forEach(function(k){var sm=sum(by[k]),isT=k!=='sin'&&(pd(k).getDay()===2||pd(k).getDay()===4);
  h+='<div class="pd'+(isT?' tj':'')+'"><div class="ph"><b>'+(k==='sin'?'Sin fecha de pago':esc(fmtD(k,{weekday:'long',day:'numeric',month:'long'}))+(PF.est==='hist'?(k===T?' · hoy':''):(k===T?' · hoy':k<T?' · pasó':'')))+'</b><span>'+money(sm)+'</span></div>'
  +by[k].map(function(p){var venc=p.fvenc&&p.fvenc<T&&p.estado!=='pagado',st=p.estado==='pagado'?'<i class="tg ok">Pagado</i>':venc?'<i class="tg bad">Vencido</i>':'<i class="tg">Pendiente</i>';
   return '<div class="pr'+(p.estado==='pagado'?' done':'')+'"><button class="ck'+(SEL[p.id]?' sel':'')+'" data-fa="sel" data-id="'+p.id+'" aria-label="Seleccionar">'+CHK+'</button><button class="tx" data-fa="edit" data-id="'+p.id+'" style="text-align:left"><div class="tt">'+esc(pagoNombre(p))+'</div><div class="meta"><span>Fac. '+esc(p.nro)+'</span><span>'+esc((byId(S.soc,p.sid)||{}).nombre||'—')+'</span><span class="fch">'+esc(p.forma)+(p.cheque?' '+esc(p.cheque):'')+'</span>'+(PF.est==='hist'&&p.fpago&&p.fpago.length>10?'<span>Confirmado '+esc(p.fpago.slice(11))+' hs</span>':'')+(p.fvenc?'<span>Vence '+esc(fmtD(p.fvenc,{day:'numeric',month:'short'}))+'</span>':'')+'</div></button>'+st+'<em>'+money(p.monto)+'</em></div>'}).join('')+'</div>'});
 if(!ks.length)h+='<div class="empty">'+(S.pagos.length?'No hay pagos con esos filtros.':'Todavía no cargaste pagos. Subí una factura para empezar.')+'</div>';
 return h}
/* ---- formulario de pago (desde PDF, manual o edición) ---- */
function nowLocal(){var n=new Date();return today()+'T'+pad(n.getHours())+':'+pad(n.getMinutes())}
function setPaid(p,on){p.estado=on?'pagado':'pendiente';p.fpago=on?nowLocal():''}
function togKey(k){if(k.indexOf('pg|')===0){var p=byId(S.pagos,k.slice(3));if(p)setPaid(p,p.estado!=='pagado')}else{S.done[k]=!S.done[k];if(!S.done[k])delete S.done[k]}save()}
function editR(id){if(String(id).indexOf('pg|')===0){var p=byId(S.pagos,String(id).slice(3));if(p)payForm(p,'edit');return}remForm(byId(S.rem,id),false)}
function blankP(o){return Object.assign({id:'',sid:S.soc.length===1?S.soc[0].id:'',bid:'',pid:'',nom:'',cuit:'',cbu:'',nro:'',oc:'',monto:'',fvenc:'',fprog:nearestPay(),tipo:'proveedor',forma:'Transferencia',cheque:'',desc:'',estado:'pendiente'},o||{})}
function payForm(src,mode,info,doc){var inl=VIEW==='pago',P=Object.assign(blankP(),src);
 if(mode==='edit'){var pr=P.pid?byId(S.prov,P.pid):null;if(pr){P.nom=pr.nombre;P.cuit=pr.cuit;P.cbu=pr.cbu||''}else if(P.tipo==='servicio')P.nom=P.desc}
 function bancosDe(){return S.bancos.filter(function(b){return b.sid===P.sid})}
 function ensureBank(){var b=bancosDe();if(b.length===1)P.bid=b[0].id;else if(!b.some(function(x){return x.id===P.bid}))P.bid=''}
 ensureBank();
 function badge(){var reg=P.pid&&byId(S.prov,P.pid);return reg?'<i class="tg ok">✓ Registrado</i>':(P.nom||P.cuit?'<i class="tg warn">Nuevo, no guardado</i>':'<i class="tg">Escribí para buscar</i>')}
 function ui(m){var serv=P.tipo==='servicio',B=bancosDe();
  m.innerHTML='<h2>'+(mode==='edit'?'Editar pago':mode==='manual'?'Pago manual':'Revisá los datos')+'</h2>'
  +(info?'<div class="ext '+(info.cls||'')+'">'+info.html+'</div>':'')
  +(S.soc.length?'':'<div class="warn">Primero cargá al menos una sociedad (tu empresa) en Ajustes → Tesorería.</div>')
  +'<div class="r2"><label class="fld"><span>Sociedad</span><select class="i" id="x_sid"><option value="">Elegir…</option>'+S.soc.map(function(s){return '<option value="'+s.id+'"'+(P.sid===s.id?' selected':'')+'>'+esc(s.nombre)+'</option>'}).join('')+'</select></label>'
  +'<label class="fld"><span>Banco de origen</span><select class="i" id="x_bid">'+(B.length?(B.length>1?'<option value="">Elegir…</option>':''):'<option value="">'+(P.sid?'Sin bancos cargados':'Elegí la sociedad')+'</option>')+B.map(function(b){return '<option value="'+b.id+'"'+(P.bid===b.id?' selected':'')+'>'+esc(b.nombre)+'</option>'}).join('')+'</select></label></div>'
  +'<div class="r2"><label class="fld"><span>Tipo de gasto</span><select class="i" id="x_tipo"><option value="proveedor"'+(!serv?' selected':'')+'>Proveedor</option><option value="servicio"'+(serv?' selected':'')+'>Servicio / impuesto</option></select></label>'
  +'<label class="fld"><span>Forma de pago</span><select class="i" id="x_forma">'+FORMAS.map(function(f){return '<option'+(P.forma===f?' selected':'')+'>'+f+'</option>'}).join('')+'</select></label></div>'
  +(P.forma==='Cheques / eCheqs'?'<label class="fld"><span>Número de cheque / eCheq</span><input class="i" id="x_chq" value="'+esc(P.cheque)+'"></label>':'')
  +'<div class="box"><div class="bh"><b>'+(serv?'Emisor del servicio':'Proveedor')+'</b><span id="x_badge">'+(serv?'':badge())+'</span></div>'
  +'<label class="fld sugw"><span>Nombre</span><input class="i" id="x_nom" autocomplete="off" value="'+esc(P.nom)+'" placeholder="'+(serv?'Ej: ARCA, Edenor':'Escribí para buscar o cargar uno nuevo')+'"><div class="sug" id="x_sug"></div></label>'
  +(serv?'':'<div class="r2"><label class="fld"><span>CUIT</span><input class="i" id="x_cuit" inputmode="numeric" value="'+esc(P.cuit)+'" placeholder="30-12345678-1"></label><label class="fld"><span>CBU / Alias</span><input class="i" id="x_cbu" value="'+esc(P.cbu)+'"></label></div><div class="acts" style="margin:0"><button class="btn s lite" data-x="saveprov">Guardar proveedor</button></div>')+'</div>'
  +'<div class="r2"><label class="fld"><span>N.º de factura / comprobante</span><input class="i" id="x_nro" value="'+esc(P.nro)+'"></label><label class="fld"><span>OC / OP (opcional)</span><input class="i" id="x_oc" value="'+esc(P.oc)+'"></label></div>'
  +'<div class="r2"><label class="fld"><span>Monto</span><input class="i" id="x_monto" type="number" step="0.01" min="0" inputmode="decimal" value="'+esc(P.monto)+'"></label><label class="fld"><span>Vencimiento de la factura</span><input class="i" id="x_fv" type="date" value="'+esc(P.fvenc)+'"></label></div>'
  +'<div class="fld"><span style="display:block;font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--mut);margin-bottom:5px;text-transform:uppercase">Fecha de pago programada</span><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input class="i" id="x_fp" type="date" value="'+esc(P.fprog)+'" style="width:auto;flex:1;min-width:150px"><div class="seg"><button data-x="dn">Más cercano</button><button data-x="dh">Hoy</button>'+payDays().slice().sort().map(function(w){return '<button data-x="w'+w+'">'+DOWL[w]+'</button>'}).join('')+'</div></div></div>'
  +'<label class="fld"><span>Descripción (opcional)</span><textarea class="i" id="x_desc" style="min-height:64px">'+esc(P.desc)+'</textarea></label>'
  +'<div class="acts">'+(mode==='edit'?'<button class="btn red l" data-x="del">Eliminar</button>':'')+'<button class="btn o" data-x="cancel">Cancelar</button><button class="btn c" data-x="save">'+(mode==='edit'?'Guardar cambios':'Programar pago')+'</button></div>'}
 function pull(m){var g=function(i){var e=$(i,m);return e?e.value:null},v;if((v=g('#x_sid'))!==null)P.sid=v;if((v=g('#x_bid'))!==null)P.bid=v;if((v=g('#x_tipo'))!==null)P.tipo=v;if((v=g('#x_forma'))!==null)P.forma=v;if((v=g('#x_chq'))!==null)P.cheque=v.trim();if((v=g('#x_nom'))!==null)P.nom=v;if((v=g('#x_cuit'))!==null)P.cuit=v.trim();if((v=g('#x_cbu'))!==null)P.cbu=v.trim();if((v=g('#x_nro'))!==null)P.nro=v.trim();if((v=g('#x_oc'))!==null)P.oc=v.trim();if((v=g('#x_monto'))!==null)P.monto=v===''?'':+v;if((v=g('#x_fv'))!==null)P.fvenc=v;if((v=g('#x_fp'))!==null)P.fprog=v;if((v=g('#x_desc'))!==null)P.desc=v}
 function sugs(m){var box=$('#x_sug',m);if(!box)return;var q=P.nom.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();box.innerHTML='';if(!q||P.tipo==='servicio'){box.style.display='none';return}
  var w=q.split(/\s+/),r=S.prov.filter(function(p){var n=p.nombre.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(),c=normCuit(p.cuit);return w.every(function(x){return n.indexOf(x)>=0})||w.every(function(x){return c.indexOf(x)>=0})}).slice(0,6);
  if(!r.length){box.style.display='none';return}box.innerHTML=r.map(function(p){return '<button type="button" data-pv="'+p.id+'">'+esc(p.nombre)+(p.cuit?' <small>· CUIT '+esc(p.cuit)+'</small>':'')+'</button>'}).join('');box.style.display='block'}
 function pickProv(p){P.pid=p.id;P.nom=p.nombre;P.cuit=p.cuit;P.cbu=p.cbu||''}
 function closeP(){if(inl){INL=null;render()}else closeSheet()}
 function mount(m){ui(m);
  m.oninput=function(e){var id=e.target.id;if(id==='x_nom'){P.nom=e.target.value;var ex=S.prov.filter(function(p){return p.nombre.trim().toLowerCase()===P.nom.trim().toLowerCase()})[0];if(ex&&P.tipo==='proveedor'){pull(m);pickProv(ex);ui(m);return}P.pid='';var bd=$('#x_badge',m);if(bd&&P.tipo==='proveedor')bd.innerHTML=badge();sugs(m)}};
  m.onchange=function(e){var id=e.target.id;pull(m);
   if(id==='x_sid'){ensureBank();ui(m)}else if(id==='x_tipo'||id==='x_forma'){ui(m)}
   else if(id==='x_cuit'&&P.cuit.length>=10){var pr=S.prov.filter(function(p){return normCuit(p.cuit)===normCuit(P.cuit)})[0];if(pr){pickProv(pr);ui(m)}else{P.pid='';var bd=$('#x_badge',m);if(bd)bd.innerHTML=badge()}}};
  m.onclick=function(e){var b=e.target.closest('button');if(!b)return;var d=b.dataset;
   if(d.pv){pull(m);pickProv(byId(S.prov,d.pv));ui(m)}
   else if(d.x==='dn'||d.x==='dh'||/^w\d$/.test(d.x||'')){pull(m);P.fprog=d.x==='dn'?nearestPay():d.x==='dh'?today():nextDow(+d.x.slice(1));ui(m)}
   else if(d.x==='cancel')closeP();
   else if(d.x==='saveprov'){pull(m);if(P.nom.trim().length<3||normCuit(P.cuit).length<10){toast('Poné nombre y un CUIT válido');return}var ex=P.pid?byId(S.prov,P.pid):S.prov.filter(function(p){return normCuit(p.cuit)===normCuit(P.cuit)})[0];if(ex){ex.nombre=P.nom.trim();ex.cbu=P.cbu;ex.cuit=P.cuit}else{ex={id:uid(),nombre:P.nom.trim(),cuit:P.cuit,cbu:P.cbu};S.prov.push(ex)}P.pid=ex.id;save();ui(m);toast('Proveedor guardado: '+ex.nombre)}
   else if(d.x==='del'){if(confirm('¿Eliminar este pago?')){S.pagos=S.pagos.filter(function(x){return x.id!==P.id});save();closeP();render();toast('Pago eliminado')}}
   else if(d.x==='save'){pull(m);
    if(!P.sid){toast('Elegí la sociedad');return}if(!(+P.monto>0)){toast('Falta el monto');return}if(!P.nro)P.nro='S/N';
    if(detectVep(P.nro,P.desc,P.forma)&&P.tipo!=='servicio'){P.tipo='servicio';P.pid=''}
    if(P.tipo==='proveedor'){if(P.nom.trim().length<3){toast('Poné el nombre del proveedor');return}if(normCuit(P.cuit).length<10){toast('Poné un CUIT válido del proveedor');return}
     var ex=P.pid?byId(S.prov,P.pid):S.prov.filter(function(p){return normCuit(p.cuit)===normCuit(P.cuit)})[0];
     if(ex){ex.nombre=P.nom.trim();if(P.cbu)ex.cbu=P.cbu}else{ex={id:uid(),nombre:P.nom.trim(),cuit:P.cuit,cbu:P.cbu};S.prov.push(ex)}P.pid=ex.id}
    else{if(!P.desc&&P.nom.trim())P.desc=P.nom.trim();P.pid=''}
    var rec={id:P.id||uid(),sid:P.sid,bid:P.bid,pid:P.pid,nro:P.nro,oc:P.oc,monto:+P.monto,fvenc:P.fvenc,fprog:P.fprog,tipo:P.tipo,forma:P.forma,cheque:P.forma==='Cheques / eCheqs'?P.cheque:'',desc:P.desc,estado:P.estado||'pendiente',fpago:P.fpago||'',file:P.file||''};
    if(mode==='edit'){var ix=S.pagos.findIndex(function(x){return x.id===rec.id});S.pagos[ix]=rec}else S.pagos.push(rec);
    save();closeP();if(!inl)go('pago');toast(mode==='edit'?'Pago actualizado':'Pago programado para el '+fmtD(rec.fprog||today(),{day:'numeric',month:'long'}))}};
  m.addEventListener('mousedown',function(e){if(!e.target.closest('.sugw'))$('#x_sug',m)&&($('#x_sug',m).style.display='none')})}
if(inl){INL={doc:doc||null,pull:function(){var f=$('#inlf');if(f)pull(f)},mount:function(){var h=$('#inl');if(!h)return;var me=INL;h.innerHTML='<div class="inl">'+(me.doc?'<div class="pv"><div class="pvh"><b>'+esc(P.file||'Factura')+'</b><span>Factura que subiste</span></div><div id="inlpages"></div></div>':'')+'<div class="card" id="inlf"'+(me.doc?'':' style="grid-column:1/-1;max-width:780px"')+'></div></div>';mount($('#inlf'));if(me.doc)renderPages(me.doc,$('#inlpages'))}};INL.mount();var hh=$('#inl');if(hh)hh.scrollIntoView({behavior:'smooth',block:'start'})}else openSheet('',mount)}
function renderPages(doc,el){el.innerHTML='';var w=Math.max(260,el.clientWidth||420),dpr=Math.min(2,window.devicePixelRatio||1);(function pg(i){if(i>doc.numPages||!el.isConnected)return;doc.getPage(i).then(function(p){var k=w/p.getViewport({scale:1}).width,v=p.getViewport({scale:k*dpr}),c=document.createElement('canvas');c.width=v.width;c.height=v.height;c.style.width='100%';el.appendChild(c);return p.render({canvasContext:c.getContext('2d'),viewport:v}).promise}).then(function(){pg(i+1)})})(1)}

function subirPDF(file){if(!file)return;if(!/\.pdf$/i.test(file.name)){toast('Subí un archivo PDF');return}
 if(!S.soc.length){payForm(blankP(),'manual',{cls:'w',html:'Antes de cargar facturas necesito al menos una sociedad (tu empresa). Cargala en Ajustes → Tesorería.'});return}
 toast('Leyendo '+file.name+'…');
 file.arrayBuffer().then(function(buf){return loadPdfJs().then(function(lib){return lib.getDocument({data:new Uint8Array(buf)}).promise})}).then(function(doc){return pdfText(doc).then(function(txt){var d=extraer(txt),leido=txt.trim().length>20;
  var pr=d.prov,P=blankP({tipo:d.tipo,nro:d.nro==='S/N'?'':d.nro,monto:d.monto||'',fvenc:d.fvenc||'',nom:d.razon||'',cuit:d.cuit||'',file:file.name,forma:d.vep?'VEP':'Transferencia'});
  if(pr){P.pid=pr.id;P.nom=pr.nombre;P.cuit=pr.cuit;P.cbu=pr.cbu||''}
  if(d.tipo==='servicio'&&!P.desc)P.desc=d.razon||'';
  var info=leido?{html:'Leí <b>'+esc(file.name)+'</b>'+(pr?' y reconocí al proveedor.':d.vep?' y lo detecté como pago de impuesto / servicio.':'.')+' Revisá los datos antes de guardar.'}:{cls:'w',html:'No pude leer texto en <b>'+esc(file.name)+'</b> (puede ser un escaneo). Completá los datos a mano.'};
  payForm(P,'pdf',info,doc)})}).catch(function(err){console.error(err);payForm(blankP({file:file.name}),'manual',{cls:'w',html:'No pude abrir el PDF. Completá los datos a mano.'})})}

var PV={q:'',pg:0,edit:null},ST='gen',PVN=30;
function nrm(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function pvFiltered(){var q=nrm(PV.q).split(/\s+/).filter(Boolean);return S.prov.filter(function(p){if(!q.length)return true;var h=nrm(p.nombre+' '+p.cuit+' '+(p.cbu||'')+' '+(p.mail||''));return q.every(function(w){return h.indexOf(w)>=0})}).sort(function(a,b){return a.nombre.localeCompare(b.nombre,'es')})}
function pvEditRow(p){var n=p.id==='new';return '<div class="pvr edit"><div class="pvf"><label class="fld"><span>Nombre / Razón social</span><input class="i" id="pe_n" value="'+esc(p.nombre||'')+'"></label><label class="fld"><span>CUIT</span><input class="i" id="pe_c" inputmode="numeric" value="'+esc(p.cuit||'')+'"></label><label class="fld"><span>CBU / Alias</span><input class="i" id="pe_b" value="'+esc(p.cbu||'')+'"></label><label class="fld"><span>Email</span><input class="i" id="pe_m" type="email" value="'+esc(p.mail||'')+'"></label></div><div class="acts" style="margin-top:12px"><button class="btn o s" data-fa="pvcancel">Cancelar</button><button class="btn c s" data-fa="pvsave" data-id="'+p.id+'">'+(n?'Agregar proveedor':'Guardar cambios')+'</button></div></div>'}
function pvBody(){var L=pvFiltered(),tot=L.length,pages=Math.max(1,Math.ceil(tot/PVN));if(PV.pg>=pages)PV.pg=pages-1;var from=PV.pg*PVN,rows=L.slice(from,from+PVN);
 var h=(PV.edit==='new'?pvEditRow({id:'new'}):'');
 h+=rows.map(function(p){if(PV.edit===p.id)return pvEditRow(p);return '<div class="pvr"><span class="av">'+esc((p.nombre||'?').charAt(0).toUpperCase())+'</span><span class="pvn"><b>'+esc(p.nombre)+'</b>'+(p.mail?'<small>'+esc(p.mail)+'</small>':'')+'</span><span class="pvc"><small>CUIT</small>'+esc(p.cuit||'—')+'</span><span class="pvb"><small>CBU / Alias</small>'+esc(p.cbu||'—')+'</span><span class="pva"><button class="btn s lite" data-fa="pvedit" data-id="'+p.id+'">Editar</button><button class="btn s red" data-fa="pvdel" data-id="'+p.id+'">Borrar</button></span></div>'}).join('');
 if(!rows.length&&PV.edit!=='new')h+='<div class="empty">'+(S.prov.length?'Ningún proveedor coincide con “'+esc(PV.q)+'”.':'Todavía no hay proveedores. Subí tu Excel o CSV, o agregá uno.')+'</div>';
 h+='<div class="pvpg"><span>'+(tot?(from+1)+'–'+Math.min(from+PVN,tot)+' de '+tot:'0')+(tot!==S.prov.length?' (de '+S.prov.length+' en total)':'')+'</span><span><button class="btn s lite" data-fa="pvpg" data-d="-1"'+(PV.pg<=0?' disabled':'')+'>← Anterior</button> <button class="btn s lite" data-fa="pvpg" data-d="1"'+(PV.pg>=pages-1?' disabled':'')+'>Siguiente →</button></span></div>';return h}
function provHTML(){return '<div class="card pvcard"><div class="pvtop"><div><h3>Proveedores <span class="cnt">'+S.prov.length+'</span></h3><p class="hint">Finish completa solo el proveedor al leer el CUIT de cada factura. Subí tu Excel o CSV (CUIT, NOMBRE, CBU/ALIAS, MAIL).</p></div><div class="acts" style="margin:0"><button class="btn s" data-fa="pvnew">+ Nuevo</button><button class="btn s lite" data-fa="xlup">Subir Excel / CSV</button><button class="btn s lite" data-fa="xlplant">Plantilla</button>'+(S.prov.length?'<button class="btn s red" data-fa="pvall">Borrar todos</button>':'')+'<input type="file" id="xlin" accept=".xlsx,.xls,.csv" hidden></div></div><input class="i" id="pvq" placeholder="Buscar por nombre, CUIT, CBU o mail…" value="'+esc(PV.q)+'" style="margin:6px 0 12px"><div id="pvwrap">'+pvBody()+'</div></div>'}
function tresoHTML(){return ''
 +'<div class="card"><h3>Días de pago</h3><p class="hint">Al cargar una factura, la fecha de pago se pone sola en el día de pago más cercano (hoy cuenta). Ej.: si es miércoles y pagás martes y jueves, queda el jueves.</p><div class="seg dsel">'+[1,2,3,4,5,6,0].map(function(w){return '<button data-fa="pdw" data-w="'+w+'" class="'+(payDays().indexOf(w)>=0?'on':'')+'">'+DOWI[w]+'</button>'}).join('')+'</div></div>'
 +'<div class="card ppl"><h3>Sociedades (tus empresas)</h3><p class="hint">Quién paga. Su CUIT se ignora al leer facturas.</p>'+S.soc.map(function(s){return '<div class="pp"><span class="av">'+esc(s.nombre.charAt(0).toUpperCase())+'</span><span class="tx"><b>'+esc(s.nombre)+'</b><small>CUIT '+esc(s.cuit||'—')+'</small></span><button class="btn s red" data-fa="socdel" data-id="'+s.id+'">Quitar</button></div>'}).join('')+'<div class="r2" style="margin-top:12px"><input class="i" id="sn" placeholder="Nombre"><input class="i" id="sc" placeholder="CUIT"></div><div class="acts"><button class="btn s" data-fa="socadd">Agregar sociedad</button></div></div>'
 +'<div class="card ppl"><h3>Bancos de origen</h3><p class="hint">Desde qué cuenta se paga.</p>'+S.bancos.map(function(b){var s=byId(S.soc,b.sid);return '<div class="pp"><span class="av">B</span><span class="tx"><b>'+esc(b.nombre)+'</b><small>'+esc(s?s.nombre:'—')+'</small></span><button class="btn s red" data-fa="bandel" data-id="'+b.id+'">Quitar</button></div>'}).join('')+'<div class="r2" style="margin-top:12px"><select class="i" id="bs"><option value="">Sociedad…</option>'+S.soc.map(function(s){return '<option value="'+s.id+'">'+esc(s.nombre)+'</option>'}).join('')+'</select><input class="i" id="bn" placeholder="Banco y cuenta"></div><div class="acts"><button class="btn s" data-fa="banadd">Agregar banco</button></div></div>'}

function exportPagos(){var sel=S.pagos.filter(function(p){return SEL[p.id]}),L=sel.length?sel:pagosFilt();if(!L.length){toast('No hay pagos para exportar');return}
 var f=function(x){if(!x)return '';var q=String(x).slice(0,10).split('-');return q[2]+'/'+q[1]+'/'+q[0]};
 var rows=[['Fecha de pago','Estado','Confirmado','Proveedor','CUIT','CBU / Alias','Comprobante','Forma de pago','Cheque','Sociedad','Banco origen','Vencimiento','Monto']];
 L.forEach(function(p){var pr=p.pid?byId(S.prov,p.pid):null,so=byId(S.soc,p.sid),bk=byId(S.bancos,p.bid);
  rows.push([f(p.fprog),p.estado==='pagado'?'Pagado':'Pendiente',p.fpago?f(p.fpago)+' '+p.fpago.slice(11):'',pagoNombre(p),String(pr&&pr.cuit||''),String(pr&&pr.cbu||''),p.nro||'',p.forma||'',p.cheque||'',so?so.nombre:'',bk?bk.nombre:'',f(p.fvenc),+p.monto||0])});
 loadXlsx().then(function(X){var ws=X.utils.aoa_to_sheet(rows),wb=X.utils.book_new();ws['!cols']=[12,10,16,34,14,26,18,22,12,24,20,12,14].map(function(w){return {wch:w}});X.utils.book_append_sheet(wb,ws,'Pagos');var n=new Date();X.writeFile(wb,'PAGOS_'+today().replace(/-/g,'')+'_'+pad(n.getHours())+pad(n.getMinutes())+'.xlsx');toast('Excel con '+L.length+' pago'+(L.length>1?'s':''))}).catch(function(){toast('No pude generar el Excel')})}
/* ===== importar vencimientos de la app anterior ===== */
function importVenc(txt){var arr;try{arr=JSON.parse(txt)}catch(e){toast('Ese archivo no es un JSON válido');return}if(!Array.isArray(arr)){toast('No parece el archivo de vencimientos');return}
 var me=S.ppl.filter(function(p){return p.me})[0],T=today(),nu=0,sk=0,old=0;
 function nextAnchor(ds){var d=pd(ds),t=pd(T);while(d<t)d=addD(d,14);return iso(d)}
 arr.forEach(function(v){if(v.pagado){old++;return}var key='v:'+v.id_v;if(S.rem.some(function(r){return r.src===key})){sk++;return}
  var fr=v.frecuencia||'una_vez',amt=parseFloat(String(v.monto||'').replace(',','.')),tipo=v.tipo||(amt?'vencimiento':'recordatorio'),
   cat=tipo==='vencimiento'?'venc':tipo==='tarea'?'tarea':'record',dt=String(v.fecha||T),d0=pd(dt),
   r=blankR({t:String(v.concepto||'').trim(),cat:cat,time:/^\d{1,2}:\d{2}$/.test(v.hora||'')?pad(+String(v.hora).split(':')[0])+':'+v.hora.split(':')[1]:'09:00',amt:amt>0?amt:'',lead:0,mail:true,to:[me.id],src:key});
  if(!r.t)return;
  if(fr==='mensual'){r.type='monthly';r.dom=d0.getDate();r.date=nextDom(r.dom,dt<T?T:dt)}
  else if(fr==='cada_14_dias'){r.type='biweekly';r.date=nextAnchor(dt)}
  else if(fr==='diario'){r.type='daily';r.date=dt<T?T:dt}
  else if(fr==='primer_martes'||fr==='primer_jueves'){r.type='nthdow';r.nth=1;r.dow=fr==='primer_martes'?2:4;r.date=dt<T?T:dt}
  else{r.type='once';r.date=dt}
  var ex=String(v.mails_extras||'').split(',').map(function(x){return x.trim()}).filter(function(x){return /^\S+@\S+\.\S+$/.test(x)});
  ex.forEach(function(m){var pp=S.ppl.filter(function(x){return x.email===m})[0];if(!pp){pp={id:uid(),name:m.split('@')[0],email:m};S.ppl.push(pp)}r.to.push(pp.id)});
  if(!me.email&&/^\S+@\S+\.\S+$/.test(v.email_destino||''))me.email=v.email_destino.trim();
  S.rem.push(Object.assign(r,{id:uid()}));nu++});
 save();render();toast(nu+' importados'+(sk?', '+sk+' ya estaban':'')+(old?' · '+old+' ya pagados no se traen':''))}
/* acciones de Pagos y Tesorería */
document.addEventListener('click',function(e){var b=e.target.closest('[data-fa]');if(!b)return;if($('#ov').classList.contains('on')&&!$('#sh').contains(b))return;var a=b.dataset.fa,d=b.dataset;
 if(a==='upload')$('#pdfin').click();else if(a==='manual')payForm(blankP(),'manual');
 else if(a==='edit')payForm(byId(S.pagos,d.id),'edit');
 else if(a==='sel'){SEL[d.id]=!SEL[d.id];render()}else if(a==='bnone'){SEL={};render()}
 else if(a==='bpaid'||a==='bpend'){S.pagos.forEach(function(p){if(SEL[p.id])setPaid(p,a==='bpaid')});SEL={};save();render();toast(a==='bpaid'?'Marcados como pagados':'Vueltos a pendiente')}
 else if(a==='bdel'){var n=Object.keys(SEL).filter(function(k){return SEL[k]}).length;if(confirm('¿Eliminar '+n+' pago(s)? No se puede deshacer.')){S.pagos=S.pagos.filter(function(p){return !SEL[p.id]});SEL={};save();render()}}
 else if(a==='bdate'){openSheet('<h2>Mover fecha de pago</h2><div class="seg" style="margin-bottom:12px"><button data-x="d2">Próximo martes</button><button data-x="d4">Próximo jueves</button></div><label class="fld"><span>O elegí una fecha</span><input class="i" type="date" id="bd" value="'+today()+'"></label><div class="acts"><button class="btn o" data-x="c">Cancelar</button><button class="btn c" data-x="ok">Mover</button></div>',function(m){var apply=function(f){S.pagos.forEach(function(p){if(SEL[p.id])p.fprog=f});SEL={};save();closeSheet();render();toast('Fecha actualizada')};m.onclick=function(ev){var x=ev.target.dataset.x;if(x==='c')closeSheet();else if(x==='d2')apply(nextDow(2));else if(x==='d4')apply(nextDow(4));else if(x==='ok'&&$('#bd',m).value)apply($('#bd',m).value)}})}
 else if(a==='xlup')$('#xlin').click();else if(a==='xlplant')plantillaProv();
 else if(a==='pdw'){var w=+d.w,pdv=payDays().slice(),ix=pdv.indexOf(w);if(ix>=0){if(pdv.length>1)pdv.splice(ix,1);else{toast('Dejá al menos un día');return}}else pdv.push(w);S.cfg.payDays=pdv;save();render()}
 else if(a==='socadd'){var n=$('#sn').value.trim();if(!n){toast('Poné el nombre');return}S.soc.push({id:uid(),nombre:n,cuit:$('#sc').value.trim()});save();render()}
 else if(a==='socdel'){if(confirm('¿Quitar la sociedad y sus bancos?')){S.soc=S.soc.filter(function(x){return x.id!==d.id});S.bancos=S.bancos.filter(function(x){return x.sid!==d.id});save();render()}}
 else if(a==='banadd'){var s=$('#bs').value,bn=$('#bn').value.trim();if(!s||!bn){toast('Elegí sociedad y escribí el banco');return}S.bancos.push({id:uid(),sid:s,nombre:bn});save();render()}
 else if(a==='bandel'){S.bancos=S.bancos.filter(function(x){return x.id!==d.id});save();render()}
 else if(a==='pexp')exportPagos();
 else if(a==='goconc')go('conc');else if(a==='cnback')go('pago');else if(a==='cnpick')$('#cn'+d.w).click();else if(a==='cntab'){CN.tab=d.t;render()}else if(a==='cnreset'){CN={a:null,o:null,an:'',on:'',res:null,tab:'conc'};render()}else if(a==='cnxls')cnExport();
 else if(a==='dbsetup'){var pw=document.getElementById('dbpw').value;if(!pw)return;syncApi('setup_db',{name:'u748338755_finish',user:'u748338755_finish',pass:pw}).then(function(j){if(j.status===200){toast('Base conectada');SYNC.on=true;SYNC.state='local';syncInit();setTimeout(render,600)}else toast(j.status===422?'No pude entrar con esa contraseña':'No se pudo conectar la base')})}
 else if(a==='stab'){ST=d.t;render()}
 else if(a==='pvnew'){PV.edit='new';PV.q='';PV.pg=0;render();var f=$('#pe_n');if(f)f.focus()}
 else if(a==='pvedit'){PV.edit=d.id;render();var f2=$('#pe_n');if(f2)f2.scrollIntoView({block:'center'})}
 else if(a==='pvcancel'){PV.edit=null;render()}
 else if(a==='pvpg'){PV.pg+=+d.d;render();var pc=$('.pvcard');if(pc)pc.scrollIntoView({block:'start'})}
 else if(a==='pvsave'){var nm=$('#pe_n').value.trim(),cu=normCuit($('#pe_c').value),cb=$('#pe_b').value.trim(),ml=$('#pe_m').value.trim();
  if(nm.length<3){toast('Poné el nombre del proveedor');return}
  if($('#pe_c').value.trim()&&cu.length<10){toast('El CUIT no parece válido');return}
  if(cu&&S.prov.some(function(x){return x.id!==d.id&&normCuit(x.cuit)===cu})){toast('Ya hay otro proveedor con ese CUIT');return}
  if(d.id==='new')S.prov.push({id:uid(),nombre:nm,cuit:cu,cbu:cb,mail:ml});else{var pr=byId(S.prov,d.id);pr.nombre=nm;pr.cuit=cu;pr.cbu=cb;pr.mail=ml}
  PV.edit=null;save();render();toast('Proveedor guardado')}
 else if(a==='pvdel'){var pd2=byId(S.prov,d.id);if(confirm('¿Borrar a '+(pd2?pd2.nombre:'este proveedor')+'? No se puede deshacer.')){S.prov=S.prov.filter(function(x){return x.id!==d.id});PV.edit=null;save();render();toast('Proveedor borrado')}}
 else if(a==='pvall'){if(confirm('¿Borrar los '+S.prov.length+' proveedores? No se puede deshacer.')){S.prov=[];PV.edit=null;PV.q='';save();render()}}});
function finAfter(){['a','o'].forEach(function(w){var i=$('#cn'+w);if(i)i.addEventListener('change',function(e){var fl=e.target.files[0];e.target.value='';cnLoad(w,fl)})});if(INL)INL.mount();var pvq=$('#pvq');if(pvq)pvq.addEventListener('input',function(){PV.q=pvq.value;PV.pg=0;$('#pvwrap').innerHTML=pvBody()});var xi=$('#xlin');if(xi)xi.addEventListener('change',function(e){var fl=e.target.files[0];e.target.value='';importProv(fl)});var f=$('#pdfin');if(f)f.addEventListener('change',function(e){var fl=e.target.files[0];e.target.value='';subirPDF(fl)});
 var dz=$('#drop');if(dz){['dragenter','dragover'].forEach(function(n){dz.addEventListener(n,function(e){e.preventDefault();dz.classList.add('on')})});['dragleave','drop'].forEach(function(n){dz.addEventListener(n,function(e){e.preventDefault();dz.classList.remove('on')})});dz.addEventListener('drop',function(e){subirPDF(e.dataTransfer.files[0])});dz.addEventListener('click',function(){f.click()})}
 var pq=$('#pq');if(pq)pq.addEventListener('input',function(){PF.q=pq.value;var p=pq.selectionStart;render();var n=$('#pq');n.focus();n.setSelectionRange(p,p)});
 var s1=$('#pfs');if(s1)s1.addEventListener('change',function(){PF.soc=s1.value;render()});var s2=$('#pff');if(s2)s2.addEventListener('change',function(){PF.forma=s2.value;render()});var s3=$('#pfd');if(s3)s3.addEventListener('change',function(){PF.fecha=s3.value;render()});
 var pe=$('#pest');if(pe)pe.addEventListener('click',function(e){var v=e.target.dataset.e;if(v){PF.est=v;render()}})}

/* ===== AJUSTES / mails ===== */
function toNames(r){return (r.to||[]).map(function(id){return S.ppl.filter(function(p){return p.id===id})[0]}).filter(Boolean)}
function outbox(days){var out=[],n=new Date(),now=Date.now();
 for(var i=0;i<=days;i++){var ds=iso(addD(n,i));
  occ(ds).forEach(function(o){var r=o.r;if(!r.mail||!r.to.length||o.done)return;var at=new Date(pd(ds).getTime());var hh=r.time.split(':');at.setHours(+hh[0],+hh[1]-(+r.lead||0),0,0);if(at.getTime()<now-6e4)return;out.push({at:at,r:r,ds:ds,mv:o.mv,to:toNames(r),kind:'rec'})});
  if(S.cfg.digest){var at2=new Date(pd(ds).getTime());var d2=(S.cfg.digestH||'07:30').split(':');at2.setHours(+d2[0],+d2[1],0,0);if(at2.getTime()>=now&&occ(ds).length)out.push({at:at2,ds:ds,to:S.ppl.filter(function(p){return p.me}),kind:'dig',n:occ(ds).length})}}
 out.sort(function(a,b){return a.at-b.at});return out}
function mailSubj(o){return o.kind==='dig'?'Tu agenda de hoy · '+fmtD(o.ds):'Recordatorio: '+o.r.t}
function mailHtml(o){var L='<a href="https://finish.estrategia.site/" style="display:inline-block;margin-top:16px;background:#0e1120;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:14px">Abrir en Finish</a>',b;
 if(o.kind==='dig')b='<h2 style="margin:0 0 10px;font-size:20px">Tu día · '+esc(fmtD(o.ds))+'</h2>'+occ(o.ds).map(function(x){return '<div style="padding:6px 0;border-bottom:1px solid #eceff6">'+esc(x.r.time)+' · '+esc(x.r.t)+(x.r.amt?' · '+esc(money(x.r.amt)):'')+'</div>'}).join('');
 else b='<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7390">'+esc(CATS[o.r.cat]?CATS[o.r.cat].n:'')+'</div><h2 style="margin:4px 0 8px;font-size:22px">'+esc(o.r.t)+'</h2><div>'+esc(fmtD(o.ds))+' · '+esc(o.r.time)+(o.r.amt?' · '+esc(money(o.r.amt)):'')+'</div>'+(o.mv?'<div style="margin-top:8px;color:#6b7390">Pasó del '+esc(fmtD(o.mv,{weekday:'short',day:'numeric',month:'short'}))+' ('+esc(mvNote(o.mv))+')</div>':'')+(o.r.note?'<div style="margin-top:10px">'+esc(o.r.note)+'</div>':'');
 return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0e1120;max-width:480px;margin:0 auto;padding:22px;border:1px solid #eceff6;border-radius:16px">'+b+'<div>'+L+'</div></div>'}
function outboxPayload(){return outbox(14).map(function(o){var to=o.to.map(function(p){return p.email}).filter(function(e){return /^\S+@\S+\.\S+$/.test(e||'')});return {k:(o.kind==='dig'?'d|'+o.ds:'r|'+o.r.id+'|'+o.ds),at:Math.floor(o.at.getTime()/1000),to:to,subj:mailSubj(o),html:mailHtml(o)}}).filter(function(x){return x.to.length})}
var MST=null;
function mailStText(){if(!MST)return 'Consultando el estado del envío…';if(!MST.config)return '<b style="color:#b83a1f">Falta configurar el correo:</b> creá el archivo private/mail.php (hay una plantilla en private/mail.example.php).';return '<b style="color:#0f7b6c">● Envío configurado</b> · '+MST.pend+' pendientes, '+MST.sent+' enviados'+(MST.fail?', <b style="color:#b83a1f">'+MST.fail+' con error</b>':'')+(MST.err?'<br>Último error: '+esc(MST.err):'')}
function mailStat(){if(!SYNC.on)return;syncApi('mailst').then(function(j){if(j.status===200){MST=j;var e=document.getElementById('mailst');if(e)e.innerHTML=mailStText()}})}
function vSet(){setTimeout(mailStat,60);var me=S.ppl.filter(function(p){return p.me})[0],ob=outbox(7);
 var VOS='<div class="card"><h3>Vos</h3><label class="fld"><span>Tu nombre</span><input class="i" id="cname" value="'+esc(S.cfg.name)+'"></label><label class="fld"><span>Tu email (donde llegan tus avisos)</span><input class="i" id="cmail" type="email" value="'+esc(me.email)+'" placeholder="tu@correo.com"></label>'+(me.email?'':'<div class="warn">Cargá tu email para que los avisos tengan a dónde llegar.</div>')+'</div>',REGLAS='<div class="card"><h3>Reglas de aviso</h3><label class="fld"><span>Avisar con anticipación (por defecto)</span><select class="i" id="clead">'+[[0,'En el momento'],[10,'10 minutos antes'],[30,'30 minutos antes'],[60,'1 hora antes'],[120,'2 horas antes'],[1440,'1 día antes'],[2880,'2 días antes']].map(function(o){return '<option value="'+o[0]+'"'+(+S.cfg.lead===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select></label>'
 +'<label class="sw"><input type="checkbox" id="cdig"'+(S.cfg.digest?' checked':'')+'> Resumen diario de mi agenda por mail</label><label class="fld"><span>Hora del resumen</span><input class="i" type="time" id="cdh" value="'+esc(S.cfg.digestH)+'"></label></div>',DEST='<div class="card ppl"><h3>Destinatarios</h3><p class="hint">Gente a la que podés mandarle avisos de un recordatorio (equipo, contador, clientes).</p>'
 +S.ppl.map(function(p){return '<div class="pp"><span class="av">'+esc((p.name||'?').charAt(0).toUpperCase())+'</span><span class="tx"><b>'+esc(p.name)+'</b>'+(p.me?' · vos':'')+'<small>'+esc(p.email||'sin email')+'</small></span>'+(p.me?'':'<button class="btn s red" data-act="pdel" data-id="'+p.id+'">Quitar</button>')+'</div>'}).join('')
 +'<div class="r2" style="margin-top:12px"><input class="i" id="pn" placeholder="Nombre"><input class="i" id="pe" type="email" placeholder="email@ejemplo.com"></div><div class="acts"><button class="btn s" data-act="padd">Agregar destinatario</button></div></div>',OUT='<div class="card out"><h3>Bandeja de salida · próximos 7 días</h3><p class="hint">Estos son los avisos que el servidor envía desde estrategia.datos@estrategia.site.</p><p class="hint" id="mailst">'+mailStText()+'</p><div style="margin:0 0 12px"><button class="btn s lite" data-act="mailtest">Enviar mail de prueba</button></div>'
 +(ob.length?ob.slice(0,12).map(function(o,i){return '<button class="ob" data-act="mailprev" data-i="'+i+'"><time>'+esc(o.at.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',hour12:false}))+'<small>'+esc(DOWS[o.at.getDay()]+' '+o.at.getDate())+'</small></time><span class="tx"><b>'+(o.kind==='dig'?'Resumen del día · '+o.n+' ítems':esc(o.r.t))+'</b><small>→ '+esc(o.to.map(function(p){return p.name}).join(', ')||'sin destinatarios')+'</small></span></button>'}).join(''):'<div class="empty">No hay mails programados. Activá “Avisar por mail” en un recordatorio.</div>')+'</div>',DATOS='<div class="card"><h3>Datos</h3><p class="hint" id="syncst">'+syncText()+'</p><p class="hint">Descargá una copia cuando quieras.</p><div class="acts" style="justify-content:flex-start;margin:0"><button class="btn s lite" data-act="exp">Exportar copia</button><button class="btn s lite" data-act="imp">Importar copia</button><button class="btn s lite" data-act="impv">Importar vencimientos anteriores</button><input type="file" id="impvf" accept=".json" hidden><input type="file" id="impf" accept=".json" hidden>'+(S.demo?'<button class="btn s red" data-act="clear">Borrar ejemplos</button>':'')+'</div></div></div>';
 var FER='<div class="card"><h3>Feriados y fines de semana</h3><p class="hint">Los <b>vencimientos</b> que caen sábado, domingo o feriado pasan solos al siguiente día hábil y te lo aviso en el ítem. Ya cargué los feriados nacionales de lo que queda de 2026 y de 2027. Agregá acá los que falten (puentes, feriados locales).</p>'+(S.cfg.fer||[]).slice().sort(function(a,b){return a.d<b.d?-1:1}).map(function(f){return '<div class="pp"><span class="tx"><b>'+esc(f.n||'Feriado')+'</b><small>'+esc(fmtD(f.d,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+'</small></span><button class="btn s red" data-act="ferx" data-d="'+esc(f.d)+'">Quitar</button></div>'}).join('')+'<div class="r2" style="margin-top:12px"><input class="i" type="date" id="fd"><input class="i" id="fn" placeholder="Nombre (opcional)"></div><div class="acts"><button class="btn s" data-act="feradd">Agregar feriado</button></div></div>';
 var tabs=[['gen','General'],['avisos','Avisos'],['teso','Tesorería'],['prov','Proveedores ('+S.prov.length+')'],['datos','Datos']];
 var body={gen:VOS+REGLAS+FER,avisos:DEST+''+OUT,teso:tresoHTML(),prov:provHTML(),datos:DATOS}[ST]||'';
 return '<div class="head"><div><h2 style="font-size:clamp(34px,6vw,56px)">Ajustes</h2><p class="empty" style="padding:6px 0">Tus datos, avisos, tesorería y proveedores.</p></div></div><div class="seg stabs">'+tabs.map(function(t){return '<button data-fa="stab" data-t="'+t[0]+'" class="'+(ST===t[0]?'on':'')+'">'+t[1]+'</button>'}).join('')+'</div><div class="set'+(ST==='prov'?' one':'')+'">'+body+'</div>'}
/* ===== sheets ===== */
function openSheet(h,on){$('#sh').innerHTML=h;$('#ov').classList.add('on');if(on)on($('#sh'))}
function closeSheet(){$('#ov').classList.remove('on')}
$('#ov').addEventListener('click',function(e){if(e.target.id==='ov')closeSheet()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeSheet()});
function toast(m){var t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(function(){t.remove()},2300)}
function blankR(o){return Object.assign({id:'',t:'',note:'',cat:'trabajo',type:'once',date:today(),time:'09:00',days:[],dom:1,dom2:15,nth:1,dow:2,until:'',lead:+S.cfg.lead,mail:true,to:[(S.ppl.filter(function(p){return p.me})[0]||{id:'me'}).id],amt:''},o||{})}
function nextDates(R){if(!R.date)return '';var out=[],d=pd(R.date),g=0;while(out.length<3&&g++<800){var ds=iso(d);if(matches(R,ds))out.push(ds);d=addD(d,1)}
 return out.length?'<p class="hint" style="font-size:13px;color:var(--mut);margin:0 0 10px">Próximas fechas: <b>'+out.map(function(x){return esc(fmtD(x,{weekday:'short',day:'numeric',month:'short'}))}).join(' · ')+'</b></p>':''}
function remForm(r,isNew){var R=JSON.parse(JSON.stringify(r));
 function ui(m){var T=R.type;
  m.innerHTML='<h2>'+(isNew?'Nuevo recordatorio':'Editar recordatorio')+'</h2>'
  +'<label class="fld"><span>Qué</span><input class="i" id="f_t" value="'+esc(R.t)+'" placeholder="Ej: Pagar proveedores"></label>'
  +'<div class="fld"><span style="display:block;font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--mut);margin-bottom:5px;text-transform:uppercase">Tipo</span><div class="seg cats">'+Object.keys(CATS).map(function(k){return '<button data-cat="'+k+'" style="--c:'+CATS[k].c+'" class="'+(R.cat===k?'on':'')+'">'+CATS[k].n+'</button>'}).join('')+'</div></div>'
  +'<div class="fld"><span style="display:block;font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--mut);margin-bottom:5px;text-transform:uppercase">Repetición</span><div class="seg">'+[['once','Fecha específica'],['daily','Diario'],['weekly','Semanal'],['biweekly','Cada 14 días'],['bimonthly','Dos días fijos al mes'],['monthly','Mensual'],['yearly','Anual'],['nthdow','Día fijo del mes']].map(function(x){return '<button data-ty="'+x[0]+'" class="'+(T===x[0]?'on':'')+'">'+x[1]+'</button>'}).join('')+'</div></div>'
  +(T==='weekly'?'<div class="fld"><div class="seg dsel">'+[1,2,3,4,5,6,0].map(function(d){return '<button data-dw="'+d+'" class="'+(R.days.indexOf(d)>=0?'on':'')+'">'+DOWI[d]+'</button>'}).join('')+'</div><div class="seg" style="margin-top:8px"><button data-pre="tj">Martes y jueves</button><button data-pre="lv">Lunes a viernes</button></div></div>':'')
  +(T==='nthdow'?'<div class="r2"><label class="fld"><span>Cuál</span><select class="i" id="f_nth">'+[[1,'Primer'],[2,'Segundo'],[3,'Tercer'],[4,'Cuarto'],[5,'Último']].map(function(o){return '<option value="'+o[0]+'"'+(+R.nth===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select></label><label class="fld"><span>Día</span><select class="i" id="f_dow">'+[1,2,3,4,5,6,0].map(function(d){return '<option value="'+d+'"'+(+R.dow===d?' selected':'')+'>'+DOWL[d]+'</option>'}).join('')+'</select></label></div>':'')
  +(T==='bimonthly'?'<p class="hint" style="font-size:13px;color:var(--mut);margin:-4px 0 10px">Se repite siempre esos dos días de cada mes (por defecto 1 y 15). Si querés "cada 2 semanas" desde una fecha, elegí <b>Cada 14 días</b>.</p><div class="r2"><label class="fld"><span>Primer día</span><input class="i" id="f_dom" type="number" min="1" max="31" value="'+esc(R.dom)+'"></label><label class="fld"><span>Segundo día</span><input class="i" id="f_dom2" type="number" min="1" max="31" value="'+esc(R.dom2)+'"></label></div>':'')
  +'<div class="r2"><label class="fld"><span>'+(T==='once'?'Fecha':T==='yearly'?'Fecha (se repite cada año)':'Empieza el')+'</span><input class="i" id="f_date" type="date" value="'+esc(R.date)+'"></label><label class="fld"><span>Hora</span><input class="i" id="f_time" type="time" value="'+esc(R.time)+'"></label></div>'
  +(T!=='once'?'<label class="fld"><span>Termina el (opcional)</span><input class="i" id="f_until" type="date" value="'+esc(R.until)+'"></label>':'')
  +((R.cat==='pago'||R.cat==='venc'||R.amt)?'<label class="fld"><span>Monto (opcional)</span><input class="i" id="f_amt" type="number" min="0" inputmode="decimal" value="'+esc(R.amt)+'" placeholder="0"></label>':'')
  +'<label class="fld"><span>Nota</span><textarea class="i" id="f_note">'+esc(R.note)+'</textarea></label>'
  +'<label class="sw"><input type="checkbox" id="f_mail"'+(R.mail?' checked':'')+'> Avisar por mail</label>'
  +(R.mail?'<div class="fld"><span style="display:block;font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--mut);margin-bottom:5px;text-transform:uppercase">A quién</span><div class="seg">'+S.ppl.map(function(p){return '<button data-to="'+p.id+'" class="'+(R.to.indexOf(p.id)>=0?'on':'')+'">'+esc(p.name)+'</button>'}).join('')+'</div></div><div class="fld"><span style="display:block;font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--mut);margin-bottom:5px;text-transform:uppercase">Agregar otro mail (opcional)</span><div style="display:flex;gap:8px"><input class="i" id="f_xmail" type="email" placeholder="otro@correo.com" autocomplete="off" style="flex:1"><button class="btn s lite" data-x="addmail" type="button">Agregar</button></div></div><label class="fld"><span>Cuándo avisar</span><select class="i" id="f_lead">'+[[0,'En el momento'],[10,'10 minutos antes'],[30,'30 minutos antes'],[60,'1 hora antes'],[120,'2 horas antes'],[1440,'1 día antes'],[2880,'2 días antes']].map(function(o){return '<option value="'+o[0]+'"'+(+R.lead===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select></label>':'')
  +'<div class="acts">'+(isNew?'':'<button class="btn red l" data-x="del">Eliminar</button>')+'<button class="btn o" data-x="cancel">Cancelar</button><button class="btn c" data-x="save">Guardar</button></div>'}
 function pull(m){var g=function(i){var e=$(i,m);return e?e.value:null};if(g('#f_t')!==null)R.t=g('#f_t');if(g('#f_date'))R.date=g('#f_date');if(g('#f_time'))R.time=g('#f_time');if(g('#f_until')!==null)R.until=g('#f_until');if(g('#f_dom'))R.dom=+g('#f_dom');if(g('#f_dom2'))R.dom2=+g('#f_dom2');if(g('#f_nth'))R.nth=+g('#f_nth');if(g('#f_dow'))R.dow=+g('#f_dow');if(g('#f_amt')!==null)R.amt=g('#f_amt')===''?'':+g('#f_amt');if(g('#f_note')!==null)R.note=g('#f_note');if(g('#f_lead')!==null)R.lead=+g('#f_lead');var mm=$('#f_mail',m);if(mm)R.mail=mm.checked}
 openSheet('',function(m){ui(m);
  m.onclick=function(e){var b=e.target.closest('button');if(!b)return;var d=b.dataset;
   if(d.cat){pull(m);R.cat=d.cat;ui(m)}else if(d.ty){pull(m);R.type=d.ty;if(d.ty==='weekly'&&!R.days.length)R.days=[pd(R.date).getDay()];ui(m)}
   else if(d.dw!=null){pull(m);var n=+d.dw,i=R.days.indexOf(n);if(i>=0)R.days.splice(i,1);else R.days.push(n);ui(m)}
   else if(d.pre){pull(m);R.days=d.pre==='tj'?[2,4]:[1,2,3,4,5];ui(m)}
   else if(d.to){pull(m);var j=R.to.indexOf(d.to);if(j>=0)R.to.splice(j,1);else R.to.push(d.to);ui(m)}
   else if(d.x==='addmail'){var xe=$('#f_xmail',m),em2=(xe.value||'').trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(em2)){toast('Poné un mail válido');return}pull(m);var pp=S.ppl.filter(function(q){return (q.email||'').toLowerCase()===em2})[0];if(!pp){pp={id:uid(),name:em2,email:em2};S.ppl.push(pp);save()}if(R.to.indexOf(pp.id)<0)R.to.push(pp.id);R.mail=true;ui(m)}
   else if(d.x==='cancel')closeSheet();
   else if(d.x==='del'){if(confirm('¿Eliminar este recordatorio y todas sus repeticiones?')){S.rem=S.rem.filter(function(x){return x.id!==R.id});save();closeSheet();render();toast('Eliminado')}}
   else if(d.x==='save'){pull(m);if(!R.t.trim()){toast('Falta el título');return}if(R.type==='weekly'&&!R.days.length){toast('Elegí al menos un día');return}
    if(R.mail&&!R.to.length){var me=S.ppl.filter(function(p){return p.me})[0];R.to=[me.id]}
    R.t=R.t.trim();if(R.type==='monthly')R.dom=pd(R.date).getDate();if(isNew){R.id=uid();S.rem.push(R)}else{var ix=S.rem.findIndex(function(x){return x.id===R.id});S.rem[ix]=R}save();closeSheet();render();toast('Guardado')}};
  m.onchange=function(e){if(e.target.id==='f_mail'){pull(m);ui(m)}}})}
function dayDrawer(ds){var list=occ(ds);
 openSheet('<h2 style="text-transform:capitalize">'+esc(fmtD(ds))+'</h2>'+(list.length?'<div class="thread" style="margin-bottom:14px">'+list.map(function(o){return itemHTML(o)}).join('')+'</div>':'<div class="empty">Sin recordatorios este día.</div>')
 +'<label class="fld"><span>Anotación del día</span><textarea class="i" id="dnote" placeholder="Agenda libre, ideas, lo que pasó…">'+esc(S.day[ds]||'')+'</textarea></label><div class="acts"><button class="btn o" data-x="close">Cerrar</button><button class="btn c" data-x="add">+ Recordatorio este día</button></div>',function(m){
  m.onclick=function(e){var b=e.target.closest('button');if(!b)return;var d=b.dataset;
   if(d.act==='tog'){togKey(d.k);dayDrawer(ds);render()}
   else if(d.act==='edit'){editR(d.id)}
   else if(d.x==='close'){var v=$('#dnote',m).value.trim();if(v)S.day[ds]=v;else delete S.day[ds];save();closeSheet();render()}
   else if(d.x==='add'){var v2=$('#dnote',m).value.trim();if(v2)S.day[ds]=v2;else delete S.day[ds];save();remForm(blankR({date:ds}),true)}}})}
function noteForm(n){var N=n?JSON.parse(JSON.stringify(n)):{id:'',t:'',body:'',c:NCOL[0],pin:false,ts:Date.now()};
 openSheet('<h2>'+(n?'Editar nota':'Nueva nota')+'</h2><label class="fld"><span>Título</span><input class="i" id="nt" value="'+esc(N.t)+'"></label><label class="fld"><span>Texto</span><textarea class="i" id="nb" style="min-height:180px">'+esc(N.body)+'</textarea></label><div class="seg" id="nc">'+NCOL.map(function(c){return '<button data-c="'+c+'" style="background:'+c+';border:2px solid '+(N.c===c?'#0e1120':'transparent')+';width:38px;height:38px;padding:0"></button>'}).join('')+'<button data-pin="1" class="'+(N.pin?'on':'')+'">📌 Fijar</button></div><div class="acts">'+(n?'<button class="btn red l" data-x="del">Eliminar</button>':'')+'<button class="btn o" data-x="cancel">Cancelar</button><button class="btn c" data-x="save">Guardar</button></div>',function(m){
  m.onclick=function(e){var b=e.target.closest('button');if(!b)return;var d=b.dataset;
   if(d.c){N.t=$('#nt',m).value;N.body=$('#nb',m).value;N.c=d.c;noteForm2(m)}else if(d.pin){N.pin=!N.pin;b.classList.toggle('on',N.pin)}
   else if(d.x==='cancel')closeSheet();
   else if(d.x==='del'){if(confirm('¿Eliminar la nota?')){S.notes=S.notes.filter(function(x){return x.id!==N.id});save();closeSheet();render()}}
   else if(d.x==='save'){N.t=$('#nt',m).value.trim();N.body=$('#nb',m).value;if(!N.t&&!N.body.trim()){toast('La nota está vacía');return}N.ts=Date.now();if(n){var ix=S.notes.findIndex(function(x){return x.id===N.id});S.notes[ix]=N}else{N.id=uid();S.notes.push(N)}save();closeSheet();render()}};
  function noteForm2(m){$$('#nc button[data-c]',m).forEach(function(x){x.style.borderColor=x.dataset.c===N.c?'#0e1120':'transparent'})}})}
function planForm(p){var P=p?JSON.parse(JSON.stringify(p)):{id:'',t:'',goal:'',due:'',c:PCOL[0],steps:[]};
 openSheet('<h2>'+(p?'Editar plan':'Nuevo plan')+'</h2><label class="fld"><span>Nombre del plan</span><input class="i" id="pt" value="'+esc(P.t)+'"></label><label class="fld"><span>Objetivo</span><input class="i" id="pg" value="'+esc(P.goal)+'"></label><label class="fld"><span>Fecha meta (opcional)</span><input class="i" id="pdu" type="date" value="'+esc(P.due)+'"></label><div class="seg" id="pc">'+PCOL.map(function(c){return '<button data-c="'+c+'" style="background:'+c+';border:3px solid '+(P.c===c?'#0e1120':'transparent')+';width:38px;height:38px;padding:0"></button>'}).join('')+'</div><div class="acts">'+(p?'<button class="btn red l" data-x="del">Eliminar plan</button>':'')+'<button class="btn o" data-x="cancel">Cancelar</button><button class="btn c" data-x="save">Guardar</button></div>',function(m){
  m.onclick=function(e){var b=e.target.closest('button');if(!b)return;var d=b.dataset;
   if(d.c){P.c=d.c;$$('#pc button',m).forEach(function(x){x.style.borderColor=x.dataset.c===P.c?'#0e1120':'transparent'})}
   else if(d.x==='cancel')closeSheet();
   else if(d.x==='del'){if(confirm('¿Eliminar el plan con todos sus pasos?')){S.plans=S.plans.filter(function(x){return x.id!==P.id});save();closeSheet();render()}}
   else if(d.x==='save'){P.t=$('#pt',m).value.trim();if(!P.t){toast('Falta el nombre');return}P.goal=$('#pg',m).value;P.due=$('#pdu',m).value;if(p){var ix=S.plans.findIndex(function(x){return x.id===P.id});S.plans[ix]=P}else{P.id=uid();S.plans.push(P)}save();closeSheet();render()}}})}
function mailPrev(o){var me=S.ppl.filter(function(p){return p.me})[0],to=o.to.map(function(p){return p.name+(p.email?' <'+p.email+'>':'')}).join(', ');
 var body=o.kind==='dig'?'<h4>Tu día · '+esc(fmtD(o.ds))+'</h4><p style="margin:10px 0">'+occ(o.ds).map(function(x){return '• '+esc(x.r.time)+' '+esc(x.r.t)}).join('<br>')+'</p>'
 :'<span class="pill" style="--c:'+cc(o.r)+'">'+esc(CATS[o.r.cat].n)+'</span><h4>'+esc(o.r.t)+'</h4><p>'+esc(fmtD(o.ds))+' · '+esc(o.r.time)+(o.r.amt?' · '+money(o.r.amt):'')+'</p>'+(o.mv?'<p style="margin-top:8px">'+mvTag(o)+'</p>':'')+(o.r.note?'<p style="margin-top:10px">'+esc(o.r.note)+'</p>':'');
 openSheet('<h2>Así llega el mail</h2><div class="mail"><div class="mh"><b>De:</b> Finish &lt;estrategia.datos@estrategia.site&gt;<br><b>Para:</b> '+esc(to||'—')+'<br><b>Asunto:</b> '+(o.kind==='dig'?'Tu agenda de hoy':'Recordatorio: '+esc(o.r.t))+'</div><div class="mb">'+body+'<span class="bt">Abrir en Finish</span></div></div><div class="acts"><button class="btn o" data-x="c">Cerrar</button></div>',function(m){m.onclick=function(e){if(e.target.dataset.x==='c')closeSheet()}})}
/* ===== quick add (lenguaje natural) ===== */
var WD={domingo:0,lunes:1,martes:2,miercoles:3,'miércoles':3,jueves:4,viernes:5,sabado:6,'sábado':6};
function parseQ(src){var s=' '+src.trim()+' ',o={t:'',type:'once',date:today(),time:'09:00',days:[],dom:1,dom2:15,mail:true,to:[(S.ppl.filter(function(p){return p.me})[0]||{id:'me'}).id],cat:'trabajo',found:[]},m;if(!src.trim())return null;
 s=s.replace(/@([\wáéíóúñ]+)/gi,function(a,n){var p=S.ppl.filter(function(x){return x.name.toLowerCase().replace(/\(.*\)/,'').trim().indexOf(n.toLowerCase())===0})[0];if(p){if(o.to.indexOf(p.id)<0)o.to.push(p.id);o.mail=true}return ' '});
 if(/\b(mail|correo|email)\b/i.test(s)){o.mail=true;var me=S.ppl.filter(function(p){return p.me})[0];if(o.to.indexOf(me.id)<0)o.to.push(me.id);s=s.replace(/\b(por )?(mail|correo|email)\b/ig,' ')}
 var tm=false;if(m=s.match(/(?:a las |a la |@)?\b(\d{1,2})[:h\.](\d{2})\b/i)){o.time=pad(+m[1])+':'+m[2];s=s.replace(m[0],' ');tm=true}else if(m=s.match(/\ba las? (\d{1,2})\b(?:\s*(am|pm|hs|h))?/i)){var hh=+m[1];if(/pm/i.test(m[2]||'')&&hh<12)hh+=12;o.time=pad(hh)+':00';s=s.replace(m[0],' ');tm=true}
 var rec=false;
 if(/\b(todos los d[ií]as|diari[oa]s?|cada d[ií]a)\b/i.test(s)){o.type='daily';rec=true;s=s.replace(/\b(todos los d[ií]as|diari[oa]s?|cada d[ií]a)\b/ig,' ')}
 else if(m=s.match(/\b(primer|segundo|tercer|cuarto|[uú]ltimo)\s+(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)(?:\s+(?:de cada mes|del mes))?/i)){o.type='nthdow';o.nth={primer:1,segundo:2,tercer:3,cuarto:4,ultimo:5,'último':5}[m[1].toLowerCase()];o.dow=WD[m[2].toLowerCase()];rec=true;s=s.replace(m[0],' ')}
 else if(/\b(cada 14 d[ií]as|cada (2|dos) semanas|cada quince d[ií]as)\b/i.test(s)){o.type='biweekly';rec=true;s=s.replace(/\b(cada 14 d[ií]as|cada (2|dos) semanas|cada quince d[ií]as)\b/ig,' ')}
 else if(/\b(quincenal(es)?|1 y 15|cada 15 d[ií]as)\b/i.test(s)){o.type='bimonthly';rec=true;s=s.replace(/\b(quincenal(es)?|1 y 15|cada 15 d[ií]as)\b/ig,' ')}
 else if(m=s.match(/\b(?:el d[ií]a |todos los |el )?(\d{1,2}) de cada mes\b/i)||s.match(/\bcada mes(?: el)? (\d{1,2})\b/i)){o.type='monthly';o.dom=+m[1];rec=true;s=s.replace(m[0],' ')}
 else if(/\b(anual(es)?|cada a[ñn]o|todos los a[ñn]os)\b/i.test(s)){o.type='yearly';s=s.replace(/\b(anual(es)?|cada a[ñn]o|todos los a[ñn]os)\b/ig,' ')}
 else if(/\b(mensual(es)?|cada mes|todos los meses)\b/i.test(s)){o.type='monthly';o.dom=new Date().getDate();rec=true;s=s.replace(/\b(mensual(es)?|cada mes|todos los meses)\b/ig,' ')}
 var days=[],re=/\b(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)s?\b/ig,wm,hadEvery=/\b(cada|todos los|todas las|semanal(es)?)\b/i.test(s);
 while(wm=re.exec(s)){var k=wm[1].toLowerCase().replace('é','e').replace('á','a');if(days.indexOf(WD[k])<0)days.push(WD[k])}
 if(days.length&&!rec){if(hadEvery||days.length>1){o.type='weekly';o.days=days;rec=true}else{var t0=new Date(),dd=(days[0]-t0.getDay()+7)%7;if(dd===0&&tm&&o.time<pad(t0.getHours())+':'+pad(t0.getMinutes()))dd=7;o.date=iso(addD(t0,dd))}
  s=s.replace(re,' ')}
 else if(/\bsemanal(es)?|cada semana\b/i.test(s)&&!rec){o.type='weekly';o.days=[new Date().getDay()];rec=true}
 s=s.replace(/\b(cada|todos los|todas las|semanal(es)?|cada semana|y)\b/ig,function(a){return a.toLowerCase()==='y'&&!rec?a:' '});
 if(!rec){if(/\bpasado ma[ñn]ana\b/i.test(s)){o.date=iso(addD(new Date(),2));s=s.replace(/pasado ma[ñn]ana/i,' ')}else if(/\bma[ñn]ana\b/i.test(s)){o.date=iso(addD(new Date(),1));s=s.replace(/ma[ñn]ana/i,' ')}else if(/\bhoy\b/i.test(s))s=s.replace(/\bhoy\b/i,' ');
  else if(m=s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)){var y=m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):new Date().getFullYear();o.date=y+'-'+pad(+m[2])+'-'+pad(+m[1]);s=s.replace(m[0],' ')}
  else if(m=s.match(/\bel (\d{1,2})\b/i)){var t1=new Date(),dm=+m[1],dt=new Date(t1.getFullYear(),t1.getMonth(),dm);if(dt<new Date(t1.getFullYear(),t1.getMonth(),t1.getDate()))dt=new Date(t1.getFullYear(),t1.getMonth()+1,dm);o.date=iso(dt);s=s.replace(m[0],' ')}}
 s=s.replace(/\b(recordame|recordarme|recordar|recordatorio|agendar|anotar|el|los|las|a)\b\s*/ig,function(a,w,i){return i<3||/^(recordame|recordarme|recordar|recordatorio|agendar|anotar)/i.test(a)?'':a});
 o.t=s.replace(/\s+/g,' ').replace(/\s+(el|del|de|para)\s*$/i,'').replace(/^[\s,.\-–]+|[\s,.\-–]+$/g,'');o.t=o.t.charAt(0).toUpperCase()+o.t.slice(1);
 if(/\b(pagar|pago|factura|cuota|vencimiento|alquiler|sueldo)/i.test(o.t))o.cat='pago';else if(/\b(llamar|reuni[oó]n|cliente|entrega|enviar|revisar)/i.test(o.t))o.cat='trabajo';else if(/\b(m[eé]dic|gimnasio|cumple|familia|comprar)/i.test(o.t))o.cat='personal';
 if(o.type==='weekly'&&!o.days.length)o.days=[new Date().getDay()];
 if(o.type==='monthly')o.date=nextDom(o.dom,o.date);
 return o}
function qDesc(o){var a=[];if(o.type==='once')a.push(fmtD(o.date,{weekday:'short',day:'numeric',month:'short'}));else a.push(repLabel(Object.assign({},o)));a.push(o.time);if(o.mail)a.push('✉ '+o.to.map(function(id){return S.ppl.filter(function(p){return p.id===id})[0].name.split(' ')[0]}).join(', '));return a}
function qaBind(){var q=$('#qa');if(!q)return;q.addEventListener('input',function(){var o=parseQ(q.value),c=$('#qchips');if(!o||!o.t){c.innerHTML='';return}c.innerHTML='<span class="chip go">'+esc(o.t)+'</span>'+qDesc(o).map(function(x){return '<span class="chip">'+esc(x)+'</span>'}).join('')+'<span class="chip" style="background:none;color:#8d94ab">'+esc(CATS[o.cat].n)+'</span>'});
 q.addEventListener('keydown',function(e){if(e.key!=='Enter')return;var o=parseQ(q.value);if(!o||!o.t){toast('Escribí qué querés recordar');return}var r=blankR({t:o.t,cat:o.cat,type:o.type,date:o.date,time:o.time,days:o.days,dom:o.dom,dom2:o.dom2,nth:o.nth||1,dow:o.dow==null?2:o.dow,mail:o.mail,to:o.to});S.rem.push(Object.assign(r,{id:uid()}));save();render();toast('Agregado: '+o.t)})}
function after(){qaBind();finAfter();var nq=$('#nq');if(nq)nq.addEventListener('input',function(){Q=nq.value;var p=nq.selectionStart;render();var n2=$('#nq');n2.focus();n2.setSelectionRange(p,p)});
 $$('.stin').forEach(function(i){i.addEventListener('keydown',function(e){if(e.key!=='Enter'||!i.value.trim())return;var p=S.plans.filter(function(x){return x.id===i.dataset.p})[0];p.steps.push({id:uid(),t:i.value.trim(),done:false});save();render();var again=$$('.stin').filter(function(x){return x.dataset.p===p.id})[0];if(again)again.focus()})});
 var ids={cname:function(v){S.cfg.name=v},cmail:function(v){S.ppl.filter(function(p){return p.me})[0].email=v},clead:function(v){S.cfg.lead=+v},cdh:function(v){S.cfg.digestH=v||'07:30'}};
 Object.keys(ids).forEach(function(k){var e=$('#'+k);if(e)e.addEventListener('change',function(){ids[k](e.value);save();if(k!=='cname')render();})});
 var cd=$('#cdig');if(cd)cd.addEventListener('change',function(){S.cfg.digest=cd.checked;save();render()});
 var fv=$('#impvf');if(fv)fv.addEventListener('change',function(e){var fl=e.target.files[0];e.target.value='';if(!fl)return;var rd=new FileReader();rd.onload=function(){importVenc(rd.result)};rd.readAsText(fl)});
 var f=$('#impf');if(f)f.addEventListener('change',function(e){var fl=e.target.files[0];if(!fl)return;var r=new FileReader();r.onload=function(){try{var j=JSON.parse(r.result);if(!j.rem||!j.ppl)throw 0;S=j;S.day=S.day||{};S.done=S.done||{};['soc','bancos','prov','pagos'].forEach(function(k){S[k]=S[k]||[]});save();render();toast('Copia importada')}catch(x){toast('Ese archivo no es una copia válida')}};r.readAsText(fl)})}
/* ===== eventos globales ===== */
document.addEventListener('click',function(e){var b=e.target.closest('[data-v],[data-act]');if(!b||$('#ov').classList.contains('on')&&!$('#sh').contains(b))return;if(b.dataset.v){go(b.dataset.v);return}
 var d=b.dataset,a=d.act;
 if(a==='new')remForm(blankR(),true);else if(a==='newpay')remForm(blankR({cat:'pago',type:'weekly',days:[2,4],date:today(),time:'10:00'}),true);
 else if(a==='tog'){togKey(d.k);render()}
 else if(a==='edit'){editR(d.id)}
 else if(a==='day')dayDrawer(d.d);
 else if(a==='mprev'){CAL=new Date(CAL.getFullYear(),CAL.getMonth()-1,1);render()}else if(a==='mnext'){CAL=new Date(CAL.getFullYear(),CAL.getMonth()+1,1);render()}else if(a==='mtoday'){CAL=new Date();render()}
 else if(a==='newplan')planForm(null);else if(a==='eplan')planForm(S.plans.filter(function(x){return x.id===d.p})[0]);
 else if(a==='stog'){var p=S.plans.filter(function(x){return x.id===d.p})[0],s=p.steps.filter(function(x){return x.id===d.s})[0];s.done=!s.done;save();render()}
 else if(a==='sdel'){var p2=S.plans.filter(function(x){return x.id===d.p})[0];p2.steps=p2.steps.filter(function(x){return x.id!==d.s});save();render()}
 else if(a==='newnote')noteForm(null);else if(a==='enote')noteForm(S.notes.filter(function(x){return x.id===d.id})[0]);
 else if(a==='padd'){var n=$('#pn').value.trim(),em=$('#pe').value.trim();if(!n||!/^\S+@\S+\.\S+$/.test(em)){toast('Poné nombre y un email válido');return}S.ppl.push({id:uid(),name:n,email:em});save();render();toast('Destinatario agregado')}
 else if(a==='pdel'){if(confirm('¿Quitar este destinatario?')){S.ppl=S.ppl.filter(function(x){return x.id!==d.id});S.rem.forEach(function(r){r.to=r.to.filter(function(i){return i!==d.id})});save();render()}}
 else if(a==='mailprev'){mailPrev(outbox(7)[+d.i])}
 else if(a==='mailtest'){var me=S.ppl.filter(function(p){return p.me})[0];if(!me||!/^\S+@\S+\.\S+$/.test(me.email||'')){toast('Cargá tu email en "Vos"');return}if(!SYNC.on){toast('Hace falta la base de datos conectada');return}toast('Enviando…');syncApi('mailtest',{to:me.email}).then(function(j){if(j.status===200)toast('Mail enviado a '+me.email);else if(j.status===412)toast('Falta el archivo private/mail.php');else alert('No se pudo enviar: '+(j.detalle||j.error||j.status))})}
 else if(a==='feradd'){var fd=$('#fd').value;if(!fd){toast('Elegí la fecha');return}S.cfg.fer=S.cfg.fer||[];if(!S.cfg.fer.some(function(x){return x.d===fd})){S.cfg.fer.push({d:fd,n:$('#fn').value.trim()})}save();render();toast('Feriado agregado')}
 else if(a==='ferx'){S.cfg.fer=(S.cfg.fer||[]).filter(function(x){return x.d!==d.d});save();render()}
 else if(a==='exp'){var bl=new Blob([JSON.stringify(S)],{type:'application/json'}),an=document.createElement('a');an.href=URL.createObjectURL(bl);an.download='finish-copia.json';an.click();setTimeout(function(){URL.revokeObjectURL(an.href)},2000)}
 else if(a==='imp')$('#impf').click();else if(a==='impv')$('#impvf').click();
 else if(a==='clear'){if(confirm('¿Borrar los datos de ejemplo? Se queda vacío para que cargues los tuyos (tu nombre y destinatarios se conservan).')){var me=S.ppl.filter(function(p){return p.me})[0];S={demo:false,cfg:S.cfg,ppl:[me],rem:[],done:{},day:{},plans:[],notes:[],soc:[],bancos:[],prov:[],pagos:[]};save();render();toast('Listo, todo vacío')}}});
document.addEventListener('keydown',function(e){if(e.key==='/'&&VIEW==='hoy'&&!/input|textarea|select/i.test(document.activeElement.tagName)){var q=$('#qa');if(q){e.preventDefault();q.focus()}}});
load();dock();render();syncInit();
setInterval(function(){if(VIEW==='hoy'&&!$('#ov').classList.contains('on')&&document.activeElement.id!=='qa'){var y=$('#qa');var v=y?y.value:'';render();if(v)$('#qa').value=v}},60000);
})();
