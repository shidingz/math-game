'use strict';
// Isolated format experiment; does not change the production generator or game.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const guide=require('./pet-layout-guide.cjs'),prompts=require('./pet-guided-prompts.cjs'),client=require('./api302-image.cjs'),{atomic}=require('./seedream-client.cjs');
const args=process.argv.slice(2),get=n=>args[args.indexOf(n)+1],hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function main(){
 if(!args.includes('--out')||!args.includes('--photos'))throw Error('Use --out DIR --photos FILE[,FILE] [--submit] [--check]');
 const out=path.resolve(get('--out')),photos=get('--photos').split(',').map(p=>path.resolve(p));if(photos.length<1||photos.length>3)throw Error('Use 1–3 photos');
 fs.mkdirSync(out,{recursive:true});
 const files=['pet-layout-guide.cjs','pet-guided-prompts.cjs','pet-guided-study.cjs','pet-gpt-prompts.cjs','pet-normalize.cjs','pet-matte.cjs','pet-chroma.cjs'];
 const recipe={version:1,promptVersion:prompts.PROMPT_VERSION,model:'gpt-image-2.5-sunburst',photos:photos.map(hash),layout:guide.LAYOUT,rules:Object.fromEntries(files.map(f=>[f,hash(path.join(__dirname,f))]))};
 const file=path.join(out,'recipe.json');if(fs.existsSync(file)&&JSON.stringify(JSON.parse(fs.readFileSync(file)))!==JSON.stringify(recipe))throw Error('Frozen rules changed; use a new experiment directory');atomic(file,recipe);
 const identity=path.join(out,'identity.png'),style=path.join(out,'style.png'),template=path.join(out,'design-template.png');
 if(!fs.existsSync(identity)){
  if(photos.length===1)await sharp(photos[0]).rotate().png().toFile(identity);
  else{const layers=[];for(let i=0;i<photos.length;i++)layers.push({input:await sharp(photos[i]).rotate().resize(768,768,{fit:'contain',background:'#fff'}).png().toBuffer(),left:i*768,top:0});await sharp({create:{width:photos.length*768,height:768,channels:4,background:'#fff'}}).composite(layers).png().toFile(identity);}
 }
 if(!fs.existsSync(style)){await require('./siamese-reference-kit.cjs').build(path.join(out,'references'));await sharp(path.join(out,'references/design.png')).flatten({background:'#fff'}).png().toFile(style);}
 fs.writeFileSync(template,await guide.template('design'));fs.writeFileSync(path.join(out,'action-template.png'),await guide.template('sheet'));
 fs.writeFileSync(path.join(out,'action-prompt-example.txt'),prompts.actions(1));
 const job=path.join(out,'design');
 if(args.includes('--check')){
  try{const report=await guide.save(path.join(job,'image-1.png'),path.join(out,'checked'),'design');atomic(path.join(out,'result.json'),{state:'layout-passed-needs-art-review',...report});console.log(JSON.stringify(report));}
  catch(e){atomic(path.join(out,'result.json'),{state:'layout-rejected',message:e.message});throw e;}return;
 }
 const r=await client.submit({directory:job,prompt:prompts.design(),references:[template,identity,style],size:'3072x1024',prepare:!args.includes('--submit')});
 if(args.includes('--submit'))console.log(JSON.stringify(await client.poll(job)));else console.log(JSON.stringify(r));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
