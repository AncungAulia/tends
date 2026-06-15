import { PrismaClient } from "@prisma/client";
import { isDev } from "../config/env.js";

/** Prisma singleton — survives tsx hot-reload via globalThis. */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ["warn", "error"] : ["error"],
  });

if (isDev) globalForPrisma.prisma = prisma;
