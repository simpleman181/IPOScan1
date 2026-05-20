const http = require('http');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const SYMBOL_MAP = {
  'MTAR': { name: 'MTAR Technologies', nse: 'MTARTECH', minPrice: 100 },
  'ADANIWILMAR': { name: 'Adani Wilmar AWL', nse: 'AWL', minPrice: 100 },
  'ETHOS': { name: 'Ethos Ltd', nse: 'ETHOSLTD', minPrice: 500 },
  'PHARMEASY': { name: 'PharmEasy', nse: 'PHARMASY', minPrice: 50 },
  'HAPPSTMNDS': { name: 'Happiest Minds', nse: 'HAPPSTMNDS', minPrice: 100 },
  'METROBRAND': { name: 'Metro Brands', nse: 'METROBRAND', minPrice: 200 },
  'NYKAA': { name: 'Nykaa', nse: 'NYKAA', minPrice: 50 },
  'PARAS': { name: 'Paras Defence', nse: 'PARAS', minPrice: 100 },
  'DELHIVERY': { name: 'Delhivery', nse: 'DELHIVERY', minPrice: 200 },
  'ZOMATO': { name: 'Eternal Zomato', nse: 'ETERNAL', minPrice: 100 },
  'NAZARA': { name: 'Nazara Technologies', nse: 'NAZARA', minPrice: 200 },
  'NURECA': { name: 'Nureca', nse: 'NURECA', minPrice: 50 },
  'CARTRADE': { name: 'CarTrade Tech', nse: 'CARTRADE', minPrice: 200 },
  'LATENTVIEW': { name: 'Latent View Analytics', nse: 'LATENTVIEW', minPrice: 100 },
  'CRAFTSMAN': { name: 'Craftsman Automation', nse: 'CRAFTSMAN', minPrice: 1000 },
  'LIKHITHA': { name: 'Likhitha Infrastructure', nse: 'LIKHITHA', minPrice: 50 },
  'VENUSPIPES': { name: 'Venus Pipes Tubes', nse: 'VENUSPIPES', minPrice: 200 },
  'STOVEKRAFT': { name: 'Stove Kraft', nse: 'STOVEKRAFT', minPrice: 200 },
  'RAINBOW': { name: 'Rainbow Childrens Medicare', nse: 'RAINBOW', minPrice: 200 },
  'HARIOMPIPE': { name: 'Hariom Pipe Industries', nse: 'HARIOMPIPE', minPrice: 100 },
};

let refreshStatus = { running: false, lastResult: null, startTime: null };

function parseZaiOutput(stdout) {
  const arrayStart = stdout.indexOf('[');
  const objectStart = stdout.indexOf('{');
  if (arrayStart === -1 && objectStart === -1) return null;
  let jsonStart;
  if (arrayStart === -1) jsonStart = objectStart;
  else if (objectStart === -1) jsonStart = arrayStart;
  else jsonStart = Math.min(arrayStart, objectStart);
  const openChar = stdout[jsonStart];
  const closeChar = openChar === '[' ? ']' : '}';
  let depth = 0, jsonEnd = -1;
  for (let i = jsonStart; i < stdout.length; i++) {
    if (stdout[i] === openChar) depth++;
    if (stdout[i] === closeChar) depth--;
    if (depth === 0) { jsonEnd = i + 1; break; }
  }
  if (jsonEnd === -1) return null;
  try { return JSON.parse(stdout.substring(jsonStart, jsonEnd)); } catch { return null; }
}

function extractPrices(text, nseSymbol) {
  const prices = [];
  let m;
  // Pattern: ₹244.00
  const r1 = /₹\s*([0-9]{2,6}(?:\.[0-9]{1,2})?)/g;
  while ((m = r1.exec(text)) !== null) { const p = parseFloat(m[1]); if (p > 10 && p < 200000) prices.push(p); }
  // Pattern: SYMBOL 241.00 (NSE format)
  if (nseSymbol) {
    const r2 = new RegExp(nseSymbol + '\\s+([0-9]{2,6}(?:\\.[0-9]{1,2})?)', 'g');
    while ((m = r2.exec(text)) !== null) { const p = parseFloat(m[1]); if (p > 10 && p < 200000) prices.push(p); }
  }
  return prices;
}

async function fetchPrice(symbol) {
  const info = SYMBOL_MAP[symbol] || { name: symbol, nse: symbol, minPrice: 50 };
  try {
    const { stdout } = await execFileAsync('z-ai', [
      'function', '-n', 'web_search',
      '-a', JSON.stringify({ query: `${info.name} NSE share price today`, num: 5 }),
    ], { timeout: 25000 });
    const results = parseZaiOutput(stdout);
    if (!results || !Array.isArray(results)) return null;
    const allPrices = [];
    for (const r of results) {
      const text = (r.snippet || '') + ' ' + (r.name || '');
      allPrices.push(...extractPrices(text, info.nse));
    }
    if (allPrices.length > 0) {
      // Filter prices that are above the minimum expected price for this stock
      const validPrices = allPrices.filter(p => p >= info.minPrice);
      if (validPrices.length > 0) {
        validPrices.sort((a, b) => a - b);
        const median = validPrices[Math.floor(validPrices.length / 2)];
        const filtered = validPrices.filter(p => p >= median * 0.5 && p <= median * 1.5);
        return { price: Math.round((filtered[0] || validPrices[0]) * 100) / 100, source: 'web-search' };
      }
      // If no prices meet the minimum, return the largest price found
      // (it's more likely to be correct than a small number)
      const maxPrice = Math.max(...allPrices);
      if (maxPrice >= info.minPrice * 0.5) {
        return { price: Math.round(maxPrice * 100) / 100, source: 'web-search-fallback' };
      }
    }
    return null;
  } catch (e) { console.error('Price error:', symbol, e.message); return null; }
}

async function doRefreshAll() {
  if (refreshStatus.running) return refreshStatus;
  refreshStatus = { running: true, lastResult: null, startTime: new Date().toISOString() };
  try {
    const stocks = await db.ipoStock.findMany();
    let updated = 0, failed = 0;
    const now = new Date().toISOString();
    for (const stock of stocks) {
      const data = await fetchPrice(stock.symbol);
      if (data) {
        await db.ipoStock.update({
          where: { id: stock.id },
          data: { currentPrice: data.price, lastUpdated: now, dataSource: data.source },
        });
        const lastDaily = await db.dailyPrice.findFirst({ where: { stockId: stock.id }, orderBy: { date: 'desc' } });
        if (lastDaily) {
          await db.dailyPrice.update({ where: { id: lastDaily.id }, data: { close: data.price, high: Math.max(lastDaily.high, data.price) } });
        }
        updated++;
        console.log('Updated ' + stock.symbol + ': ₹' + data.price + ' (' + data.source + ')');
      } else {
        failed++;
        console.error('Failed: ' + stock.symbol);
      }
      await new Promise(r => setTimeout(r, 2000)); // 2s delay between requests
    }
    refreshStatus.lastResult = { updated, failed, total: stocks.length, timestamp: now };
    refreshStatus.running = false;
    return refreshStatus.lastResult;
  } catch (e) {
    refreshStatus.running = false;
    refreshStatus.lastResult = { error: e.message };
    console.error('Refresh error:', e);
    throw e;
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/price') {
      const sym = url.searchParams.get('symbol');
      if (!sym) { res.writeHead(400); res.end('{"error":"symbol required"}'); return; }
      const d = await fetchPrice(sym);
      res.writeHead(d ? 200 : 500); res.end(JSON.stringify(d || {error:'Failed'}));
    } else if (url.pathname === '/refresh-all') {
      doRefreshAll().catch(e => console.error('Background refresh error:', e));
      res.writeHead(200); res.end(JSON.stringify({ message: 'Refresh started', running: true }));
    } else if (url.pathname === '/refresh-status') {
      res.writeHead(200); res.end(JSON.stringify(refreshStatus));
    } else if (url.pathname === '/health') {
      res.writeHead(200); res.end('{"status":"ok"}');
    } else { res.writeHead(404); res.end('{"error":"Not found"}'); }
  } catch (e) { res.writeHead(500); res.end(JSON.stringify({error: e.message})); }
});

server.listen(3002, () => console.log('Price fetcher on :3002'));

// Auto-refresh every 5 minutes
setInterval(() => {
  if (!refreshStatus.running) {
    console.log('Auto-refresh starting...');
    doRefreshAll().then(r => console.log('Auto-refresh done:', r)).catch(e => console.error('Auto-refresh error:', e));
  }
}, 5 * 60 * 1000);

// Initial refresh on startup
setTimeout(() => {
  console.log('Initial refresh starting...');
  doRefreshAll().then(r => console.log('Initial refresh done:', r)).catch(e => console.error('Initial refresh error:', e));
}, 3000);
