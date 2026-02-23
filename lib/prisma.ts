import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const ca = process.env.DB_CA_CERT;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // In serverless each instance should hold at most 1 connection
    // to avoid exhausting PostgreSQL's connection limit across many concurrent invocations.
    max: 1,
    ssl: ca
      ? { rejectUnauthorized: true, ca: ca.replace(/\\n/g, "\n") }
      : { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Keep the singleton in all environments — in serverless, the global persists
// across warm invocations of the same instance, reducing connection churn.
globalForPrisma.prisma = prisma;
