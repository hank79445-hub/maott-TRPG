import type {Room,RoomCommand} from '../online/protocol'
import {practicalSocialDiceFingerprint} from './practical-social'
import {practicalIntentDiceFingerprint} from './practical-intents'
export function practicalDiceFingerprint(r:Room,c:RoomCommand){return c.kind==='npc-talk-review'?practicalSocialDiceFingerprint(r,c.jobId):c.kind==='intent-review'?practicalIntentDiceFingerprint(r,c.intentId):undefined}
