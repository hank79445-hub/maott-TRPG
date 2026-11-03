import sharp from 'sharp'
import type {MapAsset} from '../src/core/map-types'
/** Original vector teaching plans, rendered locally; no downloaded artwork. */
export async function originalMaps():Promise<{asset:MapAsset;svg:string}[]> {
  const palettes=[['#c5d0c5','#e4e4d7','#79958a'],['#b8a58c','#dfd4b9','#88735d'],['#a9b2a5','#d4d7c7','#70877e']]
  const result=[]
  for(let i=0;i<3;i++){
    const [base,floor,border]=palettes[i]!
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720"><defs><pattern id="tile" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="${base}"/><path d="M0 0H60V60" stroke="${border}" stroke-opacity=".22" fill="none"/></pattern><pattern id="wood" width="120" height="24" patternUnits="userSpaceOnUse"><rect width="120" height="24" fill="${floor}"/><path d="M0 23H120M60 0V24" fill="none" stroke="${border}" stroke-opacity=".2"/></pattern></defs><rect width="960" height="720" fill="url(#tile)"/><rect x="20" y="20" width="920" height="680" rx="18" fill="none" stroke="${border}" stroke-width="12"/><rect x="60" y="60" width="840" height="600" rx="9" fill="url(#wood)"/><path d="M60 510H900M660 60V660" fill="none" stroke="${border}" stroke-opacity=".2" stroke-width="3"/><g fill="${border}" opacity=".75"><rect x="750" y="70" width="100" height="70" rx="6"/><rect x="770" y="152" width="80" height="70" rx="6"/><rect x="82" y="560" width="90" height="60" rx="6"/></g><g fill="#dfc97d" stroke="${border}" stroke-width="3"><circle cx="92" cy="92" r="17"/><circle cx="870" cy="622" r="17"/></g><path d="M62 420h80m660 0h96" stroke="#f6f0d7" stroke-width="14" stroke-linecap="round"/><text x="890" y="680" text-anchor="end" fill="${border}" font-size="19" font-family="Georgia">${['I','II','III'][i]} · LAMPLIT INN</text></svg>`
    const data=await sharp(Buffer.from(svg)).png().toBuffer()
    result.push({svg,asset:{id:'lamplit-map-'+i,name:['庭院','大厅','地窖'][i]+' · 原创示意图',mime:'image/png' as const,width:960,height:720,blob:new Blob([new Uint8Array(data)],{type:'image/png'})}})
  }
  return result
}
