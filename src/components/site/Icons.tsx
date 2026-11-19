/* Small line icons, drawn for this site on a 16 grid. */
type P = { size?: number };
const S = ({ size = 16, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
export const ArrowUpRight = (p: P) => <S {...p}><path d="M5 11l6-6M6 5h5v5" /></S>;
export const CheckIcon = (p: P) => <S {...p}><path d="M3 8.5l3.2 3L13 4.5" /></S>;
export const CloseIcon = (p: P) => <S {...p}><path d="M4 4l8 8M12 4l-8 8" /></S>;
export const CopyIcon = (p: P) => <S {...p}><rect x="5.5" y="5.5" width="8" height="8" rx="1" /><path d="M10.5 3H3.5a1 1 0 0 0-1 1v7" /></S>;
export const LogOutIcon = (p: P) => <S {...p}><path d="M6.5 13.5H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3M10.5 11l3-3-3-3M13.5 8H6" /></S>;
export const PlayIcon = (p: P) => <S {...p}><path d="M5 3.5l8 4.5-8 4.5z" /></S>;
export const RefreshIcon = (p: P) => <S {...p}><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" /></S>;
export const WalletIcon = (p: P) => <S {...p}><rect x="2" y="4" width="12" height="9.5" rx="1" /><path d="M2 6.5h12M10.5 10h1" /></S>;
export const MenuIcon = (p: P) => <S {...p}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></S>;
export const XIcon = (p: P) => (
  <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.2 2.3h3.3l-7.2 8.2 8.5 11.2h-6.7l-5.2-6.8-6 6.8H1.6l7.7-8.8L1.2 2.3H8l4.7 6.2zm-1.2 17.4h1.8L7.1 4.2H5.1z" />
  </svg>
);
export const ArrowDownRight = (p: P) => <S {...p}><path d="M5 5l6 6M11 6v5H6" /></S>;
export const ArrowDown = (p: P) => <S {...p}><path d="M8 3v10M4 9l4 4 4-4" /></S>;
export const ArrowRight = (p: P) => <S {...p}><path d="M3 8h10M9 4l4 4-4 4" /></S>;
export const SunIcon = (p: P) => <S {...p}><circle cx="8" cy="8" r="2.8" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></S>;
export const MoonIcon = (p: P) => <S {...p}><path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" /></S>;
export const MonitorIcon = (p: P) => <S {...p}><rect x="2" y="3" width="12" height="8" rx="1" /><path d="M6 14h4M8 11v3" /></S>;
export const EyeIcon = (p: P) => <S {...p}><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></S>;
export const LockIcon = (p: P) => <S {...p}><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></S>;
export const GlobeIcon = (p: P) => <S {...p}><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c2 2.2 2 9.8 0 12M8 2c-2 2.2-2 9.8 0 12" /></S>;
export const PlusIcon = (p: P) => <S {...p}><path d="M8 3v10M3 8h10" /></S>;
export const KeyIcon = (p: P) => <S {...p}><circle cx="5" cy="10.5" r="2.5" /><path d="M7 8.5l6-6M11 4.5l1.5 1.5M9.5 6l1.2 1.2" /></S>;
export const ServerIcon = (p: P) => <S {...p}><rect x="2.5" y="2.5" width="11" height="4.5" rx="1" /><rect x="2.5" y="9" width="11" height="4.5" rx="1" /><path d="M5 4.75h.01M5 11.25h.01" /></S>;
export const DeviceIcon = (p: P) => <S {...p}><rect x="4.5" y="1.5" width="7" height="13" rx="1.5" /><path d="M7.5 12.5h1" /></S>;
export const ScanIcon = (p: P) => <S {...p}><path d="M2 5V3a1 1 0 0 1 1-1h2M11 2h2a1 1 0 0 1 1 1v2M14 11v2a1 1 0 0 1-1 1h-2M5 14H3a1 1 0 0 1-1-1v-2M4.5 8h7" /></S>;
export const SendIcon = (p: P) => <S {...p}><path d="M14 2L7 9M14 2l-4.5 12-2.5-5-5-2.5z" /></S>;
export const UsersIcon = (p: P) => <S {...p}><circle cx="6" cy="5.5" r="2.5" /><path d="M1.5 13.5c.6-2.3 2.3-3.5 4.5-3.5s3.9 1.2 4.5 3.5M11 3.2a2.4 2.4 0 0 1 0 4.6M12.5 10.3c1 .5 1.7 1.6 2 3.2" /></S>;
export const GiftIcon = (p: P) => <S {...p}><rect x="2" y="6" width="12" height="3" rx=".5" /><path d="M3 9v5h10V9M8 6v8M8 6S6.5 2.5 4.8 3.4C3.4 4.2 5 6 8 6zM8 6s1.5-3.5 3.2-2.6C12.6 4.2 11 6 8 6z" /></S>;
export const CodeIcon = (p: P) => <S {...p}><path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" /></S>;
export const ReceiptIcon = (p: P) => <S {...p}><path d="M3.5 1.5h9v13l-2-1.2-2.5 1.2-2.5-1.2-2 1.2z" /><path d="M6 5h4M6 8h4" /></S>;
export const ExternalIcon = (p: P) => <S {...p}><path d="M9.5 2.5h4v4M13.5 2.5L8 8M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" /></S>;
