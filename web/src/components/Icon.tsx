import type { SVGProps } from "react";

export type IconName =
  | "app" | "inbox" | "today" | "upcoming" | "repeat" | "completed" | "settings"
  | "search" | "plus" | "clock" | "alert" | "download" | "upload" | "backup"
  | "bell" | "list" | "flag" | "edit" | "snooze" | "empty" | "close";

const PATHS: Record<IconName, React.ReactNode> = {
  app: <><rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="m8 9 1.5 1.5L12 8m2.5 1H17M8 15l1.5 1.5L12 14m2.5 1H17"/></>,
  inbox: <><path d="M4 5.5h16v13H4z"/><path d="m4 13 4-4h8l4 4M8 13h8"/></>,
  today: <><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4m8-4v4M4 10h16"/><path d="M9 14h2v2H9z"/></>,
  upcoming: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></>,
  repeat: <><path d="M17 7h-8a4 4 0 0 0-4 4"/><path d="m14 4 3 3-3 3M7 17h8a4 4 0 0 0 4-4"/><path d="m10 20-3-3 3-3"/></>,
  completed: <><circle cx="12" cy="12" r="8.5"/><path d="m8 12 2.5 2.5L16 9"/></>,
  settings: <><circle cx="12" cy="12" r="2.5"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 15 6l-.4-2.5h-4L10.2 6a7 7 0 0 0-1.7 1L6.1 6 4 9.5 6.1 11a7 7 0 0 0 0 2L4 14.5 6.1 18l2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4L15 18a7 7 0 0 0 1.6-1l2.4 1 2-3.5-2.1-1.5a7 7 0 0 0 .1-1Z"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
  alert: <><path d="M12 4 3.8 19h16.4L12 4Z"/><path d="M12 9v4m0 3h.01"/></>,
  download: <><path d="M12 4v10m-4-4 4 4 4-4"/><path d="M5 18h14"/></>,
  upload: <><path d="M12 14V4m-4 4 4-4 4 4"/><path d="M5 18h14"/></>,
  backup: <><path d="M5 7.5h14v12H5z"/><path d="M8 4.5h8v3H8zM9 12h6m-6 3h4"/></>,
  bell: <><path d="M6.5 16.5h11l-1.4-2V10a4.1 4.1 0 0 0-8.2 0v4.5l-1.4 2Z"/><path d="M10 19h4"/></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,
  flag: <><path d="M6 21V4"/><path d="M6 5h10l-1.5 3L16 11H6"/></>,
  edit: <><path d="m5 16-.7 3.7L8 19l10-10-3-3L5 16Z"/><path d="m13.5 7.5 3 3"/></>,
  snooze: <><circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 1.5M8 3 5 6m11-3 3 3"/></>,
  empty: <><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.2 2.2 4.8-4.8"/></>,
  close: <path d="m7 7 10 10M17 7 7 17"/>,
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" className={`icon ${props.className ?? ""}`} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" {...props}>
      {PATHS[name]}
    </svg>
  );
}
