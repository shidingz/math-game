'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),sharp=require('sharp');
const g=require('../../scripts/pet-layout-guide.cjs'),p=require('../../scripts/pet-guided-prompts.cjs');
async function artwork(kind,key='green'){
 const s=g.LAYOUT[kind],svg=g.windows(kind).map((r,i)=>{
  const w=i%3===0?r.width-100:i%3===1?150:230,h=i%3===0?180:r.height-100;
  return `<rect x="${r.left+(r.width-w)/2}" y="${r.top+(r.height-h)/2}" width="${w}" height="${h}" rx="20" fill="${key==='blue'?'#22c044':'#df6532'}"/>`;
 }).join('');
 return sharp(await g.template(kind,key)).composite([{input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s.cell*s.cols}" height="${s.cell*s.rows}">${svg}</svg>`)}]).png().toBuffer();
}
test('guided fixed windows remove only gutters and accept varied silhouettes at either supported resolution',async()=>{
 const source=await artwork('design'),r=await g.clean(source,'design');assert.equal(r.cells.length,3);assert.equal(r.report.aiPostProcessing,0);
 assert.ok(r.report.metrics.every(m=>Object.values(m.margins).every(n=>n>=1)));assert.equal(r.report.gutterMismatchFraction,0);assert.equal(r.report.modelAddsFinalPadding,false);
 const original=await sharp(source).extract(g.windows('design')[1]).raw().toBuffer(),clean=await sharp(r.bytes).extract(g.windows('design')[1]).raw().toBuffer();assert.deepEqual(clean,original,'window content is not repainted or rescaled');
 const low=await sharp(source).resize(2172,724).png().toBuffer(),normalized=await g.clean(low,'design');assert.equal(normalized.report.normalization.target.width,3072);
 const pixel=await sharp(r.bytes).extract({left:1024,top:0,width:1,height:1}).raw().toBuffer();assert.deepEqual([...pixel],[255,255,255,255]);
});
test('blank windows and shifted guides reject; inner frame contact is flagged without cropping foreground',async()=>{
 const blank=await g.template('design');await assert.rejects(()=>g.clean(blank,'design'),/Empty guide window/);
 const valid=await artwork('design');
 const crossing=await sharp(valid).composite([{input:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="3072" height="1024"><rect x="120" y="350" width="250" height="120" fill="#666666"/></svg>')}]).png().toBuffer();
 const crossed=await g.clean(crossing,'design');assert.equal(crossed.report.metrics[0].edgeReview,true);
 const kept=await sharp(crossed.cells[0]).extract({left:125,top:360,width:1,height:1}).raw().toBuffer();assert.deepEqual([...kept],[102,102,102,255]);
 const shifted=await sharp(valid).extract({left:25,top:0,width:3047,height:1024}).extend({left:0,right:25,top:0,bottom:0,background:'#D1D5DB'}).png().toBuffer();
 await assert.rejects(()=>g.clean(shifted,'design'),/gutters/);
});
test('only known background within the fixed outer 3px rim is accepted; foreground and wider shifts are rejected',async()=>{
 const valid=await artwork('sheet'),windows=g.windows('sheet');
 const overlay=fill=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1536">${windows.map(r=>`<rect x="${r.left-3}" y="${r.top-3}" width="${r.width+6}" height="3" fill="${fill}"/><rect x="${r.left-3}" y="${r.top}" width="3" height="${r.height}" fill="${fill}"/>`).join('')}</svg>`);
 const bleed=await sharp(valid).composite([{input:overlay('#00ff00')}]).png().toBuffer();await g.clean(bleed,'sheet');
 const foreground=await sharp(valid).composite([{input:overlay('#d07025')}]).png().toBuffer();await assert.rejects(()=>g.clean(foreground,'sheet'),/gutters/);
});
test('nine guided action windows retain a chroma background compatible with the fixed atlas converter',async()=>{
 const r=await g.clean(await artwork('sheet','blue'),'sheet','blue');assert.equal(r.cells.length,9);assert.ok(r.report.metrics.every(m=>Object.values(m.margins).every(n=>n>=1)));
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),out=fs.mkdtempSync(path.join(os.tmpdir(),'guided-atlas-'));
 try{const file=path.join(out,'sheet.png');fs.writeFileSync(file,r.bytes);const a=await require('../../scripts/pet-fantasy-assemble.cjs').stage(file,path.join(out,'stage'),'blue');assert.equal(a.boxes.length,9);}finally{fs.rmSync(out,{recursive:true,force:true});}
 const design=p.design();assert.match(design,/图1是需要填画的画布/);assert.match(design,/当图2是插画/);assert.match(design,/图3仅参考/);assert.doesNotMatch(design,/无格线、文字、编号、水印、边框/);
 assert.match(p.actions(2,'blue'),/图2是第2阶段唯一身份定稿/);assert.match(p.actions(2,'blue'),/#0000FF/);assert.match(p.design(),/无需估算像素/);
});
test('inner-frame edge contact is flagged for visual review instead of deleting possible toes or skill effects',async()=>{
 const valid=await artwork('sheet'),windows=g.windows('sheet');
 const touch=async index=>{const r=windows[index];return sharp(valid).composite([{input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1536"><rect x="${r.left+r.width-90}" y="${r.top+150}" width="90" height="40" fill="#d96530"/></svg>`)}]).png().toBuffer();};
 const skill=await g.clean(await touch(8),'sheet');assert.equal(skill.report.metrics[8].edgeReview,true);
 const idle=await g.clean(await touch(0),'sheet');assert.equal(idle.report.metrics[0].edgeReview,true);
});
test('small gray divider drift is harmless without moving crop windows',async()=>{
 const valid=await artwork('sheet');
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1536"><path d="M512 0V1536M1024 0V1536M0 512H1536M0 1024H1536" stroke="#D1D5DB" stroke-width="8"/><path d="M518 0V1536M1030 0V1536M0 518H1536M0 1030H1536" stroke="#4B5563" stroke-width="4"/></svg>';
 const shifted=await sharp(valid).composite([{input:Buffer.from(svg)}]).png().toBuffer();const a=await g.clean(valid,'sheet'),b=await g.clean(shifted,'sheet');assert.deepEqual(a.bytes,b.bytes);
});
test('edge-connected gray template bleed is removed without crossing chroma or accepting deep gray ambiguity',async()=>{
 const valid=await artwork('sheet');
 const bands=depth=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1536">${g.windows('sheet').map(r=>`<rect x="${r.left}" y="${r.top}" width="${r.width}" height="${depth}" fill="#D1D5DB"/>`).join('')}</svg>`);
 const clean=await g.clean(valid,'sheet'),bleed=await g.clean(await sharp(valid).composite([{input:bands(6)}]).png().toBuffer(),'sheet');assert.deepEqual(bleed.bytes,clean.bytes);assert.ok(bleed.report.metrics.every(m=>m.auxiliaryBackgroundPixels>0));
 const bad=await sharp(valid).composite([{input:bands(20)}]).png().toBuffer();await assert.rejects(()=>g.clean(bad,'sheet'),/Ambiguous gray content/);
});
