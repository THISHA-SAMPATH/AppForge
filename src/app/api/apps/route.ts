import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateConfig } from "@/engine/validator";
import type { ApiResponse } from "@/types/config";
import { Prisma } from '@prisma/client'

// GET /api/apps — list all apps for current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const apps = await prisma.app.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        config: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { records: true } },
      },
    });

    return NextResponse.json<ApiResponse>({ success: true, data: apps });
  } catch (error) {
    console.error("GET /api/apps error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/apps — create a new app from config
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { name, description, config: rawConfig } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "App name is required" },
        { status: 400 },
      );
    }

    // Run config through validator — never trust raw input
    const validation = validateConfig(rawConfig);

    // Create the app
    const app = await prisma.app.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        config: validation.config as unknown as Prisma.InputJsonValue,
        userId: session.user.id,
      },
    });

    // Save first version
    await prisma.appVersion.create({
      data: {
        appId: app.id,
        version: 1,
        config: validation.config as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          app,
          validation: {
            warnings: validation.warnings,
            errors: validation.errors,
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/apps error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
