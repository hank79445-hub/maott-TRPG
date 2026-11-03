import type { RoomView } from '../online/protocol'
import type { RoomQqSummary, RoomStatusItem } from '../online/room-status-types'
import { pendingRoomReviews, pendingBattleReview } from './room-review-queue'
import {i18n} from '../app/i18n'
const {t}=i18n.global
export function roomRunStatus(v: RoomView, qq: RoomQqSummary | null): RoomStatusItem[] {
  if (v.self.role !== 'gm') return []
  const reviews = pendingRoomReviews(v)
  const extra =
    (v.characterRequests ?? []).filter((x) => x.status === 'pending').length +
    (v.lanRequests ?? []).filter((x) => x.status === 'pending').length
  const dice = v.dice?.pending.length ?? 0
  const battle = pendingBattleReview(v)
  const jobs = v.ai.jobs.filter((j) => !j.historical && !j.activityTest)
  const generating = jobs.filter((j) => ['queued', 'running'].includes(j.status))
  const modelFailures = jobs.filter(
    (j) =>
      ['fallback', 'interrupted'].includes(j.status) ||
      (j.status !== 'published' &&
        j.status !== 'rejected' &&
        j.dialogueReview?.audit?.status === 'escalated'),
  )
  const audit = generating.filter(
    (j) => j.dialogueReview?.audit && ['queued', 'running'].includes(j.dialogueReview.audit.status),
  ).length
  const gmAudits = (v.gmReview?.jobs ?? []).filter(
    (j) =>
      j.branchId === v.broadcast.branchId &&
      j.method === 'model' &&
      !j.gmDecision &&
      ['queued', 'running', 'suggested', 'escalated'].includes(j.status),
  )
  const gmWaiting = gmAudits.filter((j) => ['queued', 'running'].includes(j.status)).length
  return [
    {
      id: 'review',
      title: t('room.runReview'),
      count: reviews.count + extra,
      detail: t('room.runReviewDetail',{count:reviews.count+extra}),
      target: 'quick-review',
      tone: reviews.count + extra ? 'waiting' : 'normal',
    },
    {
      id: 'dice',
      title: t('room.runDice'),
      count: dice,
      detail: t('room.runDiceDetail',{count:dice}),
      target: 'quick-review',
      tone: dice ? 'waiting' : 'normal',
    },
    {
      id: 'battle',
      title: t('room.runRules'),
      count: battle ? 1 : 0,
      detail: battle
        ? t('room.runBattlePending')
        : t('room.runBattleClear'),
      target: 'quick-review',
      tone: battle ? 'waiting' : 'normal',
    },
    {
      id: 'model',
      title: t('room.runModels'),
      count: generating.length + modelFailures.length,
      detail: t('room.runModelsDetail',{waiting:generating.length-audit,audit,failed:modelFailures.length}),
      target: 'ai',
      tone: modelFailures.length ? 'error' : generating.length ? 'waiting' : 'normal',
    },
    {
      id: 'gm-model-review',
      title: t('room.runAssisted'),
      count: gmAudits.length,
      detail: t('room.runAssistedDetail',{waiting:gmWaiting,suggestions:gmAudits.length-gmWaiting}),
      target: 'intents',
      tone: gmAudits.length > gmWaiting ? 'error' : gmWaiting ? 'waiting' : 'normal',
    },
    {
      id: 'qq',
      title: t('room.runQq'),
      count: qq ? qq.queued + qq.failed + qq.unknown : null,
      detail: !qq
        ? t('room.runQqUnknown')
        : !qq.enabled
          ? t('room.runQqOff')
          : t('room.runQqDetail',{mode:v.messageDelivery==='web'?t('room.runQqWeb')+' ':'',queued:qq.queued,failed:qq.failed,unknown:qq.unknown,paused:qq.pausedBots}),
      target: 'integration',
      tone: qq?.failed || qq?.unknown ? 'error' : !qq || qq.queued ? 'waiting' : 'normal',
    },
  ]
}
