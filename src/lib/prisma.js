import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

const createPrismaClient = () => {
  const url = process.env.DATABASE_URL || '';
  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Only attach Accelerate extension if explicitly using prisma:// protocol
  if (url.startsWith('prisma://')) {
    try {
      const { withAccelerate } = require('@prisma/extension-accelerate');
      return baseClient.$extends(withAccelerate());
    } catch (e) {
      console.warn('Prisma Accelerate extension failed to load, falling back to base client', e);
      return baseClient;
    }
  }

  return baseClient;
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
