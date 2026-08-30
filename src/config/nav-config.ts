import { NavGroup } from '@/types';

/**
 * Navigation configuration with RBAC support
 *
 * This configuration is used for both the sidebar navigation and Cmd+K bar.
 * Items are organized into groups, each rendered with a SidebarGroupLabel.
 *
 * RBAC Access Control:
 * Each navigation item can have an `access` property that controls visibility
 * based on the User's role (plan/feature checks require server-side
 * verification and are not yet wired into navigation filtering).
 *
 * Examples:
 *
 * 1. Require specific role:
 *    access: { role: 'admin' }
 *
 * 2. Require specific plan:
 *    access: { plan: 'pro' }
 *
 * 3. Require specific feature:
 *    access: { feature: 'premium_access' }
 *
 * Note: The `visible` function is deprecated but still supported for backward compatibility.
 * Use the `access` property for new items.
 */
export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard/overview',
        icon: 'dashboard',
        isActive: false,
        shortcut: ['d', 'd'],
        items: []
      },
      {
        title: 'Manage Staff',
        url: '/dashboard/staff',
        icon: 'teams',
        isActive: false,
        items: [],
        access: { role: 'admin' }
      },
      {
        title: 'Trips',
        url: '/dashboard/trips',
        icon: 'calendar',
        shortcut: ['t', 't'],
        isActive: false,
        items: []
      },
      {
        title: 'Participants',
        url: '/dashboard/participants',
        icon: 'user',
        shortcut: ['p', 'a'],
        isActive: false,
        items: []
      }
    ]
  }
];
