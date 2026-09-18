'use strict';
// Advance durable asynchronous image jobs once. Re-run to poll; never repeat a paid POST.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const client=require('./api302-image.cjs'),prompts=require('./pet-gpt-prompts.cjs'),converter=require('./pet-fantasy-assemble.cjs'),{atomic}=require('./seedream-client.cjs');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const args=process.argv.slice(2),get=(n,f)=>args.includes(n)?args[args.indexOf(n)+1]:f;
async function main(){
 for(const n of ['--out','--photos','--id','--name'])if(!args.includes(n))throw Error('Required --out --photos --id --name [--submit]');
 const directory=path.resolve(get('--out')),photos=get('--photos').split(',').map(p=>path.resolve(p)),id=get('--id'),name=get('--name'),live=args.includes('--submit');
 if(photos.length<1||photos.length>3||!require('../wechat/runtime/custom-pets').ID.test(id)||!name.trim()||name.length>13)throw Error('Invalid photos / pet ID / name');
 fs.mkdirSync(directory,{recursive:true});
 const lockedDesign=get('--design-image'),lockedActions=get('--action-images',',,').split(','),ruleFiles=['scripts/pet-gpt-prompts.cjs','scripts/pet-fantasy-assemble.cjs','scripts/pet-normalize.cjs','scripts/pet-matte.cjs','scripts/pet-chroma.cjs','wechat/runtime/pet-colors.js'];
 if(lockedActions.length!==3)throw Error('--action-images requires three comma-separated slots; blank means generate');
 const recipe={version:3,promptVersion:prompts.PROMPT_VERSION,provider:'302.AI',model:'gpt-image-2.5-sunburst',id,name,photos:photos.map(hash),lockedDesign:lockedDesign?hash(lockedDesign):null,lockedActions:lockedActions.map(f=>f?hash(f):null),rules:Object.fromEntries(ruleFiles.map(f=>[f,hash(path.join(__dirname,'..',f))]))};
 const recipeFile=path.join(directory,'recipe.json');
 if(fs.existsSync(recipeFile)&&JSON.stringify(JSON.parse(fs.readFileSync(recipeFile)))!==JSON.stringify(recipe))throw Error('Source or pre-generation rules changed; use a new job directory');
 atomic(recipeFile,recipe);
 const identity=path.join(directory,'identity.png'),style=path.join(directory,'style.png');
 if(!fs.existsSync(identity)){
  if(photos.length===1)await sharp(photos[0]).rotate().png().toFile(identity);
  else{const layers=[];for(let i=0;i<photos.length;i++)layers.push({input:await sharp(photos[i]).rotate().resize(768,768,{fit:'contain',background:'#fff'}).png().toBuffer(),left:i*768,top:0});await sharp({create:{width:768*photos.length,height:768,channels:4,background:'#fff'}}).composite(layers).png().toFile(identity);}
 }
 if(!fs.existsSync(style)){await require('./siamese-reference-kit.cjs').build(path.join(directory,'reference-kit'));await sharp(path.join(directory,'reference-kit/design.png')).flatten({background:'#fff'}).png().toFile(style);}
 async function advance(step,prompt,references,size){
  const dir=path.join(directory,step);const r=await client.submit({directory:dir,prompt,references,size,prepare:!live});
  if(!live)return false;
  const p=await client.poll(dir);console.log(step+': '+p.state);return p.state==='downloaded';
 }
 const design=path.join(directory,'design/image-1.png');
 if(lockedDesign){fs.mkdirSync(path.dirname(design),{recursive:true});if(!fs.existsSync(design))fs.copyFileSync(lockedDesign,design);if(hash(design)!==recipe.lockedDesign)throw Error('Locked design changed');}
 else if(!await advance('design',prompts.design(),[identity,style],'3072x1024'))return;
 const normalized=await require('./pet-normalize.cjs').normalize(design,'design');fs.writeFileSync(path.join(directory,'design/normalized.png'),normalized.bytes);atomic(path.join(directory,'design/normalization.json'),normalized.record);
 const key=await require('./pet-chroma.cjs').choose([design]),contract={contract:prompts.CONTRACT,key};
 const contractFile=path.join(directory,'contract.json');if(fs.existsSync(contractFile)&&JSON.stringify(JSON.parse(fs.readFileSync(contractFile)))!==JSON.stringify(contract))throw Error('Locked design/matte changed');atomic(contractFile,contract);
 let complete=true;
 for(let n=1;n<=3;n++){
  const file=path.join(directory,`stage-${n}-design.png`);if(!fs.existsSync(file))await sharp(normalized.bytes).extract({left:(n-1)*1024,top:0,width:1024,height:1024}).png().toFile(file);
  if(lockedActions[n-1]){
   const target=path.join(directory,`stage${n}/image-1.png`);fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target))fs.copyFileSync(lockedActions[n-1],target);
   if(hash(target)!==recipe.lockedActions[n-1])throw Error('Locked action image changed');
   await converter.stage(target,path.join(directory,'processed','stage'+n),key);
  }else if(!await advance('stage'+n,prompts.actions(n,key),[file],'1536x1536')){complete=false;if(live)return;}
 }
 if(complete){await converter.assemble({directory,id,name});atomic(path.join(directory,'pipeline-status.json'),{state:'ready-for-test',contract:prompts.CONTRACT.format,aiPostProcessing:0});console.log('ready-for-test: '+path.join(directory,'candidate'));}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
