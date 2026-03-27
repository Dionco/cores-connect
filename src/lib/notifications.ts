import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AppNotification, NotificationType } from "@/types/notifications";

const MOCK_STORAGE_KEY = "cores-notifications";
const MOCK_EVENT = "cores:notifications:changed";

export interface CreateNotificationInput {
  title: string;
  description: string;
  type: NotificationType;
  link?: string;
  payload?: Record<string, unknown>;
}

const createMockNotification = (input: CreateNotificationInput): AppNotification => ({
  id: `ntf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  createdAt: new Date().toISOString(),
  title: input.title,
  description: input.description,
  type: input.type,
  isRead: false,
  link: input.link,
  payload: input.payload,
});

export const getStoredMockNotifications = (): AppNotification[] => {
  const raw = localStorage.getItem(MOCK_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as AppNotification[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
};

export const hasStoredMockNotifications = (): boolean => localStorage.getItem(MOCK_STORAGE_KEY) !== null;

export const setStoredMockNotifications = (
  notifications: AppNotification[],
  options?: { emitEvent?: boolean },
) => {
  const emitEvent = options?.emitEvent ?? true;
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(notifications));
  if (emitEvent) {
    window.dispatchEvent(new CustomEvent(MOCK_EVENT));
  }
};

export const notificationsChangedEvent = MOCK_EVENT;

export const createAppNotification = async (input: CreateNotificationInput) => {
  if (!isSupabaseConfigured || !supabase) {
    const current = getStoredMockNotifications();
    setStoredMockNotifications([createMockNotification(input), ...current]);
    return;
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  const userId = userResult.user?.id;

  if (userError || !userId) {
    return;
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    title: input.title,
    description: input.description,
    type: input.type,
    is_read: false,
    link: input.link ?? null,
    payload: input.payload ?? null,
  });
};
