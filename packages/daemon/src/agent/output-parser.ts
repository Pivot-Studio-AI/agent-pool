import { EventEmitter } from 'events';
import { createInterface } from 'readline';
import type { Readable } from 'stream';

export interface AssistantMessage {
  type: 'assistant';
  content: string;
}

export interface ToolUseEvent {
  type: 'tool_use';
  name: string;
}

export interface ResultEvent {
  type: 'result';
  result: unknown;
}

export interface ErrorEvent {
  type: 'error';
  error: unknown;
}

/**
 * Parses Claude CLI stream-json output.
 * Each line on stdout is a JSON object with a 'type' field.
 *
 * Events emitted:
 * - 'message': text message from assistant
 * - 'toolUse': agent using a tool
 * - 'complete': agent finished (result)
 * - 'error': error occurred
 */
export class OutputParser extends EventEmitter {
  private collectedText: string[] = [];

  constructor(stdout: Readable) {
    super();
    this.setupLineReader(stdout);
  }

  private setupLineReader(stdout: Readable): void {
    const rl = createInterface({ input: stdout, crlfDelay: Infinity });
    let jsonBuffer = '';

    rl.on('line', (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // First, try parsing the line as a standalone JSON object (common case)
      try {
        const parsed = JSON.parse(trimmed);
        jsonBuffer = ''; // Reset buffer on successful parse
        this.handleParsedLine(parsed);
        return;
      } catch {
        // Not valid JSON on its own — might be part of a multi-line object
      }

      // Accumulate into buffer for multi-line JSON
      jsonBuffer += (jsonBuffer ? '\n' : '') + trimmed;
      try {
        const parsed = JSON.parse(jsonBuffer);
        jsonBuffer = ''; // Reset buffer on successful parse
        this.handleParsedLine(parsed);
      } catch {
        // Still incomplete — keep buffering.
        // Safety: if buffer gets too large (>1MB), reset to prevent memory issues
        if (jsonBuffer.length > 1_000_000) {
          console.warn(`[output-parser] JSON buffer exceeded 1MB, discarding. First 500 chars: ${jsonBuffer.slice(0, 500)}`);
          jsonBuffer = '';
        }
      }
    });

    rl.on('close', () => {
      // Try to parse any remaining buffer
      if (jsonBuffer.trim()) {
        try {
          const parsed = JSON.parse(jsonBuffer);
          this.handleParsedLine(parsed);
        } catch {
          // Final buffer wasn't valid JSON — discard
        }
      }
    });

    rl.on('error', (err: Error) => {
      this.emit('error', err);
    });
  }

  private handleParsedLine(parsed: Record<string, unknown>): void {
    const type = parsed.type as string | undefined;
    if (!type) return;

    switch (type) {
      case 'assistant': {
        // Extract text content from the message
        const content = this.extractTextContent(parsed);
        if (content) {
          this.collectedText.push(content);
          this.emit('message', content);
        }
        break;
      }
      case 'tool_use': {
        const toolName =
          (parsed.name as string) || (parsed.tool as string) || 'unknown';
        this.emit('toolUse', toolName);
        break;
      }
      case 'result': {
        const resultText = this.extractTextContent(parsed);
        if (resultText) {
          this.collectedText.push(resultText);
        }
        this.emit('complete', parsed.result ?? parsed);
        break;
      }
      case 'error': {
        this.emit('error', parsed.error ?? parsed);
        break;
      }
      default: {
        // Some message types we don't need to handle explicitly
        // (e.g., system, tool_result)
        break;
      }
    }
  }

  /**
   * Extract text content from a parsed message.
   * Handles various possible shapes of the content field.
   */
  private extractTextContent(parsed: Record<string, unknown>): string | null {
    // Direct text field
    if (typeof parsed.content === 'string') {
      return parsed.content;
    }

    // Content array (Claude's message format: [{type: "text", text: "..."}])
    if (Array.isArray(parsed.content)) {
      const texts: string[] = [];
      for (const block of parsed.content) {
        if (
          typeof block === 'object' &&
          block !== null &&
          'type' in block &&
          (block as Record<string, unknown>).type === 'text' &&
          typeof (block as Record<string, unknown>).text === 'string'
        ) {
          texts.push((block as Record<string, string>).text);
        }
      }
      return texts.length > 0 ? texts.join('') : null;
    }

    // Message field with text
    if (typeof parsed.message === 'string') {
      return parsed.message;
    }

    // Text field directly
    if (typeof parsed.text === 'string') {
      return parsed.text;
    }

    return null;
  }

  /**
   * Get all collected assistant text joined together.
   */
  getCollectedText(): string {
    return this.collectedText.join('\n');
  }
}
