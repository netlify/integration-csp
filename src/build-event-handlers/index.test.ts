import { fileURLToPath } from "node:url";
import build from "@netlify/build";
import { describe, expect, it } from "vitest";
import { createOnPreBuild } from "./index.js";
import { createInitializeFixture } from "../test/fixture_utils.js";

describe("onPreBuild", () => {
  const initializeFixture = createInitializeFixture(
    fileURLToPath(new URL("../test/fixtures", import.meta.url)),
    "csp-build-event-handler",
  );

  // XXX(ndhoule): This... well, it _works_, but maybe it's just better to execute netlify build
  // in a subprocess. But, then how do we inject options into the extension build event handler?
  // Maybe there's already a way to test extension build handlers and I'm just dumb.
  it("has a basic test", { timeout: 60000 }, async (ctx) => {
    const [cwd, cleanupTmpdir] = await initializeFixture("basic-test");
    ctx.onTestFinished(cleanupTmpdir);

    // XXX(ndhoule): Gross, but Without this, the build plugin runs in the test process's cwd.
    // It'd be great if @netlify/build passed its `cwd` down into plugins on the constants object.
    const originalDir = process.cwd();
    process.chdir(cwd);
    ctx.onTestFinished(() => {
      process.chdir(originalDir);
    });

    const result = await build({
      buffer: true,
      context: "dev",
      cwd,
      debug: true,
      eventHandlers: {
        onPreBuild: async (...args) => {
          await createOnPreBuild({
            // TODO(ndhoule): Here's where we can inject the options passed to the build event handler
          })(...args);

          // XXX(ndhoule): Upstream a fix for this to @netlify/build; the type on hooks is that
          // they return `Promise<void> | void` but if you don't return an object, @netlify/build
          // crashes.
          return {} as unknown as undefined;
        },
      },
    });

    expect(result.success).toBe(true);
  });
});
