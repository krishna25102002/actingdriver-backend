// Geoapify client helpers — API key lives ONLY here (backend .env) and is
// never embedded in either React Native app. Routing + geocoding are resolved
// server-side; the vector-tile style JSON is fetched server-side too and its
// tile URLs get the key injected before it is returned to the client (map
// tiles must be loaded directly by MapLibre, so restrict the key to your
// domain on the Geoapify dashboard for production).

function getApiKey() {
    const key = process.env.GEOAPIFY_API_KEY;
    if (!key) {
        throw new Error("GEOAPIFY_API_KEY is not configured on the server");
    }
    return key;
}

// Geoapify "Map Styles API" returns a MapLibre style JSON (vector tiles).
async function fetchStyleJson(styleName) {
    const name = styleName || "osm-bright";
    const url = `https://maps.geoapify.com/v1/styles/${name}/style.json?apiKey=${encodeURIComponent(getApiKey())}`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Geoapify style request failed (${res.status})`);
    }
    const style = await res.json();

    const key = getApiKey();
    const withKey = (value) => {
        if (!value.includes("maps.geoapify.com")) return value;
        // Remove any existing apiKey param (style.json already embeds one for
        // the originating key) without destroying the rest of the query string.
        const stripped = value.replace(/[?&]apiKey=[^&]*/g, "");
        const sep = stripped.includes("?") ? "&" : "?";
        return stripped + sep + `apiKey=${key}`;
    };

    // Inject the key into every tile/sprite/glyph URL so MapLibre can load the
    // tiles directly from Geoapify.
    if (style.sources && typeof style.sources === "object") {
        for (const source of Object.values(style.sources)) {
            if (source && Array.isArray(source.tiles)) {
                source.tiles = source.tiles.map(withKey);
            }
        }
    }
    if (typeof style.sprite === "string") style.sprite = withKey(style.sprite);
    if (typeof style.glyphs === "string") style.glyphs = withKey(style.glyphs);

    return style;
}

// Geoapify Routing — returns encoded polyline; decoded by the client map lib.
async function fetchRoute({ fromLat, fromLng, toLat, toLng, mode }) {
    const routeMode = mode || "drive";
    const url =
        "https://api.geoapify.com/v1/routing?waypoints=" +
        `${fromLat},${fromLng}|${toLat},${toLng}` +
        `&mode=${routeMode}&apiKey=${encodeURIComponent(getApiKey())}`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Geoapify route request failed (${res.status})`);
    }
    return res.json();
}

// Geoapify Geocoding — used for the customer's manual pickup fallback.
async function fetchGeocode(text) {
    if (!text || !text.trim()) {
        throw new Error("Geocode text is required");
    }
    const url =
        "https://api.geoapify.com/v1/geocode/search?text=" +
        `${encodeURIComponent(text.trim())}&apiKey=${encodeURIComponent(getApiKey())}`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Geoapify geocode request failed (${res.status})`);
    }
    const data = await res.json();
    if (!data.features || !data.features.length) {
        throw new Error("No matching location found");
    }
    const feature = data.features[0];
    const { lon, lat } = feature.properties;
    return { latitude: lat, longitude: lon, address: feature.properties.formatted || text.trim() };
}

// Geoapify Reverse Geocoding — turn GPS coordinates into a readable address for
// the customer's "use my current location" pickup/drop button.
async function fetchReverseGeocode(latitude, longitude) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Valid latitude and longitude are required");
    }
    const url =
        "https://api.geoapify.com/v1/geocode/reverse?lat=" +
        `${latitude}&lon=${longitude}&apiKey=${encodeURIComponent(getApiKey())}`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Geoapify reverse geocode request failed (${res.status})`);
    }
    const data = await res.json();
    if (!data.features || !data.features.length) {
        throw new Error("No matching location found");
    }
    const feature = data.features[0];
    const { lon, lat } = feature.properties;
    const p = feature.properties;

    // Build a short "locality, city" label for headers/badges — the full
    // `address` is too long for a dashboard header.
    const city = p.city || p.county || p.state || "";
    const locality =
        p.suburb || p.neighbourhood || p.district || "";
    const shortLabel = locality ? `${locality}, ${city}` : city;

    return {
        latitude: lat,
        longitude: lon,
        address: p.formatted || "",
        locality,
        city,
        shortLabel
    };
}

module.exports = {
    getApiKey,
    fetchStyleJson,
    fetchRoute,
    fetchGeocode,
    fetchReverseGeocode
};