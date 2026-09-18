'use strict';
// Four model outputs only; all remaining presentation is shared procedural code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const {generate,atomic}=require('./seedream-client.cjs'),prompts=require('./pet-template-prompts.cjs');
const converter=require('./pet-template-assemble.cjs');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const args=process.argv.slice(2),get=(n,f)=>args.includes(n)?args[args.indexOf(n)+1]:f;
async function main(){
  for(const n of ['--out','--photos','--id','--name'])if(!args.includes(n))throw Error('Required --out directory --photos photo1.png[,photo2.png] --id custom-… --name name [--submit]');
  const directory=path.resolve(get('--out')),photos=get('--photos').split(',').map(p=>path.resolve(p)),id=get('--id'),name=get('--name');
  if(photos.length<1||photos.length>3)throw Error('Use 1–3 photos of the same subject');
  if(!require('../wechat/runtime/custom-pets').ID.test(id)||!name.trim()||name.length>13)throw Error('Invalid pet ID/name');
  const reference=path.join(directory,'reference-kit');
  if(!fs.existsSync(path.join(reference,'manifest.json')))await require('./siamese-reference-kit.cjs').build(reference);
  const manifest=JSON.parse(fs.readFileSync(path.join(reference,'manifest.json')));
  for(const item of Object.values(manifest.files))if(hash(path.join(reference,item.file))!==item.sha256)throw Error('Reference changed; use a new job folder');
  const recipe={version:1,mode:'siamese-template-procedural-v1',model:get('--model','doubao-seedream-5-0-pro-260628'),id,name,photoHashes:photos.map(hash),referenceHash:hash(path.join(reference,'manifest.json')),matte:'green'};
  const recipeFile=path.join(directory,'recipe.json');
  if(fs.existsSync(recipeFile)&&JSON.stringify(JSON.parse(fs.readFileSync(recipeFile)))!==JSON.stringify(recipe))throw Error('Job inputs changed; use a new job folder');
  atomic(recipeFile,recipe);
  const selection={},previous=fs.existsSync(path.join(directory,'selection.json'))?JSON.parse(fs.readFileSync(path.join(directory,'selection.json'))):{};
  for(const step of ['design','stage1','stage2','stage3']){
    const spec=manifest.files[step];let prompt,refs;
    if(step==='design'){prompt=prompts.design(photos.length);refs=[...photos,path.join(reference,spec.file)];}
    else{
      const n=Number(step.slice(-1)),designFile=path.join(directory,selection.design),file=path.join(directory,`stage-${n}-design.png`);
      await sharp(designFile).extract({left:(n-1)*1024,top:0,width:1024,height:1024}).png().toFile(file);
      prompt=prompts.actions(n);refs=[file,path.join(reference,spec.file)];
    }
    // Flatten only reference transparency onto the exact requested key colour.
    if(step!=='design'){
      const flat=path.join(reference,step+'-key.png');await sharp(refs[1]).flatten({background:'#00FF00'}).png().toFile(flat);refs[1]=flat;
    }else{
      const flat=path.join(reference,'design-white.png');await sharp(refs[refs.length-1]).flatten({background:'#ffffff'}).png().toFile(flat);refs[refs.length-1]=flat;
    }
    let passed=false;
    if(previous[step]&&!new RegExp('^'+step+'(?:-attempt-2)?/image-1\\.png$').test(previous[step]))throw Error('Invalid saved selection');
    const attempts=previous[step]?[previous[step].includes('-attempt-2')?2:1]:[1,2];
    for(const attempt of attempts){
      const folder=step+(attempt===1?'':'-attempt-'+attempt);
      atomic(path.join(directory,'pipeline-status.json'),{state:'processing',step,attempt});
      const result=await generate({directory:path.join(directory,folder),prompt:prompt+(attempt>1?'\n严格修正：留白和格子分界必须保持模板位置，缩小越界主体；只允许指定画布尺寸。':''),references:refs,size:`${spec.width}x${spec.height}`,model:recipe.model,submit:args.includes('--submit')});
      if(!args.includes('--submit'))return;
      const image=result.outputs[0],meta=await sharp(image).metadata();
      try{
        if(meta.width!==spec.width||meta.height!==spec.height)throw Error('Output dimensions differ from the template');
        if(step!=='design')await converter.stage(image,path.join(directory,'processed',step),spec);
        selection[step]=folder+'/image-1.png';passed=true;break;
      }catch(e){if(e.code||/Cannot find module|is not a function/i.test(e.message))throw e;atomic(path.join(directory,folder,'geometry-failure.json'),{error:e.message});console.log('Fixed template check failed: '+e.message);}
    }
    if(!passed)throw Error('Two attempts failed the fixed template checks: '+step);
    atomic(path.join(directory,'selection.json'),selection);
  }
  const result=await converter.assemble({directory,id,name,selection});
  const modelRequests=fs.readdirSync(directory).filter(f=>fs.existsSync(path.join(directory,f,'status.json'))).length;
  atomic(path.join(directory,'pipeline-status.json'),{state:'ready-for-test',conversion:result.conversion,modelRequests});
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
