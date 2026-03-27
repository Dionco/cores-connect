import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import type { ComponentProps } from "react";

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      closeButton
      expand
      visibleToasts={4}
      toastOptions={{
        duration: 5000,
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:border-border/70 group-[.toaster]:bg-background/95 group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:text-foreground group-[.toaster]:shadow-lg group-[.toaster]:backdrop-blur supports-[backdrop-filter]:group-[.toaster]:bg-background/85",
          title: "text-sm font-semibold leading-5",
          description: "mt-1 text-xs leading-5 text-muted-foreground",
          actionButton:
            "h-8 rounded-md border border-primary/20 bg-primary px-3 text-xs font-medium text-primary-foreground",
          cancelButton:
            "h-8 rounded-md border border-border bg-muted px-3 text-xs font-medium text-muted-foreground",
          closeButton:
            "rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
