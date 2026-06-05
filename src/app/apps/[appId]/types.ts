import type { AppConfig } from "@/types/config";

export interface ConfigVersion {
  id: string;
  version: number;
  config: AppConfig;
  createdAt: string;
}

export interface AppData {
  id: string;
  name: string;
  description: string | null;
  config: AppConfig;
  createdAt: string;
  updatedAt: string;
  versions: ConfigVersion[];
  _count: { records: number };
}

export interface AppRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

export type WorkspaceView = "table" | "new" | "edit" | "config" | "history" | "github";
