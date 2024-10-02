import { TRPCError } from "@trpc/server";
import { procedure, router } from "./trpc";
import { z } from "zod";

export const previewBuildConfigSchema = z.object({
  reportOnly: z.boolean(),
  reportUri: z.string(),
  unsafeEval: z.boolean(),
  path: z.string().array(),
  excludedPath: z.string().array(),
  isTestBuild: z.boolean(),
});

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

        let siteConfig;

        try {
          siteConfig = await client.getSiteConfiguration(teamId, siteId);
        } catch (error) {}

        let configData;

        if (siteConfig) {
          configData = siteConfigSchema.safeParse(siteConfig.config);

          if (!configData.success) {
            console.warn(
              "Failed to parse site settings",
              JSON.stringify(configData.error, null, 2)
            );
          }
        }

        const { path, excludedPath, ...cspConfig } =
          configData?.data?.cspConfig ?? {};

        return {
          config: {
            ...configData?.data,
            cspConfig: {
              ...cspConfig,
              path: path?.join("\n"),
              excludedPath: excludedPath?.join("\n"),
            },
          },
        };
      }
    ),

    mutateTriggerConfigTest: procedure
      .input(previewBuildConfigSchema)
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
            JSON.stringify(configData.error, null, 2)
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

        return;
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
          await client.upsertSiteConfiguration(teamId, siteId, {
            ...input,
          });
        } catch (e) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to save site configuration",
            cause: e,
          });
        }

        return;
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

        const { url, id } = await client.createBuildHook(siteId, {
          title: "CSP Configuration Tests",
          branch: "main",
          draft: true,
        });

        try {
          const siteConfig = await client.getSiteConfiguration(teamId, siteId);

          if (siteConfig) {
            return client.updateSiteConfiguration(teamId, siteId, {
              buildHook: {
                url,
                id,
              },
            });
          }
          await client.createSiteConfiguration(teamId, siteId, {
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
        return;
      }
    ),
    mutateDisablement: procedure.mutation(
      async ({ ctx: { teamId, siteId, client } }) => {
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
            JSON.stringify(configData.error, null, 2)
          );
        }

        if (!configData.data?.buildHook?.id) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to retrieve build hook ID",
          });
        }

        const {
          buildHook: { id: buildHookId },
        } = configData.data;

        try {
          await client.removeBuildToken(teamId, siteId);
          await client.deleteBuildHook(siteId, buildHookId);
          await client.deleteSiteConfiguration(teamId, siteId);
        } catch (e) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to disable extension for site",
          });
        }
      }
    ),
  },
});

export type AppRouter = typeof appRouter;
