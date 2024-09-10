import { z } from "zod";

export const cspConfigSchema = z
  .object({
    reportOnly: z.boolean().optional(),
    reportUri: z.string().url().optional(),
    unsafeEval: z.boolean().optional(),
    path: z.string(),
    excludedPath: z.array(z.string()).optional(),
  })
  .optional();

export const siteConfigSchema = z.object({
  buildHook: z
    .object({
      url: z.string(),
      id: z.string(),
    })
    .optional(),
  cspConfig: cspConfigSchema,
});
