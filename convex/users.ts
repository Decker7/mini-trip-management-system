import { query } from './_generated/server';
import { getIdentity } from './lib/identity';

export const whoami = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentity(ctx);
    if (!identity) {
      return null;
    }
    return {
      subject: identity.subject,
      role: identity.role ?? null
    };
  }
});
