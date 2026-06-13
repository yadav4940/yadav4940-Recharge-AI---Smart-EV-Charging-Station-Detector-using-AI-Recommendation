const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAPPLS_TOKEN_URL = "https://outpost.mappls.com/api/security/oauth/token";

let cachedToken: { token: string; expiresAt: number } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
      return new Response(JSON.stringify({ access_token: cachedToken.token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("MAPPLS_CLIENT_ID");
    const clientSecret = Deno.env.get("MAPPLS_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error("Mappls credentials not configured");
    }

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

    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    return new Response(JSON.stringify({ access_token: data.access_token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Mappls token error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
