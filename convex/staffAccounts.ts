import { ConvexError, v } from 'convex/values';
import { action } from './_generated/server';
import { env } from './_generated/server';
import { requireAdmin } from './lib/identity';

const CLERK_API_BASE = 'https://api.clerk.com/v1';

const userRole = v.union(v.literal('admin'), v.literal('staff'));

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
  public_metadata: Record<string, unknown>;
};

function primaryEmail(user: ClerkUser) {
  const primary = user.email_addresses.find((email) => email.id === user.primary_email_address_id);
  return (primary ?? user.email_addresses[0])?.email_address ?? '';
}

function toStaffAccount(user: ClerkUser) {
  const metadataRole = user.public_metadata.role;
  const role: 'admin' | 'staff' | null =
    metadataRole === 'admin' || metadataRole === 'staff' ? metadataRole : null;
  return {
    userId: user.id,
    fullName: [user.first_name, user.last_name].filter(Boolean).join(' '),
    email: primaryEmail(user),
    role
  };
}

async function clerkFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${CLERK_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...init?.headers
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new ConvexError(`Clerk API request failed (${response.status}): ${body}`);
  }
  return response.json();
}

export const listUsers = action({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Clerk caps a single page at 500 users; this app's Staff roster is
    // small enough that a second page is not worth paginating for yet.
    const users = (await clerkFetch('/users?limit=500&order_by=-created_at')) as ClerkUser[];
    return users.map(toStaffAccount);
  }
});

export const updateUserRole = action({
  args: { userId: v.string(), role: userRole },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // publicMetadata is replaced wholesale on every update, so the existing
    // Clerk User is read first and its other fields are preserved.
    const user = (await clerkFetch(`/users/${args.userId}`)) as ClerkUser;
    await clerkFetch(`/users/${args.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        public_metadata: { ...user.public_metadata, role: args.role }
      })
    });
  }
});

export const revokeStaffAccess = action({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const user = (await clerkFetch(`/users/${args.userId}`)) as ClerkUser;
    if (user.public_metadata.role !== 'staff') {
      throw new ConvexError('Only Staff accounts can have their access revoked here.');
    }
    const remainingMetadata = { ...user.public_metadata };
    delete remainingMetadata.role;
    await clerkFetch(`/users/${args.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ public_metadata: remainingMetadata })
    });
  }
});

export const inviteStaff = action({
  args: { emailAddress: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!args.emailAddress.trim()) {
      throw new ConvexError('Email address is required.');
    }
    await clerkFetch('/invitations', {
      method: 'POST',
      body: JSON.stringify({
        email_address: args.emailAddress,
        public_metadata: { role: 'staff' }
      })
    });
  }
});
