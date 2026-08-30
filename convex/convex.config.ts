import { defineApp } from 'convex/server';
import { v } from 'convex/values';

const app = defineApp({
  env: {
    CLERK_SECRET_KEY: v.string(),
    APP_URL: v.string(),
    STRIPE_SECRET_KEY: v.optional(v.string()),
    RESEND_API_KEY: v.optional(v.string()),
    RESEND_FROM_EMAIL: v.optional(v.string())
  }
});

export default app;
