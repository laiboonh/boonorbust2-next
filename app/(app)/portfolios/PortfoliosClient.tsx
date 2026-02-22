"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Tag = { id: number; name: string };
type Portfolio = {
  id: number;
  name: string;
  description: string | null;
  portfolioTags: { tag: Tag }[];
};

interface Props {
  portfolios: Portfolio[];
  tags: Tag[];
  createPortfolio: (formData: FormData) => Promise<unknown>;
  updatePortfolio: (formData: FormData) => Promise<void>;
  deletePortfolio: (formData: FormData) => Promise<void>;
}

const TAG_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

function tagColor(name: string) {
  const idx = name.charCodeAt(0) % TAG_COLORS.length;
  return TAG_COLORS[idx];
}

export default function PortfoliosClient({
  portfolios,
  tags,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Portfolio | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  function openCreate() {
    setEditing(null);
    setSelectedTags([]);
    setModalOpen(true);
  }

  function openEdit(p: Portfolio) {
    setEditing(p);
    setSelectedTags(p.portfolioTags.map((pt) => pt.tag.id));
    setModalOpen(true);
  }

  function toggleTag(id: number) {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    selectedTags.forEach((id) => fd.append("tagIds", String(id)));
    startTransition(async () => {
      if (editing) {
        fd.append("id", String(editing.id));
        await updatePortfolio(fd);
      } else {
        await createPortfolio(fd);
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function handleDelete(id: number) {
    const fd = new FormData();
    fd.append("id", String(id));
    startTransition(async () => {
      await deletePortfolio(fd);
      setDeleteId(null);
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Portfolios</h1>
        <button
          onClick={openCreate}
          className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg font-medium active:bg-emerald-700"
        >
          + Add
        </button>
      </div>

      {portfolios.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <p className="text-4xl mb-3">🗂️</p>
          <p className="font-medium">No portfolios yet</p>
          <p className="text-sm mt-1">Create a portfolio to group your tags</p>
        </div>
      ) : (
        <div className="space-y-3">
          {portfolios.map((p) => (
            <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{p.name}</p>
                  {p.description && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {p.description}
                    </p>
                  )}
                  {p.portfolioTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.portfolioTags.map(({ tag }) => (
                        <span
                          key={tag.id}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColor(tag.name)}`}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-3">
                  <button
                    onClick={() => openEdit(p)}
                    className="text-gray-400 hover:text-emerald-600 p-1"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setDeleteId(p.id)}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-gray-800">
                {editing ? "Edit Portfolio" : "New Portfolio"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  name="name"
                  defaultValue={editing?.name ?? ""}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="e.g. Singapore Stocks"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={editing?.description ?? ""}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Optional description"
                />
              </div>
              {tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                          selectedTags.includes(tag.id)
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-gray-600 border-gray-300"
                        }`}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium disabled:opacity-50"
              >
                {isPending ? "Saving…" : editing ? "Update" : "Create"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-2">Delete Portfolio?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-200 py-2.5 rounded-xl text-gray-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={isPending}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium disabled:opacity-50"
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
