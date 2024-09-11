// Documentation: https://github.com/netlify/sdk
import { NetlifyExtension, z } from "@netlify/sdk";
import { onPreBuild } from "./hooks";

const siteConfigSchema = z.object({
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

const previewBuildConfigSchema = z.object({
  reportOnly: z.boolean(),
  reportUri: z.string(),
  unsafeEval: z.boolean(),
  path: z.string().array(),
  excludedPath: z.string().array(),
  isTestBuild: z.boolean(),
});

const buildConfigSchema = z.object({
  reportOnly: z.boolean().optional(),
  reportUri: z.string().optional(),
  unsafeEval: z.boolean().optional(),
  path: z.string().array().optional(),
  excludedPath: z.string().array().optional(),
});

const buildContextSchema = z.object({
  config: siteConfigSchema.shape.cspConfig,
});

const extension = new NetlifyExtension({
  siteConfigSchema,
  buildConfigSchema,
  buildContextSchema,
});

export const CSP_EXTENSION_ENABLED = "CSP_EXTENSION_ENABLED";

extension.addBuildEventHandler(
  "onPreBuild",
  ({ buildContext, netlifyConfig, utils, constants, ...opts }) => {
    if (
      !process.env[CSP_EXTENSION_ENABLED] ||
      process.env[CSP_EXTENSION_ENABLED] === "false"
    ) {
      // The build event only runs if it has been configured to run on a site, indicated by setting this env var
      return;
    }
    // TODO: Add safeguard as to whether this should run on a site, using an environment variable and then after that, using a config

    // We lean on this favoured order of precedence:
    // 1. Incoming hook body
    // 2. Build context
    // 3. Plugin options - realistically won't ever be called in this context
    // @ts-ignore TODO: Deal with it later
    let { config } = buildContext ?? opts;
    console.log("HERE COMES THE CONFIG");
    console.log({ config });
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
    if (!config.path) {
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

// @ts-ignore TODO: fix types!
extension.addBuildEventContext(async ({ site_config }) => {
  if (site_config.cspConfig) {
    return {
      config: site_config.cspConfig,
    };
  }

  return undefined;
});

extension.onUninstall(async ({ queryStringParameters }, { client }) => {
  // @ts-ignore TODO: fix types!
  const { siteId, teamId } = queryStringParameters;
  if (!siteId || !teamId) {
    return {
      statusCode: 500,
      body: "Missing siteId and/or teamId",
    };
  }

  const {
    // @ts-ignore TODO: fix types!
    config: { buildHook },
  } = await client.getSiteConfiguration(teamId, siteId);

  try {
    await client.deleteEnvironmentVariable({
      accountId: teamId,
      siteId,
      key: CSP_EXTENSION_ENABLED,
    });
  } catch (e) {
    console.error(
      `Failed to remove ${CSP_EXTENSION_ENABLED} env var for site: ${siteId} and team: ${teamId}`
    );
  }

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
