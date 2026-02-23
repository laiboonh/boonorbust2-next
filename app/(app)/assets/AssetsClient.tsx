"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import {
  createAsset,
  updateAsset,
  deleteAsset,
  addTagToAsset,
  removeTagFromAsset,
} from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tag {
  id: number;
  name: string;
}

interface Asset {
  id: number;
  name: string;
  currency: string;
  price: number | null;
  priceCurrency: string | null;
  priceUrl: string;
  dividendUrl: string;
  distributesDividends: boolean;
  dividendWithholdingTax: number | null;
  priceUpdatedAt: string | null;
  tags: Tag[];
}

interface DividendItem {
  id: number;
  exDate: string;
  payDate: string | null;
  value: number;
  currency: string;
}

interface Props {
  assets: Asset[];
  userId: string;
  dividendsByAsset: Record<number, DividendItem[]>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCY_OPTIONS = ["SGD", "USD", "EUR", "HKD", "AUD", "GBP"];

const TAG_CHIP_COLORS = [
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-amber-100 text-amber-800",
  "bg-pink-100 text-pink-800",
  "bg-teal-100 text-teal-800",
  "bg-orange-100 text-orange-800",
  "bg-indigo-100 text-indigo-800",
];

function tagChipColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return TAG_CHIP_COLORS[hash % TAG_CHIP_COLORS.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TagChip({
  name,
  onRemove,
}: {
  name: string;
  onRemove?: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${tagChipColor(name)}`}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="hover:opacity-70 focus:outline-none ml-0.5 leading-none"
          aria-label={`Remove tag ${name}`}
        >
          &times;
        </button>
      )}
    </span>
  );
}

// ─── Asset form modal ─────────────────────────────────────────────────────────

interface AssetFormModalProps {
  editAsset: Asset | null;
  onClose: () => void;
  onSaved: () => void;
}

function AssetFormModal({ editAsset, onClose, onSaved }: AssetFormModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const isEditing = editAsset !== null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        if (isEditing) {
          await updateAsset(editAsset.id, formData);
        } else {
          await createAsset(formData);
        }
        onSaved();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {isEditing ? "Edit Asset" : "Add Asset"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={editAsset?.name ?? ""}
              placeholder="e.g. Apple Inc"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency <span className="text-red-500">*</span>
            </label>
            <select
              name="currency"
              required
              defaultValue={editAsset?.currency ?? "SGD"}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Price URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price URL{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              name="priceUrl"
              defaultValue={editAsset?.priceUrl ?? ""}
              placeholder="https://..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Dividend URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dividend URL{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              name="dividendUrl"
              defaultValue={editAsset?.dividendUrl ?? ""}
              placeholder="https://..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Distributes dividends */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="distributesDividends"
              id="distributesDividends"
              defaultChecked={editAsset?.distributesDividends ?? false}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            <label
              htmlFor="distributesDividends"
              className="text-sm font-medium text-gray-700"
            >
              Distributes dividends
            </label>
          </div>

          {/* Withholding tax */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dividend Withholding Tax %{" "}
              <span className="text-gray-400 font-normal">(0–100, optional)</span>
            </label>
            <input
              type="number"
              name="dividendWithholdingTax"
              min="0"
              max="100"
              step="0.01"
              defaultValue={
                editAsset?.dividendWithholdingTax !== null &&
                editAsset?.dividendWithholdingTax !== undefined
                  ? editAsset.dividendWithholdingTax
                  : ""
              }
              placeholder="e.g. 15"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {isPending ? "Saving…" : isEditing ? "Save Changes" : "Add Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteConfirmModal({
  asset,
  onClose,
  onDeleted,
}: {
  asset: Asset;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteAsset(asset.id);
      onDeleted();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6">
        <h2 className="text-base font-bold text-gray-900 mb-2">
          Delete Asset
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete{" "}
          <span className="font-semibold">{asset.name}</span>? This action
          cannot be undone and will remove all associated transactions and
          positions.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dividends modal ──────────────────────────────────────────────────────────

function DividendsModal({
  assetName,
  dividends,
  onClose,
}: {
  assetName: string;
  dividends: DividendItem[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            Dividends — {assetName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          {dividends.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No dividend records found.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">
                    Ex-Date
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">
                    Pay Date
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2.5">
                    Value / Share
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">
                    Currency
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dividends.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700">{d.exDate}</td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {d.payDate ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                      {d.value.toFixed(4)}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{d.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer count */}
        <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
          <p className="text-xs text-gray-400">
            {dividends.length} record{dividends.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Tag input row ────────────────────────────────────────────────────────────

function AddTagInput({
  assetId,
  userId,
  onAdded,
}: {
  assetId: number;
  userId: string;
  onAdded: () => void;
}) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    const trimmed = value.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await addTagToAsset(assetId, trimmed, userId);
      setValue("");
      onAdded();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="flex gap-1.5 mt-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add tag…"
        disabled={isPending}
        className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
      />
      <button
        type="button"
        onClick={handleAdd}
        disabled={isPending || !value.trim()}
        className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-emerald-200 disabled:opacity-50 transition-colors"
      >
        {isPending ? "…" : "Add"}
      </button>
    </div>
  );
}

// ─── Asset card ───────────────────────────────────────────────────────────────

function AssetCard({
  asset,
  userId,
  dividends,
  onEdit,
  onDelete,
  onRefresh,
  onShowDividends,
}: {
  asset: Asset;
  userId: string;
  dividends: DividendItem[];
  onEdit: (a: Asset) => void;
  onDelete: (a: Asset) => void;
  onRefresh: () => void;
  onShowDividends: (a: Asset) => void;
}) {
  const [, startTransition] = useTransition();

  function handleRemoveTag(tagId: number) {
    startTransition(async () => {
      await removeTagFromAsset(asset.id, tagId, userId);
      onRefresh();
    });
  }

  const displayPrice =
    asset.price !== null
      ? formatCurrency(asset.price, asset.priceCurrency ?? asset.currency)
      : "—";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">{asset.name}</p>
            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {asset.currency}
            </span>
            {asset.distributesDividends && (
              <button
                type="button"
                onClick={() => onShowDividends(asset)}
                className="text-xs font-medium bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded hover:bg-emerald-200 transition-colors"
              >
                Dividends ({dividends.length})
              </button>
            )}
          </div>

          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-sm font-bold text-emerald-700">
              {displayPrice}
            </span>
            {asset.priceUpdatedAt && (
              <span className="text-xs text-gray-400">
                · {asset.priceUpdatedAt}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(asset)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(asset)}
            className="text-xs border border-red-200 rounded-lg px-2.5 py-1.5 text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-3">
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {asset.tags.map((t) => (
              <TagChip
                key={t.id}
                name={t.name}
                onRemove={() => handleRemoveTag(t.id)}
              />
            ))}
          </div>
        )}
        <AddTagInput
          assetId={asset.id}
          userId={userId}
          onAdded={onRefresh}
        />
      </div>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export default function AssetsClient({ assets, userId, dividendsByAsset }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [deleteAsset_, setDeleteAsset] = useState<Asset | null>(null);
  const [dividendsAsset, setDividendsAsset] = useState<Asset | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  function openAdd() {
    setEditAsset(null);
    setModalOpen(true);
  }

  function openEdit(asset: Asset) {
    setEditAsset(asset);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditAsset(null);
  }

  // Filter
  const lowerSearch = search.toLowerCase();
  const filtered = assets.filter((a) => {
    if (!lowerSearch) return true;
    if (a.name.toLowerCase().includes(lowerSearch)) return true;
    if (a.tags.some((t) => t.name.toLowerCase().includes(lowerSearch)))
      return true;
    return false;
  });

  return (
    <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-gray-900">Assets</h1>
        <button
          type="button"
          onClick={openAdd}
          className="bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm flex-shrink-0"
        >
          + Add Asset
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or tag…"
          className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400">
        {filtered.length} of {assets.length} asset
        {assets.length !== 1 ? "s" : ""}
      </p>

      {/* Asset list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">
            {assets.length === 0
              ? "No assets yet. Add your first asset above."
              : "No assets match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              userId={userId}
              dividends={dividendsByAsset[asset.id] ?? []}
              onEdit={openEdit}
              onDelete={setDeleteAsset}
              onRefresh={refresh}
              onShowDividends={setDividendsAsset}
            />
          ))}
        </div>
      )}

      {/* Asset form modal */}
      {modalOpen && (
        <AssetFormModal
          editAsset={editAsset}
          onClose={closeModal}
          onSaved={refresh}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteAsset_ && (
        <DeleteConfirmModal
          asset={deleteAsset_}
          onClose={() => setDeleteAsset(null)}
          onDeleted={refresh}
        />
      )}

      {/* Dividends modal */}
      {dividendsAsset && (
        <DividendsModal
          assetName={dividendsAsset.name}
          dividends={dividendsByAsset[dividendsAsset.id] ?? []}
          onClose={() => setDividendsAsset(null)}
        />
      )}
    </div>
  );
}
