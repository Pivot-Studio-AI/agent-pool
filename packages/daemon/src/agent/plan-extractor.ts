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
  // Check if the plan header exists
  if (!agentText.includes('## Plan')) {
    return null;
  }

  const content = extractSection(agentText, '## Plan');
  const filesSection = extractSection(agentText, '## Files to Modify');
  const reasoning = extractSection(agentText, '## Reasoning');
  const estimate = extractSection(agentText, '## Estimate');

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
 * Extract the content under a specific ## header until the next ## header or end of text.
 */
function extractSection(text: string, header: string): string {
  const headerIndex = text.indexOf(header);
  if (headerIndex === -1) {
    return '';
  }

  // Start after the header line
  const afterHeader = text.slice(headerIndex + header.length);
  const lineBreakIndex = afterHeader.indexOf('\n');
  if (lineBreakIndex === -1) {
    return afterHeader.trim();
  }

  const contentStart = afterHeader.slice(lineBreakIndex + 1);

  // Find the next ## header
  const nextHeaderMatch = contentStart.match(/^## /m);
  if (nextHeaderMatch && nextHeaderMatch.index !== undefined) {
    return contentStart.slice(0, nextHeaderMatch.index);
  }

  return contentStart;
}

/**
 * Parse a bullet list of file paths from a markdown section.
 * Handles lines starting with - or *.
 */
function parseFileManifest(section: string): string[] {
  if (!section.trim()) {
    return [];
  }

  const files: string[] = [];
  const lines = section.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Match lines starting with - or * followed by a path
    const match = trimmed.match(/^[-*]\s+(.+)$/);
    if (match) {
      // Clean up: remove backticks, quotes, trailing descriptions
      let filePath = match[1].trim();
      filePath = filePath.replace(/^[`"']|[`"']$/g, '');
      // If there's a description after the path (e.g., "- path/to/file — description"), take only the path
      const descSplit = filePath.split(/\s+[—\-\(]/);
      filePath = descSplit[0].trim();
      if (filePath) {
        files.push(filePath);
      }
    }
  }

  return files;
}
