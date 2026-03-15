'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Plus, FileUp, ClipboardList } from 'lucide-react';
import { getChecklists, type Checklist } from '@/lib/api/checklists';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/shared/page-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';

const priorityColors: Record<string, string> = {
  LOW: 'bg-priority-low-bg text-priority-low-fg',
  MEDIUM: 'bg-priority-medium-bg text-priority-medium-fg',
  HIGH: 'bg-priority-high-bg text-priority-high-fg',
  CRITICAL: 'bg-priority-critical-bg text-priority-critical-fg',
};

export default function ChecklistsPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const fetchChecklists = () => {
    if (!token) return;
    setError(null);
    setIsLoading(true);
    getChecklists(params.projectId, token)
      .then(setChecklists)
      .catch((err) => {
        setError(err?.message || 'Failed to load checklists');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    fetchChecklists();
  }, [params.projectId, token]);

  if (isLoading) {
    return <PageSkeleton cards={3} />;
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={fetchChecklists} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Checklists</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/projects/${params.projectId}/checklists/new?mode=import`)}>
            <FileUp className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button onClick={() => router.push(`/projects/${params.projectId}/checklists/new`)}>
            <Plus className="mr-2 h-4 w-4" />
            New Checklist
          </Button>
        </div>
      </div>

      {checklists.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No checklists yet"
          description="Create a test checklist to start testing your application"
          actionLabel="Create Checklist"
          onAction={() => router.push(`/projects/${params.projectId}/checklists/new`)}
        />
      )}

      <div className="grid gap-4">
        {checklists.map((cl) => (
          <Card
            key={cl.id}
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-shadow transition-colors"
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/projects/${params.projectId}/checklists/${cl.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push(`/projects/${params.projectId}/checklists/${cl.id}`);
              }
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{cl.name}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{cl.items.length} items</span>
                  {cl._count?.runs !== undefined && <span>{cl._count.runs} runs</span>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {cl.description && (
                <p className="text-sm text-muted-foreground mb-2">{cl.description}</p>
              )}
              {cl.targetUrl && (
                <p className="text-xs font-mono text-muted-foreground">{cl.targetUrl}</p>
              )}
              <div className="flex gap-1 mt-2">
                {cl.items.slice(0, 5).map((item) => (
                  <Badge key={item.id} variant="outline" className={priorityColors[item.priority] || ''}>
                    {item.title.length > 25 ? item.title.slice(0, 25) + '...' : item.title}
                  </Badge>
                ))}
                {cl.items.length > 5 && (
                  <Badge variant="outline">+{cl.items.length - 5}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
