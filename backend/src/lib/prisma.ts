import { Prisma, PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

function isConnectionError(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError
    || (error instanceof Error && /Can't reach database server|P100[1-3]|P1017|connection.*(?:failed|closed|timed out)/i.test(error.message))
}

// Neon's free tier suspends the database compute after a period of inactivity.
// The first query after a wake-up can fail with a connection error before Prisma's
// short default connect timeout elapses, so we retry transient connection failures
// with a small backoff. Reads are safe to replay; writes that fail to connect never
// committed, so replaying them is safe too.
export async function withConnectionRetry<T>(operation: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isConnectionError(error) || attempt >= retries) throw error
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
  throw lastError
}
