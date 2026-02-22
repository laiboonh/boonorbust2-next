import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLatestPositions } from "@/lib/positions";
import { convertAmount } from "@/lib/exchange-rates";
import { parseDecimal, formatDate } from "@/lib/utils";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const userId = session.user.id;

  // Fetch user currency preference
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currency: true },
  });
  const userCurrency = user?.currency ?? "SGD";

  // Get latest positions (includes asset + assetTags -> tag)
  const rawPositions = await getLatestPositions(userId);

  // Convert each position's amounts to user currency
  const enrichedPositions = await Promise.all(
    rawPositions.map(async (pos) => {
      const assetCurrency = pos.amountOnHandCurrency;
      const avgPriceCurrency = pos.averagePriceCurrency;
      const assetPriceCurrency = pos.asset.priceCurrency ?? pos.asset.currency;

      const quantityOnHand = parseDecimal(pos.quantityOnHand);
      const avgPrice = parseDecimal(pos.averagePrice);
      const currentAssetPrice = parseDecimal(pos.asset.price);

      // Convert amountOnHand to user currency
      const convertedAmountOnHand = await convertAmount(
        parseDecimal(pos.amountOnHand),
        assetCurrency,
        userCurrency
      );

      // Convert average price to user currency
      const convertedAvgPrice = await convertAmount(
        avgPrice,
        avgPriceCurrency,
        userCurrency
      );

      // Convert current asset price to user currency
      const convertedCurrentPrice = await convertAmount(
        currentAssetPrice,
        assetPriceCurrency,
        userCurrency
      );

      // Unrealized profit = (currentPrice - avgPrice) * quantityOnHand (all in user currency)
      const unrealizedProfit =
        (convertedCurrentPrice - convertedAvgPrice) * quantityOnHand;

      // Current value = currentPrice * quantityOnHand
      const currentValue = convertedCurrentPrice * quantityOnHand;

      // Tags for this asset scoped to this user
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

  // Sort by current value descending
  enrichedPositions.sort((a, b) => b.currentValue - a.currentValue);

  // Total portfolio value
  const totalPortfolioValue = enrichedPositions.reduce(
    (sum, p) => sum + p.currentValue,
    0
  );

  // Tag allocation: group by tag name, sum currentValue
  const tagAllocationMap = new Map<string, number>();
  for (const pos of enrichedPositions) {
    if (pos.tags.length === 0) {
      const prev = tagAllocationMap.get("Untagged") ?? 0;
      tagAllocationMap.set("Untagged", prev + pos.currentValue);
    } else {
      for (const tag of pos.tags) {
        const prev = tagAllocationMap.get(tag.name) ?? 0;
        // Divide evenly across tags if multiple
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

  // Upcoming dividends: exDate within next 14 days
  const now = new Date();
  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);

  const upcomingDividends = await prisma.dividend.findMany({
    where: {
      exDate: { gte: now, lte: in14Days },
    },
    include: { asset: { select: { name: true, currency: true } } },
    orderBy: { exDate: "asc" },
  });

  // Recent dividends: payDate within past 14 days
  const past14Days = new Date(now);
  past14Days.setDate(past14Days.getDate() - 14);

  const recentDividends = await prisma.dividend.findMany({
    where: {
      payDate: { gte: past14Days, lte: now },
    },
    include: { asset: { select: { name: true, currency: true } } },
    orderBy: { payDate: "desc" },
  });

  // Portfolio snapshots: last 90 days
  const past90Days = new Date(now);
  past90Days.setDate(past90Days.getDate() - 90);

  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: {
      userId,
      snapshotDate: { gte: past90Days },
    },
    orderBy: { snapshotDate: "asc" },
    select: { snapshotDate: true, totalValue: true, currency: true },
  });

  // Serialize snapshots for client (convert Decimal -> number, Date -> string)
  const serializedSnapshots = snapshots.map((s) => ({
    date: formatDate(s.snapshotDate),
    value: parseDecimal(s.totalValue),
    currency: s.currency,
  }));

  // Serialize positions for client
  const serializedPositions = enrichedPositions.map((p) => ({
    ...p,
    priceUpdatedAt: p.priceUpdatedAt ? formatDate(p.priceUpdatedAt) : null,
    tags: p.tags.map((t) => ({ id: t.id, name: t.name })),
  }));

  // Serialize dividends
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
