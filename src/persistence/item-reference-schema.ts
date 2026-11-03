import { z } from 'zod'

/** Rule catalogue IDs are not local authoring keys (custom packs may use namespaces). */
export const itemReferenceSchema = z
  .string()
  .min(1)
  .max(120)
  .refine((id) => !['__proto__', 'constructor', 'prototype'].includes(id), '物品编号为保留字')
