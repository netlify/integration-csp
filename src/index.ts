// Documentation: https://github.com/netlify/sdk
import { NetlifyIntegration, z } from "@netlify/sdk";
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

const integration = new NetlifyIntegration({
  siteConfigSchema,
  buildConfigSchema,
  buildContextSchema,
});

integration.addBuildEventHandler(
  "onPreBuild",
  ({ buildContext, netlifyConfig, utils, ...opts }) => {
    // We lean on this favoured order of precedence:
    // 1. Incoming hook body
    // 2. Build context
    // 3. Plugin options - realistically won't ever be called in this context

    let { config } = buildContext ?? opts;

    if (process.env.INCOMING_HOOK_BODY) {
      console.log("Using temporary config from test build.");
      try {
        const hookBody = JSON.parse(process.env.INCOMING_HOOK_BODY);
        config = integration._buildConfigurationSchema.parse(hookBody);
      } catch (e) {
        console.warn("Failed to parse incoming hook body.");
        console.log(e);
      }
    } else {
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

    console.log("Config:");
    console.log("---");
    console.log(`Report Only: ${config.reportOnly}`);
    console.log(`Report URI: ${config.reportUri}`);
    console.log(`Unsafe Eval: ${config.unsafeEval}`);
    console.log(`Path: ${config.path.join(", ")}`);
    console.log(`Excluded Path: ${config.excludedPath.join(", ")}`);
    console.log("---");

    const newOpts = {
      ...opts,
      netlifyConfig,
      utils,
      config,
    };

    return onPreBuild(newOpts);
  }
);

integration.addBuildEventContext(async ({ site_config }) => {
  if (site_config.cspConfig) {
    return {
      config: site_config.cspConfig,
    };
  }

  return undefined;
});

integration.addApiHandler("get-config", async (_, { client, siteId }) => {
  const { config, has_build_hook_enabled } = await client.getSiteIntegration(
    siteId
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      has_build_hook_enabled,
      cspConfig: config.cspConfig ?? {},
    }),
  };
});

integration.addApiHandler(
  "save-config",
  async ({ body }, { client, siteId }) => {
    console.log(`Saving config for ${siteId}.`);

    const result = integration._siteConfigSchema.shape.cspConfig.safeParse(
      JSON.parse(body)
    );

    if (!result.success) {
      return {
        statusCode: 400,
        body: JSON.stringify(result),
      };
    }
    const { data } = result;

    const existingConfig = await client.getSiteIntegration(siteId);

    await client.updateSiteIntegration(siteId, {
      ...existingConfig.config,
      cspConfig: data,
    });

    return {
      statusCode: 200,
    };
  }
);

integration.addApiHandler(
  "trigger-config-test",
  async ({ body }, { client, siteId }) => {
    console.log(`Triggering build for ${siteId}.`);
    const {
      config: {
        buildHook: { url: buildHookUrl },
      },
    } = await client.getSiteIntegration(siteId);

    console.log(buildHookUrl);

    const res = await fetch(buildHookUrl, {
      method: "POST",
      body,
    });

    console.log(`Triggered build for ${siteId} with status ${res.status}.`);

    return {
      statusCode: 200,
    };
  }
);

integration.addApiHandler(
  "enable-build",
  async (_, { client, siteId, teamId }) => {
    const { token } = await client.generateBuildToken(siteId);
    await client.setBuildToken(teamId, siteId, token);
    await client.enableBuildEventHandlers(siteId);

    const { url, id } = await client.createBuildHook(siteId, {
      title: "CSP Configuration Tests",
      branch: "main",
      draft: true,
    });

    await client.updateSiteIntegration(siteId, {
      buildHook: {
        url,
        id,
      },
    });

    return {
      statusCode: 200,
    };
  }
);

integration.addApiHandler(
  "disable-build",
  async (_, { client, siteId, teamId }) => {
    const {
      config: {
        buildHook: { id: buildHookId },
      },
    } = await client.getSiteIntegration(siteId);

    await client.disableBuildEventHandlers(siteId);
    await client.removeBuildToken(teamId, siteId);

    await client.deleteBuildHook(siteId, buildHookId);

    return {
      statusCode: 200,
    };
  }
);

integration.onDisable(async ({ queryStringParameters }, { client }) => {
  const { siteId, teamId } = queryStringParameters;

  const {
    config: { buildHook },
  } = await client.getSiteIntegration(siteId);

  try {
    const { id: buildHookId } = buildHook ?? {};

    if (buildHookId) {
      await client.disableBuildEventHandlers(siteId);
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

export { integration };
