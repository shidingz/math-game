/* Inventory comes from the current renderer data, never historical design files. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),mode=process.argv[2]||'check';
const ids=['wukong','ragdoll','corgi','samoyed','siamese','bichon','nezha','yutu'];
const box={URL,document:{currentScript:{src:'http://local/wukong.js'}},HTMLElement:class{},customElements:{get(){},define(){}}};box.window=box;
const run=file=>vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),box);
run('wukong.js');const manifests=[],assetPaths=new Set(),runtime=new Set(['index.html','test.html','wukong.js','.nojekyll']);
for(const file of fs.readdirSync(path.join(root,'game')))if(/\.(js|css)$/.test(file))runtime.add('game/'+file);
for(const id of ids){
 const dir=id==='wukong'?'':`characters/${id}/`,assetDir=dir+'assets/';
 if(id!=='wukong'){run(dir+id+'-data.js');for(const f of [`${id}-data.js`,`${id}-effects.js`,`${id}.js`])runtime.add(dir+f);}
 const data=box[id[0].toUpperCase()+id.slice(1)+'GameData'],tall=['wukong','nezha','yutu'].includes(id);
 const cell={width:512,height:tall?640:512,pivotX:256,pivotY:tall?588:470},columns=tall?4:3;
 const stages=data.stages.map((s,i)=>({...s,png:assetDir+`stage-${i+1}.png`,portrait:assetDir+`stage-${i+1}-portrait.png`}));
 for(let n=1;n<=3;n++){
   for(const suffix of ['',...data.frames.map(f=>'-'+f),'-portrait'])assetPaths.add(assetDir+`stage-${n}${suffix}.png`);
   runtime.add(assetDir+`stage-${n}.png`);runtime.add(assetDir+`stage-${n}-portrait.png`);
 }
 for(const f of fs.readdirSync(path.join(root,assetDir)))if(!f.startsWith('stage-')&&f.endsWith('.png')){assetPaths.add(assetDir+f);runtime.add(assetDir+f);}
 const actions=Object.fromEntries(Object.entries(data.actions).map(([name,a])=>{const ms=id==='wukong'?a.duration:a.durationMs;return[name,{label:a.label,frames:a.frames,durationMs:Number.isFinite(ms)?ms:null,loop:ms===null||ms===Infinity}]}));
 const png=fs.readFileSync(path.join(root,stages[0].png));
 manifests.push({id,name:data.name||'孙悟空',cell,atlas:{width:png.readUInt32BE(16),height:png.readUInt32BE(20),columns,rows:png.readUInt32BE(20)/cell.height},frames:data.frames.map((name,index)=>({index,name,x:index%columns*cell.width,y:Math.floor(index/columns)*cell.height,...cell})),stages,actions,levels:data.levels});
}
// Only the current scene library and explicitly registered custom pets ship.
for(const [group] of require('../wechat/runtime/kingdom-scenes').GROUPS)assetPaths.add('assets/toy-worlds/'+group+'.png');
const catalogPath=path.join(root,'assets/custom-pets/catalog.json');
if(fs.existsSync(catalogPath))for(const entry of JSON.parse(fs.readFileSync(catalogPath,'utf8'))){
 assert.match(entry,/^[a-zA-Z0-9_-]+\/pet\.json$/,'Invalid built-in custom pet catalog path');
 const folder='assets/custom-pets/'+path.dirname(entry);
 for(const file of fs.readdirSync(path.join(root,folder)))if(file.endsWith('.png'))assetPaths.add(folder+'/'+file);
}
const assets=[...assetPaths].sort().map(file=>{const bytes=fs.readFileSync(path.join(root,file));assert.equal(bytes.subarray(1,4).toString(),'PNG',file);return{file,bytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),runtime:runtime.has(file)};});
for(const m of manifests){for(const s of m.stages){const a=assets.find(a=>a.file===s.png);assert.equal(a.width,m.atlas.width,s.png);assert.equal(a.height,m.atlas.height,s.png);}assert.equal(new Set(m.levels.map(l=>l.name)).size,15,m.id);for(const a of Object.values(m.actions))for(const f of a.frames)assert.ok(f>=0&&f<m.frames.length,m.id);assert.equal(m.actions.feed.durationMs,500,m.id);}
const inventory={characters:manifests,assets,runtimeFiles:[...runtime].sort()};
const target=path.join(root,'asset-inventory.json'),serialized=JSON.stringify(inventory,null,2)+'\n';
if(mode==='assets'){fs.writeFileSync(target,serialized);console.log(`Updated inventory: ${ids.length} characters, ${assets.length} PNG assets.`);}
else{
 assert.equal(fs.readFileSync(target,'utf8'),serialized,'Asset inventory is stale; run npm run assets after intentional asset/data edits.');
 for(const file of runtime)assert.ok(fs.existsSync(path.join(root,file)),file);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const [,ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(/^(https?:|data:)/.test(ref))continue;const f=ref.split('?')[0];assert.ok(fs.existsSync(path.join(root,f)),`Missing HTML resource: ${f}`);}
 if(mode==='build'){const dest=path.join(root,'dist');fs.rmSync(dest,{recursive:true,force:true});for(const file of runtime){const output=path.join(dest,file);fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(path.join(root,file),output);}console.log(`Built ${runtime.size} runtime files to dist/`);}
 else if(mode!=='check')throw Error('Expected assets, check, or build');
 console.log(`PASS: ${ids.length} characters, ${assets.length} assets, all runtime paths and 500ms feeding timings verified.`);
}
