export interface ExtractedPlan {
  content: string;       // Full plan document (all sections)
  fileManifest: string[];
  reasoning: string;
  estimate: string;
  whatFound: string;     // ## What I Found section
  notInScope: string;    // ## NOT in Scope section
}

/**
 * Extract a structured plan from the agent's output text.
 *
 * Looks for these markdown headers:
 * - "## What I Found" — exploration findings (new)
 * - "## Plan"         — approach summary
 * - "## Files to Modify" — file manifest
 * - "## NOT in Scope" — explicit exclusions (new)
 * - "## Reasoning"    — rationale
 * - "## Estimate"     — scope estimate
 *
 * Returns null if "## Plan" header is not found.
 */
export function extractPlan(agentText: string): ExtractedPlan | null {
  if (findHeader(agentText, 'plan') === -1) {
    return null;
  }

  // Full content = everything from the first ## header through end (all sections for display)
  const firstHeader = agentText.match(/^#{2,3}\s/m);
  const fullContent = firstHeader?.index !== undefined
    ? agentText.slice(firstHeader.index).trim()
    : agentText.trim();

  const filesSection = extractSection(agentText, 'files to modify') || extractSection(agentText, 'files');
  const reasoning = extractSection(agentText, 'reasoning');
  const estimate = extractSection(agentText, 'estimate');
  const whatFound = extractSection(agentText, 'what i found') || extractSection(agentText, 'what i found');
  const notInScope = extractSection(agentText, 'not in scope');

  return {
    content: fullContent,
    fileManifest: parseFileManifest(filesSection),
    reasoning: reasoning.trim(),
    estimate: estimate.trim(),
    whatFound: whatFound.trim(),
    notInScope: notInScope.trim(),
  };
}

/**
 * Find a ## header in the text (case-insensitive, handles bold markers and flexible spacing).
 * Returns the index of the header or -1 if not found.
 */
function findHeader(text: string, headerName: string): number {
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

  const afterHeaderStart = text.slice(headerIndex);
  const lineBreakIndex = afterHeaderStart.indexOf('\n');
  if (lineBreakIndex === -1) {
    return afterHeaderStart.trim();
  }

  const contentStart = afterHeaderStart.slice(lineBreakIndex + 1);
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
    const match = trimmed.match(/^[-*]\s+(.+)$/);
    if (match) {
      let filePath = match[1].trim();

      const backtickMatch = filePath.match(/^`([^`]+)`/);
      if (backtickMatch) {
        filePath = backtickMatch[1];
      } else {
        filePath = filePath.replace(/^[`"']|[`"']$/g, '');
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
