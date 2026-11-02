// Thin client for the optional backend. Every call fails soft: the site still works without it.
const base = () => (window.IIM_API_BASE === undefined ? "" : window.IIM_API_BASE);
const enabled = () => base() !== null;

async function call(path, opts) {
  if (!enabled()) return null;
  try {
    const r = await fetch(base() + path, { cache: "no-store", ...opts });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export const health = async () => (await call("/api/health"))?.ok === true;
export const stats = () => call("/api/stats");
export const aggregate = (iim) => call("/api/aggregate/" + encodeURIComponent(iim));
export const submit = (payload) =>
  call("/api/responses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
