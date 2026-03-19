'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Plus, FileUp, ClipboardList, Sparkles, Loader2 } from 'lucide-react';
import { getChecklists, createChecklist, type Checklist } from '@/lib/api/checklists';
import { triggerGeneration } from '@/lib/api/ai';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genName, setGenName] = useState('AI Generated Checklist');
  const [genTargetUrl, setGenTargetUrl] = useState('');
  const [genDescription, setGenDescription] = useState('');
  const [genError, setGenError] = useState<string | null>(null);

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

  async function handleGenerate() {
    setIsGenerating(true);
    setGenError(null);
    try {
      const result = await triggerGeneration({
        projectId: params.projectId,
        type: 'CHECKLIST_GEN' as any,
        inputContext: { targetUrl: genTargetUrl || undefined, appDescription: genDescription || undefined },
      }, token);

      let items: any[] = [];
      try {
        const match = result.output.match(/\[[\s\S]*\]/);
        items = match ? JSON.parse(match[0]) : [];
      } catch { items = []; }

      const checklist = await createChecklist({
        projectId: params.projectId,
        name: genName || 'AI Generated Checklist',
        description: genDescription,
        targetUrl: genTargetUrl || undefined,
        items: items.map((item: any, i: number) => ({
          title: item.title || 'Untitled',
          description: item.description || '',
          expectedBehavior: item.expectedBehavior || '',
          priority: item.priority || 'MEDIUM',
          section: item.section || '',
          order: i,
        })),
      }, token);

      setIsGenerateOpen(false);
      router.push(`/projects/${params.projectId}/checklists/${checklist.id}`);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }

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
          <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Sparkles className="mr-2 h-4 w-4" />
                Generate with AI
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Checklist with AI</DialogTitle>
                <DialogDescription>
                  Describe your application and the AI will generate a test checklist for you.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="gen-name">Checklist Name</Label>
                  <Input
                    id="gen-name"
                    value={genName}
                    onChange={(e) => setGenName(e.target.value)}
                    placeholder="AI Generated Checklist"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gen-url">Target URL (optional)</Label>
                  <Input
                    id="gen-url"
                    value={genTargetUrl}
                    onChange={(e) => setGenTargetUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gen-desc">App Description (optional)</Label>
                  <textarea
                    id="gen-desc"
                    value={genDescription}
                    onChange={(e) => setGenDescription(e.target.value)}
                    placeholder="Describe what your application does, key features, and what you want to test..."
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                {genError && (
                  <p className="text-sm text-destructive">{genError}</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsGenerateOpen(false)} disabled={isGenerating}>
                  Cancel
                </Button>
                <Button onClick={handleGenerate} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
