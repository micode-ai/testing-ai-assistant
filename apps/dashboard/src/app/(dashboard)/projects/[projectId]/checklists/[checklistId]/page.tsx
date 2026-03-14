'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Play, Plus, Trash2, Download, Sparkles, ChevronDown, ChevronRight,
  GripVertical, Code2, CheckCircle2,
} from 'lucide-react';
import {
  getChecklist, updateChecklist, addChecklistItem, updateChecklistItem,
  deleteChecklistItem, exportChecklist, triggerChecklistRun,
  type Checklist, type ChecklistItem,
} from '@/lib/api/checklists';
import { triggerGeneration } from '@/lib/api/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export default function ChecklistDetailPage() {
  const params = useParams<{ projectId: string; checklistId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [runUrl, setRunUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [generatingItems, setGeneratingItems] = useState<Set<string>>(new Set());

  const fetchChecklist = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getChecklist(params.checklistId, token);
      setChecklist(data);
      if (data.targetUrl) setRunUrl(data.targetUrl);
    } catch {
      // handle error
    } finally {
      setIsLoading(false);
    }
  }, [params.checklistId, token]);

  useEffect(() => { fetchChecklist(); }, [fetchChecklist]);

  async function onAddItem() {
    if (!token || !checklist) return;
    await addChecklistItem(checklist.id, { title: 'New test item' }, token);
    fetchChecklist();
  }

  async function onUpdateItem(itemId: string, data: Partial<ChecklistItem>) {
    if (!token || !checklist) return;
    await updateChecklistItem(checklist.id, itemId, data, token);
    setEditingItem(null);
    fetchChecklist();
  }

  async function onDeleteItem(itemId: string) {
    if (!token || !checklist) return;
    await deleteChecklistItem(checklist.id, itemId, token);
    fetchChecklist();
  }

  async function onExport() {
    if (!token || !checklist) return;
    const data = await exportChecklist(checklist.id, token);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${checklist.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onRun() {
    if (!token || !checklist || !runUrl) return;
    setIsRunning(true);
    try {
      const run = await triggerChecklistRun(checklist.id, runUrl, token);
      router.push(`/checklist-runs/${run.id}`);
    } catch {
      setIsRunning(false);
    }
  }

  async function onGenerateTest(item: ChecklistItem) {
    if (!token || !checklist) return;
    setGeneratingItems((prev) => new Set(prev).add(item.id));
    try {
      const result = await triggerGeneration({
        projectId: params.projectId,
        type: 'CHECKLIST_TEST_GEN' as any,
        inputContext: {
          checklistItem: {
            title: item.title,
            description: item.description,
            expectedBehavior: item.expectedBehavior,
          },
          targetUrl: checklist.targetUrl || runUrl,
          framework: 'playwright',
        },
      }, token);
      // Save generated code to the item
      await updateChecklistItem(checklist.id, item.id, {
        generatedTestCode: result.output,
      }, token);
      fetchChecklist();
    } catch {
      // handle error
    } finally {
      setGeneratingItems((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function onGenerateAllTests() {
    if (!checklist) return;
    for (const item of checklist.items) {
      if (!item.generatedTestCode) {
        await onGenerateTest(item);
      }
    }
  }

  function toggleExpand(id: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!checklist) {
    return <p className="text-muted-foreground text-center py-12">Checklist not found</p>;
  }

  const itemsWithTests = checklist.items.filter((i) => i.generatedTestCode).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{checklist.name}</h2>
          {checklist.description && <p className="text-sm text-muted-foreground mt-1">{checklist.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={onGenerateAllTests}>
            <Sparkles className="mr-1 h-4 w-4" /> Generate All Tests
          </Button>
        </div>
      </div>

      {/* Run section */}
      <Card>
        <CardContent className="flex items-end gap-3 pt-4">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Target URL</Label>
            <Input
              placeholder="https://myapp.example.com"
              value={runUrl}
              onChange={(e) => setRunUrl(e.target.value)}
            />
          </div>
          <Button onClick={onRun} disabled={isRunning || !runUrl || itemsWithTests === 0}>
            <Play className="mr-2 h-4 w-4" />
            {isRunning ? 'Starting...' : `Run Checklist (${itemsWithTests}/${checklist.items.length} tests)`}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Items */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Items ({checklist.items.length})</h3>
        <Button variant="outline" size="sm" onClick={onAddItem}>
          <Plus className="mr-1 h-3 w-3" /> Add Item
        </Button>
      </div>

      <div className="space-y-2">
        {checklist.items.map((item) => {
          const isExpanded = expandedItems.has(item.id);
          const isEditing = editingItem === item.id;
          const isGenerating = generatingItems.has(item.id);
          const hasTest = !!item.generatedTestCode;

          return (
            <Card key={item.id}>
              <CardHeader className="py-3 cursor-pointer" onClick={() => toggleExpand(item.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <div>
                      <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                      {item.expectedBehavior && (
                        <p className="text-xs text-muted-foreground">{item.expectedBehavior}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={priorityColors[item.priority]}>{item.priority}</Badge>
                    {hasTest && <Code2 className="h-4 w-4 text-green-600" />}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-3">
                  {isEditing ? (
                    <EditItemForm
                      item={item}
                      onSave={(data) => onUpdateItem(item.id, data)}
                      onCancel={() => setEditingItem(null)}
                    />
                  ) : (
                    <>
                      {item.description && <p className="text-sm">{item.description}</p>}

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setEditingItem(item.id); }}>
                          Edit
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          onClick={(e) => { e.stopPropagation(); onGenerateTest(item); }}
                          disabled={isGenerating}
                        >
                          <Sparkles className="mr-1 h-3 w-3" />
                          {isGenerating ? 'Generating...' : hasTest ? 'Regenerate Test' : 'Generate Test'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}>
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>

                      {hasTest && (
                        <details className="group">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" /> Generated test code
                          </summary>
                          <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-950 text-zinc-200 p-3 text-xs max-h-64 overflow-y-auto">
                            {item.generatedTestCode}
                          </pre>
                        </details>
                      )}
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function EditItemForm({ item, onSave, onCancel }: {
  item: ChecklistItem;
  onSave: (data: Partial<ChecklistItem>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [expectedBehavior, setExpectedBehavior] = useState(item.expectedBehavior);
  const [priority, setPriority] = useState(item.priority);

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
      <Input value={expectedBehavior} onChange={(e) => setExpectedBehavior(e.target.value)} placeholder="Expected behavior" />
      <select className="w-full rounded-md border px-3 py-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave({ title, description, expectedBehavior, priority } as any)}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
