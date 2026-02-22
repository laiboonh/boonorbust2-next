import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  const ca = process.env.DB_CA_CERT;

  if (process.env.NODE_ENV === "production" && !ca) {
    console.warn("DB_CA_CERT is not set — SSL will fail if the server uses a self-signed certificate");
  }

  const pool = new Pool({
    connectionString,
    ssl: ca ? { ca: ca.replace(/\\n/g, "\n") } : undefined,
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

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
