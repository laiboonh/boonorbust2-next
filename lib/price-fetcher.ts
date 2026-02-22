/**
 * Fetches the current price for an asset given its price URL.
 * Supports multiple price sources by URL pattern matching.
 */
export async function fetchPrice(
  priceUrl: string
): Promise<{ price: number; currency: string } | null> {
  try {
    if (priceUrl.includes("alphavantage.co")) {
      return fetchAlphaVantagePrice(priceUrl);
    }
    if (priceUrl.includes("marketstack.com")) {
      return fetchMarketstackPrice(priceUrl);
    }
    // Generic HTML scraping fallback
    return null;
  } catch {
    return null;
  }
}

async function fetchAlphaVantagePrice(
  url: string
): Promise<{ price: number; currency: string } | null> {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  if (!apiKey) return null;

  // Extract symbol from URL or use URL as symbol directly
  const symbolMatch = url.match(/symbol=([A-Z.]+)/i);
  if (!symbolMatch) return null;
  const symbol = symbolMatch[1];

  const res = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const quote = data["Global Quote"];
  if (!quote || !quote["05. price"]) return null;

  return { price: parseFloat(quote["05. price"]), currency: "USD" };
}

async function fetchMarketstackPrice(
  url: string
): Promise<{ price: number; currency: string } | null> {
  const apiKey = process.env.PRICE_API_ACCESS_KEY;
  if (!apiKey) return null;

  const symbolMatch = url.match(/symbols=([A-Z.]+)/i);
  if (!symbolMatch) return null;
  const symbol = symbolMatch[1];

  const res = await fetch(
    `https://api.marketstack.com/v1/eod/latest?access_key=${apiKey}&symbols=${symbol}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const eod = data?.data?.[0];
  if (!eod?.close) return null;

  return { price: eod.close, currency: "USD" };
}
