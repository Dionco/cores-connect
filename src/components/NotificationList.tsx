import NotificationItem from "@/components/NotificationItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AppNotification } from "@/types/notifications";

interface NotificationListProps {
  notifications: AppNotification[];
  isLoading: boolean;
  emptyLabel: string;
  onItemClick: (notification: AppNotification) => void;
  onItemDelete: (notification: AppNotification) => void;
}

const LoadingRow = () => (
  <div className="space-y-2 rounded-lg border p-3">
    <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
    <div className="h-3 w-full animate-pulse rounded bg-muted" />
    <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
  </div>
);

const NotificationList = ({ notifications, isLoading, emptyLabel, onItemClick, onItemDelete }: NotificationListProps) => {
  if (isLoading) {
    return (
      <div className="space-y-2 px-1 py-2">
        <LoadingRow />
        <LoadingRow />
        <LoadingRow />
      </div>
    );
  }

  if (notifications.length === 0) {
    return <p className="px-1 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ScrollArea className="h-[360px] pr-2">
      <div className="space-y-1">
        {notifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} onClick={onItemClick} onDelete={onItemDelete} />
        ))}
      </div>
    </ScrollArea>
  );
};

export default NotificationList;
