import { auth } from '@/lib/auth/auth';
import { AuthExpiredError } from '@/lib/api/client';

const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:3005';

async function chatClient<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  let authToken = token;
  if (!authToken) {
    try {
      const session = await auth();
      authToken = (session as unknown as Record<string, unknown>)?.accessToken as string;
    } catch {
      // Client-side
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${AI_API_URL}${path}`, { ...fetchOptions, headers });

  if (response.status === 401) {
    throw new AuthExpiredError();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

// --- Types ---

export interface Conversation {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: unknown;
  toolResults?: unknown;
  model?: string;
  tokensUsed: number;
  createdAt: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: ChatMessage[];
}

export interface ChatStreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content: string;
  conversationId: string;
}

// --- API ---

export async function getConversations(projectId: string, token?: string): Promise<Conversation[]> {
  return chatClient<Conversation[]>(`/ai/chat/conversations?projectId=${projectId}`, { token });
}

export async function getConversation(id: string, token?: string): Promise<ConversationWithMessages> {
  return chatClient<ConversationWithMessages>(`/ai/chat/conversations/${id}`, { token });
}

export async function deleteConversation(id: string, token?: string): Promise<void> {
  return chatClient<void>(`/ai/chat/conversations/${id}`, { method: 'DELETE', token });
}

/**
 * Send a chat message and receive streaming response.
 * Returns a ReadableStream of ChatStreamEvent.
 */
export async function sendChatMessage(
  message: string,
  projectId: string,
  token: string,
  conversationId?: string,
): Promise<{ reader: ReadableStreamDefaultReader<Uint8Array>; response: Response }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`${AI_API_URL}/ai/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, projectId, conversationId }),
  });

  if (response.status === 401) {
    throw new AuthExpiredError();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const reader = response.body!.getReader();
  return { reader, response };
}

export function parseStreamEvents(chunk: string): ChatStreamEvent[] {
  const events: ChatStreamEvent[] = [];
  const lines = chunk.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      try {
        const data = JSON.parse(trimmed.slice(6));
        events.push(data);
      } catch {
        // Ignore malformed lines
      }
    } else if (trimmed.startsWith('{')) {
      // Direct JSON (non-SSE format)
      try {
        events.push(JSON.parse(trimmed));
      } catch {
        // Ignore
      }
    }
  }

  return events;
}

export async function indexKnowledge(token?: string): Promise<{ indexed: number }> {
  return chatClient<{ indexed: number }>('/ai/knowledge/index', { method: 'POST', token });
}
