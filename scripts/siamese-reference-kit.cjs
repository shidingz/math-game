'use strict';
// Export the real built-in artwork/CSS/SVG; no image model is used here.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..'),poses=['idle','blink','wave','pet','feed','think','sleep','jump','skill'];
const {bounds}=require('./pet-matte.cjs');
const {atomic}=require('./seedream-client.cjs');
async function build(out,{charactersOnly=true}={}){
  fs.mkdirSync(out,{recursive:true});
  const sources=['characters/siamese/siamese-data.js','characters/siamese/siamese-effects.js','game/siamese-character.js','game/game.css','game/theme.css'];
  const manifest={version:1,character:'siamese',cell:512,anchor:{x:256,y:448},files:{},sources:{},note:'Original poses are uniformly reduced per stage into fixed 512px cells; source identity is not a target identity.'};
  async function save(name,layers,width,height){const file=path.join(out,name+'.png');await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).png().toFile(file);return file;}
  const design=[],portraits=[];
  for(let stage=1;stage<=3;stage++){
    const items=[];
    for(const pose of poses){const rel=`characters/siamese/assets/stage-${stage}-${pose}.png`;sources.push(rel);const {data,info}=await sharp(path.join(root,rel)).ensureAlpha().raw().toBuffer({resolveWithObject:true});items.push({rel,box:bounds(data,info.width,info.height)});}
    const scale=Math.min(368/Math.max(...items.map(i=>i.box.width)),368/Math.max(...items.map(i=>i.box.height)));
    const layers=[],rects=[];
    for(let i=0;i<items.length;i++){
      const a=items[i],w=Math.round(a.box.width*scale),h=Math.round(a.box.height*scale),x=Math.round((512-w)/2),y=448-h;
      const input=await sharp(path.join(root,a.rel)).extract({left:a.box.x,top:a.box.y,width:a.box.width,height:a.box.height}).resize(w,h).png().toBuffer();
      layers.push({input,left:i%3*512+x,top:Math.floor(i/3)*512+y});rects.push({x,y,width:w,height:h});
      if(i===0){design.push({input,left:(stage-1)*512+x,top:y});portraits.push({input,left:(stage-1)*512+x,top:y});}
    }
    await save('stage'+stage,layers,1536,1536);
    manifest.files['stage'+stage]={file:`stage${stage}.png`,width:1536,height:1536,cols:3,rows:3,poses,rects,sources:items.map(i=>i.rel)};
    sources.push(`characters/siamese/assets/stage-${stage}-portrait.png`);
  }
  const small=await save('design-small',design,1536,512);
  await sharp(small).resize(3072,1024).png().toFile(path.join(out,'design.png'));fs.unlinkSync(small);
  manifest.files.design={file:'design.png',width:3072,height:1024,cols:3,rows:1,order:['stage1','stage2','stage3']};
  await save('portraits',portraits,1536,512);
  manifest.files.portraits={file:'portraits.png',width:1536,height:512,cols:3,rows:1,note:'Derived from the three idle poses; no separate generation needed.'};
  function finish(){
    for(const source of sources)manifest.sources[source]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,source))).digest('hex');
    for(const def of Object.values(manifest.files))def.sha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(out,def.file))).digest('hex');
    atomic(path.join(out,'manifest.json'),manifest);return manifest;
  }
  if(charactersOnly)return finish();
  // The built-in food is painted into the feeding frame, not a standalone file.
  const foodSource='characters/siamese/assets/stage-1-feed.png';
  const crop={left:112,top:379,width:233,height:108};
  const food=await sharp(path.join(root,foodSource)).extract(crop).resize(920,426).png().toBuffer();
  await save('food',[{input:food,left:308,top:555}],1536,1536);
  manifest.files.food={file:'food.png',width:1536,height:1536,cols:1,rows:1,source:foodSource,crop,note:'Food crop from the real feed pose; no separately authored food PNG exists.'};
  const box={window:{}};vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(root,sources[0]),'utf8'),box);box.SiameseGameData=box.window.SiameseGameData;
  vm.runInContext(fs.readFileSync(path.join(root,sources[1]),'utf8'),box);
  const fx=[];fs.mkdirSync(path.join(out,'levels'),{recursive:true});
  for(let level=1;level<=15;level++){
    const svg=box.window.SiameseEffects.svg(level).replace('<svg ','<svg width="960" height="680" ');
    fs.writeFileSync(path.join(out,'levels',`level-${level}.svg`),svg);
    const input=await sharp(Buffer.from(svg)).resize(432,306).png().toBuffer();
    await save('levels/level-'+level,[{input,left:40,top:102}],512,512);
    fx.push({input,left:(level-1)%3*512+40,top:Math.floor((level-1)/3)*512+102});
  }
  await save('effects',fx,1536,2560);
  manifest.files.effects={file:'effects.png',width:1536,height:2560,cols:3,rows:5,order:Array.from({length:15},(_,i)=>'Lv.'+(i+1)),anchor:{x:256,y:362},source:'characters/siamese/siamese-effects.js'};
  const {chromium}=require('playwright'),browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:512,height:512},deviceScaleFactor:3});
    const css=['game/game.css','game/theme.css'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
    await page.setContent(`<html data-scene="thai"><style>${css}\nhtml,body{margin:0!important;padding:0!important;width:512px;height:512px;overflow:hidden}.pet-scene{position:relative!important;width:512px!important;height:512px!important;min-height:512px!important;max-height:512px!important;border-radius:0!important}</style><div class="pet-scene"><div id="scene-decoration"></div><div class="halo"></div><div class="hill hill-one"></div><div class="hill hill-two"></div></div></html>`);
    await page.evaluate(()=>{window.MathPetCharacters={register:c=>window.refCharacter=c};window.MathPetGrowth={WUKONG:[]};window.SiameseGameData={stages:[],levels:[]};});
    await page.addScriptTag({content:fs.readFileSync(path.join(root,'game/siamese-character.js'),'utf8')});
    await page.evaluate(()=>{for(const [k,v] of Object.entries(refCharacter.ui.palette))document.documentElement.style.setProperty('--pet-'+k,v);refCharacter.ui.decorate(document.getElementById('scene-decoration'));});
    await page.locator('.pet-scene').screenshot({path:path.join(out,'scene.png'),animations:'disabled'});
  }finally{await browser.close();}
  manifest.files.scene={file:'scene.png',width:1536,height:1536,cols:1,rows:1,sources:['game/siamese-character.js','game/game.css','game/theme.css'],note:'Actual web CSS background with pet, UI and SVG effects omitted.'};
  return finish();
}
module.exports={build};
if(require.main===module)build(path.resolve(process.argv[2]||'artifacts/siamese-reference-kit')).then(m=>console.log('Exported real Siamese reference kit: '+Object.keys(m.files).join(', '))).catch(e=>{console.error(e);process.exitCode=1;});
