import {
  Button,
  Card,
  CardLoader,
  CardTitle,
  Form,
  SiteAccessConfigurationSurface,
} from "@netlify/sdk/ui/react/components";
import { trpc } from "../trpc";
import { useNetlifySDK } from "@netlify/sdk/ui/react";
import { buildHookRequestSchema } from "../../schema/build-hook-schema";
//import { siteConfigSchema } from "../../schema/site-config-schema";

export const SiteConfiguration = () => {
  const sdk = useNetlifySDK();
  const trpcUtils = trpc.useUtils();
  const siteConfigQuery = trpc.siteConfig.queryConfig.useQuery();
  const siteConfigurationMutation = trpc.siteConfig.mutateConfig.useMutation({
    onSuccess: async () => {
      await trpcUtils.siteConfig.queryConfig.invalidate();
    },
  });
  const siteEnablementMutation = trpc.siteConfig.mutateEnablement.useMutation({
    onSuccess: async () => {
      await trpcUtils.siteConfig.queryConfig.invalidate();
    },
  });
  const siteDisablementMutation = trpc.siteConfig.mutateEnablement.useMutation({
    onSuccess: async () => {
      await trpcUtils.siteConfig.queryConfig.invalidate();
    },
  });
  const triggerConfigTestMutation =
    trpc.siteConfig.mutateTriggerConfigTest.useMutation({
      onSuccess: async () => {
        await trpcUtils.siteConfig.queryConfig.invalidate();
      },
    });

  const onEnableHandler = () => {
    siteEnablementMutation.mutate();
  };

  const onDisableHandler = () => {
    siteEnablementMutation.mutate();
  };

  if (siteConfigQuery.isLoading) {
    return <CardLoader />;
  }

  return (
    <SiteAccessConfigurationSurface>
      <Card>
        <CardTitle>Dynamic Content Security Policy</CardTitle>
        {siteConfigQuery.data?.enabledForSite ? (
          <>
            <Button onClick={onDisableHandler}>
              Disable build event handler
            </Button>

            <Form
              schema={buildHookRequestSchema}
              defaultValues={{}}
              onSubmit={triggerConfigTestMutation.mutateAsync}
            />
          </>
        ) : (
          <>
            <p>
              Enabling or disabling this extension affects the
              Content-Security-Policy header of future deploys.
            </p>
            <Button onClick={onEnableHandler}>Enable</Button>
          </>
        )}
        {/*<Form
          defaultValues={
            siteConfigQuery.data ?? {
              "site-username": "",
              "site-env-var": "",
            }
          }
          schema={siteConfigSchema}
          onSubmit={siteSettingsMutation.mutateAsync}
        >
          <FormField name="site-username" type="text" label="Site username" />
          <FormField name="site-env-var" type="number" label="Site env var" />
        </Form>*/}
      </Card>
    </SiteAccessConfigurationSurface>
  );
};
