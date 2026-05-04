import { cn } from "@hki/ui";

export function InboxIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-16 w-16 opacity-90", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="20" y="30" width="60" height="40" rx="8" fill="currentColor" fillOpacity="0.1" />
      <path
        d="M20 45C20 45 40 55 50 55C60 55 80 45 80 45"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="20" y="30" width="60" height="40" rx="8" stroke="currentColor" strokeWidth="3" />
      <path
        d="M45 45L50 50L55 45"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DisconnectedPlugIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-16 w-16 opacity-90", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="40" fill="currentColor" fillOpacity="0.1" />
      <path
        d="M35 35L45 45M65 65L55 55"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect
        x="41"
        y="41"
        width="18"
        height="18"
        rx="4"
        stroke="currentColor"
        strokeWidth="3"
        transform="rotate(45 50 50)"
      />
      <path
        d="M45 35V25M55 35V25"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M50 65V75"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EmptyMeasurementIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-16 w-16 opacity-90", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 80L80 80"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M30 80V50M50 80V30M70 80V60"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="4 4"
      />
      <circle cx="50" cy="30" r="6" fill="currentColor" />
    </svg>
  );
}
