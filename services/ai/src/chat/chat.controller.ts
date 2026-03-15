import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatService } from './chat.service';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Send a chat message and receive SSE stream' })
  async chat(
    @Body() body: { message: string; projectId: string; conversationId?: string },
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const token = (req.headers.authorization || '').replace('Bearer ', '');

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const { stream, conversationId } = await this.chatService.chat(
      body.message,
      body.projectId,
      token,
      body.conversationId,
    );

    const subscription = stream.subscribe({
      next: (event) => {
        const data = JSON.stringify({ ...event, conversationId });
        res.write(`data: ${data}\n\n`);
      },
      error: (err) => {
        const data = JSON.stringify({ type: 'error', content: String(err), conversationId });
        res.write(`data: ${data}\n\n`);
        res.end();
      },
      complete: () => {
        res.end();
      },
    });

    // Clean up on client disconnect
    req.on('close', () => {
      subscription.unsubscribe();
      stream.complete();
    });
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations for a project' })
  @ApiQuery({ name: 'projectId', required: true })
  async listConversations(@Query('projectId') projectId: string) {
    return this.chatService.getConversations(projectId);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation with messages' })
  async getConversation(@Param('id') id: string) {
    return this.chatService.getConversation(id);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete a conversation' })
  async deleteConversation(@Param('id') id: string) {
    await this.chatService.deleteConversation(id);
    return { deleted: true };
  }
}
