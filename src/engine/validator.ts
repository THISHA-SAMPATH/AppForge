import {
  AppConfig,
  FieldConfig,
  FieldType,
  ValidationResult,
  ValidationWarning,
  ValidationError,
  UIConfig,
  LayoutType,
} from "@/types/config";

// Allowed types — anything else gets sanitized to 'string'
const ALLOWED_FIELD_TYPES: FieldType[] = [
  "string",
  "number",
  "boolean",
  "enum",
  "date",
];

const ALLOWED_LAYOUTS: LayoutType[] = ["table", "form", "detail"];

// Sanitize entity name — remove special chars, fallback to 'Item'
function sanitizeEntityName(raw: unknown): {
  value: string;
  warning?: ValidationWarning;
} {
  if (!raw || typeof raw !== "string" || raw.trim() === "") {
    return {
      value: "Item",
      warning: {
        message: 'Entity name missing or invalid — defaulted to "Item"',
        originalValue: raw,
        sanitizedValue: "Item",
      },
    };
  }

  const sanitized = raw
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/^[0-9]+/, "");

  if (sanitized === "") {
    return {
      value: "Item",
      warning: {
        message: `Entity name "${raw}" contains only invalid characters — defaulted to "Item"`,
        originalValue: raw,
        sanitizedValue: "Item",
      },
    };
  }

  if (sanitized !== raw.trim()) {
    return {
      value: sanitized,
      warning: {
        message: `Entity name sanitized`,
        originalValue: raw,
        sanitizedValue: sanitized,
      },
    };
  }

  return { value: sanitized };
}

// Sanitize a single field
function sanitizeField(
  raw: unknown,
  index: number,
): {
  field: FieldConfig | null;
  warnings: ValidationWarning[];
  errors: ValidationError[];
} {
  const warnings: ValidationWarning[] = [];
  const errors: ValidationError[] = [];

  if (!raw || typeof raw !== "object") {
    errors.push({
      message: `Field at index ${index} is not an object — skipped`,
    });
    return { field: null, warnings, errors };
  }

  const rawField = raw as Record<string, unknown>;

  // Sanitize field name
  let name = rawField.name;
  if (!name || typeof name !== "string" || name.trim() === "") {
    const generated = `field_${index + 1}`;
    warnings.push({
      field: String(name),
      message: `Field name missing at index ${index} — generated "${generated}"`,
      originalValue: name,
      sanitizedValue: generated,
    });
    name = generated;
  } else {
    name = String(name)
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, "_");
  }

  // Sanitize field type
  let type = rawField.type as FieldType;
  if (!ALLOWED_FIELD_TYPES.includes(type)) {
    warnings.push({
      field: String(name),
      message: `Unknown field type "${rawField.type}" — defaulted to "string"`,
      originalValue: rawField.type,
      sanitizedValue: "string",
    });
    type = "string";
  }

  // Sanitize enum options
  let options: string[] | undefined;
  if (type === "enum") {
    if (Array.isArray(rawField.options) && rawField.options.length > 0) {
      options = rawField.options
        .filter((o) => o !== null && o !== undefined)
        .map((o) => String(o));
    } else {
      options = ["Option1", "Option2"];
      warnings.push({
        field: String(name),
        message: `Enum field "${name}" has no options — added defaults`,
        originalValue: rawField.options,
        sanitizedValue: options,
      });
    }
  }

  return {
    field: {
      name: String(name),
      type,
      required: Boolean(rawField.required),
      options,
      defaultValue: rawField.defaultValue,
      placeholder: rawField.placeholder
        ? String(rawField.placeholder)
        : undefined,
    },
    warnings,
    errors,
  };
}

// Sanitize UI config
function sanitizeUI(raw: unknown): UIConfig {
  if (!raw || typeof raw !== "object") {
    return { layout: "table" };
  }

  const rawUI = raw as Record<string, unknown>;
  const layout = ALLOWED_LAYOUTS.includes(rawUI.layout as LayoutType)
    ? (rawUI.layout as LayoutType)
    : "table";

  return {
    layout,
    title: rawUI.title ? String(rawUI.title) : undefined,
    description: rawUI.description ? String(rawUI.description) : undefined,
  };
}

// Main validator — call this everywhere
export function validateConfig(raw: unknown): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const errors: ValidationError[] = [];

  // Handle completely null/undefined/non-object input
  if (!raw || typeof raw !== "object") {
    return {
      valid: false,
      config: {
        entity: "Item",
        fields: [],
        ui: { layout: "table" },
      },
      warnings,
      errors: [
        {
          message:
            "Config must be a valid JSON object — received invalid input",
        },
      ],
    };
  }

  const rawConfig = raw as Record<string, unknown>;

  // Sanitize entity
  const entityResult = sanitizeEntityName(rawConfig.entity);
  if (entityResult.warning) warnings.push(entityResult.warning);

  // Sanitize fields
  const rawFields = Array.isArray(rawConfig.fields) ? rawConfig.fields : [];
  if (!Array.isArray(rawConfig.fields)) {
    warnings.push({
      message: "Fields array missing or invalid — starting with empty fields",
      originalValue: rawConfig.fields,
      sanitizedValue: [],
    });
  }

  const sanitizedFields: FieldConfig[] = [];
  for (let i = 0; i < rawFields.length; i++) {
    const result = sanitizeField(rawFields[i], i);
    warnings.push(...result.warnings);
    errors.push(...result.errors);
    if (result.field) sanitizedFields.push(result.field);
  }

  // Deduplicate field names
  const seenNames = new Set<string>();
  const deduplicatedFields = sanitizedFields.map((field) => {
    if (seenNames.has(field.name)) {
      const newName = `${field.name}_${seenNames.size}`;
      warnings.push({
        field: field.name,
        message: `Duplicate field name "${field.name}" — renamed to "${newName}"`,
        originalValue: field.name,
        sanitizedValue: newName,
      });
      seenNames.add(newName);
      return { ...field, name: newName };
    }
    seenNames.add(field.name);
    return field;
  });

  const config: AppConfig = {
    entity: entityResult.value,
    fields: deduplicatedFields,
    ui: sanitizeUI(rawConfig.ui),
  };

  return {
    valid: errors.length === 0,
    config,
    warnings,
    errors,
  };
}
