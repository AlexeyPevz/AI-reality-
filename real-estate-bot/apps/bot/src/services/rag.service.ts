import { prisma } from '@real-estate-bot/database';
import { 
  DocumentChunk, 
  RAGQuery, 
  RAGResponse,
  ConversationContext,
  Message 
} from '@real-estate-bot/shared';
import { embeddingsService, EmbeddingsService } from './embeddings.service';
import { llmService } from './llm.service';
import { Prisma } from '@prisma/client';

export class RAGService {
  // Search for relevant chunks using vector similarity
  async search(query: RAGQuery): Promise<DocumentChunk[]> {
    const topK = query.topK || 5;
    const threshold = query.threshold || 0.7;

    // Generate embedding for query
    const queryEmbedding = await embeddingsService.generateEmbedding(query.query);

    // Build filter conditions
    const whereConditions: any = {
      parentId: { not: null }, // Only chunks, not parent documents
      embedding: { not: null }
    };

    if (query.filters?.type) {
      whereConditions.type = { in: query.filters.type };
    }

    // For development without pgvector, use in-memory search
    if (!queryEmbedding || queryEmbedding.length === 0) {
      return this.mockSearch(query);
    }

    try {
      // Use pgvector for similarity search
      const chunks = await prisma.$queryRaw<Array<any>>`
        SELECT 
          id,
          "documentId",
          content,
          metadata,
          embedding,
          1 - (embedding <=> ${queryEmbedding}::vector) as similarity
        FROM "KnowledgeDocument"
        WHERE "parentId" IS NOT NULL
        ${query.filters?.type ? Prisma.sql`AND type = ANY(${query.filters.type})` : Prisma.empty}
        ORDER BY embedding <=> ${queryEmbedding}::vector
        LIMIT ${topK}
      `;

      // Filter by threshold and map to DocumentChunk
      return chunks
        .filter(chunk => chunk.similarity >= threshold)
        .map(chunk => ({
          id: chunk.id,
          documentId: chunk.documentId || chunk.id,
          content: chunk.content,
          embedding: chunk.embedding,
          metadata: chunk.metadata,
          similarity: chunk.similarity
        }));
    } catch (error) {
      console.error('Vector search error:', error);
      // Fallback to text search
      return this.textSearch(query);
    }
  }

  // Generate answer using retrieved chunks
  async generateAnswer(
    query: string,
    chunks: DocumentChunk[],
    context?: string
  ): Promise<string> {
    if (chunks.length === 0) {
      return 'К сожалению, я не нашел релевантной информации в базе знаний для ответа на ваш вопрос.';
    }

    // Prepare context from chunks
    const relevantContext = chunks
      .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
      .join('\n\n');

    // Prepare conversation for LLM
    const conversationContext: ConversationContext = {
      userId: 'system',
      role: 'consultant',
      history: [
        {
          role: 'system',
          content: `Ты - эксперт по недвижимости. Используй предоставленную информацию из базы знаний для ответа на вопрос пользователя.
          
ВАЖНО:
1. Отвечай только на основе предоставленной информации
2. Если информации недостаточно, честно скажи об этом
3. Указывай источники, если они есть в метаданных
4. Будь конкретным и практичным

Контекст из базы знаний:
${relevantContext}

${context ? `Дополнительный контекст: ${context}` : ''}`
        },
        {
          role: 'user',
          content: query
        }
      ]
    };

    const response = await llmService.generateResponse(conversationContext);
    return response.message;
  }

  // Complete RAG pipeline: search + generate
  async query(ragQuery: RAGQuery): Promise<RAGResponse> {
    // Search for relevant chunks
    const chunks = await this.search(ragQuery);

    // Generate answer
    const answer = await this.generateAnswer(
      ragQuery.query,
      chunks,
      ragQuery.context
    );

    // Extract sources
    const sources = this.extractSources(chunks);

    return {
      chunks,
      answer,
      sources
    };
  }

  // Extract unique sources from chunks
  private extractSources(chunks: DocumentChunk[]): Array<{
    title: string;
    url?: string;
    pageNumber?: number;
  }> {
    const sourcesMap = new Map<string, any>();

    for (const chunk of chunks) {
      const parentTitle = chunk.metadata.parentTitle || 'Unknown Source';
      
      if (!sourcesMap.has(parentTitle)) {
        sourcesMap.set(parentTitle, {
          title: parentTitle,
          url: chunk.metadata.url,
          pageNumber: chunk.metadata.pageNumber
        });
      }
    }

    return Array.from(sourcesMap.values());
  }

  // Fallback text search when vector search is unavailable
  private async textSearch(query: RAGQuery): Promise<DocumentChunk[]> {
    const searchTerms = query.query.toLowerCase().split(' ');
    
    const chunks = await prisma.knowledgeDocument.findMany({
      where: {
        parentId: { not: null },
        OR: searchTerms.map(term => ({
          content: {
            contains: term,
            mode: 'insensitive' as any
          }
        }))
      },
      take: query.topK || 5
    });

    return chunks.map(chunk => ({
      id: chunk.id,
      documentId: chunk.parentId || chunk.id,
      content: chunk.content,
      embedding: [],
      metadata: chunk.metadata as any,
      similarity: 0.5 // Mock similarity
    }));
  }

  // Mock search for development
  private async mockSearch(query: RAGQuery): Promise<DocumentChunk[]> {
    // Return some mock chunks for testing
    return [
      {
        id: '1',
        documentId: 'doc1',
        content: 'При покупке квартиры в новостройке важно проверить репутацию застройщика и наличие всех разрешительных документов.',
        embedding: [],
        metadata: {
          startIndex: 0,
          endIndex: 100,
          parentTitle: 'Гид по покупке новостройки'
        },
        similarity: 0.9
      },
      {
        id: '2',
        documentId: 'doc2',
        content: 'Ипотечные ставки в 2024 году варьируются от 8% до 15% в зависимости от первоначального взноса и категории заемщика.',
        embedding: [],
        metadata: {
          startIndex: 200,
          endIndex: 300,
          parentTitle: 'Ипотечное кредитование'
        },
        similarity: 0.85
      }
    ];
  }

  // Add predefined Q&A pairs
  async addFAQ(question: string, answer: string, category?: string): Promise<void> {
    await documentService.ingestDocument({
      type: 'faq',
      title: question,
      content: `Вопрос: ${question}\n\nОтвет: ${answer}`,
      metadata: {
        category,
        question,
        answer
      }
    });
  }

  // Get similar questions (for suggestion feature)
  async getSimilarQuestions(query: string, limit: number = 3): Promise<string[]> {
    const results = await this.search({
      query,
      topK: limit,
      filters: {
        type: ['faq']
      }
    });

    return results
      .map(chunk => chunk.metadata.question as string)
      .filter(Boolean);
  }
}

// Import documentService after it's defined
import { documentService } from './document.service';

export const ragService = new RAGService();