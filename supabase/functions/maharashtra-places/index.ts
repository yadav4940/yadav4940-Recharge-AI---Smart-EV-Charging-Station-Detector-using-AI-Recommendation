// Fetch all cities, towns, and villages (gaon) in Maharashtra from OpenStreetMap via Overpass API.
// Cached in-memory per edge instance for 24h since data is essentially static.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

type Place = { name: string; lat: number; lng: number; type: string };
let cache: { at: number; data: Place[] } | null = null;
const TTL = 24 * 60 * 60 * 1000;

const QUERY = `[out:json][timeout:120];
area["ISO3166-2"="IN-MH"]->.mh;
(
  node["place"~"^(city|town|village|hamlet|suburb)$"](area.mh);
);
out tags center;`;

async function fetchOverpass(): Promise<Place[]> {
  let lastErr: unknown = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(QUERY),
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass ${url} returned ${res.status}`);
        continue;
      }
      const json = await res.json();
      const places: Place[] = [];
      for (const el of json.elements || []) {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        const name = el.tags?.["name:en"] || el.tags?.name;
        const type = el.tags?.place || "village";
        if (lat == null || lng == null || !name) continue;
        places.push({ name, lat, lng, type });
      }
      return places;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All Overpass endpoints failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!cache || Date.now() - cache.at > TTL) {
      const data = await fetchOverpass();
      // Sort: cities first, then towns, then villages, alphabetical within
      const order: Record<string, number> = { city: 0, town: 1, suburb: 2, village: 3, hamlet: 4 };
      data.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9) || a.name.localeCompare(b.name));
      cache = { at: Date.now(), data };
    }
    return new Response(
      JSON.stringify({ places: cache.data, total: cache.data.length, cached_at: cache.at }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
