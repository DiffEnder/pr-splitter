import { FeatureExtractionPipeline, pipeline } from '@xenova/transformers'
import { VectorHunkEntry } from './types'

export class EmbeddingService {
  private embedder: FeatureExtractionPipeline | null = null
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return

    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    this.initialized = true
  }

  async embed(text: string): Promise<number[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    if (!this.embedder) {
      throw new Error('Embedder not initialized')
    }

    const output = await this.embedder(text, {
      pooling: 'mean',
      normalize: true,
    })

    return Array.from(output.data)
  }

  async embedHunk(hunk: string): Promise<number[]> {
    // Embed just the hunk content for consistency with search queries
    return this.embed(hunk)
  }

  async searchHunksByText(
    query: string,
    hunks: VectorHunkEntry[],
    topK: number = 5,
  ): Promise<Array<{ hunk: VectorHunkEntry; similarity: number; filePath: string }>> {
    const queryEmbedding = await this.embed(query)
    const similarities = hunks.map((hunk) => ({
      hunk,
      similarity: cosineSimilarity(queryEmbedding, hunk.embedding),
      filePath: hunk.filePath,
    }))

    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, topK)
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length')
  }

  return a.reduce((sum, val, i) => sum + val * b[i], 0)
}

export function findSimilarHunks(
  queryEmbedding: number[],
  hunks: VectorHunkEntry[],
  topK: number = 5,
  threshold: number = 0.3,
): Array<{ hunk: VectorHunkEntry; similarity: number }> {
  const similarities = hunks.map((hunk) => ({
    hunk,
    similarity: cosineSimilarity(queryEmbedding, hunk.embedding),
  }))

  return similarities
    .filter((item) => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
}

export async function searchHunksByText(
  query: string,
  hunks: VectorHunkEntry[],
  embeddingService: EmbeddingService,
  topK: number = 5,
  threshold: number = 0.3,
): Promise<Array<{ hunk: VectorHunkEntry; similarity: number }>> {
  return embeddingService
    .embed(query)
    .then((queryEmbedding) => findSimilarHunks(queryEmbedding, hunks, topK, threshold))
}

export function grepHunks(pattern: string | RegExp, hunks: VectorHunkEntry[]): VectorHunkEntry[] {
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern

  return hunks.filter(
    (hunk) => regex.test(hunk.content) || regex.test(hunk.summary) || regex.test(hunk.filePath),
  )
}
