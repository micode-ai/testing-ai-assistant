'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

function usePageTitle(pathname: string): string {
  const t = useTranslations();

  if (pathname === '/') return t('header.dashboard');
  if (pathname === '/organizations') return t('nav.organizations');
  if (pathname === '/organizations/new') return t('header.newOrganization');
  if (pathname.endsWith('/members')) return t('common.members');
  if (pathname.endsWith('/settings')) return t('common.settings');
  if (pathname.match(/^\/organizations\/[^/]+$/)) return t('header.organization');
  if (pathname === '/projects') return t('nav.projects');
  if (pathname === '/projects/new') return t('newProject.title');
  if (pathname.includes('/pipelines/new')) return t('newPipeline.title');
  if (pathname.includes('/pipelines')) return t('pipelines.title');
  if (pathname.includes('/coverage')) return t('nav.coverage');
  if (pathname.includes('/ai/generate')) return t('aiGenerate.title');
  if (pathname.includes('/ai')) return t('aiHub.title');
  if (pathname.includes('/runs') && pathname.includes('/artifacts')) return t('artifacts.title');
  if (pathname.includes('/runs')) return t('testRun.title');
  if (pathname.includes('/notifications')) return t('nav.notifications');
  return t('header.dashboard');
}

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const t = useTranslations('common');
  const title = usePageTitle(pathname);

  const initials = session?.user?.name
    ? session.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={session?.user?.image ?? undefined} alt={session?.user?.name ?? t('user')} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{session?.user?.name ?? t('user')}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut({ callbackUrl: '/login' })}
          title={t('signOut')}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
