import { z } from 'zod'

export const accountIdSchema = z.string().uuid()
const account = z
  .object({
    username: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
    salt: z.string().regex(/^[a-f0-9]{32}$/),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    enabled: z.boolean(),
  })
  .strict()
const common = { signingKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }
export const accessConfigSchema = z
  .discriminatedUnion('version', [
    z
      .object({ version: z.literal(1), ...common, accounts: z.array(account).min(1).max(32) })
      .strict(),
    z
      .object({
        version: z.literal(2),
        ...common,
        accounts: z
          .array(account.extend({ accountId: accountIdSchema }).strict())
          .min(1)
          .max(32),
      })
      .strict(),
  ])
  .superRefine((c, ctx) => {
    if (
      new Set(c.accounts.map((a) => a.username)).size !== c.accounts.length ||
      (c.version === 2 && new Set(c.accounts.map((a) => a.accountId)).size !== c.accounts.length)
    )
      ctx.addIssue({ code: 'custom', message: '账号名称或永久 ID 重复' })
  })
export type AccessConfig = z.infer<typeof accessConfigSchema>
export interface SitePrincipal {
  accountId: string
  username: string
}
