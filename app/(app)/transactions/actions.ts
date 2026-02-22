"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculatePositionsForAsset } from "@/lib/positions";
import { revalidatePath } from "next/cache";
import Papa from "papaparse";

function revalidateAll() {
  revalidatePath("/transactions");
  revalidatePath("/positions");
  revalidatePath("/dashboard");
}

export async function createTransaction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const userId = session.user.id;

  const assetName = (formData.get("assetName") as string).trim();
  const action = (formData.get("action") as string).toLowerCase();
  const quantity = parseFloat(formData.get("quantity") as string);
  const price = parseFloat(formData.get("price") as string);
  const currency = (formData.get("currency") as string) || "SGD";
  const commission = parseFloat((formData.get("commission") as string) || "0");
  const transactionDate = new Date(formData.get("transactionDate") as string);
  const notes = (formData.get("notes") as string) || null;

  const amount =
    action === "buy" ? price * quantity + commission : price * quantity - commission;

  let asset = await prisma.asset.findUnique({ where: { name: assetName } });
  if (!asset) {
    asset = await prisma.asset.create({
      data: { name: assetName, currency, priceCurrency: currency },
    });
  }

  await prisma.$executeRaw`
    INSERT INTO portfolio_transactions
      (user_id, asset_id, action, quantity, price, commission, amount, transaction_date, notes, updated_at)
    VALUES (
      ${userId}, ${asset.id}, ${action}, ${quantity},
      ROW(${price}::numeric, ${currency}::bpchar)::money_with_currency,
      ROW(${commission}::numeric, ${currency}::bpchar)::money_with_currency,
      ROW(${amount}::numeric, ${currency}::bpchar)::money_with_currency,
      ${transactionDate}, ${notes}, NOW()
    )
  `;

  await recalculatePositionsForAsset(asset.id, userId);
  revalidateAll();
}

export async function updateTransaction(id: number, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const userId = session.user.id;

  const assetName = (formData.get("assetName") as string).trim();
  const action = (formData.get("action") as string).toLowerCase();
  const quantity = parseFloat(formData.get("quantity") as string);
  const price = parseFloat(formData.get("price") as string);
  const currency = (formData.get("currency") as string) || "SGD";
  const commission = parseFloat((formData.get("commission") as string) || "0");
  const transactionDate = new Date(formData.get("transactionDate") as string);
  const notes = (formData.get("notes") as string) || null;

  const amount =
    action === "buy" ? price * quantity + commission : price * quantity - commission;

  let asset = await prisma.asset.findUnique({ where: { name: assetName } });
  if (!asset) {
    asset = await prisma.asset.create({
      data: { name: assetName, currency, priceCurrency: currency },
    });
  }

  await prisma.$executeRaw`
    UPDATE portfolio_transactions SET
      asset_id         = ${asset.id},
      action           = ${action},
      quantity         = ${quantity},
      price            = ROW(${price}::numeric, ${currency}::bpchar)::money_with_currency,
      commission       = ROW(${commission}::numeric, ${currency}::bpchar)::money_with_currency,
      amount           = ROW(${amount}::numeric, ${currency}::bpchar)::money_with_currency,
      transaction_date = ${transactionDate},
      notes            = ${notes},
      updated_at       = NOW()
    WHERE id = ${id} AND user_id = ${userId}
  `;

  await recalculatePositionsForAsset(asset.id, userId);
  revalidateAll();
}

export async function deleteTransaction(id: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const userId = session.user.id;

  const tx = await prisma.portfolioTransaction.findFirst({ where: { id, userId } });
  if (!tx) throw new Error("Transaction not found");

  await prisma.portfolioTransaction.delete({ where: { id } });
  await recalculatePositionsForAsset(tx.assetId, userId);
  revalidateAll();
}

interface CsvRow {
  Stock?: string;
  Action?: string;
  Quantity?: string;
  Price?: string;
  Commission?: string;
  Date?: string;
  Currency?: string;
  Notes?: string;
}

export async function importCSV(
  formData: FormData
): Promise<{ success: number; errors: string[] }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const userId = session.user.id;

  const file = formData.get("file") as File;
  if (!file) return { success: 0, errors: ["No file provided"] };

  const text = await file.text();
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  let success = 0;
  const errors: string[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const rowNum = i + 2;

    try {
      const assetName = row.Stock?.trim();
      if (!assetName) { errors.push(`Row ${rowNum}: Missing Stock name`); continue; }

      const action = (row.Action?.trim() ?? "").toLowerCase();
      if (action !== "buy" && action !== "sell") {
        errors.push(`Row ${rowNum}: Action must be buy or sell, got "${row.Action}"`);
        continue;
      }

      const quantity = parseFloat(row.Quantity ?? "");
      if (isNaN(quantity) || quantity <= 0) {
        errors.push(`Row ${rowNum}: Invalid quantity "${row.Quantity}"`);
        continue;
      }

      const price = parseFloat(row.Price ?? "");
      if (isNaN(price) || price < 0) {
        errors.push(`Row ${rowNum}: Invalid price "${row.Price}"`);
        continue;
      }

      const commission = parseFloat(row.Commission ?? "0") || 0;
      const currency = row.Currency?.trim() || "SGD";
      const notes = row.Notes?.trim() || null;

      const rawDate = row.Date?.trim();
      if (!rawDate) { errors.push(`Row ${rowNum}: Missing Date`); continue; }
      const transactionDate = new Date(rawDate);
      if (isNaN(transactionDate.getTime())) {
        errors.push(`Row ${rowNum}: Invalid date "${rawDate}"`);
        continue;
      }

      const amount =
        action === "buy" ? price * quantity + commission : price * quantity - commission;

      let asset = await prisma.asset.findUnique({ where: { name: assetName } });
      if (!asset) {
        asset = await prisma.asset.create({
          data: { name: assetName, currency, priceCurrency: currency },
        });
      }

      await prisma.$executeRaw`
        INSERT INTO portfolio_transactions
          (user_id, asset_id, action, quantity, price, commission, amount, transaction_date, notes, updated_at)
        VALUES (
          ${userId}, ${asset.id}, ${action}, ${quantity},
          ROW(${price}::numeric, ${currency}::bpchar)::money_with_currency,
          ROW(${commission}::numeric, ${currency}::bpchar)::money_with_currency,
          ROW(${amount}::numeric, ${currency}::bpchar)::money_with_currency,
          ${transactionDate}, ${notes}, NOW()
        )
      `;

      await recalculatePositionsForAsset(asset.id, userId);
      success++;
    } catch (err) {
      errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  revalidateAll();
  return { success, errors };
}
