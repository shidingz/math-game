/* Exact rational arithmetic: decimals and equivalent fractions never use float equality. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MathPetQuestions=api;})(globalThis,()=>{
  'use strict';
  const gcd=(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b)[a,b]=[b,a%b];return a||1;};
  function rational(n,d=1){if(!Number.isSafeInteger(n)||!Number.isSafeInteger(d)||d===0)return null;if(d<0){n=-n;d=-d;}const g=gcd(n,d);return {n:n/g,d:d/g};}
  function parse(value){const s=String(value).trim().replace(/／/g,'/').replace(/．/g,'.');if(s.length>18)return null;
    if(/^\d{1,7}\s*\/\s*\d{1,7}$/.test(s)){const [n,d]=s.split('/').map(Number);return rational(n,d);}
    if(!/^\d{1,7}(?:\.\d{1,6})?$/.test(s))return null;const [whole,fraction='']=s.split('.');return rational(Number(whole)*10**fraction.length+Number(fraction||0),10**fraction.length);
  }
  function calc(a,op,b){if(!a||!b)return null;return op==='+'?rational(a.n*b.d+b.n*a.d,a.d*b.d):op==='−'?rational(a.n*b.d-b.n*a.d,a.d*b.d):op==='×'?rational(a.n*b.n,a.d*b.d):op==='÷'?rational(a.n*b.d,a.d*b.n):null;}
  const equal=(a,b)=>!!a&&!!b&&a.n===b.n&&a.d===b.d;
  function format(r,fraction=false){if(r.d===1)return String(r.n);if(fraction)return `${r.n}/${r.d}`;let d=r.d;while(d%2===0)d/=2;while(d%5===0)d/=5;return d===1?String(Number((r.n/r.d).toFixed(6))):`${r.n}/${r.d}`;}
  const GRADES=Object.freeze({
    0:{name:'幼儿园',description:'数一数 1—10，5 以内和 10 以内加减',topics:{count10:'数一数 · 1—10',add5:'5 以内加减',add10:'10 以内加减'}},
    1:{name:'一年级',description:'20 以内加减，100 以内整十数加减',topics:{add20:'20 以内加减',tens:'整十数加减'}},
    2:{name:'二年级',description:'100 以内加减，表内乘除',topics:{add100:'100 以内加减',tables:'表内乘除'}},
    3:{name:'三年级',description:'三位数加减，一位数乘除，两位数乘法',topics:{add1000:'三位数加减',multiply:'整数乘除',decimal1:'一位小数加减'}},
    4:{name:'四年级',description:'多位数乘除，小数加减，两步混合运算',topics:{integer:'多位数乘除',decimal2:'小数加减',order:'两步混合运算'}},
    5:{name:'五年级',description:'小数四则运算，分数加减',topics:{decimal:'小数四则',fractionAdd:'分数加减'}},
    6:{name:'六年级',description:'分数四则，分数小数混合，百分数计算',topics:{fraction:'分数四则',mixedNumber:'分数小数混合',percent:'求一个数的百分之几'}}
  });
  function allowed(grade,topic){return !!GRADES[grade]&&(topic==='balanced'||Object.hasOwn(GRADES[grade].topics,topic));}
  const randomInt=(min,max,rng)=>min+Math.floor(Math.min(.999999999,Math.max(0,rng()))*(max-min+1));
  function countQuestion(count){return {topic:'count10',expression:`数一数 ${'★'.repeat(count)}`,visual:{kind:'count',count},left:String(count),op:'+',right:'0',answer:rational(count),answerText:String(count),format:'number',explanation:`从左到右，一颗一颗数，一共有 ${count} 颗星星。`,status:'pending',response:''};}
  function generate(grade,topic,rng){
    const int=(a,b)=>randomInt(a,b,rng),choose=arr=>arr[int(0,arr.length-1)],dec=(n,places)=>format(rational(n,10**places));
    let left,right,op=choose(['+','−']),answer,expression,explanation;
    const additive=max=>{let a=int(1,max-1),b=int(1,max-a);if(op==='−')[a,b]=[a+b,choose([a,b])];left=String(a);right=String(b);};
    const fractions=(ops)=>{op=choose(ops);left=`${int(1,8)}/${choose([2,3,4,5,6,8,10,12])}`;right=`${int(1,8)}/${choose([2,3,4,5,6,8,10,12])}`;if(op==='−'&&parse(left).n/parse(left).d<parse(right).n/parse(right).d)[left,right]=[right,left];};
    if(topic==='count10')return countQuestion(int(1,10));
    else if(topic==='add5'||topic==='add10'){
      const max=topic==='add5'?5:10,a=int(0,max),b=int(0,op==='+'?max-a:a);left=String(a);right=String(b);
      explanation=op==='+'?`${a} 个和 ${b} 个合起来，一共有 ${a+b} 个。`:`有 ${a} 个，拿走 ${b} 个，还剩 ${a-b} 个。`;
    }
    else if(topic==='add20')additive(20);
    else if(topic==='tens'){left=String(int(1,8)*10);right=String(int(1,(100-Number(left))/10)*10);if(op==='−'){const a=Number(left),b=Number(right);left=String(a+b);right=String(a);}}
    else if(topic==='add100')additive(100);
    else if(topic==='add1000')additive(1000);
    else if(topic==='tables'){const a=int(1,9),b=int(1,9);op=choose(['×','÷']);left=String(op==='×'?a:a*b);right=String(b);}
    else if(topic==='multiply'||topic==='integer'){
      op=choose(['×','÷']);const two=topic==='integer';let a=two?int(11,99):int(11,99),b=two?int(11,29):int(2,9);
      if(!two&&op==='×'&&rng()>.5)b=int(11,19);if(two&&op==='×'&&rng()>.5)a=int(101,299);
      left=String(op==='×'?a:a*b);right=String(b);
    }else if(topic==='decimal1'||topic==='decimal2'||topic==='decimal'){
      const places=topic==='decimal1'?1:2;let a=int(11,topic==='decimal1'?99:999),b=int(1,a);
      if(topic==='decimal')op=choose(['+','−','×','÷']);
      if(op==='×'){left=dec(int(1,99),1);right=dec(int(1,29),1);}
      else if(op==='÷'){const divisor=rational(int(1,20),10),quotient=rational(int(1,99),10);left=format(calc(divisor,'×',quotient));right=format(divisor);}
      else{left=dec(a,places);right=dec(b,places);}
    }else if(topic==='fractionAdd'||topic==='fraction')fractions(topic==='fractionAdd'?['+','−']:['+','−','×','÷']);
    else if(topic==='mixedNumber'){fractions(['+','−','×','÷']);right=dec(int(1,30),1);if(op==='−'&&parse(left).n/parse(left).d<parse(right).n/parse(right).d)[left,right]=[right,left];}
    else if(topic==='percent'){const percent=choose([5,10,20,25,40,50,60,75,80]),base=int(1,20)*10;left=String(base);right=`${percent}/100`;op='×';expression=`${base} 的 ${percent}%`;explanation=`把 ${percent}% 写成 ${percent}/100，再和 ${base} 相乘。`;}
    else if(topic==='order'){
      const a=int(2,9),b=int(2,9),c=int(1,40);answer=rational(a*b+c);expression=`${c} + ${a} × ${b}`;
      return {topic,expression,left:String(c),op:'+',right:String(a*b),answer,answerText:format(answer),format:'number',explanation:`先算 ${a} × ${b} = ${a*b}，再加 ${c}。`,status:'pending',response:''};
    }else throw new RangeError('未知题型');
    answer=calc(parse(left),op,parse(right));const fraction=['fraction','fractionAdd','mixedNumber'].includes(topic);
    return {topic,expression:expression||`${left} ${op} ${right}`,left,op,right,answer,answerText:format(answer,fraction),format:fraction?'fraction':'number',explanation:explanation||(fraction?(op==='+'||op==='−'?'加减分数时先通分，再计算分子。':op==='÷'?'除以一个分数，等于乘这个分数的倒数。':'分子相乘、分母相乘，最后约分。'):(topic.startsWith('decimal')?'小数加减要对齐小数点，乘除要注意小数位数。':`算式的结果是 ${format(answer)}。`)),status:'pending',response:''};
  }
  function makeRound(grade=2,topic='balanced',rng=Math.random){
    if(!GRADES[grade])grade=2;if(!allowed(grade,topic))topic='balanced';
    const choices=topic==='balanced'?Object.keys(GRADES[grade].topics):[topic];
    const plan=Array.from({length:10},(_,i)=>choices[i%choices.length]);for(let i=9;i>0;i--){const j=randomInt(0,i,rng);[plan[i],plan[j]]=[plan[j],plan[i]];}
    const seen=new Set();const questions=plan.map(t=>{let q;if(t==='count10'){const available=Array.from({length:10},(_,i)=>countQuestion(i+1)).filter(item=>!seen.has(item.expression));q=available[randomInt(0,available.length-1,rng)];}else for(let tries=0;tries<60;tries++){q=generate(grade,t,rng);if(!seen.has(q.expression))break;}seen.add(q.expression);return q;});
    return {grade,topic,index:0,complete:false,questions};
  }
  function validQuestion(q){
    if(!q||typeof q.expression!=='string'||q.expression.length>70||!['pending','correct','wrong'].includes(q.status)||typeof q.response!=='string'||q.response.length>18||!['number','fraction'].includes(q.format)||typeof q.explanation!=='string'||q.explanation.length>200)return false;
    if(q.topic==='count10'&&(!q.visual||q.visual.kind!=='count'||!Number.isInteger(q.visual.count)||q.visual.count<1||q.visual.count>10||q.left!==String(q.visual.count)||q.op!=='+'||q.right!=='0'||q.expression!==countQuestion(q.visual.count).expression))return false;
    const expected=calc(parse(q.left),q.op,parse(q.right));return expected?.n>=0&&equal(expected,q.answer)&&equal(parse(q.answerText),q.answer)&&(q.status==='pending'?q.response==='':!!parse(q.response)&&equal(parse(q.response),q.answer)===(q.status==='correct'));
  }
  return {GRADES,rational,parse,calc,equal,format,allowed,generate,makeRound,validQuestion};
});
