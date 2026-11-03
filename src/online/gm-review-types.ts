import type { ReviewSettings, ReviewOutput } from '../persistence/gm-review-schema'
export type ReviewStatus =
  'queued' | 'running' | 'suggested' | 'escalated' | 'waiting-dice' | 'executed' | 'stale'
export interface GmReviewJob {
  id: string
  intentId: string
  branchId: string
  stamp: string
  policyRevision: number
  mode: 'shadow' | 'assisted'
  status: ReviewStatus
  method: 'program' | 'model'
  at: string
  reason: string
  input: Record<string, unknown>
  evidenceIds: string[]
  output?: ReviewOutput
  gmDecision?: string
  feedback?: 'wrong' | 'missing'
  durationMs?: number
  tokens?: number | null
  model?: string
  modelRevision?: number
  attempt?: string
}
export interface GmReviewState {
  settings: ReviewSettings
  jobs: GmReviewJob[]
}
export interface GmReviewView {
  mode: ReviewSettings['mode']
  paused: boolean
  statuses: { intentId: string; status: ReviewStatus }[]
  settings?: ReviewSettings
  jobs?: Omit<GmReviewJob, 'input' | 'stamp'>[]
  skill?: { id: string; hash: string; description: string }
}
