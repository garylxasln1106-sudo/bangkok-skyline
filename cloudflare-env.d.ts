declare namespace Cloudflare {
  interface Env {
    SITE_PASSWORD: string;
    UPLOAD_SECRET?: string;
    UPLOAD_EXPIRES_AT?: string;
    DB: D1Database;
    BUCKET: R2Bucket;
  }
}
