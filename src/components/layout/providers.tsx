'use client';
import { ClerkProvider } from '@clerk/nextjs';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import React from 'react';
import { ActiveThemeProvider } from '../themes/active-theme';
import ConvexClientProvider from './convex-client-provider';
import { PostHogIdentify } from './posthog-identify';
import QueryProvider from './query-provider';

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <ActiveThemeProvider initialTheme={activeThemeValue}>
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: 'var(--primary)',
              colorPrimaryForeground: 'var(--primary-foreground)',
              colorDanger: 'var(--destructive)',
              colorBackground: 'var(--card)',
              colorForeground: 'var(--foreground)',
              colorMuted: 'var(--muted)',
              colorMutedForeground: 'var(--muted-foreground)',
              colorInput: 'var(--input)',
              colorInputForeground: 'var(--foreground)',
              colorBorder: 'var(--border)',
              colorRing: 'var(--ring)',
              fontFamily: 'var(--font-sans)'
            }
          }}
        >
          <ConvexClientProvider>
            <QueryProvider>
              <PostHogProvider client={posthog}>
                <PostHogIdentify />
                {children}
              </PostHogProvider>
            </QueryProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </ActiveThemeProvider>
    </>
  );
}
