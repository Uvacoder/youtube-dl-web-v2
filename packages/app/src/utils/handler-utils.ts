// cf.
// - https://github.com/hattipjs/hattip/blob/2f5b08335ad55b64a49db63b3d25781e9032e938/packages/base/response/src/index.ts
// - https://github.com/remix-run/remix/blob/5c868dceaa542d0ac61e742f62f7fc08d9f18de2/packages/remix-server-runtime/responses.ts

export function json(data: any, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function redirect(url: string, status: number = 302): Response {
  return new Response(null, {
    status,
    headers: {
      location: url,
    },
  });
}
