import { withNetlifySDKContext } from "@netlify/sdk/ui/functions";
import { siteConfigSchema } from "..";

export default withNetlifySDKContext(async (_req, context) => {
  if (!context.teamId) {
    return new Response("teamId is required", { status: 400 });
  }

  const sites = await context.client.getSites();

  for (const site of sites) {
    const siteConfig = await context.client.getSiteConfiguration(
      context.teamId,
      site.id
    );
    if (siteConfig) {
      const parsedConfig = siteConfigSchema.safeParse(siteConfig.config);
      if (parsedConfig.success && parsedConfig?.data?.buildHook?.id) {
        // delete the env and build hook
        try {
          await context.client.deleteBuildHook(
            site.id,
            parsedConfig.data.buildHook.id
          );
        } catch (e) {
          console.error(
            `Failed to delete build hook ${parsedConfig.data.buildHook.id} for site ${site.id}`
          );
        }

        try {
          await context.client.removeBuildToken(context.teamId, site.id);
        } catch (e) {
          console.error(`Failed to remove build token for site ${site.id}`);
        }
      }
    }
  }

  return new Response("Uninstall complete", { status: 200 });
});
