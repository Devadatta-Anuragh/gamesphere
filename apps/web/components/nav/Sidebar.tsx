'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Swords,
  Gamepad2,
  Trophy,
  Wallet,
  Activity,
  Network,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/matchmaking', label: 'Matchmaking', icon: Swords },
  { href: '/live', label: 'Live Match', icon: Gamepad2 },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/metrics', label: 'Metrics', icon: Activity },
  { href: '/architecture', label: 'Architecture', icon: Network },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface/60">
      <div className="flex items-center gap-2 px-5 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 font-mono text-brand shadow-glow">
          GS
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">GameSphere</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
            ops console
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-brand/10 text-brand'
                  : 'text-muted hover:bg-panel hover:text-ink',
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line px-5 py-3 font-mono text-[10px] leading-relaxed text-muted">
        real-money ludo
        <br />
        backend demo
      </div>
    </aside>
  );
}
