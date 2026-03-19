'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface HelpSidebarProps {
  items: { slug: string; title: string; order: number }[];
}

export function HelpSidebar({ items }: HelpSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('help');
  const [search, setSearch] = useState('');

  const filtered = search
    ? items.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <aside className="w-64 shrink-0 border-r bg-card overflow-y-auto">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{t('subtitle')}</p>
      </div>
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      <nav className="px-2 pb-4">
        <div className="space-y-0.5">
          {filtered.map((item) => {
            const href = `/help/${item.slug}`;
            const isActive = pathname === href;
            return (
              <Link
                key={item.slug}
                href={href}
                className={cn(
                  'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" />
                )}
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">{t('noResults')}</p>
          )}
        </div>
      </nav>
    </aside>
  );
}
