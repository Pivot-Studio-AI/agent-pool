import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Lock, Globe, Search } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

export function RepoSelector() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedRepo = useAuthStore((s) => s.selectedRepo);
  const githubRepos = useAuthStore((s) => s.githubRepos);
  const knownRepos = useAuthStore((s) => s.knownRepos);
  const fetchGitHubRepos = useAuthStore((s) => s.fetchGitHubRepos);
  const fetchKnownRepos = useAuthStore((s) => s.fetchKnownRepos);
  const selectRepo = useAuthStore((s) => s.selectRepo);

  useEffect(() => {
    if (open) {
      fetchGitHubRepos();
      fetchKnownRepos();
    }
  }, [open, fetchGitHubRepos, fetchKnownRepos]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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

  const filteredKnown = knownRepos.filter((r) =>
    r.github_full_name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGithub = githubRepos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (fullName: string, htmlUrl: string, defaultBranch: string) => {
    selectRepo(fullName, htmlUrl, defaultBranch);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-1.5">
        {selectedRepo ? (
          <a
            href={selectedRepo.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-text-secondary hover:text-accent transition-colors truncate max-w-[200px]"
            title={selectedRepo.github_full_name}
          >
            {selectedRepo.github_full_name}
          </a>
        ) : (
          <span className="text-sm text-text-muted">Select a repo...</span>
        )}
        <button
          onClick={() => setOpen(!open)}
          className="p-1 text-text-muted hover:text-text-secondary transition-colors rounded hover:bg-surface-hover"
          aria-label="Toggle repo selector"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search repos..."
                autoFocus
                className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {/* Known repos */}
            {filteredKnown.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Your Repos
                </div>
                {filteredKnown.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => handleSelect(repo.github_full_name, repo.github_url, repo.default_branch)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors flex items-center gap-2"
                  >
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        selectedRepo?.github_full_name === repo.github_full_name
                          ? 'bg-accent'
                          : 'bg-border'
                      }`}
                    />
                    <span className="text-sm text-text-primary truncate">{repo.github_full_name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* GitHub repos */}
            {filteredGithub.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wider border-t border-border mt-1 pt-2">
                  All GitHub Repos
                </div>
                {filteredGithub.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => handleSelect(repo.full_name, repo.html_url, repo.default_branch)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          selectedRepo?.github_full_name === repo.full_name
                            ? 'bg-accent'
                            : 'bg-border'
                        }`}
                      />
                      <span className="text-sm text-text-primary truncate">{repo.full_name}</span>
                      {repo.private ? (
                        <Lock size={12} className="flex-shrink-0 text-text-muted" />
                      ) : (
                        <Globe size={12} className="flex-shrink-0 text-text-muted" />
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-text-muted mt-0.5 ml-4 truncate">{repo.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {filteredKnown.length === 0 && filteredGithub.length === 0 && (
              <div className="px-3 py-4 text-sm text-text-muted text-center">
                {search ? 'No repos match your search' : 'Loading repos...'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
