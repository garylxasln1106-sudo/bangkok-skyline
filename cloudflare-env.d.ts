declare namespace Cloudflare {
  interface Env {
    SITE_PASSWORD: string;
    DB: D1Database;
    BUCKET: R2Bucket;
  }
}
