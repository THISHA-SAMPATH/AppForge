import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ appId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { appId } = await params;
    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: { name: true },
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    const manifest = {
      name: app.name,
      short_name: app.name.substring(0, 12),
      description: `AppForge Metadata Generated App: ${app.name}`,
      start_url: `/apps/${appId}`,
      display: "standalone",
      background_color: "#faf4ee",
      theme_color: "#7c6ef5",
      icons: [
        {
          src: "/favicon.ico",
          sizes: "192x192",
          type: "image/png"
        }
      ]
    };

    return NextResponse.json(manifest);
  } catch (error) {
    console.error("GET /api/apps/[appId]/manifest error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
