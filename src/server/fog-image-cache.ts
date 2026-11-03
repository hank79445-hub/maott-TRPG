import sharp from 'sharp'
import type { MapAsset } from '../core/map-types'
const sources = new Map<string, { blob: Blob; work: Promise<Buffer>; bytes: number }>()
let sourceBytes = 0
let running = 0
const waiting: (() => void)[] = []
export class FogImageQueueError extends Error {}
export async function imageSlot<T>(run: () => Promise<T>): Promise<T> {
  if (running >= 2) {
    if (waiting.length >= 24) throw new FogImageQueueError('探索底图生成队列繁忙，请稍后重试')
    await new Promise<void>(resolve => waiting.push(resolve))
  } else running++
  try { return await run() } finally {
    const next = waiting.shift()
    if (next) next(); else running--
  }
}
/** Private server-side source PNGs, bounded by retained source/output bytes and count. */
export function fogSource(roomId: string, asset: MapAsset): Promise<Buffer> {
  const key=roomId+':'+asset.id, old=sources.get(key)
  if(old?.blob===asset.blob){sources.delete(key);sources.set(key,old);return old.work}
  if(old){sourceBytes-=old.bytes;sources.delete(key)}
  const row={blob:asset.blob,bytes:0,work:Promise.resolve(Buffer.alloc(0))}
  row.work=(async()=>{
    try {
      const source=await sharp(Buffer.from(await asset.blob.arrayBuffer()),{limitInputPixels:64_000_000}).resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).png().toBuffer()
      if(sources.get(key)===row){row.bytes=source.length+asset.blob.size;sourceBytes+=row.bytes}
      while(sources.size>16||sourceBytes>64*1024*1024){const first=sources.keys().next().value;if(!first)break;sourceBytes-=sources.get(first)!.bytes;sources.delete(first)}
      return source
    }catch(error){if(sources.get(key)===row){sources.delete(key);sourceBytes-=row.bytes}throw error}
  })()
  sources.set(key,row)
  return row.work
}
