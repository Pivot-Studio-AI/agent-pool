import { create } from 'zustand';
import { api } from '../api/client';
import type { User, Repository, GithubRepo } from '../lib/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  selectedRepo: Repository | null;
  githubRepos: GithubRepo[];
  knownRepos: Repository[];

  initialize: () => Promise<void>;
  login: () => void;
  loginWithApiKey: (apiKey: string) => Promise<void>;
  logout: () => void;
  fetchGitHubRepos: () => Promise<void>;
  fetchKnownRepos: () => Promise<void>;
  selectRepo: (fullName: string, githubUrl: string, defaultBranch: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,
  selectedRepo: null,
  githubRepos: [],
  knownRepos: [],

  initialize: async () => {
    set({ loading: true });

    // Check URL hash for token from OAuth callback
    const hash = window.location.hash;
    if (hash.startsWith('#token=')) {
      const token = hash.slice('#token='.length);
      localStorage.setItem('agent-pool-token', token);
      // Clear hash without triggering a navigation
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    const token = localStorage.getItem('agent-pool-token');
    const apiKey = localStorage.getItem('agent-pool-api-key');

    if (!token && !apiKey) {
      set({ loading: false, isAuthenticated: false });
      return;
    }

    // API key auth — skip user fetch, just verify the key works
    if (apiKey && !token) {
      try {
        await api.get<unknown[]>('/slots');
        set({
          user: { id: 'api-key', github_login: 'admin', github_avatar_url: '' } as unknown as User,
          token: apiKey,
          isAuthenticated: true,
          loading: false,
        });
        return;
      } catch {
        localStorage.removeItem('agent-pool-api-key');
        set({ loading: false, isAuthenticated: false });
        return;
      }
    }

    try {
      const user = await api.get<User>('/auth/me');
      // Restore persisted repo selection
      let selectedRepo: Repository | null = null;
      const savedRepo = localStorage.getItem('agent-pool-selected-repo');
      if (savedRepo) {
        try {
          const parsed = JSON.parse(savedRepo) as Repository;
          // Discard stale cached repos with empty/missing id — they'll be re-selected
          if (parsed?.id) {
            selectedRepo = parsed;
          } else {
            localStorage.removeItem('agent-pool-selected-repo');
          }
        } catch {
          localStorage.removeItem('agent-pool-selected-repo');
        }
      }
      set({ user, token, isAuthenticated: true, loading: false, selectedRepo });
    } catch {
      localStorage.removeItem('agent-pool-token');
      set({ loading: false, isAuthenticated: false, token: null, user: null });
    }
  },

  login: () => {
    window.location.href = `${import.meta.env.VITE_API_URL || ''}/api/v1/auth/github`;
  },

  loginWithApiKey: async (apiKey: string) => {
    localStorage.setItem('agent-pool-api-key', apiKey);
    try {
      await api.get<unknown[]>('/slots');
      set({
        user: { id: 'api-key', github_login: 'admin', github_avatar_url: '' } as unknown as User,
        token: apiKey,
        isAuthenticated: true,
        loading: false,
      });
    } catch {
      localStorage.removeItem('agent-pool-api-key');
      throw new Error('Invalid API key');
    }
  },

  logout: () => {
    localStorage.removeItem('agent-pool-token');
    localStorage.removeItem('agent-pool-selected-repo');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      selectedRepo: null,
      githubRepos: [],
      knownRepos: [],
    });
  },

  fetchGitHubRepos: async () => {
    try {
      const repos = await api.get<GithubRepo[]>('/repos/github');
      set({ githubRepos: repos });
    } catch {
      // Silently fail — user can retry
    }
  },

  fetchKnownRepos: async () => {
    try {
      const repos = await api.get<Repository[]>('/repos');
      set({ knownRepos: repos });
    } catch {
      // Silently fail
    }
  },

  selectRepo: async (fullName: string, githubUrl: string, defaultBranch: string) => {
    try {
      const repo = await api.post<Repository>('/repos/select', {
        github_full_name: fullName,
        github_url: githubUrl,
        default_branch: defaultBranch,
      });
      localStorage.setItem('agent-pool-selected-repo', JSON.stringify(repo));
      set({ selectedRepo: repo });
    } catch {
      // If the API fails, still set locally for UX
      const localRepo: Repository = {
        id: '',
        github_full_name: fullName,
        github_url: githubUrl,
        default_branch: defaultBranch,
        user_id: '',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('agent-pool-selected-repo', JSON.stringify(localRepo));
      set({ selectedRepo: localRepo });
    }
  },
}));
