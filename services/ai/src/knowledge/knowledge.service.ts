import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import { KnowledgeRepository } from './knowledge.repository';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class KnowledgeService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly embeddings: OpenAIEmbeddings;

  constructor(
    private readonly knowledgeRepo: KnowledgeRepository,
    private readonly configService: ConfigService,
  ) {
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
      openAIApiKey: this.configService.get('OPENAI_API_KEY'),
    });
  }

  /**
   * Auto-index documentation on startup if the knowledge base is empty.
   */
  async onModuleInit(): Promise<void> {
    try {
      const count = await this.knowledgeRepo.count();
      if (count === 0) {
        this.logger.log('Knowledge base is empty — starting auto-indexing...');
        const result = await this.indexDocumentation();
        this.logger.log(`Auto-indexing complete: ${result.indexed} chunks indexed`);
      } else {
        this.logger.log(`Knowledge base has ${count} chunks — skipping auto-index`);
      }
    } catch (err) {
      this.logger.warn(`Auto-indexing failed (non-fatal): ${err}`);
    }
  }

  /**
   * Index all documentation from docs/ and user_docs/ directories.
   */
  async indexDocumentation(): Promise<{ indexed: number }> {
    const rootDir = this.configService.get('PROJECT_ROOT', path.resolve(process.cwd(), '../..'));
    const docDirs = [
      path.join(rootDir, 'docs', 'en'),
      path.join(rootDir, 'user_docs', 'en'),
    ];

    let totalIndexed = 0;

    for (const dir of docDirs) {
      if (!fs.existsSync(dir)) {
        this.logger.warn(`Documentation directory not found: ${dir}`);
        continue;
      }

      const files = this.getMarkdownFiles(dir);
      for (const filePath of files) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const relativePath = path.relative(rootDir, filePath);

          // Delete existing chunks for this source
          await this.knowledgeRepo.deleteBySource(relativePath);

          // Split into chunks
          const chunks = this.splitIntoChunks(content, 500);

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const record = await this.knowledgeRepo.create({
              source: relativePath,
              content: chunk,
              metadata: { chunkIndex: i, totalChunks: chunks.length },
            });

            // Generate and store embedding
            try {
              const [embedding] = await this.embeddings.embedDocuments([chunk]);
              await this.knowledgeRepo.updateEmbedding(record.id, embedding);
            } catch (err) {
              this.logger.warn(`Failed to generate embedding for chunk ${record.id}: ${err}`);
            }

            totalIndexed++;
          }

          this.logger.log(`Indexed ${chunks.length} chunks from ${relativePath}`);
        } catch (err) {
          this.logger.error(`Failed to index ${filePath}: ${err}`);
        }
      }
    }

    this.logger.log(`Total chunks indexed: ${totalIndexed}`);
    return { indexed: totalIndexed };
  }

  /**
   * Search knowledge base using semantic similarity.
   */
  async search(
    query: string,
    projectId?: string,
    limit: number = 5,
  ): Promise<{ content: string; source: string; metadata: unknown }[]> {
    const count = await this.knowledgeRepo.count();
    if (count === 0) {
      return [];
    }

    try {
      const [queryEmbedding] = await this.embeddings.embedDocuments([query]);
      const results = await this.knowledgeRepo.searchSimilar(queryEmbedding, limit, projectId);

      return results
        .filter((r) => r.distance < 0.8) // Filter out low-relevance results
        .map((r) => ({
          content: r.content,
          source: r.source,
          metadata: r.metadata,
        }));
    } catch (err) {
      this.logger.error(`Knowledge search failed: ${err}`);
      return [];
    }
  }

  private getMarkdownFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.getMarkdownFiles(fullPath));
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Split text into chunks of approximately `maxTokens` tokens (~4 chars per token).
   */
  private splitIntoChunks(text: string, maxTokens: number): string[] {
    const maxChars = maxTokens * 4;
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\n+/);

    let currentChunk = '';

    for (const para of paragraphs) {
      if (currentChunk.length + para.length + 2 > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      if (para.length > maxChars) {
        // Split long paragraphs by sentences
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        const sentences = para.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 > maxChars && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
