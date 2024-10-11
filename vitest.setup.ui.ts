import "@testing-library/jest-dom/vitest";

import { TextEncoder, TextDecoder } from "node:util";
import { cleanup } from "@testing-library/react";
import * as jestExtendedMatchers from "jest-extended";
import { afterEach, expect } from "vitest";

expect.extend(jestExtendedMatchers);

// happy-dom does not provide this global but msw/node relies on it, so polyfill it
if ("TextDecoder" in globalThis) {
  throw new Error(
    "happy-dom now supports `global.TextDecoder` and the polyfill at this stacktrace can be removed.",
  );
} else {
  Object.defineProperty(globalThis, "TextDecoder", {
    configurable: true,
    enumerable: false,
    value: TextDecoder,
    writable: true,
  });
}

// happy-dom does not provide this global but msw/node relies on it, so polyfill it
if ("TextEncoder" in globalThis) {
  throw new Error(
    "happy-dom now supports `global.TextEncoder` and the polyfill at this stacktrace can be removed.",
  );
} else {
  Object.defineProperty(globalThis, "TextEncoder", {
    configurable: true,
    enumerable: false,
    value: TextEncoder,
    writable: true,
  });
}

afterEach(() => {
  cleanup();
});
