"""Compare three independently decoded film chapters with the final signed artwork."""
import argparse
import hashlib
import json
import math
import subprocess
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat

PUBLIC = Path(__file__).resolve().parents[3] / 'public'
STAGES = [('existing',1),('construction',5),('future',9)]
SIZE = (1920,1080)
CITY = (0,0,1920,912)
CREDIT = (43,925,312,1007)
COMPASS = (1710,925,1888,1012)


def psnr(left,right,region):
    difference = ImageChops.difference(left.crop(region),right.crop(region))
    histogram = difference.histogram()
    n = difference.width*difference.height*3
    mse = sum((i%256)**2*count for i,count in enumerate(histogram))/n
    return round(10*math.log10(255**2/mse),3) if mse else 100.0


def black_ink(picture,region):
    return sum(picture.crop(region).convert('L').histogram()[:125])


def check_block_nine_shafts(frame, source, observations):
    probes = {}
    for role, tower in [('16','north'), ('17','south')]:
        if role not in observations:
            continue
        nx, ny = observations[role]['normalized']
        x, y = round(nx*frame.width), round(ny*frame.height)
        region = (x-1, y-1, x+2, y+2)
        reference = ImageStat.Stat(source.crop(region)).median
        decoded = ImageStat.Stat(frame.crop(region)).median
        assert max(abs(a-b) for a,b in zip(reference,decoded)) <= 12, (tower,reference,decoded)
        probes[tower] = dict(pixel=[x,y], signedMedianRGB=reference, decodedMedianRGB=decoded)
    return probes


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workspace',type=Path)
    parser.add_argument('--edition',default='20261121')
    parser.add_argument('--surface-observations',type=Path,
                        help='Compare the visible Block Nine shafts at the optically reviewed camera coordinates.')
    args=parser.parse_args()
    current=args.workspace.resolve()
    work=current/'film'
    film=PUBLIC/'gallery'/('edition-'+args.edition)/'Downtown-film.mp4'
    receipt=json.loads((work/'final-encoding.json').read_text())
    surfaces=json.loads(args.surface_observations.read_text()) if args.surface_observations else {}
    assert hashlib.sha256(film.read_bytes()).hexdigest()==receipt['filmSHA256']
    sources={}
    rows=[]
    for stage,_ in STAGES:
        stem='wide-downtown-skyline-'+stage
        signed=json.loads((current/'original-receipts'/(stem+'.json')).read_text())['download']
        path=PUBLIC/signed['url']
        assert signed['sha256']==hashlib.sha256(path.read_bytes()).hexdigest()
        assert signed['sha256']==next(record['signedSHA256'] for record in receipt['frames'] if record['stage']==stage)
        with Image.open(path) as raw:
            sources[stage]=raw.convert('RGB').resize(SIZE, Image.Resampling.LANCZOS)
    review=Image.new('RGB',(1056,752),'#f5f5f2')
    draw=ImageDraw.Draw(review)
    font=ImageFont.load_default(size=19)
    for i,(stage,second) in enumerate(STAGES):
        encoded=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(second),
            '-i',str(film),'-frames:v','1','-f','image2pipe','-vcodec','png','-'])
        with Image.open(BytesIO(encoded)) as picture:
            frame=picture.convert('RGB')
        assert frame.size==SIZE
        scores={key:psnr(frame,source,CITY) for key,source in sources.items()}
        assert max(scores,key=scores.get)==stage, (stage,scores)
        assert scores[stage]>=30,(stage,scores)
        detail={}
        for label,region in [('credit',CREDIT),('compass',COMPASS)]:
            ink=black_ink(frame,region)
            score=psnr(frame,sources[stage],region)
            assert ink>45 and score>=30,(label,stage,score,ink)
            detail[label]={'region':region,'sourcePSNRdB':score,'decodedDarkPixels':ink}
        left=20
        y=20+245*i
        review.paste(frame.resize((358,201),Image.Resampling.LANCZOS),(left,y+25))
        review.paste(frame.crop(CREDIT).resize((323,98),Image.Resampling.LANCZOS),(398,y+71))
        review.paste(frame.crop(COMPASS).resize((249,122),Image.Resampling.LANCZOS),(765,y+59))
        draw.text((left,y),f'{second}s  {stage}',font=font,fill='#292b29')
        if i==0:
            draw.text((398,y),'Signature at playback resolution',font=font,fill='#292b29')
            draw.text((765,y),'North arrow',font=font,fill='#292b29')
        rows.append(dict(stage=stage,second=second,cityPSNRdB=scores,**detail))
        identity=f'wide/downtown-skyline-{stage}.png'
        if identity in surfaces:
            rows[-1]['blockNineShafts'] = check_block_nine_shafts(frame,sources[stage],surfaces[identity])
    review.save(work/'decoded-chapters.jpg',quality=92)
    report={'edition':args.edition,'filmSHA256':receipt['filmSHA256'],'sampledSceneRegion':CITY,
            'phoneImageWidth':358,'samples':rows}
    (work/'decoded-chapters.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__=='__main__':
    main()
