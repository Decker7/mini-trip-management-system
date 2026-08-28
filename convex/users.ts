import { query } from './_generated/server';

// Clerk's JWT template adds `role` as a custom claim on top of the standard
// OIDC identity fields; the generated UserIdentity type doesn't know about it.
type IdentityWithRole = {
  subject: string;
  role?: 'admin' | 'staff';
};

export const whoami = query({
  args: {},
  handler: async (ctx) => {
    const identity = (await ctx.auth.getUserIdentity()) as IdentityWithRole | null;
    if (!identity) {
      return null;
    }
    return {
      subject: identity.subject,
      role: identity.role ?? null
    };
  }
});
