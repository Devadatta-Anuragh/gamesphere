'use client';

import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useSocket } from '@/lib/socket';
import { StatusDot } from '@/components/ui/primitives';

export function Topbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();

  return (
    <header className="flex items-center justify-between border-b border-line bg-surface/40 px-6 py-3">
      <div className="flex items-center gap-2 font-mono text-xs text-muted">
        <StatusDot tone={connected ? 'green' : 'red'} />
        WS {connected ? 'connected' : 'offline'}
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <div className="text-right">
            <div className="text-sm font-medium text-ink">{user.username}</div>
            <div className="font-mono text-[11px] text-muted">
              rating {user.rating}
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted hover:bg-panel hover:text-ink"
        >
          <LogOut size={14} /> Logout
        </button>
      </div>
    </header>
  );
}
