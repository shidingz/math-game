// Only loaded explicitly by the optional offline pipeline test. Never opens a socket.
'use strict';
const fs=require('node:fs'),sharp=require('sharp');
if(!process.env.PET_FIXTURE_LOG) throw Error('Missing offline test configuration');
global.fetch=async(url,options)=>{
  if(process.env.PET_FIXTURE_NO_NETWORK) throw Error('All network calls are forbidden during deterministic assembly');
  if(options.headers.Authorization!=='Bearer offline-fixture-key') throw Error('Fixture must never use real credentials');
  const body=JSON.parse(options.body);
  if(String(url).endsWith('/responses')) {
    if(process.env.PET_FIXTURE_NO_REVIEW) throw Error('No vision model is allowed for this pipeline test');
    return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({approved:true,issues:[],summary:'OFFLINE TEST FIXTURE; not a visual assessment'})}]}]})};
  }
  if(!String(url).endsWith('/images/generations')) throw Error('Offline test blocks all other requests');
  const p=body.prompt;
  const step=p.includes('第1阶段全身')?'stage1':p.includes('第2阶段全身')?'stage2':p.includes('第3阶段全身')?'stage3':p.includes('横向三列')?'design':p.includes('2×2等大格')?'effects':p.includes('幻想家园场景')?'scene':'food';
  const log=fs.existsSync(process.env.PET_FIXTURE_LOG)?fs.readFileSync(process.env.PET_FIXTURE_LOG,'utf8').trim().split('\n'):[];
  fs.appendFileSync(process.env.PET_FIXTURE_LOG,step+'\n');
  const cols=step==='design'?3:step.startsWith('stage')?3:step==='effects'?2:1;
  const rows=step.startsWith('stage')?3:step==='effects'?2:1;
  const fail=step===process.env.PET_FIXTURE_REJECT_FIRST&&!log.includes(step);
  const layers=[];
  for(let i=0;i<cols*rows;i++)layers.push({input:await sharp({create:{width:60,height:80,channels:4,background:'#eee8dc'}}).png().toBuffer(),left:i%cols*160+50,top:Math.floor(i/cols)*160+50});
  const bytes=await sharp({create:{width:cols*160,height:rows*160,channels:4,background:fail?'#ffffff':'#00FF00'}}).composite(layers).png().toBuffer();
  return {ok:true,json:async()=>({data:[{b64_json:bytes.toString('base64')}],usage:{generated_images:1}})};
};
