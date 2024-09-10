import { z } from "zod";

export const buildHookSchema = z.object({
  reportOnly: z.boolean().optional(),
  reportUri: z.string().url().optional(),
  unsafeEval: z.boolean().optional(),
  path: z.string(),
  excludedPath: z.array(z.string()).optional(),
});

export const buildHookTestRequestSchema = buildHookSchema.extend({
  // You can redefine properties if needed, or add new properties here
  isTestBuild: z.boolean().default(true), // this overrides the property in the base schema
});
