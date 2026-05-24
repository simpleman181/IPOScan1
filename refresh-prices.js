const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const SYMBOL_MAP = {
  'LGEINDIA': { name: 'LGEINDIA', nse: 'LGEINDIA', minPrice: 1483 },
  'MTAR': { name: 'MTAR Technologies', nse: 'MTARTECH', min: 200, max: 2000 },
  'ADANIWILMAR': { name: 'Adani Wilmar AWL', nse: 'AWL', min: 100, max: 800 },
  'ETHOS': { name: 'Ethos Ltd', nse: 'ETHOSLTD', min: 500, max: 5000 },
  'PHARMEASY': { name: 'PharmEasy API Holdings', nse: 'PHARMASY', min: 20, max: 1000 },
  'HAPPSTMNDS': { name: 'Happiest Minds Technologies', nse: 'HAPPSTMNDS', min: 50, max: 1000 },
  'METROBRAND': { name: 'Metro Brands', nse: 'METROBRAND', min: 200, max: 2000 },
  'NYKAA': { name: 'Nykaa FSN Ecommerce', nse: 'NYKAA', min: 50, max: 2000 },
  'PARAS': { name: 'Paras Defence Space', nse: 'PARAS', min: 100, max: 2000 },
  'DELHIVERY': { name: 'Delhivery', nse: 'DELHIVERY', min: 200, max: 1000 },
  'ZOMATO': { name: 'Eternal Zomato', nse: 'ETERNAL', min: 100, max: 500 },
  'NAZARA': { name: 'Nazara Technologies', nse: 'NAZARA', min: 200, max: 2000 },
  'NURECA': { name: 'Nureca Ltd', nse: 'NURECA', min: 50, max: 1000 },
  'CARTRADE': { name: 'CarTrade Tech', nse: 'CARTRADE', min: 200, max: 5000 },
  'LATENTVIEW': { name: 'Latent View Analytics', nse: 'LATENTVIEW', min: 100, max: 1000 },
  'CRAFTSMAN': { name: 'Craftsman Automation', nse: 'CRAFTSMAN', min: 1000, max: 10000 },
  'LIKHITHA': { name: 'Likhitha Infrastructure', nse: 'LIKHITHA', min: 50, max: 500 },
  'VENUSPIPES': { name: 'Venus Pipes Tubes', nse: 'VENUSPIPES', min: 100, max: 1500 },
  'STOVEKRAFT': { name: 'Stove Kraft', nse: 'STOVEKRAFT', min: 200, max: 1500 },
  'RAINBOW': { name: 'Rainbow Childrens Medicare', nse: 'RAINBOW', min: 200, max: 3000 },
  'HARIOMPIPE': { name: 'Hariom Pipe Industries', nse: 'HARIOMPIPE', min: 50, max: 500 },
};

function parseZaiOutput(stdout) {
  const a = stdout.indexOf('['), o = stdout.indexOf('{');
  if (a === -1 && o === -1) return null;
  let s; if (a === -1) s = o; else if (o === -1) s = a; else s = Math.min(a, o);
  const oc = stdout[s], cc = oc === '[' ? ']' : '}';
  let d = 0, e = -1;
  for (let i = s; i < stdout.length; i++) { if (stdout[i] === oc) d++; if (stdout[i] === cc) d--; if (d === 0) { e = i + 1; break; } }
  if (e === -1) return null;
  try { return JSON.parse(stdout.substring(s, e)); } catch { return null; }
}

function extractPrices(text, nseSymbol) {
  const prices = [];
  let m;
  const r1 = /₹\s*([0-9]{2,6}(?:\.[0-9]{1,2})?)/g;
  while ((m = r1.exec(text)) !== null) { const p = parseFloat(m[1]); if (p > 10 && p < 200000) prices.push(p); }
  if (nseSymbol) {
    const r2 = new RegExp(nseSymbol + '\\s+([0-9]{2,6}(?:\\.[0-9]{1,2})?)', 'g');
    while ((m = r2.exec(text)) !== null) { const p = parseFloat(m[1]); if (p > 10 && p < 200000) prices.push(p); }
  }
  return prices;
}

async function fetchPrice(symbol) {
  const info = SYMBOL_MAP[symbol] || { name: symbol, nse: symbol, min: 50, max: 100000 };
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
      // Filter by min/max price range
      const valid = allPrices.filter(p => p >= info.min && p <= info.max);
      if (valid.length > 0) {
        valid.sort((a, b) => a - b);
        return { price: Math.round(valid[0] * 100) / 100, source: 'web-search' };
      }
    }
    return null;
  } catch (e) { console.error('Price error:', symbol, e.message); return null; }
}

async function main() {
  console.log('Starting price refresh...');
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
      console.log('OK ' + stock.symbol + ': ₹' + data.price);
    } else {
      failed++;
      console.error('FAIL ' + stock.symbol);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('Done: ' + updated + '/' + stocks.length + ' updated, ' + failed + ' failed');
  await db.$disconnect();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
