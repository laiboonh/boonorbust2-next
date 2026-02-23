"use client";

import { useState } from "react";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryItem {
  id: number;
  transactionDate: string;
  action: string;
  quantity: string;
  price: string;
  priceCurrency: string;
  commission: string;
  commissionCurrency: string;
  quantityOnHand: string;
  averagePrice: string;
  averagePriceCurrency: string;
  amountOnHand: string;
  amountOnHandCurrency: string;
  notes: string | null;
}

interface RealizedEntry {
  id: number;
  type: "trade" | "dividend";
  amount: number;
  currency: string;
  // trade
  tradeDate: string | null;
  sellPrice: number | null;
  sellPriceCurrency: string | null;
  qtySold: number | null;
  // dividend
  exDate: string | null;
  payDate: string | null;
  dividendPerShare: number | null;
  dividendCurrency: string | null;
}

interface PositionRow {
  assetId: number;
  assetName: string;
  tags: { id: number; name: string }[];
  qty: string;
  avgPrice: string;
  avgPriceCurrency: string;
  currentPrice: string | null;
  priceCurrency: string;
  unrealizedProfit: string | null;
  realizedProfit: string | null;
  realizedCurrency: string;
  realizedDetails: RealizedEntry[];
  history: HistoryItem[];
}

interface Props {
  positions: PositionRow[];
}

// ─── Shared modal shell ───────────────────────────────────────────────────────

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Positions modal (transaction history) ───────────────────────────────────

function PositionsModal({
  position,
  onClose,
}: {
  position: PositionRow;
  onClose: () => void;
}) {
  return (
    <ModalShell
      title={position.assetName}
      subtitle="Transaction history"
      onClose={onClose}
    >
      {/* Summary strip */}
      <div className="px-5 py-3 bg-emerald-50 shrink-0 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-emerald-700 font-medium">Qty on Hand</p>
          <p className="text-sm font-bold text-gray-800">
            {formatNumber(position.qty, 4)}
          </p>
        </div>
        <div>
          <p className="text-xs text-emerald-700 font-medium">Avg Price</p>
          <p className="text-sm font-bold text-gray-800">
            {formatCurrency(position.avgPrice, position.avgPriceCurrency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-emerald-700 font-medium">Unrealized P&amp;L</p>
          {position.unrealizedProfit !== null ? (
            <p
              className={`text-sm font-bold ${
                parseFloat(position.unrealizedProfit) >= 0
                  ? "text-emerald-600"
                  : "text-red-500"
              }`}
            >
              {formatCurrency(position.unrealizedProfit, position.priceCurrency)}
            </p>
          ) : (
            <p className="text-sm text-gray-400">N/A</p>
          )}
        </div>
      </div>

      {/* History rows */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {position.history.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">
            No history available.
          </p>
        ) : (
          position.history.map((h) => {
            const qty = parseFloat(h.quantity);
            const price = parseFloat(h.price);
            const qtyOnHand = parseFloat(h.quantityOnHand);
            const avgP = parseFloat(h.averagePrice);

            return (
              <div
                key={h.id}
                className="border border-gray-100 rounded-xl p-3 bg-gray-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">
                    {formatDate(h.transactionDate)}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      h.action === "buy"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {h.action.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-gray-500">
                    Qty:{" "}
                    <span className="text-gray-700 font-medium">
                      {formatNumber(qty, 4)}
                    </span>
                  </span>
                  <span className="text-gray-500">
                    Price:{" "}
                    <span className="text-gray-700 font-medium">
                      {formatCurrency(price, h.priceCurrency)}
                    </span>
                  </span>
                  <span className="text-gray-500">
                    Qty on hand:{" "}
                    <span className="text-gray-700 font-medium">
                      {formatNumber(qtyOnHand, 4)}
                    </span>
                  </span>
                  <span className="text-gray-500">
                    Avg price:{" "}
                    <span className="text-gray-700 font-medium">
                      {formatCurrency(avgP, h.averagePriceCurrency)}
                    </span>
                  </span>
                </div>
                {h.notes && (
                  <p className="mt-1.5 text-xs text-gray-400 italic">{h.notes}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </ModalShell>
  );
}

// ─── Realized profits modal ───────────────────────────────────────────────────

function RealizedProfitsModal({
  position,
  onClose,
}: {
  position: PositionRow;
  onClose: () => void;
}) {
  const trades = position.realizedDetails.filter((e) => e.type === "trade");
  const dividends = position.realizedDetails.filter((e) => e.type === "dividend");
  const totalTrades = trades.reduce((s, e) => s + e.amount, 0);
  const totalDividends = dividends.reduce((s, e) => s + e.amount, 0);
  const tradeCurrency = trades[0]?.currency ?? position.priceCurrency;
  const divCurrency = dividends[0]?.currency ?? position.priceCurrency;

  return (
    <ModalShell
      title={position.assetName}
      subtitle="Realized profits"
      onClose={onClose}
    >
      {/* Totals strip */}
      <div className="px-5 py-3 bg-emerald-50 shrink-0 grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-xs text-emerald-700 font-medium">Capital Gains</p>
          <p
            className={`text-sm font-bold ${
              totalTrades >= 0 ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {trades.length > 0
              ? formatCurrency(totalTrades, tradeCurrency)
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-emerald-700 font-medium">Dividend Income</p>
          <p className="text-sm font-bold text-emerald-600">
            {dividends.length > 0
              ? formatCurrency(totalDividends, divCurrency)
              : "—"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* Sell transactions */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Sell Transactions
          </h3>
          {trades.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No sell transactions yet.
            </p>
          ) : (
            <div className="space-y-2">
              {trades.map((t) => (
                <div
                  key={t.id}
                  className="border border-gray-100 rounded-xl p-3 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">{t.tradeDate}</span>
                    <span
                      className={`text-xs font-bold ${
                        t.amount >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {formatCurrency(t.amount, t.currency)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-500">
                    {t.sellPrice !== null && (
                      <span>
                        Sell price:{" "}
                        <span className="text-gray-700 font-medium">
                          {formatCurrency(
                            t.sellPrice,
                            t.sellPriceCurrency ?? t.currency
                          )}
                        </span>
                      </span>
                    )}
                    {t.qtySold !== null && (
                      <span>
                        Qty sold:{" "}
                        <span className="text-gray-700 font-medium">
                          {formatNumber(t.qtySold, 4)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dividend payments */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Dividend Payments
          </h3>
          {dividends.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No dividend payments recorded.
            </p>
          ) : (
            <div className="space-y-2">
              {dividends.map((d) => (
                <div
                  key={d.id}
                  className="border border-gray-100 rounded-xl p-3 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      Pay: {d.payDate ?? "—"}
                    </span>
                    <span className="text-xs font-bold text-emerald-600">
                      {formatCurrency(d.amount, d.currency)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-500">
                    <span>
                      Ex-date:{" "}
                      <span className="text-gray-700 font-medium">
                        {d.exDate ?? "—"}
                      </span>
                    </span>
                    {d.dividendPerShare !== null && (
                      <span>
                        Per share:{" "}
                        <span className="text-gray-700 font-medium">
                          {formatCurrency(
                            d.dividendPerShare,
                            d.dividendCurrency ?? d.currency
                          )}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Position card ─────────────────────────────────────────────────────────────

function PositionCard({
  position,
  onShowHistory,
  onShowRealized,
}: {
  position: PositionRow;
  onShowHistory: () => void;
  onShowRealized: () => void;
}) {
  const qty = parseFloat(position.qty);
  const avgPrice = parseFloat(position.avgPrice);
  const currentPrice =
    position.currentPrice !== null ? parseFloat(position.currentPrice) : null;
  const unrealized =
    position.unrealizedProfit !== null
      ? parseFloat(position.unrealizedProfit)
      : null;
  const unrealizedPct =
    unrealized !== null && avgPrice > 0 && qty > 0
      ? (unrealized / (avgPrice * qty)) * 100
      : null;
  const realized =
    position.realizedProfit !== null
      ? parseFloat(position.realizedProfit)
      : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">
            {position.assetName}
          </p>

          {position.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1 mb-2">
              {position.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 font-medium"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-4 text-xs text-gray-500 mt-1">
            <span>
              Qty:{" "}
              <span className="text-gray-700 font-medium">
                {formatNumber(qty, qty % 1 === 0 ? 0 : 4)}
              </span>
            </span>
            <span>
              Avg:{" "}
              <span className="text-gray-700 font-medium">
                {formatCurrency(avgPrice, position.avgPriceCurrency)}
              </span>
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          {currentPrice !== null ? (
            <>
              <p className="text-sm font-semibold text-gray-800">
                {formatCurrency(currentPrice, position.priceCurrency)}
              </p>
              <p className="text-xs text-gray-400">current</p>
            </>
          ) : (
            <p className="text-xs text-gray-400">No price</p>
          )}

          {unrealized !== null && (
            <div className="mt-1">
              <p className="text-xs text-gray-400">Unrealized</p>
              <p
                className={`text-xs font-bold ${
                  unrealized >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {unrealized >= 0 ? "+" : ""}
                {formatCurrency(unrealized, position.priceCurrency)}
              </p>
              {unrealizedPct !== null && (
                <p
                  className={`text-xs ${
                    unrealizedPct >= 0 ? "text-emerald-500" : "text-red-400"
                  }`}
                >
                  {unrealizedPct >= 0 ? "+" : ""}
                  {unrealizedPct.toFixed(2)}%
                </p>
              )}
            </div>
          )}

          {realized !== null && (
            <div className="mt-1">
              <p className="text-xs text-gray-400">Realized</p>
              <p
                className={`text-xs font-bold ${
                  realized >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {realized >= 0 ? "+" : ""}
                {formatCurrency(realized, position.realizedCurrency)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={onShowHistory}
          className="flex-1 text-xs font-medium text-gray-500 hover:text-emerald-700 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
        >
          Positions
        </button>
        <button
          onClick={onShowRealized}
          className="flex-1 text-xs font-medium text-gray-500 hover:text-emerald-700 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
        >
          Realized P&amp;L
        </button>
      </div>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export default function PositionsClient({ positions }: Props) {
  const [historyPos, setHistoryPos] = useState<PositionRow | null>(null);
  const [realizedPos, setRealizedPos] = useState<PositionRow | null>(null);

  const totalUnrealized = positions.reduce((acc, p) => {
    if (p.unrealizedProfit !== null) return acc + parseFloat(p.unrealizedProfit);
    return acc;
  }, 0);

  const hasAnyPrice = positions.some((p) => p.currentPrice !== null);

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Positions</h1>
        <span className="text-xs text-gray-400">
          {positions.length} holding{positions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {hasAnyPrice && positions.length > 0 && (
        <div
          className={`rounded-xl px-4 py-3 mb-4 text-center ${
            totalUnrealized >= 0 ? "bg-emerald-50" : "bg-red-50"
          }`}
        >
          <p className="text-xs text-gray-500 mb-0.5">Total Unrealized P&amp;L</p>
          <p
            className={`text-xl font-bold ${
              totalUnrealized >= 0 ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {totalUnrealized >= 0 ? "+" : ""}
            {formatCurrency(totalUnrealized, "SGD")}
          </p>
        </div>
      )}

      {positions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📈</p>
          <p className="text-sm">No open positions yet.</p>
          <p className="text-xs mt-1">
            Add transactions to see your positions here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {positions.map((pos) => (
            <li key={pos.assetId}>
              <PositionCard
                position={pos}
                onShowHistory={() => setHistoryPos(pos)}
                onShowRealized={() => setRealizedPos(pos)}
              />
            </li>
          ))}
        </ul>
      )}

      {historyPos && (
        <PositionsModal
          position={historyPos}
          onClose={() => setHistoryPos(null)}
        />
      )}

      {realizedPos && (
        <RealizedProfitsModal
          position={realizedPos}
          onClose={() => setRealizedPos(null)}
        />
      )}
    </div>
  );
}
