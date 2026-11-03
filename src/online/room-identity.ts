import { z } from 'zod'
const identitySchema = z
  .object({
    format: z.literal('trpg-room-identity'),
    version: z.literal(1),
    deploymentId: z.string().regex(/^[a-f0-9]{64}$/),
    roomId: z.string().uuid(),
    token: z
      .string()
      .min(16)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/),
    role: z.enum(['gm', 'player', 'ai']),
    nickname: z.string().min(1).max(80),
  })
  .strict()
export type RoomIdentity = z.infer<typeof identitySchema>
export function parseRoomIdentity(text: string, deploymentId: string): RoomIdentity {
  if (new TextEncoder().encode(text).length > 16384) throw Error('身份文件超过16KiB')
  let input: unknown
  try {
    input = JSON.parse(text)
  } catch {
    throw Error('身份文件不是有效JSON')
  }
  const value = identitySchema.safeParse(input)
  if (!value.success) throw Error('身份文件格式不正确，请使用工具导出的本人身份文件')
  if (value.data.deploymentId !== deploymentId) throw Error('身份文件属于不同部署，未发送房间凭证')
  return value.data
}
export function validateIdentityRole(identity: RoomIdentity, actualRole: string) {
  if (identity.role !== actualRole) throw Error('身份文件标注与服务端身份不一致')
}
