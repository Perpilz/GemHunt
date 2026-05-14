const express = require("express");
const cors = require("cors");
const https = require("https");

const app = express();
app.use(cors());

const EBAY_APP_ID = "michaelb-Gradex-PRD-2183f64d5-81b310ff";

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

app.get("/sold", async (req, res) => {
  const { keyword } = req.query;
  const url = `https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findCompletedItems&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${EBAY_APP_ID}&RESPONSE-DATA-FORMAT=JSON&keywords=${encodeURIComponent(keyword)}&categoryId=183454&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true&paginationInput.entriesPerPage=10&sortOrder=EndTimeSoonest`;
  try {
    const data = await fetchUrl(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/live", async (req, res) => {
  const { keyword } = req.query;
  const url = `https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findItemsAdvanced&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${EBAY_APP_ID}&RESPONSE-DATA-FORMAT=JSON&keywords=${encodeURIComponent(keyword)}&categoryId=183454&itemFilter(0).name=ListingType&itemFilter(0).value(0)=FixedPrice&itemFilter(0).value(1)=Auction&paginationInput.entriesPerPage=20&sortOrder=PricePlusShippingLowest`;
  try {
    const data = await fetchUrl(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log("GemHunt server running on port 3001"));