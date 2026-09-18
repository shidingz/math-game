'use strict';
// Full guided production pipeline: fixed windows -> completeness check -> fixed padding.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const guide=require('./pet-layout-guide.cjs'),prompts=require('./pet-guided-prompts.cjs'),client=require('./api302-image.cjs'),converter=require('./pet-fantasy-assemble.cjs'),{atomic}=require('./seedream-client.cjs');
const args=process.argv.slice(2),get=(n,f)=>args.includes(n)?args[args.indexOf(n)+1]:f,hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function main(){
 for(const n of ['--out','--photos','--id','--name'])if(!args.includes(n))throw Error('Required --out --photos --id --name [--submit]');
 const directory=path.resolve(get('--out')),photos=get('--photos').split(',').map(p=>path.resolve(p)),id=get('--id'),name=get('--name'),live=args.includes('--submit'),stopAfter=get('--stop-after');
 const suppliedDesign=get('--design-image')?path.resolve(get('--design-image')):null;
 const suppliedActions=get('--action-images')?get('--action-images').split(',').map(f=>f?path.resolve(f):null):[null,null,null];
 if(suppliedActions.length!==3)throw Error('--action-images needs three comma-separated positions; empty positions generate new images');
 if(stopAfter&&!['design','stage1','stage2','stage3'].includes(stopAfter))throw Error('Invalid --stop-after');
 if(photos.length<1||photos.length>3||!require('../wechat/runtime/custom-pets').ID.test(id)||!name.trim()||name.length>13)throw Error('Invalid photos / pet ID / name');
 fs.mkdirSync(directory,{recursive:true});
 const ruleFiles=['scripts/pet-layout-guide.cjs','scripts/pet-guided-prompts.cjs','scripts/pet-guided-pipeline.cjs','scripts/pet-gpt-prompts.cjs','scripts/pet-fantasy-assemble.cjs','scripts/pet-normalize.cjs','scripts/pet-matte.cjs','scripts/pet-chroma.cjs','wechat/runtime/pet-colors.js'];
 const recipe={version:1,promptVersion:prompts.PROMPT_VERSION,provider:'302.AI',model:'gpt-image-2.5-sunburst',id,name,photos:photos.map(hash),designSource:suppliedDesign?hash(suppliedDesign):null,actionSources:suppliedActions.map(f=>f?hash(f):null),layout:guide.LAYOUT,rules:Object.fromEntries(ruleFiles.map(f=>[f,hash(path.join(__dirname,'..',f))]))};
 const recipeFile=path.join(directory,'recipe.json');if(fs.existsSync(recipeFile)&&JSON.stringify(JSON.parse(fs.readFileSync(recipeFile)))!==JSON.stringify(recipe))throw Error('Source or pre-generation rules changed; use a new job directory');atomic(recipeFile,recipe);
 const identity=path.join(directory,'identity.png'),style=path.join(directory,'style.png'),designTemplate=path.join(directory,'design-template.png');
 if(!fs.existsSync(identity)){
  if(photos.length===1)await sharp(photos[0]).rotate().png().toFile(identity);
  else{const layers=[];for(let i=0;i<photos.length;i++)layers.push({input:await sharp(photos[i]).rotate().resize(768,768,{fit:'contain',background:'#fff'}).png().toBuffer(),left:i*768,top:0});await sharp({create:{width:768*photos.length,height:768,channels:4,background:'#fff'}}).composite(layers).png().toFile(identity);}
 }
 if(!fs.existsSync(style)){await require('./siamese-reference-kit.cjs').build(path.join(directory,'reference-kit'));await sharp(path.join(directory,'reference-kit/design.png')).flatten({background:'#fff'}).png().toFile(style);}
 if(!fs.existsSync(designTemplate))fs.writeFileSync(designTemplate,await guide.template('design'));
 async function advance(step,prompt,references,size){
  const dir=path.join(directory,step);await client.submit({directory:dir,prompt,references,size,prepare:!live});if(!live)return false;
  const r=await client.poll(dir);console.log(step+': '+r.state);return r.state==='downloaded';
 }
 if(suppliedDesign){
  const dir=path.join(directory,'design'),file=path.join(dir,'image-1.png');fs.mkdirSync(dir,{recursive:true});
  if(fs.existsSync(file)&&hash(file)!==recipe.designSource)throw Error('Imported design changed');
  if(!fs.existsSync(file))fs.copyFileSync(suppliedDesign,file);
  atomic(path.join(dir,'source.json'),{type:'supplied-design',sha256:recipe.designSource,aiCalls:0});
  fs.writeFileSync(path.join(dir,'prompt.txt'),'此任务复用已完成设定图，没有提交设计生图请求；来源哈希见 source.json。\n');
 }else if(!await advance('design',prompts.design(),[designTemplate,identity,style],'3072x1024'))return;
 const designClean=path.join(directory,'design-clean');await guide.save(path.join(directory,'design/image-1.png'),designClean,'design');
 const designFile=path.join(designClean,'clean.png'),designCells=[1,2,3].map(n=>path.join(designClean,`cell-${n}.png`));
 const key=await require('./pet-chroma.cjs').choose(designCells),actionTemplate=path.join(directory,'action-template.png');
 if(!fs.existsSync(actionTemplate))fs.writeFileSync(actionTemplate,await guide.template('sheet',key));
 const contract={contract:require('./pet-gpt-prompts.cjs').CONTRACT,key,layout:guide.LAYOUT};
 const contractFile=path.join(directory,'contract.json');if(fs.existsSync(contractFile)&&JSON.stringify(JSON.parse(fs.readFileSync(contractFile)))!==JSON.stringify(contract))throw Error('Locked design/layout changed');atomic(contractFile,contract);
 if(stopAfter==='design'){atomic(path.join(directory,'pipeline-status.json'),{state:'design-ready-for-review',layout:guide.LAYOUT.format});return;}
 const actionFiles=[];
 for(let n=1;n<=3;n++){
  if(suppliedActions[n-1]){
   const dir=path.join(directory,'stage'+n),file=path.join(dir,'image-1.png');fs.mkdirSync(dir,{recursive:true});
   if(fs.existsSync(file)&&hash(file)!==recipe.actionSources[n-1])throw Error('Imported action sheet changed');
   if(!fs.existsSync(file))fs.copyFileSync(suppliedActions[n-1],file);
   atomic(path.join(dir,'source.json'),{type:'supplied-guided-actions',sha256:recipe.actionSources[n-1],aiCalls:0});
   fs.writeFileSync(path.join(dir,'prompt.txt'),'此阶段复用已有引导模板动作图，没有重新提交生图请求；来源哈希见 source.json。\n');
  }else if(!await advance('stage'+n,prompts.actions(n,key),[actionTemplate,designCells[n-1]],'1536x1536'))return;
  const cleaned=path.join(directory,'stage'+n+'-clean');await guide.save(path.join(directory,`stage${n}/image-1.png`),cleaned,'sheet',key);
  const file=path.join(cleaned,'clean.png');actionFiles.push(file);await converter.stage(file,path.join(directory,'processed','stage'+n),key);
  if(stopAfter==='stage'+n){atomic(path.join(directory,'pipeline-status.json'),{state:'stage'+n+'-ready-for-review',layout:guide.LAYOUT.format});return;}
 }
 const report=await converter.assemble({directory,id,name,designFile,actionFiles});
 report.layoutReview=[1,2,3].map(stage=>({stage,...JSON.parse(fs.readFileSync(path.join(directory,`stage${stage}-clean/layout-check.json`)))}));
 atomic(path.join(directory,'candidate/quality.json'),report);
 const requests=fs.readdirSync(directory,{withFileTypes:true}).filter(d=>d.isDirectory()&&fs.existsSync(path.join(directory,d.name,'status.json'))).map(d=>({step:d.name,...JSON.parse(fs.readFileSync(path.join(directory,d.name,'status.json')))}));
 atomic(path.join(directory,'pipeline-status.json'),{state:'ready-for-test',contract:contract.contract.format,layout:guide.LAYOUT.format,aiGenerationCalls:requests.length,aiPostProcessing:0,visualReview:report.status,requests:requests.map(r=>({step:r.step,state:r.state,taskId:r.taskId}))});
 console.log('ready-for-test: '+path.join(directory,'candidate'));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
