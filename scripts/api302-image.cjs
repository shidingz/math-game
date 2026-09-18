'use strict';
// Local/server worker only: one durable POST, then resume the same async task.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {settings,atomic}=require('./seedream-client.cjs');
const base='https://api.302ai.cn',hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function context(directory){
  const key=settings().API302_API_KEY;
  if(!key)throw Error('Set API302_API_KEY in the ignored local environment');
  return {directory:path.resolve(directory),key,redact:s=>String(s).replaceAll(key,'[redacted]')};
}
async function request(c,url,options){
  const r=await fetch(url,{...options,headers:{Authorization:'Bearer '+c.key},signal:AbortSignal.timeout(120000),redirect:'error'});
  const raw=c.redact(await r.text());let data;
  try{data=JSON.parse(raw);}catch{throw Error('302.AI returned non-JSON HTTP '+r.status);}
  return {http:r.status,ok:r.ok,data};
}
async function submit({directory,prompt,references,size='1536x1536',quality='high',background='opaque',prepare=false}){
  const c=context(directory);directory=c.directory;
  if(!['1536x1536','3072x1024'].includes(size)||!['medium','high','xhigh','max'].includes(quality))throw Error('Unsupported preview size/quality');
  if(!['opaque','transparent','auto'].includes(background))throw Error('Unsupported image background');
  if(!references?.length||references.length>3)throw Error('Use 1–3 reference images');
  const photos=references.map(file=>{const bytes=fs.readFileSync(file);if(bytes.length>20*1024*1024||bytes[0]!==137||bytes[1]!==80)throw Error('Use PNG references below 20 MiB');return {bytes,sha256:hash(bytes)};});
  const fields={model:'gpt-image-2.5-sunburst',prompt,size,quality,n:'1',output_format:'png',background};
  const meta={provider:'302.AI',base,fields,references:photos.map(p=>p.sha256)},fingerprint=hash(JSON.stringify(meta));
  fs.mkdirSync(directory,{recursive:true});
  const statusFile=path.join(directory,'status.json'),old=fs.existsSync(statusFile)?JSON.parse(fs.readFileSync(statusFile)):null;
  if(old&&old.fingerprint!==fingerprint)throw Error('Inputs changed; use a new attempt directory');
  if(old){if(old.taskId)return {state:old.state,taskId:old.taskId};throw Error('Previous POST has no recorded task ID; inspect the provider log before retrying');}
  atomic(path.join(directory,'request-meta.json'),{...meta,fingerprint});fs.writeFileSync(path.join(directory,'prompt.txt'),prompt);
  photos.forEach((p,i)=>fs.writeFileSync(path.join(directory,`reference-${i+1}.png`),p.bytes));
  if(prepare)return {state:'prepared',directory,model:fields.model,size,referenceCount:photos.length};
  const form=new FormData();for(const [k,v]of Object.entries(fields))form.append(k,v);
  photos.forEach((p,i)=>form.append('image[]',new Blob([p.bytes],{type:'image/png'}),`reference-${i+1}.png`));
  fs.writeFileSync(path.join(directory,'request.lock'),JSON.stringify({fingerprint,pid:process.pid}),{flag:'wx',mode:0o600});
  const state={state:'submitting',fingerprint,model:fields.model,startedAt:new Date().toISOString()};atomic(statusFile,state);
  try{
    const r=await request(c,base+'/v1/images/edits?async=true',{method:'POST',body:form});atomic(path.join(directory,'submit-response.json'),r);
    if(!r.ok||r.data.error)throw Error('302.AI HTTP '+r.http+': '+c.redact(r.data.error?.message||r.data.message||'request failed'));
    const taskId=r.data.task_id||r.data.data?.task_id;if(typeof taskId!=='string'||!taskId)throw Error('302.AI did not return a task ID');
    atomic(statusFile,{...state,state:'pending',taskId});return {state:'pending',directory,taskId};
  }catch(e){const message=c.redact(e.message);atomic(statusFile,{...state,state:'needs-attention',message});throw Error(message);}
}
async function poll(directory){
  const c=context(directory);directory=c.directory;
  const state=JSON.parse(fs.readFileSync(path.join(directory,'status.json'))),out=path.join(directory,'image-1.png');
  if(state.state==='downloaded'&&fs.existsSync(out))return {state:'downloaded',file:out};
  if(state.state==='failed')throw Error(c.redact(state.message||'Saved upstream task failed'));
  if(!state.taskId)throw Error('No recorded task to poll');
  const responseFile=path.join(directory,'response.json');let result;
  if(fs.existsSync(responseFile))result=JSON.parse(fs.readFileSync(responseFile));
  else{
    const r=await request(c,base+'/async_result?task_id='+encodeURIComponent(state.taskId),{method:'GET'});
    if(!r.ok)throw Error('302.AI polling HTTP '+r.http+'; resume polling this task');
    atomic(path.join(directory,'poll-response.json'),r.data);
    if(r.data.err==='result pending')return {state:'pending',directory,taskId:state.taskId};
    if(r.data.err||r.data.status_code!==200){
      let body=r.data.data;try{if(typeof body==='string')body=JSON.parse(body);}catch{body=null;}
      const detail=r.data.err||body?.error?.message_cn||body?.error?.message||'Upstream failure';
      const message=c.redact('302.AI upstream '+r.data.status_code+': '+String(detail).slice(0,300));
      atomic(path.join(directory,'status.json'),{...state,state:'failed',upstreamStatus:r.data.status_code,errorCode:body?.error?.err_code,message});throw Error(message);
    }
    result=typeof r.data.data==='string'?JSON.parse(r.data.data):r.data.data;atomic(responseFile,result);
  }
  if(result.error||!Array.isArray(result.data)||result.data.length<1||result.data.length>16)throw Error('Expected complete image results');
  // Some gateway responses include intermediate variants despite n=1. Preserve
  // all of them, use the last returned variant consistently, and let the locked
  // geometry checks decide whether it is usable. Never issue another paid POST.
  const candidates=[];
  for(const [index,value] of result.data.entries()){
  let bytes;
  if(value.b64_json)bytes=Buffer.from(value.b64_json.replace(/^data:[^,]+,/,''),'base64');
  else if(value.url){
    const url=new URL(value.url);if(url.protocol!=='https:'||url.username||url.password)throw Error('Unexpected download URL');
    const r=await fetch(url,{signal:AbortSignal.timeout(120000),redirect:'error'});if(!r.ok)throw Error('Download failed; resume this saved result');bytes=Buffer.from(await r.arrayBuffer());
  }else throw Error('Response contains no image');
  if(bytes.length>80*1024*1024||bytes[0]!==137||bytes[1]!==80)throw Error('Expected PNG below 80 MiB');
  const file=path.join(directory,`response-image-${index+1}.png`);fs.writeFileSync(file+'.tmp',bytes);fs.renameSync(file+'.tmp',file);candidates.push(file);
  }
  fs.copyFileSync(candidates[candidates.length-1],out+'.tmp');fs.renameSync(out+'.tmp',out);
  atomic(path.join(directory,'selection.json'),{requested:1,returned:candidates.length,selectedIndex:candidates.length,selection:'last-returned-result',files:candidates.map(f=>path.basename(f))});
  atomic(path.join(directory,'status.json'),{...state,state:'downloaded',completedAt:new Date().toISOString(),returnedCount:candidates.length,selectedIndex:candidates.length,usage:result.usage,size:result.size,quality:result.quality});
  return {state:'downloaded',file:out,size:result.size,quality:result.quality,usage:result.usage};
}
module.exports={submit,poll};
