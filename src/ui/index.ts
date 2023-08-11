import { NetlifyIntegrationUI } from "@netlify/sdk";

const integrationUI = new NetlifyIntegrationUI("csp-test");

const surface = integrationUI.addSurface("integrations-settings");

const root = surface.addRoute("/");

root.onLoad(
  async ({
    picker,
    surfaceInputsData,
    surfaceRouteConfig,
    integrationContext: { serverUrl, netlifyToken, siteId },
  }) => {
    const res = await fetch(
      `${serverUrl}/.netlify/functions/handler/get-config?siteId=${siteId}`,
      {
        headers: {
          "netlify-token": netlifyToken,
        },
      }
    );

    const { has_build_hook_enabled, cspConfig } = await res.json();

    picker.getElementById("enable-build-hooks").display = has_build_hook_enabled
      ? "hidden"
      : "visible";
    picker.getElementById("disable-build-hooks").display =
      has_build_hook_enabled ? "visible" : "hidden";

    surfaceInputsData["csp-configuration_reportOnly"] =
      cspConfig.reportOnly ?? "true";
    surfaceInputsData["csp-configuration_reportUri"] =
      cspConfig.reportUri ?? "";
    surfaceInputsData["csp-configuration_unsafeEval"] =
      cspConfig.unsafeEval ?? "true";
    surfaceInputsData["csp-configuration_path"] = cspConfig.path ?? "/*";
    surfaceInputsData["csp-configuration_excludedPath"] =
      cspConfig.excludedPath ?? "[]";

    return {
      surfaceInputsData,
      surfaceRouteConfig,
    };
  }
);

root.addCard(
  {
    id: "enable-build-hooks-card",
    title: "Enable CSP",
  },
  (card) => {
    card.addText({
      value:
        "You can toggle the CSP injection here. Enabling/Disabling this will only affect future builds, and does not trigger one.",
    });

    card.addButton({
      id: "enable-build-hooks",
      title: "Enable",
      callback: async ({
        picker,
        integrationContext: { serverUrl, netlifyToken, accountId, siteId },
      }) => {
        const res = await fetch(
          `${serverUrl}/.netlify/functions/handler/enable-build`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "netlify-token": netlifyToken,
            },
            body: JSON.stringify({
              siteId,
              teamId: accountId,
            }),
          }
        );

        if (res.ok) {
          picker.getElementById("enable-build-hooks").display = "hidden";
        }
      },
    });

    card.addButton({
      id: "disable-build-hooks",
      title: "Disable",
      display: "hidden",
      callback: async ({
        picker,
        integrationContext: { serverUrl, netlifyToken, accountId, siteId },
      }) => {
        const res = await fetch(
          `${serverUrl}/.netlify/functions/handler/disable-build`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "netlify-token": netlifyToken,
            },
            body: JSON.stringify({
              siteId,
              teamId: accountId,
            }),
          }
        );

        if (res.ok) {
          picker.getElementById("enable-build-hooks").display = "hidden";
        }
      },
    });
  }
);

root.addForm(
  {
    id: "csp-configuration",
    title: "CSP Configuration",
    onSubmit: async ({ surfaceInputsData, integrationContext }) => {
      const {
        "csp-configuration_reportOnly": reportOnly = "true",
        "csp-configuration_reportUri": reportUri = "",
        "csp-configuration_unsafeEval": unsafeEval = "true",
        "csp-configuration_path": path = "/*",
        "csp-configuration_excludedPath": excludedPath = "[]",
      } = surfaceInputsData;

      const config = {
        reportOnly,
        reportUri,
        unsafeEval,
        path,
        excludedPath,
      };

      const { netlifyToken, serverUrl, siteId } = integrationContext;
      await fetch(
        `${serverUrl}/.netlify/functions/handler/save-config?siteId=${siteId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "netlify-token": netlifyToken,
          },
          body: JSON.stringify(config),
        }
      );
    },
  },
  (form) => {
    form.addInputSelect({
      id: "reportOnly",
      label: "Report Only",
      helpText:
        "When true, uses the Content-Security-Policy-Report-Only header instead of the Content-Security-Policy header.",
      options: [
        { value: "true", label: "True" },
        { value: "false", label: "False" },
      ],
    });

    form.addInputText({
      id: "reportUri",
      label: "Report URI",
      helpText:
        "The relative or absolute URL to report any violations. If not defined, violations are reported to the __csp-violations function, which this plugin deploys.",
    });

    form.addInputSelect({
      id: "unsafeEval",
      label: "Unsafe Eval",
      helpText:
        "When true, adds 'unsafe-eval' to CSP for easier adoption. Set to false to have a safer policy if your code and code dependencies does not use eval().",
      options: [
        { value: "true", label: "True" },
        { value: "false", label: "False" },
      ],
    });

    form.addInputText({
      id: "path",
      label: "Path",
      helpText:
        "The glob expressions of path(s) that should invoke the CSP nonce edge function. Can be a string or array of strings.",
    });

    form.addInputText({
      id: "excludedPath",
      label: "Excluded Path",
      helpText:
        "The glob expressions of path(s) that *should not* invoke the CSP nonce edge function. Must be an array of strings. This value gets spread with common non-html filetype extensions (*.css, *.js, *.svg, etc)",
    });

    form.addText({
      value:
        "You can create a draft deploy, with the above configuration values, to test your CSP policy. This will not be published to production.",
    });

    form.addButton({
      id: "test",
      title: "Test",
      callback: async ({ surfaceInputsData, integrationContext }) => {
        const {
          "csp-configuration_reportOnly": reportOnly,
          "csp-configuration_reportUri": reportUri,
          "csp-configuration_unsafeEval": unsafeEval,
          "csp-configuration_path": path,
          "csp-configuration_excludedPath": excludedPath,
        } = surfaceInputsData;

        const config = {
          reportOnly,
          reportUri,
          unsafeEval,
          path,
          excludedPath,
        };

        const { netlifyToken, serverUrl, siteId } = integrationContext;
        await fetch(
          `${serverUrl}/.netlify/functions/handler/trigger-config-test?siteId=${siteId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "netlify-token": netlifyToken,
            },
            body: JSON.stringify(config),
          }
        );
      },
    });

    form.addText({
      value:
        "Saving your changes will not trigger a new build. To have the changes take effect, you must trigger a new build.",
    });
  }
);
export { integrationUI };
