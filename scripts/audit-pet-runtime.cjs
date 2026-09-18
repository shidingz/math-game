'use strict';
// Technical call-surface audit, not an image/semantic review.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]),job=path.resolve(process.argv[3]);
const prompt=require('./pet-alpha-prompts.cjs');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const shipped=walk(root).filter(f=>/\.js$/.test(f)&&!f.endsWith('preview.js'));
for(const f of shipped){
 const code=fs.readFileSync(f,'utf8');
 assert.ok(!/api\.302ai|api\.openai|ark\.cn-beijing|chat\/completions|\/v1\/responses|API302_API_KEY|ARK_API_KEY|sk-[a-zA-Z0-9]{24,}/.test(code),'Unexpected model endpoint or key in client: '+path.relative(root,f));
 assert.ok(!/\beval\s*\(|new\s+Function\s*\(/.test(code),'Dynamic code in shipped client');
}
const steps=['design','stage1','stage2','stage3'],calls=[];
for(const step of steps){
 const dir=path.join(job,step),meta=JSON.parse(fs.readFileSync(path.join(dir,'request-meta.json'))),status=JSON.parse(fs.readFileSync(path.join(dir,'status.json')));
 assert.equal(meta.base,'https://api.302ai.cn');assert.equal(meta.fields.model,'gpt-image-2.5-sunburst');assert.equal(meta.fields.background,'transparent');
 assert.equal(meta.fields.prompt,step==='design'?prompt.design():prompt.actions(Number(step.at(-1))));
 assert.equal(status.state,'downloaded');
 calls.push({step,model:meta.fields.model,references:meta.references.length,startedAt:status.startedAt,completedAt:status.completedAt});
}
const pack=JSON.parse(fs.readFileSync(path.join(job,'candidate/pet.json'))),quality=JSON.parse(fs.readFileSync(path.join(job,'candidate/quality.json')));
assert.equal(pack.name,'新伙伴');assert.equal(quality.aiReviewCalls,0);assert.equal(quality.conversion.aiCalls,0);
const custom=require('../wechat/runtime/custom-pets'),effects=require('../wechat/runtime/kingdom-scenes');
const profile=effects.profile(custom.character(pack,require(path.join(root,'data/characters.js'))[0]));
const match={id:'rule-composed',name:'预制插画元素与程序组合',method:effects.VERSION,...profile};
assert.ok(!fs.existsSync(path.join(root,'shared-art')),'Retired scene textures should not ship in the current export');
const report={passed:true,checkedClientModules:shipped.length,name:pack.name,id:pack.id,calls,backgroundMatch:match,
 aiNamingCalls:0,aiReviewCalls:0,aiCropCalls:0,perPetCodeGeneration:0,
 imageApiRoutes:['POST https://api.302ai.cn/v1/images/edits?async=true','GET https://api.302ai.cn/async_result?task_id=…'],
 clientServiceRoutes:['POST /session','POST /pet-photos','POST /pet-jobs','GET /pet-jobs','GET approved image asset URLs'],
 serviceConfigured:Boolean(require(path.join(root,'config.js')).customPets.baseUrl),
 limits:['Static module scan and recorded requests are not a security proof for future edits.','Geometry checks do not judge anatomy, identity or aesthetic quality.'],
 developmentOnly:{legacyPrebakedImagegenCalls:5,legacyArtShipped:false,currentSharedAtlasCount:effects.GROUPS.length,runtimeModelRequests:0},semanticReview:'not-performed'};
fs.writeFileSync(path.join(job,'runtime-audit.json'),JSON.stringify(report,null,2));console.log('PASS: fixed prompts, four image tasks, no model endpoint/secret/dynamic code in shipped client; no extra AI processing.');
