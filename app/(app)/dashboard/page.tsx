import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLatestPositions } from "@/lib/positions";
import { convertAmount } from "@/lib/exchange-rates";
import { parseDecimal, formatDate } from "@/lib/utils";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

interface RawSnapshot {
  snapshot_date: Date;
  total_value_amount: unknown;
  total_value_currency: string;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currency: true },
  });
  const userCurrency = user?.currency ?? "SGD";

  const rawPositions = await getLatestPositions(userId);

  const enrichedPositions = await Promise.all(
    rawPositions.map(async (pos) => {
      const assetCurrency = pos.amountOnHandCurrency;
      const avgPriceCurrency = pos.averagePriceCurrency;
      const assetPriceCurrency = pos.asset.priceCurrency ?? pos.asset.currency;

      const quantityOnHand = pos.quantityOnHand;
      const avgPrice = pos.averagePrice;
      const currentAssetPrice = pos.asset.price ?? 0;

      const convertedAmountOnHand = await convertAmount(
        pos.amountOnHand,
        assetCurrency,
        userCurrency
      );

      const convertedAvgPrice = await convertAmount(
        avgPrice,
        avgPriceCurrency,
        userCurrency
      );

      const convertedCurrentPrice = await convertAmount(
        currentAssetPrice,
        assetPriceCurrency,
        userCurrency
      );

      const unrealizedProfit =
        (convertedCurrentPrice - convertedAvgPrice) * quantityOnHand;

      const currentValue = convertedCurrentPrice * quantityOnHand;

      const tags = pos.asset.assetTags
        .filter((at) => at.userId === userId)
        .map((at) => at.tag);

      return {
        id: pos.id,
        assetId: pos.assetId,
        assetName: pos.asset.name,
        assetCurrency: pos.asset.currency,
        tags,
        quantityOnHand,
        convertedAmountOnHand,
        convertedAvgPrice,
        convertedCurrentPrice,
        unrealizedProfit,
        currentValue,
        priceUpdatedAt: pos.asset.priceUpdatedAt,
      };
    })
  );

  enrichedPositions.sort((a, b) => b.currentValue - a.currentValue);

  const totalPortfolioValue = enrichedPositions.reduce(
    (sum, p) => sum + p.currentValue,
    0
  );

  const tagAllocationMap = new Map<string, number>();
  for (const pos of enrichedPositions) {
    if (pos.tags.length === 0) {
      const prev = tagAllocationMap.get("Untagged") ?? 0;
      tagAllocationMap.set("Untagged", prev + pos.currentValue);
    } else {
      for (const tag of pos.tags) {
        const prev = tagAllocationMap.get(tag.name) ?? 0;
        tagAllocationMap.set(
          tag.name,
          prev + pos.currentValue / pos.tags.length
        );
      }
    }
  }
  const tagAllocation = Array.from(tagAllocationMap.entries()).map(
    ([name, value]) => ({ name, value })
  );

  const now = new Date();
  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);

  const upcomingDividends = await prisma.dividend.findMany({
    where: { exDate: { gte: now, lte: in14Days } },
    include: { asset: { select: { name: true, currency: true } } },
    orderBy: { exDate: "asc" },
  });

  const past14Days = new Date(now);
  past14Days.setDate(past14Days.getDate() - 14);

  const recentDividends = await prisma.dividend.findMany({
    where: { payDate: { gte: past14Days, lte: now } },
    include: { asset: { select: { name: true, currency: true } } },
    orderBy: { payDate: "desc" },
  });

  const past90Days = new Date(now);
  past90Days.setDate(past90Days.getDate() - 90);

  const snapshots = await prisma.$queryRaw<RawSnapshot[]>`
    SELECT
      snapshot_date,
      (total_value).amount         AS total_value_amount,
      TRIM((total_value).currency) AS total_value_currency
    FROM portfolio_snapshots
    WHERE user_id = ${userId} AND snapshot_date >= ${past90Days}
    ORDER BY snapshot_date ASC
  `;

  const serializedSnapshots = snapshots.map((s) => ({
    date: formatDate(s.snapshot_date),
    value: parseDecimal(s.total_value_amount),
    currency: s.total_value_currency,
  }));

  const serializedPositions = enrichedPositions.map((p) => ({
    ...p,
    priceUpdatedAt: p.priceUpdatedAt ? formatDate(p.priceUpdatedAt) : null,
    tags: p.tags.map((t) => ({ id: t.id, name: t.name })),
  }));

  const serializedUpcoming = upcomingDividends.map((d) => ({
    id: d.id,
    assetName: d.asset.name,
    assetCurrency: d.asset.currency,
    exDate: formatDate(d.exDate),
    payDate: d.payDate ? formatDate(d.payDate) : null,
    value: parseDecimal(d.value),
    currency: d.currency,
  }));

  const serializedRecent = recentDividends.map((d) => ({
    id: d.id,
    assetName: d.asset.name,
    assetCurrency: d.asset.currency,
    exDate: formatDate(d.exDate),
    payDate: d.payDate ? formatDate(d.payDate) : null,
    value: parseDecimal(d.value),
    currency: d.currency,
  }));

  return (
    <DashboardClient
      positions={serializedPositions}
      totalPortfolioValue={totalPortfolioValue}
      userCurrency={userCurrency}
      tagAllocation={tagAllocation}
      upcomingDividends={serializedUpcoming}
      recentDividends={serializedRecent}
      snapshots={serializedSnapshots}
    />
  );
}
