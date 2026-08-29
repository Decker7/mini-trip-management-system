import { defineApp } from 'convex/server';
import { v } from 'convex/values';

const app = defineApp({
  env: {
    CLERK_SECRET_KEY: v.string(),
    APP_URL: v.string()
  }
});

export default app;
