import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotifications } from "@/hooks/useNotifications";
import { setStoredMockNotifications } from "@/lib/notifications";
import type { AppNotification } from "@/types/notifications";

const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

const testNotifications: AppNotification[] = [
  {
    id: "ntf-a",
    createdAt: "2026-03-27T09:18:00.000Z",
    title: "A",
    description: "First",
    type: "info",
    isRead: false,
    link: "/absence",
  },
  {
    id: "ntf-b",
    createdAt: "2026-03-27T08:18:00.000Z",
    title: "B",
    description: "Second",
    type: "success",
    isRead: false,
    link: "/provisioning",
  },
];

describe("useNotifications", () => {
  beforeEach(() => {
    localStorage.clear();
    mockToast.mockReset();
    setStoredMockNotifications(testNotifications);
  });

  it("loads mock notifications from local storage", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(2);
  });

  it("marks a single notification as read", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.markAsRead("ntf-a");
    });

    expect(result.current.unreadCount).toBe(1);
    expect(result.current.notifications.find((item) => item.id === "ntf-a")?.isRead).toBe(true);
  });

  it("marks all notifications as read", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((item) => item.isRead)).toBe(true);
  });

  it("removes a single notification", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.removeNotification("ntf-a");
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].id).toBe("ntf-b");
    expect(result.current.unreadCount).toBe(1);
  });

  it("clears all notifications", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.clearAllNotifications();
    });

    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });

  it("keeps notifications cleared after remount", async () => {
    const firstMount = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(firstMount.result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await firstMount.result.current.clearAllNotifications();
    });

    expect(firstMount.result.current.notifications).toHaveLength(0);

    firstMount.unmount();

    const secondMount = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(secondMount.result.current.isLoading).toBe(false);
    });

    expect(secondMount.result.current.notifications).toHaveLength(0);
    expect(secondMount.result.current.unreadCount).toBe(0);
  });

  it("shows a toast when a new notification arrives", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockToast).not.toHaveBeenCalled();

    await act(async () => {
      setStoredMockNotifications([
        {
          id: "ntf-c",
          createdAt: "2026-03-27T10:18:00.000Z",
          title: "C",
          description: "Third",
          type: "warning",
          isRead: false,
          link: "/dashboard",
        },
        ...testNotifications,
      ]);
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("C", {
        description: "Third",
      });
    });
  });
});
