import { z } from 'zod'
export const scriptObjectId = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => !['__proto__', 'constructor', 'prototype'].includes(s))
