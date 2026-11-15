export interface Memo {
  id: string;
  content: string;
  completed: number;
  createdAt: string;
  updatedAt: string;
}

export interface DayPlan {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  durationMinutes: number | null;
  priority: "low" | "medium" | "high";
  sourceType: "custom" | "module";
  sourceModule: string | null;
  sourceId: string | null;
  sourceTitle: string | null;
  sourceExists: boolean;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SourceItem {
  module: string;
  id: string;
  title: string;
  label: string;
}

export interface DayPlansResponse {
  date: string;
  plans: DayPlan[];
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
}

export interface DashboardData {
  date: string;
  memos: Memo[];
  plans: DayPlan[];
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
  modules: {
    care: {
      title?: string;
      nextDate?: string;
      days?: number;
      latestStory?: { title: string; happenedOn: string };
    };
    dev: {
      activeProjects: number;
      openItems: number;
      weekMinutes: number;
    };
    consulting: {
      nextSession?: { nextSessionAt: string; clientName: string };
      pendingActions: number;
    };
    fitness: {
      completedThisWeek: number;
      nextPlan?: { name: string; weekday: number; bodyPart: string };
    };
    diet: {
      nextMeal?: { mealType: string; foods: string; plannedTime: string | null };
      waterMl: number;
      shoppingPending: number;
    };
    entertainment: {
      activeItem?: { name: string; mediaType: string; progress: number };
      weekMinutes: number;
    };
  };
}

export interface CareProfile {
  id: string;
  name: string;
  relationshipStage: string;
  relationshipStart: string | null;
  intro: string;
  updatedAt: string | null;
}

export interface CareDate {
  id: string;
  name: string;
  date: string;
  type: "birthday" | "anniversary" | "first_meet" | "other";
  repeatsYearly: boolean;
  leadDays: number;
  notes: string;
  nextDate: string | null;
  days: number | null;
  attention: boolean;
}

export interface CareStory {
  id: string;
  happenedOn: string;
  title: string;
  content: string;
  location: string;
  tag: string;
  photoPath: string | null;
  photoOriginalName: string | null;
  photoMediaType: string | null;
  photoSize: number | null;
  photoUrl: string | null;
}

export interface CarePreference {
  id: string;
  groupName: "like" | "dislike" | "gift" | "other";
  content: string;
  notes: string;
}

export interface CareWish {
  id: string;
  title: string;
  type: "wish" | "gift" | "date" | "other";
  status: "idea" | "planning" | "completed";
  budget: number | null;
  targetDate: string | null;
  notes: string;
}

export interface CareData {
  profile: CareProfile;
  dates: CareDate[];
  stories: CareStory[];
  preferences: CarePreference[];
  wishes: CareWish[];
  overview: {
    nextDate: CareDate | null;
    storyCount: number;
    dateCount: number;
  };
}

export interface DevProject {
  id: string;
  name: string;
  description: string;
  status: "planning" | "active" | "paused" | "completed";
  startDate: string | null;
  dueDate: string | null;
  archived: number;
  itemCount?: number;
  completedCount?: number;
  totalMinutes?: number;
  nextMilestone?: string | null;
}

export interface DevItem {
  id: string;
  projectId: string;
  title: string;
  type: "feature" | "bug" | "improvement" | "note" | "other";
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "review" | "completed" | "cancelled";
  dueDate: string | null;
  description: string;
}

export interface DevMilestone {
  id: string;
  projectId: string;
  name: string;
  targetDate: string;
  completed: number;
}

export interface DevTimeEntry {
  id: string;
  projectId: string;
  itemId: string | null;
  workDate: string;
  durationMinutes: number;
  notes: string;
}

export interface DevData {
  projects: DevProject[];
  items: DevItem[];
  milestones: DevMilestone[];
  timeEntries: DevTimeEntry[];
}

export interface ConsultingClient {
  id: string;
  name: string;
  contactNotes: string;
  direction: string;
  status: "active" | "paused" | "archived";
  archived: number;
}

export interface ConsultingProject {
  id: string;
  clientId: string;
  name: string;
  goal: string;
  status: "intake" | "active" | "paused" | "completed";
  startDate: string | null;
  nextSessionAt: string | null;
  feeStatus: "unquoted" | "pending" | "partial" | "paid" | "not_required";
}

export interface ConsultingSession {
  id: string;
  projectId: string;
  sessionDate: string;
  durationMinutes: number | null;
  method: string;
  topics: string;
  conclusions: string;
  notes: string;
}

export interface ConsultingAction {
  id: string;
  projectId: string;
  title: string;
  owner: string;
  dueDate: string | null;
  completed: number;
}

export interface ConsultingData {
  clients: ConsultingClient[];
  projects: ConsultingProject[];
  sessions: ConsultingSession[];
  actions: ConsultingAction[];
}

export interface FitnessExercise {
  id: string;
  templateId?: string;
  name: string;
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  notes: string;
}

export interface FitnessTemplate {
  id: string;
  name: string;
  weekday: number | null;
  bodyPart: string;
  durationMinutes: number | null;
  exercises: FitnessExercise[];
}

export interface FitnessSessionExercise {
  id: string;
  sessionId: string;
  name: string;
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  actualSets: number | null;
  actualReps: number | null;
  actualWeight: number | null;
  completed: number;
  notes: string;
}

export interface FitnessSession {
  id: string;
  templateId: string | null;
  sessionDate: string;
  durationMinutes: number | null;
  feelNotes: string;
  status: "in_progress" | "completed";
  exercises: FitnessSessionExercise[];
}

export interface BodyMetric {
  id: string;
  measuredOn: string;
  weightKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  hipsCm: number | null;
  notes: string;
}

export interface FitnessData {
  templates: FitnessTemplate[];
  sessions: FitnessSession[];
  metrics: BodyMetric[];
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealPlan {
  id: string;
  planDate: string;
  mealType: MealType;
  foods: string;
  plannedTime: string | null;
  notes: string;
}

export interface MealLog {
  id: string;
  logDate: string;
  mealType: MealType;
  foods: string;
  eatenAt: string | null;
  feelings: string;
}

export interface WaterLog {
  id: string;
  logDate: string;
  amountMl: number;
  loggedAt: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  purchased: number;
}

export interface DietData {
  date: string;
  mealPlans: MealPlan[];
  mealLogs: MealLog[];
  waterLogs: WaterLog[];
  waterTotal: number;
  shopping: ShoppingItem[];
  recentMeals: Array<{ foods: string; mealType: MealType; lastDate: string }>;
}

export interface EntertainmentItem {
  id: string;
  mediaType: "game" | "film" | "book" | "other";
  name: string;
  status: "wishlist" | "active" | "completed" | "paused";
  progress: number;
  startDate: string | null;
  finishDate: string | null;
  rating: number | null;
  notes: string;
}

export interface EntertainmentLog {
  id: string;
  itemId: string;
  logDate: string;
  durationMinutes: number;
  progress: number | null;
  notes: string;
}

export interface EntertainmentData {
  items: EntertainmentItem[];
  logs: EntertainmentLog[];
}

export interface DataStatus {
  ready: boolean;
  dataDir: string;
  databasePath: string;
  databaseSize: number;
  attachmentSize: number;
  backupCount: number;
  lastDatabaseWrite: string | null;
}

export interface BackupInfo {
  filename: string;
  createdAt: string;
  size: number;
  reason: string;
}
