'use strict';
// Explicitly selected third-party gateway; no fallback to Seedream or other models.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {settings,atomic}=require('./seedream-client.cjs');
async function edit({directory,references,prompt,model='gpt-image-2.5-web',size='3072x1024',submit=false}) {
  const env=settings(),base=env.LAOZHANG_BASE_URL||'https://api2.laozhang.ai/v1';
  if(!['https://api2.laozhang.ai/v1','https://api.laozhang.ai/v1'].includes(base)) throw Error('Use the documented LaoZhang gateway');
  if(!/^gpt-image-2\.5-(web|flare|sunburst)$/.test(model)) throw Error('Unsupported model; paused -vip routes are not used');
  if(!Array.isArray(references)||references.length<1||references.length>3) throw Error('Use 1–3 photos of the same subject');
  const photos=references.map(file=>{
    const bytes=fs.readFileSync(file);if(bytes.length>20*1024*1024)throw Error('Photo exceeds 20 MB');
    const type=bytes[0]===137&&bytes[1]===80?'image/png':bytes[0]===255&&bytes[1]===216?'image/jpeg':null;
    if(!type)throw Error('Use a PNG or JPEG photo');
    return {bytes,type,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  });
  const meta={provider:'LaoZhang',base,model,size,prompt,referenceHashes:photos.map(x=>x.sha256)};
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify(meta)).digest('hex');
  fs.mkdirSync(directory,{recursive:true});
  const statusPath=path.join(directory,'status.json'),responsePath=path.join(directory,'response.json');
  const old=fs.existsSync(statusPath)?JSON.parse(fs.readFileSync(statusPath)):null;
  if(old&&old.fingerprint!==fingerprint)throw Error('Inputs changed; use a new attempt folder');
  let response;
  if(fs.existsSync(responsePath))response=JSON.parse(fs.readFileSync(responsePath));
  else {
    if(old)throw Error('Previous request has no response; inspect its provider log before retrying');
    atomic(path.join(directory,'request-meta.json'),meta);
    fs.writeFileSync(path.join(directory,'prompt.txt'),prompt);
    if(!submit)return {pending:true,model,size,referenceCount:photos.length,fingerprint};
    if(!env.LAOZHANG_API_KEY)throw Error('Set LAOZHANG_API_KEY in .env.local');
    fs.writeFileSync(path.join(directory,'request.lock'),JSON.stringify({pid:process.pid,fingerprint}),{flag:'wx',mode:0o600});
    const form=new FormData();form.append('model',model);form.append('prompt',prompt);form.append('size',size);
    for(let i=0;i<photos.length;i++)form.append(photos.length===1?'image':'image[]',new Blob([photos[i].bytes],{type:photos[i].type}),`reference-${i+1}.${photos[i].type==='image/png'?'png':'jpg'}`);
    atomic(statusPath,{state:'inflight',fingerprint,model,startedAt:new Date().toISOString()});
    try {
      const r=await fetch(base+'/images/edits',{method:'POST',headers:{Authorization:'Bearer '+env.LAOZHANG_API_KEY},body:form,signal:AbortSignal.timeout(900000),redirect:'error'});
      response=await r.json();atomic(responsePath,response);
      if(!r.ok||response.error)throw Error(`LaoZhang HTTP ${r.status}: `+String(response.error?.message||response.message||'request failed').replaceAll(env.LAOZHANG_API_KEY,'[redacted]'));
      atomic(statusPath,{state:'received',fingerprint,model,usage:response.usage});
    }catch(e){const message=String(e.message).replaceAll(env.LAOZHANG_API_KEY,'[redacted]');atomic(statusPath,{state:'needs-attention',fingerprint,message});throw Error(message);}
  }
  if(response.error||!Array.isArray(response.data)||response.data.length!==1)throw Error('Expected one image; inspect saved response');
  const file=path.join(directory,'image-1.png');
  if(!fs.existsSync(file)) {
    let bytes;const value=response.data[0];
    if(value.b64_json)bytes=Buffer.from(value.b64_json.replace(/^data:[^,]+,/,''),'base64');
    else if(value.url){const url=new URL(value.url);if(url.protocol!=='https:'||url.username||url.password)throw Error('Unexpected image URL');const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('Download failed; resume without another generation');bytes=Buffer.from(await r.arrayBuffer());}
    else throw Error('No image in response');
    if(bytes.length>80*1024*1024||bytes.length<16)throw Error('Invalid image length');
    fs.writeFileSync(file+'.tmp',bytes);fs.renameSync(file+'.tmp',file);
  }
  atomic(statusPath,{state:'downloaded',fingerprint,model,usage:response.usage});
  return {file,model,usage:response.usage};
}
module.exports={edit};
if(require.main===module){
  const args=process.argv.slice(2),get=(n,f)=>args.includes(n)?args[args.indexOf(n)+1]:f;
  const valued=new Set(['--out','--photos','--prompt','--model','--size']);
  for(let i=0;i<args.length;i++){
    if(args[i]==='--submit')continue;
    if(!valued.has(args[i]))throw Error('Unknown preview option: '+args[i]+'. This entry currently creates one design image, not the old Seedream kit.');
    if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing value: '+args[i]);
    i++;
  }
  if(!args.includes('--out')||!args.includes('--photos'))throw Error('Required --out new-folder --photos photo.png [--submit]');
  edit({directory:path.resolve(get('--out')),references:get('--photos').split(',').map(p=>path.resolve(p)),prompt:fs.readFileSync(get('--prompt',path.resolve(__dirname,'../docs/prompts/photo-pet-evolution.txt')),'utf8'),model:get('--model',settings().LAOZHANG_IMAGE_MODEL||'gpt-image-2.5-web'),size:get('--size','3072x1024'),submit:args.includes('--submit')}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
