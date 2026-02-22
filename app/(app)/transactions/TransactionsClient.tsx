"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition, useRef } from "react";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  importCSV,
} from "./actions";
import { formatDate, formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SerializedTransaction {
  id: number;
  action: string;
  quantity: string;
  price: string;
  priceCurrency: string;
  commission: string;
  commissionCurrency: string;
  amount: string;
  amountCurrency: string;
  transactionDate: string;
  notes: string | null;
  asset: { id: number; name: string; currency: string };
}

interface Props {
  transactions: SerializedTransaction[];
  assetNames: string[];
  page: number;
  totalPages: number;
  filter: string;
}

// ─── Currency options ─────────────────────────────────────────────────────────

const CURRENCIES = ["SGD", "USD", "HKD", "EUR", "GBP", "AUD", "JPY", "MYR"];

// ─── Empty form state ─────────────────────────────────────────────────────────

function emptyForm() {
  return {
    assetName: "",
    action: "buy",
    quantity: "",
    price: "",
    currency: "SGD",
    commission: "0",
    transactionDate: new Date().toISOString().slice(0, 10),
    notes: "",
  };
}

// ─── Transaction form modal ────────────────────────────────────────────────────

function TransactionModal({
  open,
  onClose,
  initial,
  editId,
  assetNames,
}: {
  open: boolean;
  onClose: () => void;
  initial: ReturnType<typeof emptyForm>;
  editId: number | null;
  assetNames: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initial);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Reset form when modal opens with new initial values
  const prevOpen = useRef(false);
  if (open && !prevOpen.current) {
    prevOpen.current = true;
    // Only reset if switching between add/edit
    if (JSON.stringify(form) !== JSON.stringify(initial)) {
      setForm(initial);
      setError(null);
    }
  }
  if (!open) prevOpen.current = false;

  function handleAssetInput(value: string) {
    setForm((f) => ({ ...f, assetName: value }));
    if (value.length > 0) {
      const matches = assetNames.filter((n) =>
        n.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(matches.slice(0, 6));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));

    startTransition(async () => {
      try {
        if (editId !== null) {
          await updateTransaction(editId, fd);
        } else {
          await createTransaction(fd);
        }
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">
            {editId !== null ? "Edit Transaction" : "Add Transaction"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset name */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Asset Name
            </label>
            <input
              type="text"
              value={form.assetName}
              onChange={(e) => handleAssetInput(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              required
              placeholder="e.g. AAPL, ES3.SI"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 text-sm">
                {suggestions.map((s) => (
                  <li
                    key={s}
                    onMouseDown={() => {
                      setForm((f) => ({ ...f, assetName: s }));
                      setShowSuggestions(false);
                    }}
                    className="px-3 py-2 hover:bg-emerald-50 cursor-pointer"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Action */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Action
            </label>
            <select
              value={form.action}
              onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>

          {/* Quantity + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                required
                placeholder="100"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Price
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                required
                placeholder="3.25"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Currency + Commission */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Currency
              </label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Commission
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.commission}
                onChange={(e) =>
                  setForm((f) => ({ ...f, commission: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Transaction Date
            </label>
            <input
              type="date"
              value={form.transactionDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, transactionDate: e.target.value }))
              }
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 transition-colors"
          >
            {isPending
              ? "Saving..."
              : editId !== null
              ? "Save Changes"
              : "Add Transaction"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── CSV Import modal ──────────────────────────────────────────────────────────

function CsvImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: number;
    errors: string[];
  } | null>(null);

  function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await importCSV(fd);
      setResult(res);
      router.refresh();
    });
  }

  function handleClose() {
    setResult(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">Import CSV</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Expected columns:{" "}
          <span className="font-mono">
            Stock, Action, Quantity, Price, Commission, Date, Currency, Notes
          </span>
        </p>

        <form onSubmit={handleImport} className="space-y-4">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
          />
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {isPending ? "Importing..." : "Import"}
          </button>
        </form>

        {result && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-emerald-700 font-medium">
              {result.success} row{result.success !== 1 ? "s" : ""} imported
              successfully.
            </p>
            {result.errors.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3 text-xs text-red-700 space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export default function TransactionsClient({
  transactions,
  assetNames,
  page,
  totalPages,
  filter,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [editTarget, setEditTarget] =
    useState<SerializedTransaction | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filterValue, setFilterValue] = useState(filter);

  // Build URL with updated params
  function buildUrl(updates: Record<string, string>) {
    const params = new URLSearchParams();
    if (filterValue) params.set("filter", filterValue);
    params.set("page", String(page));
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    return `${pathname}?${params.toString()}`;
  }

  function handleFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push(buildUrl({ filter: filterValue, page: "1" }));
  }

  function openAdd() {
    setEditTarget(null);
    setModalOpen(true);
  }

  function openEdit(tx: SerializedTransaction) {
    setEditTarget(tx);
    setModalOpen(true);
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this transaction?")) return;
    setDeletingId(id);
    startTransition(async () => {
      await deleteTransaction(id);
      setDeletingId(null);
      router.refresh();
    });
  }

  const initialForm = editTarget
    ? {
        assetName: editTarget.asset.name,
        action: editTarget.action,
        quantity: editTarget.quantity,
        price: editTarget.price,
        currency: editTarget.priceCurrency,
        commission: editTarget.commission,
        transactionDate: editTarget.transactionDate.slice(0, 10),
        notes: editTarget.notes ?? "",
      }
    : emptyForm();

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Transactions</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setCsvModalOpen(true)}
            className="text-sm border border-emerald-600 text-emerald-600 rounded-lg px-3 py-1.5 hover:bg-emerald-50 transition-colors font-medium"
          >
            CSV Import
          </button>
          <button
            onClick={openAdd}
            className="text-sm bg-emerald-600 text-white rounded-lg px-3 py-1.5 hover:bg-emerald-700 transition-colors font-medium"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleFilterSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          placeholder="Search by asset name..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          className="bg-gray-100 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 transition-colors"
        >
          Search
        </button>
        {filter && (
          <button
            type="button"
            onClick={() => {
              setFilterValue("");
              router.push(pathname);
            }}
            className="text-gray-400 hover:text-gray-600 text-sm px-2"
          >
            Clear
          </button>
        )}
      </form>

      {/* Transactions list */}
      {transactions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">No transactions found.</p>
          <button
            onClick={openAdd}
            className="mt-4 text-emerald-600 text-sm underline"
          >
            Add your first transaction
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {transactions.map((tx) => {
            const qty = parseFloat(tx.quantity);
            const price = parseFloat(tx.price);
            const commission = parseFloat(tx.commission);
            const amount = parseFloat(tx.amount);

            return (
              <li
                key={tx.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Top row: asset name + action badge */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-semibold text-gray-800 text-sm truncate">
                        {tx.asset.name}
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          tx.action === "buy"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {tx.action.toUpperCase()}
                      </span>
                    </div>

                    {/* Date */}
                    <p className="text-xs text-gray-400 mb-2">
                      {formatDate(tx.transactionDate)}
                    </p>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-gray-500">
                        Qty:{" "}
                        <span className="text-gray-700 font-medium">
                          {qty.toLocaleString("en-SG")}
                        </span>
                      </span>
                      <span className="text-gray-500">
                        Price:{" "}
                        <span className="text-gray-700 font-medium">
                          {formatCurrency(price, tx.priceCurrency)}
                        </span>
                      </span>
                      <span className="text-gray-500">
                        Commission:{" "}
                        <span className="text-gray-700 font-medium">
                          {formatCurrency(commission, tx.commissionCurrency)}
                        </span>
                      </span>
                      <span className="text-gray-500">
                        Total:{" "}
                        <span className="text-gray-700 font-medium">
                          {formatCurrency(amount, tx.amountCurrency)}
                        </span>
                      </span>
                    </div>

                    {tx.notes && (
                      <p className="mt-2 text-xs text-gray-400 italic truncate">
                        {tx.notes}
                      </p>
                    )}
                  </div>

                  {/* Edit / Delete */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(tx)}
                      className="text-xs text-emerald-600 border border-emerald-200 rounded-lg px-2.5 py-1 hover:bg-emerald-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      disabled={deletingId === tx.id || isPending}
                      className="text-xs text-red-500 border border-red-200 rounded-lg px-2.5 py-1 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {deletingId === tx.id ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() =>
              router.push(buildUrl({ page: String(Math.max(1, page - 1)) }))
            }
            disabled={page <= 1}
            className="text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() =>
              router.push(
                buildUrl({ page: String(Math.min(totalPages, page + 1)) })
              )
            }
            disabled={page >= totalPages}
            className="text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Transaction modal */}
      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={initialForm}
        editId={editTarget?.id ?? null}
        assetNames={assetNames}
      />

      {/* CSV import modal */}
      <CsvImportModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
      />
    </div>
  );
}
