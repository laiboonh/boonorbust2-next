import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, parseDecimal } from "@/lib/utils";
import AssetsClient from "./AssetsClient";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const userId = session.user.id;

  // Fetch all assets that have at least one assetTag for this user,
  // plus assets with no assetTags at all (global assets the user may want to see).
  // Strategy: fetch ALL assets and include assetTags filtered by this user.
  const assets = await prisma.asset.findMany({
    include: {
      assetTags: {
        where: { userId },
        include: { tag: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Serialize for client (Decimal -> number, Date -> string)
  const serialized = assets.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    price: a.price !== null ? parseDecimal(a.price) : null,
    priceCurrency: a.priceCurrency,
    priceUrl: a.priceUrl ?? "",
    dividendUrl: a.dividendUrl ?? "",
    distributesDividends: a.distributesDividends,
    dividendWithholdingTax:
      a.dividendWithholdingTax !== null
        ? parseDecimal(a.dividendWithholdingTax) * 100
        : null,
    priceUpdatedAt: a.priceUpdatedAt ? formatDate(a.priceUpdatedAt) : null,
    tags: a.assetTags.map((at) => ({ id: at.tag.id, name: at.tag.name })),
  }));

  return (
    <AssetsClient
      assets={serialized}
      userId={userId}
    />
  );
}
