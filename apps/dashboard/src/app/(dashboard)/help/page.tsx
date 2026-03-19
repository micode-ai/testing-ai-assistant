import Link from 'next/link';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { FileText, ArrowRight } from 'lucide-react';
import { getDocNav } from '@/lib/docs';
import { defaultLocale, locales, type Locale } from '@/i18n/config';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

export default async function HelpPage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;
  const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale;
  const t = await getTranslations('help');

  const nav = getDocNav(locale);

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {nav.map((item) => (
          <Link key={item.slug} href={`/help/${item.slug}`}>
            <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30">
              <CardHeader className="flex-row items-center gap-3 py-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="flex-1 text-sm font-medium">{item.title}</CardTitle>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
