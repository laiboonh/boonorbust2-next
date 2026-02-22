import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import PortfoliosClient from "./PortfoliosClient";

export const dynamic = "force-dynamic";

async function createPortfolio(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) return;

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const tagIds = formData.getAll("tagIds").map(Number);

  const portfolio = await prisma.portfolio.create({
    data: {
      name,
      description: description || null,
      userId: session.user.id,
      portfolioTags: tagIds.length
        ? { create: tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
  });

  revalidatePath("/portfolios");
  return portfolio;
}

async function updatePortfolio(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) return;

  const id = Number(formData.get("id"));
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const tagIds = formData.getAll("tagIds").map(Number);

  await prisma.portfolioTag.deleteMany({ where: { portfolioId: id } });
  await prisma.portfolio.update({
    where: { id, userId: session.user.id },
    data: {
      name,
      description: description || null,
      portfolioTags: tagIds.length
        ? { create: tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
  });

  revalidatePath("/portfolios");
}

async function deletePortfolio(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) return;

  const id = Number(formData.get("id"));
  await prisma.portfolio.delete({
    where: { id, userId: session.user.id },
  });
  revalidatePath("/portfolios");
}

export default async function PortfoliosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const [portfolios, tags] = await Promise.all([
    prisma.portfolio.findMany({
      where: { userId: session.user.id },
      include: {
        portfolioTags: { include: { tag: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.tag.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <PortfoliosClient
      portfolios={portfolios}
      tags={tags}
      createPortfolio={createPortfolio}
      updatePortfolio={updatePortfolio}
      deletePortfolio={deletePortfolio}
    />
  );
}
