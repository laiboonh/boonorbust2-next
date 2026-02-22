"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── Asset CRUD ───────────────────────────────────────────────────────────────

export async function createAsset(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const currency = (formData.get("currency") as string | null)?.trim() ?? "SGD";
  const priceUrl = (formData.get("priceUrl") as string | null)?.trim() || null;
  const dividendUrl =
    (formData.get("dividendUrl") as string | null)?.trim() || null;
  const distributesDividends = formData.get("distributesDividends") === "on";
  const withholdingRaw = (
    formData.get("dividendWithholdingTax") as string | null
  )?.trim();
  const dividendWithholdingTax =
    withholdingRaw && withholdingRaw !== ""
      ? parseFloat(withholdingRaw) / 100
      : null;

  if (!name || !currency) {
    throw new Error("Name and currency are required.");
  }

  await prisma.asset.create({
    data: {
      name,
      currency,
      priceUrl,
      dividendUrl,
      distributesDividends,
      dividendWithholdingTax,
    },
  });

  revalidatePath("/assets");
}

export async function updateAsset(
  id: number,
  formData: FormData
): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const currency = (formData.get("currency") as string | null)?.trim() ?? "SGD";
  const priceUrl = (formData.get("priceUrl") as string | null)?.trim() || null;
  const dividendUrl =
    (formData.get("dividendUrl") as string | null)?.trim() || null;
  const distributesDividends = formData.get("distributesDividends") === "on";
  const withholdingRaw = (
    formData.get("dividendWithholdingTax") as string | null
  )?.trim();
  const dividendWithholdingTax =
    withholdingRaw && withholdingRaw !== ""
      ? parseFloat(withholdingRaw) / 100
      : null;

  if (!name || !currency) {
    throw new Error("Name and currency are required.");
  }

  await prisma.asset.update({
    where: { id },
    data: {
      name,
      currency,
      priceUrl,
      dividendUrl,
      distributesDividends,
      dividendWithholdingTax,
    },
  });

  revalidatePath("/assets");
}

export async function deleteAsset(id: number): Promise<void> {
  await prisma.asset.delete({ where: { id } });
  revalidatePath("/assets");
}

// ─── Tag management ───────────────────────────────────────────────────────────

export async function addTagToAsset(
  assetId: number,
  tagName: string,
  userId: string
): Promise<void> {
  const trimmed = tagName.trim();
  if (!trimmed) return;

  // Find or create the tag scoped to this user
  const tag = await prisma.tag.upsert({
    where: { userId_name: { userId, name: trimmed } },
    create: { name: trimmed, userId },
    update: {},
  });

  // Create AssetTag if it doesn't already exist
  await prisma.assetTag.upsert({
    where: { assetId_tagId_userId: { assetId, tagId: tag.id, userId } },
    create: { assetId, tagId: tag.id, userId },
    update: {},
  });

  revalidatePath("/assets");
}

export async function removeTagFromAsset(
  assetId: number,
  tagId: number,
  userId: string
): Promise<void> {
  await prisma.assetTag.deleteMany({
    where: { assetId, tagId, userId },
  });

  revalidatePath("/assets");
}
