import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/types/config";

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

    const updated = await prisma.appRecord.update({
      where: { id: recordId },
      data: { data: { ...(record.data as object), ...body } },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { id: updated.id, ...(updated.data as object) },
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

    await prisma.appRecord.delete({ where: { id: recordId } });

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
