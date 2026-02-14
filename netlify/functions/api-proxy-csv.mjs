// Proxies a Google Sheets CSV fetch to avoid CORS issues in the browser.

function isAuthed(req) {
  const auth = req.headers.get("authorization") || "";
  const password = Netlify.env.get("ADMIN_PASSWORD");
  if (!password) return false;
  return auth === `Bearer ${password}`;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!isAuthed(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let { url } = await req.json();
  if (!url || !url.startsWith("https://docs.google.com/")) {
    return new Response(JSON.stringify({ error: "Invalid URL. Must be a Google Sheets URL." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auto-fix common URL issues:
  // - Remove trailing slashes
  url = url.replace(/\/+$/, "");
  // - Convert pubhtml to pub with CSV output
  url = url.replace("/pubhtml", "/pub");
  // - Ensure output=csv is present
  if (!url.includes("output=csv")) {
    url += (url.includes("?") ? "&" : "?") + "output=csv";
  }

  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Google Sheets returned ${res.status}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const csv = await res.text();
    return new Response(JSON.stringify({ csv }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/api/proxy-csv",
};
