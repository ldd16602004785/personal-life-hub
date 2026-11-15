import type Database from "better-sqlite3";
import type { z } from "zod";
import type { moduleSourceSchema } from "../../../shared/schemas/day-plan";

export type ModuleSource = z.infer<typeof moduleSourceSchema>;

interface SourceDefinition {
  table: string;
  titleColumn: string;
  label: string;
}

const sourceDefinitions: Record<ModuleSource, SourceDefinition[]> = {
  care: [
    { table: "care_wishes", titleColumn: "title", label: "小心愿" },
    { table: "care_dates", titleColumn: "name", label: "重要日期" }
  ],
  dev: [{ table: "dev_items", titleColumn: "title", label: "开发事项" }],
  consulting: [
    { table: "consulting_actions", titleColumn: "title", label: "咨询行动项" }
  ],
  fitness: [
    { table: "fitness_templates", titleColumn: "name", label: "训练计划" }
  ],
  diet: [{ table: "meal_plans", titleColumn: "foods", label: "餐食计划" }],
  entertainment: [
    { table: "entertainment_items", titleColumn: "name", label: "娱乐项目" }
  ]
};

export interface ResolvedSource {
  module: ModuleSource;
  id: string;
  title: string;
  label: string;
}

export function resolveSource(
  database: Database.Database,
  module: ModuleSource,
  id: string
): ResolvedSource | null {
  for (const definition of sourceDefinitions[module]) {
    const row = database
      .prepare(`SELECT ${definition.titleColumn} AS title FROM ${definition.table} WHERE id = ?`)
      .get(id) as { title: string } | undefined;
    if (row) {
      return { module, id, title: row.title, label: definition.label };
    }
  }
  return null;
}

export function listSourceItems(database: Database.Database): ResolvedSource[] {
  const items: ResolvedSource[] = [];
  for (const [module, definitions] of Object.entries(sourceDefinitions) as Array<
    [ModuleSource, SourceDefinition[]]
  >) {
    for (const definition of definitions) {
      const rows = database
        .prepare(
          `SELECT id, ${definition.titleColumn} AS title FROM ${definition.table} ` +
            `ORDER BY rowid DESC LIMIT 100`
        )
        .all() as Array<{ id: string; title: string }>;
      items.push(
        ...rows.map((row) => ({
          module,
          id: row.id,
          title: row.title,
          label: definition.label
        }))
      );
    }
  }
  return items;
}
