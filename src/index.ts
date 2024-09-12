// Documentation: https://github.com/netlify/sdk
import { NetlifyExtension, z } from "@netlify/sdk";
import { onPreBuild } from "./hooks";

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

const extension = new NetlifyExtension({
  siteConfigSchema,
  buildConfigSchema,
  buildContextSchema: siteConfigSchema,
});

export const CSP_EXTENSION_ENABLED = "CSP_EXTENSION_ENABLED";

extension.addBuildEventHandler(
  "onPreBuild",
  ({ buildContext, netlifyConfig, utils, constants, buildConfig, ...opts }) => {
    const { cspConfig, buildHook } = buildContext ?? {};
    console.log({
      cspConfig,
      buildHook,
      process: process.env.INCOMING_HOOK_BODY,
    });
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
        const hookBody = JSON.parse(process.env.INCOMING_HOOK_BODY);
        const result = previewBuildConfigSchema.safeParse(hookBody);

        if (result.success && result.data.isTestBuild) {
          console.log("Using temporary config from test build.");
          config = result.data;
          tempConfig = true;
        } else {
          console.log(
            "Incoming hook is present, but not a configuration object for CSP."
          );
        }
      } catch (e) {
        console.warn("Failed to parse incoming hook body.");
        console.log(e);
      }
    }

    if (!tempConfig) {
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
    if (!config?.path) {
      config.path = ["/*"];
    }

    console.log("Config:");
    console.log("---");
    console.log(`Report Only: ${config.reportOnly}`);
    console.log(`Report URI: ${config.reportUri}`);
    console.log(`Unsafe Eval: ${config.unsafeEval}`);
    console.log(`Path: ${config.path?.join(", ")}`);
    console.log(`Excluded Path: ${config.excludedPath?.join(", ")}`);
    console.log("---");

    const newOpts = {
      ...opts,
      constants,
      netlifyConfig,
      utils,
      config,
    };

    return onPreBuild(newOpts);
  }
);

extension.addBuildEventContext(async ({ site_config }) => {
  console.log({ site_config });
  return site_config.config ?? undefined;
});

type EventQueryStringParameters = {
  siteId?: string;
  teamId?: string;
  [key: string]: string | undefined;
};

extension.onUninstall(async ({ queryStringParameters }, { client }) => {
  const { siteId, teamId } =
    queryStringParameters as EventQueryStringParameters;
  if (!siteId || !teamId) {
    return {
      statusCode: 500,
      body: "Missing siteId and/or teamId",
    };
  }

  const siteConfig = await client.getSiteConfiguration(teamId, siteId);

  if (!siteConfig) {
    throw new Error("Failed to get site configuration");
  }

  const { buildHook } = siteConfig.config;

  try {
    const { id: buildHookId } = buildHook ?? {};

    if (buildHookId) {
      await client.removeBuildToken(teamId, siteId);
      await client.deleteBuildHook(siteId, buildHookId);
    }
  } catch (e) {
    console.log("Failed to disable buildhooks");
    console.error(e);
  }

  return {
    statusCode: 200,
  };
});

export { extension };
