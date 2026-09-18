'use strict';
const fs=require('node:fs');
if(!process.env.PET_TEMPLATE_TEST_LOG)throw Error('Offline fixture configuration required');
global.fetch=async(url,options)=>{
  if(process.env.PET_TEMPLATE_BLOCK_ALL)throw Error('Assembly must not access any network');
  if(!String(url).endsWith('/images/generations')||options.headers.Authorization!=='Bearer fixture-key')throw Error('Unexpected network request');
  const b=JSON.parse(options.body);fs.appendFileSync(process.env.PET_TEMPLATE_TEST_LOG,JSON.stringify({size:b.size,model:b.model,refs:b.image.length})+'\n');
  return {ok:true,json:async()=>({data:[{b64_json:b.image.at(-1).split(',')[1]}]})};
};
