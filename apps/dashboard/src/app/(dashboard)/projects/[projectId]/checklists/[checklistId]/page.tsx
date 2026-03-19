'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  Play, Plus, Trash2, Download, Sparkles, ChevronDown, ChevronRight,
  GripVertical, Code2, CheckCircle2, MessageSquare, Loader2, Send,
  ArrowLeft,
} from 'lucide-react';
import {
  getChecklist, updateChecklist, deleteChecklist, addChecklistItem, updateChecklistItem,
  deleteChecklistItem, exportChecklist, triggerChecklistRun,
  getItemMessages, sendItemMessage,
  type Checklist, type ChecklistItem, type ItemMessage,
} from '@/lib/api/checklists';
import { triggerGeneration } from '@/lib/api/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { PageSkeleton } from '@/components/shared/page-skeleton';

const priorityColors: Record<string, string> = {
  LOW: 'bg-priority-low-bg text-priority-low-fg',
  MEDIUM: 'bg-priority-medium-bg text-priority-medium-fg',
  HIGH: 'bg-priority-high-bg text-priority-high-fg',
  CRITICAL: 'bg-priority-critical-bg text-priority-critical-fg',
};

interface SectionGroup {
  section: string;
  items: ChecklistItem[];
}

function groupBySection(items: ChecklistItem[]): SectionGroup[] {
  const groups = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const key = item.section || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries()).map(([section, items]) => ({ section, items }));
}

function hasSections(items: ChecklistItem[]): boolean {
  return items.some((item) => item.section && item.section.length > 0);
}

export default function ChecklistDetailPage() {
  const params = useParams<{ projectId: string; checklistId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations('checklists');
  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [runUrl, setRunUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [generatingItems, setGeneratingItems] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  async function onDeleteChecklist() {
    if (!token || !checklist) return;
    setIsDeleting(true);
    try {
      await deleteChecklist(checklist.id, token);
      router.push(`/projects/${params.projectId}/checklists`);
    } catch {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
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
        type: 'CHECKLIST_TEST_GEN',
        inputContext: {
          checklistItem: { title: item.title, description: item.description, expectedBehavior: item.expectedBehavior },
          targetUrl: checklist.targetUrl || runUrl,
          framework: 'playwright',
        },
      }, token);
      await updateChecklistItem(checklist.id, item.id, { generatedTestCode: result.output }, token);
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
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSection(section: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  }

  function toggleAllSections() {
    if (!checklist) return;
    const sections = groupBySection(checklist.items);
    const allCollapsed = sections.every((s) => collapsedSections.has(s.section));
    if (allCollapsed) {
      setCollapsedSections(new Set());
    } else {
      setCollapsedSections(new Set(sections.map((s) => s.section)));
    }
  }

  if (isLoading) return <PageSkeleton cards={4} />;
  if (!checklist) return <p className="text-muted-foreground text-center py-12">{t('notFound')}</p>;

  const itemsWithTests = checklist.items.filter((i) => i.generatedTestCode).length;
  const useSections = hasSections(checklist.items);
  const sections = useSections ? groupBySection(checklist.items) : [];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => router.push(`/projects/${params.projectId}/checklists`)}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> {t('backToList')}
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{checklist.name}</h2>
          {checklist.description && <p className="text-sm text-muted-foreground mt-1">{checklist.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="mr-1 h-4 w-4" /> {t('export')}
          </Button>
          <Button variant="outline" size="sm" onClick={onGenerateAllTests}>
            <Sparkles className="mr-1 h-4 w-4" /> {t('generateAllTests')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" /> {t('delete')}
          </Button>
        </div>
      </div>

      {/* Run section */}
      <Card>
        <CardContent className="flex items-end gap-3 pt-4">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">{t('targetUrl')}</Label>
            <Input placeholder="https://myapp.example.com" value={runUrl} onChange={(e) => setRunUrl(e.target.value)} />
          </div>
          <Button onClick={onRun} disabled={isRunning || !runUrl || itemsWithTests === 0}>
            <Play className="mr-2 h-4 w-4" />
            {isRunning ? t('starting') : t('runChecklist', { tests: itemsWithTests, total: checklist.items.length })}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Items header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">{t('itemsCount', { count: checklist.items.length })}</h3>
        <div className="flex gap-2">
          {useSections && (
            <Button variant="ghost" size="sm" onClick={toggleAllSections}>
              {sections.every((s) => collapsedSections.has(s.section)) ? t('expandAll') : t('collapseAll')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onAddItem}>
            <Plus className="mr-1 h-3 w-3" /> {t('addItem')}
          </Button>
        </div>
      </div>

      {/* Sectioned display */}
      {useSections ? (
        <div className="space-y-4">
          {sections.map((group) => {
            const sectionLabel = group.section || t('generalSection');
            const isCollapsed = collapsedSections.has(group.section);
            const completedCount = group.items.filter((i) => i.isCompleted).length;
            const allCompleted = group.items.length > 0 && completedCount === group.items.length;
            return (
              <div key={group.section} className={allCompleted ? 'opacity-60' : ''}>
                <button
                  onClick={() => toggleSection(group.section)}
                  className="flex items-center gap-2 w-full text-left px-1 py-2 hover:bg-accent rounded-lg transition-colors cursor-pointer"
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {allCompleted && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                  <span className={`text-sm font-semibold ${allCompleted ? 'line-through text-muted-foreground' : ''}`}>{sectionLabel}</span>
                  <Badge variant={allCompleted ? 'default' : 'secondary'} className={`text-xs ${allCompleted ? 'bg-green-600' : ''}`}>
                    {completedCount}/{group.items.length}
                  </Badge>
                </button>
                {!isCollapsed && (
                  <div className="space-y-2 ml-6 mt-1">
                    {group.items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        checklist={checklist}
                        token={token}
                        isExpanded={expandedItems.has(item.id)}
                        isEditing={editingItem === item.id}
                        isGenerating={generatingItems.has(item.id)}
                        onToggleExpand={() => toggleExpand(item.id)}
                        onEdit={() => setEditingItem(item.id)}
                        onCancelEdit={() => setEditingItem(null)}
                        onUpdateItem={onUpdateItem}
                        onDeleteItem={onDeleteItem}
                        onGenerateTest={() => onGenerateTest(item)}
                        onNoteUpdate={fetchChecklist}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat display (backward compat) */
        <div className="space-y-2">
          {checklist.items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              checklist={checklist}
              token={token}
              isExpanded={expandedItems.has(item.id)}
              isEditing={editingItem === item.id}
              isGenerating={generatingItems.has(item.id)}
              onToggleExpand={() => toggleExpand(item.id)}
              onEdit={() => setEditingItem(item.id)}
              onCancelEdit={() => setEditingItem(null)}
              onUpdateItem={onUpdateItem}
              onDeleteItem={onDeleteItem}
              onGenerateTest={() => onGenerateTest(item)}
              onNoteUpdate={fetchChecklist}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteDialogTitle')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={onDeleteChecklist} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Item Card ---

function ItemCard({ item, checklist, token, isExpanded, isEditing, isGenerating, onToggleExpand, onEdit, onCancelEdit, onUpdateItem, onDeleteItem, onGenerateTest, onNoteUpdate, t }: {
  item: ChecklistItem;
  checklist: Checklist;
  token: string;
  isExpanded: boolean;
  isEditing: boolean;
  isGenerating: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdateItem: (itemId: string, data: Partial<ChecklistItem>) => void;
  onDeleteItem: (itemId: string) => void;
  onGenerateTest: () => void;
  onNoteUpdate: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const hasTest = !!item.generatedTestCode;

  async function toggleCompleted(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await updateChecklistItem(checklist.id, item.id, { isCompleted: !item.isCompleted } as any, token);
      onNoteUpdate(); // refetch
    } catch {
      // best-effort
    }
  }

  return (
    <Card className={`hover:shadow-md transition-shadow ${item.isCompleted ? 'opacity-70' : ''}`}>
      <CardHeader
        className="py-3 cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleCompleted}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors cursor-pointer ${
                item.isCompleted
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-muted-foreground/40 hover:border-primary'
              }`}
              aria-label={item.isCompleted ? t('markIncomplete') : t('markComplete')}
            >
              {item.isCompleted && <CheckCircle2 className="h-3.5 w-3.5" />}
            </button>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <div>
              <CardTitle className={`text-sm font-medium ${item.isCompleted ? 'line-through text-muted-foreground' : ''}`}>{item.title}</CardTitle>
              {item.expectedBehavior && <p className="text-xs text-muted-foreground">{item.expectedBehavior}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={priorityColors[item.priority]}>{item.priority}</Badge>
            {hasTest && <Code2 className="h-4 w-4 text-green-600" />}
            {item.note && <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-3">
          {isEditing ? (
            <EditItemForm item={item} onSave={(data) => onUpdateItem(item.id, data)} onCancel={onCancelEdit} />
          ) : (
            <>
              {item.description && <p className="text-sm">{item.description}</p>}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(); }}>{t('edit')}</Button>
                <Button
                  variant="outline" size="sm"
                  onClick={(e) => { e.stopPropagation(); onGenerateTest(); }}
                  disabled={isGenerating}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  {isGenerating ? t('generating') : hasTest ? t('regenerateTest') : t('generateTest')}
                </Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}>
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </div>

              {hasTest && (
                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600" /> {t('generatedTestCode')}
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-code-bg text-code-fg p-3 text-xs max-h-64 overflow-y-auto">
                    {item.generatedTestCode}
                  </pre>
                </details>
              )}

              {/* Note */}
              <NoteField item={item} checklist={checklist} token={token} onUpdate={onNoteUpdate} t={t} />

              {/* AI Chat */}
              <ItemChat item={item} checklist={checklist} token={token} t={t} />
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// --- Note Field ---

function NoteField({ item, checklist, token, onUpdate, t }: {
  item: ChecklistItem;
  checklist: Checklist;
  token: string;
  onUpdate: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [note, setNote] = useState(item.note || '');
  const [saving, setSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setNote(item.note || ''); }, [item.note]);

  function handleChange(value: string) {
    setNote(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => saveNote(value), 1000);
  }

  async function saveNote(value: string) {
    if (value === (item.note || '')) return;
    setSaving(true);
    try {
      await updateChecklistItem(checklist.id, item.id, { note: value } as any, token);
      onUpdate();
    } catch {
      // best-effort
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 mb-1">
        <Label className="text-xs text-muted-foreground">{t('note')}</Label>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {item.noteUpdatedAt && (
          <span className="text-[10px] text-muted-foreground/60">
            {new Date(item.noteUpdatedAt).toLocaleString()}
          </span>
        )}
      </div>
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder={t('notePlaceholder')}
        value={note}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => saveNote(note)}
      />
    </div>
  );
}

// --- Item AI Chat ---

function ItemChat({ item, checklist, token, t }: {
  item: ChecklistItem;
  checklist: Checklist;
  token: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const [messages, setMessages] = useState<ItemMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function loadMessages() {
    try {
      const msgs = await getItemMessages(checklist.id, item.id, token);
      setMessages(msgs);
      setLoaded(true);
    } catch {
      // best-effort
    }
  }

  function handleOpen() {
    setIsOpen(!isOpen);
    if (!isOpen && !loaded) {
      loadMessages();
    }
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    // Optimistic user message
    setMessages((prev) => [...prev, { id: `temp-${Date.now()}`, itemId: item.id, role: 'user', content: text, createdAt: new Date().toISOString() }]);
    setLoading(true);
    try {
      const assistantMsg = await sendItemMessage(checklist.id, item.id, text, token);
      // Replace optimistic + add assistant
      const fresh = await getItemMessages(checklist.id, item.id, token);
      setMessages(fresh);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {t('aiChat')} {messages.length > 0 && `(${messages.length})`}
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>

      {isOpen && (
        <div className="mt-2 rounded-lg border bg-muted/30 p-3">
          {/* Messages */}
          <div className="max-h-60 overflow-y-auto space-y-2 mb-3">
            {messages.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground text-center py-2">{t('chatEmpty')}</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-card border rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chatPlaceholder')}
              className="text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={loading}
            />
            <Button size="sm" onClick={handleSend} disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Edit Item Form ---

function EditItemForm({ item, onSave, onCancel }: {
  item: ChecklistItem;
  onSave: (data: Partial<ChecklistItem>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [expectedBehavior, setExpectedBehavior] = useState(item.expectedBehavior);
  const [priority, setPriority] = useState<string>(item.priority);
  const [section, setSection] = useState(item.section || '');

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
      <Input value={expectedBehavior} onChange={(e) => setExpectedBehavior(e.target.value)} placeholder="Expected behavior" />
      <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Section (e.g., Authentication)" />
      <select className="w-full rounded-md border px-3 py-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave({ title, description, expectedBehavior, priority, section } as any)}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
