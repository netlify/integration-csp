import { TRPCError } from "@trpc/server";
import { procedure, router } from "./trpc";
import { siteConfigSchema } from "../schema/site-config-schema";
import { buildHookRequestSchema } from "../schema/build-hook-schema";
import { CSP_EXTENSION_ENABLED } from "../index";

export const appRouter = router({
  siteConfig: {
    queryConfig: procedure.query(
      async ({ ctx: { siteId, teamId, client } }) => {
        if (!teamId || !siteId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "teamId and siteId are required",
          });
        }
        const siteConfig = await client.getSiteConfiguration(teamId, siteId);

        const envVars = await client.getEnvironmentVariables({
          accountId: teamId,
          siteId,
        });

        // TODO: Check if we use the all context
        const enabledVar = envVars
          .find((val) => val.key === CSP_EXTENSION_ENABLED)
          ?.values.find((val) => val.context === "all");

        // TODO: types
        let configData;

        if (siteConfig) {
          configData = siteConfigSchema.safeParse(siteConfig.config);

          if (!configData.success) {
            console.warn(
              "Failed to parse site settings",
              JSON.stringify(configData.error, null, 2),
            );
          }
        }

        return {
          config: configData,
          enabledForSite: !!enabledVar?.value && enabledVar.value !== "false",
        };
      },
    ),

    mutateTriggerConfigTest: procedure
      .input(buildHookRequestSchema)
      .mutation(async ({ ctx: { teamId, siteId, client }, input }) => {
        if (!teamId || !siteId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "teamId and siteId are required",
          });
        }

        const siteConfig = await client.getSiteConfiguration(teamId, siteId);

        if (!siteConfig) {
          return;
        }

        const configData = siteConfigSchema.safeParse(siteConfig.config);

        if (!configData.success) {
          console.warn(
            "Failed to parse site settings",
            JSON.stringify(configData.error, null, 2),
          );
        }

        if (!configData.data?.buildHook?.url) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to retrieve build hook URL",
          });
        }

        const res = await fetch(configData.data?.buildHook?.url, {
          method: "POST",
          body: JSON.stringify(input),
        });

        console.log(`Triggered build for ${siteId} with status ${res.status}.`);
      }),

    mutateConfig: procedure
      .input(siteConfigSchema)
      .mutation(async ({ ctx: { teamId, siteId, client }, input }) => {
        if (!teamId || !siteId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "teamId and siteId are required",
          });
        }

        try {
          await client.upsertSiteConfiguration(teamId, siteId, input);
        } catch (e) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to save site configuration",
            cause: e,
          });
        }
      }),

    mutateEnablement: procedure.mutation(
      async ({ ctx: { teamId, siteId, client } }) => {
        if (!teamId || !siteId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "teamId and siteId are required",
          });
        }

        const { token } = await client.generateBuildToken(siteId, teamId);
        await client.setBuildToken(teamId, siteId, token);
        //  TODO: Setup a safeguard for this extension to ensure they are only enabled where CSP is configured to run
        // await client.enableBuildEventHandlers(siteId);
        await client.createOrUpdateVariable({
          accountId: teamId,
          siteId,
          key: CSP_EXTENSION_ENABLED,
          value: "true",
        });

        const { url, id } = await client.createBuildHook(siteId, {
          title: "CSP Configuration Tests",
          branch: "main",
          draft: true,
        });

        try {
          await client.upsertSiteConfiguration(teamId, siteId, {
            buildHook: {
              url,
              id,
            },
          });
        } catch (e) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to save site configuration",
            cause: e,
          });
        }
      },
    ),
  },
});

export type AppRouter = typeof appRouter;
