import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Ensure a repo exists locally. If not, clone it.
 * Returns the local path to the repo.
 */
export function ensureRepo(
  githubFullName: string,  // "owner/repo"
  githubUrl: string,       // "https://github.com/owner/repo"
  baseDir: string          // e.g. ~/repos
): string {
  const repoDir = path.join(baseDir, ...githubFullName.split('/'));

  if (fs.existsSync(path.join(repoDir, '.git'))) {
    console.log(`[clone] Repo ${githubFullName} already exists at ${repoDir}`);
    return repoDir;
  }

  // Ensure parent directory exists
  const parentDir = path.dirname(repoDir);
  fs.mkdirSync(parentDir, { recursive: true });

  console.log(`[clone] Cloning ${githubFullName} to ${repoDir}...`);
  execFileSync('git', ['clone', githubUrl, repoDir], {
    stdio: 'pipe',
    timeout: 300_000  // 5 minute timeout for large repos
  });

  console.log(`[clone] Clone complete: ${repoDir}`);
  return repoDir;
}
