import { z } from "zod";

export const siteConfigSchema = z.object({
  buildHook: z
    .object({
      url: z.string(),
      id: z.string(),
    })
    .optional(),
  cspConfig: z
    .object({
      reportOnly: z.boolean(),
      reportUri: z.string(),
      unsafeEval: z.boolean(),
      path: z.string().array(),
      excludedPath: z.string().array(),
    })
    .optional(),
});
