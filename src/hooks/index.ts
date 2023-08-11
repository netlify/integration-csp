import fs, { writeFileSync } from "fs";
import { CSP_NONCE, CSP_VIOLATIONS } from "./constants";

export const onPreBuild = async ({ inputs, netlifyConfig, utils }) => {
  const config = JSON.stringify(inputs, null, 2);
  const { build } = netlifyConfig;

  // DISABLE_CSP_NONCE is undocumented (deprecated), but still supported
  // -> superseded by CSP_NONCE_DISTRIBUTION
  if (build.environment.DISABLE_CSP_NONCE === "true") {
    console.log(`  DISABLE_CSP_NONCE environment variable is true, skipping.`);
    return;
  }

  // CSP_NONCE_DISTRIBUTION is a number from 0 to 1,
  // but 0 to 100 is also supported, along with a trailing %
  const distribution = build.environment.CSP_NONCE_DISTRIBUTION;
  if (!!distribution) {
    const threshold =
      distribution.endsWith("%") || parseFloat(distribution) > 1
        ? Math.max(parseFloat(distribution) / 100, 0)
        : Math.max(parseFloat(distribution), 0);
    console.log(`  CSP_NONCE_DISTRIBUTION is set to ${threshold * 100}%`);
    if (threshold === 0) {
      console.log(`  Skipping.`);
      return;
    }
  }

  const edgeFunctionsDir = build.edge_functions || "./netlify/edge-functions";
  // make the directory in case it actually doesn't exist yet
  await utils.run.command(`mkdir -p ${edgeFunctionsDir}`);
  console.log(`  Writing nonce edge function to ${edgeFunctionsDir}...`);
  writeFileSync(`${edgeFunctionsDir}/__csp-nonce.ts`, CSP_NONCE);
  fs.writeFileSync(`${edgeFunctionsDir}/__csp-nonce-inputs.json`, config);

  // if no reportUri in config input, deploy function on site's behalf
  if (!inputs.reportUri) {
    const functionsDir = build.functions || "./netlify/functions";
    // make the directory in case it actually doesn't exist yet
    await utils.run.command(`mkdir -p ${functionsDir}`);
    console.log(`  Writing violations logging function to ${functionsDir}...`);
    writeFileSync(`${functionsDir}/__csp-violations.ts`, CSP_VIOLATIONS);
  } else {
    console.log(`  Using ${inputs.reportUri} as report-uri directive...`);
  }

  console.log(`  Done.`);
};
