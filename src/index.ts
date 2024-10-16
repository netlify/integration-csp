// Documentation: https://github.com/netlify/sdk
import { NetlifyExtension, z } from "@netlify/sdk";
import { onPreBuild } from "./build-event-handlers/index.js";

// FIXME(ndhoule): Replace deprecated sdk#z import with zod package import
/* eslint-disable @typescript-eslint/no-deprecated */
export const cspConfigSchema = z
  .object({
    reportOnly: z.boolean().optional(),
    reportUri: z.string().url().optional(),
    unsafeEval: z.boolean().optional(),
    path: z.array(z.string()),
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

export const previewBuildConfigSchema = z.object({
  reportOnly: z.boolean(),
  reportUri: z.string(),
  unsafeEval: z.boolean(),
  path: z.string().array(),
  excludedPath: z.string().array(),
  isTestBuild: z.boolean(),
});

export const buildConfigSchema = z.object({
  reportOnly: z.boolean().optional(),
  reportUri: z.string().optional(),
  unsafeEval: z.boolean().optional(),
  path: z.string().array().optional(),
  excludedPath: z.string().array().optional(),
});
/* eslint-enable @typescript-eslint/no-deprecated */

export const extension = new NetlifyExtension({
  siteConfigSchema,
  buildConfigSchema,
  buildContextSchema: siteConfigSchema,
});

export const CSP_EXTENSION_ENABLED = "CSP_EXTENSION_ENABLED";

extension.addBuildEventHandler(
  "onPreBuild",
  ({ buildContext, netlifyConfig, utils, constants, buildConfig, ...opts }) => {
    const { cspConfig, buildHook } = buildContext ?? {};

    if (!process.env.INCOMING_HOOK_BODY && !cspConfig && !buildHook?.url) {
      console.log("CSP Extension not enabled for this site.");
      return;
    }
    let config = cspConfig ?? buildConfig ?? {};

    // We lean on this favoured order of precedence:
    // 1. Incoming hook body
    // 2. Build context
    // 3. Plugin options - realistically won't ever be called in this context
    let tempConfig = false;

    if (process.env.INCOMING_HOOK_BODY) {
      try {
        const hookBody: unknown = JSON.parse(process.env.INCOMING_HOOK_BODY);
        const result = previewBuildConfigSchema.safeParse(hookBody);

        if (result.success && result.data.isTestBuild) {
          console.log("Using temporary config from test build.");
          config = result.data;
          tempConfig = true;
        } else {
          console.log(
            "Incoming hook is present, but not a configuration object for CSP.",
          );
        }
      } catch (e) {
        console.warn("Failed to parse incoming hook body.");
        console.log(e);
      }
    }

    if (!tempConfig) {
      // FIXME(ndhoule): This is a bug. At one point we added a default value for config, which
      // means we can no longer enter this case.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!config) {
        config = {
          reportOnly: true,
          reportUri: "",
          unsafeEval: true,
          path: ["/*"],
          excludedPath: [],
        };
        console.log("Using default CSP config.");
      } else {
        console.log("Using stored CSP config.");
      }
    }

    // Ensure if path is not present, that it is set to "/*" as a default
    if (!config.path) {
      config.path = ["/*"];
    }

    console.log("Config:");
    console.log("---");
    console.log(`Report Only: ${config.reportOnly?.toString() ?? "<not set>"}`);
    console.log(`Report URI: ${config.reportUri?.toString() ?? "<not set>"}`);
    console.log(`Unsafe Eval: ${config.unsafeEval?.toString() ?? "<not set>"}`);
    console.log(`Path: ${config.path.join(", ")}`);
    console.log(
      `Excluded Path: ${config.excludedPath?.join(", ") ?? "<not set>"}`,
    );
    console.log("---");

    const newOpts = {
      ...opts,
      constants,
      netlifyConfig,
      utils,
      config,
    };

    return onPreBuild(newOpts);
  },
);

extension.addBuildEventContext(({ site_config }) => {
  // FIXME(ndhoule): I don't know if this lint check is correct or if the type here is incorrect, so
  // leaving this to be safe.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return Promise.resolve(site_config.config ?? undefined);
});
