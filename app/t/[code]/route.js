import { NextResponse } from 'next/server';

import { decodeTicketShortCode } from '@/server/short-links';
import { escapeHtml } from '@/server/ticket-email-template';

export const dynamic = 'force-dynamic';

function downloadPage(downloadUrl) {
  const jsUrl = JSON.stringify(downloadUrl).replace(/</g, '\\u003c');
  const htmlUrl = escapeHtml(downloadUrl);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Downloading your ticket</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;
         background:#eef2f7; color:#0f172a; font-family:Arial,Helvetica,sans-serif; }
  main { max-width:420px; width:100%; padding:28px; border-radius:16px; background:#fff;
         box-shadow:0 24px 48px -18px rgba(15,23,42,.25); }
  h1 { margin:0 0 10px; font-size:20px; }
  p { margin:0; color:#475569; font-size:14px; line-height:1.6; }
  .actions { margin-top:18px; display:flex; flex-wrap:wrap; gap:10px; }
  a,button { font:inherit; font-size:14px; font-weight:bold; padding:10px 16px; border-radius:8px; border:0; cursor:pointer; }
  a { background:#4f46e5; color:#fff; text-decoration:none; }
  button { background:#e2e8f0; color:#0f172a; }
</style>
</head><body>
<main>
  <h1>Downloading your ticket…</h1>
  <p id="status">Your download should start automatically. This page will close.</p>
  <div class="actions" id="fallback" hidden>
    <a href="${htmlUrl}" download>Download again</a>
    <button type="button" id="close">Close this tab</button>
  </div>
</main>
<script>
(function () {
  var link = document.createElement('a');
  link.href = ${jsUrl};
  link.setAttribute('download', '');
  document.body.appendChild(link);
  link.click();
  link.remove();
  document.getElementById('close').addEventListener('click', function () { window.close(); });
  setTimeout(function () {
    window.close();
    setTimeout(function () {
      if (!document.hidden) {
        document.getElementById('status').textContent = 'Your download has started. You can close this tab.';
        document.getElementById('fallback').hidden = false;
      }
    }, 400);
  }, 1000);
})();
</script>
</body></html>`;
}

export async function GET(request, context) {
  const { code } = await context.params;
  const registrationId = decodeTicketShortCode(code);
  if (!registrationId) {
    return NextResponse.redirect(new URL('/find-ticket', request.url), 302);
  }

  const url = new URL(request.url);
  if (url.searchParams.get('download') !== '1') {
    // Viewing a ticket still requires a signed-in session in the SPA.
    return NextResponse.redirect(new URL(`/tickets/${registrationId}`, request.url), 302);
  }

  // Signed email links serve a tiny landing page that starts the download and
  // closes itself. The download URL carries the same signed code, so no
  // session is needed on either request.
  const format = url.searchParams.get('format') === 'jpeg' ? 'jpeg' : 'webp';
  const downloadUrl = `/api/tickets/download/${encodeURIComponent(code)}?format=${format}`;
  return new NextResponse(downloadPage(downloadUrl), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
