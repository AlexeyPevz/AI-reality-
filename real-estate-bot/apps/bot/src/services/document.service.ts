import { prisma } from '@real-estate-bot/database';
import { KnowledgeDocument } from '@real-estate-bot/shared';
import { embeddingsService } from './embeddings.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class DocumentService {
  // Maximum chunk size in characters
  private readonly CHUNK_SIZE = 1000;
  private readonly CHUNK_OVERLAP = 200;

  // Ingest a document into the knowledge base
  async ingestDocument(input: {
    type: KnowledgeDocument['type'];
    title: string;
    content?: string;
    url?: string;
    metadata?: Record<string, any>;
  }): Promise<KnowledgeDocument> {
    let content = input.content || '';

    // Fetch content if URL provided
    if (input.url && !content) {
      content = await this.fetchUrlContent(input.url);
    }

    // Create parent document
    const document = await prisma.knowledgeDocument.create({
      data: {
        type: input.type,
        title: input.title,
        content: content,
        sourceUrl: input.url,
        metadata: input.metadata || {}
      }
    });

    // Chunk the document
    const chunks = this.chunkText(content);
    
    // Generate embeddings for chunks
    const embeddings = await embeddingsService.generateEmbeddings(
      chunks.map(chunk => chunk.content)
    );

    // Save chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      await prisma.knowledgeDocument.create({
        data: {
          type: document.type,
          title: `${document.title} - Chunk ${i + 1}`,
          content: chunks[i].content,
          metadata: {
            ...chunks[i].metadata,
            parentTitle: document.title
          },
          embedding: embeddings[i] as any, // Prisma will handle the vector type
          chunkIndex: i,
          parentId: document.id
        }
      });
    }

    return document;
  }

  // Chunk text into smaller pieces
  private chunkText(text: string): Array<{ content: string; metadata: any }> {
    const chunks: Array<{ content: string; metadata: any }> = [];
    const sentences = this.splitIntoSentences(text);
    
    let currentChunk = '';
    let currentStart = 0;
    let sentenceStart = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.CHUNK_SIZE && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            startIndex: currentStart,
            endIndex: sentenceStart
          }
        });

        // Start new chunk with overlap
        const overlapStart = Math.max(0, currentChunk.length - this.CHUNK_OVERLAP);
        currentChunk = currentChunk.substring(overlapStart) + sentence;
        currentStart = sentenceStart - (currentChunk.length - sentence.length);
      } else {
        currentChunk += sentence;
      }

      sentenceStart += sentence.length;
    }

    // Add last chunk
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          startIndex: currentStart,
          endIndex: text.length
        }
      });
    }

    return chunks;
  }

  // Split text into sentences
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitter - can be improved with NLP
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map(s => s.trim() + ' ');
  }

  // Fetch content from URL
  private async fetchUrlContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      
      // Remove scripts and styles
      $('script, style').remove();
      
      // Extract text
      const text = $('body').text();
      
      // Clean up whitespace
      return text.replace(/\s+/g, ' ').trim();
    } catch (error) {
      console.error('Failed to fetch URL content:', error);
      throw new Error('Failed to fetch content from URL');
    }
  }

  // Delete document and its chunks
  async deleteDocument(documentId: string): Promise<void> {
    await prisma.knowledgeDocument.deleteMany({
      where: {
        OR: [
          { id: documentId },
          { parentId: documentId }
        ]
      }
    });
  }

  // Get all documents (parents only)
  async getDocuments(): Promise<KnowledgeDocument[]> {
    const docs = await prisma.knowledgeDocument.findMany({
      where: {
        parentId: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return docs as any;
  }

  // Update document metadata
  async updateDocumentMetadata(
    documentId: string, 
    metadata: Record<string, any>
  ): Promise<void> {
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { metadata }
    });
  }
}

export const documentService = new DocumentService();