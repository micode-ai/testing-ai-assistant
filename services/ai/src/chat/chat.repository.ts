import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Conversation, ChatMessage } from '../../generated/prisma';

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(projectId: string, title: string = ''): Promise<Conversation> {
    return this.prisma.conversation.create({
      data: { projectId, title },
    });
  }

  async findConversationById(id: string): Promise<(Conversation & { messages: ChatMessage[] }) | null> {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async findConversationsByProject(projectId: string): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateConversationTitle(id: string, title: string): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id },
      data: { title },
    });
  }

  async deleteConversation(id: string): Promise<void> {
    await this.prisma.conversation.delete({ where: { id } });
  }

  async addMessage(data: {
    conversationId: string;
    role: string;
    content: string;
    toolCalls?: unknown;
    toolResults?: unknown;
    model?: string;
    tokensUsed?: number;
  }): Promise<ChatMessage> {
    return this.prisma.chatMessage.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        toolCalls: data.toolCalls ?? undefined,
        toolResults: data.toolResults ?? undefined,
        model: data.model,
        tokensUsed: data.tokensUsed ?? 0,
      },
    });
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
