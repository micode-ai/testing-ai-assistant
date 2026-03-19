import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDocContent, getDocEntries } from '@/lib/docs';
import { defaultLocale, locales, type Locale } from '@/i18n/config';
import { MarkdownRenderer } from './markdown-renderer';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function HelpArticlePage({ params }: Props) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;
  const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale;
  const t = await getTranslations('help');

  const doc = getDocContent(slug, locale);
  if (!doc) notFound();

  const entries = getDocEntries();
  const currentIndex = entries.findIndex((e) => e.slug === slug);
  const prev = currentIndex > 0 ? entries[currentIndex - 1] : null;
  const next = currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;

  const prevDoc = prev ? getDocContent(prev.slug, locale) : null;
  const nextDoc = next ? getDocContent(next.slug, locale) : null;

  return (
    <div className="p-6 max-w-4xl">
      <article className="prose prose-sm dark:prose-invert max-w-none
        prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight
        prose-h1:text-2xl prose-h1:border-b prose-h1:pb-3 prose-h1:mb-6
        prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
        prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2
        prose-p:text-muted-foreground prose-p:leading-relaxed
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-strong:text-foreground prose-strong:font-semibold
        prose-table:text-sm
        prose-th:text-left prose-th:font-semibold prose-th:text-foreground prose-th:bg-muted prose-th:px-3 prose-th:py-2
        prose-td:px-3 prose-td:py-2 prose-td:text-muted-foreground prose-td:border-t
        prose-li:text-muted-foreground
        prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-blockquote:not-italic
        prose-hr:border-border
        prose-img:rounded-lg
      ">
        <MarkdownRenderer content={doc.content} />
      </article>

      {/* Prev / Next navigation */}
      <nav className="mt-10 flex items-center justify-between border-t pt-6">
        {prev && prevDoc ? (
          <Link
            href={`/help/${prev.slug}`}
            className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <div>
              <p className="text-xs text-muted-foreground/60">{t('prevArticle')}</p>
              <p className="font-medium">{prevDoc.title}</p>
            </div>
          </Link>
        ) : <div />}
        {next && nextDoc ? (
          <Link
            href={`/help/${next.slug}`}
            className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-right"
          >
            <div>
              <p className="text-xs text-muted-foreground/60">{t('nextArticle')}</p>
              <p className="font-medium">{nextDoc.title}</p>
            </div>
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : <div />}
      </nav>
    </div>
  );
}
