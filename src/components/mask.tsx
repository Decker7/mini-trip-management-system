import { PH_MASK_CLASS } from '@/lib/posthog-config';

/** Wraps PII so PostHog session replay masks it — see docs/adr/0003-posthog-cloud-eu-and-users-only-identification.md. */
export function Mask({ children }: { children: React.ReactNode }) {
  return <span className={PH_MASK_CLASS}>{children}</span>;
}
