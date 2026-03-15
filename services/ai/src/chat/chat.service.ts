import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { Subject } from 'rxjs';
import { ChatRepository } from './chat.repository';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { createPlatformTools, ToolContext } from './tools/platform-tools';

export interface ChatStreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly model: ChatOpenAI;

  constructor(
    private readonly chatRepo: ChatRepository,
    private readonly knowledgeService: KnowledgeService,
    private readonly configService: ConfigService,
  ) {
    this.model = new ChatOpenAI({
      modelName: configService.get('OPENAI_MODEL_FAST', 'gpt-4.1-mini'),
      openAIApiKey: configService.get('OPENAI_API_KEY'),
      temperature: 0.3,
    });
  }

  async chat(
    message: string,
    projectId: string,
    token: string,
    conversationId?: string,
  ): Promise<{ stream: Subject<ChatStreamEvent>; conversationId: string }> {
    const stream = new Subject<ChatStreamEvent>();

    // Get or create conversation
    let conversation = conversationId
      ? await this.chatRepo.findConversationById(conversationId)
      : null;

    if (!conversation) {
      const newConv = await this.chatRepo.createConversation(projectId);
      conversation = { ...newConv, messages: [] };
    }

    const convId = conversation.id;

    // Save user message
    await this.chatRepo.addMessage({
      conversationId: convId,
      role: 'user',
      content: message,
    });

    // Run the agent loop asynchronously
    this.runAgentLoop(convId, message, projectId, token, conversation.messages, stream).catch(
      (err) => {
        this.logger.error(`Agent loop error: ${err}`);
        stream.next({ type: 'error', content: `Error: ${err.message || err}` });
        stream.complete();
      },
    );

    return { stream, conversationId: convId };
  }

  private async runAgentLoop(
    conversationId: string,
    userMessage: string,
    projectId: string,
    token: string,
    existingMessages: { role: string; content: string; toolCalls?: unknown; toolResults?: unknown }[],
    stream: Subject<ChatStreamEvent>,
  ): Promise<void> {
    try {
      // Build RAG context
      const ragResults = await this.knowledgeService.search(userMessage, projectId, 5);
      const ragContext = ragResults.length > 0
        ? `\n\nRelevant documentation:\n${ragResults.map((r) => `[${r.source}]\n${r.content}`).join('\n\n')}`
        : '';

      // Build tools
      const toolContext: ToolContext = {
        token,
        projectId,
        projectServiceUrl: this.configService.get('PROJECT_SERVICE_URL', 'http://localhost:3003'),
        pipelineServiceUrl: this.configService.get('PIPELINE_SERVICE_URL', 'http://localhost:3004'),
        aiServiceUrl: this.configService.get('AI_SERVICE_URL', 'http://localhost:3005'),
      };
      const tools = createPlatformTools(toolContext);

      // Add search_knowledge tool
      const { DynamicStructuredTool } = await import('@langchain/core/tools');
      const { z } = await import('zod');
      const searchKnowledgeTool = new DynamicStructuredTool({
        name: 'search_knowledge',
        description: 'Search the documentation knowledge base for information about the application',
        schema: z.object({
          query: z.string().describe('The search query'),
        }),
        func: async ({ query }) => {
          const results = await this.knowledgeService.search(query, projectId, 5);
          if (results.length === 0) return 'No relevant documentation found.';
          return results.map((r) => `[${r.source}]\n${r.content}`).join('\n\n');
        },
      });
      tools.push(searchKnowledgeTool);

      // Build message history
      const messages = this.buildMessages(existingMessages, userMessage, ragContext);

      // Bind tools to model
      const modelWithTools = this.model.bindTools(tools);

      // Agent loop (max 10 iterations to prevent infinite loops)
      let currentMessages = messages;
      let totalTokens = 0;

      for (let i = 0; i < 10; i++) {
        // Stream response
        let fullContent = '';
        let toolCalls: { name: string; args: Record<string, unknown>; id: string }[] = [];

        const response = await modelWithTools.invoke(currentMessages);

        fullContent = typeof response.content === 'string' ? response.content : '';
        totalTokens += response.usage_metadata?.total_tokens ?? 0;

        if (response.tool_calls && response.tool_calls.length > 0) {
          toolCalls = response.tool_calls.map((tc) => ({
            name: tc.name,
            args: tc.args as Record<string, unknown>,
            id: tc.id ?? `call_${Date.now()}`,
          }));
        }

        // If there are tool calls, execute them
        if (toolCalls.length > 0) {
          // Stream the partial text if any
          if (fullContent) {
            stream.next({ type: 'text', content: fullContent });
          }

          // Add assistant message with tool calls to history
          currentMessages = [
            ...currentMessages,
            new AIMessage({
              content: fullContent,
              tool_calls: toolCalls,
            }),
          ];

          // Execute each tool
          for (const tc of toolCalls) {
            stream.next({
              type: 'tool_call',
              content: JSON.stringify({ name: tc.name, args: tc.args }),
            });

            const tool = tools.find((t) => t.name === tc.name);
            let result = 'Tool not found';
            if (tool) {
              try {
                result = await tool.invoke(tc.args);
              } catch (err) {
                result = `Tool error: ${err}`;
              }
            }

            stream.next({
              type: 'tool_result',
              content: JSON.stringify({ name: tc.name, result }),
            });

            currentMessages = [
              ...currentMessages,
              new ToolMessage({
                content: result,
                tool_call_id: tc.id,
              }),
            ];
          }

          // Continue the loop for the model to process tool results
          continue;
        }

        // No tool calls — stream the final text
        if (fullContent) {
          stream.next({ type: 'text', content: fullContent });
        }

        // Save assistant message to DB
        await this.chatRepo.addMessage({
          conversationId,
          role: 'assistant',
          content: fullContent,
          model: this.model.modelName,
          tokensUsed: totalTokens,
        });

        // Auto-generate title for new conversations
        if (existingMessages.length === 0) {
          const title = fullContent.slice(0, 80).replace(/\n/g, ' ').trim() || 'New conversation';
          await this.chatRepo.updateConversationTitle(conversationId, title);
        }

        break;
      }

      stream.next({ type: 'done', content: '' });
      stream.complete();
    } catch (err) {
      this.logger.error(`Agent loop failed: ${err}`);
      stream.next({ type: 'error', content: `Error: ${err}` });
      stream.complete();
    }
  }

  private buildMessages(
    existingMessages: { role: string; content: string; toolCalls?: unknown; toolResults?: unknown }[],
    userMessage: string,
    ragContext: string,
  ) {
    const systemPrompt = `You are an AI assistant for the Testing AI platform — an AI-powered testing assistant for software repositories. You help users manage their testing workflows, answer questions about the platform, and execute actions.

You can:
- Answer questions about the application using documentation knowledge
- List projects, pipelines, checklists, and test runs
- Create checklists with test items
- Trigger pipeline runs and checklist executions
- Generate AI tests
- Search the documentation for detailed information

When executing actions, confirm what you're about to do before proceeding. Provide clear, concise responses. When showing results, format them in a readable way.

Current project context: projectId = ${existingMessages.length > 0 ? 'loaded from conversation' : 'new conversation'}${ragContext}`;

    const messages: (SystemMessage | HumanMessage | AIMessage)[] = [
      new SystemMessage(systemPrompt),
    ];

    // Add existing conversation history (last 20 messages to keep context manageable)
    const recentMessages = existingMessages.slice(-20);
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        messages.push(new AIMessage(msg.content));
      }
    }

    // Add new user message
    messages.push(new HumanMessage(userMessage));

    return messages;
  }

  async getConversations(projectId: string) {
    return this.chatRepo.findConversationsByProject(projectId);
  }

  async getConversation(id: string) {
    const conversation = await this.chatRepo.findConversationById(id);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    return conversation;
  }

  async deleteConversation(id: string) {
    const conversation = await this.chatRepo.findConversationById(id);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    await this.chatRepo.deleteConversation(id);
  }
}
