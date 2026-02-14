import { getStore } from "@netlify/blobs";

const STORE_NAME = "tune-data";
const MANIFEST_KEY = "manifest";

function collectionKey(id) {
  return `collection-${id}`;
}

function isAuthed(req) {
  const auth = req.headers.get("authorization") || "";
  const password = Netlify.env.get("ADMIN_PASSWORD");
  if (!password) return false;
  return auth === `Bearer ${password}`;
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

async function handleGet() {
  const store = getStore(STORE_NAME);

  const manifestRaw = await store.get(MANIFEST_KEY);
  const collections = manifestRaw ? JSON.parse(manifestRaw) : [];

  const data = {};
  for (const col of collections) {
    const raw = await store.get(collectionKey(col.id));
    data[col.id] = raw ? JSON.parse(raw) : [];
  }

  return new Response(JSON.stringify({ collections, data }), {
    status: 200,
    headers: { ...corsHeaders(), "Cache-Control": "public, max-age=60" },
  });
}

async function handlePost(req) {
  if (!isAuthed(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders(),
    });
  }

  const body = await req.json();
  const { collections, data } = body;
  const store = getStore(STORE_NAME);

  // Get old manifest to find deleted collections
  const oldManifestRaw = await store.get(MANIFEST_KEY);
  const oldCollections = oldManifestRaw ? JSON.parse(oldManifestRaw) : [];
  const newIds = new Set(collections.map((c) => c.id));

  // Delete blobs for removed collections
  for (const old of oldCollections) {
    if (!newIds.has(old.id)) {
      await store.delete(collectionKey(old.id));
    }
  }

  // Write manifest
  await store.set(MANIFEST_KEY, JSON.stringify(collections));

  // Write each collection's data
  for (const col of collections) {
    if (data[col.id] !== undefined) {
      await store.set(collectionKey(col.id), JSON.stringify(data[col.id]));
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: corsHeaders(),
  });
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders() });
  }
  if (req.method === "GET") return handleGet();
  if (req.method === "POST") return handlePost(req);
  return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
};

export const config = {
  path: "/api/tunes",
};
