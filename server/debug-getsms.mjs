import axios from 'axios';

const BASE = 'https://get-sms.com/api/v2/rent/';
const key = process.env.GETSMS_API_KEY;

const methods = [
  // Case variations of the key methods
  'getnumber', 'getNumber', 'GetNumber', 'GETNUMBER', 'get_number',
  'getcountprices', 'getCountPrices', 'GetCountPrices', 'get_count_prices',
  'getcode', 'getCode', 'GetCode', 'GETCODE', 'get_code',
  'refuse', 'Refuse', 'REFUSE',
  'delete', 'Delete', 'DELETE',
  'getorders', 'getOrders', 'GetOrders',
];

for (const method of methods) {
  try {
    const r = await axios.get(BASE, {
      params: { userkey: key, method, rentid: '0' },
      timeout: 8000,
    });
    const status = r.data?.status;
    const msg = r.data?.data?.msg || JSON.stringify(r.data).slice(0, 150);
    const flag = status !== 404 ? '✅' : '  ';
    console.log(`${flag} "${method}": status=${status} → ${msg}`);
  } catch (e) {
    console.log(`   "${method}": ERR ${e.message}`);
  }
}
