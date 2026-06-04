import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateConfig } from "@/engine/validator";
import type { ApiResponse } from "@/types/config";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ appId: string }> };

// GET /api/apps/[appId] — get single app
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { appId } = await params;

    const app = await prisma.app.findFirst({
      where: { id: appId, userId: session.user.id },
      include: {
        _count: { select: { records: true } },
        versions: {
          orderBy: { version: "desc" },
          take: 5,
        },
      },
    });

    if (!app) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "App not found" },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse>({ success: true, data: app });
  } catch (error) {
    console.error("GET /api/apps/[appId] error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PUT /api/apps/[appId] — update app config
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { appId } = await params;
    const body = await request.json();

    const existing = await prisma.app.findFirst({
      where: { id: appId, userId: session.user.id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });

    if (!existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "App not found" },
        { status: 404 },
      );
    }

    const validation = validateConfig(body.config ?? existing.config);
    const nextVersion = (existing.versions[0]?.version ?? 0) + 1;

    // Save old config as a version before updating
    await prisma.appVersion.create({
      data: {
        appId,
        version: nextVersion,
        config: validation.config as unknown as Prisma.InputJsonValue,
      },
    });

    const updated = await prisma.app.update({
      where: { id: appId },
      data: {
        name: body.name?.trim() ?? existing.name,
        description: body.description?.trim() ?? existing.description,
        config: validation.config as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        app: updated,
        validation: {
          warnings: validation.warnings,
          errors: validation.errors,
        },
      },
    });
  } catch (error) {
    console.error("PUT /api/apps/[appId] error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/apps/[appId] — delete app and all its records
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { appId } = await params;

    const existing = await prisma.app.findFirst({
      where: { id: appId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "App not found" },
        { status: 404 },
      );
    }

    await prisma.app.delete({ where: { id: appId } });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: "App deleted successfully" },
    });
  } catch (error) {
    console.error("DELETE /api/apps/[appId] error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
