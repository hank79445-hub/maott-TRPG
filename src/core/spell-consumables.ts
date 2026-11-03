import type {Character} from './types'
import type {Catalogue} from './engine'
import {runtimeState} from './runtime'
export function createGoodberries(c:Character,cat:Catalogue,castId:string){
 if(c.inventory.some(r=>r.itemId==='goodberry'&&r.consumable?.castId===castId))return
 if(c.inventory.length>=5000)throw Error('背包物品条目已满，未创建神莓')
 const hours=runtimeState(c,cat).hours
 c.inventory.push({instanceId:crypto.randomUUID(),itemId:'goodberry',quantity:10,source:'神莓术',equipped:false,
 note:'每颗以附赠动作食用，恢复1HP并提供一天营养；24小时后消失',
 consumable:{kind:'goodberry',value:1,expiresAt:hours+24,clockSourceId:c.id,castId}})
}
