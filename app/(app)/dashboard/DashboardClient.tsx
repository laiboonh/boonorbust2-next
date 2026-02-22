"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tag {
  id: number;
  name: string;
}

interface Position {
  id: number;
  assetId: number;
  assetName: string;
  assetCurrency: string;
  tags: Tag[];
  quantityOnHand: number;
  convertedAmountOnHand: number;
  convertedAvgPrice: number;
  convertedCurrentPrice: number;
  unrealizedProfit: number;
  currentValue: number;
  priceUpdatedAt: string | null;
}

interface TagAllocation {
  name: string;
  value: number;
}

interface DividendEntry {
  id: number;
  assetName: string;
  assetCurrency: string;
  exDate: string;
  payDate: string | null;
  value: number;
  currency: string;
}

interface Snapshot {
  date: string;
  value: number;
  currency: string;
}

interface Props {
  positions: Position[];
  totalPortfolioValue: number;
  userCurrency: string;
  tagAllocation: TagAllocation[];
  upcomingDividends: DividendEntry[];
  recentDividends: DividendEntry[];
  snapshots: Snapshot[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  "#059669", // emerald-600
  "#34d399", // emerald-400
  "#6ee7b7", // emerald-300
  "#a7f3d0", // emerald-200
  "#0d9488", // teal-600
  "#2dd4bf", // teal-400
  "#0ea5e9", // sky-500
  "#60a5fa", // blue-400
  "#a78bfa", // violet-400
  "#f472b6", // pink-400
];

// Deterministic color per tag name
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

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
      {title}
    </h2>
  );
}

function TagChip({ name }: { name: string }) {
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${tagChipColor(name)}`}
    >
      {name}
    </span>
  );
}

function PnLBadge({ value, currency }: { value: number; currency: string }) {
  const positive = value >= 0;
  return (
    <span
      className={`text-xs font-semibold ${positive ? "text-emerald-600" : "text-red-500"}`}
    >
      {positive ? "+" : ""}
      {formatCurrency(value, currency)}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-gray-400 text-center py-6">{message}</p>
  );
}

// ─── Donut chart with center label ────────────────────────────────────────────

function AllocationChart({
  data,
  currency,
}: {
  data: TagAllocation[];
  currency: string;
}) {
  if (data.length === 0) {
    return <EmptyState message="No positions to chart." />;
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [
                formatCurrency(Number(value ?? 0), currency),
                "Value",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-gray-500">Total</span>
          <span className="text-sm font-bold text-emerald-700">
            {formatCurrency(total, currency)}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 justify-center">
        {data.map((entry, index) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
          return (
            <div key={entry.name} className="flex items-center gap-1 text-xs">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
              />
              <span className="text-gray-700">
                {entry.name}{" "}
                <span className="text-gray-400">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Position card ────────────────────────────────────────────────────────────

function PositionCard({
  pos,
  currency,
}: {
  pos: Position;
  currency: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">
            {pos.assetName}
          </p>
          {pos.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {pos.tags.map((t) => (
                <TagChip key={t.id} name={t.name} />
              ))}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-emerald-700 text-sm">
            {formatCurrency(pos.currentValue, currency)}
          </p>
          <PnLBadge value={pos.unrealizedProfit} currency={currency} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
        <div>
          <span className="text-gray-400">Avg price</span>
          <p className="text-gray-700 font-medium">
            {formatCurrency(pos.convertedAvgPrice, currency)}
          </p>
        </div>
        <div>
          <span className="text-gray-400">Current price</span>
          <p className="text-gray-700 font-medium">
            {formatCurrency(pos.convertedCurrentPrice, currency)}
          </p>
        </div>
        <div>
          <span className="text-gray-400">Qty on hand</span>
          <p className="text-gray-700 font-medium">
            {pos.quantityOnHand.toLocaleString("en-SG", {
              maximumFractionDigits: 6,
            })}
          </p>
        </div>
        <div>
          <span className="text-gray-400">Cost basis</span>
          <p className="text-gray-700 font-medium">
            {formatCurrency(pos.convertedAmountOnHand, currency)}
          </p>
        </div>
      </div>

      {pos.priceUpdatedAt && (
        <p className="mt-2 text-xs text-gray-400">
          Price updated {pos.priceUpdatedAt}
        </p>
      )}
    </div>
  );
}

// ─── Dividend card ────────────────────────────────────────────────────────────

function DividendCard({ div }: { div: DividendEntry }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">
          {div.assetName}
        </p>
        <div className="flex gap-3 mt-1 text-xs text-gray-500">
          <span>
            Ex-date:{" "}
            <span className="text-gray-700 font-medium">{div.exDate}</span>
          </span>
          {div.payDate && (
            <span>
              Pay-date:{" "}
              <span className="text-gray-700 font-medium">{div.payDate}</span>
            </span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-emerald-700">
          {formatCurrency(div.value, div.currency)}
        </p>
        <p className="text-xs text-gray-400">{div.currency}</p>
      </div>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export default function DashboardClient({
  positions,
  totalPortfolioValue,
  userCurrency,
  tagAllocation,
  upcomingDividends,
  recentDividends,
  // snapshots available for future sparkline use
}: Props) {
  return (
    <div className="px-4 py-5 space-y-6 max-w-lg mx-auto">
      {/* Total portfolio value */}
      <div className="bg-emerald-600 rounded-2xl p-5 text-white text-center shadow-md">
        <p className="text-emerald-200 text-xs uppercase tracking-widest mb-1">
          Portfolio Value
        </p>
        <p className="text-4xl font-extrabold tracking-tight">
          {formatCurrency(totalPortfolioValue, userCurrency)}
        </p>
        <p className="text-emerald-300 text-xs mt-1">{userCurrency}</p>
      </div>

      {/* Allocation donut */}
      <section>
        <SectionHeader title="Allocation by Tag" />
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <AllocationChart data={tagAllocation} currency={userCurrency} />
        </div>
      </section>

      {/* Positions list */}
      <section>
        <SectionHeader title={`Positions (${positions.length})`} />
        {positions.length === 0 ? (
          <EmptyState message="No open positions. Add transactions to get started." />
        ) : (
          <div className="space-y-3">
            {positions.map((pos) => (
              <PositionCard key={pos.id} pos={pos} currency={userCurrency} />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming dividends */}
      <section>
        <SectionHeader title="Upcoming Dividends (14 days)" />
        {upcomingDividends.length === 0 ? (
          <EmptyState message="No upcoming dividends in the next 14 days." />
        ) : (
          <div className="space-y-3">
            {upcomingDividends.map((d) => (
              <DividendCard key={d.id} div={d} />
            ))}
          </div>
        )}
      </section>

      {/* Recent dividends */}
      <section>
        <SectionHeader title="Recent Dividends (14 days)" />
        {recentDividends.length === 0 ? (
          <EmptyState message="No dividends paid in the past 14 days." />
        ) : (
          <div className="space-y-3">
            {recentDividends.map((d) => (
              <DividendCard key={d.id} div={d} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
