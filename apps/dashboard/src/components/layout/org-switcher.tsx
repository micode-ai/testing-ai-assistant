'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Building2, Check, ChevronsUpDown, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrgStore } from '@/lib/stores/org-store';
import { Button } from '@/components/ui/button';
import type { Organization } from '@/types';

const ORG_API_URL = process.env.NEXT_PUBLIC_ORG_API_URL || 'http://localhost:3002';

export function OrgSwitcher() {
  const router = useRouter();
  const { data: session } = useSession();
  const { currentOrgId, setCurrentOrgId } = useOrgStore();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('orgSwitcher');

  useEffect(() => {
    async function fetchOrgs() {
      if (!session) return;
      try {
        const token = (session as unknown as Record<string, unknown>).accessToken as string;
        const res = await fetch(`${ORG_API_URL}/organizations`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          setOrgs(data);
          if (data.length > 0 && (!currentOrgId || !data.find((o: Organization) => o.id === currentOrgId))) {
            setCurrentOrgId(data[0].id);
          }
        }
      } catch {
        // Silently fail
      }
    }
    fetchOrgs();
  }, [session]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const currentOrg = orgs.find((o) => o.id === currentOrgId);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          className="flex-1 justify-between text-sm h-9 cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{currentOrg?.name ?? t('selectOrganization')}</span>
          </span>
          <ChevronsUpDown className={cn(
            'ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180',
          )} />
        </Button>
        {currentOrgId && (
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground" asChild>
            <Link href={`/organizations/${currentOrgId}/settings`}>
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>

      {/* Dropdown */}
      <div className={cn(
        'absolute bottom-full left-0 mb-1 w-full rounded-lg border bg-popover p-1 shadow-lg transition-all duration-200 origin-bottom',
        isOpen
          ? 'scale-100 opacity-100 translate-y-0'
          : 'scale-95 opacity-0 translate-y-1 pointer-events-none',
      )}>
        {orgs.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">{t('noOrganizations')}</p>
        ) : (
          orgs.map((org) => {
            const isSelected = currentOrgId === org.id;
            return (
              <button
                key={org.id}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                )}
                onClick={() => {
                  setCurrentOrgId(org.id);
                  setIsOpen(false);
                  router.push('/projects');
                }}
              >
                <span className="flex h-4 w-4 items-center justify-center shrink-0">
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </span>
                <span className="truncate">{org.name}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
