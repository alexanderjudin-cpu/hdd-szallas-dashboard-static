import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const TEMPLATE_PATH = process.env.DASHBOARD_TEMPLATE_PATH || path.join(ROOT, 'dashboard-template.html');
const GEO_PATH = process.env.GEOJSON_PATH || path.join(ROOT, 'data', 'hungary-counties.geojson');
const SAMPLE_PATH = path.join(ROOT, 'data', 'sample-feed.json');
const OUT_DIR = process.env.OUT_DIR || path.join(ROOT, 'dist');
const OUT_HTML = path.join(OUT_DIR, 'index.html');
const OUT_INFO = path.join(OUT_DIR, 'build-info.json');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';
const FEED_TABLE = process.env.SUPABASE_FEED_TABLE || 'housing_city_pin_feed_cache_v2';
const REFRESH_CACHE = /^true$/i.test(process.env.REFRESH_CACHE || 'false');
const REFRESH_RPC = process.env.REFRESH_RPC || 'refresh_housing_city_pin_feed_cache_v2';
const USE_SAMPLE = process.argv.includes('--sample') || /^true$/i.test(process.env.USE_SAMPLE || 'false');

const CITY_TO_COUNTY = new Map(Object.entries({
  'Budapest': 'Budapest',
  'Kecskemét': 'Bács-Kiskun', 'Baja': 'Bács-Kiskun', 'Kiskunfélegyháza': 'Bács-Kiskun',
  'Pécs': 'Baranya', 'Szalánta': 'Baranya',
  'Békéscsaba': 'Békés', 'Orosháza': 'Békés',
  'Miskolc': 'Borsod-Abaúj-Zemplén', 'Ózd': 'Borsod-Abaúj-Zemplén', 'Kazincbarcika': 'Borsod-Abaúj-Zemplén',
  'Szeged': 'Csongrád-Csanád', 'Hódmezővásárhely': 'Csongrád-Csanád',
  'Székesfehérvár': 'Fejér', 'Dunaújváros': 'Fejér', 'Mór': 'Fejér', 'Ercsi': 'Fejér', 'Bodajk': 'Fejér', 'Nádasdladány': 'Fejér',
  'Győr': 'Győr-Moson-Sopron', 'Sopron': 'Győr-Moson-Sopron', 'Mosonmagyaróvár': 'Győr-Moson-Sopron', 'Tét': 'Győr-Moson-Sopron',
  'Debrecen': 'Hajdú-Bihar', 'Hajdúböszörmény': 'Hajdú-Bihar', 'Hajdúszoboszló': 'Hajdú-Bihar', 'Nyíradony': 'Hajdú-Bihar',
  'Eger': 'Heves', 'Gyöngyös': 'Heves', 'Hatvan': 'Heves', 'Apc': 'Heves',
  'Szolnok': 'Jász-Nagykun-Szolnok', 'Jászberény': 'Jász-Nagykun-Szolnok', 'Pusztamonostor': 'Jász-Nagykun-Szolnok', 'Jászfényszaru': 'Jász-Nagykun-Szolnok', 'Tiszajenő': 'Jász-Nagykun-Szolnok', 'Jászszentandrás': 'Jász-Nagykun-Szolnok',
  'Tatabánya': 'Komárom-Esztergom', 'Komárom': 'Komárom-Esztergom', 'Oroszlány': 'Komárom-Esztergom', 'Esztergom': 'Komárom-Esztergom', 'Ászár': 'Komárom-Esztergom', 'Bábolna': 'Komárom-Esztergom', 'Nyergesújfalu': 'Komárom-Esztergom', 'Környe': 'Komárom-Esztergom', 'Császár': 'Komárom-Esztergom', 'Bakonysárkány': 'Komárom-Esztergom', 'Kisbér': 'Komárom-Esztergom', 'Tata': 'Komárom-Esztergom', 'Bana': 'Komárom-Esztergom',
  'Salgótarján': 'Nógrád', 'Rétság': 'Nógrád', 'Szendehely': 'Nógrád', 'Nagyoroszi': 'Nógrád', 'Bátonyterenye': 'Nógrád', 'Pásztó': 'Nógrád',
  'Érd': 'Pest', 'Dunakeszi': 'Pest', 'Cegléd': 'Pest', 'Gödöllő': 'Pest', 'Vác': 'Pest', 'Szentendre': 'Pest', 'Szigetszentmiklós': 'Pest', 'Nagykőrös': 'Pest', 'Nagykáta': 'Pest', 'Gyál': 'Pest', 'Monor': 'Pest', 'Budaörs': 'Pest', 'Törökbálint': 'Pest', 'Halásztelek': 'Pest', 'Budakeszi': 'Pest', 'Szigethalom': 'Pest', 'Áporka': 'Pest',
  'Kaposvár': 'Somogy', 'Siófok': 'Somogy', 'Nemesvid': 'Somogy', 'Zákányfalu': 'Somogy',
  'Nyíregyháza': 'Szabolcs-Szatmár-Bereg', 'Kisvárda': 'Szabolcs-Szatmár-Bereg', 'Tiszadob': 'Szabolcs-Szatmár-Bereg',
  'Szekszárd': 'Tolna', 'Simontornya': 'Tolna',
  'Szombathely': 'Vas',
  'Veszprém': 'Veszprém', 'Pápa': 'Veszprém', 'Ajka': 'Veszprém', 'Balatonfüred': 'Veszprém', 'Dudar': 'Veszprém', 'Mezőlak': 'Veszprém',
  'Zalaegerszeg': 'Zala', 'Nagykanizsa': 'Zala', 'Zalakomár': 'Zala', 'Nagybakónak': 'Zala', 'Szepetnek': 'Zala', 'Becsehely': 'Zala',
  'Egyéb / saját lakás': 'Egyéb / saját lakás'
}));

const COUNTY_TO_REGION = new Map(Object.entries({
  'Budapest': 'Közép-Magyarország',
  'Egyéb / saját lakás': 'Egyéb / saját lakás',
  'Pest': 'Közép-Magyarország',
  'Fejér': 'Közép-Dunántúl',
  'Komárom-Esztergom': 'Közép-Dunántúl',
  'Veszprém': 'Közép-Dunántúl',
  'Győr-Moson-Sopron': 'Nyugat-Dunántúl',
  'Vas': 'Nyugat-Dunántúl',
  'Zala': 'Nyugat-Dunántúl',
  'Baranya': 'Dél-Dunántúl',
  'Somogy': 'Dél-Dunántúl',
  'Tolna': 'Dél-Dunántúl',
  'Borsod-Abaúj-Zemplén': 'Észak-Magyarország',
  'Heves': 'Észak-Magyarország',
  'Nógrád': 'Észak-Magyarország',
  'Hajdú-Bihar': 'Észak-Alföld',
  'Jász-Nagykun-Szolnok': 'Észak-Alföld',
  'Szabolcs-Szatmár-Bereg': 'Észak-Alföld',
  'Bács-Kiskun': 'Dél-Alföld',
  'Békés': 'Dél-Alföld',
  'Csongrád-Csanád': 'Dél-Alföld'
}));

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normRow(row) {
  const city = String(row.city || row.varos || row.város || '').trim();
  const county = String(row.megye || row.county || CITY_TO_COUNTY.get(city) || '').trim();
  const region = String(row.regio || row.region || COUNTY_TO_REGION.get(county) || 'Ismeretlen régió').trim();
  const employees = Math.round(num(row.employees ?? row.munkavallalok ?? row.aktualis_lakok));
  const capacity = Math.round(num(row.capacity ?? row.ferohely));
  const free = Math.max(0, Math.round(num(row.free ?? row.szabad_hely ?? (capacity - employees))));
  const cost = num(row.cost ?? row.koltseg ?? row.becsult_havi_netto_koltseg);
  const lostCost = num(row.lost_cost ?? row.becsult_havi_bukas ?? 0);
  const fixedCost = num(row.fixed_cost ?? row.fix_dijas_havi_koltseg ?? 0);
  const variableCost = num(row.variable_cost ?? row.fo_ej_alapu_koltseg ?? Math.max(cost - fixedCost, 0));
  const fixedAddressCount = Math.round(num(row.fixed_address_count ?? row.fix_dijas_cimek ?? 0));
  const fixedCapacity = Math.round(num(row.fixed_capacity ?? row.fix_ferohely ?? 0));
  const fixedEmployees = Math.round(num(row.fixed_employees ?? row.fix_lako ?? 0));
  const fixedFree = Math.max(0, Math.round(num(row.fixed_free ?? row.fix_ures_de_fizetett ?? (fixedCapacity - fixedEmployees))));
  const nights = Math.round(num(row.nights ?? row.ejszakak ?? (employees * 30)));
  const addressCount = Math.round(num(row.address_count ?? row.cim_db ?? row.sorok ?? 1));
  return {
    city,
    megye: county,
    regio: region,
    ceg: String(row.ceg || row.company || '').trim() || 'Nincs adat',
    partner: String(row.partner || row.partner_nev || '').trim() || 'Nincs adat',
    szallasado: String(row.szallasado || row.provider || '').trim() || 'Városi összesítő',
    address_count: addressCount,
    employees,
    capacity,
    free,
    nights,
    cost,
    lost_cost: lostCost,
    fixed_cost: fixedCost,
    variable_cost: variableCost,
    fixed_address_count: fixedAddressCount,
    fixed_capacity: fixedCapacity,
    fixed_employees: fixedEmployees,
    fixed_free: fixedFree,
    refreshed_at: row.refreshed_at || null
  };
}

function addAgg(map, key, patch) {
  if (!map.has(key)) map.set(key, { ...patch, munkavallalok: 0, ejszakak: 0, koltseg: 0, sorok: 0 });
  return map.get(key);
}

function buildDash(feedRows, geo) {
  const rows = feedRows.map(normRow).filter(r => r.city && r.megye);

  const megyeMap = new Map();
  const cegMap = new Map();
  const partnerMap = new Map();
  const occ = [];

  for (const r of rows) {
    const m = addAgg(megyeMap, r.megye, { megye: r.megye, regio: r.regio });
    m.munkavallalok += r.employees;
    m.ejszakak += r.nights || r.employees * 30;
    m.koltseg += r.cost;
    m.sorok += r.address_count || 1;

    const ck = `${r.ceg}||${r.megye}`;
    const c = addAgg(cegMap, ck, { ceg: r.ceg, megye: r.megye, regio: r.regio });
    c.munkavallalok += r.employees;
    c.ejszakak += r.nights || r.employees * 30;
    c.koltseg += r.cost;
    c.sorok += r.address_count || 1;

    const partners = String(r.partner || 'Nincs adat')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    const partnerLabel = partners.length ? partners.join(', ') : 'Nincs adat';
    const pk = `${partnerLabel}||${r.megye}`;
    const p = addAgg(partnerMap, pk, { partner: partnerLabel, megye: r.megye, regio: r.regio });
    p.munkavallalok += r.employees;
    p.ejszakak += r.nights || r.employees * 30;
    p.koltseg += r.cost;
    p.sorok += r.address_count || 1;

    const hasFixedOccupancy = r.fixed_address_count > 0 || r.fixed_capacity > 0 || r.fixed_cost > 0 || r.lost_cost > 0;
    if (!hasFixedOccupancy) continue;

    const fixedSlotCost = r.fixed_capacity > 0 ? r.fixed_cost / r.fixed_capacity : 0;
    const utilization = r.fixed_capacity > 0 ? r.fixed_employees / r.fixed_capacity : 0;
    const utilPct = Math.round(utilization * 1000) / 10;
    let state = 'Nincs fix kapacitás adat';
    if (r.fixed_capacity > 0) {
      if (r.fixed_free <= 0) state = 'Telített';
      else if (utilPct >= 80) state = 'Rendben';
      else if (utilPct >= 50) state = 'Figyelendő';
      else state = 'Magas veszteség';
    }

    occ.push({
      address: r.city,
      provider: r.szallasado,
      company: r.ceg,
      fixed_type: 'Fix díjas / városi összesítő',
      capacity: r.fixed_capacity,
      current: r.fixed_employees,
      free: r.fixed_free,
      utilization,
      util_pct: utilPct,
      days: 30,
      period_cost: Math.round(r.fixed_cost),
      lost_cost: Math.round(r.lost_cost),
      occupied_cost: Math.max(Math.round(r.fixed_cost - r.lost_cost), 0),
      fixed_cost: Math.round(r.fixed_cost),
      variable_cost: Math.round(r.variable_cost),
      slot_cost: Math.round(fixedSlotCost),
      partners: r.partner,
      partner_count: Math.max(1, partners.length),
      address_count: r.fixed_address_count,
      state
    });
  }

  const sort = arr => arr.sort((a, b) => num(b.munkavallalok) - num(a.munkavallalok) || num(b.koltseg) - num(a.koltseg));
  const OCC_FIX = occ.sort((a, b) => num(b.lost_cost) - num(a.lost_cost) || num(b.free) - num(a.free));
  const cap = OCC_FIX.reduce((a, r) => a + r.capacity, 0);
  const cur = OCC_FIX.reduce((a, r) => a + r.current, 0);

  return {
    EMBEDDED: {
      megye: sort([...megyeMap.values()]),
      ceg: sort([...cegMap.values()]),
      partner: sort([...partnerMap.values()])
    },
    GEO: geo,
    OCC_FIX,
    OCC_SUMMARY: {
      address_count: OCC_FIX.reduce((a, r) => a + (r.address_count || 0), 0),
      city_count: OCC_FIX.length,
      capacity_total: cap,
      current_total: cur,
      free_total: OCC_FIX.reduce((a, r) => a + r.free, 0),
      util_avg: cap ? cur / cap : 0,
      period_cost_total: OCC_FIX.reduce((a, r) => a + r.period_cost, 0),
      lost_cost_total: OCC_FIX.reduce((a, r) => a + r.lost_cost, 0),
      fixed_cost_total: OCC_FIX.reduce((a, r) => a + r.fixed_cost, 0),
      variable_cost_total: rows.reduce((a, r) => a + r.variable_cost, 0),
      portfolio_employee_total: rows.reduce((a, r) => a + r.employees, 0),
      portfolio_capacity_total: rows.reduce((a, r) => a + r.capacity, 0),
      portfolio_free_total: rows.reduce((a, r) => a + r.free, 0),
      portfolio_cost_total: rows.reduce((a, r) => a + r.cost, 0),
      critical_count: OCC_FIX.filter(r => r.capacity > 0 && r.util_pct < 70).reduce((a, r) => a + (r.address_count || 1), 0)
    },
    GENERATED_AT: new Date().toISOString()
  };
}

async function supabaseFetch(pathname, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathname} → ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function maybeRefreshCache() {
  if (!REFRESH_CACHE || USE_SAMPLE) return;
  try {
    console.log(`[build] Refresh RPC: ${REFRESH_RPC}`);
    await supabaseFetch(`/rest/v1/rpc/${REFRESH_RPC}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
  } catch (err) {
    console.warn(`[build] Cache refresh RPC failed, continuing with existing table: ${err.message}`);
  }
}

async function loadFeedRows() {
  if (USE_SAMPLE) {
    console.log('[build] Using sample feed');
    return JSON.parse(await fs.readFile(SAMPLE_PATH, 'utf8'));
  }
  const select = 'city,ceg,partner,szallasado,address_count,employees,capacity,free,nights,cost,lost_cost,fixed_cost,variable_cost,fixed_address_count,fixed_capacity,fixed_employees,fixed_free,refreshed_at';
  const query = `/rest/v1/${encodeURIComponent(FEED_TABLE)}?select=${encodeURIComponent(select)}&order=employees.desc`;
  console.log(`[build] Fetching Supabase feed: ${FEED_TABLE}`);
  return await supabaseFetch(query);
}

function makeStaticDashScript(dash, rowCount) {
  const json = JSON.stringify(dash).replace(/</g, '\\u003c');
  return `<!-- ================================================================= -->\n<!-- STATIC DASHBOARD DATA - GENERATED BY GITHUB ACTIONS                -->\n<!-- KINÉZETHEZ NEM NYÚL: csak window.DASH adatot állít be.              -->\n<!-- ================================================================= -->\n<script>\n(function(){\n  window.__DASH_BOOTED = true;\n  window.DASH = ${json};\n  window.__DASH_SOURCE = 'static-generated';\n  window.__DASH_ROWCOUNT = ${Number(rowCount) || 0};\n})();\n<\/script>\n<!-- ================= STATIC DASHBOARD DATA VÉGE ===================== -->`;
}

function patchPlainHtmlTemplate(html, staticScript) {
  const liveLoaderRe = /<!--\s*=+\s*-->\s*<!--\s*SUPABASE LIVE LOADER[\s\S]*?<!--\s*=*\s*SUPABASE LIVE LOADER VÉGE\s*=*\s*-->\s*/i;
  if (liveLoaderRe.test(html)) return html.replace(liveLoaderRe, staticScript + '\n');
  return html.replace(/<head[^>]*>/i, m => `${m}\n${staticScript}\n`);
}

function patchBundledHtml(bundleHtml, staticScript) {
  const openTagRe = /<script\s+type=["']__bundler\/template["']\s*>/i;
  const open = bundleHtml.match(openTagRe);
  if (!open) {
    console.log('[build] No bundler template found, patching as normal HTML');
    return patchPlainHtmlTemplate(bundleHtml, staticScript);
  }
  const start = open.index + open[0].length;
  const close = bundleHtml.indexOf('</script>', start);
  if (close < 0) throw new Error('Bundler template closing </script> not found');
  const rawJson = bundleHtml.slice(start, close).trim();
  let templateHtml;
  try {
    templateHtml = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(`Cannot parse __bundler/template JSON: ${err.message}`);
  }
  const patchedTemplate = patchPlainHtmlTemplate(templateHtml, staticScript);
  const safeJson = JSON.stringify(patchedTemplate).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return bundleHtml.slice(0, start) + '\n' + safeJson + '\n' + bundleHtml.slice(close);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await maybeRefreshCache();

  const [feedRows, geo, template] = await Promise.all([
    loadFeedRows(),
    fs.readFile(GEO_PATH, 'utf8').then(JSON.parse),
    fs.readFile(TEMPLATE_PATH, 'utf8')
  ]);

  const dash = buildDash(feedRows, geo);
  const staticScript = makeStaticDashScript(dash, feedRows.length);
  const finalHtml = patchBundledHtml(template, staticScript);

  await fs.writeFile(OUT_HTML, finalHtml, 'utf8');
  await fs.writeFile(OUT_INFO, JSON.stringify({
    generated_at: dash.GENERATED_AT,
    source_table: USE_SAMPLE ? 'sample-feed.json' : FEED_TABLE,
    feed_rows: feedRows.length,
    megye_rows: dash.EMBEDDED.megye.length,
    ceg_rows: dash.EMBEDDED.ceg.length,
    partner_rows: dash.EMBEDDED.partner.length,
    occ_rows: dash.OCC_FIX.length,
    fixed_address_count: dash.OCC_SUMMARY.address_count,
    fixed_capacity_total: dash.OCC_SUMMARY.capacity_total,
    fixed_current_total: dash.OCC_SUMMARY.current_total,
    fixed_free_total: dash.OCC_SUMMARY.free_total,
    fixed_util_avg: dash.OCC_SUMMARY.util_avg,
    lost_cost_total: dash.OCC_SUMMARY.lost_cost_total,
    fixed_cost_total: dash.OCC_SUMMARY.fixed_cost_total,
    variable_cost_total: dash.OCC_SUMMARY.variable_cost_total,
    portfolio_employee_total: dash.OCC_SUMMARY.portfolio_employee_total,
    portfolio_capacity_total: dash.OCC_SUMMARY.portfolio_capacity_total,
    portfolio_cost_total: dash.OCC_SUMMARY.portfolio_cost_total
  }, null, 2), 'utf8');

  console.log(`[build] Done: ${OUT_HTML}`);
  console.log(`[build] Feed rows: ${feedRows.length}, fixed dashboard rows: ${dash.OCC_FIX.length}`);
  console.log(`[build] Fixed free total: ${dash.OCC_SUMMARY.free_total}`);
  console.log(`[build] Lost cost total: ${dash.OCC_SUMMARY.lost_cost_total}`);
}

main().catch(err => {
  console.error('[build] ERROR:', err);
  process.exit(1);
});
