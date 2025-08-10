import axios from 'axios';
import { config } from '../config';

export class EmbeddingsService {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';
  private model = 'openai/text-embedding-3-small'; // Cheap and effective

  constructor() {
    this.apiKey = config.openRouterApiKey || '';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      // Fallback to mock embeddings for development
      return this.generateMockEmbedding(text);
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/embeddings`,
        {
          model: this.model,
          input: text
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data[0].embedding;
    } catch (error: any) {
      console.error('Embeddings API error:', error.response?.data || error.message);
      throw new Error('Failed to generate embedding');
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      return texts.map(text => this.generateMockEmbedding(text));
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/embeddings`,
        {
          model: this.model,
          input: texts
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data.map((item: any) => item.embedding);
    } catch (error: any) {
      console.error('Embeddings API error:', error.response?.data || error.message);
      throw new Error('Failed to generate embeddings');
    }
  }

  private generateMockEmbedding(text: string): number[] {
    // Simple mock embedding based on text hash
    const embedding = new Array(1536).fill(0);
    let hash = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Fill embedding with pseudo-random values
    for (let i = 0; i < embedding.length; i++) {
      const seed = hash + i;
      embedding[i] = (Math.sin(seed) * 43758.5453123) % 1;
    }
    
    return embedding;
  }

  // Calculate cosine similarity between two embeddings
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

export const embeddingsService = new EmbeddingsService();