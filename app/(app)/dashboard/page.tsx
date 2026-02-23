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

interface RawRecentDividend {
  id: unknown;
  asset_name: string;
  asset_currency: string;
  ex_date: Date;
  pay_date: Date | null;
  value: unknown;
  currency: string;
  total_amount: unknown;
  total_currency: string | null;
}

interface RawDividendRow {
  month: string;
  asset_name: string;
  amount: unknown;
  currency: string;
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

  // Fetch portfolios with their tags for per-portfolio pie charts
  const portfoliosWithTags = await prisma.portfolio.findMany({
    where: { userId },
    include: {
      portfolioTags: {
        include: { tag: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const portfolioCharts = portfoliosWithTags
    .map((portfolio, index) => {
      const tagIds = new Set(portfolio.portfolioTags.map((pt) => pt.tagId));

      const tagValues = new Map<string, number>();
      for (const pos of enrichedPositions) {
        const matchingTags = pos.tags.filter((t) => tagIds.has(t.id));
        if (matchingTags.length > 0) {
          for (const tag of matchingTags) {
            const prev = tagValues.get(tag.name) ?? 0;
            tagValues.set(
              tag.name,
              prev + pos.currentValue / matchingTags.length
            );
          }
        }
      }

      const chartData = Array.from(tagValues.entries())
        .map(([label, value]) => ({ label, value }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value);

      return {
        id: portfolio.id,
        name: portfolio.name,
        description: portfolio.description,
        chartData,
        colorIndex: index,
      };
    })
    .filter((p) => p.chartData.length > 0);

  // Investment allocation (positions as % of total portfolio)
  const investmentAllocation = enrichedPositions
    .map((pos) => ({
      label: pos.assetName,
      value: pos.currentValue,
      percentage:
        totalPortfolioValue > 0
          ? parseFloat(
              ((pos.currentValue / totalPortfolioValue) * 100).toFixed(2)
            )
          : 0,
    }))
    .filter((d) => d.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);

  const now = new Date();

  // Dividend chart data: last 12 months of realized dividend income
  const past12Months = new Date(now);
  past12Months.setMonth(past12Months.getMonth() - 12);

  const rawDividendRows = await prisma.$queryRaw<RawDividendRow[]>`
    SELECT
      TO_CHAR(d.pay_date, 'YYYY-MM') AS month,
      a.name AS asset_name,
      SUM((rp.amount).amount) AS amount,
      TRIM((rp.amount).currency) AS currency
    FROM realized_profits rp
    JOIN dividends d ON rp.dividend_id = d.id
    JOIN assets a ON rp.asset_id = a.id
    WHERE rp.user_id = ${userId}
      AND rp.dividend_id IS NOT NULL
      AND d.pay_date IS NOT NULL
      AND d.pay_date >= ${past12Months}
    GROUP BY TO_CHAR(d.pay_date, 'YYYY-MM'), a.name, TRIM((rp.amount).currency)
    ORDER BY month ASC, a.name ASC
  `;

  // Convert dividend amounts to user currency
  const convertedDividendRows = await Promise.all(
    rawDividendRows.map(async (row) => ({
      month: row.month,
      assetName: row.asset_name,
      value: await convertAmount(
        parseDecimal(row.amount),
        row.currency,
        userCurrency
      ),
    }))
  );

  // Aggregate by month+asset in case of multiple currency rows
  const dividendAggMap = new Map<string, number>();
  for (const row of convertedDividendRows) {
    const key = `${row.month}|||${row.assetName}`;
    dividendAggMap.set(key, (dividendAggMap.get(key) ?? 0) + row.value);
  }

  const dividendMonths = [
    ...new Set(convertedDividendRows.map((r) => r.month)),
  ].sort();
  const dividendAssets = [
    ...new Set(convertedDividendRows.map((r) => r.assetName)),
  ].sort();

  const dividendChartData = {
    labels: dividendMonths,
    datasets: dividendAssets.map((assetName) => ({
      label: assetName,
      data: dividendMonths.map(
        (month) => dividendAggMap.get(`${month}|||${assetName}`) ?? 0
      ),
    })),
  };

  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);

  // Map assetId → current qty for estimating upcoming dividend totals
  const positionQtyMap = new Map<number, number>(
    rawPositions.map((p) => [p.assetId, p.quantityOnHand])
  );

  const upcomingDividends = await prisma.dividend.findMany({
    where: { payDate: { gte: now, lte: in14Days } },
    include: { asset: { select: { name: true, currency: true } } },
    orderBy: { payDate: "asc" },
  });

  const past14Days = new Date(now);
  past14Days.setDate(past14Days.getDate() - 14);

  // Recent dividends joined with realized_profits to get actual total payout
  const rawRecentDividends = await prisma.$queryRaw<RawRecentDividend[]>`
    SELECT
      d.id,
      a.name        AS asset_name,
      a.currency    AS asset_currency,
      d.ex_date,
      d.pay_date,
      d.value,
      d.currency,
      SUM((rp.amount).amount)             AS total_amount,
      MIN(TRIM((rp.amount).currency))     AS total_currency
    FROM dividends d
    JOIN assets a ON d.asset_id = a.id
    LEFT JOIN realized_profits rp
      ON rp.dividend_id = d.id AND rp.user_id = ${userId}
    WHERE d.pay_date >= ${past14Days} AND d.pay_date <= ${now}
    GROUP BY d.id, a.name, a.currency, d.ex_date, d.pay_date, d.value, d.currency
    ORDER BY d.pay_date DESC
  `;

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

  const allUpcoming = await Promise.all(
    upcomingDividends.map(async (d) => {
      const qty = positionQtyMap.get(d.assetId) ?? 0;
      const rawTotal = qty * parseDecimal(d.value);
      const totalAmount =
        rawTotal > 0
          ? await convertAmount(rawTotal, d.currency, userCurrency)
          : null;
      return {
        id: d.id,
        assetName: d.asset.name,
        assetCurrency: d.asset.currency,
        exDate: formatDate(d.exDate),
        payDate: d.payDate ? formatDate(d.payDate) : null,
        value: parseDecimal(d.value),
        currency: d.currency,
        totalAmount,
      };
    })
  );
  const serializedUpcoming = allUpcoming.filter((d) => d.totalAmount !== null);

  const allRecent = await Promise.all(
    rawRecentDividends.map(async (d) => {
      const rawTotal =
        d.total_amount !== null ? parseDecimal(d.total_amount) : null;
      const totalAmount =
        rawTotal !== null && rawTotal > 0
          ? await convertAmount(
              rawTotal,
              d.total_currency ?? d.currency,
              userCurrency
            )
          : null;
      return {
        id: Number(d.id),
        assetName: d.asset_name,
        assetCurrency: d.asset_currency,
        exDate: formatDate(d.ex_date),
        payDate: d.pay_date ? formatDate(d.pay_date) : null,
        value: parseDecimal(d.value),
        currency: d.currency,
        totalAmount,
      };
    })
  );
  const serializedRecent = allRecent.filter((d) => d.totalAmount !== null);

  return (
    <DashboardClient
      positions={serializedPositions}
      totalPortfolioValue={totalPortfolioValue}
      userCurrency={userCurrency}
      portfolioCharts={portfolioCharts}
      investmentAllocation={investmentAllocation}
      dividendChartData={dividendChartData}
      upcomingDividends={serializedUpcoming}
      recentDividends={serializedRecent}
      snapshots={serializedSnapshots}
    />
  );
}
