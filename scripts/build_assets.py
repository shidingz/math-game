"""Deterministic extraction of ImageGen artwork; does not draw character art."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
QA = ROOT / 'qa'
OUT.mkdir(exist_ok=True)
QA.mkdir(exist_ok=True)
NAMES = ['idle','blink','wave-a','wave-b','pet-a','pet-b','feed-a','feed-b',
         'think','comfort','celebrate','jump','sleep','run-a','run-b','skill']
W,H,BASELINE = 512,640,588
report = {'cell': [W,H], 'baseline': BASELINE, 'stages': []}

def label_runs(mask):
    labels=np.zeros(mask.shape,dtype=np.int32)
    parents=[0];previous=[]
    def root(i):
        while parents[i]!=i:
            parents[i]=parents[parents[i]];i=parents[i]
        return i
    for y,row in enumerate(mask):
        padded=np.pad(row.astype(np.int8),(1,1))
        delta=np.diff(padded)
        starts=np.flatnonzero(delta==1);ends=np.flatnonzero(delta==-1)
        current=[];j=0
        for a,b in zip(starts,ends):
            while j<len(previous) and previous[j][1]<=a:j+=1
            hits=[];k=j
            while k<len(previous) and previous[k][0]<b:
                hits.append(root(previous[k][2]));k+=1
            if hits:
                lab=min(hits)
                for other in hits:parents[root(other)]=lab
            else:
                lab=len(parents);parents.append(lab)
            labels[y,a:b]=lab;current.append((a,b,lab))
        previous=current
    lut=np.array([root(i) for i in range(len(parents))])
    return lut[labels],len(parents)-1

def key_image(path):
    im = Image.open(path).convert('RGB')
    rgb = np.array(im).astype(np.float32)
    # Magenta color-difference key. Character reds, blue cloth, cream fur and
    # green leaves have low min(R,B)-G and therefore remain fully opaque.
    excess = np.minimum(rgb[:,:,0],rgb[:,:,2]) - rgb[:,:,1]
    alpha = np.clip((150-excess)/100,0,1)
    alpha[excess<=50]=1
    opaque = alpha>=.995
    edge = (alpha>0)&(~opaque)
    # Deterministic local color extension through the thin translucent edge.
    known=opaque.copy()
    for _ in range(6):
        for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
            neighbor=np.roll(known,(dy,dx),(0,1))
            if dy==1: neighbor[0,:]=False
            if dy==-1: neighbor[-1,:]=False
            if dx==1: neighbor[:,0]=False
            if dx==-1: neighbor[:,-1]=False
            take=edge & ~known & neighbor
            shifted=np.roll(rgb,(dy,dx),(0,1))
            rgb[take]=shifted[take];known[take]=True
    rgb[alpha==0]=0
    rgba=np.dstack([rgb,np.rint(alpha*255)]).astype(np.uint8)
    mask=rgba[:,:,3]>48
    labels,count=label_runs(mask)
    sizes=np.bincount(labels.ravel());sizes[0]=0
    main=np.where(sizes>1200)[0]
    components=[]
    for lab in main:
        ys,xs=np.where(labels==lab)
        components.append({'label':int(lab),'bbox':(int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)),
                           'cx':float(xs.mean()),'cy':float(ys.mean()),'area':int(len(xs))})
    components.sort(key=lambda c:(int(c['cy']/(im.height/2)),c['cx']))
    if len(components)!=8:
        raise ValueError(f'{path.name}: Expected 8 separated silhouettes, found {len(components)}')
    return Image.fromarray(rgba),components,labels

for stage in range(1,4):
    frames=[];info=[]
    for sheet_index,suffix in enumerate(['a','b']):
        path=ROOT/'source'/f'stage-{stage}-{suffix}.png'
        rgba,components,labels=key_image(path)
        source=np.array(rgba)
        cw,ch=rgba.width/4,rgba.height/2
        for i,c in enumerate(components):
            x0,y0,x1,y1=c['bbox']
            # Include subpixel edge, but never a neighboring silhouette.
            pad=3
            x0=max(0,x0-pad);y0=max(0,y0-pad);x1=min(rgba.width,x1+pad);y1=min(rgba.height,y1+pad)
            region=source[y0:y1,x0:x1].copy()
            keep=np.array(Image.fromarray((labels[y0:y1,x0:x1]==c['label']).astype('uint8')*255).filter(ImageFilter.MaxFilter(7)))>0
            region[~keep]=0
            crop=Image.fromarray(region)
            # A fixed 1:1 scale across all states preserves actual seated/jump
            # proportions. Register x to the original grid and feet to baseline.
            anchor=(i%4+.5)*cw
            px=int(W/2+x0-anchor)
            py=BASELINE-(c['bbox'][3]-y0)
            frame=Image.new('RGBA',(W,H))
            frame.alpha_composite(crop,(px,py))
            name=NAMES[sheet_index*8+i]
            frame.save(OUT/f'stage-{stage}-{name}.png')
            bounds=frame.getbbox()
            clipped_source=(c['bbox'][0]<=1 or c['bbox'][1]<=1 or c['bbox'][2]>=rgba.width-1 or c['bbox'][3]>=rgba.height-1)
            info.append({'name':name,'source':path.name,'sourceBounds':c['bbox'],'bounds':bounds,
                         'sourceEdgeTouch':clipped_source,'nonempty':bounds is not None})
            frames.append(frame)
    atlas=Image.new('RGBA',(W*4,H*4))
    for i,f in enumerate(frames):atlas.alpha_composite(f,((i%4)*W,(i//4)*H))
    atlas.save(OUT/f'stage-{stage}.png')
    atlas.save(OUT/f'stage-{stage}.webp',lossless=True,method=6)
    frames[0].save(OUT/f'stage-{stage}-portrait.png')
    contact=Image.new('RGB',(1000,1280),'#e8edf3')
    d=ImageDraw.Draw(contact)
    for i,f in enumerate(frames):
        thumb=f.resize((240,300),Image.Resampling.LANCZOS)
        x=(i%4)*250;y=(i//4)*320
        contact.paste(thumb,(x+5,y),thumb)
        d.text((x+12,y+299),NAMES[i],fill='#24354b')
    contact.save(QA/f'stage-{stage}-contact.jpg',quality=90)
    # Real pose-frame contact GIFs for QA, not runtime animations.
    for action,ids in {'idle':[0,0,0,1,0],'wave':[2,3,2,3],'feed':[6,7,6,7],'run':[13,14,13,14]}.items():
        previews=[]
        for n in ids:
            bg=Image.new('RGBA',(W,H),'#e8edf3');bg.alpha_composite(frames[n])
            previews.append(bg.convert('RGB').resize((256,320)))
        previews[0].save(QA/f'stage-{stage}-{action}.gif',save_all=True,append_images=previews[1:],duration=220,loop=0)
    report['stages'].append({'stage':stage,'frames':info,'atlas':[W*4,H*4]})
report['ok']=all(f['nonempty'] and not f['sourceEdgeTouch'] for s in report['stages'] for f in s['frames'])
(QA/'assets-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'ok':report['ok'],'frames':48,'edgeWarnings':[
    f"{s['stage']}:{f['name']}" for s in report['stages'] for f in s['frames'] if f['sourceEdgeTouch']]}))
