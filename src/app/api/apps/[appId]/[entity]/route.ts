import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateConfig } from "@/engine/validator";
import type { ApiResponse, AppConfig } from "@/types/config";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ appId: string; entity: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    const { appId, entity } = await params;
    const app = await prisma.app.findFirst({
      where: { id: appId, userId: session.user.id },
    });
    if (!app)
      return NextResponse.json<ApiResponse>(
        { success: false, error: "App not found" },
        { status: 404 },
      );
    const records = await prisma.appRecord.findMany({
      where: { appId, entity },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json<ApiResponse>({
      success: true,
      data: records.map((r) => ({
        id: r.id,
        ...(r.data as Prisma.JsonObject),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (error) {
    console.error("GET entity error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    const { appId, entity } = await params;
    const body = await request.json();
    const app = await prisma.app.findFirst({
      where: { id: appId, userId: session.user.id },
    });
    if (!app)
      return NextResponse.json<ApiResponse>(
        { success: false, error: "App not found" },
        { status: 404 },
      );

    const validation = validateConfig(app.config);
    const config: AppConfig = validation.config;

    // Build as a plain mutable object, cast to InputJsonObject only when passing to Prisma
    const sanitizedData: Record<string, Prisma.InputJsonValue> = {};

    for (const field of config.fields) {
      const value = body[field.name];
      if (
        field.required &&
        (value === undefined || value === null || value === "")
      ) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `Field "${field.name}" is required` },
          { status: 400 },
        );
      }
      sanitizedData[field.name] = (value ??
        field.defaultValue ??
        null) as Prisma.InputJsonValue;
    }

    const record = await prisma.appRecord.create({
      data: { appId, entity, data: sanitizedData as Prisma.InputJsonObject },
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          id: record.id,
          ...(record.data as Prisma.JsonObject),
          createdAt: record.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST entity error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
