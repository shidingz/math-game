/* UI themes are independent of pet sprites. All values are local, trusted config. */
(() => {
  const defaults={background:'#f4f8f9',ink:'#26384b',muted:'#7e929c',primary:'#367ddd',primaryDark:'#2866b6',accent:'#68bca0',surface:'#ffffff',border:'#dce9e8',sceneFrom:'#effaf8',sceneTo:'#e6f4f3',sceneLine:'#c9e5dd',hill:'#cae6db66',foodBackground:'#fff8f5',foodBorder:'#ebbcab',foodInk:'#b9674c',radius:'24px',font:'"PingFang SC","Microsoft YaHei",system-ui,sans-serif'};
  let cleanup=null;
  window.MathPetThemes={apply(ui={}){
    cleanup?.();cleanup=null;const root=document.documentElement;
    for(const [name,value] of Object.entries({...defaults,...ui.palette}))if(Object.hasOwn(defaults,name))root.style.setProperty('--pet-'+name,value);
    root.dataset.scene=['forest','cloud','moon','lotus','sea','meadow','snow','thai'].includes(ui.scene)?ui.scene:'forest';
    root.dataset.uiStyle=['soft','bold','ornate'].includes(ui.style)?ui.style:'soft';
    document.getElementById('home-title').textContent=ui.title||'一起算，一起长大。';
    document.getElementById('scene-label').textContent=ui.location||'伙伴的小天地';
    document.getElementById('brand-symbol').textContent=ui.symbol||'✦';
    document.querySelector('meta[name="theme-color"]').content=(ui.palette||{}).background||defaults.background;
    // Optional custom scenery renderer must return a cleanup function.
    const slot=document.getElementById('scene-decoration');slot.replaceChildren();
    if(typeof ui.decorate==='function')cleanup=ui.decorate(slot)||null;
  }};
})();
