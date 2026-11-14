"""QA contact sheets and objective image measurements; originals are never modified."""
from pathlib import Path
import json
from PIL import Image, ImageDraw
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'docs'/'visual-review'


def dark_share(image, box):
    values=np.asarray(image.crop(box).convert('RGB'),dtype=float)
    luma=values@np.array([.2126,.7152,.0722])
    return float((luma<80).mean())


def comparison(reference,render,destination):
    first=Image.open(reference).convert('RGB');second=Image.open(render).convert('RGB')
    result=Image.new('RGB',(first.width*2,first.height+45),'#f7f3ef')
    result.paste(first,(0,45));result.paste(second,(first.width,45))
    draw=ImageDraw.Draw(result)
    draw.text((20,14),'REFERENCIA DEL USUARIO',fill='#4a4139')
    draw.text((first.width+20,14),'AEGIS - ATLAS REAL / REVISION 2 (sin imagen aprobada previa)',fill='#4a4139')
    result.save(destination)
    result.resize((900,round(result.height*900/result.width)),Image.Resampling.LANCZOS).save(destination.with_name(destination.stem+'-900.png'))


def main():
    comparison(ROOT/'references/home.png',OUTPUT/'round2-home.png',OUTPUT/'comparison-home.png')
    comparison(ROOT/'references/cardiovascular.png',OUTPUT/'round2-cardiovascular.png',OUTPUT/'comparison-cardiovascular.png')
    reference=Image.open(ROOT/'references/home.png');render=Image.open(OUTPUT/'round2-home.png')
    reference_box=(505,30,890,900);render_box=(520,30,860,887)
    report={'method':'Manually reviewed body bounding boxes; luma threshold 80. Original images preserved.',
        'reference':{'box':reference_box,'body_height_ratio':870/reference.height,'dark_share':dark_share(reference,reference_box)},
        'render':{'box':render_box,'body_height_ratio':857/render.height,'dark_share':dark_share(render,render_box)}}
    report['dark_share_ratio']=report['render']['dark_share']/max(report['reference']['dark_share'],1e-9)
    (OUTPUT/'measurements.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
