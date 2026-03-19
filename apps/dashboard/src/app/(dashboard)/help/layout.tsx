import { cookies } from 'next/headers';
import { getDocNav } from '@/lib/docs';
import { defaultLocale, locales, type Locale } from '@/i18n/config';
import { HelpSidebar } from './help-sidebar';

export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;
  const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale;

  const nav = getDocNav(locale);

  return (
    <div className="flex h-full gap-0">
      <HelpSidebar items={nav} />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
