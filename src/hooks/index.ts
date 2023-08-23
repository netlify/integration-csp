import fs from "fs";

export const onPreBuild = async ({ inputs, netlifyConfig, utils }) => {
  const config = JSON.stringify(inputs, null, 2);
  const { build } = netlifyConfig;

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

  fs.writeFileSync(`${edgeFunctionsDir}/__csp-nonce-inputs.json`, config);
  console.log(`  Writing nonce edge function to ${edgeFunctionsDir}...`);
  const nonceSource =
    ".netlify/plugins/node_modules/@netlify/plugin-csp-nonce/src/__csp-nonce.ts";
  const nonceDest = `${edgeFunctionsDir}/__csp-nonce.ts`;
  fs.copyFileSync(nonceSource, nonceDest);

  // if no reportUri in config input, deploy function on site's behalf
  if (!inputs.reportUri) {
    const functionsDir = build.functions || "./netlify/functions";
    // make the directory in case it actually doesn't exist yet
    await utils.run.command(`mkdir -p ${functionsDir}`);
    console.log(`  Writing violations logging function to ${functionsDir}...`);
    const violationsSource =
      ".netlify/plugins/node_modules/@netlify/plugin-csp-nonce/src/__csp-violations.ts";
    const violationsDest = `${functionsDir}/__csp-violations.ts`;
    fs.copyFileSync(violationsSource, violationsDest);
  } else {
    console.log(`  Using ${inputs.reportUri} as report-uri directive...`);
  }

  console.log(`  Done.`);
};
