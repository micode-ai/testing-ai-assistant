import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { AgentInput, AgentOutput } from './types';

export abstract class BaseAgent {
  protected model: ChatOpenAI;
  protected fastModel: ChatOpenAI;

  constructor(configService: ConfigService) {
    const advancedModel = configService.get('OPENAI_MODEL_ADVANCED', 'o3');
    this.model = new ChatOpenAI({
      modelName: advancedModel,
      openAIApiKey: configService.get('OPENAI_API_KEY'),
      // o3/o4-mini reasoning models don't support temperature
      ...(advancedModel.startsWith('o') ? {} : { temperature: 0.2 }),
    });
    this.fastModel = new ChatOpenAI({
      modelName: configService.get('OPENAI_MODEL_FAST', 'gpt-4.1-mini'),
      openAIApiKey: configService.get('OPENAI_API_KEY'),
      temperature: 0.1,
    });
  }

  abstract run(input: AgentInput): Promise<AgentOutput>;
}
