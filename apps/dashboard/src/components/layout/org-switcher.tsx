'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Building2, ChevronsUpDown } from 'lucide-react';
import { useOrgStore } from '@/lib/stores/org-store';
import { Button } from '@/components/ui/button';
import type { Organization } from '@/types';

const ORG_API_URL = process.env.NEXT_PUBLIC_ORG_API_URL || 'http://localhost:3002';

export function OrgSwitcher() {
  const { data: session } = useSession();
  const { currentOrgId, setCurrentOrgId } = useOrgStore();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isOpen, setIsOpen] = useState(false);
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

  const currentOrg = orgs.find((o) => o.id === currentOrgId);

  return (
    <div className="relative">
      <Button
        variant="outline"
        className="w-full justify-between text-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex items-center gap-2 truncate">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{currentOrg?.name ?? t('selectOrganization')}</span>
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-full rounded-md border bg-popover p-1 shadow-md">
          {orgs.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">{t('noOrganizations')}</p>
          ) : (
            orgs.map((org) => (
              <button
                key={org.id}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setCurrentOrgId(org.id);
                  setIsOpen(false);
                }}
              >
                <Building2 className="h-3 w-3" />
                <span className="truncate">{org.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
