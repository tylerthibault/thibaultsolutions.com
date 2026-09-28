import type { EffectStack } from "../schema.js";

const num = (params: Record<string, string | number | boolean>, key: string, fallback: number) => typeof params[key] === "number" ? Number(params[key]) : fallback;
const txt = (params: Record<string, string | number | boolean>, key: string, fallback: string) => typeof params[key] === "string" ? String(params[key]) : fallback;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const safeColor = (value: string, fallback = "white") => /^#[0-9a-f]{6}$/i.test(value) ? `0x${value.slice(1)}` : fallback;
const safeText = (value: string) => value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "’").slice(0, 80);

export function filterForEffect(effect: EffectStack[number]): string {
  const p = effect.params;
  const s = effect.seed % 17;
  switch (effect.effectId) {
    case "horizontal-band-shift": return `crop=iw-mod(iw\\,2):ih-mod(ih\\,2),shear=shx=${(num(p,"shift",28)/900).toFixed(3)}:fillcolor=black`;
    case "binary-grid": return `scale=iw/${Math.round(num(p,"size",14))}:ih/${Math.round(num(p,"size",14))}:flags=area,format=gray,lutyuv=y='if(lt(val\\,${Math.round(num(p,"threshold",.5)*255)})\\,0\\,255)',scale=iw*${Math.round(num(p,"size",14))}:ih*${Math.round(num(p,"size",14))}:flags=neighbor`;
    case "digital-rain": return `format=gray,eq=contrast=${num(p,"brightness",1.2)},noise=alls=${Math.round(num(p,"density",.55)*35)}:allf=t+u,drawgrid=w=${Math.round(num(p,"scale",14))}:h=${Math.round(num(p,"scale",14)*2)}:t=1:c=0x55ff77@0.28`;
    case "block-pixelation": { const n=Math.round(num(p,"size",18)); return `scale=ceil(iw/${n}):ceil(ih/${n}):flags=area,scale=iw*${n}:ih*${n}:flags=neighbor`; }
    case "eroded-halftone": return `format=gray,eq=contrast=${num(p,"contrast",1.6)},noise=alls=${Math.round(num(p,"noise",.2)*45)}:allf=u,erosion=coordinates=255`;
    case "ascii-symbols": return `scale=iw/${Math.round(num(p,"size",14))}:ih/${Math.round(num(p,"size",14)*1.7)}:flags=area,format=gray,eq=contrast=${num(p,"contrast",1.4)},scale=iw*${Math.round(num(p,"size",14))}:ih*${Math.round(num(p,"size",14)*1.7)}:flags=neighbor,drawgrid=w=${Math.round(num(p,"size",14))}:h=${Math.round(num(p,"size",14)*1.7)}:t=1:c=white@0.18`;
    case "ember-glyphs": return `eq=brightness=0.05:contrast=1.5:saturation=.35,colorchannelmixer=rr=1.35:gg=.55:bb=.12,noise=alls=${12+s}:allf=t+u,gblur=sigma=${clamp(num(p,"glow",8)/5,.1,4)}`;
    case "topographic-lines": return `format=gray,edgedetect=mode=colormix:high=${clamp(num(p,"threshold",.5),.05,.95)},eq=contrast=2,negate`;
    case "neon-edge-trace": return `edgedetect=low=${clamp(num(p,"sensitivity",.35)/2,.01,.5)}:high=${clamp(num(p,"sensitivity",.35),.05,.95)},colorchannelmixer=rr=.15:rg=.25:gb=.55:bb=1.5,gblur=sigma=${clamp(num(p,"glow",7)/5,.1,4)}`;
    case "repeated-crop-grid": return `scale=iw/${Math.max(1,Math.round(num(p,"columns",3)))}:ih/${Math.max(1,Math.round(num(p,"rows",3)))}:flags=lanczos,tile=${Math.max(1,Math.round(num(p,"columns",3)))}x${Math.max(1,Math.round(num(p,"rows",3)))}`;
    case "cross-stitch-pixels": { const n=Math.round(num(p,"size",10)); return `scale=ceil(iw/${n}):ceil(ih/${n}):flags=area,scale=iw*${n}:ih*${n}:flags=neighbor,drawgrid=w=${n}:h=${n}:t=${Math.max(1,Math.round(num(p,"thickness",2)))}:c=black@.38`; }
    case "date-stamp-burn": return `drawtext=text='${safeText(txt(p,"dateText","09 24 26"))}':fontcolor=0xff7a33@${clamp(num(p,"opacity",.85),.1,1)}:fontsize=h/${Math.round(25/num(p,"scale",1))}:x=24:y=h-th-24:shadowx=2:shadowy=2:shadowcolor=black@.7`;
    case "variable-dot-matrix": { const n=Math.round(num(p,"grid",10)); return `scale=ceil(iw/${n}):ceil(ih/${n}):flags=area,eq=contrast=${num(p,"contrast",1.4)},scale=iw*${n}:ih*${n}:flags=neighbor,vignette=PI/6`; }
    case "mirror-side-panels": return `hflip,boxblur=luma_radius=${Math.round(num(p,"blur",6))}:luma_power=1`;
    case "polygon-fragmentation": return `shear=shx=${(num(p,"rotation",8)/160).toFixed(3)}:shy=${(num(p,"displacement",22)/500).toFixed(3)}:fillcolor=black,drawgrid=w=${Math.max(20,Math.round(240/num(p,"count",12)))}:h=${Math.max(20,Math.round(240/num(p,"count",12)))}:t=${Math.round(num(p,"gap",2))}:c=black@.8`;
    case "progressive-blur": return `dblur=angle=0:radius=${clamp(num(p,"blur",12),0,30)}`;
    case "glitch-bloom": return `rgbashift=rh=${Math.round(num(p,"chromatic",5))}:bh=${-Math.round(num(p,"chromatic",5))},unsharp=7:7:${clamp(num(p,"intensity",1),0,2)},gblur=sigma=${clamp(num(p,"radius",7)/7,.1,3)}`;
    case "datamosh-smear": return `tmix=frames=${Math.max(2,Math.round(num(p,"persistence",5)))}:weights='1 1 1 1 1 1 1 1 1 1 1 1',lagfun=decay=${clamp(num(p,"feedback",.65),.1,.99)}`;
    case "motion-study-grid": return `framestep=2,tile=2x2:nb_frames=4:padding=${Math.round(num(p,"spacing",3))}:margin=0,pad=ceil(iw/2)*2:ceil(ih/2)*2`;
    case "film-gate-flicker": return `eq=brightness='${(num(p,"exposure",.16)/2).toFixed(3)}*sin(7*n)':eval=frame,noise=alls=${Math.round(num(p,"grain",.18)*45)}:allf=t+u,vignette=PI/5`;
    case "ghost-double-print": return `tmix=frames=2:weights='1 ${clamp(num(p,"opacity",.45),.05,.95)}',rgbashift=rh=${Math.round(num(p,"x",8))}:bv=${Math.round(num(p,"y",4))}`;
    case "diagonal-frame-fracture": return `rotate=${(num(p,"angle",28)*Math.PI/180).toFixed(4)}:fillcolor=black@1,scale=iw:ih`;
    case "technical-pen-hatching": return `format=gray,prewitt=scale=${clamp(num(p,"contrast",1.5),.5,3)},drawgrid=w=${Math.round(num(p,"density",8)*2)}:h=${Math.round(num(p,"density",8)*2)}:t=${Math.round(num(p,"thickness",1))}:c=black@.45`;
    case "thermal-hud": return `format=gray,curves=all='0/0 .25/.08 .5/.75 .75/.95 1/1',colorchannelmixer=rr=1.8:rg=.5:gg=.55:gb=.4:bb=.15,drawgrid=w=64:h=64:t=1:c=0xa3ff12@${clamp(num(p,"hud",.65),0,1)}`;
    case "fisheye-lens": return `lenscorrection=k1=${(-num(p,"strength",.3)).toFixed(3)}:k2=${(num(p,"strength",.3)/3).toFixed(3)}:cx=${num(p,"centerX",.5)}:cy=${num(p,"centerY",.5)}`;
    case "wavy-scanlines": return `shear=shx=${(num(p,"amplitude",8)/500).toFixed(4)}:fillcolor=black,drawgrid=w=iw:h=${Math.round(num(p,"spacing",6))}:t=${Math.round(num(p,"thickness",1))}:c=white@.18`;
    case "luminance-flow": return `format=gray,sobel=scale=${clamp(num(p,"sensitivity",.5)*3,.1,3)},dblur=angle=${num(p,"curvature",.5)*Math.PI}:radius=${clamp(num(p,"length",12),1,30)}`;
    case "particle-reconstruction": return `noise=alls=${Math.round(num(p,"movement",3)*4+8)}:allf=t+u,erosion=coordinates=255,scale=iw/2:ih/2:flags=area,scale=iw*2:ih*2:flags=neighbor`;
    case "mirror-double-exposure": return `hflip,tmix=frames=2:weights='1 ${clamp(num(p,"opacity",.55),.05,.95)}',colorchannelmixer=rr=.8:gg=.9:bb=1.2`;
    case "monochrome-dither": return `format=gray,eq=contrast=${num(p,"contrast",1.4)},lutyuv=y='if(lt(val\\,${Math.round(num(p,"threshold",.5)*255)})\\,0\\,255)',noise=alls=8:allf=u`;
    case "machine-vision-overlay": return `drawgrid=w=80:h=80:t=${Math.round(num(p,"thickness",1))}:c=${safeColor(txt(p,"color","#a3ff12"))}@.45,drawbox=x=iw*.18:y=ih*.2:w=iw*.24:h=ih*.34:t=2:c=${safeColor(txt(p,"color","#a3ff12"))}@.8,drawbox=x=iw*.56:y=ih*.42:w=iw*.22:h=ih*.28:t=2:c=${safeColor(txt(p,"color","#a3ff12"))}@.8`;
    case "quantized-pixel-art": { const n=Math.round(num(p,"resolution",14)); return `scale=ceil(iw/${n}):ceil(ih/${n}):flags=neighbor,elbg=codebook_length=${Math.max(2,Math.round(num(p,"palette",8)))}:nb_steps=1,scale=iw*${n}:ih*${n}:flags=neighbor`; }
    case "magazine-halftone": return `format=gray,eq=contrast=${num(p,"contrast",1.4)},drawgrid=w=${Math.round(num(p,"frequency",8))}:h=${Math.round(num(p,"frequency",8))}:t=${Math.max(1,Math.round(num(p,"size",4)/2))}:c=black@.5`;
    case "crt-phosphor-mesh": return `rgbashift=rh=1:bh=-1,drawgrid=w=${Math.max(2,Math.round(num(p,"mesh",3)*2))}:h=${Math.max(2,Math.round(num(p,"mesh",3)*2))}:t=1:c=black@${clamp(num(p,"scanline",.4),0,1)},gblur=sigma=${clamp(num(p,"glow",5)/8,.1,2)}`;
    case "cmyk-misregistration": return `rgbashift=rh=${Math.round(num(p,"magenta",5))}:rv=${Math.round(num(p,"yellow",2))}:bh=${Math.round(num(p,"cyan",-4))},noise=alls=${Math.round(num(p,"texture",.18)*25)}:allf=u`;
    case "retro-lcd-screen": { const n=Math.round(num(p,"cell",7)); return `scale=ceil(iw/${n}):ceil(ih/${n}):flags=area,scale=iw*${n}:ih*${n}:flags=neighbor,colorchannelmixer=rr=.7:rg=.25:gg=1.1:bb=.35,tmix=frames=2:weights='1 ${clamp(num(p,"ghosting",.35),.05,.8)}'`; }
    case "rgb-prism-slices": return `rgbashift=rh=${Math.round(num(p,"separation",8))}:gh=0:bh=${-Math.round(num(p,"separation",8))},shear=shx=${(num(p,"angle",0)/400).toFixed(4)}:fillcolor=black`;
    case "relief-grid-3d": return `format=gray,kirsch=scale=${clamp(num(p,"depth",8)/5,.1,5)},dblur=angle=.785:radius=${clamp(num(p,"depth",8),1,30)},drawgrid=w=${Math.round(num(p,"density",10)*2)}:h=${Math.round(num(p,"density",10)*2)}:t=1:c=white@.25`;
    case "analog-scan-tear": return `chromashift=cbh=${Math.round(num(p,"shift",20)/5)}:crh=${-Math.round(num(p,"shift",20)/5)},noise=alls=${Math.round(num(p,"noise",.15)*45)}:allf=t+u,shear=shx=${(num(p,"jitter",.3)/40).toFixed(4)}:fillcolor=black`;
    case "screen-print-layers": return `eq=contrast=1.8:saturation=1.6,lutrgb=r='trunc(val/85)*85':g='trunc(val/85)*85':b='trunc(val/85)*85',noise=alls=${Math.round(num(p,"texture",.25)*25)}:allf=u`;
    case "liquid-ink-bleed": return `gblur=sigma=${clamp(num(p,"radius",7)/2,.1,12)},eq=contrast=1.8,erosion=coordinates=255`;
    case "geometric-masks": return `vignette=angle=${clamp(num(p,"size",.25)*Math.PI,.2,1.4)}:mode=${p.invert ? "backward" : "forward"},drawgrid=w=${Math.max(20,Math.round(180/num(p,"count",8)))}:h=${Math.max(20,Math.round(180/num(p,"count",8)))}:t=2:c=black@.35`;
    case "risograph-dots": return `eq=contrast=${num(p,"contrast",1.4)}:saturation=.8,rgbashift=rh=${Math.round(num(p,"offset",4))}:bh=${-Math.round(num(p,"offset",4))},noise=alls=${Math.round(num(p,"noise",.18)*35)}:allf=u,drawgrid=w=${Math.round(num(p,"frequency",8))}:h=${Math.round(num(p,"frequency",8))}:t=1:c=black@.25`;
    case "survey-data-overlay": return `drawgrid=w=${Math.round(num(p,"grid",40))}:h=${Math.round(num(p,"grid",40))}:t=${Math.round(num(p,"thickness",1))}:c=0x72e8ff@${clamp(num(p,"opacity",.65),0,1)},drawbox=x=iw*.1:y=ih*.1:w=iw*.8:h=ih*.8:t=1:c=0x72e8ff@.65`;
    case "vhs-tape-damage": return `scale=iw/2:ih/2:flags=bicubic,scale=iw*2:ih*2:flags=bicubic,chromashift=cbh=${Math.round(num(p,"chroma",5))}:crh=${-Math.round(num(p,"chroma",5))},noise=alls=${Math.round(num(p,"noise",.2)*55)}:allf=t+u,eq=contrast=.92:saturation=.82`;
    case "woven-thread-pixels": { const n=Math.round(num(p,"size",8)); return `scale=ceil(iw/${n}):ceil(ih/${n}):flags=area,scale=iw*${n}:ih*${n}:flags=neighbor,drawgrid=w=${n}:h=${n}:t=${Math.max(1,Math.round(num(p,"thickness",2)))}:c=white@.32`; }
    case "mosaic-tile-scatter": return `pixelize=w=${Math.round(num(p,"tile",18))}:h=${Math.round(num(p,"tile",18))}:mode=avg,rotate=${(num(p,"rotation",8)*Math.PI/180).toFixed(4)}:fillcolor=black`;
    case "puzzle-collage": return `drawgrid=w=${Math.max(20,Math.round(260/num(p,"pieces",12)))}:h=${Math.max(20,Math.round(260/num(p,"pieces",12)))}:t=${Math.max(1,Math.round(num(p,"border",1)))}:c=white@.75,shear=shx=${(num(p,"displacement",14)/900).toFixed(4)}:fillcolor=black`;
    case "slit-scan-time-slices": return `tmix=frames=${Math.max(2,Math.round(num(p,"span",.5)*10))}:weights='1 1 1 1 1 1 1 1 1 1',dblur=angle=${p.direction === "horizontal" ? "0" : "1.5708"}:radius=${clamp(num(p,"width",10),1,40)}`;
    case "photocopier-toner": return `format=gray,eq=contrast=${num(p,"contrast",2)},lutyuv=y='if(lt(val\\,${Math.round(num(p,"threshold",.5)*255)})\\,0\\,255)',noise=alls=${Math.round(num(p,"noise",.25)*70)}:allf=u`;
    case "microtext-portrait": return `format=gray,eq=contrast=${num(p,"contrast",1.5)},drawtext=text='${safeText(txt(p,"text","CREATIVE CIRCLE"))}':fontcolor=${safeColor(txt(p,"color","#f2f5f1"))}@.42:fontsize=${Math.round(num(p,"size",9))}:x='mod(n*3\\,w)':y='mod(n*2\\,h)'`;
    case "pixel-sorting-streaks": return `dblur=angle=${p.direction === "vertical" ? "1.5708" : "0"}:radius=${clamp(num(p,"length",35)/2,1,60)},eq=contrast=${1+num(p,"range",.55)}`;
    default: return "null";
  }
}

export function filtersForStack(stack: EffectStack) {
  return stack.filter((effect) => effect.enabled).map(filterForEffect).filter(Boolean).join(",");
}
