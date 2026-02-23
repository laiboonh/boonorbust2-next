"use client";

import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
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

interface PortfolioChart {
  id: number;
  name: string;
  description: string | null;
  chartData: Array<{ label: string; value: number }>;
  colorIndex: number;
}

interface AllocationEntry {
  label: string;
  value: number;
  percentage: number;
}

interface DividendChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
  }>;
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
  portfolioCharts: PortfolioChart[];
  investmentAllocation: AllocationEntry[];
  dividendChartData: DividendChartData;
  upcomingDividends: DividendEntry[];
  recentDividends: DividendEntry[];
  snapshots: Snapshot[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

// One color scheme per portfolio (rotates)
const COLOR_SCHEMES = [
  ["#059669", "#34d399", "#6ee7b7", "#a7f3d0", "#0d9488", "#2dd4bf", "#0ea5e9", "#60a5fa", "#a78bfa", "#f472b6"],
  ["#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd", "#0891b2", "#22d3ee", "#059669", "#34d399", "#8b5cf6", "#c084fc"],
  ["#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#7c3aed", "#9333ea", "#ec4899", "#f472b6", "#f59e0b", "#fbbf24"],
  ["#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#d97706", "#b45309", "#ef4444", "#f87171", "#10b981", "#34d399"],
  ["#ec4899", "#f472b6", "#f9a8d4", "#fbcfe8", "#db2777", "#be185d", "#8b5cf6", "#a78bfa", "#0ea5e9", "#38bdf8"],
];

const DIVIDEND_COLORS = [
  "#059669", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ec4899",
  "#0d9488", "#0891b2", "#7c3aed", "#d97706", "#db2777",
];


// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
      {title}
    </h2>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-gray-400 text-center py-6">{message}</p>
  );
}

// ─── Portfolio pie chart (1 per portfolio) ────────────────────────────────────

function PortfolioPieChart({
  data,
  currency,
  colorIndex,
}: {
  data: Array<{ label: string; value: number }>;
  currency: string;
  colorIndex: number;
}) {
  const colors = COLOR_SCHEMES[colorIndex % COLOR_SCHEMES.length];
  const total = data.reduce((s, d) => s + d.value, 0);
  const chartData = data.map((d, i) => ({
    name: d.label,
    value: d.value,
    fill: colors[i % colors.length],
  }));

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            />
            <Tooltip
              wrapperStyle={{ zIndex: 9999 }}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                fontSize: 12,
              }}
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
        {chartData.map((entry, index) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
          return (
            <div key={entry.name} className="flex items-center gap-1 text-xs">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: colors[index % colors.length] }}
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

// ─── Portfolio value over time (area chart) ───────────────────────────────────

function PortfolioValueChart({
  data,
  currency,
}: {
  data: Snapshot[];
  currency: string;
}) {
  if (data.length === 0) {
    return <EmptyState message="No snapshot data yet." />;
  }

  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 4, right: 10, left: 0, bottom: 40 }}
        >
          <defs>
            <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9 }}
            angle={-45}
            textAnchor="end"
            interval="preserveStartEnd"
            tickLine={false}
            height={50}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v, currency)}
            tick={{ fontSize: 9 }}
            width={70}
          />
          <Tooltip
            wrapperStyle={{ zIndex: 9999 }}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              fontSize: 12,
            }}
            formatter={(value) => [
              formatCurrency(Number(value), currency),
              "Portfolio Value",
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#059669"
            strokeWidth={2}
            fill="url(#portfolioGradient)"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Investment allocation horizontal bar chart ───────────────────────────────

function PositionsBarChart({
  data,
  currency,
}: {
  data: AllocationEntry[];
  currency: string;
}) {
  if (data.length === 0) {
    return <EmptyState message="No positions to chart." />;
  }

  const height = Math.max(150, data.length * 60);

  const tooltipStyle = {
    backgroundColor: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
    fontSize: 12,
  };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            interval={0}
            tickLine={false}
            tick={({ x, y, payload }) => {
              const label: string = payload.value ?? "";
              const truncated =
                label.length > 16 ? label.slice(0, 15) + "…" : label;
              return (
                <text
                  x={x}
                  y={y}
                  dy={4}
                  textAnchor="end"
                  fontSize={10}
                  fill="#6b7280"
                >
                  {truncated}
                </text>
              );
            }}
          />
          <Tooltip
            wrapperStyle={{ zIndex: 9999 }}
            contentStyle={tooltipStyle}
            formatter={(value, _, props) => {
              const entry = props.payload as AllocationEntry;
              return [
                `${Number(value).toFixed(2)}% — ${formatCurrency(entry.value, currency)}`,
                "Allocation",
              ];
            }}
          />
          <Bar dataKey="percentage" fill="#059669" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Dividend stacked bar chart ───────────────────────────────────────────────

function DividendsBarChart({
  data,
  currency,
}: {
  data: DividendChartData;
  currency: string;
}) {
  if (data.labels.length === 0) {
    return <EmptyState message="No dividend income data yet." />;
  }

  // Transform to Recharts format: [{ month, Asset1: val, Asset2: val, ... }]
  const chartData = data.labels.map((month, idx) => {
    const row: Record<string, number | string> = { month };
    for (const ds of data.datasets) {
      row[ds.label] = ds.data[idx] ?? 0;
    }
    return row;
  });

  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 0, right: 10, left: 0, bottom: 50 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            interval={0}
            height={60}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v, currency)}
            tick={{ fontSize: 10 }}
            width={70}
          />
          <Tooltip
            wrapperStyle={{ zIndex: 9999 }}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              formatCurrency(Number(value), currency),
              name as string,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {data.datasets.map((ds, index) => (
            <Bar
              key={ds.label}
              dataKey={ds.label}
              stackId="a"
              fill={DIVIDEND_COLORS[index % DIVIDEND_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
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
  totalPortfolioValue,
  userCurrency,
  portfolioCharts,
  investmentAllocation,
  dividendChartData,
  upcomingDividends,
  recentDividends,
  snapshots,
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

      {/* Per-portfolio pie charts */}
      {portfolioCharts.length === 0 ? (
        <section>
          <SectionHeader title="Portfolios" />
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <EmptyState message="No portfolios yet. Create a portfolio and tag your assets to see breakdowns here." />
          </div>
        </section>
      ) : (
        portfolioCharts.map((portfolio) => (
          <section key={portfolio.id}>
            <SectionHeader title={portfolio.name} />
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              {portfolio.description && (
                <p className="text-xs text-gray-400 mb-4">
                  {portfolio.description}
                </p>
              )}
              <PortfolioPieChart
                data={portfolio.chartData}
                currency={userCurrency}
                colorIndex={portfolio.colorIndex}
              />
            </div>
          </section>
        ))
      )}

      {/* Portfolio value over time */}
      {snapshots.length > 0 && (
        <section>
          <SectionHeader title="Portfolio Value Over Time" />
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-3">Last 90 days</p>
            <PortfolioValueChart data={snapshots} currency={userCurrency} />
          </div>
        </section>
      )}

      {/* Investment allocation horizontal bar chart */}
      <section>
        <SectionHeader title="Investment Allocation" />
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-3">
            Percentage of total portfolio value
          </p>
          <PositionsBarChart
            data={investmentAllocation}
            currency={userCurrency}
          />
        </div>
      </section>

      {/* Dividend income stacked bar chart */}
      <section>
        <SectionHeader title="Dividend Income by Asset" />
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-3">Last 12 months</p>
          <DividendsBarChart
            data={dividendChartData}
            currency={userCurrency}
          />
        </div>
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
