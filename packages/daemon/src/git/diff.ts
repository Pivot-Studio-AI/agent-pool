import { execFileSync } from 'child_process';

export interface FileChangeStat {
  path: string;
  additions: number;
  deletions: number;
}

export interface DiffResult {
  diffContent: string;
  filesChanged: FileChangeStat[];
  totalAdditions: number;
  totalDeletions: number;
}

/**
 * Generate a diff between two branches.
 */
export function generateDiff(
  worktreePath: string,
  targetBranch: string,
  taskBranch: string
): string {
  const output = execFileSync(
    'git',
    ['-C', worktreePath, 'diff', '--no-color', `${targetBranch}..${taskBranch}`],
    {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large diffs
    }
  );
  return output;
}

/**
 * Parse a unified diff to extract per-file stats.
 * For each file (identified by "diff --git a/... b/..."),
 * count lines starting with + (additions) and - (deletions),
 * excluding the +++ and --- header lines.
 */
export function parseDiffStats(diffContent: string): DiffResult {
  const filesChanged: FileChangeStat[] = [];
  let currentFile: FileChangeStat | null = null;
  let totalAdditions = 0;
  let totalDeletions = 0;

  const lines = diffContent.split('\n');

  for (const line of lines) {
    // Detect file boundary: "diff --git a/path b/path"
    if (line.startsWith('diff --git ')) {
      // Save previous file if any
      if (currentFile) {
        filesChanged.push(currentFile);
      }
      // Extract path from "diff --git a/path b/path"
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      const filePath = match ? match[2] : 'unknown';
      currentFile = { path: filePath, additions: 0, deletions: 0 };
      continue;
    }

    if (!currentFile) continue;

    // Skip the --- and +++ header lines
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      continue;
    }

    // Count additions (lines starting with + but not ++)
    if (line.startsWith('+')) {
      currentFile.additions++;
      totalAdditions++;
    }
    // Count deletions (lines starting with - but not --)
    else if (line.startsWith('-')) {
      currentFile.deletions++;
      totalDeletions++;
    }
  }

  // Don't forget the last file
  if (currentFile) {
    filesChanged.push(currentFile);
  }

  return {
    diffContent,
    filesChanged,
    totalAdditions,
    totalDeletions,
  };
}
