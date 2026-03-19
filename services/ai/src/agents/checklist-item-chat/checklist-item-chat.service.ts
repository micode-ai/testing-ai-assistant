import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { AgentOutput, ChecklistItemChatInput } from '../types';

@Injectable()
export class ChecklistItemChatService {
  private readonly logger = new Logger(ChecklistItemChatService.name);
  private readonly model: ChatOpenAI;

  constructor(private readonly configService: ConfigService) {
    this.model = new ChatOpenAI({
      modelName: this.configService.get('OPENAI_MODEL_FAST', 'gpt-4.1-mini'),
      temperature: 0.3,
      openAIApiKey: this.configService.get('OPENAI_API_KEY'),
    });
  }

  async chat(input: ChecklistItemChatInput): Promise<AgentOutput> {
    this.logger.log(`Checklist item chat for project ${input.projectId}`);

    const { item, note, messages } = input.context;
    const sysPrompt = [
      'You are a QA assistant helping verify a test checklist item.',
      '',
      `Item: "${item.title}"`,
      `Description: ${item.description || 'N/A'}`,
      `Expected behavior: ${item.expectedBehavior || 'N/A'}`,
      note ? `Note: ${note}` : '',
      '',
      'Provide concise, actionable answers. If the user asks how to verify this item, suggest specific steps.',
    ].filter(Boolean).join('\n');

    const msgs: (SystemMessage | HumanMessage | AIMessage)[] = [new SystemMessage(sysPrompt)];
    for (const m of messages || []) {
      if (m.role === 'user') msgs.push(new HumanMessage(m.content));
      else if (m.role === 'assistant') msgs.push(new AIMessage(m.content));
    }

    const response = await this.model.invoke(msgs);

    return {
      result: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      model: this.model.modelName || 'gpt-4.1-mini',
      tokensUsed: response.usage_metadata?.total_tokens ?? 0,
    };
  }
}
