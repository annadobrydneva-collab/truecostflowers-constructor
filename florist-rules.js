/*
 * TrueCostFlowers LAB — Florist Rules Engine 0.1
 * Internal, experimental score for visual 2D composition quality.
 * Evaluates silhouette, individual flower visibility, diagonal spots,
 * floristic layers and descending material. Never changes bouquet price.
 * No mandatory numeric distribution of colours, flowers or textures.
 */
(function(root){
'use strict';
var VERSION='0.3.0';
var ROLE={anthurium:'accent',ranunculus:'focal',peony:'focal',
 eucalyptus:'foliage',corylus:'branch',orchid2:'accent',dahlia2:'mass',
 amaranth2:'trailing',lisianthus:'filler',delphinium:'spike'};
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function mean(a){return a.length?a.reduce(function(s,n){return s+n;},0)/a.length:0;}
function score(n){return Math.round(clamp(n,0,100));}
function role(f,catalog){return ROLE[(catalog[f.idx]||{}).type]||'filler';}
function copyLayout(flowers){return flowers.map(function(f){return Object.assign({},f);});}
function enforceAutoDepth(flowers,catalog){
 var back=0,front=0,orchid=0;
 flowers.forEach(function(f){
  var r=role(f,catalog);
  if(r==='branch')f.depth=.12+(back++%80)*.001;
  else if(r==='spike')f.depth=.72+(back++%80)*.001;
 });
 flowers.forEach(function(f){
  var kind=(catalog[f.idx]||{}).type;
  if(kind==='orchid2')f.depth=16+(orchid++%80)*.001;
  else if(kind==='anthurium')f.depth=12+(front++%80)*.001;
 });
}
function evaluate(input){
 input=input||{};
 var flowers=Array.isArray(input.flowers)?input.flowers:[];
 var catalog=Array.isArray(input.catalog)?input.catalog:[];
 var w=Math.max(200,Number(input.width)||350);
 var h=Math.max(300,Number(input.height)||490);
 if(!flowers.length)return {overall:0,form:0,airiness:0,colorHarmony:0,roles:0,version:VERSION,suggestions:[],experimental:true};
 var entries=flowers.filter(function(f){return f&&Number.isFinite(f.x)&&Number.isFinite(f.y);}).map(function(f){
  var r=role(f,catalog),headY=f.y-70*(f.scale||1);
  return {f:f,r:r,x:f.x/w,y:headY/h,hx:f.x,hy:headY};
 });
 var faces=entries.filter(function(e){return e.r!=='branch'&&e.r!=='spike'&&e.r!=='trailing';});
 var main=faces.filter(function(e){return e.r!=='foliage';});
 if(!main.length)main=faces;
 // Form: both uneven shoulders, readable center dip, narrowing towards base.
 var form=100;
 if(input.shape==='round'){
  // Round mode rewards a dome with a curved perimeter, NOT a heart notch.
  if(main.length>=4){
   function nearest(x,y){
    var dist=2;
    main.forEach(function(e){dist=Math.min(dist,Math.hypot((e.x-x)/.34,(e.y-y)/.26));});
    return dist;
   }
   var hasContour=[[.5,.31],[.30,.42],[.70,.42],[.35,.55],[.65,.55]];
   form-=hasContour.reduce(function(sum,p){return sum+Math.min(9,nearest(p[0],p[1])*8);},0);
   form-=Math.min(22,nearest(.50,.48)*22); // circular core coverage
   form-=Math.min(20,main.filter(function(e){
    return Math.hypot((e.x-.5)/.38,(e.y-.47)/.29)>1.14;
   }).length*4);
  }
 }else if(main.length){
  function dist(targetX,targetY){
   var d=2;
   main.forEach(function(e){d=Math.min(d,Math.hypot((e.x-targetX)/.30,(e.y-targetY)/.26));});
   return d;
  }
  var coverage=clamp((main.length-2)/8,0,1);
  form-=coverage*12*(dist(.30,.245)+dist(.68,.305));
  form-=coverage*Math.min(30,main.filter(function(e){return e.x>.38&&e.x<.62&&e.y<.47;}).length*9);
  form-=Math.min(24,main.filter(function(e){return e.x<.12||e.x>.88;}).length*4);
  form-=Math.min(14,main.filter(function(e){return e.y>.55&&(e.x<.24||e.x>.76);}).length*3);
 }
 form=score(form);
 // Air: nearest neighbour distance relative to the size of the drawings.
 var packed=[];
 main.forEach(function(e,i){
  if(main.length===1){packed.push(0);return;}
  var near=Infinity,neighbor=null;
  main.forEach(function(b,j){
   if(i===j)return;
   var d=Math.hypot(e.hx-b.hx,e.hy-b.hy);
   if(d<near){near=d;neighbor=b;}
  });
  var aim=(e.f.idx===neighbor.f.idx?60:52)*((e.f.scale+neighbor.f.scale)/2||1);
  var overlap=clamp((aim-near)/aim,0,1);
  packed.push(overlap*overlap);
 });
 var airiness=score(100-90*mean(packed));
 // Colour spot structure: coherent diagonal rather than a rigid row/column.
 // There are intentionally NO colour-share or species-share percentages.
 var byType={},diagonalWarnings=0,penalty=0;
 main.forEach(function(e){(byType[e.f.idx]||(byType[e.f.idx]=[])).push(e);});
 Object.keys(byType).forEach(function(k){
  var g=byType[k];if(g.length<3)return;
  var xs=g.map(function(e){return e.x;});
  var ys=g.map(function(e){return e.y;});
  var spanX=Math.max.apply(null,xs)-Math.min.apply(null,xs);
  var spanY=Math.max.apply(null,ys)-Math.min.apply(null,ys);
  if((spanX>.15&&spanY<.045)||(spanY>.17&&spanX<.045)){penalty+=27;diagonalWarnings++;}
  else if(spanX<.045&&spanY<.055&&g.length>3)penalty+=16;
 });
 var colorHarmony=score(100-Math.min(60,penalty));
 // Plant-specific depth and shape checks.
 var roles=100;
 var anth=entries.filter(function(e){return (catalog[e.f.idx]||{}).type==='anthurium';});
 if(anth.length){
  var others=entries.filter(function(e){return (catalog[e.f.idx]||{}).type!=='anthurium';});
  if(others.some(function(o){return anth.some(function(a){return a.f.depth<=o.f.depth;});}))roles-=25;
  if(anth.length===2&&(Math.abs(anth[0].x-anth[1].x)<.025||Math.abs(anth[0].y-anth[1].y)<.035))roles-=9;
 }
 var orchids=entries.filter(function(e){return (catalog[e.f.idx]||{}).type==='orchid2';});
 if(orchids.length&&entries.some(function(e){
  return (catalog[e.f.idx]||{}).type!=='orchid2'&&orchids.some(function(o){return o.f.depth<=e.f.depth;});
 }))roles-=35;
 var branches=entries.filter(function(e){return e.r==='branch';});
 if(branches.length){
  var roots=branches.map(function(e){
   return (e.f.x-60.5*(e.f.scale||1)*Math.sin((e.f.angle||0)*Math.PI/180))/w;
  });
  if(roots.some(function(x){return x>.425&&x<.575;}))roles-=18;
  if(Math.min.apply(null,roots)<.44&&Math.max.apply(null,roots)>.56)roles-=15;
  if(entries.some(function(e){return e.r!=='branch'&&branches.some(function(b){return b.f.depth>=e.f.depth;});}))roles-=25;
 }
 var spikes=entries.filter(function(e){return e.r==='spike';});
 if(main.length&&spikes.some(function(e){return main.some(function(p){return e.f.depth>=p.f.depth;});}))roles-=12;
 var trail=entries.filter(function(e){return e.r==='trailing';});
 if(trail.length>=2&&trail.length<=3){
  var span=Math.max.apply(null,trail.map(function(e){return e.x;}))-Math.min.apply(null,trail.map(function(e){return e.x;}));
  if(span>.105||(trail.some(function(e){return e.x<.5;})&&trail.some(function(e){return e.x>.5;})))roles-=40;
 }
 if(trail.length>=3){
  roles-=Math.min(20,trail.filter(function(e){return e.y<.37;}).length*8);
  var left=trail.filter(function(e){return e.x<.5;});
  var right=trail.filter(function(e){return e.x>=.5;});
  if(left.length&&right.length&&mean(right.map(function(e){return e.y;}))<=mean(left.map(function(e){return e.y;})))roles-=8;
 }
 roles=score(roles);
 var overall=score(form*.38+airiness*.34+colorHarmony*.18+roles*.10);
 var hints=[];
 if(form<76)hints.push('Можно подчеркнуть две асимметричные вершины и центральный провал.');
 if(airiness<75)hints.push('Добавьте воздуха между крупными цветами.');
 if(diagonalWarnings)hints.push('Сместите цветовые пятна по диагонали вместо прямого ряда.');
 var types=new Set(flowers.map(function(f){return f.idx;}));
 if(types.size>=3&&flowers.length>=8&&!entries.some(function(e){return e.r==='foliage';}))
  hints.push('Для фактуры можно добавить немного зелени, но это необязательно.');
 return {overall:overall,form:form,airiness:airiness,
  colorHarmony:colorHarmony,roles:roles,version:VERSION,
  suggestions:hints,experimental:true};
}
root.TCFFloristRules={version:VERSION,evaluate:evaluate,
 enforceAutoDepth:enforceAutoDepth,copyLayout:copyLayout};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
