'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BarChart3, Bell, Building2, FolderGit2, LayoutDashboard, Play, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrgSwitcher } from './org-switcher';
import { LanguageSwitcher } from './language-switcher';

const navItems = [
  { href: '/', labelKey: 'home' as const, icon: LayoutDashboard, exact: true },
  { href: '/organizations', labelKey: 'organizations' as const, icon: Building2, exact: false },
  { href: '/projects', labelKey: 'projects' as const, icon: FolderGit2, exact: false },
  { href: '/runs', labelKey: 'runs' as const, icon: Play, exact: false },
];

const settingsItems = [
  { href: '/settings/notifications', labelKey: 'notifications', icon: Bell },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <LayoutDashboard className="h-5 w-5" />
          <span>{t('appName')}</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}

        {pathname.startsWith('/projects/') && (
          <>
            <Link
              href={`${pathname.split('/').slice(0, 3).join('/')}/coverage`}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ml-4',
                pathname.includes('/coverage')
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <BarChart3 className="h-4 w-4" />
              {t('coverage')}
            </Link>
            <Link
              href={`${pathname.split('/').slice(0, 3).join('/')}/ai`}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ml-4',
                pathname.includes('/ai')
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Sparkles className="h-4 w-4" />
              {t('ai')}
            </Link>
          </>
        )}

        <div className="pt-4">
          <p className="px-3 pb-1 text-xs font-semibold uppercase text-muted-foreground">{t('settings')}</p>
          {settingsItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <item.icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="space-y-3 border-t p-4">
        <LanguageSwitcher />
        <OrgSwitcher />
      </div>
    </aside>
  );
}
