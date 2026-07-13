/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as lib_authHelpers from "../lib/authHelpers.js";
import type * as lib_config from "../lib/config.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as lib_filePolicy from "../lib/filePolicy.js";
import type * as lib_middleware_withRateLimit from "../lib/middleware/withRateLimit.js";
import type * as lib_services_rateLimitService from "../lib/services/rateLimitService.js";
import type * as maintenance from "../maintenance.js";
import type * as messages from "../messages.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  files: typeof files;
  http: typeof http;
  "lib/authHelpers": typeof lib_authHelpers;
  "lib/config": typeof lib_config;
  "lib/customFunctions": typeof lib_customFunctions;
  "lib/filePolicy": typeof lib_filePolicy;
  "lib/middleware/withRateLimit": typeof lib_middleware_withRateLimit;
  "lib/services/rateLimitService": typeof lib_services_rateLimitService;
  maintenance: typeof maintenance;
  messages: typeof messages;
  seed: typeof seed;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
