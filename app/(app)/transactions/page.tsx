import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import TransactionsClient from "./TransactionsClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

interface RawTransaction {
  id: number;
  action: string;
  quantity: unknown;
  price_amount: unknown;
  price_currency: string;
  commission_amount: unknown;
  commission_currency: string;
  amount_amount: unknown;
  amount_currency: string;
  transaction_date: Date;
  notes: string | null;
  asset_id: number;
  asset_name: string;
  asset_currency: string;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const { page: pageParam, filter } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const nameFilter = filter
    ? Prisma.sql`AND a.name ILIKE ${`%${filter}%`}`
    : Prisma.sql``;

  const [transactions, countResult, assets] = await Promise.all([
    prisma.$queryRaw<RawTransaction[]>(Prisma.sql`
      SELECT
        pt.id, pt.action, pt.quantity, pt.transaction_date, pt.notes,
        (pt.price).amount            AS price_amount,
        TRIM((pt.price).currency)    AS price_currency,
        (pt.commission).amount       AS commission_amount,
        TRIM((pt.commission).currency) AS commission_currency,
        (pt.amount).amount           AS amount_amount,
        TRIM((pt.amount).currency)   AS amount_currency,
        a.id   AS asset_id,
        a.name AS asset_name,
        a.currency AS asset_currency
      FROM portfolio_transactions pt
      JOIN assets a ON pt.asset_id = a.id
      WHERE pt.user_id = ${userId} ${nameFilter}
      ORDER BY pt.transaction_date DESC
      LIMIT ${PAGE_SIZE} OFFSET ${skip}
    `),
    prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM portfolio_transactions pt
      JOIN assets a ON pt.asset_id = a.id
      WHERE pt.user_id = ${userId} ${nameFilter}
    `),
    prisma.asset.findMany({ orderBy: { name: "asc" } }),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const serialized = transactions.map((tx) => ({
    id: tx.id,
    action: tx.action,
    quantity: String(tx.quantity),
    price: String(tx.price_amount),
    priceCurrency: tx.price_currency,
    commission: String(tx.commission_amount),
    commissionCurrency: tx.commission_currency,
    amount: String(tx.amount_amount),
    amountCurrency: tx.amount_currency,
    transactionDate: tx.transaction_date.toISOString(),
    notes: tx.notes,
    asset: {
      id: tx.asset_id,
      name: tx.asset_name,
      currency: tx.asset_currency,
    },
  }));

  const assetNames = assets.map((a) => a.name);

  return (
    <TransactionsClient
      transactions={serialized}
      assetNames={assetNames}
      page={page}
      totalPages={totalPages}
      filter={filter ?? ""}
    />
  );
}
