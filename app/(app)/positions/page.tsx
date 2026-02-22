import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLatestPositions } from "@/lib/positions";
import { parseDecimal, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import PositionsClient from "./PositionsClient";

export const dynamic = "force-dynamic";

export default async function PositionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const latestPositions = await getLatestPositions(userId);

  // Build enriched position data
  const enriched = await Promise.all(
    latestPositions.map(async (pos) => {
      const assetId = pos.assetId;

      // Fetch asset with tags
      const assetWithTags = await prisma.asset.findUnique({
        where: { id: assetId },
        include: {
          assetTags: {
            include: { tag: true },
          },
        },
      });

      const currentPrice = assetWithTags?.price
        ? parseDecimal(assetWithTags.price)
        : null;
      const priceCurrency = assetWithTags?.priceCurrency ?? pos.amountOnHandCurrency;

      const avgPrice = parseDecimal(pos.averagePrice);
      const qty = parseDecimal(pos.quantityOnHand);
      const unrealizedProfit =
        currentPrice !== null ? (currentPrice - avgPrice) * qty : null;

      // Fetch all historical portfolio positions for this asset (full transaction history)
      const history = await prisma.portfolioPosition.findMany({
        where: { userId, assetId },
        include: {
          portfolioTransaction: true,
        },
        orderBy: {
          portfolioTransaction: { transactionDate: "asc" },
        },
      });

      const historyItems = history.map((h) => ({
        id: h.id,
        transactionDate: h.portfolioTransaction.transactionDate.toISOString(),
        action: h.portfolioTransaction.action,
        quantity: h.portfolioTransaction.quantity.toString(),
        price: h.portfolioTransaction.price.toString(),
        priceCurrency: h.portfolioTransaction.priceCurrency,
        commission: h.portfolioTransaction.commission.toString(),
        commissionCurrency: h.portfolioTransaction.commissionCurrency,
        quantityOnHand: h.quantityOnHand.toString(),
        averagePrice: h.averagePrice.toString(),
        averagePriceCurrency: h.averagePriceCurrency,
        amountOnHand: h.amountOnHand.toString(),
        amountOnHandCurrency: h.amountOnHandCurrency,
        notes: h.portfolioTransaction.notes,
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
