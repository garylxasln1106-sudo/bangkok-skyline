import { renderLoginPage } from "./login-page";

export interface LibraryEnv {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  SITE_PASSWORD?: string;
  UPLOAD_SECRET?: string;
  UPLOAD_EXPIRES_AT?: string;
}

const COOKIE = "__Host-gary_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const WINDOW_SECONDS = 15 * 60;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const encoder = new TextEncoder();
const COOKIE_OPTIONS = "HttpOnly; Secure; SameSite=Lax; Path=/";
const EXPIRED_COOKIE = `${COOKIE}=; ${COOKIE_OPTIONS}; Max-Age=0`;

function plain(message: string, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response(message, { status, headers });
}

function finish(response: Response, method: string): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("Vary", "Cookie");
  return new Response(method === "HEAD" ? null : response.body, { status: response.status, statusText: response.statusText, headers });
}

function loginPage(returnTo: string, message = "", status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'");
  return new Response(renderLoginPage(returnTo, message), { status, headers });
}

function redirect(location: string, cookie?: string): Response {
  const headers = new Headers({ Location: location });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function secretsEqual(candidate: string, expected: string): Promise<boolean> {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  // Cloudflare's native constant-time comparison avoids JavaScript JIT timing.
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean;
  };
  return subtle.timingSafeEqual(left, right);
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sessionCookie(request: Request): { present: boolean; token: string | null } {
  const matches = (request.headers.get("Cookie") || "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${COOKIE}=`));
  if (!matches.length) return { present: false, token: null };
  const token = matches[0].slice(COOKIE.length + 1);
  return { present: true, token: matches.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null };
}

async function authenticate(request: Request, db: D1Database): Promise<{ authenticated: boolean; present: boolean }> {
  const cookie = sessionCookie(request);
  if (!cookie.token) return { authenticated: false, present: cookie.present };
  const row = await db.prepare("SELECT token_hash FROM library_sessions WHERE token_hash = ? AND expires_at > ?").bind(await sha256(cookie.token), Math.floor(Date.now() / 1000)).first<{ token_hash: string }>();
  return { authenticated: Boolean(row), present: true };
}

function safeReturnTo(value: string | null, origin: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  try {
    const target = new URL(value, origin);
    if (target.origin !== origin || ["/login", "/logout"].includes(target.pathname) || target.pathname.startsWith("/__admin") || target.pathname.startsWith("/_internal")) return "/";
    if (!assetKey(target.pathname)) return "/";
    return target.pathname + target.search;
  } catch { return "/"; }
}

// One decoding pass only. Do not normalize traversal or hidden paths into keys.
function assetKey(pathname: string): string | null {
  try {
    if (/%(?:2f|5c)/i.test(pathname)) return null;
    const decoded = decodeURIComponent(pathname);
    if (!decoded.startsWith("/") || /[\\%\u0000-\u001f\u007f]/.test(decoded)) return null;
    const parts = decoded.split("/").slice(1);
    if (parts.some((part, i) => part.startsWith(".") || (part === "" && i !== parts.length - 1))) return null;
    const key = parts.join("/");
    return key === "" || key.endsWith("/") ? `${key}index.html` : key;
  } catch { return null; }
}

function hasRawTraversal(url: string): boolean {
  const rawPath = url.match(/^https?:\/\/[^/?#]+([^?#]*)/i)?.[1] || "/";
  try { return decodeURIComponent(rawPath).split(/[\\/]/).some((part) => part === "." || part === ".."); }
  catch { return true; }
}

function isHtmlPath(pathname: string, request: Request): boolean {
  return pathname.endsWith("/") || /\.html?$/i.test(pathname) || (!/\.[^/]+$/.test(pathname) && (request.headers.get("Accept") || "").includes("text/html"));
}

function sameOrigin(request: Request, url: URL): boolean {
  return request.headers.get("Origin") === url.origin;
}

interface Reservation { key: string; attempts: number; expires_at: number }

async function releaseReservations(db: D1Database, reservations: Reservation[]): Promise<void> {
  if (!reservations.length) return;
  await db.batch(reservations.map((row) => db.prepare("UPDATE library_login_attempts SET attempts = MAX(attempts - 1, 0) WHERE key = ? AND expires_at = ?").bind(row.key, row.expires_at)));
}

async function reserveLogin(db: D1Database, ip: string, password: string): Promise<{ allowed: boolean; reservations: Reservation[]; retryAfter: number }> {
  const now = Math.floor(Date.now() / 1000);
  // A domain-separated server digest is persisted instead of an IP address.
  // Only Cloudflare's edge-set header is used, never X-Forwarded-For.
  const ipKey = `ip:${await sha256(`library-login-ip:v1\0${password}\0${ip}`)}`;
  const limits: [string, number][] = [[ipKey, 5], ["global", 30]];
  const results = await db.batch<Reservation>(limits.map(([key, limit]) => db.prepare(`
    INSERT INTO library_login_attempts (key, attempts, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      attempts = CASE WHEN library_login_attempts.expires_at <= ? THEN 1 ELSE library_login_attempts.attempts + 1 END,
      expires_at = CASE WHEN library_login_attempts.expires_at <= ? THEN excluded.expires_at ELSE library_login_attempts.expires_at END
    WHERE library_login_attempts.expires_at <= ? OR library_login_attempts.attempts < ?
    RETURNING key, attempts, expires_at
  `).bind(key, now + WINDOW_SECONDS, now, now, now, limit)));
  const reservations = results.flatMap((result) => result.results || []);
  if (reservations.length !== 2) {
    await releaseReservations(db, reservations);
    const rows = await db.prepare("SELECT expires_at FROM library_login_attempts WHERE key IN (?, ?) AND expires_at > ?").bind(ipKey, "global", now).all<{ expires_at: number }>();
    return { allowed: false, reservations: [], retryAfter: Math.max(1, ...rows.results.map((row) => row.expires_at - now)) };
  }
  return { allowed: true, reservations, retryAfter: WINDOW_SECONDS };
}

async function readSmallForm(request: Request): Promise<URLSearchParams | null> {
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/x-www-form-urlencoded") || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 8192) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new URLSearchParams(new TextDecoder().decode(bytes));
}

async function login(request: Request, env: Required<Pick<LibraryEnv, "DB" | "SITE_PASSWORD">>, url: URL, ctx: ExecutionContext): Promise<Response> {
  if (!sameOrigin(request, url)) return plain("Forbidden", 403);
  const form = await readSmallForm(request);
  if (!form || form.getAll("password").length !== 1 || (form.get("password") || "").length > 1024) return plain("Invalid request", 400);
  const returnTo = safeReturnTo(form.get("returnTo"), url.origin);
  const reservation = await reserveLogin(env.DB, request.headers.get("CF-Connecting-IP") || "unknown", env.SITE_PASSWORD);
  if (!reservation.allowed) return loginPage(returnTo, "尝试次数较多，请稍后再试。", 429, { "Retry-After": String(reservation.retryAfter) });
  if (!await secretsEqual(form.get("password") || "", env.SITE_PASSWORD)) return loginPage(returnTo, "密码不正确，请重新输入。", 401);

  const token = randomToken();
  const tokenHash = await sha256(token);
  const previous = sessionCookie(request);
  const previousHash = previous.token ? await sha256(previous.token) : null;
  const now = Math.floor(Date.now() / 1000);
  const statements = [env.DB.prepare("INSERT INTO library_sessions (token_hash, expires_at) VALUES (?, ?)").bind(tokenHash, now + SESSION_SECONDS)];
  if (previousHash) statements.push(env.DB.prepare("DELETE FROM library_sessions WHERE token_hash = ?").bind(previousHash));
  statements.push(...reservation.reservations.map((row) => env.DB.prepare("UPDATE library_login_attempts SET attempts = MAX(attempts - 1, 0) WHERE key = ? AND expires_at = ?").bind(row.key, row.expires_at)));
  await env.DB.batch(statements);
  ctx.waitUntil(env.DB.batch([
    env.DB.prepare("DELETE FROM library_sessions WHERE expires_at <= ?").bind(now),
    env.DB.prepare("DELETE FROM library_login_attempts WHERE expires_at <= ?").bind(now),
  ]).catch(() => undefined));
  return redirect(returnTo, `${COOKIE}=${token}; ${COOKIE_OPTIONS}; Max-Age=${SESSION_SECONDS}`);
}

function contentType(key: string): string {
  const extension = key.split(".").pop()?.toLowerCase() || "";
  const types: Record<string, string> = {
    html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
    json: "application/json; charset=utf-8", txt: "text/plain; charset=utf-8", srt: "text/plain; charset=utf-8", vtt: "text/vtt; charset=utf-8", md: "text/plain; charset=utf-8",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", ico: "image/x-icon", avif: "image/avif",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg",
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", pdf: "application/pdf", glb: "model/gltf-binary", gltf: "model/gltf+json", wasm: "application/wasm",
  };
  return types[extension] || "application/octet-stream";
}

function parseRange(value: string, size: number): { offset: number; length: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    const length = Math.min(suffix, size);
    return { offset: size - length, length };
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
  return { offset: start, length: Math.min(end, size - 1) - start + 1 };
}

async function serveAsset(request: Request, bucket: R2Bucket, key: string): Promise<Response> {
  const metadata = await bucket.head(key);
  if (!metadata) return plain("Not found", 404);
  const headers = new Headers({ "Content-Type": contentType(key), "Accept-Ranges": "bytes", ETag: metadata.httpEtag, "Last-Modified": metadata.uploaded.toUTCString() });
  let range: { offset: number; length: number } | undefined;
  // RFC 9110: Range only modifies GET; HEAD describes the complete object.
  const rangeHeader = request.method === "GET" ? request.headers.get("Range") : null;
  const ifRange = request.headers.get("If-Range");
  const rangeMatches = !ifRange || ifRange === metadata.httpEtag || (Number.isFinite(Date.parse(ifRange)) && metadata.uploaded.getTime() <= Date.parse(ifRange) + 999);
  if (rangeHeader && rangeMatches) {
    const parsed = parseRange(rangeHeader, metadata.size);
    if (!parsed) { headers.set("Content-Range", `bytes */${metadata.size}`); headers.set("Content-Type", "text/plain; charset=utf-8"); return plain("Range not satisfiable", 416, headers); }
    range = parsed;
    headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${metadata.size}`);
  }
  headers.set("Content-Length", String(range?.length ?? metadata.size));
  if (request.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers });
  const object = await bucket.get(key, { ...(range ? { range } : {}), onlyIf: { etagMatches: metadata.etag } });
  if (!object) return plain("Not found", 404);
  if (!("body" in object)) return plain("Please retry", 409);
  return new Response(object.body, { status: range ? 206 : 200, headers });
}

async function upload(request: Request, env: LibraryEnv, url: URL): Promise<Response> {
  const uploadExpires = Number(env.UPLOAD_EXPIRES_AT);
  if (!env.UPLOAD_SECRET || !env.BUCKET || !Number.isFinite(uploadExpires) || uploadExpires <= Date.now()) return plain("Not found", 404);
  const authorization = request.headers.get("Authorization") || "";
  if (authorization.length > 2048 || !authorization.startsWith("Bearer ") || !await secretsEqual(authorization.slice(7), env.UPLOAD_SECRET)) return plain("Unauthorized", 401);
  const rawKey = url.searchParams.get("key");
  if (!rawKey || rawKey.startsWith("/") || rawKey.endsWith("/") || rawKey.startsWith("__admin/") || rawKey.startsWith("_internal/")) return plain("Invalid key", 400);
  const key = assetKey(`/${rawKey}`);
  if (!key || key !== rawKey) return plain("Invalid key", 400);
  const lengthHeader = request.headers.get("Content-Length");
  if (lengthHeader === null || !/^\d+$/.test(lengthHeader)) return plain("Content-Length required", 411);
  const length = Number(lengthHeader);
  if (!Number.isSafeInteger(length) || length > MAX_UPLOAD_BYTES) return plain("File too large", 413);
  if (!request.body || length <= 0) return plain("Empty upload", 400);
  // Enforce the announced length. Hash and R2 consume the stream concurrently.
  const fixed = new FixedLengthStream(length);
  const [objectBody, hashBody] = fixed.readable.tee();
  const workersCrypto = crypto as typeof crypto & { DigestStream: typeof DigestStream };
  const digest = new workersCrypto.DigestStream("SHA-256");
  const digestResult = digest.digest.then((value) => ({ value }), () => ({ value: null }));
  const outcomes = await Promise.allSettled([
    request.body.pipeTo(fixed.writable),
    hashBody.pipeTo(digest),
    env.BUCKET.put(key, objectBody, { httpMetadata: { contentType: contentType(key), cacheControl: "private, no-store" } }),
  ]);
  if (outcomes.some((outcome) => outcome.status === "rejected")) return plain("Upload failed", 400);
  const hashResult = await digestResult;
  const stored = outcomes[2];
  if (stored.status !== "fulfilled" || !stored.value || !hashResult.value) return plain("Upload failed", 500);
  return Response.json({ key, bytes: stored.value.size, sha256: hex(hashResult.value), etag: stored.value.etag });
}

async function dispatch(request: Request, env: LibraryEnv, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (hasRawTraversal(request.url)) return plain("Invalid path", 400);
  if (url.pathname === "/health") return request.method === "GET" || request.method === "HEAD" ? plain("ok") : plain("Method not allowed", 405, { Allow: "GET, HEAD" });
  if (url.pathname === "/__admin/asset") return request.method === "PUT" ? upload(request, env, url) : plain("Method not allowed", 405, { Allow: "PUT" });
  if (!env.DB || !env.BUCKET || !env.SITE_PASSWORD) return plain("Temporarily unavailable", 503);
  const configured = { DB: env.DB, SITE_PASSWORD: env.SITE_PASSWORD };
  if (url.pathname === "/login") {
    if (request.method === "POST") return login(request, configured, url, ctx);
    if (request.method !== "GET" && request.method !== "HEAD") return plain("Method not allowed", 405, { Allow: "GET, HEAD, POST" });
    const returnTo = safeReturnTo(url.searchParams.get("returnTo"), url.origin);
    if ((await authenticate(request, env.DB)).authenticated) return redirect(returnTo);
    return loginPage(returnTo);
  }
  if (url.pathname === "/logout") {
    if (request.method !== "POST") return plain("Method not allowed", 405, { Allow: "POST" });
    if (!sameOrigin(request, url)) return plain("Forbidden", 403);
    const cookie = sessionCookie(request);
    if (cookie.token) await env.DB.prepare("DELETE FROM library_sessions WHERE token_hash = ?").bind(await sha256(cookie.token)).run();
    return redirect("/login", EXPIRED_COOKIE);
  }
  if (request.method !== "GET" && request.method !== "HEAD") return plain("Method not allowed", 405, { Allow: "GET, HEAD" });
  const key = assetKey(url.pathname);
  if (!key) return plain("Invalid path", 400);
  const auth = await authenticate(request, env.DB);
  if (!auth.authenticated) {
    if (auth.present) return plain("Unauthorized", 401, { "Set-Cookie": EXPIRED_COOKIE });
    if (isHtmlPath(url.pathname, request)) return redirect(`/login?returnTo=${encodeURIComponent(safeReturnTo(url.pathname + url.search, url.origin))}`);
    return plain("Unauthorized", 401);
  }
  return serveAsset(request, env.BUCKET, key);
}

export async function handleLibraryRequest(request: Request, env: LibraryEnv, ctx: ExecutionContext): Promise<Response> {
  try { return finish(await dispatch(request, env, ctx), request.method); }
  catch { return finish(plain("Temporarily unavailable", 503), request.method); }
}
