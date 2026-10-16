import { Prisma, PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

function isConnectionError(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError
    || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2024')
    || (error instanceof Error && /Can't reach database server|P100[1-3]|P1017|connection.*(?:failed|closed|timed out)/i.test(error.message))
}

// Neon can briefly wake from idle, and Prisma can run out of free pool slots when
// several requests arrive together. P2024 means the query never acquired a
// connection, so a short retry is safe for both reads and writes.
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
