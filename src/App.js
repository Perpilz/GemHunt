import { useState } from "react";

// ============================================================
// CONFIGURATION
// Replace YOUR_APP_ID with your eBay App ID (not the OAuth token)
// The App ID looks like: YourName-AppName-PRD-xxxxxxx-xxxxxxxx
// ============================================================
const EBAY_APP_ID = "michaelb-Gradex-SBX-a1addb012-492aec1a";

// Set to true to use realistic demo data (no API needed)
const DEMO_MODE = false;

// ============================================================
// GRADING OPTIONS
// ============================================================
const GRADING_OPTIONS = [
  { label: "PSA 10 (Gem Mint)", value: "PSA 10" },
  { label: "PSA 9 (Mint)", value: "PSA 9" },
  { label: "PSA 8 (Near Mint)", value: "PSA 8" },
  { label: "BGS 10 (Pristine)", value: "BGS 10" },
  { label: "BGS 9.5 (Gem Mint)", value: "BGS 9.5" },
  { label: "BGS 9 (Mint)", value: "BGS 9" },
  { label: "CGC 10 (Pristine)", value: "CGC 10" },
  { label: "CGC 9.5 (Gem Mint)", value: "CGC 9.5" },
  { label: "CGC 9 (Mint)", value: "CGC 9" },
  { label: "Raw (Ungraded)", value: "Raw" },
];

// ============================================================
// HELPERS
// ============================================================
function formatPrice(amount, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function getSavingColor(pct) {
  if (pct >= 10) return "#22c55e";
  if (pct >= 0) return "#facc15";
  return "#f87171";
}

function getSavingLabel(pct) {
  if (pct >= 10) return `Save ${pct.toFixed(1)}%`;
  if (pct >= 0) return `${pct.toFixed(1)}% below avg`;
  return `${Math.abs(pct).toFixed(1)}% above avg`;
}

// ============================================================
// MOCK DATA
// ============================================================
function getMockData(cardName, grade) {
  const basePrice =
    grade === "PSA 10" ? 320 :
    grade === "PSA 9" ? 180 :
    grade === "BGS 10" ? 480 :
    grade === "BGS 9.5" ? 290 :
    grade === "CGC 10" ? 300 :
    grade === "Raw" ? 45 : 160;

  const variation = () => basePrice * (0.75 + Math.random() * 0.5);

  const soldItems = Array.from({ length: 10 }, (_, i) => ({
    id: `sold-${i}`,
    title: `${cardName} ${grade} Pokemon Card`,
    price: Math.round(variation() * 100) / 100,
    currency: "GBP",
    soldDate: new Date(Date.now() - i * 2.5 * 24 * 60 * 60 * 1000).toISOString(),
  }));

  const avgPrice = soldItems.reduce((s, i) => s + i.price, 0) / soldItems.length;

  const liveListings = [
    { id: "l1", title: `${cardName} ${grade} Pokemon Card Graded`, price: Math.round(avgPrice * 0.76 * 100) / 100, currency: "GBP", url: "https://ebay.co.uk", seller: "cardmaster_uk", buyingOption: "FIXED_PRICE", condition: "Used" },
    { id: "l2", title: `${cardName} ${grade} Graded Pokemon TCG`, price: Math.round(avgPrice * 0.88 * 100) / 100, currency: "GBP", url: "https://ebay.co.uk", seller: "pokevault99", buyingOption: "FIXED_PRICE", condition: "Used" },
    { id: "l3", title: `${cardName} Pokemon ${grade} Slab`, price: Math.round(avgPrice * 0.94 * 100) / 100, currency: "GBP", url: "https://ebay.co.uk", seller: "slabdeals_uk", buyingOption: "AUCTION", condition: "Used" },
    { id: "l4", title: `${cardName} ${grade} Graded Card`, price: Math.round(avgPrice * 1.02 * 100) / 100, currency: "GBP", url: "https://ebay.co.uk", seller: "gemhunter", buyingOption: "FIXED_PRICE", condition: "Used" },
    { id: "l5", title: `${cardName} ${grade} Pokemon Card Mint`, price: Math.round(avgPrice * 1.11 * 100) / 100, currency: "GBP", url: "https://ebay.co.uk", seller: "pokecollect_gb", buyingOption: "FIXED_PRICE", condition: "Used" },
    { id: "l6", title: `${cardName} ${grade} TCG Card`, price: Math.round(avgPrice * 1.18 * 100) / 100, currency: "GBP", url: "https://ebay.co.uk", seller: "rarecardsuk", buyingOption: "FIXED_PRICE", condition: "Used" },
  ];

  return { soldItems, liveListings, avgPrice };
}

// ============================================================
// EBAY FINDING API (live data)
// Uses JSONP-style approach via a proxy for CORS
// ============================================================
async function fetchEbayData(cardName, grade) {
  const keyword = `${cardName} ${grade} pokemon card`;

  // Sold listings
   const soldUrl = `http://localhost:3001/sold?keyword=${encodeURIComponent(keyword)}`;
    

  // Live listings
 const liveUrl = `http://localhost:3001/live?keyword=${encodeURIComponent(keyword)}`;
   

  const [soldRes, liveRes] = await Promise.all([
    fetch(soldUrl),
    fetch(liveUrl),
  ]);

  const soldData = await soldRes.json();
  const liveData = await liveRes.json();

  const soldItems = (
    soldData?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []
  ).map((item) => ({
    id: item.itemId?.[0],
    title: item.title?.[0],
    price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0),
    currency: item.sellingStatus?.[0]?.currentPrice?.[0]?.["@currencyId"] || "GBP",
    soldDate: item.listingInfo?.[0]?.endTime?.[0],
    url: item.viewItemURL?.[0],
  })).filter(i => i.price > 0);

  const liveListings = (
    liveData?.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || []
  ).map((item) => ({
    id: item.itemId?.[0],
    title: item.title?.[0],
    price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0),
    currency: item.sellingStatus?.[0]?.currentPrice?.[0]?.["@currencyId"] || "GBP",
    url: item.viewItemURL?.[0],
    seller: item.sellerInfo?.[0]?.sellerUserName?.[0],
    buyingOption: item.listingInfo?.[0]?.listingType?.[0],
    condition: item.condition?.[0]?.conditionDisplayName?.[0],
  })).filter(i => i.price > 0).sort((a, b) => a.price - b.price);

  const avgPrice = soldItems.length > 0
    ? soldItems.reduce((s, i) => s + i.price, 0) / soldItems.length
    : 0;

  return { soldItems, liveListings, avgPrice };
}

// ============================================================
// COMPONENTS
// ============================================================
function SavingsBadge({ pct }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: 700,
      color: pct >= 10 ? "#052e16" : pct >= 0 ? "#1c1917" : "#1c1917",
      background: getSavingColor(pct),
      letterSpacing: "0.02em",
      whiteSpace: "nowrap",
    }}>
      {getSavingLabel(pct)}
    </span>
  );
}

function ListingCard({ listing, avgPrice, index }) {
  const saving = avgPrice > 0
    ? ((avgPrice - listing.price) / avgPrice) * 100
    : 0;
  const isBargain = saving >= 10;

  return (
    <a
      href={listing.url || "https://ebay.co.uk"}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        textDecoration: "none",
        background: isBargain
          ? "rgba(34,197,94,0.07)"
          : "rgba(255,255,255,0.03)",
        border: isBargain
          ? "1px solid rgba(34,197,94,0.25)"
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius: "14px",
        padding: "14px 16px",
        marginBottom: "10px",
        transition: "transform 0.15s",
        cursor: "pointer",
      }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateX(4px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateX(0)"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", color: "#a1a1aa", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {listing.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "22px", fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>
              {formatPrice(listing.price, listing.currency)}
            </span>
            {listing.buyingOption === "Auction" || listing.buyingOption === "AUCTION" ? (
              <span style={{ fontSize: "11px", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)", borderRadius: "4px", padding: "1px 6px" }}>
                AUCTION
              </span>
            ) : null}
          </div>
          {listing.seller && (
            <div style={{ fontSize: "11px", color: "#52525b", marginTop: "4px" }}>
              Seller: {listing.seller}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
          <SavingsBadge pct={saving} />
          <span style={{ fontSize: "11px", color: "#52525b" }}>
            avg {formatPrice(avgPrice, listing.currency)}
          </span>
        </div>
      </div>
    </a>
  );
}

function SoldRow({ item, index }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "9px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      fontSize: "13px",
    }}>
      <span style={{ color: "#71717a" }}>
        Sale {index + 1} &mdash;{" "}
        {item.soldDate
          ? new Date(item.soldDate).toLocaleDateString("en-GB")
          : "Recent"}
      </span>
      <span style={{ color: "#e4e4e7", fontWeight: 600 }}>
        {formatPrice(item.price, item.currency)}
      </span>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [cardName, setCardName] = useState("");
  const [grade, setGrade] = useState("PSA 10");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showSold, setShowSold] = useState(false);

  const isConfigured = EBAY_APP_ID !== "YOUR_APP_ID_HERE";

  async function handleSearch(e) {
    e.preventDefault();
    if (!cardName.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setShowSold(false);

    try {
      let soldItems, liveListings, avgPrice;

      if (DEMO_MODE || !isConfigured) {
        await new Promise(r => setTimeout(r, 1400));
        const mock = getMockData(cardName.trim(), grade);
        soldItems = mock.soldItems;
        liveListings = mock.liveListings;
        avgPrice = mock.avgPrice;
      } else {
        const data = await fetchEbayData(cardName.trim(), grade);
        soldItems = data.soldItems;
        liveListings = data.liveListings;
        avgPrice = data.avgPrice;
      }

      setResults({ soldItems, liveListings, avgPrice, cardName: cardName.trim(), grade });
    } catch (err) {
      setError("Could not fetch eBay data. Check your App ID and try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const bestDeal = results?.liveListings?.[0];
  const bestSaving = bestDeal && results.avgPrice > 0
    ? ((results.avgPrice - bestDeal.price) / results.avgPrice) * 100
    : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#09090b",
      color: "#e4e4e7",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "24px 20px 60px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <div style={{
            width: "38px", height: "38px", borderRadius: "10px",
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "20px",
          }}>⚡</div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "24px", fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>
            GemHunt
          </span>
        </div>
        <p style={{ fontSize: "13px", color: "#52525b", marginBottom: "28px" }}>
          Find the best deal on graded Pokémon cards on eBay
        </p>

        {/* Mode banner */}
        {(DEMO_MODE || !isConfigured) && (
          <div style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "12px",
            color: "#f59e0b",
            marginBottom: "20px",
            lineHeight: "1.5",
          }}>
            ⚡ Demo mode — showing realistic sample data. To go live, set your eBay App ID at the top of App.js and set <code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 4px", borderRadius: "3px" }}>DEMO_MODE = false</code>
          </div>
        )}

        {/* Search form */}
        <form onSubmit={handleSearch}>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ fontSize: "11px", color: "#71717a", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Card Name
            </label>
            <input
              type="text"
              value={cardName}
              onChange={e => setCardName(e.target.value)}
              placeholder="e.g. Charizard VMAX, Umbreon VMAX, Pikachu"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                padding: "14px 16px",
                fontSize: "15px",
                color: "#fff",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "'DM Sans', sans-serif",
              }}
              onFocus={e => e.target.style.borderColor = "rgba(99,102,241,0.6)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "11px", color: "#71717a", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Grading
            </label>
            <select
              value={grade}
              onChange={e => setGrade(e.target.value)}
              style={{
                width: "100%",
                background: "#18181b",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                padding: "14px 16px",
                fontSize: "15px",
                color: "#fff",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer",
              }}
            >
              {GRADING_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !cardName.trim()}
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: "12px",
              border: "none",
              background: loading || !cardName.trim()
                ? "rgba(99,102,241,0.3)"
                : "linear-gradient(135deg, #6366f1, #a855f7)",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 600,
              cursor: loading || !cardName.trim() ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "🔍 Scanning eBay..." : "Find Best Deal"}
          </button>
        </form>

        {error && (
          <div style={{ marginTop: "16px", padding: "12px 16px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "10px", fontSize: "13px", color: "#f87171" }}>
            {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div style={{ marginTop: "32px" }}>

            {/* Summary */}
            <div style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: "16px",
              padding: "20px",
              marginBottom: "24px",
            }}>
              <div style={{ fontSize: "11px", color: "#a78bfa", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                {results.cardName} · {results.grade}
              </div>
              <div style={{ display: "flex", gap: "28px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#71717a", marginBottom: "3px" }}>
                    Avg sold (last {results.soldItems.length} sales)
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#fff" }}>
                    {formatPrice(results.avgPrice)}
                  </div>
                </div>
                {bestDeal && (
                  <div>
                    <div style={{ fontSize: "11px", color: "#71717a", marginBottom: "3px" }}>
                      Best deal now
                    </div>
                    <div style={{ fontSize: "28px", fontWeight: 800, fontFamily: "'Syne', sans-serif", color: bestSaving >= 0 ? "#22c55e" : "#f87171" }}>
                      {formatPrice(bestDeal.price)}
                    </div>
                  </div>
                )}
              </div>
              {bestDeal && (
                <div style={{ marginTop: "12px", fontSize: "13px", color: bestSaving >= 10 ? "#22c55e" : bestSaving >= 0 ? "#facc15" : "#f87171" }}>
                  {bestSaving >= 10
                    ? `🟢 Best listing is ${bestSaving.toFixed(1)}% below average — great deal`
                    : bestSaving >= 0
                    ? `🟡 Best listing is ${bestSaving.toFixed(1)}% below average`
                    : `🔴 Cheapest listing is ${Math.abs(bestSaving).toFixed(1)}% above average — market may be rising`}
                </div>
              )}
            </div>

            {/* Live listings */}
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "12px", color: "#fff" }}>
              Live Listings — Best Value First
            </h2>
            {results.liveListings.length === 0 ? (
              <div style={{ color: "#52525b", fontSize: "13px", padding: "20px 0" }}>
                No listings found. Try a different card name or grade.
              </div>
            ) : (
              results.liveListings.slice(0, 10).map((listing, i) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  avgPrice={results.avgPrice}
                  index={i}
                />
              ))
            )}

            {/* Sold history */}
            <button
              onClick={() => setShowSold(!showSold)}
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                padding: "11px 16px",
                color: "#71717a",
                fontSize: "13px",
                cursor: "pointer",
                width: "100%",
                fontFamily: "'DM Sans', sans-serif",
                marginTop: "8px",
                marginBottom: "8px",
              }}
            >
              {showSold ? "▲ Hide" : "▼ Show"} last {results.soldItems.length} sold prices
            </button>

            {showSold && (
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "12px",
                padding: "4px 16px 4px",
              }}>
                {results.soldItems.map((item, i) => (
                  <SoldRow key={item.id} item={item} index={i} />
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 8px", fontSize: "13px", fontWeight: 700 }}>
                  <span style={{ color: "#a1a1aa" }}>Average</span>
                  <span style={{ color: "#fff" }}>{formatPrice(results.avgPrice)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}