/**
 * Repository Pattern Example
 * ==========================
 * 
 * Abstract data access logic to make it reusable, testable, and consistent.
 * 
 * Benefits:
 * - Single source of truth for queries
 * - Easy to test (mock the repository)
 * - Consistent API across your app
 * - Reusable complex queries
 * 
 * Usage:
 * ```typescript
 * import { UserRepository } from './lib/patterns/Repository'
 * 
 * export const getUser = query({
 *   handler: async (ctx, args) => {
 *     const repo = new UserRepository(ctx)
 *     return await repo.findByEmail(args.email)
 *   },
 * })
 * ```
 */

import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { Id, Doc } from '../_generated/dataModel'

type Ctx = QueryCtx | MutationCtx

/**
 * Generic Repository Base Class
 * Provides common CRUD operations for any table
 */
export class Repository<TableName extends keyof Doc> {
  constructor(
    protected ctx: Ctx,
    protected tableName: TableName
  ) {}

  /**
   * Find document by ID
   */
  async findById(id: Id<TableName>): Promise<Doc[TableName] | null> {
    return await this.ctx.db.get(id)
  }

  /**
   * Find all documents
   */
  async findAll(): Promise<Doc[TableName][]> {
    return await this.ctx.db.query(this.tableName).collect()
  }

  /**
   * Find with pagination
   */
  async paginate(options: { limit?: number; cursor?: string }) {
    return await this.ctx.db
      .query(this.tableName)
      .order('desc')
      .paginate({
        numItems: options.limit ?? 20,
        cursor: options.cursor,
      })
  }

  /**
   * Count documents
   */
  async count(): Promise<number> {
    const docs = await this.ctx.db.query(this.tableName).collect()
    return docs.length
  }
}

/**
 * User-specific repository with domain methods
 */
export class UserRepository extends Repository<'users'> {
  constructor(ctx: Ctx) {
    super(ctx, 'users')
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<Doc['users'] | null> {
    return await this.ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique()
  }

  /**
   * Get all admin users
   */
  async getAdmins(): Promise<Doc['users'][]> {
    return await this.ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('role'), 'admin'))
      .collect()
  }

  /**
   * Get recently active users (last 7 days)
   */
  async getRecentlyActive(limit: number = 50): Promise<Doc['users'][]> {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    
    return await this.ctx.db
      .query('users')
      .filter((q) => q.gte(q.field('lastActiveAt'), sevenDaysAgo))
      .order('desc')
      .take(limit)
  }

  /**
   * Search users by name
   */
  async searchByName(query: string, limit: number = 20): Promise<Doc['users'][]> {
    return await this.ctx.db
      .query('users')
      .filter((q) => 
        q.or(
          q.eq(q.field('name'), query),
          // Add more sophisticated search logic here
        )
      )
      .take(limit)
  }
}

/**
 * Message-specific repository
 */
export class MessageRepository extends Repository<'messages'> {
  constructor(ctx: Ctx) {
    super(ctx, 'messages')
  }

  /**
   * Get messages by author
   */
  async findByAuthor(authorId: string, limit: number = 50): Promise<Doc['messages'][]> {
    return await this.ctx.db
      .query('messages')
      .withIndex('by_author', (q) => q.eq('authorId', authorId))
      .order('desc')
      .take(limit)
  }

  /**
   * Get recent messages
   */
  async getRecent(limit: number = 50): Promise<Doc['messages'][]> {
    return await this.ctx.db
      .query('messages')
      .withIndex('by_created')
      .order('desc')
      .take(limit)
  }

  /**
   * Get messages in date range
   */
  async findInDateRange(startTime: number, endTime: number): Promise<Doc['messages'][]> {
    return await this.ctx.db
      .query('messages')
      .filter((q) => 
        q.and(
          q.gte(q.field('createdAt'), startTime),
          q.lte(q.field('createdAt'), endTime)
        )
      )
      .collect()
  }
}

/**
 * File-specific repository with storage operations
 */
export class FileRepository extends Repository<'files'> {
  constructor(ctx: Ctx) {
    super(ctx, 'files')
  }

  /**
   * Get files by uploader with download URLs
   */
  async findByUploader(uploaderId: string): Promise<Array<Doc['files'] & { url: string | null }>> {
    const files = await this.ctx.db
      .query('files')
      .withIndex('by_uploader', (q) => q.eq('uploadedBy', uploaderId))
      .collect()

    return await Promise.all(
      files.map(async (file) => ({
        ...file,
        url: await this.ctx.storage.getUrl(file.storageId),
      }))
    )
  }

  /**
   * Get files by type
   */
  async findByType(fileType: string): Promise<Doc['files'][]> {
    return await this.ctx.db
      .query('files')
      .filter((q) => q.eq(q.field('type'), fileType))
      .collect()
  }

  /**
   * Get total storage used by user
   */
  async getTotalStorageByUser(uploaderId: string): Promise<number> {
    const files = await this.ctx.db
      .query('files')
      .withIndex('by_uploader', (q) => q.eq('uploadedBy', uploaderId))
      .collect()

    return files.reduce((total, file) => total + file.size, 0)
  }
}
