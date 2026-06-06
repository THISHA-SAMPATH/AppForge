import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateConfig } from "@/engine/validator";
import type { ApiResponse, AppConfig } from "@/types/config";
import { Prisma } from "@prisma/client";

type Params = {
  params: Promise<{ appId: string; entity: string; recordId: string }>;
};

// PUT — update a record
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { appId, recordId } = await params;
    const body = await request.json();

    const app = await prisma.app.findFirst({
      where: { id: appId, userId: session.user.id },
    });

    if (!app) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "App not found" },
        { status: 404 },
      );
    }

    const record = await prisma.appRecord.findFirst({
      where: { id: recordId, appId },
    });

    if (!record) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Record not found" },
        { status: 404 },
      );
    }

    const validation = validateConfig(app.config);
    const config: AppConfig = validation.config;

    const existingData = (record.data as Record<string, unknown>) || {};
    const mergedData = { ...existingData, ...body };
    const sanitizedData: Record<string, Prisma.InputJsonValue> = {};

    for (const field of config.fields) {
      const value = mergedData[field.name];
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

    const [updated] = await prisma.$transaction([
      prisma.appRecord.update({
        where: { id: recordId },
        data: { data: sanitizedData as Prisma.InputJsonObject },
      }),
      prisma.app.update({
        where: { id: appId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: updated.id,
        ...(updated.data as Prisma.JsonObject),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error("PUT record error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE — delete a record
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { appId, recordId } = await params;

    const app = await prisma.app.findFirst({
      where: { id: appId, userId: session.user.id },
    });

    if (!app) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "App not found" },
        { status: 404 },
      );
    }

    const record = await prisma.appRecord.findFirst({
      where: { id: recordId, appId },
      select: { id: true },
    });

    if (!record) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Record not found" },
        { status: 404 },
      );
    }

    await prisma.$transaction([
      prisma.appRecord.delete({ where: { id: recordId } }),
      prisma.app.update({
        where: { id: appId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: "Record deleted" },
    });
  } catch (error) {
    console.error("DELETE record error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
