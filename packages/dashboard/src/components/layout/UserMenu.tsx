import { useState, useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full hover:ring-2 hover:ring-accent/40 transition-all"
        aria-label="User menu"
      >
        <img
          src={user.github_avatar_url}
          alt={user.github_login}
          className="w-7 h-7 rounded-full"
        />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-sm text-text-primary font-medium">{user.github_login}</span>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors flex items-center gap-2"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
