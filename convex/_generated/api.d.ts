/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activityLogs from '../activityLogs.js';
import type * as dashboard from '../dashboard.js';
import type * as lib_activityLog from '../lib/activityLog.js';
import type * as lib_identity from '../lib/identity.js';
import type * as notifications from '../notifications.js';
import type * as participants from '../participants.js';
import type * as paymentLinks from '../paymentLinks.js';
import type * as registrations from '../registrations.js';
import type * as staffAccounts from '../staffAccounts.js';
import type * as trips from '../trips.js';
import type * as users from '../users.js';

import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server';

declare const fullApi: ApiFromModules<{
  activityLogs: typeof activityLogs;
  dashboard: typeof dashboard;
  'lib/activityLog': typeof lib_activityLog;
  'lib/identity': typeof lib_identity;
  notifications: typeof notifications;
  participants: typeof participants;
  paymentLinks: typeof paymentLinks;
  registrations: typeof registrations;
  staffAccounts: typeof staffAccounts;
  trips: typeof trips;
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
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, 'public'>>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, 'internal'>>;

export declare const components: {};
