import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const EB_BASE = 'https://api.easybroker.com/v1/properties';
const LIMIT = 50;

async function fetchWithRetry(url: string, headers: any, retries = 3, delay = 350) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 429) {
        console.warn(`EasyBroker rate limit (429) on ${url}. Retrying in ${delay * attempt}ms...`);
        await new Promise(r => setTimeout(r, delay * attempt));
        continue;
      }
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      if (attempt === retries) throw e;
    }
  }
  return null;
}

function getApiKeys(): { account: string; key: string }[] {
  const pEnv = env as Record<string, string>;
  const procEnv = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string>;

  const key1 =
    pEnv.EASYBROKER_API_KEY ||
    pEnv.VITE_EASYBROKER_API_KEY ||
    procEnv.EASYBROKER_API_KEY ||
    procEnv.VITE_EASYBROKER_API_KEY ||
    'pqnjps13ry7iaudododsi455mg22mt';

  const key2 =
    pEnv.EASYBROKER_API_KEY_2 ||
    pEnv.VITE_EASYBROKER_API_KEY_2 ||
    procEnv.EASYBROKER_API_KEY_2 ||
    procEnv.VITE_EASYBROKER_API_KEY_2 ||
    'x0lk7kyxiuobh016le9znt24222uil';

  const accounts: { account: string; key: string }[] = [];
  if (key1) accounts.push({ account: 'JGCapital', key: key1 });
  if (key2 && key2 !== key1) accounts.push({ account: 'MatchHome Personal', key: key2 });

  return accounts;
}

export const GET: RequestHandler = async () => {
  try {
    const accounts = getApiKeys();

    if (accounts.length === 0) {
      return json({ error: 'API keys de EasyBroker no configuradas en el servidor.' }, { status: 500 });
    }

    const statusesQuery = 'search[statuses][]=published&search[statuses][]=not_published&search[statuses][]=suspended';
    const rawList: any[] = [];
    const seenIds = new Set<string>();

    for (const acc of accounts) {
      const headers = {
        'X-Authorization': acc.key,
        'accept': 'application/json',
      };

      let page = 1;
      let hasMore = true;

      // 1. Fetch property summaries from list endpoint
      while (hasMore) {
        const data = await fetchWithRetry(`${EB_BASE}?limit=${LIMIT}&page=${page}&${statusesQuery}`, headers);
        if (!data) break;

        for (const item of (data.content ?? [])) {
          if (item.public_id && !seenIds.has(item.public_id)) {
            seenIds.add(item.public_id);
            item._eb_account = acc.account;
            item._eb_key = acc.key;
            rawList.push(item);
          }
        }

        if (data.pagination?.next_page) {
          page++;
        } else {
          hasMore = false;
        }
      }
    }

    // 2. Fetch full property details
    const enrichedProperties: any[] = [];

    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      if (!item.public_id) {
        enrichedProperties.push(item);
        continue;
      }

      const headers = {
        'X-Authorization': item._eb_key || accounts[0].key,
        'accept': 'application/json',
      };

      const detailData = await fetchWithRetry(`${EB_BASE}/${item.public_id}`, headers);
      if (detailData && (detailData.property_images || detailData.images)) {
        enrichedProperties.push({
          ...item,
          ...detailData,
        });
      } else {
        enrichedProperties.push(item);
      }

      // Pause to ensure smooth compliance with EasyBroker API rate limits
      await new Promise(r => setTimeout(r, 40));
    }

    return json({ properties: enrichedProperties, total: enrichedProperties.length });
  } catch (err: any) {
    return json({ error: err.message || 'Error al consultar EasyBroker' }, { status: 500 });
  }
};
