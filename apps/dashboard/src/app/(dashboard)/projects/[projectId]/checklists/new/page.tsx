'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, Trash2 } from 'lucide-react';
import { createChecklist, importChecklist, type ChecklistExport } from '@/lib/api/checklists';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface ItemForm {
  title: string;
  description: string;
  expectedBehavior: string;
  priority: string;
}

export default function NewChecklistPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isImportMode = searchParams.get('mode') === 'import';
  const { data: session } = useSession();
  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [items, setItems] = useState<ItemForm[]>([{ title: '', description: '', expectedBehavior: '', priority: 'MEDIUM' }]);
  const [importJson, setImportJson] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  function addItem() {
    setItems([...items, { title: '', description: '', expectedBehavior: '', priority: 'MEDIUM' }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ItemForm, value: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  async function onSubmit() {
    setError('');
    setIsSubmitting(true);
    try {
      if (isImportMode) {
        const data = JSON.parse(importJson) as ChecklistExport;
        const cl = await importChecklist(params.projectId, data, token);
        router.push(`/projects/${params.projectId}/checklists/${cl.id}`);
      } else {
        const cl = await createChecklist({
          projectId: params.projectId,
          name,
          description,
          targetUrl: targetUrl || undefined,
          items: items.filter((i) => i.title.trim()).map((i, idx) => ({
            title: i.title,
            description: i.description,
            expectedBehavior: i.expectedBehavior,
            priority: i.priority,
            order: idx,
          })),
        }, token);
        router.push(`/projects/${params.projectId}/checklists/${cl.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checklist');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">
        {isImportMode ? 'Import Checklist' : 'New Checklist'}
      </h2>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isImportMode ? (
        <Card>
          <CardHeader>
            <CardTitle>Paste JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full h-64 rounded-md border bg-muted p-3 font-mono text-xs"
              placeholder='{"version":"1.0","name":"...","items":[...]}'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
            />
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={onSubmit} disabled={isSubmitting || !importJson.trim()}>
              {isSubmitting ? 'Importing...' : 'Import'}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Checklist Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Login Flow Tests" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tests for the login and authentication flow" />
            </div>
            <div className="space-y-2">
              <Label>Target URL</Label>
              <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://myapp.example.com" />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Test Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-1 h-3 w-3" /> Add Item
                </Button>
              </div>
              {items.map((item, i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Item title *"
                        value={item.title}
                        onChange={(e) => updateItem(i, 'title', e.target.value)}
                      />
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(i, 'description', e.target.value)}
                      />
                      <Input
                        placeholder="Expected behavior"
                        value={item.expectedBehavior}
                        onChange={(e) => updateItem(i, 'expectedBehavior', e.target.value)}
                      />
                      <select
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        value={item.priority}
                        onChange={(e) => updateItem(i, 'priority', e.target.value)}
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>
                    {items.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeItem(i)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={onSubmit} disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Checklist'}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
