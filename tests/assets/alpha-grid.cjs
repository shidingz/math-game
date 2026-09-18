'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),sharp=require('sharp'),fs=require('fs'),os=require('os'),path=require('path');
const {template,extract,save,RULES}=require('../../scripts/pet-alpha-grid.cjs');
async function fixture({opaque=false,overlap=false,drift=true}={}){
 const size=1536,xx=drift?[0,550,1010,1536]:[0,512,1024,1536],yy=drift?[0,530,1060,1536]:[0,512,1024,1536];let content=opaque?'<rect width="100%" height="100%" fill="white"/>':'';
 for(const x of xx)content+=`<path d="M${Math.max(2,Math.min(1534,x))} 0V1536" stroke="#111" stroke-width="4"/>`;
 for(const y of yy)content+=`<path d="M0 ${Math.max(2,Math.min(1534,y))}H1536" stroke="#111" stroke-width="4"/>`;
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
  const cx=(xx[col]+xx[col+1])/2,cy=(yy[row]+yy[row+1])/2;
  content+=`<rect x="${cx-90}" y="${cy-120}" width="180" height="240" rx="24" fill="${['#00b020','#202020','#ffffff'][col]}"/><ellipse cx="${cx}" cy="${cy-110}" rx="65" ry="42" fill="#f8b546"/><circle cx="${cx+95}" cy="${cy-100}" r="15" fill="#a050ff" fill-opacity=".5"/>`;
 }
 if(drift)content+='<path d="M345 270 Q420 230 530 270" fill="none" stroke="#00b020" stroke-width="18"/>';
 if(overlap)content+='<rect x="240" y="80" width="620" height="180" fill="#ee9955"/>';
 content+='<rect x="15" y="15" width="200" height="30" fill="red" fill-opacity=".004"/>';
 return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${content}</svg>`)).png().toBuffer();
}
test('alpha templates contain real transparency, correct divisions and no painted checkerboard',async()=>{
 for(const kind of ['design','sheet']){const b=await template(kind),m=await sharp(b).metadata(),{data}=await sharp(b).raw().toBuffer({resolveWithObject:true});assert.equal(m.hasAlpha,true);assert.equal(m.width,RULES[kind].width);let transparent=0;for(let i=3;i<data.length;i+=4)if(data[i]===0)transparent++;assert.ok(transparent/(m.width*m.height)>.97);}
});
test('drifted rules, near-transparent colour noise, green/black/white subjects and detached alpha details survive',async()=>{
 const input=await fixture(),r=await extract(input,'sheet');assert.equal(r.cells.length,9);assert.ok(r.report.nearZeroAlphaCleared>0);assert.ok(r.report.lines.length>=6);
 assert.ok(r.report.columnDivisionsByRow[0].cuts[1]>535,'a tail crossing the nominal cut must be kept');
 for(let i=0;i<9;i++){const {data}=await sharp(r.cells[i].png).raw().toBuffer({resolveWithObject:true});let green=0,white=0,black=0,semi=0;for(let p=0;p<data.length;p+=4){if(data[p+3]>200&&data[p+1]>140&&data[p]<40)green++;if(data[p+3]>200&&data[p]>245&&data[p+1]>245)white++;if(data[p+3]>200&&data[p]<45&&data[p+1]<45)black++;if(data[p+3]>80&&data[p+3]<180)semi++;}assert.ok(semi>100);assert.ok([green,black,white][i%3]>20000);}
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-fixture-'));try{const saved=await save(input,tmp,'sheet');assert.equal(saved.report.boxes.length,9);for(const b of saved.report.boxes){assert.ok(b.x>=48&&b.y>=48&&b.x+b.width<=464&&b.y+b.height<=448);}assert.equal((await sharp(saved.file).metadata()).hasAlpha,true);}finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('opaque checkerboards/flat backgrounds and overlapping bodies are rejected rather than invented or blindly cut',async()=>{
 await assert.rejects(extract(await fixture({opaque:true}),'sheet'),/Missing usable alpha/);
 await assert.rejects(extract(await fixture({overlap:true}),'sheet'),/No transparent gap/);
});
