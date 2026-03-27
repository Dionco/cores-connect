import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { mockNotifications } from "@/data/mockData";
import { toast } from "@/components/ui/sonner";
import {
  getStoredMockNotifications,
  hasStoredMockNotifications,
  notificationsChangedEvent,
  setStoredMockNotifications,
} from "@/lib/notifications";
import type { AppNotification, NotificationRow } from "@/types/notifications";

const MAX_NOTIFICATIONS = 50;

const getMockNotificationSnapshot = () => {
  if (hasStoredMockNotifications()) {
    return getStoredMockNotifications();
  }

  return mockNotifications;
};

const mapRow = (row: NotificationRow): AppNotification => ({
  id: row.id,
  createdAt: row.created_at,
  title: row.title,
  description: row.description,
  type: row.type,
  isRead: row.is_read,
  link: row.link ?? undefined,
  payload: row.payload ?? undefined,
});

const sortByNewest = (items: AppNotification[]) =>
  [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const setStoredSnapshot = (notifications: AppNotification[]) => {
  setStoredMockNotifications(notifications, { emitEvent: false });
};

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remoteEnabled, setRemoteEnabled] = useState(Boolean(isSupabaseConfigured && supabase));
  const hasCapturedInitialSnapshotRef = useRef(false);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());

  const unreadCount = useMemo(
    () => notifications.reduce((count, notification) => count + (notification.isRead ? 0 : 1), 0),
    [notifications],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!remoteEnabled || !supabase) {
      setNotifications(sortByNewest(getMockNotificationSnapshot()));
      setIsLoading(false);
      return;
    }

    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();

      if (userError || !userResult?.user?.id) {
        setNotifications(sortByNewest(getMockNotificationSnapshot()));
        setError(userError?.message ?? null);
        setIsLoading(false);
        return;
      }

      const userId = userResult.user.id;

      const { data, error: queryError } = await supabase
        .from("notifications")
        .select("id, created_at, title, description, type, is_read, link, payload")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_NOTIFICATIONS);

      if (queryError) {
        setError(queryError.message);
        setIsLoading(false);
        return;
      }

      const mapped = (data as NotificationRow[]).map(mapRow);
      setNotifications(mapped);
      setStoredSnapshot(mapped);
      setIsLoading(false);
    } catch {
      setRemoteEnabled(false);
      setNotifications(sortByNewest(getMockNotificationSnapshot()));
      setError("Unable to reach Supabase notifications. Using local notifications instead.");
      setIsLoading(false);
    }
  }, [remoteEnabled]);

  const markAsRead = useCallback(
    async (id: string) => {
      const previous = notifications;
      const updated = notifications.map((item) => (item.id === id ? { ...item, isRead: true } : item));
      setNotifications(updated);
      setStoredSnapshot(updated);

      if (!remoteEnabled || !supabase) {
        setStoredMockNotifications(updated);
        return;
      }

      try {
        const { data: userResult } = await supabase.auth.getUser();
        const userId = userResult.user?.id;

        if (!userId) {
          setStoredMockNotifications(updated);
          setError(null);
          return;
        }

        const { error: updateError } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id)
          .eq("user_id", userId);

        if (updateError) {
          setNotifications(previous);
          setStoredSnapshot(previous);
          setError(updateError.message);
        }
      } catch {
        setRemoteEnabled(false);
        setStoredSnapshot(updated);
      }
    },
    [notifications, remoteEnabled],
  );

  const markAllAsRead = useCallback(async () => {
    const previous = notifications;
    const updated = notifications.map((item) => ({ ...item, isRead: true }));
    setNotifications(updated);
    setStoredSnapshot(updated);

    if (!remoteEnabled || !supabase) {
      setStoredMockNotifications(updated);
      return;
    }

    try {
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult.user?.id;

      if (!userId) {
        setStoredMockNotifications(updated);
        setError(null);
        return;
      }

      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (updateError) {
        setNotifications(previous);
        setStoredSnapshot(previous);
        setError(updateError.message);
      }
    } catch {
      setRemoteEnabled(false);
      setStoredSnapshot(updated);
    }
  }, [notifications, remoteEnabled]);

  const removeNotification = useCallback(
    async (id: string) => {
      const previous = notifications;
      const updated = notifications.filter((item) => item.id !== id);
      setNotifications(updated);
      setStoredSnapshot(updated);

      if (!remoteEnabled || !supabase) {
        setStoredMockNotifications(updated);
        return;
      }

      try {
        const { data: userResult } = await supabase.auth.getUser();
        const userId = userResult.user?.id;

        if (!userId) {
          setStoredMockNotifications(updated);
          setError(null);
          return;
        }

        const { error: deleteError } = await supabase.from("notifications").delete().eq("id", id).eq("user_id", userId);

        if (deleteError) {
          setNotifications(previous);
          setStoredSnapshot(previous);
          setError(deleteError.message);
        }
      } catch {
        setRemoteEnabled(false);
        setStoredSnapshot(updated);
      }
    },
    [notifications, remoteEnabled],
  );

  const clearAllNotifications = useCallback(async () => {
    const previous = notifications;
    setNotifications([]);
    setStoredSnapshot([]);

    if (!remoteEnabled || !supabase) {
      setStoredMockNotifications([]);
      return;
    }

    try {
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult.user?.id;

      if (!userId) {
        setStoredMockNotifications([]);
        setError(null);
        return;
      }

      const { error: deleteError } = await supabase.from("notifications").delete().eq("user_id", userId);

      if (deleteError) {
        setNotifications(previous);
        setStoredSnapshot(previous);
        setError(deleteError.message);
      }
    } catch {
      setRemoteEnabled(false);
      setStoredSnapshot([]);
    }
  }, [notifications, remoteEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (remoteEnabled) {
      return;
    }

    const onNotificationsChanged = () => {
      setNotifications(sortByNewest(getMockNotificationSnapshot()));
    };

    window.addEventListener(notificationsChangedEvent, onNotificationsChanged);
    return () => {
      window.removeEventListener(notificationsChangedEvent, onNotificationsChanged);
    };
  }, [remoteEnabled]);

  useEffect(() => {
    if (!remoteEnabled || !supabase) {
      return;
    }

    let channel: RealtimeChannel | null = null;

    const setupRealtime = async () => {
      try {
        const { data: userResult, error: userError } = await supabase.auth.getUser();
        const userId = userResult.user?.id;

        if (userError || !userId) {
          return;
        }

        channel = supabase
          .channel(`notifications-${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              if (payload.eventType === "INSERT" && payload.new) {
                const incoming = mapRow(payload.new as NotificationRow);
                setNotifications((current) => {
                  const next = sortByNewest([incoming, ...current.filter((item) => item.id !== incoming.id)]);
                  setStoredSnapshot(next);
                  return next;
                });
                return;
              }

              if (payload.eventType === "UPDATE" && payload.new) {
                const incoming = mapRow(payload.new as NotificationRow);
                setNotifications((current) => {
                  const next = current.map((item) => (item.id === incoming.id ? incoming : item));
                  setStoredSnapshot(next);
                  return next;
                });
                return;
              }

              if (payload.eventType === "DELETE" && payload.old) {
                const deletedId = String((payload.old as { id?: string }).id ?? "");
                setNotifications((current) => {
                  const next = current.filter((item) => item.id !== deletedId);
                  setStoredSnapshot(next);
                  return next;
                });
              }
            },
          )
          .subscribe();
      } catch {
        setRemoteEnabled(false);
      }
    };

    void setupRealtime();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [remoteEnabled]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const currentIds = new Set(notifications.map((item) => item.id));

    if (!hasCapturedInitialSnapshotRef.current) {
      hasCapturedInitialSnapshotRef.current = true;
      seenNotificationIdsRef.current = currentIds;
      return;
    }

    const unseenUnreadNotifications = notifications.filter(
      (item) => !seenNotificationIdsRef.current.has(item.id) && !item.isRead,
    );

    unseenUnreadNotifications.forEach((item) => {
      toast(item.title, {
        description: item.description,
      });
    });

    seenNotificationIdsRef.current = currentIds;
  }, [isLoading, notifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    refresh: load,
  };
};
