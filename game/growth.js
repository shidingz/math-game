(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MathPetGrowth=api;})(globalThis,()=>{
  // Cost in growth points to leave levels 1…14. One correct answer funds 10 growth.
  const WUKONG=Object.freeze([40,40,60,80,80,80,100,100,100,120,120,140,140,300]);
  function curve(value){return Array.isArray(value)&&value.length===14&&value.every(n=>Number.isSafeInteger(n)&&n>0)?value:WUKONG;}
  // Art stops changing at 15; later levels retain the Lv.15 pace.
  function visualLevel(level){return Math.max(1,Math.min(15,Math.round(Number(level)||1)));}
  function required(level,config){return level>=15?curve(config?.growthCurve)[13]:curve(config?.growthCurve)[Math.max(0,level-1)];}
  function totalAt(level,config){const costs=curve(config?.growthCurve);return costs.slice(0,Math.max(0,level-1)).reduce((a,b)=>a+b,0)+Math.max(0,level-15)*costs[13];}
  return {WUKONG,required,totalAt,visualLevel};
});
