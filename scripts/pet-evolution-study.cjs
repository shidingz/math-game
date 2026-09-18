'use strict';
// Controlled design comparison: model × optional Siamese growth reference.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {generate,atomic}=require('./seedream-client.cjs');
const root=path.resolve(__dirname,'..');
const models={lite:'doubao-seedream-5-0-260128',pro:'doubao-seedream-5-0-pro-260628'};
function prompt(withReference,photoCount=1){return require('./pet-design-prompts.cjs').design(photoCount,withReference);}
async function reference(file){
  const layers=[];
  for(let n=1;n<=3;n++){
    const input=await sharp(path.join(root,`characters/siamese/assets/stage-${n}-idle.png`)).trim().resize(470,540,{fit:'inside'}).png().toBuffer();
    const m=await sharp(input).metadata();layers.push({input,left:(n-1)*512+Math.round((512-m.width)/2),top:590-m.height});
  }
  fs.mkdirSync(path.dirname(file),{recursive:true});
  await sharp({create:{width:1536,height:640,channels:4,background:'#ffffff'}}).composite(layers).png().toFile(file);
}
async function main(){
  const args=process.argv.slice(2),get=(n,f)=>args.includes(n)?args[args.indexOf(n)+1]:f;
  if(!args.includes('--out')||(!args.includes('--photo')&&!args.includes('--photos')))throw Error('Required --out study-directory --photos photo1.png,photo2.png [--submit]');
  const out=path.resolve(get('--out')),photos=get('--photos',get('--photo')).split(',').map(p=>path.resolve(p)),example=path.join(out,'references/siamese-growth.png');
  if(photos.length<1||photos.length>3)throw Error('Use 1–3 photos of the same subject');
  const only=get('--only');if(only&&!Object.keys(models).includes(only))throw Error('Use --only lite or pro');
  const attempt=get('--attempt','1');if(!/^[1-9][0-9]?$/.test(attempt))throw Error('Invalid attempt');
  await reference(example);
  const queue=Object.keys(models).filter(m=>!only||m===only).flatMap(model=>['none','siamese'].map(style=>({name:model+'-'+style,model:models[model],withReference:style==='siamese'})));
  const results=fs.existsSync(path.join(out,'study.json'))?JSON.parse(fs.readFileSync(path.join(out,'study.json'))):{};
  async function next(){while(queue.length){const item=queue.shift();try{results[item.name]=await generate({directory:path.join(out,item.name+(attempt==='1'?'':'-attempt-'+attempt)),prompt:prompt(item.withReference,photos.length),references:item.withReference?[...photos,example]:photos,model:item.model,size:'3072x1280',submit:args.includes('--submit')});console.log(JSON.stringify({variant:item.name,...results[item.name]}));}catch(e){results[item.name]={error:e.message};console.error(item.name+': '+e.message);}atomic(path.join(out,'study.json'),results);}}
  await Promise.all([next(),next()]);
  if(Object.values(results).some(r=>r.error))process.exitCode=1;
}
module.exports={prompt,reference,models};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
