import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLatestPositions } from "@/lib/positions";
import { parseDecimal, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import PositionsClient from "./PositionsClient";

export const dynamic = "force-dynamic";

interface RawHistoryItem {
  id: number;
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

export default async function PositionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const latestPositions = await getLatestPositions(userId);

  const enriched = await Promise.all(
    latestPositions.map(async (pos) => {
      const assetId = pos.assetId;

      const assetWithTags = await prisma.asset.findUnique({
        where: { id: assetId },
        include: { assetTags: { include: { tag: true } } },
      });

      const currentPrice = pos.asset.price;
      const priceCurrency =
        assetWithTags?.priceCurrency ?? pos.amountOnHandCurrency;

      const avgPrice = pos.averagePrice;
      const qty = pos.quantityOnHand;
      const unrealizedProfit =
        currentPrice !== null ? (currentPrice - avgPrice) * qty : null;

      const history = await prisma.$queryRaw<RawHistoryItem[]>`
        SELECT
          pp.id,
          pt.transaction_date,
          pt.action,
          pt.quantity,
          pt.notes,
          (pt.price).amount            AS price_amount,
          TRIM((pt.price).currency)    AS price_currency,
          (pt.commission).amount       AS commission_amount,
          TRIM((pt.commission).currency) AS commission_currency,
          pp.quantity_on_hand,
          (pp.average_price).amount         AS average_price_amount,
          TRIM((pp.average_price).currency) AS average_price_currency,
          (pp.amount_on_hand).amount        AS amount_on_hand_amount,
          TRIM((pp.amount_on_hand).currency) AS amount_on_hand_currency
        FROM portfolio_positions pp
        JOIN portfolio_transactions pt ON pp.portfolio_transaction_id = pt.id
        WHERE pp.user_id = ${userId} AND pp.asset_id = ${assetId}
        ORDER BY pt.transaction_date ASC
      `;

      const historyItems = history.map((h) => ({
        id: h.id,
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
        assetId,
        assetName: pos.asset.name,
        tags: (assetWithTags?.assetTags ?? pos.asset.assetTags).map((at) => ({
          id: at.tag.id,
          name: at.tag.name,
        })),
        qty: qty.toString(),
        avgPrice: avgPrice.toString(),
        avgPriceCurrency: pos.averagePriceCurrency,
        currentPrice: currentPrice !== null ? currentPrice.toString() : null,
        priceCurrency,
        unrealizedProfit:
          unrealizedProfit !== null ? unrealizedProfit.toString() : null,
        history: historyItems,
      };
    })
  );

  return <PositionsClient positions={enriched} />;
}
