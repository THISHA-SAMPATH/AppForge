import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateStandaloneNextApp, getStandaloneRepoName } from "@/lib/standalone-export";
import type { ApiResponse, AppConfig } from "@/types/config";

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
    const appId = String(body.appId || "");
    const token = String(body.token || process.env.GITHUB_EXPORT_TOKEN || "");
    const requestedRepoName = String(body.repoName || "").trim();
    const isPrivate = Boolean(body.private);

    if (!appId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "App id is required" },
        { status: 400 },
      );
    }

    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "GitHub token is required" },
        { status: 400 },
      );
    }

    const app = await prisma.app.findFirst({
      where: { id: appId, userId: session.user.id },
      include: {
        records: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!app) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "App not found" },
        { status: 404 },
      );
    }

    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.users.getAuthenticated();
    const owner = user.login;
    const repoName = requestedRepoName || getStandaloneRepoName(app.name);
    const files = generateStandaloneNextApp(
      app.name,
      app.config as unknown as AppConfig,
      app.records.map((record) => ({
        id: record.id,
        ...(record.data as Record<string, unknown>),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
    );

    let repoCreated = false;
    try {
      await octokit.repos.get({ owner, repo: repoName });
    } catch {
      await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: isPrivate,
        auto_init: true,
        description: `Generated AppForge Next.js app for ${app.name}`,
      });
      repoCreated = true;
    }

    const { data: ref } = await octokit.git.getRef({
      owner,
      repo: repoName,
      ref: "heads/main",
    });
    const baseSha = ref.object.sha;

    const tree = await Promise.all(
      Object.entries(files).map(async ([path, content]) => {
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo: repoName,
          content: Buffer.from(content).toString("base64"),
          encoding: "base64",
        });

        return {
          path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.sha,
        };
      }),
    );

    const { data: nextTree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      base_tree: baseSha,
      tree,
    });

    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: repoCreated
        ? "Initial AppForge generated Next.js app"
        : "Sync AppForge generated schema and seed data",
      tree: nextTree.sha,
      parents: [baseSha],
    });

    await octokit.git.updateRef({
      owner,
      repo: repoName,
      ref: "heads/main",
      sha: commit.sha,
    });

    const repoUrl = `https://github.com/${owner}/${repoName}`;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        repoUrl,
        repoName: `${owner}/${repoName}`,
        filesCreated: Object.keys(files).length,
        commitSha: commit.sha,
        repoCreated,
      },
    });
  } catch (error) {
    console.error("GitHub export error:", error);
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
