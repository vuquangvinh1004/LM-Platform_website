import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/services/health-service";

export async function GET() {
  const result = await getHealthStatus();

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: result.data.status === "ok",
      service: "lmp",
      ...result.data,
    },
    { status: result.data.status === "ok" ? 200 : 503 },
  );
}
