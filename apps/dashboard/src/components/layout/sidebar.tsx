'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BarChart3, Bell, Building2, ClipboardList, FolderGit2, HelpCircle, LayoutDashboard,
  MessageSquare, Play, Sparkles, X, Workflow, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrgStore } from '@/lib/stores/org-store';
import { OrgSwitcher } from './org-switcher';
import { LanguageSwitcher } from './language-switcher';

const tier0Items = [
  { href: '/', labelKey: 'home' as const, icon: LayoutDashboard, exact: true },
  { href: '/organizations', labelKey: 'organizations' as const, icon: Building2, exact: false },
];

const tier1Items = [
  { href: '/projects', labelKey: 'projects' as const, icon: FolderGit2, exact: false },
  { href: '/runs', labelKey: 'runs' as const, icon: Play, exact: false },
];

const settingsItems = [
  { href: '/help', labelKey: 'help', icon: HelpCircle },
  { href: '/settings/notifications', labelKey: 'notifications', icon: Bell },
] as const;

function NavLink({ href, icon: Icon, label, isActive, className }: {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  isActive: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group/nav relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-primary/10 text-primary font-semibold'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground active:scale-[0.98]',
        className,
      )}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full bg-primary" />
      )}
      <Icon className={cn('h-4 w-4 shrink-0 transition-colors duration-200', isActive ? 'text-primary' : 'group-hover/nav:text-foreground')} aria-hidden="true" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { currentOrgId, currentProjectId, currentProjectName, clearCurrentProject } = useOrgStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const hasOrg = mounted && !!currentOrgId;
  const hasProject = mounted && !!currentProjectId;

  const tier2Items = currentProjectId ? [
    { href: `/projects/${currentProjectId}/chat`, labelKey: 'chat' as const, icon: MessageSquare },
    { href: `/projects/${currentProjectId}/pipelines`, labelKey: 'pipelines' as const, icon: Workflow },
    { href: `/projects/${currentProjectId}/coverage`, labelKey: 'coverage' as const, icon: BarChart3 },
    { href: `/projects/${currentProjectId}/checklists`, labelKey: 'checklists' as const, icon: ClipboardList },
    { href: `/projects/${currentProjectId}/ai`, labelKey: 'aiHub' as const, icon: Sparkles },
  ] : [];

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-5">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-foreground transition-opacity hover:opacity-80">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <span className="tracking-tight">{t('appName')}</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Tier 0 — always visible */}
        <div className="space-y-0.5">
          {tier0Items.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={t(item.labelKey)}
                isActive={isActive}
              />
            );
          })}
        </div>

        {/* Hint when no org selected */}
        {mounted && !currentOrgId && (
          <div className="mx-2 mt-4 flex items-start gap-2 rounded-lg border border-dashed border-muted-foreground/25 px-3 py-2.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('selectOrgHint')}
            </p>
          </div>
        )}

        {/* Tier 1 — visible when org selected */}
        {hasOrg && (
          <div className="mt-4 space-y-0.5">
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t('workspace')}
            </p>
            {tier1Items.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={t(item.labelKey)}
                  isActive={isActive}
                />
              );
            })}
          </div>
        )}

        {/* Tier 2 — visible when project selected */}
        {hasProject && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between px-3">
              <Link
                href={`/projects/${currentProjectId}`}
                className="flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 transition-colors hover:text-foreground"
                title={currentProjectName ?? ''}
              >
                {currentProjectName}
              </Link>
              <button
                onClick={clearCurrentProject}
                className="flex h-5 w-5 items-center justify-center rounded transition-colors cursor-pointer text-muted-foreground/50 hover:text-foreground hover:bg-accent"
                aria-label="Clear project selection"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-0.5">
              {tier2Items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={t(item.labelKey)}
                    isActive={isActive}
                    className="ml-1"
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Settings section */}
        <div className="mt-6">
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{t('settings')}</p>
          <div className="space-y-0.5">
            {settingsItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={t(item.labelKey)}
                  isActive={isActive}
                />
              );
            })}
          </div>
        </div>
      </nav>

      {/* Bottom section */}
      <div className="space-y-2 border-t p-3">
        <LanguageSwitcher />
        <OrgSwitcher />
      </div>
    </aside>
  );
}
