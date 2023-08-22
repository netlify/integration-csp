// Documentation: https://github.com/netlify/sdk
import { NetlifyIntegration } from "@netlify/sdk";
import { onPreBuild } from "./hooks";

type SiteConfig = {
  buildHook?: {
    url: string;
    id: string;
  };
  cspConfig?: {
    reportOnly: boolean;
    reportUri: string;
    unsafeEval: boolean;
    path: string;
    excludedPath: string;
  };
};

type BuildContext = {
  inputs?: SiteConfig["cspConfig"];
};

const integration = new NetlifyIntegration<SiteConfig, any, BuildContext>();

integration.addBuildHook("onPreBuild", ({ buildContext, ...opts }) => {
  // We lean on this favoured order of precedence:
  // 1. Incoming hook body
  // 2. Build context
  // 3. Plugin options - realistically won't ever be called in this context

  let inputs = buildContext.inputs;
  if (process.env.INCOMING_HOOK_BODY) {
    console.log("Using temporary config from test build.");
    inputs = JSON.parse(process.env.INCOMING_HOOK_BODY);
  } else {
    console.log("Using stored CSP config.");
  }

  if (inputs) {
    inputs.reportOnly = inputs.reportOnly === "true" ? true : false;
    inputs.unsafeEval = inputs.unsafeEval === "true" ? true : false;
  }

  const newOpts = {
    ...opts,
    inputs,
  };

  return onPreBuild(newOpts);
});

integration.addBuildContext(async ({ site_config }) => {
  if (site_config.cspConfig) {
    return {
      inputs: site_config.cspConfig,
    };
  }
  return {};
});

integration.addHandler("get-config", async (_, { client, siteId }) => {
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

integration.addHandler("save-config", async ({ body }, { client, siteId }) => {
  console.log(`Saving config for ${siteId}.`);

  const config = JSON.parse(body) as SiteConfig["cspConfig"];

  const existingConfig = await client.getSiteIntegration(siteId);

  await client.updateSiteIntegration(siteId, {
    ...existingConfig.config,
    cspConfig: config,
  });

  return {
    statusCode: 200,
  };
});

integration.addHandler(
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

integration.addHandler(
  "enable-build",
  async (_, { client, siteId, teamId }) => {
    const { token } = await client.generateBuildToken(siteId);
    await client.setBuildToken(teamId, siteId, token);
    await client.enableBuildhook(siteId);

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

integration.addHandler(
  "disable-build",
  async (_, { client, siteId, teamId }) => {
    const {
      config: {
        buildHook: { id: buildHookId },
      },
    } = await client.getSiteIntegration(siteId);

    await client.disableBuildhook(siteId);
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
      await client.disableBuildhook(siteId);
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
