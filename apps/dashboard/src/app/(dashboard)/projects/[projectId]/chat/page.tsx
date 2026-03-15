'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { MessageSquare, Send, Plus, Trash2, Loader2, Bot, User, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageSkeleton } from '@/components/shared/page-skeleton';
import {
  Conversation,
  ChatMessage,
  ChatStreamEvent,
  getConversations,
  getConversation,
  deleteConversation,
  sendChatMessage,
  parseStreamEvents,
} from '@/lib/api/chat';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: { name: string; args: unknown }[];
  toolResults?: { name: string; result: string }[];
  isStreaming?: boolean;
}

export default function ChatPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: session } = useSession();
  const t = useTranslations('chat');
  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load conversations
  useEffect(() => {
    if (!token || !projectId) return;
    getConversations(projectId, token)
      .then(setConversations)
      .catch(console.error)
      .finally(() => setInitialLoad(false));
  }, [token, projectId]);

  // Load conversation messages
  useEffect(() => {
    if (!token || !activeConversationId) return;
    setIsLoading(true);
    getConversation(activeConversationId, token)
      .then((conv) => {
        setMessages(
          conv.messages.map((m: ChatMessage) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            toolCalls: m.toolCalls as DisplayMessage['toolCalls'],
            toolResults: m.toolResults as DisplayMessage['toolResults'],
          })),
        );
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [token, activeConversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    inputRef.current?.focus();
  };

  const handleDeleteConversation = async (id: string) => {
    if (!token) return;
    try {
      await deleteConversation(id, token);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !token || isSending) return;

    const userMessage = input.trim();
    setInput('');
    setIsSending(true);

    // Add user message to display
    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
    };
    setMessages((prev) => [...prev, userMsg]);

    // Add streaming assistant placeholder
    const assistantMsg: DisplayMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolCalls: [],
      toolResults: [],
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const { reader } = await sendChatMessage(
        userMessage,
        projectId,
        token,
        activeConversationId ?? undefined,
      );

      const decoder = new TextDecoder();
      let newConversationId = activeConversationId;
      let accumulatedContent = '';
      const toolCalls: { name: string; args: unknown }[] = [];
      const toolResults: { name: string; result: string }[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const events = parseStreamEvents(chunk);

        for (const event of events) {
          if (event.conversationId && !newConversationId) {
            newConversationId = event.conversationId;
            setActiveConversationId(newConversationId);
          }

          switch (event.type) {
            case 'text':
              accumulatedContent += event.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: accumulatedContent, toolCalls: [...toolCalls], toolResults: [...toolResults] }
                    : m,
                ),
              );
              break;

            case 'tool_call': {
              const tc = JSON.parse(event.content);
              toolCalls.push(tc);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, toolCalls: [...toolCalls] } : m,
                ),
              );
              break;
            }

            case 'tool_result': {
              const tr = JSON.parse(event.content);
              toolResults.push(tr);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, toolResults: [...toolResults] } : m,
                ),
              );
              break;
            }

            case 'done':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, isStreaming: false } : m,
                ),
              );
              break;

            case 'error':
              accumulatedContent += `\n\nError: ${event.content}`;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: accumulatedContent, isStreaming: false }
                    : m,
                ),
              );
              break;
          }
        }
      }

      // Refresh conversation list
      if (newConversationId) {
        const convs = await getConversations(projectId, token);
        setConversations(convs);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: `Error: ${err}`, isStreaming: false }
            : m,
        ),
      );
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (initialLoad) return <PageSkeleton />;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Conversation Sidebar */}
      <div className="w-64 flex-shrink-0 space-y-2 overflow-y-auto">
        <Button onClick={handleNewConversation} className="w-full" variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('newChat')}
        </Button>

        <div className="space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                activeConversationId === conv.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
              onClick={() => setActiveConversationId(conv.id)}
              onKeyDown={(e) => e.key === 'Enter' && setActiveConversationId(conv.id)}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center gap-2 truncate">
                <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{conv.title || t('untitled')}</span>
              </div>
              <button
                className="hidden text-muted-foreground hover:text-destructive group-hover:block"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteConversation(conv.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <Bot className="mb-4 h-12 w-12 opacity-50" />
              <p className="text-lg font-medium">{t('welcomeTitle')}</p>
              <p className="mt-1 text-sm">{t('welcomeSubtitle')}</p>
            </div>
          )}

          {isLoading && <PageSkeleton cards={2} />}

          {messages.map((msg) => (
            <div key={msg.id} className={`mb-4 flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role !== 'user' && (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {/* Tool calls */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {msg.toolCalls.map((tc, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Wrench className="h-3 w-3" />
                        <span className="font-mono">{tc.name}</span>
                        {msg.toolResults && msg.toolResults[i] && (
                          <span className="text-green-600">&#10003;</span>
                        )}
                        {msg.isStreaming && msg.toolResults && !msg.toolResults[i] && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tool results (collapsible) */}
                {msg.toolResults && msg.toolResults.length > 0 && (
                  <div className="mb-2">
                    {msg.toolResults.map((tr, i) => (
                      <details key={i} className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">
                          <Wrench className="mr-1 inline h-3 w-3" />
                          {tr.name} {t('result')}
                        </summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-code-bg p-2 text-code-fg">
                          {typeof tr.result === 'string' ? tr.result.slice(0, 1000) : JSON.stringify(tr.result, null, 2).slice(0, 1000)}
                        </pre>
                      </details>
                    ))}
                  </div>
                )}

                {/* Message content */}
                <div className="whitespace-pre-wrap text-sm">
                  {msg.content}
                  {msg.isStreaming && !msg.content && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('inputPlaceholder')}
              disabled={isSending}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={!input.trim() || isSending} size="icon">
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
