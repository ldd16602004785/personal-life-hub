import type Database from "better-sqlite3";

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE memos (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE day_plans (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT,
        duration_minutes INTEGER,
        priority TEXT NOT NULL DEFAULT 'medium',
        source_type TEXT NOT NULL DEFAULT 'custom',
        source_module TEXT,
        source_id TEXT,
        source_title TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_day_plans_date ON day_plans(date);
      CREATE UNIQUE INDEX idx_day_plans_source_day
        ON day_plans(date, source_module, source_id)
        WHERE source_type = 'module' AND source_id IS NOT NULL;

      CREATE TABLE care_profile (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        relationship_stage TEXT NOT NULL DEFAULT '',
        relationship_start TEXT,
        intro TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE care_dates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'anniversary',
        repeats_yearly INTEGER NOT NULL DEFAULT 1 CHECK (repeats_yearly IN (0, 1)),
        lead_days INTEGER NOT NULL DEFAULT 7,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE care_stories (
        id TEXT PRIMARY KEY,
        happened_on TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        location TEXT NOT NULL DEFAULT '',
        tag TEXT NOT NULL DEFAULT '',
        photo_path TEXT,
        photo_original_name TEXT,
        photo_media_type TEXT,
        photo_size INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_care_stories_date ON care_stories(happened_on);

      CREATE TABLE care_preferences (
        id TEXT PRIMARY KEY,
        group_name TEXT NOT NULL,
        content TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE care_wishes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'wish',
        status TEXT NOT NULL DEFAULT 'idea',
        budget REAL,
        target_date TEXT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE dev_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        start_date TEXT,
        due_date TEXT,
        archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE dev_milestones (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES dev_projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        target_date TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE dev_items (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES dev_projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'feature',
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'todo',
        due_date TEXT,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_dev_items_project ON dev_items(project_id);

      CREATE TABLE dev_time_entries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES dev_projects(id) ON DELETE CASCADE,
        item_id TEXT REFERENCES dev_items(id) ON DELETE SET NULL,
        work_date TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE consulting_clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact_notes TEXT NOT NULL DEFAULT '',
        direction TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE consulting_projects (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES consulting_clients(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        goal TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        start_date TEXT,
        next_session_at TEXT,
        fee_status TEXT NOT NULL DEFAULT 'unquoted',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE consulting_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES consulting_projects(id) ON DELETE CASCADE,
        session_date TEXT NOT NULL,
        duration_minutes INTEGER,
        method TEXT NOT NULL DEFAULT '',
        topics TEXT NOT NULL DEFAULT '',
        conclusions TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE consulting_actions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES consulting_projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        owner TEXT NOT NULL DEFAULT '',
        due_date TEXT,
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE fitness_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        weekday INTEGER CHECK (weekday BETWEEN 1 AND 7),
        body_part TEXT NOT NULL DEFAULT '',
        duration_minutes INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE fitness_template_exercises (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL REFERENCES fitness_templates(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        target_sets INTEGER,
        target_reps INTEGER,
        target_weight REAL,
        notes TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE fitness_sessions (
        id TEXT PRIMARY KEY,
        template_id TEXT REFERENCES fitness_templates(id) ON DELETE SET NULL,
        session_date TEXT NOT NULL,
        duration_minutes INTEGER,
        feel_notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'in_progress',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE fitness_session_exercises (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES fitness_sessions(id) ON DELETE CASCADE,
        source_exercise_id TEXT,
        name TEXT NOT NULL,
        target_sets INTEGER,
        target_reps INTEGER,
        target_weight REAL,
        actual_sets INTEGER,
        actual_reps INTEGER,
        actual_weight REAL,
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
        notes TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE body_metrics (
        id TEXT PRIMARY KEY,
        measured_on TEXT NOT NULL,
        weight_kg REAL,
        waist_cm REAL,
        chest_cm REAL,
        hips_cm REAL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE meal_plans (
        id TEXT PRIMARY KEY,
        plan_date TEXT NOT NULL,
        meal_type TEXT NOT NULL,
        foods TEXT NOT NULL,
        planned_time TEXT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE meal_logs (
        id TEXT PRIMARY KEY,
        log_date TEXT NOT NULL,
        meal_type TEXT NOT NULL,
        foods TEXT NOT NULL,
        eaten_at TEXT,
        feelings TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE water_logs (
        id TEXT PRIMARY KEY,
        log_date TEXT NOT NULL,
        amount_ml INTEGER NOT NULL,
        logged_at TEXT NOT NULL
      );

      CREATE TABLE shopping_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        purchased INTEGER NOT NULL DEFAULT 0 CHECK (purchased IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE entertainment_items (
        id TEXT PRIMARY KEY,
        media_type TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'wishlist',
        progress INTEGER NOT NULL DEFAULT 0,
        start_date TEXT,
        finish_date TEXT,
        rating INTEGER CHECK (rating BETWEEN 1 AND 10),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE entertainment_logs (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES entertainment_items(id) ON DELETE CASCADE,
        log_date TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        progress INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
    `
  },
  {
    version: 2,
    name: "learning_plan_module",
    sql: `
      CREATE TABLE learning_goals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        start_date TEXT,
        target_date TEXT,
        progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE learning_stages (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES learning_goals(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'planning',
        position INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_learning_stages_goal ON learning_stages(goal_id);

      CREATE TABLE learning_tasks (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES learning_goals(id) ON DELETE CASCADE,
        stage_id TEXT REFERENCES learning_stages(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        plan_date TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        estimated_minutes INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_learning_tasks_goal ON learning_tasks(goal_id);
      CREATE INDEX idx_learning_tasks_date ON learning_tasks(plan_date);

      CREATE TABLE learning_logs (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES learning_goals(id) ON DELETE CASCADE,
        task_id TEXT REFERENCES learning_tasks(id) ON DELETE SET NULL,
        study_date TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        progress_after INTEGER CHECK (progress_after BETWEEN 0 AND 100),
        created_at TEXT NOT NULL
      );

      UPDATE day_plans
      SET source_type = 'custom',
          source_module = NULL,
          source_id = NULL,
          source_title = title
      WHERE source_module = 'consulting';

      UPDATE settings
      SET value = '/learning', updated_at = datetime('now')
      WHERE key = 'defaultPage' AND value = '/consulting';
    `
  }
];

export function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    database
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row) => (row as { version: number }).version)
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    database.transaction(() => {
      database.exec(migration.sql);
      database
        .prepare(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
        )
        .run(migration.version, migration.name, new Date().toISOString());
    })();
  }
}
