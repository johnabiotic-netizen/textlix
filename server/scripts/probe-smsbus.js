/**
 * SMS-BUS (LIX 4) API probe — validates the provider module against the live API
 * before we wire it into the app. Requires SMSBUS_TOKEN in ../.env.
 *
 *   node scripts/probe-smsbus.js            → read-only: balance, catalogs, Fiverr/USA price + mapping
 *   node scripts/probe-smsbus.js --buy      → also does a REAL buy → poll(5x) → cancel (SPENDS money)
 *
 * Read-only mode costs nothing. Use --buy only when you want to confirm the full flow.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
const axios = require('axios');
const smsbus = require('../src/providers/sms/smsbus.provider');

const BASE = 'https://sms-bus.com/api/control';
const TOKEN = process.env.SMS_BUS_API_KEY;
const raw = async (path, params = {}) => {
  const qs = new URLSearchParams({ token: TOKEN, ...params }).toString();
  const { data } = await axios.get(`${BASE}${path}?${qs}`, { timeout: 20000 });
  return data;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const show = (label, v) => console.log(`\n=== ${label} ===\n` + JSON.stringify(v, null, 2).slice(0, 1200));

(async () => {
  if (!TOKEN) { console.log('SMS_BUS_API_KEY not set in .env — add it and rerun.'); return; }

  // 1) Balance
  show('balance', await raw('/get/balance'));

  // 2) Countries — find USA
  const countries = await raw('/list/countries');
  const clist = Array.isArray(countries.data) ? countries.data : Object.values(countries.data || {});
  console.log(`\ncountries: ${clist.length} total`);
  const us = clist.find((c) => String(c.code).toLowerCase() === 'us');
  console.log('USA entry:', JSON.stringify(us));

  // 3) Projects — find Fiverr
  const projects = await raw('/list/projects');
  const plist = Array.isArray(projects.data) ? projects.data : Object.values(projects.data || {});
  console.log(`\nprojects: ${plist.length} total`);
  const fiverr = plist.find((p) => /fiverr/i.test(p.title || '') || /fiverr/i.test(p.code || ''));
  console.log('Fiverr entry:', JSON.stringify(fiverr));

  // 4) Prices for USA — Fiverr row
  if (us) {
    const prices = await raw('/list/prices', { country_id: us.id });
    const rows = Array.isArray(prices.data) ? prices.data : Object.values(prices.data || {});
    console.log(`\nUSA price rows: ${rows.length}. Sample:`, JSON.stringify(rows.slice(0, 2)));
    if (fiverr) {
      const fr = rows.find((r) => r.project_id === fiverr.id);
      console.log('Fiverr/USA price row:', JSON.stringify(fr));
      if (fr) console.log(`→ cost $${fr.cost} · stock ${fr.total_count} · at 30% margin ≈ ${Math.ceil(Number(fr.cost) * 100 * 1.3)} credits`);
    }
  }

  // 5) Validate the provider module's resolvers + price mapping
  console.log('\n--- provider module checks ---');
  console.log('countryIdFor(US):', await smsbus.countryIdFor('US'));
  console.log('projectIdFor(fiverr):', await smsbus.projectIdFor('fiverr'));
  const byCountry = await smsbus.getOtpPricesByCountry('US');
  console.log('getOtpPricesByCountry(US).fiverr:', JSON.stringify(byCountry?.fiverr || null));
  console.log('getBalance():', await smsbus.getBalance());

  // 6) Optional real flow
  if (process.argv.includes('--buy')) {
    console.log('\n--- REAL buy → poll → cancel (spends balance) ---');
    const num = await smsbus.getNumber('fiverr', 'US');
    console.log('bought:', JSON.stringify(num));
    for (let i = 1; i <= 5; i++) {
      await sleep(5000);
      const code = await smsbus.getSMS(num.id);
      console.log(`poll ${i}:`, code == null ? 'waiting…' : `CODE = ${code}`);
      if (code) break;
    }
    console.log('cancel:', await smsbus.cancel(num.id));
  }

  console.log('\nDone.');
})().catch((e) => { console.error('PROBE ERROR:', e.message); process.exit(1); });
