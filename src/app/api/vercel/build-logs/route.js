import { NextResponse } from "next/server";
import { decodeActorHeader } from "@/lib/actor-header";
import {
  getSafeVercelError,
  getVercelBuildLogViewerConfig,
  getVercelDeploymentEvents,
  isAllowedVercelBuildLogActor,
  listVercelDeployments,
} from "@/lib/vercel-build-logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const actorName = decodeActorHeader(request.headers.get("x-actor-name") || "").trim();
  if (!isAllowedVercelBuildLogActor(actorName)) {
    return NextResponse.json({ ok: false, error: "Vercel build logs ကို Owner အသုံးပြုသူသာ ကြည့်နိုင်ပါသည်။" }, { status: 403 });
  }

  try {
    const deployments = await listVercelDeployments();
    const requestedId = new URL(request.url).searchParams.get("deploymentId") || "";
    const selected = deployments.find((deployment) => deployment.uid === requestedId) || deployments[0] || null;
    const events = selected ? await getVercelDeploymentEvents(selected.uid) : [];
    return NextResponse.json({
      ok: true,
      data: {
        config: getVercelBuildLogViewerConfig(),
        deployments,
        selectedDeploymentId: selected?.uid || null,
        events,
      },
    });
  } catch (error) {
    console.error("Vercel build logs read failed", error?.code || "unknown");
    return NextResponse.json({ ok: false, error: getSafeVercelError(error) }, { status: error?.code === "VERCEL_NOT_CONFIGURED" ? 503 : 502 });
  }
}
