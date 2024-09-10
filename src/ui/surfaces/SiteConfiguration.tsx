import {
  Button,
  Card,
  CardLoader,
  CardTitle,
  Checkbox,
  Form,
  FormField,
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
  const siteDisablementMutation = trpc.siteConfig.mutateDisablement.useMutation(
    {
      onSuccess: async () => {
        await trpcUtils.siteConfig.queryConfig.invalidate();
      },
    }
  );
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
    siteDisablementMutation.mutate();
  };

  console.log({ stuff: siteConfigQuery.data });
  if (siteConfigQuery.isLoading) {
    return <CardLoader />;
  }

  return (
    <SiteAccessConfigurationSurface>
      <Card>
        <CardTitle>Dynamic Content Security Policy</CardTitle>
        {siteConfigQuery.data?.enabledForSite ? (
          <>
            <Button
              loading={siteDisablementMutation.isPending}
              onClick={onDisableHandler}
            >
              Disable build event handler
            </Button>

            <Form
              schema={buildHookRequestSchema}
              onSubmit={triggerConfigTestMutation.mutateAsync}
            >
              <Checkbox
                name="reportOnly"
                label="Report Only"
                helpText="When true, the Content-Security-Policy-Report-Only header is used instead of the Content-Security-Policy header."
              />
              <FormField
                name="reportUri"
                type="text"
                helpText="The relative or absolute URL to report any violations. If not defined, violations are reported to the __csp-violations function, which is deployed by this integration."
                label="Report URI"
              />
              <Checkbox
                name="unsafeEval"
                label="Unsafe Eval"
                helpText="When true, adds the 'unsafe-eval' source to the CSP for easier adoption. Set to false to have a safer policy if your code and code dependencies do not use eval()."
              />
              <FormField
                name="path"
                type="text"
                helpText="The glob expressions of path(s) that should invoke the integration's edge function, separated by newlines."
                label="Path"
              />
              <FormField
                name="excludedPath"
                type="text"
                helpText="The glob expressions of path(s) that *should not* invoke the integration's edge function, separated by newlines. Common non-html filetype extensions (*.css, *.js, *.svg, etc) are already excluded."
                label="Exluded Path"
              />
              <p>
                Test your configuration on a draft Deploy Preview to inspect
                your CSP before going live. This deploy will not publish to
                production.
              </p>
              <Button
                loading={triggerConfigTestMutation.isPending}
                onClick={() => triggerConfigTestMutation.mutateAsync()}
              >
                Test on Deploy Preview
              </Button>
              <p>
                After saving, your configuration will apply to future deploys.
              </p>
            </Form>
          </>
        ) : (
          <>
            <p>
              Enabling or disabling this extension affects the
              Content-Security-Policy header of future deploys.
            </p>
            <Button
              loading={siteEnablementMutation.isPending}
              onClick={onEnableHandler}
            >
              Enable
            </Button>
          </>
        )}
      </Card>
    </SiteAccessConfigurationSurface>
  );
};
