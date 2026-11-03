export const BUILTIN_PACK_IDS=['srd-5.2.1'] as const
export const isBuiltinPack=(id:string)=>BUILTIN_PACK_IDS.some(pack=>pack===id)
