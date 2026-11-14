import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-brand-600" />
      <path d="M9 21.5V10.5h4.2c2.6 0 4.3 1.4 4.3 3.6 0 1.4-.7 2.5-1.9 3l2.4 4.4h-2.7l-2-3.9h-1.9v3.9H9Zm2.4-5.9h1.7c1.2 0 1.9-.6 1.9-1.5s-.7-1.5-1.9-1.5h-1.7v3Z" fill="white" opacity=".0" />
      <path d="M8 22 13 10h2l5 12h-2.6l-1.1-2.8h-4.6L10.6 22H8Zm4.5-4.9h3l-1.5-3.9-1.5 3.9Z" fill="white" />
      <path d="M20.5 22v-2.2h3.5V22h-3.5Z" className="fill-brand-200" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-tight text-ink">{APP_NAME}</div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted">{APP_TAGLINE}</div>
      </div>
    </div>
  );
}
