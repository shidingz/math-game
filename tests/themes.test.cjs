const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('新角色切换完整主题、文案和场景，缺省值不残留，清理旧装饰',()=>{
  const props={},els={},root={style:{setProperty:(k,v)=>props[k]=v},dataset:{}};let clears=0,decorated=0;
  for(const id of ['home-title','scene-label','brand-symbol','scene-decoration'])els[id]={textContent:'',replaceChildren(){}};
  const document={documentElement:root,getElementById:id=>els[id],querySelector:()=>({content:''})},window={};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../game/themes.js'),'utf8'),{window,document});
  window.MathPetThemes.apply({title:'月下练习',location:'月宫',symbol:'月',scene:'moon',style:'ornate',palette:{primary:'#8364ad',radius:'30px'},decorate(slot){assert.equal(slot,els['scene-decoration']);decorated++;return ()=>clears++;}});
  assert.equal(root.dataset.scene,'moon');assert.equal(root.dataset.uiStyle,'ornate');assert.equal(props['--pet-primary'],'#8364ad');assert.equal(els['home-title'].textContent,'月下练习');assert.equal(decorated,1);
  window.MathPetThemes.apply({scene:'cloud',style:'bold',palette:{primary:'#269bb1'}});
  assert.equal(clears,1);assert.equal(props['--pet-primary'],'#269bb1');assert.equal(props['--pet-radius'],'24px');assert.equal(root.dataset.scene,'cloud');assert.equal(root.dataset.uiStyle,'bold');assert.equal(els['scene-label'].textContent,'伙伴的小天地');
});
