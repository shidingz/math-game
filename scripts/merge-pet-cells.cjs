'use strict';
// Keep untouched cells byte-for-byte in decoded pixels after model bbox edits.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const {atomic}=require('./seedream-client.cjs');
async function merge({source,edited,cells,out}){
  if(!Array.isArray(cells)||!cells.length||new Set(cells).size!==cells.length||cells.some(n=>!Number.isInteger(n)||n<1||n>9))throw Error('Cells must be unique integers 1–9');
  const a=await sharp(source).metadata(),b=await sharp(edited).metadata();
  if(a.format!=='png'||b.format!=='png'||a.width!==a.height||a.width!==b.width||a.height!==b.height)throw Error('Use equally sized square PNG nine-cell sheets');
  fs.mkdirSync(out,{recursive:true});const file=path.join(out,'image-1.png');
  if(fs.existsSync(file))throw Error('Use a new output directory');
  const layers=[];
  for(const n of cells){const x=(n-1)%3,y=Math.floor((n-1)/3),left=Math.round(x*a.width/3),top=Math.round(y*a.height/3),width=Math.round((x+1)*a.width/3)-left,height=Math.round((y+1)*a.height/3)-top;
    layers.push({input:await sharp(edited).extract({left,top,width,height}).png().toBuffer(),left,top});}
  await sharp(source).composite(layers).png().toFile(file);
  const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  atomic(path.join(out,'merge.json'),{sourceSha256:hash(source),editedSha256:hash(edited),cells,outputSha256:hash(file)});
  return file;
}
module.exports={merge};
if(require.main===module){const a=process.argv.slice(2),get=n=>a[a.indexOf(n)+1];if(!['--source','--edited','--cells','--out'].every(n=>a.includes(n)))throw Error('Required --source original.png --edited edited.png --cells 4 --out new-attempt-directory');merge({source:get('--source'),edited:get('--edited'),cells:get('--cells').split(',').map(Number),out:get('--out')}).then(console.log).catch(e=>{console.error(e.message);process.exitCode=1});}
