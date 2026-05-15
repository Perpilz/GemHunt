import { useState, useEffect, useRef } from "react";

// ============================================================
// CONFIGURATION
// ============================================================
const EBAY_APP_ID = "michaelb-Gradex-PRD-2183f64d5-81b310ff";
const DEMO_MODE = false; // Set to false when eBay API is working

// ============================================================
// GRADING OPTIONS
// ============================================================
const GRADING_OPTIONS = [
  { label: "PSA 10 — Gem Mint", value: "PSA 10" },
  { label: "PSA 9 — Mint", value: "PSA 9" },
  { label: "PSA 8 — Near Mint", value: "PSA 8" },
  { label: "BGS 10 — Pristine", value: "BGS 10" },
  { label: "BGS 9.5 — Gem Mint", value: "BGS 9.5" },
  { label: "BGS 9 — Mint", value: "BGS 9" },
  { label: "CGC 10 — Pristine", value: "CGC 10" },
  { label: "CGC 9.5 — Gem Mint", value: "CGC 9.5" },
  { label: "CGC 9 — Mint", value: "CGC 9" },
  { label: "Raw — Ungraded", value: "Raw" },
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
  if (pct >= 10) return "#4ade80";
  if (pct >= 0) return "#fbbf24";
  return "#f87171";
}

function getSavingLabel(pct) {
  if (pct >= 10) return `Save ${pct.toFixed(1)}%`;
  if (pct >= 0) return `${pct.toFixed(1)}% below avg`;
  return `${Math.abs(pct).toFixed(1)}% above avg`;
}

// ============================================================
// POKÉTCG API
// ============================================================
async function searchPokemonCards(query) {
  if (!query || query.length < 2) return [];
  const res = await fetch(
    `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(query)}"&pageSize=24&orderBy=set.releaseDate`
  );
  const data = await res.json();
  return data.data || [];
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
    { id: "l1", title: `${cardName} ${grade} Pokemon Card Graded`, price: Math.round(avgPrice * 0.76 * 100) / 100, currency: "GBP", url: "https://ebay.co.uk", seller: "cardmaster_uk", buyingOption: "FIXED_PRICE" },
    { id: "l2", title: `${cardName} ${grade} Graded Pokemon TCG`, price: Math.round(avgPrice * 0.88 * 100) / 100, currency: "GBP", url: "https://ebay.co.uk", seller: "pokevault99", buyingOption: "FIXED_PRICE" },
    { id: "l3", title: `${cardName} Pokemon ${grade} Slab`, price: Math.round(avgPrice * 0.94 * 100) / 100, currency: "GBP", url: "https://ebay.co.uk", seller: "slabdeals_uk", buyingOption: "Auction" },
    { id: "l4", title: `${cardName} ${grade} Graded Card`, price: Math.round(avgPrice * 1.02 * 100) / 100, currency: "GBP", url: "https://ebay.co.uk", seller: "gemhunter", buyingOption: "FIXED_PRICE" },
    { id: "l5", title: `${cardName} ${grade} Pokemon Card Mint`, price: Math.round(avgPrice * 1.11 * 100) / 100, currency: "GBP", url: "https://ebay.co.uk", seller: "pokecollect_gb", buyingOption: "FIXED_PRICE" },
    { id: "l6", title: `${cardName} ${grade} TCG Card`, price: Math.round(avgPrice * 1.19 * 100) / 100, currency: "GBP", url: "https://ebay.co.uk", seller: "rarecardsuk", buyingOption: "FIXED_PRICE" },
  ];

  return { soldItems, liveListings, avgPrice };
}

// ============================================================
// EBAY API
// ============================================================
async function fetchEbayData(cardName, cardNumber, setName, grade) {
  const keyword = cardNumber
    ? `${cardName} ${cardNumber} ${grade} pokemon card`
    : `${cardName} ${grade} pokemon card`;

  const res = await fetch(
  `http://localhost:3001/combined-market?keyword=${encodeURIComponent(keyword)}&grade=${encodeURIComponent(grade)}&cardId=${encodeURIComponent(cardNumber || '')}`
);
  const data = await res.json();

  const mapItem = (item) => ({
    id: item.id,
    title: item.title,
    price: item.price,
    currency: item.currency || "GBP",
    url: item.url,
    seller: item.seller,
    buyingOption: item.buyingOption,
    condition: item.condition,
  });

  const liveListings = (data.listings || []).map(mapItem);
  const avgPrice = data.combinedAvg || data.liveMiddleAvg || 0;
  const soldItems = liveListings.slice(0, 10);

  return { soldItems, liveListings, avgPrice };
}

// ============================================================
// STYLES
// ============================================================
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=DM+Sans:wght@300;400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0a0a0f;
    color: #e8e8f0;
    font-family: 'DM Sans', sans-serif;
  }

  .app {
    min-height: 100vh;
    background: #0a0a0f;
    position: relative;
    overflow-x: hidden;
  }

  .bg-glow {
    position: fixed;
    top: -200px;
    left: 50%;
    transform: translateX(-50%);
    width: 800px;
    height: 400px;
    background: radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .container {
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 20px 80px;
    position: relative;
    z-index: 1;
  }

  .header { margin-bottom: 36px; }
  .logo { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
  .logo-icon {
    width: 42px; height: 42px; border-radius: 12px;
    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; box-shadow: 0 0 20px rgba(99,102,241,0.4);
  }
  .logo-text {
    font-family: 'Unbounded', sans-serif;
    font-size: 22px; font-weight: 900;
    letter-spacing: -0.03em; color: #fff;
  }
  .logo-sub { font-size: 13px; color: #4a4a6a; margin-left: 54px; }

  .step-label {
    font-size: 10px; font-weight: 500; letter-spacing: 0.12em;
    text-transform: uppercase; color: #4a4a6a; margin-bottom: 8px;
    display: flex; align-items: center; gap: 8px;
  }
  .step-label::after {
    content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.05);
  }

  .search-wrap { position: relative; margin-bottom: 8px; }
  .search-input {
    width: 100%; padding: 16px 48px 16px 18px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; font-size: 15px; color: #fff;
    font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  }
  .search-input:focus {
    border-color: rgba(99,102,241,0.5);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
  }
  .search-input::placeholder { color: #3a3a5a; }
  .search-icon {
    position: absolute; right: 16px; top: 50%;
    transform: translateY(-50%); color: #3a3a5a; font-size: 18px;
    pointer-events: none;
  }

  .card-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 10px; margin-bottom: 20px; margin-top: 10px;
  }
  @media (max-width: 480px) {
    .card-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .poke-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; padding: 10px;
    cursor: pointer; transition: all 0.2s;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
  }
  .poke-card:hover {
    border-color: rgba(99,102,241,0.4);
    background: rgba(99,102,241,0.06);
    transform: translateY(-2px);
  }
  .poke-card img { width: 100%; max-width: 90px; height: auto; border-radius: 6px; }
  .poke-card-name { font-size: 11px; font-weight: 500; color: #c0c0e0; text-align: center; line-height: 1.3; }
  .poke-card-number { font-size: 10px; color: #4a4a6a; text-align: center; }
  .poke-card-set { font-size: 9px; color: #3a3a5a; text-align: center; }

  .selected-card {
    display: flex; align-items: center; gap: 14px;
    background: rgba(99,102,241,0.08);
    border: 1px solid rgba(99,102,241,0.25);
    border-radius: 14px; padding: 12px 16px; margin-bottom: 16px;
  }
  .selected-card img { width: 52px; border-radius: 6px; }
  .selected-card-info { flex: 1; }
  .selected-card-name { font-size: 14px; font-weight: 500; color: #fff; }
  .selected-card-meta { font-size: 12px; color: #6366f1; margin-top: 2px; }
  .change-btn {
    background: none; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 6px 12px; color: #6a6a8a;
    font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif;
    transition: all 0.2s;
  }
  .change-btn:hover { border-color: rgba(255,255,255,0.2); color: #fff; }

  .grade-select {
    width: 100%; padding: 14px 18px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; font-size: 15px; color: #fff;
    font-family: 'DM Sans', sans-serif;
    outline: none; cursor: pointer; margin-bottom: 16px;
    transition: border-color 0.2s;
  }
  .grade-select:focus { border-color: rgba(99,102,241,0.5); }

  .search-btn {
    width: 100%; padding: 16px;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    border: none; border-radius: 14px;
    color: #fff; font-size: 15px; font-weight: 500;
    font-family: 'Unbounded', sans-serif; letter-spacing: 0.02em;
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 4px 20px rgba(99,102,241,0.3);
  }
  .search-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(99,102,241,0.4); }
  .search-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .summary-card {
    background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1));
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: 18px; padding: 22px; margin-bottom: 24px;
  }
  .summary-tag {
    font-size: 10px; font-weight: 500; letter-spacing: 0.1em;
    text-transform: uppercase; color: #8b5cf6; margin-bottom: 14px;
    font-family: 'Unbounded', sans-serif;
  }
  .summary-prices { display: flex; gap: 32px; flex-wrap: wrap; margin-bottom: 12px; }
  .price-block label { font-size: 11px; color: #4a4a6a; display: block; margin-bottom: 3px; }
  .price-big { font-family: 'Unbounded', sans-serif; font-size: 26px; font-weight: 700; color: #fff; }
  .price-big.green { color: #4ade80; }
  .price-big.red { color: #f87171; }
  .summary-verdict { font-size: 13px; margin-top: 4px; }

  .section-title {
    font-family: 'Unbounded', sans-serif;
    font-size: 13px; font-weight: 700;
    color: #fff; margin-bottom: 14px; letter-spacing: -0.01em;
  }

  .listing-card {
    display: block; text-decoration: none;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px; padding: 14px 16px;
    margin-bottom: 8px; transition: all 0.2s; cursor: pointer;
  }
  .listing-card:hover { transform: translateX(4px); border-color: rgba(255,255,255,0.12); }
  .listing-card.bargain { background: rgba(74,222,128,0.05); border-color: rgba(74,222,128,0.2); }
  .listing-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .listing-title { font-size: 13px; color: #6a6a9a; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .listing-price { font-family: 'Unbounded', sans-serif; font-size: 18px; font-weight: 700; color: #fff; }
  .listing-seller { font-size: 11px; color: #3a3a5a; margin-top: 4px; }
  .listing-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
  .saving-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; color: #000; letter-spacing: 0.02em; white-space: nowrap; }
  .avg-label { font-size: 10px; color: #3a3a5a; }
  .auction-tag { font-size: 10px; color: #fbbf24; border: 1px solid rgba(251,191,36,0.3); border-radius: 4px; padding: 1px 6px; display: inline-block; margin-left: 6px; }

  .sold-toggle {
    width: 100%; background: none;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px; padding: 11px 16px;
    color: #4a4a6a; font-size: 12px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; margin: 8px 0; transition: all 0.2s;
  }
  .sold-toggle:hover { border-color: rgba(255,255,255,0.1); color: #8a8aaa; }

  .sold-list { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 4px 16px; }
  .sold-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; }
  .sold-row:last-child { border-bottom: none; }
  .sold-avg { display: flex; justify-content: space-between; padding: 10px 0 6px; font-size: 13px; font-weight: 600; }

  .demo-banner { background: rgba(251,191,36,0.07); border: 1px solid rgba(251,191,36,0.2); border-radius: 10px; padding: 10px 14px; font-size: 12px; color: #fbbf24; margin-bottom: 24px; line-height: 1.5; }

  .spinner { width: 32px; height: 32px; border: 2px solid rgba(99,102,241,0.2); border-top-color: #6366f1; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 12px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-box { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #f87171; margin-top: 16px; }
  .no-results { color: #3a3a5a; font-size: 13px; padding: 20px 0; }
  .searching-text { font-size: 13px; color: #4a4a6a; text-align: center; padding: 16px 0; }
`;

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [grade, setGrade] = useState("PSA 10");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showSold, setShowSold] = useState(false);
  const searchTimeout = useRef(null);

  useEffect(() => {
    if (query.length < 2) { setCards([]); return; }
    clearTimeout(searchTimeout.current);
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const found = await searchPokemonCards(query);
        setCards(found);
      } catch (e) {
        setCards([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [query]);

  function handleSelectCard(card) {
    setSelectedCard(card);
    setCards([]);
    setQuery("");
    setResults(null);
    setError(null);
  }

  function handleChangeCard() {
    setSelectedCard(null);
    setResults(null);
    setError(null);
    setQuery("");
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!selectedCard) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setShowSold(false);

    try {
      let soldItems, liveListings, avgPrice;

      if (DEMO_MODE) {
        await new Promise(r => setTimeout(r, 1400));
        const mock = getMockData(selectedCard.name, grade);
        soldItems = mock.soldItems;
        liveListings = mock.liveListings;
        avgPrice = mock.avgPrice;
      } else {
        const data = await fetchEbayData(selectedCard.name, selectedCard.number, selectedCard.set?.name, grade);
        soldItems = data.soldItems;
        liveListings = data.liveListings;
        avgPrice = data.avgPrice;
      }

      setResults({
        soldItems, liveListings, avgPrice,
        cardName: `${selectedCard.name} ${selectedCard.number}`,
        grade,
      });
    } catch (err) {
      setError("Could not fetch eBay data. Make sure your server is running.");
    } finally {
      setLoading(false);
    }
  }

  const bestDeal = results?.liveListings?.[0];
  const bestSaving = bestDeal && results.avgPrice > 0
    ? ((results.avgPrice - bestDeal.price) / results.avgPrice) * 100
    : 0;

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="bg-glow" />
        <div className="container">

          <div className="header">
            <div className="logo">
              <div className="logo-icon">⚡</div>
              <span className="logo-text">GemHunt</span>
            </div>
            <div className="logo-sub">Find the best deal on graded Pokémon cards</div>
          </div>

          {DEMO_MODE && (
            <div className="demo-banner">
              ⚡ Demo mode — showing realistic sample data. Set <code>DEMO_MODE = false</code> once your eBay API is live.
            </div>
          )}

          <form onSubmit={handleSearch}>

            {!selectedCard && (
              <div style={{ marginBottom: "20px" }}>
                <div className="step-label">Step 1 — Search for a card</div>
                <div className="search-wrap">
                  <input
                    className="search-input"
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="e.g. Charizard, Umbreon, Pikachu..."
                    autoComplete="off"
                  />
                  <span className="search-icon">🔍</span>
                </div>
                {searching && <div className="searching-text">Searching card database...</div>}
                {cards.length > 0 && (
                  <div className="card-grid">
                    {cards.map(card => (
                      <div key={card.id} className="poke-card" onClick={() => handleSelectCard(card)}>
                        {card.images?.small && <img src={card.images.small} alt={card.name} />}
                        <div className="poke-card-name">{card.name}</div>
                        <div className="poke-card-number">{card.number}/{card.set?.printedTotal || card.set?.total}</div>
                        <div className="poke-card-set">{card.set?.name}</div>
                      </div>
                    ))}
                  </div>
                )}
                {query.length >= 2 && !searching && cards.length === 0 && (
                  <div className="no-results">No cards found for "{query}"</div>
                )}
              </div>
            )}

            {selectedCard && (
              <div style={{ marginBottom: "20px" }}>
                <div className="step-label">Step 1 — Selected card</div>
                <div className="selected-card">
                  {selectedCard.images?.small && <img src={selectedCard.images.small} alt={selectedCard.name} />}
                  <div className="selected-card-info">
                    <div className="selected-card-name">{selectedCard.name}</div>
                    <div className="selected-card-meta">
                      {selectedCard.number}/{selectedCard.set?.printedTotal || selectedCard.set?.total} · {selectedCard.set?.name}
                    </div>
                  </div>
                  <button type="button" className="change-btn" onClick={handleChangeCard}>Change</button>
                </div>
              </div>
            )}

            <div style={{ marginBottom: "20px" }}>
              <div className="step-label">Step 2 — Select grading</div>
              <select className="grade-select" value={grade} onChange={e => setGrade(e.target.value)}>
                {GRADING_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="step-label">Step 3 — Find the best deal</div>
              <button type="submit" className="search-btn" disabled={loading || !selectedCard}>
                {loading ? "🔍 Scanning eBay..." : "Find Best Deal →"}
              </button>
            </div>
          </form>

          {error && <div className="error-box">{error}</div>}

          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div className="spinner" />
              <div style={{ fontSize: "13px", color: "#4a4a6a" }}>Scanning eBay for the best deals...</div>
            </div>
          )}

          {results && !loading && (
            <div style={{ marginTop: "32px" }}>
              <div className="summary-card">
                <div className="summary-tag">{results.cardName} · {results.grade}</div>
                <div className="summary-prices">
                  <div className="price-block">
                    <label>Avg sold (last {results.soldItems.length} sales)</label>
                    <div className="price-big">{formatPrice(results.avgPrice)}</div>
                  </div>
                  {bestDeal && (
                    <div className="price-block">
                      <label>Best deal now</label>
                      <div className={`price-big ${bestSaving >= 0 ? "green" : "red"}`}>
                        {formatPrice(bestDeal.price)}
                      </div>
                    </div>
                  )}
                </div>
                {bestDeal && (
                  <div className="summary-verdict" style={{ color: getSavingColor(bestSaving) }}>
                    {bestSaving >= 10
                      ? `🟢 Best listing is ${bestSaving.toFixed(1)}% below average — great deal`
                      : bestSaving >= 0
                      ? `🟡 Best listing is ${bestSaving.toFixed(1)}% below average`
                      : `🔴 Cheapest listing is ${Math.abs(bestSaving).toFixed(1)}% above average`}
                  </div>
                )}
              </div>

              <div className="section-title">Live Listings — Best Value First</div>
              {results.liveListings.length === 0 ? (
                <div className="no-results">No listings found.</div>
              ) : (
                results.liveListings.slice(0, 10).map((listing) => {
                  const saving = results.avgPrice > 0
                    ? ((results.avgPrice - listing.price) / results.avgPrice) * 100
                    : 0;
                  return (
                    <a key={listing.id} href={listing.url || "https://ebay.co.uk"} target="_blank" rel="noopener noreferrer" className={`listing-card ${saving >= 10 ? "bargain" : ""}`}>
                      <div className="listing-row">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="listing-title">{listing.title}</div>
                          <div>
                            <span className="listing-price">{formatPrice(listing.price, listing.currency)}</span>
                            {(listing.buyingOption === "Auction" || listing.buyingOption === "AUCTION") && (
                              <span className="auction-tag">AUCTION</span>
                            )}
                          </div>
                          {listing.seller && <div className="listing-seller">Seller: {listing.seller}</div>}
                        </div>
                        <div className="listing-right">
                          <span className="saving-badge" style={{ background: getSavingColor(saving) }}>{getSavingLabel(saving)}</span>
                          <span className="avg-label">avg {formatPrice(results.avgPrice)}</span>
                        </div>
                      </div>
                    </a>
                  );
                })
              )}

              <button className="sold-toggle" onClick={() => setShowSold(!showSold)}>
                {showSold ? "▲ Hide" : "▼ Show"} last {results.soldItems.length} sold prices
              </button>

              {showSold && (
                <div className="sold-list">
                  {results.soldItems.map((item, i) => (
                    <div key={item.id} className="sold-row">
                      <span style={{ color: "#4a4a6a" }}>Sale {i + 1} — {item.soldDate ? new Date(item.soldDate).toLocaleDateString("en-GB") : "Recent"}</span>
                      <span style={{ color: "#e8e8f0", fontWeight: 600 }}>{formatPrice(item.price, item.currency)}</span>
                    </div>
                  ))}
                  <div className="sold-avg">
                    <span style={{ color: "#6a6a9a" }}>Average</span>
                    <span style={{ color: "#fff" }}>{formatPrice(results.avgPrice)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}