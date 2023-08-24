import { NetlifyIntegrationUI } from "@netlify/sdk";

const integrationUI = new NetlifyIntegrationUI("dynamic-csp");

const surface = integrationUI.addSurface("integrations-settings");

const root = surface.addRoute("/");

root.onLoad(
  async ({ picker, surfaceInputsData, surfaceRouteConfig, fetch }) => {
    const res = await fetch(`get-config`);

    const { has_build_hook_enabled, cspConfig } = await res.json();

    picker.getElementById("enable-build-hooks").display = has_build_hook_enabled
      ? "hidden"
      : "visible";
    picker.getElementById("disable-build-hooks").display =
      has_build_hook_enabled ? "visible" : "hidden";

    picker.getElementById("csp-configuration").display = has_build_hook_enabled
      ? "visible"
      : "hidden";

    surfaceInputsData["csp-configuration_reportOnly"] =
      cspConfig.reportOnly ?? "true";
    surfaceInputsData["csp-configuration_reportUri"] =
      cspConfig.reportUri ?? "";
    surfaceInputsData["csp-configuration_unsafeEval"] =
      cspConfig.unsafeEval ?? "true";
    surfaceInputsData["csp-configuration_path"] =
      cspConfig.path?.join("\n") ?? "";
    surfaceInputsData["csp-configuration_excludedPath"] =
      cspConfig.excludedPath?.join("\n") ?? "";

    return {
      surfaceInputsData,
      surfaceRouteConfig,
    };
  }
);

const mapConfig = (surfaceInputsData: Record<string, string | string[]>) => {
  const {
    "csp-configuration_reportOnly": reportOnly = "true",
    "csp-configuration_reportUri": reportUri = "",
    "csp-configuration_unsafeEval": unsafeEval = "true",
    "csp-configuration_path": configPath = "/*",
    "csp-configuration_excludedPath": configExcludedPath = "",
  } = surfaceInputsData;

  if (
    typeof configPath !== "string" ||
    typeof configExcludedPath !== "string"
  ) {
    throw new Error("Invalid config");
  }

  const path = configPath === "" ? [] : configPath.split("\n");
  const excludedPath =
    configExcludedPath === "" ? [] : configExcludedPath.split("\n");

  const config = {
    reportOnly,
    reportUri,
    unsafeEval,
    path: path,
    excludedPath,
  };

  return config;
};

root.addCard(
  {
    id: "enable-build-hooks-card",
    title: "Dynamic Content Security Policy",
  },
  (card) => {
    card.addText({
      value:
        "Enabling or disabling this integration affects the Content-Security-Policy header of future deploys.",
    });

    card.addLink({
      text: "Learn more in the integration readme",
      href: "https://github.com/netlify/integration-csp",
      target: "_blank",
    });

    card.addButton({
      id: "enable-build-hooks",
      title: "Enable",
      callback: async ({ picker, fetch }) => {
        const res = await fetch(`enable-build`, {
          method: "POST",
        });

        if (res.ok) {
          picker.getElementById("enable-build-hooks").display = "hidden";
          picker.getElementById("disable-build-hooks").display = "visible";

          picker.getElementById("csp-configuration").display = "visible";
        }
      },
    });

    card.addButton({
      id: "disable-build-hooks",
      title: "Disable",
      display: "hidden",
      callback: async ({ picker, fetch }) => {
        const res = await fetch(`disable-build`, {
          method: "POST",
        });

        if (res.ok) {
          picker.getElementById("enable-build-hooks").display = "visible";
          picker.getElementById("disable-build-hooks").display = "hidden";

          picker.getElementById("csp-configuration").display = "hidden";
        }
      },
    });
  }
);

root.addForm(
  {
    id: "csp-configuration",
    title: "Configuration",
    display: "hidden",
    onSubmit: async ({ surfaceInputsData, fetch }) => {
      const config = mapConfig(surfaceInputsData);

      await fetch(`save-config`, {
        method: "POST",
        body: JSON.stringify(config),
      });
    },
  },
  (form) => {
    form.addInputSelect({
      id: "reportOnly",
      label: "Report Only",
      helpText:
        "When true, the Content-Security-Policy-Report-Only header is used instead of the Content-Security-Policy header.",
      options: [
        { value: "true", label: "True" },
        { value: "false", label: "False" },
      ],
    });

    form.addInputText({
      id: "reportUri",
      label: "Report URI",
      helpText:
        "The relative or absolute URL to report any violations. If not defined, violations are reported to the __csp-violations function, which is deployed by this integration.",
    });

    form.addInputSelect({
      id: "unsafeEval",
      label: "Unsafe Eval",
      helpText:
        "When true, adds the 'unsafe-eval' source to the CSP for easier adoption. Set to false to have a safer policy if your code and code dependencies do not use eval().",
      options: [
        { value: "true", label: "True" },
        { value: "false", label: "False" },
      ],
    });

    form.addInputText({
      id: "path",
      label: "Path",
      fieldType: "textarea",
      helpText:
        "The glob expressions of path(s) that should invoke the integration's edge function, separated by newlines.",
    });

    form.addInputText({
      id: "excludedPath",
      label: "Excluded Path",
      fieldType: "textarea",
      helpText:
        "The glob expressions of path(s) that *should not* invoke the integration's edge function, separated by newlines. Common non-html filetype extensions (*.css, *.js, *.svg, etc) are already excluded.",
    });

    form.addText({
      value:
        "Test your configuration on a draft Deploy Preview to inspect your CSP before going live. This deploy will not publish to production.",
    });

    form.addButton({
      id: "test",
      title: "Test on Deploy Preview",
      callback: async ({ surfaceInputsData, fetch }) => {
        const config = mapConfig(surfaceInputsData);

        await fetch(`trigger-config-test`, {
          method: "POST",
          body: JSON.stringify(config),
        });
      },
    });

    form.addText({
      value: "After saving, your configuration will apply to future deploys.",
    });
  }
);
export { integrationUI };
