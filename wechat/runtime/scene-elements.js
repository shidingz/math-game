'use strict';
// A finite vector vocabulary shared by all pets. No textures, model calls or
// runtime random choices. Coordinates within each painter are roughly [-1, 1].
const {hex}=require('./pet-colors');
const GROUPS=[
 ['天空气象',[['sun','太阳'],['moon','月亮'],['cloud','云朵'],['rainbow','彩虹'],['rain','雨滴'],['snow','雪花'],['lightning','闪电'],['wind','微风']]],
 ['林间植物',[['leaf','树叶'],['maple','枫叶'],['fern','蕨叶'],['bamboo','竹子'],['pine','松树'],['tree','阔叶树'],['willow','柳树'],['flower','花朵']]],
 ['花园田野',[['lotus','荷花'],['grass','草丛'],['mushroom','蘑菇'],['vine','藤蔓'],['sprout','嫩芽'],['dandelion','蒲公英'],['reed','芦苇'],['clover','三叶草']]],
 ['山川水域',[['mountain','高山'],['hills','丘陵'],['river','河流'],['waterfall','瀑布'],['lake','湖泊'],['wave','海浪'],['island','海岛'],['dune','沙丘']]],
 ['地景奇观',[['rock','岩石'],['volcano','火山'],['glacier','冰川'],['cave','洞穴'],['crystal','水晶'],['shell','贝壳'],['coral','珊瑚'],['bridge','小桥']]],
 ['宇宙星空',[['star','星星'],['planet','行星'],['galaxy','星系'],['comet','彗星'],['constellation','星座'],['nebula','星云'],['meteor','流星雨'],['aurora','极光']]],
 ['果园生活',[['apple','苹果'],['orange','橙子'],['strawberry','草莓'],['grapes','葡萄'],['peach','桃子'],['cherry','樱桃'],['kite','风筝'],['balloon','气球']]]
];
const CATALOG=GROUPS.flatMap(([group,items])=>items.map(([id,name])=>({id,name,group})));
const TAU=Math.PI*2;
function path(c,points,fill,stroke,width=.045){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(fill){c.closePath();c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function oval(c,x,y,rx,ry,fill,turn=0){c.beginPath();c.ellipse(x,y,rx,ry,turn,0,TAU);c.fillStyle=fill;c.fill();}
function line(c,points,color,width=.05){path(c,points,null,color,width);}
function arc(c,x,y,r,start,end,color,width=.06){c.beginPath();c.arc(x,y,r,start,end);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function leaf(c,x,y,s,color,angle=0){c.save();c.translate(x,y);c.rotate(angle);c.scale(s,s);c.beginPath();c.moveTo(0,.8);c.quadraticCurveTo(-.95,-.05,0,-1);c.quadraticCurveTo(.95,-.05,0,.8);c.fillStyle=color;c.fill();c.restore();}
function star(c,x,y,r,color,n=5){const pts=[];for(let i=0;i<n*2;i++){const a=i*Math.PI/n-Math.PI/2,v=i%2?r*.43:r;pts.push([x+Math.cos(a)*v,y+Math.sin(a)*v]);}path(c,pts,color);}
function cloud(c,p){oval(c,-.50,.18,.43,.25,p.cloud);oval(c,-.1,-.03,.52,.44,p.cloud);oval(c,.43,.14,.49,.31,p.cloud);oval(c,.04,.3,.86,.17,p.cloud);}
function blossom(c,p,petals=5){for(let i=0;i<petals;i++){const a=i*TAU/petals;oval(c,Math.cos(a)*.4,Math.sin(a)*.4,.37,.23,p.flower,a);}oval(c,0,0,.23,.23,p.sun);}
const PAINTERS={
 sun(c,p,t){for(let i=0;i<10;i++){const a=i*TAU/10+t*.08;line(c,[[Math.cos(a)*.76,Math.sin(a)*.76],[Math.cos(a)*.97,Math.sin(a)*.97]],p.sun,.06);}oval(c,0,0,.57,.57,p.sun);oval(c,-.14,-.13,.2,.2,p.light);},
 moon(c,p){c.beginPath();c.moveTo(.45,-.79);c.bezierCurveTo(-.72,-1.02,-1.10,.15,-.38,.76);c.bezierCurveTo(-.01,1.04,.58,.75,.79,.33);c.bezierCurveTo(-.18,.63,-.45,-.25,.45,-.79);c.closePath();c.fillStyle=p.light;c.fill();},
 cloud,
 rainbow(c,p){[p.flower,p.sun,p.leaf,p.water].forEach((col,i)=>arc(c,0,.6,.95-i*.14,Math.PI,TAU,col,.10));},
 rain(c,p){c.beginPath();c.moveTo(0,-.98);c.bezierCurveTo(-1,.23,-.58,.92,0,.92);c.bezierCurveTo(.58,.92,1,.23,0,-.98);c.fillStyle=p.water;c.fill();arc(c,-.03,.34,.3,.1,1.6,p.light,.08);},
 snow(c,p){for(let i=0;i<6;i++){const a=i*TAU/6;c.save();c.rotate(a);line(c,[[0,0],[0,-.9]],p.cloud,.07);line(c,[[-.20,-.47],[0,-.68],[.20,-.47]],p.cloud,.06);c.restore();}},
 lightning(c,p){path(c,[[.15,-1],[-.65,.18],[-.08,.18],[-.3,1],[.73,-.30],[.1,-.30]],p.sun);},
 wind(c,p,t){for(let j=0;j<3;j++){c.beginPath();c.moveTo(-.95,.38*(j-1));c.bezierCurveTo(-.35,-.22+j*.38,.2,.10+j*.25,.7,.38*(j-1));c.quadraticCurveTo(1,-.18+j*.38,.72,-.23+j*.38);c.strokeStyle=j===1?p.light:p.water;c.lineWidth=.05;c.stroke();}},
 leaf(c,p){leaf(c,0,0,.92,p.leaf,.4);line(c,[[-.42,.84],[.28,-.6]],p.light,.04);},
 maple(c,p){path(c,[[0,-1],[.22,-.43],[.66,-.68],[.54,-.11],[1,.02],[.45,.35],[.52,.69],[.05,.54],[-.22,1],[-.16,.48],[-.67,.59],[-.53,.20],[-.94,-.08],[-.41,-.14],[-.56,-.65],[-.16,-.40]],p.warm);line(c,[[0,-.68],[0,.77]],p.light,.035);},
 fern(c,p){line(c,[[0,.95],[0,-.9]],p.leaf,.05);for(let i=0;i<5;i++){const y=.57-i*.31,s=.40-i*.045;leaf(c,-s*.5,y,s,p.leaf,-.8);leaf(c,s*.5,y,s,p.land,.8);}},
 bamboo(c,p){for(const [x,y]of [[-.4,.12],[.18,-.08]]){line(c,[[x,.95],[x,-.9+y]],p.leaf,.18);for(let i=0;i<4;i++)line(c,[[x-.10,.56-i*.42],[x+.1,.56-i*.42]],p.light,.045);leaf(c,x+.28,-.42+y,.45,p.leaf,.9);leaf(c,x-.28,-.12+y,.40,p.land,-.9);}},
 pine(c,p){path(c,[[-.1,.95],[-.1,-.7],[.1,-.7],[.1,.95]],p.wood);for(let i=0;i<3;i++){const y=-.90+i*.45,w=.42+i*.21;path(c,[[0,y],[-w,y+.7],[w,y+.7]],i%2?p.leaf:p.land);}},
 tree(c,p){path(c,[[-.12,1],[-.08,-.40],[.09,-.4],[.15,1]],p.wood);oval(c,-.37,-.22,.50,.58,p.leaf);oval(c,.32,-.32,.55,.58,p.land);oval(c,-.04,-.61,.53,.42,p.leaf);line(c,[[0,.55],[-.30,-.12]],p.wood,.045);},
 willow(c,p){line(c,[[.08,1],[-.08,-.40]],p.wood,.16);for(let i=0;i<7;i++){const x=(i-3)*.22;c.beginPath();c.moveTo(0,-.73);c.quadraticCurveTo(x*1.8,-1,x,.5+Math.abs(x)*.3);c.strokeStyle=i%2?p.leaf:p.land;c.lineWidth=.13;c.stroke();}},
 flower(c,p){line(c,[[0,.9],[0,0]],p.leaf,.07);leaf(c,.17,.56,.28,p.leaf,.9);c.save();c.translate(0,-.32);c.scale(.7,.7);blossom(c,p);c.restore();},
 lotus(c,p){oval(c,0,.68,.92,.2,p.leaf);for(const [x,a]of [[-.45,-.7],[.45,.7],[0,0]])leaf(c,x,.03,.69,p.flower,a);oval(c,0,.37,.31,.1,p.sun);},
 grass(c,p){for(let i=0;i<7;i++){const x=(i-3)*.22;path(c,[[x-.08,.88],[x*.75,-.6-Math.cos(i)*.25],[x+.12,.88]],i%2?p.leaf:p.land);}},
 mushroom(c,p){path(c,[[-.2,.87],[-.12,-.18],[.18,-.18],[.3,.87]],p.light);c.beginPath();c.moveTo(-.87,-.04);c.bezierCurveTo(-.67,-1.2,.63,-1.2,.88,-.04);c.closePath();c.fillStyle=p.flower;c.fill();for(const [x,y,r]of [[-.38,-.35,.10],[.05,-.61,.13],[.40,-.25,.09]])oval(c,x,y,r,r,p.light);},
 vine(c,p){c.beginPath();c.moveTo(-.1,1);c.bezierCurveTo(.85,.36,-.85,-.4,.08,-1);c.strokeStyle=p.leaf;c.lineWidth=.055;c.stroke();for(const [x,y,a]of [[.33,.55,.8],[-.31,.18,-.9],[.21,-.25,.9],[-.25,-.68,-.8]])leaf(c,x,y,.35,p.leaf,a);},
 sprout(c,p){line(c,[[0,1],[0,-.3]],p.leaf,.08);leaf(c,-.34,-.25,.6,p.leaf,-.7);leaf(c,.33,-.42,.63,p.land,.7);},
 dandelion(c,p){line(c,[[0,1],[0,-.3]],p.leaf,.05);for(let i=0;i<12;i++){const a=i*TAU/12,x=Math.cos(a)*.66,y=-.3+Math.sin(a)*.66;line(c,[[0,-.3],[x,y]],p.cloud,.028);star(c,x,y,.13,p.cloud,4);}oval(c,0,-.3,.1,.1,p.sun);},
 reed(c,p){for(let i=0;i<3;i++){const x=(i-1)*.4;line(c,[[x,.98],[x+.08,-.8+i*.18]],p.leaf,.045);oval(c,x+.08,-.55+i*.18,.11,.36,p.wood);leaf(c,x+.18,.4,.35,p.land,.6);}},
 clover(c,p){line(c,[[0,.85],[0,-.07]],p.leaf,.07);for(let i=0;i<3;i++){const a=i*TAU/3-Math.PI/2;oval(c,Math.cos(a)*.39,Math.sin(a)*.39,.38,.38,p.leaf);}oval(c,0,0,.12,.12,p.land);},
 mountain(c,p){path(c,[[-1,.85],[-.2,-.94],[1,.85]],p.land);path(c,[[-.2,-.94],[.18,.85],[1,.85]],p.shade);path(c,[[-.49,-.35],[-.2,-.94],[.17,-.34],[-.07,-.46],[-.2,-.25],[-.34,-.45]],p.cloud);},
 hills(c,p){c.beginPath();c.moveTo(-1,1);c.lineTo(-1,.10);c.bezierCurveTo(-.4,-.8,.14,-.6,1,.28);c.lineTo(1,1);c.closePath();c.fillStyle=p.land;c.fill();c.beginPath();c.moveTo(-1,1);c.bezierCurveTo(-.4,-.12,.2,-.32,1,.6);c.lineTo(1,1);c.closePath();c.fillStyle=p.leaf;c.fill();},
 river(c,p){c.beginPath();c.moveTo(-.18,-1);c.bezierCurveTo(.85,-.3,-.9,.08,-.9,1);c.lineTo(.65,1);c.bezierCurveTo(-.5,.15,.9,-.28,.05,-1);c.closePath();c.fillStyle=p.water;c.fill();c.beginPath();c.moveTo(-.02,-.92);c.bezierCurveTo(.62,-.3,-.57,.17,-.26,.85);c.strokeStyle=p.light;c.lineWidth=.045;c.stroke();},
 waterfall(c,p){path(c,[[-1,1],[-.7,-.9],[.75,-.9],[1,1]],p.shade);path(c,[[-.42,-.87],[-.53,1],[.62,1],[.42,-.87]],p.water);for(let i=0;i<3;i++)line(c,[[i*.25-.25,-.72],[i*.28-.23,.72]],p.cloud,.045);oval(c,0,.85,.83,.18,p.light);},
 lake(c,p){oval(c,0,.30,.99,.59,p.water);for(let i=0;i<3;i++)arc(c,0,.26,.3+i*.21,.15,Math.PI-.15,p.light,.035);},
 wave(c,p,t){c.beginPath();c.moveTo(-1,.8);c.bezierCurveTo(-.65,.48,-.3,-.94,.38,-.86);c.bezierCurveTo(.94,-.86,.78,.1,.16,-.01);c.bezierCurveTo(.84,.44,.85,.64,1,.83);c.closePath();c.fillStyle=p.water;c.fill();c.beginPath();c.moveTo(-.37,-.05);c.bezierCurveTo(.01,-.89,.86,-.51,.3,-.20);c.strokeStyle=p.cloud;c.lineWidth=.12;c.stroke();},
 island(c,p){oval(c,0,.55,1,.35,p.sand);line(c,[[.1,.54],[-.12,-.7]],p.wood,.12);for(let i=0;i<5;i++)leaf(c,(i-2)*.18,-.64,.56,p.leaf,(i-2)*.65);},
 dune(c,p){c.beginPath();c.moveTo(-1,1);c.lineTo(-1,.35);c.quadraticCurveTo(-.15,-1,.36,-.4);c.quadraticCurveTo(.64,.06,1,.28);c.lineTo(1,1);c.closePath();c.fillStyle=p.sand;c.fill();path(c,[[.36,-.4],[-.08,1],[1,1],[1,.28]],p.warm);},
 rock(c,p){path(c,[[-.92,.74],[-.65,-.49],[-.05,-.86],[.71,-.50],[.96,.61],[.3,.88]],p.shade);path(c,[[-.65,-.49],[-.05,-.86],[.71,-.5],[.04,.01]],p.land);line(c,[[.04,.01],[.3,.88]],p.light,.035);},
 volcano(c,p){path(c,[[-1,.96],[-.34,-.55],[.34,-.55],[1,.96]],p.shade);path(c,[[-.34,-.55],[-.12,-.24],[.06,-.38],[.28,.08],[.34,-.55]],p.warm);oval(c,0,-.62,.3,.12,p.sun);oval(c,-.07,-.82,.17,.16,p.cloud);},
 glacier(c,p){path(c,[[-1,.85],[-.76,-.3],[-.32,-.89],[0,-.39],[.4,-.96],[.95,.85]],p.water);path(c,[[-.32,-.89],[-.05,.85],[-.76,-.3]],p.cloud);path(c,[[.4,-.96],[.5,.85],[0,-.39]],p.light);},
 cave(c,p){path(c,[[-1,1],[-.8,-.3],[-.4,-.8],[.32,-.96],[.82,-.32],[1,1]],p.land);c.beginPath();c.moveTo(-.50,1);c.bezierCurveTo(-.65,-.6,.60,-.62,.56,1);c.closePath();c.fillStyle=p.shade;c.fill();},
 crystal(c,p){path(c,[[0,-1],[-.61,-.2],[-.43,.82],[.15,1],[.65,.55],[.6,-.40]],p.water);path(c,[[0,-1],[-.11,.15],[.15,1],[.6,-.4]],p.light);line(c,[[-.61,-.2],[-.11,.15],[.65,.55]],p.cloud,.04);},
 shell(c,p){c.beginPath();c.moveTo(0,.92);c.bezierCurveTo(-1.65,-.05,-.87,-1,.01,-.86);c.bezierCurveTo(.92,-1,1.55,-.02,0,.92);c.fillStyle=p.flower;c.fill();for(let i=0;i<5;i++)line(c,[[0,.85],[(i-2)*.29,-.62+Math.abs(i-2)*.19]],p.light,.045);},
 coral(c,p){line(c,[[0,.9],[0,-.76]],p.flower,.14);for(const side of [-1,1])for(let i=0;i<2;i++){const y=.4-i*.58;line(c,[[0,y],[side*.54,y-.23],[side*.58,y-.62]],p.flower,.11);line(c,[[side*.52,y-.26],[side*.86,y-.45]],p.flower,.09);}},
 bridge(c,p){c.beginPath();c.moveTo(-1,.7);c.quadraticCurveTo(0,-.5,1,.7);c.strokeStyle=p.wood;c.lineWidth=.24;c.stroke();c.beginPath();c.moveTo(-1,.15);c.quadraticCurveTo(0,-1,1,.15);c.lineWidth=.075;c.stroke();for(let i=0;i<5;i++){const x=(i-2)*.46,y=.6*x*x-.42;line(c,[[x,y],[x,y+.51]],p.wood,.07);}},
 star(c,p){star(c,0,0,.94,p.sun);star(c,-.18,-.12,.29,p.light,4);},
 planet(c,p){oval(c,0,0,.60,.60,p.flower);c.save();c.rotate(-.42);c.beginPath();c.ellipse(0,0,.98,.27,0,0,TAU);c.strokeStyle=p.sun;c.lineWidth=.12;c.stroke();c.restore();oval(c,-.16,-.20,.15,.10,p.light,-.4);},
 galaxy(c,p,t){for(let arm=0;arm<3;arm++){c.beginPath();for(let i=0;i<35;i++){const a=i*.12+arm*TAU/3+t*.03,r=.1+i*.023;i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r*.6):c.moveTo(Math.cos(a)*r,Math.sin(a)*r*.6);}c.strokeStyle=arm===1?p.flower:p.light;c.lineWidth=.07;c.stroke();}oval(c,0,0,.2,.13,p.sun);},
 comet(c,p){path(c,[[-.86,-.83],[.65,.06],[.23,.62]],p.sun);path(c,[[-.9,-.8],[.66,.24],[.4,.51]],p.light);oval(c,.46,.36,.37,.37,p.light);},
 constellation(c,p){const pts=[[-.8,.2],[-.43,-.67],[.3,-.42],[.84,.10],[.19,.75]];line(c,pts,p.water,.04);for(const [x,y]of pts)star(c,x,y,.17,p.light,4);},
 nebula(c,p){for(let i=0;i<5;i++)oval(c,Math.cos(i*1.5)*.38,Math.sin(i*1.5)*.23,.57,.35,i%2?p.flower:p.water,i*.37);star(c,-.12,-.05,.2,p.cloud,4);star(c,.60,.22,.12,p.light,4);},
 meteor(c,p){for(let i=0;i<3;i++){const x=(i-1)*.58,y=(i-1)*.23;line(c,[[x-.45,y-.56],[x+.08,y+.24]],p.light,.04);star(c,x+.08,y+.24,.13,p.sun,4);}},
 aurora(c,p,t){for(let j=0;j<3;j++){c.beginPath();c.moveTo(-1,-.48+j*.22);c.bezierCurveTo(-.26,.55,.1,-.90,1,-.12+j*.30);c.lineTo(1,.43+j*.13);c.bezierCurveTo(.2,-.2,-.2,.93,-1,.12+j*.24);c.closePath();c.fillStyle=[p.leaf,p.water,p.flower][j];c.fill();}},
 apple(c,p){oval(c,-.28,.15,.53,.64,p.fruit);oval(c,.27,.15,.54,.64,p.fruit);line(c,[[0,-.42],[.10,-.94]],p.wood,.10);leaf(c,.29,-.66,.34,p.leaf,.9);oval(c,-.40,-.1,.11,.25,p.light,.22);},
 orange(c,p){oval(c,0,.10,.77,.77,p.sun);leaf(c,.17,-.69,.38,p.leaf,.8);for(const [x,y]of [[.36,-.09],[.47,.32],[-.1,.50]])oval(c,x,y,.035,.035,p.warm);arc(c,-.12,.02,.47,3.3,4.35,p.light,.08);},
 strawberry(c,p){c.beginPath();c.moveTo(0,.98);c.bezierCurveTo(-1.5,-.42,-.38,-1,0,-.56);c.bezierCurveTo(.53,-1,1.5,-.25,0,.98);c.fillStyle=p.fruit;c.fill();for(const [x,y]of [[-.3,-.22],[.22,-.22],[0,.1],[-.25,.3],[.22,.33],[0,.63]])oval(c,x,y,.03,.07,p.light);star(c,0,-.65,.49,p.leaf,5);},
 grapes(c,p){for(const [x,y]of [[-.39,-.4],[.34,-.4],[0,-.62],[-.48,.13],[.43,.13],[0,.07],[-.23,.55],[.2,.57],[0,.88]])oval(c,x,y,.29,.28,p.flower);leaf(c,.38,-.86,.35,p.leaf,1);},
 peach(c,p){oval(c,-.24,.12,.61,.72,p.flower);oval(c,.25,.12,.61,.72,p.warm);c.beginPath();c.moveTo(.12,-.42);c.quadraticCurveTo(-.17,.18,.04,.72);c.strokeStyle=p.flower;c.lineWidth=.045;c.stroke();leaf(c,.31,-.69,.43,p.leaf,.8);},
 cherry(c,p){c.beginPath();c.moveTo(-.5,.40);c.quadraticCurveTo(-.1,-.2,.04,-.94);c.quadraticCurveTo(.54,-.43,.48,.34);c.strokeStyle=p.leaf;c.lineWidth=.065;c.stroke();oval(c,-.48,.47,.41,.43,p.fruit);oval(c,.45,.47,.42,.43,p.fruit);oval(c,-.6,.29,.09,.1,p.light);leaf(c,.25,-.67,.37,p.leaf,.9);},
 kite(c,p){path(c,[[0,-1],[-.62,-.20],[0,.45],[.65,-.2]],p.flower);path(c,[[0,-1],[0,.45],[.65,-.2]],p.sun);c.beginPath();c.moveTo(0,.45);c.bezierCurveTo(-.5,.64,.5,.83,-.2,1);c.strokeStyle=p.wood;c.lineWidth=.035;c.stroke();},
 balloon(c,p){oval(c,0,-.26,.61,.75,p.flower);path(c,[[0,.43],[-.12,.63],[.13,.63]],p.flower);c.beginPath();c.moveTo(0,.61);c.bezierCurveTo(-.33,.7,.35,.89,-.1,1);c.strokeStyle=p.wood;c.lineWidth=.025;c.stroke();oval(c,-.23,-.47,.10,.24,p.light,.3);}
};
function paint(c,id,x,y,r,p,t=0,scaleX=1,scaleY=1,turn=0){
 if(!PAINTERS[id])throw Error('Unknown scene element: '+id);
 c.save();c.translate(x,y);c.rotate(turn);c.scale(r*scaleX,r*scaleY);c.lineCap='round';c.lineJoin='round';PAINTERS[id](c,p,t);c.restore();
}
// Themed pools, not a bag of 56 unrelated objects. Each item has a real painter
// and participates in at least one world. Unlocking layers never rerolls a world.
const THEMES=[
 {id:'forest',name:'林间微风',sky:['sun','cloud'],land:['hills','river'],sides:['tree','fern','willow','vine'],ground:['grass','mushroom','clover','rock'],float:['leaf','dandelion','wind','flower']},
 {id:'bamboo',name:'竹溪山岚',sky:['cloud','rainbow'],land:['mountain','waterfall'],sides:['bamboo','willow','reed','bridge'],ground:['lotus','lake','sprout','rock'],float:['wind','rain','leaf','dandelion']},
 {id:'orchard',name:'晴日果园',sky:['sun','cloud'],land:['hills','river'],sides:['tree','apple','orange','peach'],ground:['strawberry','grapes','cherry','clover'],float:['flower','kite','balloon','leaf']},
 {id:'coast',name:'海风小岛',sky:['sun','rainbow'],land:['island','wave'],sides:['coral','shell','reed','rock'],ground:['shell','coral','lake','grass'],float:['wind','cloud','rain','star']},
 {id:'alpine',name:'雪山极光',sky:['moon','aurora'],land:['mountain','glacier'],sides:['pine','waterfall','crystal','cave'],ground:['rock','lake','sprout','reed'],float:['snow','wind','star','crystal']},
 {id:'meadow',name:'花野漫游',sky:['sun','rainbow'],land:['hills','lake'],sides:['tree','flower','vine','bridge'],ground:['grass','clover','mushroom','sprout'],float:['dandelion','flower','kite','balloon']},
 {id:'cosmos',name:'星河梦境',sky:['planet','nebula'],land:['dune','crystal'],sides:['crystal','cave','planet','rock'],ground:['crystal','rock','star','constellation'],float:['star','comet','meteor','galaxy']},
 {id:'sunset',name:'流金山谷',sky:['sun','cloud'],land:['volcano','dune'],sides:['maple','tree','rock','cave'],ground:['grass','rock','mushroom','orange'],float:['maple','lightning','wind','comet']}
];
const MODES={forest:[148,197],bamboo:[166,203],orchard:[97,196],coast:[179,204],alpine:[194,228],meadow:[127,192],cosmos:[252,226],sunset:[28,348]};
function world(profile,force){
 const h=profile.hue,options=h<75||h>=330?['orchard','sunset','forest','meadow']:h<175?['forest','bamboo','meadow','coast']:['alpine','cosmos','coast','bamboo'];
 const id=force||options[profile.seed%options.length],theme=THEMES.find(t=>t.id===id);
 if(!theme)throw Error('Unknown world: '+id);
 const [green,blue]=MODES[id],space=id==='cosmos',warm=id==='sunset';
 const p={skyTop:space?'#626cb4':warm?'#f2bca4':hex(blue,.55,.83),skyBottom:space?'#d3c7e6':warm?'#fff1c6':'#f4f8e8',
  land:hex(green,.30,space?.70:.65),leaf:hex(green,.36,space?.61:.49),shade:hex(green+13,.22,.43),wood:hex(warm?25:40,.28,.39),
  water:hex(blue,.55,.65),cloud:space?'#f4ebff':'#fffdf1',light:'#fff7d9',sun:hex(warm?41:45,.80,.66),sand:hex(warm?32:43,.5,.78),
  flower:hex(h+340,.57,.74),fruit:hex(h<75?12:h+32,.67,.63),warm:hex(h<75?28:h+25,.65,.69)};
 return {id,name:theme.name,theme,palette:p,seed:profile.seed};
}
function recipe(w,level){
 const lv=Math.max(1,Math.min(15,Math.floor(Number(level)||1))),shift=(w.seed>>>4)%4;
 const slots=[];
 const add=(id,x,y,r,layer,at=1,sx=1,sy=1)=>{if(lv>=at)slots.push({id,x,y,r,layer,at,sx,sy});};
 const T=w.theme;
 add(T.sky[0],.19,.15,.068,'sky');add(T.sky[1],.76,.20,.11,'sky',1,1.3,.7);
 add(T.land[0],.20,.54,.47,'far',1,1.12,.62);add(T.land[0],.84,.53,.45,'far',1,1.1,.70);
 add(T.land[1],.75,.73,.35,'water',1,.9,.9);
 add(T.sides[shift],.06,.63,.16,'side');add(T.sides[(shift+1)%4],.94,.68,.17,'side');
 add(T.ground[shift],.13,.90,.065,'ground');add(T.ground[(shift+1)%4],.88,.92,.065,'ground');
 add(T.sides[(shift+2)%4],.02,.79,.12,'side',4);add(T.ground[(shift+2)%4],.80,.87,.054,'ground',6);
 add(w.id==='cosmos'?'constellation':w.id==='alpine'?'snow':'cloud',.47,.09,.08,'sky',7,1.1,.6);add(T.sides[(shift+3)%4],.98,.42,.10,'side',9);
 add(T.ground[(shift+3)%4],.04,.97,.065,'ground',11);add(T.float[(shift+2)%4],.83,.34,.04,'air',12);
 add(T.float[(shift+3)%4],.34,.23,.035,'air',14);add({forest:'rainbow',bamboo:'wind',orchard:'rainbow',coast:'wind',alpine:'aurora',meadow:'wind',cosmos:'galaxy',sunset:'meteor'}[w.id],.52,.24,.22,'sky',15,1.25,.6);
 return {world:w.id,level:lv,slots,floating:2+Math.floor((lv-1)/3),float:T.float,seed:w.seed};
}
function backdrop(c,w,x,y,width,height,level,time=0,reducedMotion=false){
 const r=recipe(w,level),p=w.palette,t=reducedMotion?0:time/1000;
 c.save();const g=c.createLinearGradient(0,y,0,y+height);g.addColorStop(0,p.skyTop);g.addColorStop(.67,p.skyBottom);g.addColorStop(1,p.land);c.fillStyle=g;c.fillRect(x,y,width,height);
 // Layer order is explicit even when later levels append newly unlocked objects.
 for(const layer of ['sky','far','water','side','ground','air']){
  if(layer==='side'){
   c.beginPath();c.moveTo(x,y+height*.82);c.bezierCurveTo(x+width*.3,y+height*.70,x+width*.62,y+height*.96,x+width,y+height*.83);c.lineTo(x+width,y+height);c.lineTo(x,y+height);c.closePath();c.fillStyle=p.land;c.globalAlpha=.64;c.fill();
  }
  for(const s of r.slots.filter(s=>s.layer===layer)){
   const phase=(w.seed%17)+s.x*8,drift=['sky','air'].includes(layer)?Math.sin(t*.22+phase)*2:0;
   c.globalAlpha=layer==='far'?.32:layer==='water'?.47:layer==='side'?.65:layer==='sky'?.77:.75;
   paint(c,s.id,x+width*s.x+drift,y+height*s.y,Math.min(width,height)*s.r,p,t,s.sx,s.sy,layer==='air'?Math.sin(t*.3+phase)*.12:0);
  }
 }
 c.globalAlpha=.12;c.fillStyle=p.shade;c.beginPath();c.ellipse(x+width/2,y+height*.95,width*.24,Math.min(12,height*.04),0,0,TAU);c.fill();c.restore();return r;
}
function floaters(c,w,{x,foot,width,height,level,time=0,reducedMotion=false}){
 const r=recipe(w,level),t=reducedMotion?0:time/1000,p=w.palette;
 c.save();
 for(let i=0;i<r.floating;i++){
  const phase=(w.seed%41)*.2+i*2.3,side=i%2?1:-1,progress=reducedMotion?.5:(t*.045+i*.18)%1;
  const xx=x+side*Math.min(width*.44,height*.5)*(1+Math.sin(t*.3+phase)*.05),yy=foot-height*(.12+progress*.80);
  c.globalAlpha=(.50+level*.018)*(reducedMotion?1:Math.sin(progress*Math.PI));
  paint(c,r.float[(i+(w.seed>>>4))%r.float.length],xx,yy,5+level*.38,p,t,1,1,Math.sin(t*.35+phase)*.3);
 }
 c.restore();
}
module.exports={CATALOG,GROUPS,PAINTERS,THEMES,paint,world,recipe,backdrop,floaters};
