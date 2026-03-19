import fs from 'fs';
import path from 'path';

export interface DocEntry {
  slug: string;
  filename: string;
  order: number;
}

const docFiles: DocEntry[] = [
  { slug: 'getting-started', filename: '01-getting-started.md', order: 1 },
  { slug: 'architecture', filename: '02-architecture.md', order: 2 },
  { slug: 'dashboard', filename: '03-dashboard.md', order: 3 },
  { slug: 'mobile', filename: '04-mobile.md', order: 4 },
  { slug: 'organizations-projects', filename: '05-organizations-projects.md', order: 5 },
  { slug: 'pipelines', filename: '06-pipelines.md', order: 6 },
  { slug: 'ai-generation', filename: '07-ai-generation.md', order: 7 },
  { slug: 'notifications', filename: '08-notifications.md', order: 8 },
  { slug: 'api-reference', filename: '09-api-reference.md', order: 9 },
  { slug: 'deployment', filename: '10-deployment.md', order: 10 },
  { slug: 'observability', filename: '11-observability.md', order: 11 },
  { slug: 'security', filename: '12-security.md', order: 12 },
  { slug: 'troubleshooting', filename: '13-troubleshooting.md', order: 13 },
];

function getDocsDir(locale: string): string {
  return path.join(process.cwd(), '..', '..', 'user_docs', locale);
}

export function getDocSlugs(): string[] {
  return docFiles.map((d) => d.slug);
}

export function getDocEntries(): DocEntry[] {
  return docFiles;
}

export function getDocContent(slug: string, locale: string): { content: string; title: string } | null {
  const entry = docFiles.find((d) => d.slug === slug);
  if (!entry) return null;

  const filePath = path.join(getDocsDir(locale), entry.filename);

  // Fallback to English if file doesn't exist for locale
  let resolvedPath = filePath;
  if (!fs.existsSync(resolvedPath)) {
    resolvedPath = path.join(getDocsDir('en'), entry.filename);
  }
  if (!fs.existsSync(resolvedPath)) return null;

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : slug;

  return { content, title };
}

export function getDocNav(locale: string): { slug: string; title: string; order: number }[] {
  return docFiles.map((entry) => {
    const doc = getDocContent(entry.slug, locale);
    return {
      slug: entry.slug,
      title: doc?.title ?? entry.slug,
      order: entry.order,
    };
  });
}
