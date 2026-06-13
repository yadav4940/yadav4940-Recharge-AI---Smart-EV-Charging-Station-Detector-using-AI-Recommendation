const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OCM_API_URL = "https://api.openchargemap.io/v3/poi";
const MAPPLS_TOKEN_URL = "https://outpost.mappls.com/api/security/oauth/token";
const MAPPLS_NEARBY_URL = "https://atlas.mappls.com/api/places/nearby/json";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getMapplsToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const clientId = Deno.env.get("MAPPLS_CLIENT_ID");
  const clientSecret = Deno.env.get("MAPPLS_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Mappls credentials not configured");

  const res = await fetch(MAPPLS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Mappls token error [${res.status}]`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const lat = url.searchParams.get("lat") || "20.5937";
    const lng = url.searchParams.get("lng") || "78.9629";
    const radius = url.searchParams.get("radius") || "50"; // km for OCM
    const source = url.searchParams.get("source") || "both"; // "ocm", "mappls", "both"

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return new Response(JSON.stringify({ error: "Invalid lat/lng" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allStations: any[] = [];

    // Source 1: Open Charge Map (free, returns full data with coordinates)
    if (source === "ocm" || source === "both") {
      try {
        const ocmUrl = `${OCM_API_URL}?output=json&latitude=${latNum}&longitude=${lngNum}&distance=${radius}&distanceunit=KM&maxresults=50&compact=true&verbose=false&countrycode=IN`;
        const ocmRes = await fetch(ocmUrl, {
          headers: { "User-Agent": "RechargeAI-App" },
        });
        if (ocmRes.ok) {
          const ocmData = await ocmRes.json();
          for (const poi of ocmData) {
            if (!poi.AddressInfo?.Latitude || !poi.AddressInfo?.Longitude) continue;
            const conns = poi.Connections || [];
            const powerKw = conns.length > 0
              ? Math.max(...conns.map((c: any) => c.PowerKW || 0))
              : 0;
            const connTypes = conns
              .map((c: any) => c.ConnectionType?.Title || "")
              .filter((t: string) => t)
              .slice(0, 3);

            allStations.push({
              id: `ocm-${poi.ID}`,
              name: poi.AddressInfo?.Title || "EV Charging Station",
              address: [poi.AddressInfo?.AddressLine1, poi.AddressInfo?.Town, poi.AddressInfo?.StateOrProvince]
                .filter(Boolean).join(", "),
              latitude: poi.AddressInfo.Latitude,
              longitude: poi.AddressInfo.Longitude,
              availability_status: poi.StatusType?.IsOperational !== false ? "available" : "unavailable",
              charging_power_kw: powerKw,
              charger_types: connTypes.length > 0 ? connTypes : ["Standard"],
              total_slots: poi.NumberOfPoints || conns.length || 1,
              current_load: 0,
              distance_km: poi.AddressInfo?.Distance ? Math.round(poi.AddressInfo.Distance * 10) / 10 : null,
              source: "OpenChargeMap",
            });
          }
        }
      } catch (e) {
        console.warn("OCM fetch failed:", e);
      }
    }

    // Source 2: Mappls (names only, no coords from free tier)
    if (source === "mappls" || source === "both") {
      try {
        const token = await getMapplsToken();
        const radiusM = Math.min(parseInt(radius) * 1000, 50000);
        const mapplsUrl = `${MAPPLS_NEARBY_URL}?keywords=ev%20charging%20station&refLocation=${latNum},${lngNum}&radius=${radiusM}&page=1&sort=dist:asc`;
        const mapplsRes = await fetch(mapplsUrl, {
          headers: { Authorization: `bearer ${token}`, Accept: "application/json" },
        });
        if (mapplsRes.ok) {
          const mapplsData = await mapplsRes.json();
          for (const loc of (mapplsData.suggestedLocations || [])) {
            // Mappls free tier doesn't return coordinates
            // Use distance + bearing estimate from refLocation
            // Skip if we already have the station from OCM (dedup by name similarity)
            const nameExists = allStations.some(
              (s) => s.name.toLowerCase().includes(loc.placeName?.toLowerCase()?.split(" ")[0] || "xxx")
            );
            if (!nameExists && loc.distance) {
              // Approximate position using distance (meters) from refLocation
              // Add small random offset based on distance for map display
              const distKm = loc.distance / 1000;
              const angle = Math.random() * 2 * Math.PI;
              const dLat = (distKm / 111.32) * Math.cos(angle);
              const dLng = (distKm / (111.32 * Math.cos(latNum * Math.PI / 180))) * Math.sin(angle);

              allStations.push({
                id: `mappls-${loc.eLoc}`,
                name: loc.placeName || "EV Station",
                address: loc.placeAddress || "",
                latitude: latNum + dLat,
                longitude: lngNum + dLng,
                availability_status: "available",
                charging_power_kw: 0,
                charger_types: ["Standard"],
                total_slots: 1,
                current_load: 0,
                distance_km: Math.round(distKm * 10) / 10,
                source: "Mappls",
              });
            }
          }
        }
      } catch (e) {
        console.warn("Mappls fetch failed:", e);
      }
    }

    // Sort by distance
    allStations.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));

    return new Response(JSON.stringify({ stations: allStations, total: allStations.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
