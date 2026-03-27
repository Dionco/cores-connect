import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import NotificationCenter from "@/components/NotificationCenter";
import type { AppNotification } from "@/types/notifications";

const mockNavigate = vi.fn();
const mockMarkAsRead = vi.fn();
const mockMarkAllAsRead = vi.fn();
const mockRemoveNotification = vi.fn();
const mockClearAllNotifications = vi.fn();

const mockNotifications: AppNotification[] = [
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

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: mockNotifications,
    unreadCount: 2,
    isLoading: false,
    error: null,
    markAsRead: mockMarkAsRead,
    markAllAsRead: mockMarkAllAsRead,
    removeNotification: mockRemoveNotification,
    clearAllNotifications: mockClearAllNotifications,
    refresh: vi.fn(),
  }),
}));

const renderCenter = () =>
  render(
    <BrowserRouter>
      <LanguageProvider>
        <NotificationCenter />
      </LanguageProvider>
    </BrowserRouter>,
  );

describe("NotificationCenter", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockMarkAsRead.mockReset();
    mockMarkAsRead.mockResolvedValue(undefined);
    mockMarkAllAsRead.mockReset();
    mockMarkAllAsRead.mockResolvedValue(undefined);
    mockRemoveNotification.mockReset();
    mockRemoveNotification.mockResolvedValue(undefined);
    mockClearAllNotifications.mockReset();
    mockClearAllNotifications.mockResolvedValue(undefined);
  });

  it("marks single notification as read and navigates on click", async () => {
    renderCenter();

    fireEvent.click(screen.getByRole("button", { name: /open notifications/i }));
    fireEvent.click(screen.getByText("A"));

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith("ntf-a");
      expect(mockNavigate).toHaveBeenCalledWith("/absence");
    });
  });

  it("runs mark all as read action", async () => {
    renderCenter();

    fireEvent.click(screen.getByRole("button", { name: /open notifications/i }));
    fireEvent.click(screen.getByRole("button", { name: /mark all as read/i }));

    await waitFor(() => {
      expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1);
    });
  });

  it("removes a single notification", async () => {
    renderCenter();

    fireEvent.click(screen.getByRole("button", { name: /open notifications/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /delete notification/i })[0]);

    await waitFor(() => {
      expect(mockRemoveNotification).toHaveBeenCalledWith("ntf-a");
    });
  });

  it("clears all notifications", async () => {
    renderCenter();

    fireEvent.click(screen.getByRole("button", { name: /open notifications/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));

    await waitFor(() => {
      expect(mockClearAllNotifications).toHaveBeenCalledTimes(1);
    });
  });
});
