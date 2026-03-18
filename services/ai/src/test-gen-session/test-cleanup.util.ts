/**
 * Post-processing utility to clean up AI-generated test code.
 * Removes unused imports/variables and fixes common type issues.
 */

interface ParsedImport {
  startLine: number;
  endLine: number;
  names: { original: string; local: string }[];
  defaultName: string | null;
  source: string;
  raw: string;
}

/**
 * Parse all import statements from code, including multi-line.
 */
function parseImports(lines: string[]): ParsedImport[] {
  const imports: ParsedImport[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line.startsWith('import ')) { i++; continue; }

    // Collect full import statement (may span multiple lines)
    let fullStatement = lines[i];
    let endLine = i;
    while (!fullStatement.includes(' from ') && endLine < lines.length - 1) {
      endLine++;
      fullStatement += '\n' + lines[endLine];
    }
    // Also handle: import 'side-effect'
    if (!fullStatement.includes(' from ') && !fullStatement.match(/['"][^'"]+['"]/)) {
      i = endLine + 1;
      continue;
    }

    const parsed = parseImportStatement(fullStatement, i, endLine);
    if (parsed) imports.push(parsed);
    i = endLine + 1;
  }

  return imports;
}

function parseImportStatement(
  raw: string,
  startLine: number,
  endLine: number,
): ParsedImport | null {
  const sourceMatch = raw.match(/from\s+['"]([^'"]+)['"]/);
  if (!sourceMatch) return null;

  const source = sourceMatch[1];
  const beforeFrom = raw.slice(0, raw.indexOf(sourceMatch[0]));

  let defaultName: string | null = null;
  const names: { original: string; local: string }[] = [];

  // Extract named imports: { A, B as C }
  const namedMatch = beforeFrom.match(/\{([^}]+)\}/);
  if (namedMatch) {
    const items = namedMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    for (const item of items) {
      const asParts = item.split(/\s+as\s+/);
      names.push({
        original: asParts[0].trim(),
        local: asParts.length > 1 ? asParts[1].trim() : asParts[0].trim(),
      });
    }
  }

  // Extract default import: import Foo from '...' or import Foo, { ... } from '...'
  const defaultMatch = beforeFrom.match(/import\s+(\w+)/);
  if (defaultMatch && defaultMatch[1] !== 'type') {
    defaultName = defaultMatch[1];
  }

  // Handle: import type { ... }
  const typeImportMatch = beforeFrom.match(/import\s+type\s+\{([^}]+)\}/);
  if (typeImportMatch && names.length === 0) {
    const items = typeImportMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    for (const item of items) {
      const asParts = item.split(/\s+as\s+/);
      names.push({
        original: asParts[0].trim(),
        local: asParts.length > 1 ? asParts[1].trim() : asParts[0].trim(),
      });
    }
  }

  return { startLine, endLine, names, defaultName, source, raw };
}

/**
 * Remove unused named imports from TypeScript/JavaScript code.
 */
export function cleanUnusedImports(code: string): string {
  const lines = code.split('\n');
  const imports = parseImports(lines);
  if (imports.length === 0) return code;

  // Build body: everything that is NOT part of an import statement
  const importLineSet = new Set<number>();
  for (const imp of imports) {
    for (let l = imp.startLine; l <= imp.endLine; l++) {
      importLineSet.add(l);
    }
  }
  const body = lines.filter((_, idx) => !importLineSet.has(idx)).join('\n');

  const linesToRemove = new Set<number>();
  const lineReplacements = new Map<number, string>();

  for (const imp of imports) {
    // Side-effect imports (import '...') — always keep
    if (imp.names.length === 0 && !imp.defaultName) continue;

    const isDefaultUsed = imp.defaultName
      ? new RegExp(`\\b${escapeRegex(imp.defaultName)}\\b`).test(body)
      : false;

    const usedNames = imp.names.filter((n) =>
      new RegExp(`\\b${escapeRegex(n.local)}\\b`).test(body),
    );

    const allUnused = !isDefaultUsed && usedNames.length === 0;
    const someUnused = usedNames.length < imp.names.length || (!isDefaultUsed && imp.defaultName);

    if (allUnused) {
      // Remove entire import
      for (let l = imp.startLine; l <= imp.endLine; l++) {
        linesToRemove.add(l);
      }
    } else if (someUnused) {
      // Rebuild import with only used parts
      const isTypeImport = imp.raw.trim().startsWith('import type');
      const prefix = isTypeImport ? 'import type' : 'import';
      const parts: string[] = [];

      if (imp.defaultName && isDefaultUsed) {
        parts.push(imp.defaultName);
      }

      if (usedNames.length > 0) {
        const namedStr = usedNames
          .map((n) => n.original === n.local ? n.local : `${n.original} as ${n.local}`)
          .join(', ');
        parts.push(`{ ${namedStr} }`);
      }

      if (parts.length > 0) {
        const rebuilt = `${prefix} ${parts.join(', ')} from '${imp.source}';`;
        lineReplacements.set(imp.startLine, rebuilt);
        for (let l = imp.startLine + 1; l <= imp.endLine; l++) {
          linesToRemove.add(l);
        }
      }
    }
  }

  return lines
    .map((line, idx) => {
      if (linesToRemove.has(idx)) return null;
      if (lineReplacements.has(idx)) return lineReplacements.get(idx)!;
      return line;
    })
    .filter((line): line is string => line !== null)
    .join('\n');
}

/**
 * Remove variables that are assigned but never used.
 */
export function cleanUnusedVariables(code: string): string {
  const lines = code.split('\n');
  const varDeclRegex = /^\s*(?:const|let)\s+(\w+)\s*=/;
  const linesToRemove = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(varDeclRegex);
    if (!match) continue;

    const varName = match[1];
    // Skip common patterns that should be kept (test setup, module init)
    if (['module', 'app', 'server', 'describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll'].includes(varName)) continue;

    const otherLines = lines.filter((_, j) => j !== i).join('\n');
    const regex = new RegExp(`\\b${escapeRegex(varName)}\\b`);
    if (!regex.test(otherLines)) {
      linesToRemove.add(i);
    }
  }

  return lines.filter((_, i) => !linesToRemove.has(i)).join('\n');
}

/**
 * Fix common type issues in generated TypeScript test code.
 */
export function fixCommonTypeIssues(code: string): string {
  let result = code;

  // Replace NodeJS.ProcessEnv with Record<string, string | undefined>
  result = result.replace(/NodeJS\.ProcessEnv/g, 'Record<string, string | undefined>');

  // If code uses NodeJS namespace, add reference directive
  if (/\bNodeJS\b/.test(result) && !result.includes('/// <reference')) {
    result = '/// <reference types="node" />\n' + result;
  }

  // Remove @ts-expect-error directives
  result = result.replace(/\s*\/\/\s*@ts-expect-error[^\n]*/g, '');

  // Remove @ts-ignore directives
  result = result.replace(/\s*\/\/\s*@ts-ignore[^\n]*/g, '');

  return result;
}

/**
 * Full cleanup pipeline for generated test code.
 */
export function cleanGeneratedTest(code: string): string {
  let result = code;
  result = fixCommonTypeIssues(result);
  result = cleanUnusedImports(result);
  result = cleanUnusedVariables(result);
  // Remove consecutive empty lines (more than 2)
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim() + '\n';
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
