'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const grid=require('./pet-alpha-grid.cjs'),prompts=require('./pet-alpha-prompts.cjs'),client=require('./api302-image.cjs');
const {atomic}=require('./seedream-client.cjs'),Presets=require('../wechat/runtime/pet-presets');
const args=process.argv.slice(2),get=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function main(){
 for(const n of ['--out','--photos'])if(!get(n))throw Error('Required --out --photos [--id] [--style samoyed|siamese] [--submit]');
 const directory=path.resolve(get('--out')),photos=get('--photos').split(',').map(p=>path.resolve(p)),name='新伙伴',live=args.includes('--submit'),stop=get('--stop-after'),styleCharacter=get('--style')||'samoyed';
 const oldRecipe=fs.existsSync(path.join(directory,'recipe.json'))?JSON.parse(fs.readFileSync(path.join(directory,'recipe.json'))):null;
 const id=get('--id')||oldRecipe?.id||'custom-'+crypto.randomBytes(12).toString('hex');
 if(get('--name')&&get('--name')!==name)throw Error('Generated pet name is fixed to 新伙伴; omit --name');
 if(photos.length<1||photos.length>3||!require('../wechat/runtime/custom-pets').ID.test(id)||!name.trim()||name.length>13)throw Error('Invalid pet inputs');
 if(stop&&!['design','stage1','stage2','stage3'].includes(stop))throw Error('Invalid stop step');
 fs.mkdirSync(directory,{recursive:true});
 const ruleFiles=['pet-alpha-grid.cjs','pet-alpha-prompts.cjs','pet-alpha-pipeline.cjs','pet-style-reference.cjs','pet-gpt-prompts.cjs','api302-image.cjs','pet-matte.cjs'];
 const recipe={version:2,provider:'302.AI',model:'gpt-image-2.5-sunburst',background:'transparent',promptVersion:prompts.PROMPT_VERSION,id,name,style:{character:styleCharacter,sha256:require('./pet-style-reference.cjs').fingerprint(styleCharacter)},photos:photos.map(hash),rules:grid.RULES,code:Object.fromEntries(ruleFiles.map(f=>[f,hash(path.join(__dirname,f))])),colorRules:hash(path.join(__dirname,'../wechat/runtime/pet-colors.js'))};
 const recipeFile=path.join(directory,'recipe.json');
 if(fs.existsSync(recipeFile)&&JSON.stringify(JSON.parse(fs.readFileSync(recipeFile)))!==JSON.stringify(recipe))throw Error('Frozen inputs or rules changed; use a new job directory');
 atomic(recipeFile,recipe);atomic(path.join(directory,'contract.json'),{format:grid.RULES.format,rules:grid.RULES,background:'transparent',aiPostProcessing:0});
 const identity=path.join(directory,'identity.png'),style=path.join(directory,'style.png');
 if(!fs.existsSync(identity)){
  if(photos.length===1)await sharp(photos[0]).rotate().png().toFile(identity);
  else {const images=[];for(let i=0;i<photos.length;i++)images.push({input:await sharp(photos[i]).rotate().resize(768,768,{fit:'contain',background:'#00000000'}).png().toBuffer(),left:i*768,top:0});await sharp({create:{width:768*photos.length,height:768,channels:4,background:'#00000000'}}).composite(images).png().toFile(identity);}
 }
 if(!fs.existsSync(style))await require('./pet-style-reference.cjs').build(styleCharacter,style);
 for(const kind of ['design','sheet'])if(!fs.existsSync(path.join(directory,kind+'-template.png')))fs.writeFileSync(path.join(directory,kind+'-template.png'),await grid.template(kind));
 async function state(value){
  const requests=fs.readdirSync(directory).filter(s=>/^(design|stage[123])(?:-attempt-\d+)?$/.test(s)&&fs.existsSync(path.join(directory,s,'status.json'))).map(step=>({step,...JSON.parse(fs.readFileSync(path.join(directory,step,'status.json')))}));
  atomic(path.join(directory,'pipeline-status.json'),{...value,format:grid.RULES.format,aiGenerationCalls:requests.filter(r=>r.startedAt).length,aiPostProcessing:0,requests:requests.map(r=>({step:r.step,state:r.state,taskId:r.taskId,startedAt:r.startedAt,completedAt:r.completedAt})),updatedAt:new Date().toISOString()});
 }
 async function advance(step,kind,prompt,references){
  const dir=path.join(directory,step),selectedFile=path.join(dir,'conversion-selection.json'),out=path.join(directory,'processed',step);
  await client.submit({directory:dir,prompt,references,size:kind==='design'?'3072x1024':'1536x1536',background:'transparent',prepare:!live});
  if(!live){await state({state:'prepared',step});return null;}
  const result=await client.poll(dir);
  if(result.state!=='downloaded'){await state({state:'pending',step});console.log(step+': pending');return null;}
  let files=fs.readdirSync(dir).filter(f=>/^response-image-\d+\.png$/.test(f)).sort((a,b)=>parseInt(a.match(/\d+/)[0])-parseInt(b.match(/\d+/)[0]));
  if(!files.length)files=['image-1.png'];
  const rejected=[];
  if(fs.existsSync(selectedFile)){
   const selected=JSON.parse(fs.readFileSync(selectedFile));
   if(hash(path.join(dir,selected.file))!==selected.sha256)throw Error('Selected candidate changed');
   const layoutFile=path.join(out,'layout-check.json');
   if(fs.existsSync(layoutFile)&&fs.existsSync(path.join(out,'atlas.png')))return {file:path.join(out,'atlas.png'),report:JSON.parse(fs.readFileSync(layoutFile))};
   files=[selected.file];
  }
  for(const file of files){
   try{
    const r=await grid.save(path.join(dir,file),out,kind);
    atomic(selectedFile,{strategy:'first-alpha-and-separation-pass',file,sha256:hash(path.join(dir,file)),returned:files.length,rejected,reviewRequired:r.report.reviewRequired});
    fs.copyFileSync(path.join(dir,file),path.join(dir,'chosen.png'));
    return r;
   }catch(e){rejected.push({file,reason:e.message});}
  }
  atomic(path.join(dir,'rejection.json'),{state:'all-candidates-rejected',rejected});
  await state({state:'layout-rejected',step,rejected});throw Error(step+': no usable alpha candidate: '+rejected.map(r=>r.reason).join('; '));
 }
 const design=await advance('design','design',prompts.design(),[path.join(directory,'design-template.png'),identity,style]);
 if(!design)return;
 if(stop==='design'){await state({state:'design-ready'});console.log('design-ready');return;}
 const stages=[];
 for(let n=1;n<=3;n++){
  const stage=await advance('stage'+n,'sheet',prompts.actions(n),[path.join(directory,'sheet-template.png'),path.join(directory,'processed/design',`cell-${n}.png`)]);
  if(!stage)return;stages.push(stage);
  if(stop==='stage'+n){await state({state:'stage'+n+'-ready'});console.log('stage'+n+'-ready');return;}
 }
 const out=path.join(directory,'candidate');fs.mkdirSync(out,{recursive:true});
 const pack={schemaVersion:1,id,name,trial:true,layout:'template-v1',cellSize:512,stages:[],portrait:'portrait.png'},samples=[],sources={};
 for(let n=1;n<=3;n++){
  fs.copyFileSync(stages[n-1].file,path.join(out,`stage-${n}.png`));sources['stage'+n]=hash(path.join(directory,`stage${n}/chosen.png`));
  pack.stages.push({image:`stage-${n}.png`,name:['初始伙伴','觉醒伙伴','守护伙伴'][n-1],bounds:stages[n-1].report.boxes});
  const idle=path.join(directory,`processed/stage${n}/frames/0.png`);await sharp(idle).resize(160,160).png().toFile(path.join(out,`portrait-${n}.png`));
  samples.push(...await sharp(idle).resize(96,96).ensureAlpha().raw().toBuffer());
 }
 sources.design=hash(path.join(directory,'design/chosen.png'));pack.procedural=Presets.matchPixels(Uint8Array.from(samples));
 pack.revision=crypto.createHash('sha256').update(JSON.stringify({sources,rules:grid.RULES,procedural:pack.procedural})).digest('hex').slice(0,16);
 fs.copyFileSync(path.join(out,'portrait-1.png'),path.join(out,'portrait.png'));
 atomic(path.join(out,'pet.json'),pack);atomic(path.join(out,'catalog.json'),['pet.json']);
 atomic(path.join(out,'quality.json'),{status:'technical-checks-passed',semanticReview:'not-performed',aiReviewCalls:0,conversion:{format:grid.RULES.format,aiCalls:0,stages:3,poses:27,alphaPreserved:true,uniformScalePerStage:true},sources,layoutReview:stages.map(s=>s.report),files:Object.fromEntries(fs.readdirSync(out).filter(f=>f.endsWith('.png')).map(f=>[f,hash(path.join(out,f))]))});
 await state({state:'ready-for-test',semanticReview:'not-performed',aiReviewCalls:0});console.log('ready-for-test: '+out);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
