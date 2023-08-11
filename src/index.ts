// Documentation: https://github.com/netlify/sdk
import { NetlifyIntegration } from "@netlify/sdk";
import { onPreBuild } from "./hooks";

type SiteConfig = {
  buildHook: {
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
    inputs = JSON.parse(process.env.INCOMING_HOOK_BODY);
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

integration.addHandler(
  "get-config",
  async ({ queryStringParameters }, { client }) => {
    const { siteId } = queryStringParameters;

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
  }
);

integration.addHandler(
  "save-config",
  async ({ body, queryStringParameters }, { client }) => {
    const { siteId } = queryStringParameters;
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
  }
);

integration.addHandler(
  "trigger-config-test",
  async ({ queryStringParameters, body }, { client }) => {
    const { siteId } = queryStringParameters;
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

integration.addHandler("enable-build", async ({ body }, { client }) => {
  const { siteId, teamId } = JSON.parse(body);

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
});

integration.addHandler("disable-build", async ({ body }, { client }) => {
  const { siteId, teamId } = JSON.parse(body);

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
});

integration.onDisable(async ({ queryStringParameters }, { client }) => {
  const { siteId, teamId } = queryStringParameters;

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
});

export { integration };
