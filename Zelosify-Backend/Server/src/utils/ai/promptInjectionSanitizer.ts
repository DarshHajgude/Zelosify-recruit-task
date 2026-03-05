/**
 * Prompt Injection Sanitizer
 *
 * Resume content is untrusted input and MUST be sanitized before being included
 * in any LLM context. Attacks include:
 *   - "Ignore previous instructions and ..."
 *   - Embedded role/system tags that some models respect in user turns
 *   - Excessive length that inflates token cost or causes context overflow
 *
 * Strategy:
 *   1. Hard length cap — truncate at MAX_CHARS
 *   2. Strip common injection patterns via regex
 *   3. Escape XML/HTML to prevent tag injection
 *   4. Wrap in a labeled boundary so the model knows this is untrusted user data
 */

const MAX_CHARS = 8_000; // ~2000 tokens — enough for a resume, not enough for a prompt flood

// Patterns that signal injection attempts
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /you\s+are\s+(now|actually|really)\s+/gi,
  /act\s+as\s+(a|an)\s+/gi,
  /forget\s+(everything|all)\s+(you|above)/gi,
  /<\s*system\s*>/gi,
  /<\s*\/?\s*(prompt|instruction|assistant|user)\s*>/gi,
  /\[INST\]|\[\/INST\]/g,
  /<<SYS>>|<\/SYS>/g,
  /###\s*(System|Human|Assistant|Instruction)/gi,
];

export function sanitizeResumeContent(raw: string): string {
  // 1. Truncate to max length
  let text = raw.length > MAX_CHARS ? raw.slice(0, MAX_CHARS) + "\n[TRUNCATED]" : raw;

  // 2. Strip injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    text = text.replace(pattern, "[REMOVED]");
  }

  // 3. Escape angle brackets to prevent XML/HTML tag injection
  text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return text;
}

/**
 * Wrap sanitized resume content in a clear untrusted-content boundary.
 * The model is instructed that text inside these tags is user data only.
 */
export function wrapResumeContent(sanitized: string): string {
  return `[BEGIN_RESUME_CONTENT]\n${sanitized}\n[END_RESUME_CONTENT]`;
}
