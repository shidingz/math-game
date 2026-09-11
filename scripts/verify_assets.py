from pathlib import Path
from PIL import Image
import numpy as np
import json
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'manifest.json').read_text())
checks=[]
for stage in manifest['stages']:
    atlas=Image.open(root/stage['png'])
    assert atlas.mode=='RGBA' and atlas.size==(2048,2560)
    for frame in manifest['frames']:
        name=f"stage-{stage['id']}-{frame['name']}.png"
        im=Image.open(root/'assets'/name)
        a=np.array(im)
        assert im.mode=='RGBA' and im.size==(512,640)
        assert (a[:,:,3]==0).mean()>.3
        assert (a[:,:,3]==255).sum()>5000
        assert not a[0,:,3].any() and not a[-1,:,3].any() and not a[:,0,3].any() and not a[:,-1,3].any()
        tile=atlas.crop((frame['x'],frame['y'],frame['x']+512,frame['y']+640))
        assert np.array_equal(a,np.array(tile))
        checks.append({'file':name,'transparent':True,'uncropped':True,'atlasMatches':True})
report={'ok':True,'frames':len(checks),'checks':checks}
(root/'qa'/'transparency-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('PASS: 48 alpha-transparent frames, no frame-edge clipping; atlas pixels match all source frames.')
