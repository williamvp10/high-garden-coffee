import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const base = () => process.env.API_BASE_URL || "http://localhost:8200";
async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host"))
    return NextResponse.json(
      { detail: "Origen no autorizado" },
      { status: 403 },
    );
  const path = (await params).path.map(encodeURIComponent).join("/");
  let token = request.cookies.get("garden_session")?.value;
  const auth = path === "auth/session";
  try {
    if (!token && path === "auth/me") {
      const session = await fetch(base() + "/api/v1/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      });
      if (!session.ok)
        return NextResponse.json(
          { detail: "API no disponible" },
          { status: 503 },
        );
      token = (await session.json()).token;
    }
    const upstream = await fetch(
      base() + "/api/v1/" + path + request.nextUrl.search,
      {
        method: request.method,
        headers: {
          ...(token ? { Authorization: "Bearer " + token } : {}),
          "Content-Type": "application/json",
        },
        body: ["GET", "HEAD"].includes(request.method)
          ? undefined
          : await request.text(),
        cache: "no-store",
        signal: request.signal,
      },
    );
    let response: NextResponse;
    if (auth && upstream.ok) {
      const session = await upstream.json();
      token = session.token;
      response = NextResponse.json({ role: session.role });
    } else {
      response = new NextResponse(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") || "application/json",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
        },
      });
    }
    if (token && (auth || !request.cookies.get("garden_session")))
      response.cookies.set("garden_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE === "true",
        path: "/",
        maxAge: 604800,
      });
    if (upstream.status === 401) response.cookies.delete("garden_session");
    return response;
  } catch {
    return NextResponse.json(
      { detail: "No se pudo conectar con la API" },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
