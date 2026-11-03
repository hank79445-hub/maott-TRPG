import type {SocialDecision} from '../persistence/practical-social-schema'
type Operations=NonNullable<SocialDecision['rule']>['success']['operations']
export function remapSocialOperations(ops:Operations,point:(id:string)=>string,battle:(id:string)=>string):Operations{
 return ops?.map(op=>op.kind==='interaction'?{...op,pointId:point(op.pointId)}:op.kind==='battle-support'?{...op,presetId:battle(op.presetId)}:{...op})
}
