// OSRM-based routing + Nominatim geocoding (no API key required)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "route";

    // Geocoding
    if (action === "geocode") {
      const q = url.searchParams.get("q");
      if (!q) return json({ error: "missing q" }, 400);
      const r = await fetch(
        `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=in`,
        { headers: { "User-Agent": "RechargeAI-EV/1.0" } },
      );
      const data = await r.json();
      if (!Array.isArray(data) || data.length === 0) return json({ error: "not found" }, 404);
      return json({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name });
    }

    // Routing
    const body = await req.json().catch(() => ({}));
    const coords: [number, number][] = body.coordinates; // [[lng,lat], ...]
    if (!Array.isArray(coords) || coords.length < 2) return json({ error: "need at least 2 coordinates [lng,lat]" }, 400);

    const coordStr = coords.map(([lng, lat]) => `${lng},${lat}`).join(";");
    const osrmUrl = `${OSRM_URL}/${coordStr}?overview=full&geometries=geojson&steps=true&alternatives=false&annotations=duration,distance`;
    const r = await fetch(osrmUrl);
    if (!r.ok) return json({ error: `osrm ${r.status}` }, 502);
    const data = await r.json();
    if (!data.routes?.length) return json({ error: "no route" }, 404);

    const route = data.routes[0];
    const geometry: [number, number][] = route.geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng]);

    const steps: any[] = [];
    for (const leg of route.legs) {
      for (const s of leg.steps) {
        steps.push({
          instruction: s.maneuver?.type
            ? `${s.maneuver.type}${s.maneuver.modifier ? " " + s.maneuver.modifier : ""}${s.name ? " onto " + s.name : ""}`
            : s.name || "Continue",
          distance_m: s.distance,
          duration_s: s.duration,
          location: s.maneuver?.location ? [s.maneuver.location[1], s.maneuver.location[0]] : null,
        });
      }
    }

    return json({
      geometry,
      distance_km: Math.round(route.distance / 100) / 10,
      duration_min: Math.round(route.duration / 60),
      steps,
    });
  } catch (e) {
    console.error("route-planner error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
