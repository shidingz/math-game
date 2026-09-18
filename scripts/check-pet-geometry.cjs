'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),G=require('../wechat/runtime/pet-geometry');
const d=path.resolve(process.argv[2]),base=require(d+'/data/characters.js'),C=require(d+'/runtime/custom-pets.js');
const chars=[...base,...require(d+'/data/local-pets.js').map(p=>C.character(p,base[0]))];let checked=0;
for(const c of chars)for(let s=0;s<3;s++)for(const level of [s*5+1,s*5+5])for(const h of [660,820,920])for(let f=0;f<c.frames.length;f++)for(const action of ['idle','jump','skill'])for(let k=0;k<=12;k++){
 const L=G.home(h,c),p=G.fit(c,s,f,L.pet,level,action,k/12,3000),b=p.bounds;
 assert.ok(b.left>=L.scene.x&&b.right<=L.scene.x+L.scene.width&&b.top>=L.scene.y&&b.bottom<=L.scene.y+L.scene.height,c.id+' '+s+' '+f+' '+JSON.stringify(b));checked++;
}
const report={pets:chars.length,stages:3,checked,passed:true};
if(process.argv[3])fs.writeFileSync(path.resolve(process.argv[3]),JSON.stringify(report,null,2));
console.log('PASS',checked,'motion envelope checks across',chars.length,'pets');
