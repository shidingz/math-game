'use strict';
// Bounded job runner: resumes saved task IDs; only a confirmed 429/5xx terminal
// task is eligible for one replacement POST per step. Unknown POST results stop.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const args=process.argv.slice(2),dir=path.resolve(args[args.indexOf('--out')+1]||'');
if(!args.includes('--out')||!args.includes('--photos'))throw Error('Required --out and --photos');
fs.mkdirSync(dir,{recursive:true});
async function main(){
 for(let round=0;round<60;round++){
  const r=spawnSync(process.execPath,[path.join(__dirname,'pet-alpha-pipeline.cjs'),...args,'--submit'],{encoding:'utf8',timeout:300000});
  const message=(r.stdout||'')+(r.stderr||'');process.stdout.write(message);
  fs.appendFileSync(path.join(dir,'runner-events.jsonl'),JSON.stringify({at:new Date().toISOString(),round,exit:r.status,message})+'\n');
  const f=path.join(dir,'pipeline-status.json'),state=fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):{};
  if(r.status===0&&state.state==='ready-for-test')return;
  if(r.status!==0){
   let retry=false;
   for(const step of ['design','stage1','stage2','stage3']){
    const source=path.join(dir,step),s=path.join(source,'status.json'),archive=source+'-attempt-1';
    if(!fs.existsSync(s))continue;
    const value=JSON.parse(fs.readFileSync(s));
    if(value.state==='failed'&&[429,500,502,503,504].includes(value.upstreamStatus)&&!fs.existsSync(archive)){
     fs.renameSync(source,archive);retry=true;break;
    }
   }
   if(!retry)throw Error('Paused: technical rejection, uncertain request, or retry budget exhausted. See saved job logs.');
  }
  await new Promise(resolve=>setTimeout(resolve,45000));
 }
 throw Error('Polling deadline reached; rerun to resume recorded tasks.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
