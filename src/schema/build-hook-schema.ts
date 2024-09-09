import { z } from "zod";

export const buildHookRequestSchema = z.object({
  reportOnly: z.boolean().optional(), // Assuming reportOnly can be optional
  reportUri: z.string().url().optional(), // URL type, assuming it should be a valid URL and optional
  unsafeEval: z.boolean().optional(), // Assuming this is a boolean flag
  path: z.string(), // Assuming path is a required string
  excludedPath: z.array(z.string()).optional(), // Optional array of strings
  isTestBuild: z.boolean().default(true), // Defaults to true if not provided
});
