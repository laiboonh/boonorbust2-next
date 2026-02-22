import { prisma } from "@/lib/prisma";
import { parseDecimal } from "@/lib/utils";

interface RawTransaction {
  id: number;
  user_id: string;
  asset_id: number;
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
}

interface RawPosition {
  id: number;
  user_id: string;
  asset_id: number;
  portfolio_transaction_id: number;
  average_price_amount: unknown;
  average_price_currency: string;
  quantity_on_hand: unknown;
  amount_on_hand_amount: unknown;
  amount_on_hand_currency: string;
}

export interface PositionWithAsset {
  id: number;
  assetId: number;
  amountOnHand: number;
  amountOnHandCurrency: string;
  averagePrice: number;
  averagePriceCurrency: string;
  quantityOnHand: number;
  asset: {
    id: number;
    name: string;
    currency: string;
    price: number | null;
    priceCurrency: string | null;
    priceUpdatedAt: Date | null;
    assetTags: Array<{ userId: string | null; tag: { id: number; name: string } }>;
  };
}

/**
 * Recalculates and upserts portfolio positions for all transactions of an asset.
 * Uses running average cost basis algorithm.
 */
export async function recalculatePositionsForAsset(
  assetId: number,
  userId: string
): Promise<void> {
  const transactions = await prisma.$queryRaw<RawTransaction[]>`
    SELECT
      id, user_id, asset_id, action, quantity, transaction_date, notes,
      (price).amount            AS price_amount,
      TRIM((price).currency)    AS price_currency,
      (commission).amount       AS commission_amount,
      TRIM((commission).currency) AS commission_currency,
      (amount).amount           AS amount_amount,
      TRIM((amount).currency)   AS amount_currency
    FROM portfolio_transactions
    WHERE asset_id = ${assetId} AND user_id = ${userId}
    ORDER BY transaction_date ASC
  `;

  let avgPrice = 0;
  let qtyOnHand = 0;
  const currency =
    transactions[0]?.amount_currency || transactions[0]?.price_currency || "SGD";

  for (const tx of transactions) {
    const qty = parseDecimal(tx.quantity);
    const price = parseDecimal(tx.price_amount);
    const commission = parseDecimal(tx.commission_amount);

    if (tx.action === "buy") {
      const totalCost = price * qty + commission;
      const newQty = qtyOnHand + qty;
      avgPrice = newQty > 0 ? (avgPrice * qtyOnHand + totalCost) / newQty : 0;
      qtyOnHand = newQty;
    } else {
      const realizedProfit = (price - avgPrice) * qty - commission;
      qtyOnHand = Math.max(0, qtyOnHand - qty);

      await prisma.$executeRaw`
        INSERT INTO realized_profits (user_id, asset_id, portfolio_transaction_id, amount, updated_at)
        VALUES (
          ${userId}, ${assetId}, ${tx.id},
          ROW(${realizedProfit}::numeric, ${tx.amount_currency}::bpchar)::money_with_currency,
          NOW()
        )
        ON CONFLICT (portfolio_transaction_id) DO UPDATE SET
          amount     = ROW(${realizedProfit}::numeric, ${tx.amount_currency}::bpchar)::money_with_currency,
          updated_at = NOW()
      `;
    }

    const amountOnHand = avgPrice * qtyOnHand;

    await prisma.$executeRaw`
      INSERT INTO portfolio_positions (
        user_id, asset_id, portfolio_transaction_id,
        average_price, quantity_on_hand, amount_on_hand, updated_at
      )
      VALUES (
        ${userId}, ${assetId}, ${tx.id},
        ROW(${avgPrice}::numeric, ${currency}::bpchar)::money_with_currency,
        ${qtyOnHand},
        ROW(${amountOnHand}::numeric, ${currency}::bpchar)::money_with_currency,
        NOW()
      )
      ON CONFLICT (portfolio_transaction_id) DO UPDATE SET
        average_price    = ROW(${avgPrice}::numeric, ${currency}::bpchar)::money_with_currency,
        quantity_on_hand = ${qtyOnHand},
        amount_on_hand   = ROW(${amountOnHand}::numeric, ${currency}::bpchar)::money_with_currency,
        updated_at       = NOW()
    `;
  }
}

/**
 * Returns the latest portfolio position for each asset held by the user.
 */
export async function getLatestPositions(userId: string): Promise<PositionWithAsset[]> {
  const rawPositions = await prisma.$queryRaw<RawPosition[]>`
    SELECT
      pp.id, pp.user_id, pp.asset_id, pp.portfolio_transaction_id, pp.quantity_on_hand,
      (pp.average_price).amount         AS average_price_amount,
      TRIM((pp.average_price).currency) AS average_price_currency,
      (pp.amount_on_hand).amount        AS amount_on_hand_amount,
      TRIM((pp.amount_on_hand).currency) AS amount_on_hand_currency
    FROM portfolio_positions pp
    JOIN portfolio_transactions pt ON pp.portfolio_transaction_id = pt.id
    WHERE pp.user_id = ${userId}
    ORDER BY pt.transaction_date DESC
  `;

  console.log("[positions] rawPositions count:", rawPositions.length);
  if (rawPositions.length > 0) {
    const sample = rawPositions[0];
    console.log("[positions] sample row:", {
      asset_id: sample.asset_id,
      quantity_on_hand: sample.quantity_on_hand,
      average_price_amount: sample.average_price_amount,
      amount_on_hand_amount: sample.amount_on_hand_amount,
    });
  }

  const seen = new Set<number>();
  const latest: RawPosition[] = [];
  for (const pos of rawPositions) {
    if (!seen.has(pos.asset_id) && parseDecimal(pos.quantity_on_hand) > 0) {
      seen.add(pos.asset_id);
      latest.push(pos);
    }
  }

  console.log("[positions] latest (qty>0) count:", latest.length);

  if (latest.length === 0) return [];

  const assetIds = latest.map((p) => Number(p.asset_id));
  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    include: { assetTags: { include: { tag: true } } },
  });
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  return latest
    .map((pos) => {
      const asset = assetMap.get(pos.asset_id);
      if (!asset) return null;
      return {
        id: Number(pos.id),
        assetId: Number(pos.asset_id),
        amountOnHand: parseDecimal(pos.amount_on_hand_amount),
        amountOnHandCurrency: pos.amount_on_hand_currency,
        averagePrice: parseDecimal(pos.average_price_amount),
        averagePriceCurrency: pos.average_price_currency,
        quantityOnHand: parseDecimal(pos.quantity_on_hand),
        asset: {
          id: asset.id,
          name: asset.name,
          currency: asset.currency,
          price: asset.price ? parseDecimal(asset.price) : null,
          priceCurrency: asset.priceCurrency,
          priceUpdatedAt: asset.priceUpdatedAt,
          assetTags: asset.assetTags.map((at) => ({
            userId: at.userId,
            tag: { id: at.tag.id, name: at.tag.name },
          })),
        },
      };
    })
    .filter(Boolean) as PositionWithAsset[];
}
