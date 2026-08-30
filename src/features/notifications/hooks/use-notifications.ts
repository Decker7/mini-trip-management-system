'use client';

import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import type { Notification } from '../utils/store';

export function useNotifications() {
  const result = useQuery(api.notifications.list, {});
  const markReadMutation = useMutation(api.notifications.markRead);
  const markAllReadMutation = useMutation(api.notifications.markAllRead);

  const notifications: Notification[] = (result?.notifications ?? []).map((notification) => ({
    id: notification.registrationId,
    title: 'New registration',
    body: `${notification.participantName} registered for ${notification.tripName}.`,
    status: notification.read ? 'read' : 'unread',
    createdAt: new Date(notification.registeredAt).toISOString(),
    actions: [
      {
        id: 'view-trip',
        label: 'View trip',
        type: 'redirect',
        style: 'primary',
        href: `/dashboard/trips/${notification.tripId}`
      }
    ]
  }));

  const markAsRead = (id: string) => {
    void markReadMutation({ registrationId: id as Id<'registrations'> });
  };

  const markAllAsRead = () => {
    void markAllReadMutation({});
  };

  const unreadCount = () => notifications.filter((n) => n.status === 'unread').length;

  return {
    notifications,
    isLoading: result === undefined,
    markAsRead,
    markAllAsRead,
    unreadCount
  };
}
