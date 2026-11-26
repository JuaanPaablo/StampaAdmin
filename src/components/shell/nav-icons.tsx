import type { NavItem } from '@/lib/nav';

const paths: Record<NavItem['icon'], React.ReactNode> = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /></>,
  counter: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 14.5h4" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.6-3.3 3-5 6-5s5.400 1.700 6 5" /><path d="M16 5.200a3.100 3.100 0 0 1 0 5.800M18 14.300c1.800.7 2.800 2.200 3 4.700" /></>,
  shield: <><path d="M12 3.500 5 6v5.500c0 4.200 2.800 7.200 7 9 4.200-1.800 7-4.800 7-9V6l-7-2.500Z" /><path d="m9 12 2 2 4-4" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2.500" /><circle cx="8" cy="10" r="1.200" /><circle cx="12" cy="10" r="1.200" /><circle cx="16" cy="10" r="1.200" /><path d="M7 15h6" /></>,
  megaphone: <><path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Z" /><path d="M16 8.500a4.500 4.500 0 0 1 0 7M18.500 6a8 8 0 0 1 0 12" /></>,
  ticket: <><path d="M4 7.5A1.500 1.500 0 0 1 5.500 6h13A1.500 1.500 0 0 1 20 7.500V10a2 2 0 0 0 0 4v2.500a1.500 1.500 0 0 1-1.500 1.500h-13A1.500 1.500 0 0 1 4 16.500V14a2 2 0 0 0 0-4Z" /><path d="M14 6v2.500M14 11v2M14 15.500V18" /></>,
  gift: <><rect x="3.500" y="8.500" width="17" height="4" rx="1" /><path d="M5 12.500v7h14v-7M12 8.500v11" /><path d="M12 8.500c-1.500-3.500-5.500-3.500-5.500-1.200 0 1.200 1.500 1.200 5.500 1.200Zm0 0c1.500-3.500 5.500-3.500 5.500-1.200 0 1.200-1.500 1.200-5.500 1.200Z" /></>,
  team: <><circle cx="12" cy="8" r="3.200" /><path d="M5.500 19.500c.7-3.300 3.300-5 6.500-5s5.800 1.700 6.500 5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.500M12 18.500V21M3 12h2.500M18.500 12H21M5.600 5.600l1.800 1.800M16.600 16.600l1.800 1.800M5.600 18.400l1.800-1.800M16.600 7.400l1.800-1.800" /></>
};

export function NavIcon({ name }: { name: NavItem['icon'] }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {paths[name]}
    </svg>
  );
}
