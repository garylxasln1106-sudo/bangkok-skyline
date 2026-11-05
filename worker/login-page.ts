function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function renderLoginPage(returnTo: string, message = ""): string {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>登录 · Gary 作品库</title>
<style>
:root{color-scheme:light;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#392a2d;background:#f6f1e8}*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:28px;background:radial-gradient(ellipse at 15% 0%,#e9ded1 0,transparent 55%),#f6f1e8}.card{width:min(100%,460px);padding:48px 40px;border:1px solid #d9c8b9;border-radius:20px;background:#fffaf1;box-shadow:0 24px 80px #4c162510}.eyebrow{font-size:11px;letter-spacing:.23em;color:#8c6b5d;font-weight:650}h1{font-family:Georgia,"Songti SC",serif;font-weight:500;font-size:34px;line-height:1.3;margin:22px 0 14px}.intro{font-size:14px;color:#786765;line-height:1.9;margin-bottom:30px}label{display:block;font-size:13px;margin-bottom:10px}input{font:inherit;width:100%;padding:15px;border:1px solid #cfbdb0;border-radius:9px;background:white;color:#392a2d}input:focus{outline:2px solid #7b243b;outline-offset:3px}button{font:inherit;font-weight:600;width:100%;margin-top:20px;padding:15px;background:#74243a;border:0;border-radius:9px;color:#fffaf1;cursor:pointer}button:hover{background:#5e192d}button:focus-visible{outline:2px solid #74243a;outline-offset:4px}.error{font-size:13px;line-height:1.7;color:#8a233a;margin:16px 0 0}.footer{font-size:11px;letter-spacing:.1em;margin-top:30px;color:#9a8679}@media(max-width:480px){.card{padding:36px 26px}h1{font-size:30px}}
</style></head><body><main class="card"><div class="eyebrow">GARY · PRIVATE LIBRARY</div><h1>把想法，变成作品。</h1><p class="intro">这里收录了培训视频与互动作品。<br>请输入访问密码，继续浏览。</p><form method="post" action="/login"><input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}"><label for="password">访问密码</label><input id="password" name="password" type="password" required maxlength="1024" autocomplete="current-password" autofocus>${message ? `<p class="error" role="alert">${escapeHtml(message)}</p>` : ""}<button type="submit">进入作品库 →</button></form><div class="footer">IDEAS · STORIES · EXPERIENCES</div></main></body></html>`;
}
