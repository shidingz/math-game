'use strict';
// Deterministic chroma extraction and atlas assembly; never invent missing artwork.
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
function bounds(data, width, height, threshold = 16) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1, count = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > threshold) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); count++;
  }
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, count };
}
async function cutout(input, { validate = true, key = 'green' } = {}) {
  const channel = require('./pet-chroma.cjs').color(key).channel;
  const otherA = (channel + 1) % 3, otherB = (channel + 2) % 3;
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const samples=[];
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(x<4||y<4||x>=info.width-4||y>=info.height-4){
    const i=(y*info.width+x)*4,v=data[i+channel],o=Math.max(data[i+otherA],data[i+otherB]);
    if(data[i+3]>220&&v>12&&v-o>12)samples.push((v-o)/v);
  }
  samples.sort((a,b)=>a-b);
  const backgroundSaturation=samples.length?samples[Math.floor(samples.length*.1)]:.6;
  const low=Math.max(.20,Math.min(.65,backgroundSaturation*.75));
  const high=Math.max(low+.1,backgroundSaturation);
  // Models sometimes return cyan-blue/gradient backgrounds instead of exact RGB.
  // Remove the chroma region connected to the outside, not arbitrary low-saturation
  // colours inside the subject. Existing crop/transparency gates still apply.
  const exterior = new Uint8Array(info.width * info.height), queue = new Int32Array(exterior.length);
  let head = 0, tail = 0;
  const visit = p => {
    if (exterior[p]) return;
    const i=p*4, value=data[i+channel], other=Math.max(data[i+otherA],data[i+otherB]);
    if (data[i+3] < 16 || (value > 12 && value-other > 12 && (value-other)/value > low)) {
      exterior[p]=1;queue[tail++]=p;
    }
  };
  for(let x=0;x<info.width;x++){visit(x);visit((info.height-1)*info.width+x);}
  for(let y=0;y<info.height;y++){visit(y*info.width);visit(y*info.width+info.width-1);}
  while(head<tail){const p=queue[head++],x=p%info.width,y=Math.floor(p/info.width);if(x)visit(p-1);if(x+1<info.width)visit(p+1);if(y)visit(p-info.width);if(y+1<info.height)visit(p+info.width);}
  let removed = 0, border = 0, clearBorder = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4, value = data[i + channel], other = Math.max(data[i + otherA],data[i + otherB]);
    // Chroma must be chosen away from subject colours before generation.
    const dominance = value - other;
    let alpha = data[i + 3];
    if (exterior[y * info.width + x]) alpha = 0;
    else if (value > 12 && dominance > 12) {
      const saturation = dominance / value;
      const coverage = Math.min(1, Math.max(0, (saturation - low) / (high - low)));
      alpha = Math.round(alpha * (1 - coverage));
      if (alpha > 0 && coverage > 0) data[i + channel] = Math.min(value, other + 4);
    }
    data[i + 3] = alpha;
  }
  // Remove isolated background grain, while keeping connected hair and all
  // substantial detached details. This never fills holes or repairs anatomy.
  const seen=new Uint8Array(exterior.length), specks=[];
  const small=Math.max(4,Math.floor(exterior.length*.00004));
  for(let p=0;p<seen.length;p++)if(!seen[p]&&data[p*4+3]>16){
    head=0;tail=0;queue[tail++]=p;seen[p]=1;
    while(head<tail){const q=queue[head++],x=q%info.width,y=Math.floor(q/info.width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=info.width||yy>=info.height)continue;const n=yy*info.width+xx;
      if(!seen[n]&&data[n*4+3]>16){seen[n]=1;queue[tail++]=n;}
    }}
    if(tail<=small)for(let i=0;i<tail;i++)specks.push(queue[i]);
  }
  if(specks.length<=exterior.length*.005)for(const p of specks)data[p*4+3]=0;
  // Despill only the two-pixel transparent boundary. Do not recolour interiors.
  for(let y=2;y<info.height-2;y++)for(let x=2;x<info.width-2;x++){
    const i=(y*info.width+x)*4,other=Math.max(data[i+otherA],data[i+otherB]);
    if(data[i+3]<16||data[i+channel]-other<12)continue;
    let edge=false;
    for(let dy=-2;dy<=2&&!edge;dy++)for(let dx=-2;dx<=2;dx++)if(data[((y+dy)*info.width+x+dx)*4+3]<16){edge=true;break;}
    if(edge)data[i+channel]=Math.min(data[i+channel],other+4);
  }
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    const alpha=data[(y*info.width+x)*4+3];if(alpha<16)removed++;
    if(x<4||y<4||x>=info.width-4||y>=info.height-4){border++;if(alpha<16)clearBorder++;}
  }
  const box = bounds(data, info.width, info.height);
  const metrics = { width: info.width, height: info.height, removedFraction: removed / (info.width * info.height), clearBorderFraction: clearBorder / border, box };
  if (validate && (metrics.removedFraction < .15 || metrics.clearBorderFraction < .98)) throw Error('Background/crop gate failed: ' + JSON.stringify(metrics));
  if (validate && (box.count < info.width * info.height * .008 || box.width <= 0 || box.height <= 0)) throw Error('Empty or tiny subject');
  const margin = Math.floor(Math.min(info.width, info.height) * .025);
  if (validate && (box.x < margin || box.y < margin || box.x + box.width > info.width - margin || box.y + box.height > info.height - margin)) throw Error('Subject too close to a cell boundary: ' + JSON.stringify(metrics));
  return { data, info, box, metrics, png: await sharp(data, { raw: info }).png().toBuffer() };
}
async function adaptiveSplit(input, cols, rows, options) {
  const keyed = await cutout(input, { ...options, validate: false }), { info, data } = keyed, parts = [];
  // Remove only thin, nearly full-length dark grid rules near expected divisions.
  for (const [axis, count] of [['x', cols], ['y', rows]]) {
    const length = axis === 'x' ? info.width : info.height, cross = axis === 'x' ? info.height : info.width;
    for (let n = 1; n < count; n++) for (let p = Math.floor(length * n / count - length / count * .035); p <= length * n / count + length / count * .035; p++) {
      let dark = 0;
      for (let q = 0; q < cross; q++) { const i = (axis === 'x' ? q * info.width + p : p * info.width + q) * 4; if (data[i + 3] > 220 && Math.max(data[i], data[i + 1], data[i + 2]) < 80) dark++; }
      if (dark > cross * .85) for (let q = 0; q < cross; q++) data[(axis === 'x' ? q * info.width + p : p * info.width + q) * 4 + 3] = 0;
    }
  }
  function divisions(axis, count) {
    const length = axis === 'x' ? info.width : info.height, cross = axis === 'x' ? info.height : info.width, result = [0];
    for (let n = 1; n < count; n++) {
      const nominal = length * n / count, radius = length / count * .16, runs = []; let start = null;
      for (let p = Math.floor(nominal - radius); p <= Math.ceil(nominal + radius); p++) {
        let occupied = 0;
        for (let q = 0; q < cross; q++) if (data[(axis === 'x' ? q * info.width + p : p * info.width + q) * 4 + 3] > 32) occupied++;
        if (occupied <= cross * .001) { if (start === null) start = p; }
        else if (start !== null) { runs.push([start, p - 1]); start = null; }
      }
      if (start !== null) runs.push([start, Math.ceil(nominal + radius)]);
      const usable = runs.filter(([a,b]) => b - a >= 8).sort((a,b) => (b[1]-b[0])-(a[1]-a[0]));
      if (!usable.length) throw Error('No clear gap between sprite groups; cannot safely split ' + axis + n);
      result.push(Math.round((usable[0][0] + usable[0][1]) / 2));
    }
    return [...result, length];
  }
  const xx = divisions('x', cols), yy = divisions('y', rows);
  const sheet = await sharp(data, { raw: info }).png().toBuffer();
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const crop = await sharp(sheet).extract({ left: xx[x], top: yy[y], width: xx[x + 1] - xx[x], height: yy[y + 1] - yy[y] }).png().toBuffer();
    try { parts.push(await cutout(crop, options)); } catch (e) { throw Error(`Cell ${y * cols + x + 1}: ${e.message}`); }
  }
  return parts;
}
async function split(input, cols, rows, options = {}) {
  const info = await sharp(input).metadata(), parts = [];
  try {
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const left = Math.round(x * info.width / cols), top = Math.round(y * info.height / rows);
      const width = Math.round((x + 1) * info.width / cols) - left, height = Math.round((y + 1) * info.height / rows) - top;
      const gutter = Math.ceil(Math.min(width, height) * .025);
      const crop = await sharp(input).extract({ left: left + gutter, top: top + gutter, width: width - gutter * 2, height: height - gutter * 2 }).png().toBuffer();
      parts.push(await cutout(crop, options));
    }
    return parts;
  } catch (fixedError) {
    try { return await adaptiveSplit(input, cols, rows, options); }
    catch (adaptiveError) { throw Error('Fixed grid: ' + fixedError.message + '; adaptive gaps: ' + adaptiveError.message); }
  }
}
async function atlas(input, out, options = {}) {
  const parts = await split(input, 3, 3, options);
  const scale = Math.min(440 / Math.max(...parts.map(p => p.box.width)), 440 / Math.max(...parts.map(p => p.box.height)));
  const layers = [], boxes = [];
  fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i], w = Math.round(p.box.width * scale), h = Math.round(p.box.height * scale);
    const trimmed = await sharp(p.png).extract({ left: p.box.x, top: p.box.y, width: p.box.width, height: p.box.height }).resize(w, h).png().toBuffer();
    const x = Math.round((512 - w) / 2), y = 470 - h;
    const frame = await sharp({ create: { width: 512, height: 512, channels: 4, background: '#00000000' } }).composite([{ input: trimmed, left: x, top: y }]).png().toBuffer();
    fs.writeFileSync(path.join(out, 'frames', `${i}.png`), frame);
    boxes.push({ x, y, width: w, height: h });
    layers.push({ input: frame, left: i % 3 * 512, top: Math.floor(i / 3) * 512 });
  }
  const file = path.join(out, 'atlas.png');
  await sharp({ create: { width: 1536, height: 1536, channels: 4, background: '#00000000' } }).composite(layers).png().toFile(file);
  return { file, boxes, metrics: parts.map(p => p.metrics) };
}
module.exports = { cutout, split, atlas, bounds };
