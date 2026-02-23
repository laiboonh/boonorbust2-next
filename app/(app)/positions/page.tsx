import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLatestPositions } from "@/lib/positions";
import { parseDecimal, formatDate } from "@/lib/utils";
import PositionsClient from "./PositionsClient";

export const dynamic = "force-dynamic";

interface RawHistoryItem {
  pp_id: number;
  asset_id: unknown;
  transaction_date: Date;
  action: string;
  quantity: unknown;
  price_amount: unknown;
  price_currency: string;
  commission_amount: unknown;
  commission_currency: string;
  quantity_on_hand: unknown;
  average_price_amount: unknown;
  average_price_currency: string;
  amount_on_hand_amount: unknown;
  amount_on_hand_currency: string;
  notes: string | null;
}

interface RawRealizedDetail {
  id: unknown;
  asset_id: unknown;
  portfolio_transaction_id: unknown;
  dividend_id: unknown;
  rp_amount: unknown;
  rp_currency: string;
  // trade fields
  transaction_date: Date | null;
  sell_price: unknown;
  sell_price_currency: string | null;
  qty_sold: unknown;
  // dividend fields
  ex_date: Date | null;
  pay_date: Date | null;
  dividend_per_share: unknown;
  dividend_currency: string | null;
}

export default async function PositionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const latestPositions = await getLatestPositions(userId);
  if (latestPositions.length === 0) return <PositionsClient positions={[]} />;

  const assetIds = latestPositions.map((p) => p.assetId);

  // History (portfolio positions) for each held asset
  const allHistory = await prisma.$queryRaw<RawHistoryItem[]>`
    SELECT
      pp.id            AS pp_id,
      pp.asset_id,
      pt.transaction_date,
      pt.action,
      pt.quantity,
      pt.notes,
      (pt.price).amount              AS price_amount,
      TRIM((pt.price).currency)      AS price_currency,
      (pt.commission).amount         AS commission_amount,
      TRIM((pt.commission).currency) AS commission_currency,
      pp.quantity_on_hand,
      (pp.average_price).amount          AS average_price_amount,
      TRIM((pp.average_price).currency)  AS average_price_currency,
      (pp.amount_on_hand).amount         AS amount_on_hand_amount,
      TRIM((pp.amount_on_hand).currency) AS amount_on_hand_currency
    FROM portfolio_positions pp
    JOIN portfolio_transactions pt ON pp.portfolio_transaction_id = pt.id
    WHERE pp.user_id = ${userId}
      AND pp.asset_id = ANY(${assetIds}::int[])
    ORDER BY pp.asset_id, pt.transaction_date ASC
  `;

  const historyByAsset = new Map<number, RawHistoryItem[]>();
  for (const row of allHistory) {
    const id = Number(row.asset_id);
    if (!historyByAsset.has(id)) historyByAsset.set(id, []);
    historyByAsset.get(id)!.push(row);
  }

  // Detailed realized profits (trades + dividends) for all assets
  const rawRealized = await prisma.$queryRaw<RawRealizedDetail[]>`
    SELECT
      rp.id,
      rp.asset_id,
      rp.portfolio_transaction_id,
      rp.dividend_id,
      (rp.amount).amount          AS rp_amount,
      TRIM((rp.amount).currency)  AS rp_currency,
      pt.transaction_date,
      (pt.price).amount           AS sell_price,
      TRIM((pt.price).currency)   AS sell_price_currency,
      pt.quantity                 AS qty_sold,
      d.ex_date,
      d.pay_date,
      d.value                     AS dividend_per_share,
      d.currency                  AS dividend_currency
    FROM realized_profits rp
    LEFT JOIN portfolio_transactions pt ON rp.portfolio_transaction_id = pt.id
    LEFT JOIN dividends d ON rp.dividend_id = d.id
    WHERE rp.user_id = ${userId}
    ORDER BY rp.asset_id,
             COALESCE(pt.transaction_date, d.pay_date) DESC NULLS LAST
  `;

  // Group realized details by asset_id
  const realizedByAsset = new Map<
    number,
    Array<{
      id: number;
      type: "trade" | "dividend";
      amount: number;
      currency: string;
      // trade
      tradeDate: string | null;
      sellPrice: number | null;
      sellPriceCurrency: string | null;
      qtySold: number | null;
      // dividend
      exDate: string | null;
      payDate: string | null;
      dividendPerShare: number | null;
      dividendCurrency: string | null;
    }>
  >();

  for (const r of rawRealized) {
    const assetId = Number(r.asset_id);
    if (!realizedByAsset.has(assetId)) realizedByAsset.set(assetId, []);
    realizedByAsset.get(assetId)!.push({
      id: Number(r.id),
      type: r.dividend_id !== null ? "dividend" : "trade",
      amount: parseDecimal(r.rp_amount),
      currency: r.rp_currency,
      tradeDate: r.transaction_date ? formatDate(r.transaction_date) : null,
      sellPrice: r.sell_price !== null ? parseDecimal(r.sell_price) : null,
      sellPriceCurrency: r.sell_price_currency,
      qtySold: r.qty_sold !== null ? parseDecimal(r.qty_sold) : null,
      exDate: r.ex_date ? formatDate(r.ex_date) : null,
      payDate: r.pay_date ? formatDate(r.pay_date) : null,
      dividendPerShare:
        r.dividend_per_share !== null ? parseDecimal(r.dividend_per_share) : null,
      dividendCurrency: r.dividend_currency,
    });
  }

  const enriched = latestPositions.map((pos) => {
    const currentPrice = pos.asset.price;
    const priceCurrency = pos.asset.priceCurrency ?? pos.amountOnHandCurrency;
    const avgPrice = pos.averagePrice;
    const qty = pos.quantityOnHand;
    const unrealizedProfit =
      currentPrice !== null ? (currentPrice - avgPrice) * qty : null;

    const realizedEntries = realizedByAsset.get(pos.assetId) ?? [];
    const tradeEntries = realizedEntries.filter((e) => e.type === "trade");
    const totalRealized = tradeEntries.reduce((s, e) => s + e.amount, 0);
    const realizedCurrency =
      tradeEntries[0]?.currency ?? priceCurrency;

    const history = (historyByAsset.get(pos.assetId) ?? []).map((h) => ({
      id: Number(h.pp_id),
      transactionDate: h.transaction_date.toISOString(),
      action: h.action,
      quantity: String(h.quantity),
      price: String(h.price_amount),
      priceCurrency: h.price_currency,
      commission: String(h.commission_amount),
      commissionCurrency: h.commission_currency,
      quantityOnHand: String(h.quantity_on_hand),
      averagePrice: String(h.average_price_amount),
      averagePriceCurrency: h.average_price_currency,
      amountOnHand: String(h.amount_on_hand_amount),
      amountOnHandCurrency: h.amount_on_hand_currency,
      notes: h.notes,
    }));

    return {
      assetId: pos.assetId,
      assetName: pos.asset.name,
      tags: pos.asset.assetTags.map((at) => ({ id: at.tag.id, name: at.tag.name })),
      qty: qty.toString(),
      avgPrice: avgPrice.toString(),
      avgPriceCurrency: pos.averagePriceCurrency,
      currentPrice: currentPrice !== null ? currentPrice.toString() : null,
      priceCurrency,
      unrealizedProfit: unrealizedProfit !== null ? unrealizedProfit.toString() : null,
      realizedProfit: tradeEntries.length > 0 ? totalRealized.toString() : null,
      realizedCurrency,
      realizedDetails: realizedEntries,
      history,
    };
  });

  return <PositionsClient positions={enriched} />;
}
