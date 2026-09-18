'use strict';
const sharp = require('sharp');
const COLORS = { green: { channel: 1, hex: '#00FF00', label: '绿' }, blue: { channel: 2, hex: '#0000FF', label: '蓝' }, red: { channel: 0, hex: '#FF0000', label: '红' } };
function color(key = 'green') { if (!COLORS[key]) throw Error('Unknown matte colour'); return COLORS[key]; }
async function choose(photos) {
  const scores = { green: 0, blue: 0, red: 0 };
  for (const file of photos) {
    const { data } = await sharp(file).resize(128,128,{fit:'inside'}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
    for (let i=0;i<data.length;i+=3) for (const [key,c] of Object.entries(COLORS)) {
      const value=data[i+c.channel], other=Math.max(...[0,1,2].filter(n=>n!==c.channel).map(n=>data[i+n]));
      if(value>12 && value-other>12 && (value-other)/value>.12) scores[key]++;
    }
  }
  return Object.keys(scores).sort((a,b)=>scores[a]-scores[b])[0];
}
function prompt(text,key='green') {
  if(key==='green') return text;
  const c=color(key);
  return text.replaceAll('#00FF00',c.hex).replaceAll('绿',c.label);
}
module.exports={color,choose,prompt};
