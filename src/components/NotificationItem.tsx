import { Link as LinkIcon, AlertCircle, Bell, CheckCircle2, TriangleAlert, Trash2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { AppNotification } from "@/types/notifications";

interface NotificationItemProps {
  notification: AppNotification;
  onClick: (notification: AppNotification) => void;
  onDelete: (notification: AppNotification) => void;
}

const typeIconMap = {
  info: Bell,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
} as const;

const typeColorMap = {
  info: "text-blue-600",
  success: "text-emerald-600",
  warning: "text-amber-600",
  error: "text-red-600",
} as const;

const NotificationItem = ({ notification, onClick, onDelete }: NotificationItemProps) => {
  const { t } = useLanguage();
  const Icon = typeIconMap[notification.type];
  const relativeTime = formatDistanceToNowStrict(new Date(notification.createdAt), { addSuffix: true });

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "flex h-auto w-full items-start justify-start gap-3 whitespace-normal rounded-lg p-3 text-left hover:bg-muted/70",
        notification.isRead ? "opacity-60" : "bg-blue-50/60",
      )}
      onClick={() => onClick(notification)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(notification);
        }
      }}
    >
      <div className={cn("mt-0.5", typeColorMap[notification.type])}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-3">
          <p className="break-words text-sm font-semibold text-foreground">{notification.title}</p>
          {!notification.isRead ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" /> : null}
        </div>
        <p className="break-words text-xs text-muted-foreground">{notification.description}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">{relativeTime}</p>
          {notification.link ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
              <LinkIcon size={12} /> {t("notifications.openAction")}
            </span>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label={t("notifications.deleteAction")}
        onClick={(event) => {
          event.stopPropagation();
          onDelete(notification);
        }}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
};

export default NotificationItem;
