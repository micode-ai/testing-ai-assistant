'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Plus, FileUp, ClipboardList } from 'lucide-react';
import { getChecklists, type Checklist } from '@/lib/api/checklists';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export default function ChecklistsPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  useEffect(() => {
    if (!token) return;
    getChecklists(params.projectId, token)
      .then(setChecklists)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [params.projectId, token]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
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
        <div className="text-center py-12">
          <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No checklists yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create a test checklist to start testing your application</p>
          <Button className="mt-4" onClick={() => router.push(`/projects/${params.projectId}/checklists/new`)}>
            Create Checklist
          </Button>
        </div>
      )}

      <div className="grid gap-4">
        {checklists.map((cl) => (
          <Card
            key={cl.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => router.push(`/projects/${params.projectId}/checklists/${cl.id}`)}
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
