import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import NotificationList from "@/components/NotificationList";
import { useNotifications } from "@/hooks/useNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { createAppNotification } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { AppNotification } from "@/types/notifications";

const NotificationCenter = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, removeNotification, clearAllNotifications, error } =
    useNotifications();

  const badgeText = useMemo(() => {
    if (unreadCount <= 0) return "";
    if (unreadCount > 99) return "99+";
    return String(unreadCount);
  }, [unreadCount]);

  const onNotificationClick = async (notification: AppNotification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    if (notification.link) {
      navigate(notification.link);
      setOpen(false);
    }
  };

  const header = (
    <div className="flex items-center justify-between gap-3 border-b pb-3">
      <div>
        <h3 className="text-sm font-semibold">{t("notifications.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("notifications.subtitle")}</p>
      </div>
    </div>
  );

  const devAction = import.meta.env.DEV ? (
    <div className="flex justify-end">
      {/* <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void createAppNotification({
            title: "Test notification",
            description: "This is a sample notification so you can preview the center behavior.",
            type: "info",
            link: "/dashboard",
            payload: { source: "notification-center-dev-action" },
          });
        }}
      >
        Add test notification
      </Button> */}
    </div>
  ) : null;

  const content = (
    <div className="space-y-3">
      {header}
      {devAction}
      <NotificationList
        notifications={notifications}
        isLoading={isLoading}
        emptyLabel={t("notifications.empty")}
        onItemClick={(notification) => {
          void onNotificationClick(notification);
        }}
        onItemDelete={(notification) => {
          void removeNotification(notification.id);
        }}
      />
      <div className="flex items-center justify-between border-t pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void markAllAsRead();
          }}
          disabled={unreadCount === 0}
        >
          {t("notifications.markAllRead")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void clearAllNotifications();
          }}
          disabled={notifications.length === 0}
        >
          {t("notifications.clearAll")}
        </Button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );

  const trigger = (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="relative"
      aria-label={
        unreadCount > 0
          ? t("notifications.unreadAria").replace("{count}", String(unreadCount))
          : t("notifications.openAria")
      }
    >
      <Bell size={18} />
      {unreadCount > 0 ? (
        <Badge className="absolute -right-1 -top-1 min-w-5 justify-center px-1 py-0 text-[10px] leading-4">
          {badgeText}
        </Badge>
      ) : null}
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="right" className="w-full p-4 sm:max-w-sm">
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-4">
        {content}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
