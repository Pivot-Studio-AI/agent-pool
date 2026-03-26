export interface ExtractedPlan {
  content: string;
  fileManifest: string[];
  reasoning: string;
  estimate: string;
}

/**
 * Extract a structured plan from the agent's output text.
 *
 * Looks for these markdown headers:
 * - "## Plan" — content until next ## header
 * - "## Files to Modify" — parse bullet list as file paths
 * - "## Reasoning" — content until next ## header
 * - "## Estimate" — content until next ## header or end
 *
 * Returns null if "## Plan" header is not found.
 */
export function extractPlan(agentText: string): ExtractedPlan | null {
  // Check if the plan header exists (case-insensitive, flexible formatting)
  if (findHeader(agentText, 'plan') === -1) {
    return null;
  }

  const content = extractSection(agentText, 'plan');
  const filesSection = extractSection(agentText, 'files to modify') || extractSection(agentText, 'files');
  const reasoning = extractSection(agentText, 'reasoning');
  const estimate = extractSection(agentText, 'estimate');

  // Parse file manifest from bullet list
  const fileManifest = parseFileManifest(filesSection);

  return {
    content: content.trim(),
    fileManifest,
    reasoning: reasoning.trim(),
    estimate: estimate.trim(),
  };
}

/**
 * Find a ## header in the text (case-insensitive, handles bold markers and flexible spacing).
 * Returns the index of the header or -1 if not found.
 */
function findHeader(text: string, headerName: string): number {
  // Match: ## Plan, ## **Plan**, ##Plan, ## PLAN, etc.
  const regex = new RegExp(
    `^#{2,3}\\s*\\**\\s*${headerName}\\s*\\**\\s*$`,
    'im'
  );
  const match = text.match(regex);
  return match ? (match.index ?? -1) : -1;
}

/**
 * Extract the content under a ## header (case-insensitive) until the next ## header or end.
 */
function extractSection(text: string, headerName: string): string {
  const headerIndex = findHeader(text, headerName);
  if (headerIndex === -1) {
    return '';
  }

  // Find end of header line
  const afterHeaderStart = text.slice(headerIndex);
  const lineBreakIndex = afterHeaderStart.indexOf('\n');
  if (lineBreakIndex === -1) {
    return afterHeaderStart.trim();
  }

  const contentStart = afterHeaderStart.slice(lineBreakIndex + 1);

  // Find the next ## header
  const nextHeaderMatch = contentStart.match(/^#{2,3}\s/m);
  if (nextHeaderMatch && nextHeaderMatch.index !== undefined) {
    return contentStart.slice(0, nextHeaderMatch.index);
  }

  return contentStart;
}

/**
 * Parse a bullet list of file paths from a markdown section.
 * Handles lines starting with - or *, backtick-wrapped paths, and descriptions after the path.
 */
function parseFileManifest(section: string): string[] {
  if (!section.trim()) {
    return [];
  }

  const files: string[] = [];
  const lines = section.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Match lines starting with - or * followed by content
    const match = trimmed.match(/^[-*]\s+(.+)$/);
    if (match) {
      let filePath = match[1].trim();

      // If path is wrapped in backticks, extract just the backtick content
      const backtickMatch = filePath.match(/^`([^`]+)`/);
      if (backtickMatch) {
        filePath = backtickMatch[1];
      } else {
        // Remove surrounding quotes
        filePath = filePath.replace(/^[`"']|[`"']$/g, '');
        // Split on em-dash or parenthetical ONLY (not regular hyphens which appear in filenames)
        const descSplit = filePath.split(/\s+[—]\s+|\s+\(/);
        filePath = descSplit[0].trim();
      }

      if (filePath) {
        files.push(filePath);
      }
    }
  }

  return files;
}
