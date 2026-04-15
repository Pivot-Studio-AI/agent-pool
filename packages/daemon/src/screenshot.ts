import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

/**
 * Take a screenshot of a URL using the Playwright CLI.
 * Returns the output path on success, null on failure.
 * Fails silently — screenshots are best-effort context, not required.
 */
export async function takeScreenshot(url: string, outputDir: string, filename: string): Promise<string | null> {
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, filename);

  try {
    await execFileAsync(
      'npx',
      ['playwright', 'screenshot', '--browser', 'chromium', '--full-page', url, outputPath],
      { timeout: 25_000 }
    );
    if (fs.existsSync(outputPath)) {
      console.log(`[screenshot] Captured ${url} → ${outputPath}`);
      return outputPath;
    }
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
    console.warn(`[screenshot] Skipping screenshot (${url}): ${msg}`);
    return null;
  }
}
