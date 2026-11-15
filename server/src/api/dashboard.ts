import type { FastifyInstance } from "fastify";
import { moduleSourceSchema } from "../../../shared/schemas/day-plan";
import { daysUntil, localDateString, nextOccurrence } from "../services/dates";
import { resolveSource } from "../services/source-items";

export function registerDashboardRoutes(app: FastifyInstance): void {
  app.get("/api/dashboard", async () => {
    const database = app.localDatabase;
    const today = localDateString();
    const weekStartsOn = Number(
      (
        database
          .prepare("SELECT value FROM settings WHERE key = 'weekStartsOn'")
          .get() as { value?: string } | undefined
      )?.value ?? 1
    );
    const weekStart = startOfWeek(today, weekStartsOn);

    const memos = database
      .prepare(
        `SELECT id, content, completed, created_at AS createdAt, updated_at AS updatedAt
         FROM memos ORDER BY completed ASC, updated_at DESC LIMIT 20`
      )
      .all();

    const planRows = database
      .prepare(
        `SELECT id, title, date, start_time AS startTime,
          duration_minutes AS durationMinutes, priority, source_type AS sourceType,
          source_module AS sourceModule, source_id AS sourceId,
          source_title AS sourceTitle, status, notes,
          created_at AS createdAt, updated_at AS updatedAt
         FROM day_plans WHERE date = ?
         ORDER BY coalesce(start_time, '99:99'), created_at LIMIT 5`
      )
      .all(today) as Array<Record<string, unknown>>;
    const plans = planRows.map((plan) => {
      if (plan.sourceType !== "module") {
        return { ...plan, sourceExists: true };
      }
      const parsed = moduleSourceSchema.safeParse(plan.sourceModule);
      const source =
        parsed.success && typeof plan.sourceId === "string"
          ? resolveSource(database, parsed.data, plan.sourceId)
          : null;
      return {
        ...plan,
        title: source?.title ?? plan.sourceTitle ?? plan.title,
        sourceExists: Boolean(source)
      };
    });
    const progressRows = database
      .prepare("SELECT status FROM day_plans WHERE date = ? AND status <> 'cancelled'")
      .all(today) as Array<{ status: string }>;
    const completed = progressRows.filter((row) => row.status === "completed").length;

    const careDates = database
      .prepare(
        "SELECT id, name, date, repeats_yearly AS repeatsYearly, lead_days AS leadDays FROM care_dates"
      )
      .all() as Array<{
      id: string;
      name: string;
      date: string;
      repeatsYearly: number;
      leadDays: number;
    }>;
    const careNext = careDates
      .map((date) => {
        const next = nextOccurrence(date.date, Boolean(date.repeatsYearly));
        return next ? { ...date, next, days: daysUntil(next) } : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.days - b.days)[0];
    const latestStory = database
      .prepare(
        "SELECT title, happened_on AS happenedOn FROM care_stories ORDER BY happened_on DESC LIMIT 1"
      )
      .get();

    const activeDevProjects = numberValue(
      database
        .prepare(
          "SELECT COUNT(*) FROM dev_projects WHERE status = 'active' AND archived = 0"
        )
        .pluck()
        .get()
    );
    const openDevItems = numberValue(
      database
        .prepare(
          "SELECT COUNT(*) FROM dev_items WHERE status NOT IN ('completed', 'cancelled')"
        )
        .pluck()
        .get()
    );
    const devMinutes = numberValue(
      database
        .prepare(
          "SELECT coalesce(SUM(duration_minutes), 0) FROM dev_time_entries WHERE work_date >= ?"
        )
        .pluck()
        .get(weekStart)
    );

    const nextSession = database
      .prepare(
        `SELECT p.next_session_at AS nextSessionAt, c.name AS clientName
         FROM consulting_projects p JOIN consulting_clients c ON c.id = p.client_id
         WHERE p.next_session_at IS NOT NULL
         ORDER BY p.next_session_at LIMIT 1`
      )
      .get();
    const pendingConsultingActions = numberValue(
      database
        .prepare("SELECT COUNT(*) FROM consulting_actions WHERE completed = 0")
        .pluck()
        .get()
    );

    const fitnessCompleted = numberValue(
      database
        .prepare(
          "SELECT COUNT(*) FROM fitness_sessions WHERE status = 'completed' AND session_date >= ?"
        )
        .pluck()
        .get(weekStart)
    );
    const fitnessNext = database
      .prepare(
        "SELECT name, weekday, body_part AS bodyPart FROM fitness_templates ORDER BY weekday LIMIT 1"
      )
      .get();

    const waterMl = numberValue(
      database
        .prepare("SELECT coalesce(SUM(amount_ml), 0) FROM water_logs WHERE log_date = ?")
        .pluck()
        .get(today)
    );
    const nextMeal = database
      .prepare(
        "SELECT meal_type AS mealType, foods, planned_time AS plannedTime FROM meal_plans WHERE plan_date = ? ORDER BY coalesce(planned_time, '99:99') LIMIT 1"
      )
      .get(today);
    const shoppingPending = numberValue(
      database
        .prepare("SELECT COUNT(*) FROM shopping_items WHERE purchased = 0")
        .pluck()
        .get()
    );

    const activeEntertainment = database
      .prepare(
        "SELECT name, media_type AS mediaType, progress FROM entertainment_items WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1"
      )
      .get();
    const entertainmentMinutes = numberValue(
      database
        .prepare(
          "SELECT coalesce(SUM(duration_minutes), 0) FROM entertainment_logs WHERE log_date >= ?"
        )
        .pluck()
        .get(weekStart)
    );

    return {
      date: today,
      memos,
      plans,
      progress: {
        completed,
        total: progressRows.length,
        percent:
          progressRows.length === 0
            ? 0
            : Math.round((completed / progressRows.length) * 100)
      },
      modules: {
        care: careNext
          ? {
              title: careNext.name,
              nextDate: careNext.next,
              days: careNext.days,
              latestStory
            }
          : { latestStory },
        dev: {
          activeProjects: activeDevProjects,
          openItems: openDevItems,
          weekMinutes: devMinutes
        },
        consulting: {
          nextSession,
          pendingActions: pendingConsultingActions
        },
        fitness: {
          completedThisWeek: fitnessCompleted,
          nextPlan: fitnessNext
        },
        diet: {
          nextMeal,
          waterMl,
          shoppingPending
        },
        entertainment: {
          activeItem: activeEntertainment,
          weekMinutes: entertainmentMinutes
        }
      }
    };
  });
}

function numberValue(value: unknown): number {
  return Number(value ?? 0);
}

function startOfWeek(dateValue: string, weekStartsOn: number): string {
  const date = new Date(`${dateValue}T12:00:00`);
  const day = date.getDay();
  const offset = (day - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - offset);
  return localDateString(date);
}
