const rateCache = new Map<string, { rates: Record<string, number>; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getExchangeRates(
  baseCurrency: string
): Promise<Record<string, number>> {
  const cached = rateCache.get(baseCurrency);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rates;
  }

  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    return {};
  }

  try {
    const res = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const rates: Record<string, number> = data.conversion_rates ?? {};
    rateCache.set(baseCurrency, { rates, fetchedAt: Date.now() });
    return rates;
  } catch {
    return {};
  }
}

export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) return amount;
  const rates = await getExchangeRates(fromCurrency);
  const rate = rates[toCurrency];
  if (!rate) return amount;
  return amount * rate;
}
