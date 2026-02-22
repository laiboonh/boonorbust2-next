import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TransactionsClient from "./TransactionsClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

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

  const where = {
    userId,
    ...(filter
      ? {
          asset: {
            name: { contains: filter, mode: "insensitive" as const },
          },
        }
      : {}),
  };

  const [transactions, total, assets] = await Promise.all([
    prisma.portfolioTransaction.findMany({
      where,
      include: { asset: true },
      orderBy: { transactionDate: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.portfolioTransaction.count({ where }),
    prisma.asset.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Serialize Decimal fields so they cross the server/client boundary cleanly
  const serialized = transactions.map((tx) => ({
    id: tx.id,
    action: tx.action,
    quantity: tx.quantity.toString(),
    price: tx.price.toString(),
    priceCurrency: tx.priceCurrency,
    commission: tx.commission.toString(),
    commissionCurrency: tx.commissionCurrency,
    amount: tx.amount.toString(),
    amountCurrency: tx.amountCurrency,
    transactionDate: tx.transactionDate.toISOString(),
    notes: tx.notes,
    asset: {
      id: tx.asset.id,
      name: tx.asset.name,
      currency: tx.asset.currency,
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
