import {GM_SPELL_IDS} from './spell-workflow-policies'
import type {GmSpellChoice} from '../persistence/gm-spell-choice-schema'
export const G_ILLUSIONS=['minor-illusion','silent-image','major-image','disguise-self','illusory-script']
export const G_CONTINUOUS=['mage-hand','silent-image','major-image','detect-magic','detect-evil-and-good','detect-poison-and-disease','beast-sense','detect-thoughts','clairvoyance','locate-object','locate-animals-or-plants','speak-with-animals','speak-with-plants','tongues','comprehend-languages']
const choices:Record<string,{operations:string[];labels:string[];size?:number;weight?:number;words?:number;material?:{name:string;gp:number;consume:boolean};checks:string[]}>={
 druidcraft:{operations:['weather','nature','sensory','flame'],labels:['24小时天气征兆','开花／种子','微小感官效果','点燃／熄灭小火'],size:5,checks:['效果仅在规则允许的微小规模，无伤害或凭空生物']},
 elementalism:{operations:['air','earth','fire','water'],labels:['空气','土壤','火焰','清水'],size:5,checks:['各元素按原文规模／消失期限，不产生无限资源']},
 'mage-hand':{operations:['hand'],labels:['召唤法师之手'],weight:10,checks:['不能攻击、激活魔法物品或搬运超过10磅','操作／移动须实际魔法动作，不能开锁冒充已解锁']},
 mending:{operations:['repair'],labels:['修复一处破损'],size:1,checks:['仅一处不超过1尺的断裂／破损，不恢复魔法性质']},
 message:{operations:['message'],labels:['传讯与一次回复'],words:0,checks:['明确接收者和穿透／可传递条件，只有接收者听见']},
 'minor-illusion':{operations:['sound','image'],labels:['声音','物件影像'],size:5,checks:['影像只为物件，无光／气味等其他感官；研究／接触按观察者']},
 prestidigitation:{operations:['sensory','clean','warm','mark','trinket'],labels:['微小感官效果','清洁／弄脏','冷暖／调味','标记／符号','小物件／幻象'],size:1,checks:['同时至多3项非瞬间效果，各自期限不重置']},
 thaumaturgy:{operations:['voice','flame','tremor','sound','door','eyes'],labels:['声音','火焰','无害震动','声响','未锁门窗','眼部外观'],checks:['最多3项1分钟效果；不能凭此解锁']},
 'comprehend-languages':{operations:['understand'],labels:['理解口语／接触文字'],checks:['只理解字面，不解密码或获得说写该语言能力；阅读须接触']},
 'detect-evil-and-good':{operations:['sense'],labels:['感知规定类型／圣化'],checks:['仅原文生物类别和圣化／亵渎；检查材料阻隔']},
 'detect-magic':{operations:['sense'],labels:['感知魔法'],checks:['灵光观察须魔法动作和可见对象；不自动揭露整份物品或秘密']},
 'detect-poison-and-disease':{operations:['sense'],labels:['感知毒素／疾病'],checks:['类型与位置由已确认实际事实决定，检查材料阻隔']},
 'disguise-self':{operations:['appearance'],labels:['外观伪装'],checks:['体型／基本构造与±1尺身高限制；不改变属性或触感']},
 identify:{operations:['identify'],labels:['鉴定实际物件／受术生物'],material:{name:'珍珠',gp:100,consume:false},checks:['接触目标并完成施法；受回避侦测保护者不可被指定']},
 'illusory-script':{operations:['script'],labels:['写下迷幻手稿'],material:{name:'铅墨',gp:10,consume:true},checks:['读者权限、真视及文字内容按原文；不把真文公开给其他读者']},
 'silent-image':{operations:['image'],labels:['无声影像'],size:15,checks:['只有视觉，移动须魔法动作；识破是观察者自己的知识']},
 'speak-with-animals':{operations:['communicate'],labels:['与实际野兽沟通'],checks:['不改变野兽已知事实、态度、智力或控制权']},
 'animal-messenger':{operations:['deliver'],labels:['由实际小型信使传话'],words:25,checks:['目标须符合原文的实际微型野兽；路线／接收者由GM核对，不创建新生物']},
 augury:{operations:['plan'],labels:['未来30分钟计划'],material:{name:'卜筮标记',gp:25,consume:false},checks:['只回答吉／凶／吉凶／无；重复概率自动记录']},
 'beast-sense':{operations:['sense'],labels:['连接自愿野兽感官'],checks:['接触自愿野兽；2024正文不附加失去自身视听条件，不擅加旧版限制']},
 'detect-thoughts':{operations:['sense','surface'],labels:['感应思绪存在','读取表层思绪'],checks:['理解资格、范围、深入豁免与目标知情逐次核对；不自动扫秘密']},
 'find-traps':{operations:['sense'],labels:['查知陷阱存在'],checks:['视线内原文定义的陷阱；不直接公开精确位置或解除方法']},
 'locate-animals-or-plants':{operations:['locate'],labels:['寻找指定种类'],checks:['5英里范围最近对象；世界信息由GM确认，不伪造地图数据']},
 'locate-object':{operations:['locate'],labels:['寻找熟悉物件／种类'],checks:['1000尺、熟悉或类型条件及铅阻隔；不是全图GPS']},
 clairvoyance:{operations:['sensor'],labels:['选择视觉／听觉传感点'],material:{name:'感官焦点',gp:100,consume:false},checks:['1英里熟悉／明显位置，感官类型明确，切换须附赠动作；感知投影和回避侦测']},
 'major-image':{operations:['image'],labels:['多感官影像'],size:20,checks:['不能真实伤害／状态；温度气味声音按原文无害范围；研究按观察者']},
 sending:{operations:['send'],labels:['向熟悉者短讯'],words:25,checks:['明确熟悉接收者；跨位面5%失败使用保存骰；回复限一次且不超25词']},
 'speak-with-dead':{operations:['question'],labels:['向一具实际遗骸提问'],checks:['遗骸仍有嘴、不是亡灵；最多5问，同一遗骸10日限制；只问生前知识']},
 'speak-with-plants':{operations:['communicate'],labels:['与实际植物沟通'],checks:['植物能提供的经历和简单协助按原文，不获得未经历的事实']},
 tongues:{operations:['understand'],labels:['接触目标获得语言理解'],checks:['只改变原文沟通资格，不改变记忆、态度或控制']},
}
export const G_RULES=Object.fromEntries(GM_SPELL_IDS.map(id=>[id,choices[id]!]))
export function validateGChoice(id:string,c:GmSpellChoice={}){
 const rule=G_RULES[id];if(!rule)return
 if(c.operation&&!rule.operations.includes(c.operation))throw Error('该法术不支持所选操作')
 if(rule.size!==undefined&&c.size!==undefined&&c.size>rule.size)throw Error('效果尺寸超过本术规则上限：'+rule.size+'尺')
 if(rule.weight!==undefined&&c.weight!==undefined&&c.weight>rule.weight)throw Error('物件重量超过本术上限：'+rule.weight+'磅')
 if(rule.words&&c.wordCount!==undefined&&c.wordCount>rule.words)throw Error('消息超过本术'+rule.words+'词上限')
 if(rule.words&&c.description&&/\s/.test(c.description.trim())&&c.description.trim().split(/\s+/).length>rule.words)throw Error('消息超过本术词数上限')
}
