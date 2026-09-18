'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.WECHAT_REVIEW_BASE||'http://127.0.0.1:8785',out=path.resolve(process.env.WECHAT_QA_DIR||'artifacts/rabbit-alpha-20260917/rule-ui-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.goto(root+'/wechat-test/preview.html');
 await page.waitForFunction(()=>window.mathPetPreview?.view.ready);
 const report=await page.evaluate(()=>{
  const {game:g,view:v}=mathPetPreview,texts=[],draws=[],oldText=v.text,oldDraw=v.ctx.drawImage;
  v.text=function(...a){texts.push(a);return oldText.apply(this,a);};v.ctx.drawImage=function(...a){draws.push(a.slice(1));return oldDraw.apply(this,a);};
  try{v.home();}finally{v.text=oldText;v.ctx.drawImage=oldDraw;}
  return {name:g.character.name,first:g.characters[0].id,active:g.state.activePet,feed:texts.find(a=>a[0]==='喂养伙伴'),feedCenter:(()=>{const h=v.hits.find(h=>h.id==='feed');return h.x+h.w/2;})(),buttonImages:draws.filter(a=>a.length===4&&a[0]>=20&&a[0]<190&&a[1]>=v.height-132),media:[...v.media.keys()]};
 });
 assert.equal(report.name,'新伙伴');assert.equal(report.active,report.first);assert.equal(report.feed[1],report.feedCenter);assert.deepEqual(report.buttonImages,[]);
 await page.goto(root+'/review/');await page.locator('#pose').selectOption('8');
 await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
 assert.equal(await page.locator('#pose option').count(),9);assert.equal(await page.locator('.actor').count(),3);
 await page.locator('#alpha-bg').selectOption('dark');
 assert.deepEqual(errors,[]);assert.ok(requests.every(u=>u.startsWith(root+'/')),'No external/model traffic in test client');
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({...report,errors,externalRequests:0,galleryImages:await page.locator('img').count()},null,2));
 console.log('PASS: exact fixed name, newest first, plain centered feed label without icon, shared art loaded, all gallery images loaded, no external API traffic.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
