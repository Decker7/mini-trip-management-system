import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireAdmin, requireAssignedRole } from './lib/identity';
import type { Doc } from './_generated/dataModel';

const tripStatus = v.union(v.literal('upcoming'), v.literal('ongoing'), v.literal('completed'));

export function deriveStatus(trip: Pick<Doc<'trips'>, 'startDate' | 'endDate'>, today: string) {
  if (today < trip.startDate) return 'upcoming' as const;
  if (today > trip.endDate) return 'completed' as const;
  return 'ongoing' as const;
}

const tripFields = {
  name: v.string(),
  destination: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  capacity: v.number(),
  price: v.number(),
  description: v.optional(v.string())
};

function validateTripFields(args: {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  capacity: number;
  price: number;
}) {
  if (!args.name.trim()) {
    throw new ConvexError('Trip name is required.');
  }
  if (!args.destination.trim()) {
    throw new ConvexError('Destination is required.');
  }
  if (!args.startDate || !args.endDate) {
    throw new ConvexError('Start and end dates are required.');
  }
  if (args.endDate < args.startDate) {
    throw new ConvexError('End date cannot be before start date.');
  }
  if (!Number.isFinite(args.capacity) || args.capacity <= 0) {
    throw new ConvexError('Capacity must be greater than zero.');
  }
  if (!Number.isFinite(args.price) || args.price < 0) {
    throw new ConvexError('Price cannot be negative.');
  }
}

export const list = query({
  args: {
    today: v.string(),
    search: v.optional(v.string()),
    status: v.optional(tripStatus),
    startDateFrom: v.optional(v.string()),
    startDateTo: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireAssignedRole(ctx);

    const trips = await ctx.db.query('trips').order('desc').take(500);
    const search = args.search?.trim().toLowerCase();

    return trips
      .filter((trip) => {
        if (search) {
          const haystack = `${trip.name} ${trip.destination}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        if (args.startDateFrom && trip.startDate < args.startDateFrom) return false;
        if (args.startDateTo && trip.startDate > args.startDateTo) return false;
        return true;
      })
      .map((trip) => ({ ...trip, status: deriveStatus(trip, args.today) }))
      .filter((trip) => !args.status || trip.status === args.status);
  }
});

export const get = query({
  args: { tripId: v.id('trips'), today: v.string() },
  handler: async (ctx, args) => {
    await requireAssignedRole(ctx);
    const trip = await ctx.db.get(args.tripId);
    if (!trip) return null;
    return { ...trip, status: deriveStatus(trip, args.today) };
  }
});

export const create = mutation({
  args: tripFields,
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    validateTripFields(args);
    return await ctx.db.insert('trips', { ...args, createdBy: identity.subject });
  }
});

export const update = mutation({
  args: { tripId: v.id('trips'), ...tripFields },
  handler: async (ctx, { tripId, ...fields }) => {
    await requireAdmin(ctx);
    validateTripFields(fields);
    const existing = await ctx.db.get(tripId);
    if (!existing) {
      throw new ConvexError('Trip not found.');
    }
    await ctx.db.patch(tripId, fields);
  }
});

export const remove = mutation({
  args: { tripId: v.id('trips') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.tripId);
    if (!existing) {
      throw new ConvexError('Trip not found.');
    }
    const registrations = await ctx.db
      .query('registrations')
      .withIndex('by_trip', (q) => q.eq('tripId', args.tripId))
      .collect();
    const hasActiveRegistrations = registrations.some(
      (registration) => registration.registrationStatus !== 'cancelled'
    );
    if (hasActiveRegistrations) {
      throw new ConvexError('Cannot delete a Trip that has active Registrations.');
    }
    for (const registration of registrations) {
      await ctx.db.delete(registration._id);
    }
    await ctx.db.delete(args.tripId);
  }
});
