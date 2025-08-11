import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Re-export types from Prisma
export * from '@prisma/client';

// Helper functions for type conversions
export function bigIntToNumber(value: bigint | null | undefined): number | null {
  return value ? Number(value) : null;
}

export function numberToBigInt(value: number | null | undefined): bigint | null {
  return value ? BigInt(value) : null;
}