import { prisma } from "@/lib/prisma";

export const DEFAULT_TASK_STATUS_OPTIONS = [
  { key: "TODO", systemKey: "TODO", name: "To Do", color: "#E2E8F0", sortOrder: 1, isDefault: true },
  { key: "IN_PROGRESS", systemKey: "IN_PROGRESS", name: "In Progress", color: "#BFDBFE", sortOrder: 2, isDefault: true },
  { key: "REVIEW", systemKey: "REVIEW", name: "Review", color: "#FDE68A", sortOrder: 3, isDefault: true },
  { key: "DONE", systemKey: "DONE", name: "Done", color: "#BBF7D0", sortOrder: 4, isDefault: true },
] as const;

export const DEFAULT_TASK_CATEGORY_OPTIONS = [
  { key: "GST", systemKey: "GST", name: "GST", color: "#14B8A6", sortOrder: 1, isDefault: true },
  { key: "TDS", systemKey: "TDS", name: "TDS", color: "#3B82F6", sortOrder: 2, isDefault: true },
  { key: "ITR", systemKey: "ITR", name: "ITR", color: "#8B5CF6", sortOrder: 3, isDefault: true },
  { key: "ROC", systemKey: "ROC", name: "ROC", color: "#F59E0B", sortOrder: 4, isDefault: true },
  { key: "AUDIT", systemKey: "AUDIT", name: "Audit", color: "#EF4444", sortOrder: 5, isDefault: true },
  { key: "OTHER", systemKey: "OTHER", name: "Other", color: "#64748B", sortOrder: 6, isDefault: true },
] as const;

export async function ensureFirmTaskWorkflow(firmId: string) {
  const [statusOptions, categoryOptions] = await Promise.all([
    prisma.taskStatusOption.findMany({ where: { firmId }, orderBy: { sortOrder: "asc" } }),
    prisma.taskCategoryOption.findMany({ where: { firmId }, orderBy: { sortOrder: "asc" } }),
  ]);

  if (statusOptions.length === 0) {
    await prisma.taskStatusOption.createMany({
      data: DEFAULT_TASK_STATUS_OPTIONS.map((option) => ({
        firmId,
        key: option.key,
        systemKey: option.systemKey,
        name: option.name,
        color: option.color,
        sortOrder: option.sortOrder,
        isDefault: option.isDefault,
        isActive: true,
      })),
    });
  }

  if (categoryOptions.length === 0) {
    await prisma.taskCategoryOption.createMany({
      data: DEFAULT_TASK_CATEGORY_OPTIONS.map((option) => ({
        firmId,
        key: option.key,
        systemKey: option.systemKey,
        name: option.name,
        color: option.color,
        sortOrder: option.sortOrder,
        isDefault: option.isDefault,
        isActive: true,
      })),
    });
  }

  return {
    statusOptions: await prisma.taskStatusOption.findMany({ where: { firmId }, orderBy: { sortOrder: "asc" } }),
    categoryOptions: await prisma.taskCategoryOption.findMany({ where: { firmId }, orderBy: { sortOrder: "asc" } }),
  };
}

export function mapStatusOptionName(status: string, options: Array<{ systemKey: string | null; name: string }>) {
  const option = options.find((item) => item.systemKey === status);
  return option?.name ?? status;
}

export function mapCategoryOptionName(returnType: string, options: Array<{ systemKey: string | null; name: string }>) {
  const option = options.find((item) => item.systemKey === returnType);
  return option?.name ?? returnType;
}

export function resolveStatusOptionId(status: string, options: Array<{ id: string; systemKey: string | null }>) {
  return options.find((item) => item.systemKey === status)?.id;
}

export function resolveCategoryOptionId(returnType: string, options: Array<{ id: string; systemKey: string | null }>) {
  return options.find((item) => item.systemKey === returnType)?.id;
}

export function getTaskStatusLabel(status: string, options: Array<{ systemKey: string | null; name: string }> = []) {
  const option = options.find((item) => item.systemKey === status);
  if (option?.name) return option.name;

  const fallback: Record<string, string> = {
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    REVIEW: "Review",
    DONE: "Done",
  };
  return fallback[status] ?? status;
}

export function getTaskCategoryLabel(returnType: string, options: Array<{ systemKey: string | null; name: string }> = []) {
  const option = options.find((item) => item.systemKey === returnType);
  if (option?.name) return option.name;

  const fallback: Record<string, string> = {
    GST: "GST",
    TDS: "TDS",
    ITR: "ITR",
    ROC: "ROC",
    AUDIT: "Audit",
    OTHER: "Other",
  };
  return fallback[returnType] ?? returnType;
}
