import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Check,
  Dumbbell,
  Pencil,
  Plus,
  Scale,
  Trash2
} from "lucide-react";
import { useState } from "react";
import { useUI } from "../../app/UIProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DetailDrawer } from "../../components/DetailDrawer";
import { EmptyState } from "../../components/EmptyState";
import { apiRequest } from "../../lib/api";
import { localDateString } from "../../lib/dates";
import type {
  BodyMetric,
  FitnessData,
  FitnessSession,
  FitnessSessionExercise,
  FitnessTemplate
} from "../../lib/types";

type Editor = { kind: "template"; item?: FitnessTemplate } | { kind: "metric" } | null;
type TemplateInput = Omit<FitnessTemplate, "id" | "exercises"> & {
  exercises: Array<Omit<FitnessTemplate["exercises"][number], "id">>;
};
interface DeleteTarget {
  kind: "template" | "session" | "metric";
  id: string;
  title: string;
}

const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function FitnessPage() {
  const queryClient = useQueryClient();
  const { notify, setSaving, setSaved, setSaveError } = useUI();
  const [editor, setEditor] = useState<Editor>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const fitness = useQuery({
    queryKey: ["fitness"],
    queryFn: () => apiRequest<FitnessData>("/api/fitness")
  });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<Record<string, string>>("/api/settings")
  });

  const activeSession =
    fitness.data?.sessions.find((session) => session.status === "in_progress") ??
    fitness.data?.sessions[0];
  const latestMetric = fitness.data?.metrics[0];
  const weekStart = startOfWeek(Number(settings.data?.weekStartsOn ?? 1));
  const completedThisWeek =
    fitness.data?.sessions.filter(
      (session) => session.status === "completed" && session.sessionDate >= weekStart
    ).length ?? 0;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["fitness"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["day-plan-sources"] });
  }

  async function mutate(path: string, method: string, payload?: object) {
    setSaving();
    try {
      const result = await apiRequest(path, {
        method,
        body: payload ? JSON.stringify(payload) : undefined
      });
      setSaved();
      refresh();
      return result;
    } catch (error) {
      setSaveError();
      notify((error as Error).message, "error");
      throw error;
    }
  }

  async function saveTemplate(data: TemplateInput) {
    const item = editor?.kind === "template" ? editor.item : undefined;
    await mutate(
      item ? `/api/fitness/templates/${item.id}` : "/api/fitness/templates",
      item ? "PATCH" : "POST",
      data
    );
    setEditor(null);
    notify(item ? "训练计划已更新" : "训练计划已创建");
  }

  async function saveMetric(data: Omit<BodyMetric, "id">) {
    await mutate("/api/fitness/metrics", "POST", data);
    setEditor(null);
    notify("身体记录已保存");
  }

  async function startSession(template: FitnessTemplate) {
    await mutate("/api/fitness/sessions", "POST", {
      templateId: template.id,
      sessionDate: localDateString()
    });
    notify(`已开始：${template.name}`);
  }

  async function saveSession(
    session: FitnessSession,
    values: {
      durationMinutes: number | null;
      feelNotes: string;
      status: "in_progress" | "completed";
      exercises: FitnessSessionExercise[];
    }
  ) {
    await mutate(`/api/fitness/sessions/${session.id}`, "PATCH", {
      durationMinutes: values.durationMinutes,
      feelNotes: values.feelNotes,
      status: values.status,
      exercises: values.exercises.map((exercise) => ({
        id: exercise.id,
        actualSets: exercise.actualSets,
        actualReps: exercise.actualReps,
        actualWeight: exercise.actualWeight,
        completed: Boolean(exercise.completed),
        notes: exercise.notes
      }))
    });
    notify(values.status === "completed" ? "训练已完成" : "训练进度已保存");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const paths = {
      template: `/api/fitness/templates/${deleteTarget.id}`,
      session: `/api/fitness/sessions/${deleteTarget.id}`,
      metric: `/api/fitness/metrics/${deleteTarget.id}`
    };
    try {
      setSaving("正在删除…");
      await apiRequest(paths[deleteTarget.kind], { method: "DELETE" });
      setDeleteTarget(null);
      setSaved();
      notify("记录已删除");
      refresh();
    } catch (error) {
      setSaveError();
      notify((error as Error).message, "error");
    }
  }

  if (fitness.isPending) return <div className="page-content"><div className="loading-panel">正在读取训练数据…</div></div>;
  if (fitness.isError) return <div className="page-content"><div className="error-panel">{fitness.error.message}</div></div>;

  return (
    <div className="page-content fitness-page">
      <div className="stat-strip">
        <div><span>本周完成</span><strong>{completedThisWeek} 次</strong></div>
        <div><span>当前体重</span><strong>{latestMetric?.weightKg ? `${latestMetric.weightKg} kg` : "未记录"}</strong></div>
        <div><span>训练模板</span><strong>{fitness.data.templates.length} 个</strong></div>
      </div>

      <section className="panel">
        <div className="panel-head"><div><span className="eyebrow">THIS WEEK</span><h2>本周训练</h2></div><button className="button primary" onClick={() => setEditor({ kind: "template" })} type="button"><Plus size={14} />新建训练</button></div>
        <div className="panel-body training-week">
          {weekdays.map((label, index) => {
            const day = index + 1;
            const templates = fitness.data.templates.filter((template) => template.weekday === day);
            return (
              <div className={`training-day${day === new Date().getDay() || (day === 7 && new Date().getDay() === 0) ? " active" : ""}`} key={label}>
                <strong>{label}</strong>
                {templates.length === 0 ? <span>休息 / 灵活</span> : templates.map((template) => <button className="training-link" onClick={() => setEditor({ kind: "template", item: template })} type="button" key={template.id}>{template.name}</button>)}
              </div>
            );
          })}
        </div>
      </section>

      <div className="fitness-layout">
        <div className="detail-stack">
          <section className="panel">
            <div className="panel-head"><div><span className="eyebrow">SESSION</span><h2>{activeSession ? "最近一次训练" : "开始训练"}</h2></div>{activeSession ? <span className="mini-badge">{activeSession.status === "completed" ? "已完成" : "进行中"}</span> : null}</div>
            <div className="panel-body">
              {activeSession ? (
                <SessionEditor key={activeSession.id} session={activeSession} onSave={(values) => saveSession(activeSession, values)} onDelete={() => setDeleteTarget({ kind: "session", id: activeSession.id, title: `${activeSession.sessionDate} 训练` })} />
              ) : (
                <EmptyState title="还没有训练记录" description="从训练模板开始一次训练，再记录实际组数、次数和重量。" action={fitness.data.templates[0] ? <button className="button primary" onClick={() => void startSession(fitness.data.templates[0])} type="button">开始第一次训练</button> : null} />
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><span className="eyebrow">HISTORY</span><h2>训练历史</h2></div></div>
            <div className="panel-body history-list">
              {fitness.data.sessions.length === 0 ? <div className="inline-empty">还没有历史记录。</div> : fitness.data.sessions.slice(0, 8).map((session) => {
                const template = fitness.data.templates.find((item) => item.id === session.templateId);
                return <div className="history-row" key={session.id}><span className={`history-dot ${session.status}`} /><div><strong>{template?.name ?? "自由训练"}</strong><span>{session.sessionDate} · {session.status === "completed" ? "已完成" : "进行中"}</span></div><span>{session.durationMinutes ?? "—"} 分钟</span><button className="icon-text-button" aria-label="删除训练记录" onClick={() => setDeleteTarget({ kind: "session", id: session.id, title: `${session.sessionDate} 训练` })} type="button"><Trash2 size={12} /></button></div>;
              })}
            </div>
          </section>
        </div>

        <div className="detail-stack">
          <section className="panel">
            <div className="panel-head"><div><span className="eyebrow">TEMPLATES</span><h2>训练模板</h2></div><button className="button secondary" onClick={() => setEditor({ kind: "template" })} type="button"><Plus size={14} />添加</button></div>
            <div className="panel-body template-list">
              {fitness.data.templates.length === 0 ? <div className="inline-empty">还没有训练模板。</div> : fitness.data.templates.map((template) => (
                <div className="template-row" key={template.id}>
                  <span className="template-icon"><Dumbbell size={14} /></span>
                  <div><strong>{template.name}</strong><span>{template.bodyPart || "全身"}{template.weekday ? ` · ${weekdays[template.weekday - 1]}` : ""} · {template.exercises.length} 个动作</span></div>
                  <button className="tiny-text-button" onClick={() => void startSession(template)} type="button">开始</button>
                  <button className="icon-text-button" aria-label={`编辑训练：${template.name}`} onClick={() => setEditor({ kind: "template", item: template })} type="button"><Pencil size={12} /></button>
                  <button className="icon-text-button" aria-label={`删除训练：${template.name}`} onClick={() => setDeleteTarget({ kind: "template", id: template.id, title: template.name })} type="button"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><span className="eyebrow">BODY</span><h2>身体记录</h2></div><button className="button secondary" onClick={() => setEditor({ kind: "metric" })} type="button"><Plus size={14} />记录</button></div>
            <div className="panel-body metric-list">
              {fitness.data.metrics.length === 0 ? <div className="inline-empty">还没有体重或围度记录。</div> : fitness.data.metrics.slice(0, 5).map((metric) => <div className="metric-row" key={metric.id}><Scale size={14} /><div><strong>{metric.weightKg ? `${metric.weightKg} kg` : "未记录体重"}</strong><span>{metric.measuredOn} · 腰围 {metric.waistCm ?? "—"} cm</span></div><button className="icon-text-button" aria-label="删除身体记录" onClick={() => setDeleteTarget({ kind: "metric", id: metric.id, title: `${metric.measuredOn} 身体记录` })} type="button"><Trash2 size={12} /></button></div>)}
            </div>
          </section>
        </div>
      </div>

      <DetailDrawer open={Boolean(editor)} onOpenChange={(open) => { if (!open) setEditor(null); }} title={editor?.kind === "metric" ? "记录身体数据" : editor?.item ? "编辑训练模板" : "新建训练模板"} description="训练与身体数据保存在本地文件中">
        {editor?.kind === "template" ? <TemplateForm item={editor.item} onSave={saveTemplate} /> : null}
        {editor?.kind === "metric" ? <MetricForm onSave={saveMetric} /> : null}
      </DetailDrawer>
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} title="确认删除？" description={deleteTarget?.kind === "template" ? `“${deleteTarget.title}”将被永久删除。已加入今日计划的记录会保留标题快照并标记“来源已删除”。` : `“${deleteTarget?.title ?? ""}”将被永久删除。`} confirmLabel="删除" danger onConfirm={() => void confirmDelete()} />
    </div>
  );
}

function SessionEditor({ session, onSave, onDelete }: { session: FitnessSession; onSave: (value: { durationMinutes: number | null; feelNotes: string; status: "in_progress" | "completed"; exercises: FitnessSessionExercise[] }) => Promise<void>; onDelete: () => void }) {
  const [duration, setDuration] = useState<number | null>(session.durationMinutes);
  const [feelNotes, setFeelNotes] = useState(session.feelNotes);
  const [exercises, setExercises] = useState(session.exercises);
  function patchExercise(id: string, patch: Partial<FitnessSessionExercise>) {
    setExercises((current) => current.map((exercise) => exercise.id === id ? { ...exercise, ...patch } : exercise));
  }
  return (
    <div className="form-stack">
      <div className="session-meta"><div><span>训练日期</span><strong>{session.sessionDate}</strong></div><label className="field"><span>时长（分钟）</span><input min={1} onChange={(event) => setDuration(event.target.value ? Number(event.target.value) : null)} type="number" value={duration ?? ""} /></label></div>
      <div className="exercise-table">
        <div className="exercise-head"><span>动作</span><span>目标</span><span>实际组数</span><span>次数</span><span>重量</span><span>完成</span></div>
        {exercises.map((exercise) => (
          <div className="exercise-row" key={exercise.id}>
            <strong>{exercise.name}</strong>
            <span>{exercise.targetSets ?? "—"} × {exercise.targetReps ?? "—"}{exercise.targetWeight ? ` · ${exercise.targetWeight} kg` : ""}</span>
            <input aria-label={`${exercise.name}实际组数`} min={0} onChange={(event) => patchExercise(exercise.id, { actualSets: event.target.value ? Number(event.target.value) : null })} type="number" value={exercise.actualSets ?? ""} />
            <input aria-label={`${exercise.name}实际次数`} min={0} onChange={(event) => patchExercise(exercise.id, { actualReps: event.target.value ? Number(event.target.value) : null })} type="number" value={exercise.actualReps ?? ""} />
            <input aria-label={`${exercise.name}实际重量`} min={0} onChange={(event) => patchExercise(exercise.id, { actualWeight: event.target.value ? Number(event.target.value) : null })} type="number" value={exercise.actualWeight ?? ""} />
            <button className={`check-button${exercise.completed ? " checked" : ""}`} aria-label={exercise.completed ? `恢复${exercise.name}` : `完成${exercise.name}`} onClick={() => patchExercise(exercise.id, { completed: exercise.completed ? 0 : 1 })} type="button">{exercise.completed ? <Check size={12} /> : null}</button>
          </div>
        ))}
      </div>
      <label className="field"><span>训练感受</span><textarea onChange={(event) => setFeelNotes(event.target.value)} value={feelNotes} /></label>
      <div className="row-actions">
        <button className="button secondary" onClick={() => void onSave({ durationMinutes: duration, feelNotes, status: "in_progress", exercises })} type="button">保存进度</button>
        <button className="button primary" onClick={() => void onSave({ durationMinutes: duration, feelNotes, status: "completed", exercises })} type="button"><Activity size={14} />完成训练</button>
        <button className="icon-text-button" aria-label="删除训练记录" onClick={onDelete} type="button"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function TemplateForm({ item, onSave }: { item?: FitnessTemplate; onSave: (value: TemplateInput) => Promise<void> }) {
  const [form, setForm] = useState<{
    name: string;
    weekday: number | null;
    bodyPart: string;
    durationMinutes: number | null;
  }>({ name: item?.name ?? "", weekday: item?.weekday ?? null, bodyPart: item?.bodyPart ?? "", durationMinutes: item?.durationMinutes ?? 50 });
  const [exercises, setExercises] = useState<TemplateInput["exercises"]>(item?.exercises.map((exercise) => ({ name: exercise.name, targetSets: exercise.targetSets, targetReps: exercise.targetReps, targetWeight: exercise.targetWeight, notes: exercise.notes })) ?? [{ name: "", targetSets: 3, targetReps: 10, targetWeight: null, notes: "" }]);
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave({ ...form, exercises }); }}><label className="field"><span>训练名称</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><div className="two-col"><label className="field"><span>训练日</span><select value={form.weekday ?? ""} onChange={(event) => setForm({ ...form, weekday: event.target.value ? Number(event.target.value) : null })}><option value="">灵活安排</option>{weekdays.map((label, index) => <option value={index + 1} key={label}>{label}</option>)}</select></label><label className="field"><span>训练部位</span><input value={form.bodyPart} onChange={(event) => setForm({ ...form, bodyPart: event.target.value })} /></label></div><label className="field"><span>预计分钟</span><input min={1} type="number" value={form.durationMinutes ?? ""} onChange={(event) => setForm({ ...form, durationMinutes: event.target.value ? Number(event.target.value) : null })} /></label><div className="section-heading"><h3>动作</h3><button className="tiny-text-button" onClick={() => setExercises([...exercises, { name: "", targetSets: 3, targetReps: 10, targetWeight: null, notes: "" }])} type="button">+ 添加动作</button></div>{exercises.map((exercise, index) => <div className="exercise-form-row" key={index}><input aria-label={`动作 ${index + 1} 名称`} placeholder="动作名称" required value={exercise.name} onChange={(event) => setExercises(exercises.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /><input aria-label={`动作 ${index + 1} 组数`} min={1} type="number" value={exercise.targetSets ?? ""} onChange={(event) => setExercises(exercises.map((item, itemIndex) => itemIndex === index ? { ...item, targetSets: event.target.value ? Number(event.target.value) : null } : item))} /><input aria-label={`动作 ${index + 1} 次数`} min={1} type="number" value={exercise.targetReps ?? ""} onChange={(event) => setExercises(exercises.map((item, itemIndex) => itemIndex === index ? { ...item, targetReps: event.target.value ? Number(event.target.value) : null } : item))} /><input aria-label={`动作 ${index + 1} 重量`} min={0} type="number" value={exercise.targetWeight ?? ""} onChange={(event) => setExercises(exercises.map((item, itemIndex) => itemIndex === index ? { ...item, targetWeight: event.target.value ? Number(event.target.value) : null } : item))} /><button className="icon-text-button" aria-label="删除动作" onClick={() => setExercises(exercises.filter((_, itemIndex) => itemIndex !== index))} type="button"><Trash2 size={12} /></button></div>)}<button className="button primary" type="submit">保存训练模板</button></form>;
}

function MetricForm({ onSave }: { onSave: (value: Omit<BodyMetric, "id">) => Promise<void> }) {
  const [form, setForm] = useState({ measuredOn: localDateString(), weightKg: null as number | null, waistCm: null as number | null, chestCm: null as number | null, hipsCm: null as number | null, notes: "" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}><label className="field"><span>记录日期</span><input required type="date" value={form.measuredOn} onChange={(event) => setForm({ ...form, measuredOn: event.target.value })} /></label><div className="two-col"><label className="field"><span>体重（kg）</span><input min={1} step="0.1" type="number" value={form.weightKg ?? ""} onChange={(event) => setForm({ ...form, weightKg: event.target.value ? Number(event.target.value) : null })} /></label><label className="field"><span>腰围（cm）</span><input min={1} step="0.1" type="number" value={form.waistCm ?? ""} onChange={(event) => setForm({ ...form, waistCm: event.target.value ? Number(event.target.value) : null })} /></label></div><div className="two-col"><label className="field"><span>胸围（cm）</span><input min={1} step="0.1" type="number" value={form.chestCm ?? ""} onChange={(event) => setForm({ ...form, chestCm: event.target.value ? Number(event.target.value) : null })} /></label><label className="field"><span>臀围（cm）</span><input min={1} step="0.1" type="number" value={form.hipsCm ?? ""} onChange={(event) => setForm({ ...form, hipsCm: event.target.value ? Number(event.target.value) : null })} /></label></div><label className="field"><span>备注</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="button primary" type="submit">保存身体记录</button></form>;
}

function startOfWeek(weekStartsOn: number) {
  const date = new Date();
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - offset);
  return localDateString(date);
}
