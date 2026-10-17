import cloud from "../backend/cloud.cjs";

const app = cloud.createCloudApp();

// A rewrite para /api/index carrega a unica Function. Se a Vercel entregar
// o destino como req.url, reconstruimos a rota original com o parametro apiPath.
export default function handler(req, res) {
  const url = new URL(req.url || "/", "http://internal.local");
  if (url.pathname === "/api/index" || url.pathname === "/api/index.js") {
    const apiPath = url.searchParams.get("apiPath");
    if (typeof apiPath !== "string" || !/^[a-zA-Z0-9_/-]+$/.test(apiPath)) {
      res.statusCode = 404;
      return res.end("Rota da API invalida.");
    }
    url.searchParams.delete("apiPath");
    req.url = "/api/" + apiPath.replace(/^\/+/, "") + url.search;
  }
  return app(req, res);
}
