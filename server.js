require("dotenv").config();

const express = require("express");
const cors = require("cors");
const https = require("https");

const app = express();
app.use(cors());

const APP_ID = process.env.EBAY_APP_ID;
const CERT_ID = process.env.EBAY_CERT_ID;
const POKETRACKER_KEY = process.env.POKETRACKER_KEY;

let cachedToken = null;
let tokenExpiry = null;

// ============================================================
// HTTPS HELPERS
// ============================================================
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: "POST", headers }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    https.get({ hostname, path, headers }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

// ============================================================
// EBAY OAUTH TOKEN (auto-refreshes every 2 hours)
// ============================================================
async function getToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  const credentials = Buffer.from(`${APP_ID}:${CERT_ID}`).toString("base64");
  const body = "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope";
  const data = await httpsPost("api.ebay.com", "/identity/v1/oauth2/token", {
    "Content-Type": "application/x-www-form-urlencoded",
    "Authorization": `Basic ${credentials}`,
    "Content-Length": Buffer.byteLength(body),
  }, body);
  console.log("Token response:", JSON.stringify(data));
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

// ============================================================
// ROUTE: /live — fetch 20 live eBay listings
// ============================================================
app.get("/live", async (req, res) => {
  try {
    const token = await getToken();
    const { keyword } = req.query;
    const path = `/buy/browse/v1/item_summary/search?q=${encodeURIComponent(keyword)}&category_ids=183454&sort=price&limit=20&filter=buyingOptions:{FIXED_PRICE|AUCTION}`;
    const data = await httpsGet("api.ebay.com", path, {
      "Authorization": `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
      "Content-Type": "application/json",
    });
    res.json(data);
  } catch (err) {
    console.error("Live listings error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ROUTE: /market — get PokemonPriceTracker market value
// Returns PSA/BGS/CGC grade-specific sold price average
// ============================================================
app.get("/market", async (req, res) => {
  try {
    const { cardId, grade } = req.query;

    if (!cardId) {
      return res.status(400).json({ error: "cardId is required" });
    }

    const path = `/api/v2/cards/${encodeURIComponent(cardId)}`;
    const data = await httpsGet("www.pokemonpricetracker.com", path, {
      "Authorization": `Bearer ${POKETRACKER_KEY}`,
      "Content-Type": "application/json",
    });

    // Extract the right grade price
    let marketPrice = null;
    const gradeMap = {
      "PSA 10": data?.psa_prices?.psa_10,
      "PSA 9": data?.psa_prices?.psa_9,
      "PSA 8": data?.psa_prices?.psa_8,
      "BGS 10": data?.bgs_prices?.bgs_10,
      "BGS 9.5": data?.bgs_prices?.bgs_9_5,
      "BGS 9": data?.bgs_prices?.bgs_9,
      "CGC 10": data?.cgc_prices?.cgc_10,
      "CGC 9.5": data?.cgc_prices?.cgc_9_5,
      "CGC 9": data?.cgc_prices?.cgc_9,
    };

    marketPrice = gradeMap[grade] || null;

    res.json({
      cardId,
      grade,
      marketPrice,
      raw: data,
    });
  } catch (err) {
    console.error("Market price error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ROUTE: /combined-market — combined 60/40 weighted average
// 60% PokemonPriceTracker sold data + 40% live middle 10
// ============================================================
app.get("/combined-market", async (req, res) => {
  try {
    const { keyword, cardId, grade } = req.query;
    const token = await getToken();

    // Fetch live listings and market price in parallel
    const [liveData, marketData] = await Promise.all([
      httpsGet("api.ebay.com",
        `/buy/browse/v1/item_summary/search?q=${encodeURIComponent(keyword)}&category_ids=183454&sort=price&limit=20&filter=buyingOptions:{FIXED_PRICE|AUCTION}`,
        {
          "Authorization": `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
          "Content-Type": "application/json",
        }
      ),
      cardId ? httpsGet("www.pokemonpricetracker.com",
        `/api/v2/cards?tcgPlayerId=${encodeURIComponent(cardId)}`,
        {
          "Authorization": `Bearer ${POKETRACKER_KEY}`,
          "Content-Type": "application/json",
        }
      ) : Promise.resolve(null),
    ]);

    // Process live listings
    const allListings = (liveData?.itemSummaries || [])
      .map(item => ({
        id: item.itemId,
        title: item.title,
        price: parseFloat(item.price?.value || 0),
        currency: item.price?.currency || "GBP",
        url: item.itemWebUrl,
        seller: item.seller?.username,
        buyingOption: item.buyingOptions?.[0],
        condition: item.condition,
        image: item.image?.imageUrl,
      }))
      .filter(i => i.price > 0)
      .sort((a, b) => a.price - b.price);

    // Calculate middle 10 average (remove top 5 and bottom 5 outliers)
    let liveMiddleAvg = null;
    if (allListings.length >= 10) {
      const middle = allListings.slice(5, 15);
      liveMiddleAvg = middle.reduce((s, i) => s + i.price, 0) / middle.length;
    } else if (allListings.length > 0) {
      // Not enough listings — use all of them
      liveMiddleAvg = allListings.reduce((s, i) => s + i.price, 0) / allListings.length;
    }

    // Extract PokemonPriceTracker market price for the specific grade
    let trackerPrice = null;
    if (marketData) {
      const gradeMap = {
  "PSA 10": marketData?.data?.[0]?.ebay?.psa10?.avg,
  "PSA 9":  marketData?.data?.[0]?.ebay?.psa9?.avg,
  "PSA 8":  marketData?.data?.[0]?.ebay?.psa8?.avg,
  "BGS 10": marketData?.data?.[0]?.ebay?.bgs10?.avg,
  "BGS 9.5": marketData?.data?.[0]?.ebay?.bgs95?.avg,
  "CGC 10": marketData?.data?.[0]?.ebay?.cgc10?.avg,
  "CGC 9.5": marketData?.data?.[0]?.ebay?.cgc95?.avg,
};
      trackerPrice = gradeMap[grade] || null;
    }

    // Calculate combined weighted average
    // 60% tracker (real sold data) + 40% live middle 10
    let combinedAvg = null;
    if (trackerPrice && liveMiddleAvg) {
      combinedAvg = (trackerPrice * 0.6) + (liveMiddleAvg * 0.4);
    } else if (trackerPrice) {
      combinedAvg = trackerPrice;
    } else if (liveMiddleAvg) {
      combinedAvg = liveMiddleAvg;
    }

    res.json({
      listings: allListings,
      liveMiddleAvg: liveMiddleAvg ? Math.round(liveMiddleAvg * 100) / 100 : null,
      trackerPrice: trackerPrice ? Math.round(trackerPrice * 100) / 100 : null,
      combinedAvg: combinedAvg ? Math.round(combinedAvg * 100) / 100 : null,
      dataQuality: trackerPrice && liveMiddleAvg ? "high" : trackerPrice ? "medium" : "low",
    });

  } catch (err) {
    console.error("Combined market error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// TOKEN TEST
// ============================================================
app.get("/token-test", async (req, res) => {
  try {
    const token = await getToken();
    res.json({ success: true, tokenPreview: token ? token.substring(0, 30) + "..." : "null" });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.listen(3001, () => console.log("GemHunt server running on port 3001"));