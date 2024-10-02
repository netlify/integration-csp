Use a [nonce](https://content-security-policy.com/nonce/) for the `script-src` directive of your Content Security Policy (CSP) to help prevent [cross-site scripting (XSS)](https://developer.mozilla.org/en-US/docs/Web/Security/Types_of_attacks#cross-site_scripting_xss) attacks.

This extension deploys an edge function that adds a response header and transforms the HTML response body to contain a unique nonce on every request, along with an optional function to log CSP violations.

Scripts that do not contain a matching `nonce` attribute, or that were not created from a trusted script (see [strict-dynamic](https://content-security-policy.com/strict-dynamic/)), will not be allowed to run.

You can use this extension whether or not your site already has a CSP in place. If your site already has a CSP, the nonce will merge with your existing directives.

🧩 This extension is installed and configured in the Netlify UI. If you prefer a configuration-as-code approach, check out the [@netlify/plugin-csp-nonce](https://www.npmjs.com/package/@netlify/plugin-csp-nonce) npm package.

## Configuration options

- #### `reportOnly`

  _Default: `true`_.

  When true, uses the `Content-Security-Policy-Report-Only` header instead of the `Content-Security-Policy` header. Setting `reportOnly` to `true` is useful for testing the CSP with real production traffic without actually blocking resources. Be sure to monitor your logging function to observe potential violations.

- #### `reportUri`

  _Default: `undefined`_.

  The relative or absolute URL to report any violations. If left undefined, violations are reported to the `__csp-violations` function, which this extension deploys. If your site already has a `report-uri` directive defined in its CSP header, then that value will take precedence.

- #### `unsafeEval`

  _Default: `true`._

  When true, adds `'unsafe-eval'` to the CSP for easier adoption. Set to `false` to have a safer policy if your code and code dependencies does not use `eval()`.

- #### `path`

  _Default: `/*`._

  The glob expressions of path(s) that should invoke the CSP nonce edge function. Can be a string or array of strings.

- #### `excludedPath`

  _Default: `[]`_

  The glob expressions of path(s) that _should not_ invoke the CSP nonce edge function. Must be an array of strings. This value gets spread with common non-html filetype extensions (`*.css`, `*.js`, `*.svg`, etc).

## Debugging

### Limiting edge function invocations

By default, the edge function that inserts the nonce will be invoked on all requests whose path

- does not begin with `/.netlify/`
- does not end with common non-HTML filetype extensions

To further limit invocations, add globs to the `excludedPath` configuration option that are specific to your site.

Requests that invoke the nonce edge function will contain a `x-debug-csp-nonce: invoked` response header. Use this to determine if unwanted paths are invoking the edge function, and add those paths to the `excludedPath` array.

Also, monitor the edge function logs in the Netlify UI. If the edge function is invoked but the response is not transformed, the request's path will be logged.

### Not transforming as expected

If your HTML does not contain the `nonce` attribute on the `<script>` tags that you expect, ensure that all of these criteria are met:

- The request method is `GET`
- The `content-type` response header starts with `text/html`
- The path of the request is satisfied by the `path` config option, and not included in the `excludedPath` config option

### Controlling rollout

You may want to gradually rollout the effects of this extension while you monitor violation reports, without modifying code.

You can ramp up or ramp down the inclusion of the `Content-Security-Policy` header by setting the `CSP_NONCE_DISTRIBUTION` environment variable to a value between `0` and `1`.

- If `0`, the extension is completely skipped at build time, and no extra functions or edge functions get deployed. Functionally, this acts the same as if the extension isn't installed at all.
- If `1`, 100% of traffic for all matching paths will include the nonce. Functionally, this acts the same as if the `CSP_NONCE_DISTRIBUTION` environment variable was not defined.
- Any value in between `0` and `1` will include the nonce in randomly distributed traffic. For example, a value of `0.25` will put the nonce in the `Content-Security-Policy` header 25% of requests for matching paths. The other 75% of matching requests will have the nonce in the `Content-Security-Policy-Report-Only` header.

The `CSP_NONCE_DISTRIBUTION` environment variable needs to be scoped to both `Builds` and `Functions`.
