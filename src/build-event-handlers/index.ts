import fs from "fs";
import path from "path";
import { type OnPreBuild } from "@netlify/build";

type OnPreBuildConfig = {
  reportOnly?: boolean | undefined;
  reportUri?: string | undefined;
  unsafeEval?: boolean | undefined;
  path?: string[] | undefined;
  excludedPath?: string[] | undefined;
};

export const createOnPreBuild: (config: OnPreBuildConfig) => OnPreBuild = (
  config,
) => {
  return async ({ constants, netlifyConfig, utils }) => {
    const configString = JSON.stringify(config, null, 2);
    const { build } = netlifyConfig;
    const {
      INTERNAL_FUNCTIONS_SRC,
      INTERNAL_EDGE_FUNCTIONS_SRC,
      PACKAGE_PATH,
    } = constants;

    const pluginDir = path.resolve(
      PACKAGE_PATH ?? "",
      ".netlify/plugins/node_modules/@netlify/plugin-csp-nonce/src",
    );

    // CSP_NONCE_DISTRIBUTION is a number from 0 to 1,
    // but 0 to 100 is also supported, along with a trailing %
    const distribution = build.environment.CSP_NONCE_DISTRIBUTION;
    if (distribution) {
      const threshold =
        distribution.endsWith("%") || parseFloat(distribution) > 1
          ? Math.max(parseFloat(distribution) / 100, 0)
          : Math.max(parseFloat(distribution), 0);
      console.log(
        `  CSP_NONCE_DISTRIBUTION is set to ${(threshold * 100).toString()}%`,
      );
      if (threshold === 0) {
        console.log(`  Skipping.`);
        return;
      }
    }

    if (INTERNAL_FUNCTIONS_SRC === undefined) {
      throw new Error(
        "INTERNAL_EDGE_FUNCTIONS_SRC not set. Cannot write to internal edge functions directory.",
      );
    }

    if (INTERNAL_EDGE_FUNCTIONS_SRC === undefined) {
      throw new Error(
        "INTERNAL_EDGE_FUNCTIONS_SRC not set. Cannot write to internal edge functions directory.",
      );
    }

    // make the directory in case it actually doesn't exist yet
    await utils.run.command(`mkdir -p ${INTERNAL_EDGE_FUNCTIONS_SRC}`);

    fs.writeFileSync(
      `${INTERNAL_EDGE_FUNCTIONS_SRC}/__csp-nonce-inputs.json`,
      configString,
    );
    console.log(
      `  Writing nonce edge function to ${INTERNAL_EDGE_FUNCTIONS_SRC}...`,
    );
    const nonceSource = `${pluginDir}/__csp-nonce.ts`;
    const nonceDest = `${INTERNAL_EDGE_FUNCTIONS_SRC}/__csp-nonce.ts`;
    fs.copyFileSync(nonceSource, nonceDest);

    // if no reportUri in config input, deploy function on site's behalf
    if (!config.reportUri) {
      // make the directory in case it actually doesn't exist yet
      await utils.run.command(`mkdir -p ${INTERNAL_FUNCTIONS_SRC}`);
      console.log(
        `  Writing violations logging function to ${INTERNAL_FUNCTIONS_SRC}...`,
      );
      const violationsSource = `${pluginDir}/__csp-violations.ts`;
      const violationsDest = `${INTERNAL_FUNCTIONS_SRC}/__csp-violations.ts`;
      fs.copyFileSync(violationsSource, violationsDest);
    } else {
      console.log(`  Using ${config.reportUri} as report-uri directive...`);
    }
    utils.status.show({
      title: "CSP Extension",
      summary: "Successfully ran the CSP Extension",
      text: `CSP Extension ran successfully to set up the CSP Nonce and Violations logging functions for path _${
        config.path?.join(", ") ?? "<unknown>"
      }_. With the following config: _${configString}_`,
    });
    console.log(`  Done.`);
  };
};
