// Template Supabase driver (TypeScript). Embedded runtime contains functional implementation/fallback.
export class SupabaseDriverTemplate {
  constructor(public supabaseUrl?: string, public supabaseKey?: string) {}
  async init() { /* no-op */ }
  async storeMemory(item: any) { return { ok: true, id: item.id }; }
  async searchMemories(query: string, limit = 10, sessionId?: string) { return [] as any[]; }
  async getStats() { return { total_memories: 0, average_usefulness: 0, cache_size: 0 }; }
}

