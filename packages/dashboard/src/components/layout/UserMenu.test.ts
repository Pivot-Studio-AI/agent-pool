import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'UserMenu.tsx'), 'utf-8');

describe('UserMenu component', () => {
  it('should render Sign In button when user is not logged in', () => {
    expect(source).toContain('if (!user)');
    expect(source).toContain('<LogIn');
    expect(source).toContain('Sign In');
  });

  it('should call login from auth store when Sign In is clicked', () => {
    expect(source).toContain("const login = useAuthStore((s) => s.login)");
    expect(source).toContain('onClick={login}');
  });

  it('should import LogIn icon from lucide-react', () => {
    expect(source).toContain("LogOut, LogIn");
  });

  it('should render user avatar and dropdown when user is logged in', () => {
    expect(source).toContain('user.github_avatar_url');
    expect(source).toContain('user.github_login');
    expect(source).toContain('Sign Out');
  });

  it('should close menu on outside click', () => {
    expect(source).toContain('handleClickOutside');
    expect(source).toContain('mousedown');
  });
});
