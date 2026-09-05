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

export const GET: RequestHandler = async () => {
  try {
    const easyBrokerApiKey = env.EASYBROKER_API_KEY || 
      env.VITE_EASYBROKER_API_KEY || 
      process.env.EASYBROKER_API_KEY || 
      process.env.VITE_EASYBROKER_API_KEY || 
      'pqnjps13ry7iaudododsi455mg22mt';

    if (!easyBrokerApiKey) {
      return json({ error: 'API key de EasyBroker no configurada en el servidor.' }, { status: 500 });
    }

    const headers = {
      'X-Authorization': easyBrokerApiKey,
      'accept': 'application/json',
    };

    const rawList: any[] = [];
    let page = 1;
    let hasMore = true;

    // 1. Fetch all property summaries from list endpoint
    while (hasMore) {
      const data = await fetchWithRetry(`${EB_BASE}?limit=${LIMIT}&page=${page}`, headers);
      if (!data) break;

      rawList.push(...(data.content ?? []));

      if (data.pagination?.next_page) {
        page++;
      } else {
        hasMore = false;
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
