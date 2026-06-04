// The allowed field types in AppForge
export type FieldType = "string" | "number" | "boolean" | "enum" | "date";

// A single field definition
export interface FieldConfig {
  name: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // only for enum type
  defaultValue?: unknown; // optional default
  placeholder?: string; // UI hint
}

// UI layout options
export type LayoutType = "table" | "form" | "detail";

// UI configuration
export interface UIConfig {
  layout: LayoutType;
  title?: string;
  description?: string;
}

// The complete app configuration — source of truth
export interface AppConfig {
  entity: string;
  fields: FieldConfig[];
  ui?: UIConfig;
}

// What the validator returns
export interface ValidationResult {
  valid: boolean;
  config: AppConfig;
  warnings: ValidationWarning[];
  errors: ValidationError[];
}

export interface ValidationWarning {
  field?: string;
  message: string;
  originalValue?: unknown;
  sanitizedValue?: unknown;
}

export interface ValidationError {
  field?: string;
  message: string;
}

// API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}
