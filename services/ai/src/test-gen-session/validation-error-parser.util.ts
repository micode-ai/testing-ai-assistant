export interface ValidationError {
  file: string;
  line: number;
  column: number;
  message: string;
  code?: string;
  ruleId?: string;
  source: 'tsc' | 'eslint';
}

/**
 * Parse tsc stderr output into structured errors.
 * Format: "src/foo.ts(12,5): error TS2304: Cannot find name 'bar'."
 */
export function parseTscOutput(output: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const regex = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(output)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      code: match[4],
      message: match[5],
      source: 'tsc',
    });
  }

  return errors;
}

/**
 * Parse eslint JSON output into structured errors.
 */
export function parseEslintJson(jsonOutput: string): ValidationError[] {
  const errors: ValidationError[] = [];

  try {
    const results = JSON.parse(jsonOutput) as Array<{
      filePath: string;
      messages: Array<{
        line: number;
        column: number;
        message: string;
        ruleId: string | null;
        severity: number;
      }>;
    }>;

    for (const result of results) {
      for (const msg of result.messages) {
        if (msg.severity >= 2) {
          errors.push({
            file: result.filePath,
            line: msg.line,
            column: msg.column,
            message: msg.message,
            ruleId: msg.ruleId || undefined,
            source: 'eslint',
          });
        }
      }
    }
  } catch {
    // If JSON parsing fails, try line-by-line
    const regex = /^\s*(\d+):(\d+)\s+error\s+(.+?)\s{2,}(\S+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(jsonOutput)) !== null) {
      errors.push({
        file: '',
        line: parseInt(match[1], 10),
        column: parseInt(match[2], 10),
        message: match[3],
        ruleId: match[4],
        source: 'eslint',
      });
    }
  }

  return errors;
}

/**
 * Format validation errors into a prompt for LLM to fix.
 */
export function formatErrorsForLLM(
  errors: ValidationError[],
  testCode: string,
): string {
  const lines = testCode.split('\n');

  const errorDescriptions = errors.map((err) => {
    const lineContent = lines[err.line - 1] || '';
    const source = err.source === 'tsc' ? `TypeScript ${err.code}` : `ESLint ${err.ruleId || ''}`;
    return `Line ${err.line}: [${source}] ${err.message}\n  Code: ${lineContent.trim()}`;
  });

  return (
    `The following test code has ${errors.length} error(s) that MUST be fixed:\n\n` +
    errorDescriptions.join('\n\n') +
    `\n\nFix ALL errors. Output ONLY the corrected complete test file, no explanations.`
  );
}
