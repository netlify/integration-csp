import {
  Button,
  Card,
  CardLoader,
  CardTitle,
  Checkbox,
  Form,
  FormField,
  SiteBuildDeployConfigurationSurface,
} from "@netlify/sdk/ui/react/components";
import { trpc } from "../trpc";
import { useNetlifySDK } from "@netlify/sdk/ui/react";
import { useEffect, useState } from "react";
import { z } from "zod";

const cspConfigFormSchema = z.object({
  reportOnly: z.boolean().optional(),
  reportUri: z.string().url().optional(),
  unsafeEval: z.boolean().optional(),
  path: z.string(),
  excludedPath: z.string().optional(),
});

export const SiteConfiguration = () => {
  const [triggerTestRun, setTriggerTestRun] = useState(false);
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
    },
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

  useEffect(() => {
    if (triggerTestRun) {
      document
        .getElementsByTagName("form")[0]
        ?.dispatchEvent(new Event("submit", { bubbles: true }));

      setTriggerTestRun(false);
    }
  }, [triggerTestRun]);

  if (siteConfigQuery.isLoading) {
    return <CardLoader />;
  }

  const onSubmitTest = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    // Triggers the submit of the form in useEffect
    setTriggerTestRun(true);
  };

  type CspConfigFormData = z.infer<typeof cspConfigFormSchema>;

  const onSubmit = async ({
    path: newPath,
    excludedPath: newExcludedPath,
    ...data
  }: CspConfigFormData) => {
    const path =
      newPath === ""
        ? []
        : newPath.split("\n").filter((path) => path.trim() !== "");

    const excludedPath =
      !newExcludedPath || newExcludedPath === ""
        ? []
        : newExcludedPath.split("\n");

    if (triggerTestRun) {
      setTriggerTestRun(false);
      await triggerConfigTestMutation.mutateAsync({
        reportOnly: data.reportOnly ?? false,
        reportUri: data.reportUri ?? "",
        unsafeEval: data.unsafeEval ?? false,
        path,
        excludedPath,
        isTestBuild: true,
      });
    } else {
      await siteConfigurationMutation.mutateAsync({
        ...siteConfigQuery.data?.config,
        cspConfig: {
          ...siteConfigQuery.data?.config.cspConfig,
          reportOnly: data.reportOnly ?? false,
          reportUri: data.reportUri,
          unsafeEval: data.unsafeEval ?? false,
          path,
          excludedPath,
        },
      });
      sdk.requestTermination();
    }
  };

  return (
    <SiteBuildDeployConfigurationSurface>
      <Card>
        {siteConfigQuery.data?.config.buildHook ? (
          <>
            <CardTitle>Disable for site</CardTitle>
            <div>
              <p>
                Disabling this affects the Content-Security-Policy header of
                future deploys.
              </p>
              <Button
                className="tw-mt-4"
                loading={siteDisablementMutation.isPending}
                onClick={onDisableHandler}
                variant="danger"
              >
                Disable
              </Button>
            </div>
          </>
        ) : (
          <>
            <CardTitle>Enable for site</CardTitle>
            <div>
              <p>
                Enabling affects the Content-Security-Policy header of future
                deploys.
              </p>
              <Button
                className="tw-mt-4"
                loading={siteEnablementMutation.isPending}
                onClick={onEnableHandler}
              >
                Enable
              </Button>
            </div>
          </>
        )}
      </Card>
      {siteConfigQuery.data?.config.buildHook && (
        <Card>
          <CardTitle>Configuration</CardTitle>
          <Form
            schema={cspConfigFormSchema}
            onSubmit={onSubmit}
            defaultValues={siteConfigQuery.data.config.cspConfig}
            loading={siteConfigurationMutation.isPending}
          >
            <div className="tw-mt-4">
              <FormField
                name="reportUri"
                type="text"
                helpText="The relative or absolute URL to report any violations. If not defined, violations are reported to the __csp-violations function, which is deployed by this integration."
                label="Report URI"
              />
              <FormField
                name="path"
                type="textarea"
                helpText="The glob expressions of path(s) that should invoke the integration's edge function, separated by newlines."
                label="Path"
              />
              <FormField
                name="excludedPath"
                type="text"
                helpText="The glob expressions of path(s) that *should not* invoke the integration's edge function, separated by newlines. Common non-html filetype extensions (*.css, *.js, *.svg, etc) are already excluded."
                label="Exluded Path"
              />
              <div className="tw-mt-4">
                <Checkbox
                  name="unsafeEval"
                  label="Unsafe Eval"
                  helpText="When true, adds the 'unsafe-eval' source to the CSP for easier adoption. Set to false to have a safer policy if your code and code dependencies do not use eval()."
                />
                <Checkbox
                  name="reportOnly"
                  label="Report Only"
                  helpText="When true, the Content-Security-Policy-Report-Only header is used instead of the Content-Security-Policy header."
                />
              </div>
              <hr />
              <p>
                Test your configuration on a draft Deploy Preview to inspect
                your CSP before going live. This deploy will not publish to
                production.
              </p>
              <Button
                loading={triggerConfigTestMutation.isPending}
                type="submit"
                onClick={onSubmitTest}
                className="tw-mt-4"
                level="secondary"
              >
                Test on Deploy Preview
              </Button>
              <hr />

              <p>
                After saving, your configuration will apply to future deploys.
              </p>
            </div>
          </Form>
        </Card>
      )}
    </SiteBuildDeployConfigurationSurface>
  );
};
