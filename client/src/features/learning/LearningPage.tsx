import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheck,
  Check,
  Clock3,
  Pencil,
  Plus,
  Trash2
} from "lucide-react";
import { useState } from "react";
import { useUI } from "../../app/UIProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DetailDialog } from "../../components/DetailDialog";
import { EmptyState } from "../../components/EmptyState";
import { ProgressBar } from "../../components/ProgressBar";
import { apiRequest } from "../../lib/api";
import { localDateString } from "../../lib/dates";
import type {
  LearningData,
  LearningGoal,
  LearningLog,
  LearningStage,
  LearningTask
} from "../../lib/types";

type Editor =
  | { kind: "goal"; item?: LearningGoal }
  | { kind: "stage"; item?: LearningStage }
  | { kind: "task"; item?: LearningTask; stageId?: string | null }
  | { kind: "log"; item?: LearningLog; taskId?: string | null }
  | null;

interface DeleteTarget {
  kind: "goal" | "stage" | "task" | "log";
  id: string;
  title: string;
}

export function LearningPage() {
  const queryClient = useQueryClient();
  const { notify, setSaving, setSaved, setSaveError } = useUI();
  const [goalId, setGoalId] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const learning = useQuery({
    queryKey: ["learning"],
    queryFn: () => apiRequest<LearningData>("/api/learning")
  });
  const plans = useQuery({
    queryKey: ["day-plans", localDateString()],
    queryFn: () =>
      apiRequest<{
        plans: Array<{ sourceModule: string | null; sourceId: string | null }>;
      }>(`/api/day-plans?date=${localDateString()}`)
  });

  const activeGoalId = goalId || learning.data?.goals[0]?.id || "";
  const goal = learning.data?.goals.find((item) => item.id === activeGoalId);
  const stages =
    learning.data?.stages.filter((stage) => stage.goalId === activeGoalId) ?? [];
  const tasks =
    learning.data?.tasks.filter((task) => task.goalId === activeGoalId) ?? [];
  const logs =
    learning.data?.logs.filter((log) => log.goalId === activeGoalId) ?? [];
  const scheduledTaskIds = new Set(
    plans.data?.plans
      .filter((plan) => plan.sourceModule === "learning" && plan.sourceId)
      .map((plan) => plan.sourceId as string) ?? []
  );
  const weekStart = startOfWeek();
  const weekMinutes = logs
    .filter((log) => log.studyDate >= weekStart)
    .reduce((sum, log) => sum + log.durationMinutes, 0);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["learning"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["day-plan-sources"] });
    void queryClient.invalidateQueries({ queryKey: ["day-plans"] });
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
      setSaveError(error instanceof Error ? error.message : "保存失败");
      notify(error instanceof Error ? error.message : "保存失败", "error");
      throw error;
    }
  }

  async function saveGoal(data: Omit<LearningGoal, "id">) {
    const item = editor?.kind === "goal" ? editor.item : undefined;
    const result = (await mutate(
      item ? `/api/learning/goals/${item.id}` : "/api/learning/goals",
      item ? "PATCH" : "POST",
      data
    )) as { id: string };
    setGoalId(result.id);
    setEditor(null);
    notify(item ? "学习目标已更新" : "学习目标已创建");
  }

  async function saveStage(data: Omit<LearningStage, "id">) {
    const item = editor?.kind === "stage" ? editor.item : undefined;
    await mutate(
      item ? `/api/learning/stages/${item.id}` : "/api/learning/stages",
      item ? "PATCH" : "POST",
      { ...data, goalId: activeGoalId }
    );
    setEditor(null);
    notify(item ? "学习阶段已更新" : "学习阶段已添加");
  }

  async function saveTask(data: Omit<LearningTask, "id">) {
    const item = editor?.kind === "task" ? editor.item : undefined;
    await mutate(
      item ? `/api/learning/tasks/${item.id}` : "/api/learning/tasks",
      item ? "PATCH" : "POST",
      { ...data, goalId: activeGoalId }
    );
    setEditor(null);
    notify(item ? "学习任务已更新" : "学习任务已添加");
  }

  async function saveLog(data: Omit<LearningLog, "id">) {
    await mutate("/api/learning/logs", "POST", { ...data, goalId: activeGoalId });
    setEditor(null);
    notify("学习记录已保存");
  }

  async function toggleTask(task: LearningTask) {
    await mutate(`/api/learning/tasks/${task.id}`, "PATCH", {
      ...task,
      status: task.status === "completed" ? "todo" : "completed"
    });
  }

  async function addTaskToToday(task: LearningTask) {
    setSaving();
    try {
      await apiRequest("/api/day-plans", {
        method: "POST",
        body: JSON.stringify({
          date: localDateString(),
          sourceModule: "learning",
          sourceId: task.id
        })
      });
      setSaved();
      notify("已加入今日计划");
      refresh();
    } catch (error) {
      if ((error as Error).message.includes("已经安排在今天")) {
        setSaved("该任务已安排");
        notify("该学习任务已安排，无需重复操作");
        void queryClient.invalidateQueries({ queryKey: ["day-plans"] });
        return;
      }
      setSaveError((error as Error).message);
      notify((error as Error).message, "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const paths: Record<DeleteTarget["kind"], string> = {
      goal: `/api/learning/goals/${deleteTarget.id}`,
      stage: `/api/learning/stages/${deleteTarget.id}`,
      task: `/api/learning/tasks/${deleteTarget.id}`,
      log: `/api/learning/logs/${deleteTarget.id}`
    };
    try {
      setSaving("正在删除…");
      await apiRequest(paths[deleteTarget.kind], { method: "DELETE" });
      setDeleteTarget(null);
      setSaved();
      if (deleteTarget.kind === "goal") setGoalId("");
      notify("记录已删除");
      refresh();
    } catch (error) {
      setSaveError((error as Error).message);
      notify((error as Error).message, "error");
    }
  }

  if (learning.isPending) {
    return <div className="page-content"><div className="loading-panel">正在读取学习计划…</div></div>;
  }
  if (learning.isError) {
    return <div className="page-content"><div className="error-panel">{learning.error.message}</div></div>;
  }

  if (learning.data.goals.length === 0) {
    return (
      <div className="page-content">
        <EmptyState
          title="还没有学习目标"
          description="先建立一个学习目标，再拆成阶段和每日任务。"
          action={<button className="button primary" onClick={() => setEditor({ kind: "goal" })} type="button">创建第一个目标</button>}
        />
        <LearningEditor
          editor={editor}
          goalId={activeGoalId}
          stages={stages}
          tasks={tasks}
          onClose={() => setEditor(null)}
          onSaveGoal={saveGoal}
          onSaveStage={saveStage}
          onSaveTask={saveTask}
          onSaveLog={saveLog}
        />
      </div>
    );
  }

  return (
    <div className="page-content learning-page">
      <div className="stat-strip">
        <div><span>学习目标</span><strong>{learning.data.goals.filter((item) => item.status === "active").length} 个进行中</strong></div>
        <div><span>待完成任务</span><strong>{tasks.filter((task) => task.status !== "completed").length}</strong></div>
        <div><span>本周学习</span><strong>{Math.round((weekMinutes / 60) * 10) / 10} 小时</strong></div>
      </div>

      <div className="learning-layout">
        <section className="panel goal-panel">
          <div className="panel-head"><div><span className="eyebrow">GOALS</span><h2>学习目标</h2></div><button className="button secondary" onClick={() => setEditor({ kind: "goal" })} type="button"><Plus size={14} />新建</button></div>
          <div className="panel-body goal-list">
            {learning.data.goals.map((item) => (
              <button className={`goal-row${item.id === activeGoalId ? " active" : ""}`} onClick={() => setGoalId(item.id)} type="button" key={item.id}>
                <span className="goal-icon"><BookOpenCheck size={15} /></span>
                <span><strong>{item.title}</strong><span>{item.category || "个人学习"} · {goalStatusLabel(item.status)}</span></span>
                <span className="goal-progress">{item.progress}%</span>
              </button>
            ))}
          </div>
        </section>

        <div className="detail-stack">
          <section className="panel project-bar">
            <div className="project-select-wrap">
              <span className="eyebrow">当前目标</span>
              <select aria-label="当前学习目标" className="project-select" value={activeGoalId} onChange={(event) => setGoalId(event.target.value)}>
                {learning.data.goals.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
              </select>
              <span className="mini-badge">{goal ? goalStatusLabel(goal.status) : ""}</span>
            </div>
            <div className="row-actions">
              <button className="button secondary" onClick={() => goal && setEditor({ kind: "goal", item: goal })} type="button"><Pencil size={14} />编辑目标</button>
              <button className="button secondary" onClick={() => setEditor({ kind: "stage" })} type="button"><Plus size={14} />添加阶段</button>
              <button className="button primary" onClick={() => setEditor({ kind: "task" })} type="button"><Plus size={14} />添加任务</button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><div><span className="eyebrow">OVERVIEW</span><h2>{goal?.title}</h2></div><button className="button secondary" onClick={() => setEditor({ kind: "log" })} type="button">记录学习</button></div>
            <div className="panel-body">
              <p className="project-goal">{goal?.description || "还没有填写学习目标说明。"}</p>
              <div className="progress-row"><ProgressBar value={goal?.progress ?? 0} label="学习目标进度" /><span>{goal?.progress ?? 0}%</span></div>
              <div className="mini-stats">
                <div><span>开始日期</span><strong>{goal?.startDate ?? "未设置"}</strong></div>
                <div><span>目标日期</span><strong>{goal?.targetDate ?? "未设置"}</strong></div>
                <div><span>学习记录</span><strong>{logs.length} 次</strong></div>
              </div>
            </div>
          </section>

          <div className="learning-details">
            <section className="panel">
              <div className="panel-head"><div><span className="eyebrow">STAGES</span><h2>阶段与每日任务</h2></div><button className="button secondary" onClick={() => setEditor({ kind: "task" })} type="button"><Plus size={14} />任务</button></div>
              <div className="panel-body learning-stages">
                {stages.length === 0 && tasks.length === 0 ? <EmptyState title="还没有拆解学习内容" description="先添加一个阶段或直接创建学习任务。" /> : null}
                {stages.map((stage) => {
                  const stageTasks = tasks.filter((task) => task.stageId === stage.id);
                  return (
                    <div className="learning-stage" key={stage.id}>
                      <div className="learning-stage-head"><strong>{stage.title}</strong><span className={`status-tag ${stage.status}`}>{stageStatusLabel(stage.status)}</span><button className="icon-text-button" aria-label={`编辑阶段：${stage.title}`} onClick={() => setEditor({ kind: "stage", item: stage })} type="button"><Pencil size={12} /></button><button className="icon-text-button" aria-label={`删除阶段：${stage.title}`} onClick={() => setDeleteTarget({ kind: "stage", id: stage.id, title: stage.title })} type="button"><Trash2 size={12} /></button></div>
                      {stageTasks.map((task) => <TaskRow key={task.id} task={task} scheduled={scheduledTaskIds.has(task.id)} onToggle={() => void toggleTask(task)} onEdit={() => setEditor({ kind: "task", item: task, stageId: stage.id })} onArrange={() => void addTaskToToday(task)} onDelete={() => setDeleteTarget({ kind: "task", id: task.id, title: task.title })} onLog={() => setEditor({ kind: "log", taskId: task.id })} />)}
                      <button className="tiny-text-button stage-add" onClick={() => setEditor({ kind: "task", stageId: stage.id })} type="button">+ 在这个阶段添加任务</button>
                    </div>
                  );
                })}
                {tasks.filter((task) => !task.stageId).map((task) => <TaskRow key={task.id} task={task} scheduled={scheduledTaskIds.has(task.id)} onToggle={() => void toggleTask(task)} onEdit={() => setEditor({ kind: "task", item: task })} onArrange={() => void addTaskToToday(task)} onDelete={() => setDeleteTarget({ kind: "task", id: task.id, title: task.title })} onLog={() => setEditor({ kind: "log", taskId: task.id })} />)}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head"><div><span className="eyebrow">LOGS</span><h2>学习记录</h2></div><button className="button secondary" onClick={() => setEditor({ kind: "log" })} type="button">记录</button></div>
              <div className="panel-body learning-log-list">
                {logs.length === 0 ? <div className="inline-empty">还没有学习记录。</div> : logs.map((log) => (
                  <div className="learning-log" key={log.id}>
                    <span className="learning-log-icon"><Clock3 size={13} /></span>
                    <div><strong>{log.studyDate} · {log.durationMinutes} 分钟</strong><span>{tasks.find((task) => task.id === log.taskId)?.title ?? "自由学习"}{log.progressAfter !== null ? ` · 进度 ${log.progressAfter}%` : ""}</span><p>{log.content || "没有补充学习内容"}</p></div>
                    <button className="icon-text-button" aria-label={`删除学习记录：${log.studyDate}`} onClick={() => setDeleteTarget({ kind: "log", id: log.id, title: `${log.studyDate} 学习记录` })} type="button"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      <LearningEditor
        editor={editor}
        goalId={activeGoalId}
        stages={stages}
        tasks={tasks}
        onClose={() => setEditor(null)}
        onSaveGoal={saveGoal}
        onSaveStage={saveStage}
        onSaveTask={saveTask}
        onSaveLog={saveLog}
      />
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} title="确认删除？" description={deleteTarget?.kind === "task" ? `“${deleteTarget.title}”及其学习记录将被删除。已加入今日计划的记录会保留标题快照。` : `“${deleteTarget?.title ?? ""}”将被永久删除。`} confirmLabel="删除" danger onConfirm={() => void confirmDelete()} />
    </div>
  );
}

function TaskRow({ task, scheduled, onToggle, onEdit, onArrange, onDelete, onLog }: { task: LearningTask; scheduled: boolean; onToggle: () => void; onEdit: () => void; onArrange: () => void; onDelete: () => void; onLog: () => void }) {
  return <div className={`learning-task${task.status === "completed" ? " completed" : ""}`}><button className={`check-button${task.status === "completed" ? " checked" : ""}`} aria-label={task.status === "completed" ? `恢复任务：${task.title}` : `完成任务：${task.title}`} onClick={onToggle} type="button">{task.status === "completed" ? <Check size={12} /> : null}</button><button className="learning-task-copy" onClick={onEdit} type="button"><strong>{task.title}</strong><span>{task.planDate ?? "待安排"}{task.estimatedMinutes ? ` · ${task.estimatedMinutes} 分钟` : ""}</span></button><button className="tiny-text-button" onClick={onLog} type="button">记录</button><button className="tiny-text-button" disabled={scheduled} onClick={onArrange} type="button">{scheduled ? "已安排" : "安排"}</button><button className="icon-text-button" aria-label={`删除任务：${task.title}`} onClick={onDelete} type="button"><Trash2 size={12} /></button></div>;
}

function LearningEditor({ editor, goalId, stages, tasks, onClose, onSaveGoal, onSaveStage, onSaveTask, onSaveLog }: { editor: Editor; goalId: string; stages: LearningStage[]; tasks: LearningTask[]; onClose: () => void; onSaveGoal: (value: Omit<LearningGoal, "id">) => Promise<void>; onSaveStage: (value: Omit<LearningStage, "id">) => Promise<void>; onSaveTask: (value: Omit<LearningTask, "id">) => Promise<void>; onSaveLog: (value: Omit<LearningLog, "id">) => Promise<void> }) {
  return <DetailDialog open={Boolean(editor)} onOpenChange={(open) => { if (!open) onClose(); }} title={learningEditorTitle(editor)} description="学习计划保存在本地文件中">
    {editor?.kind === "goal" ? <GoalForm item={editor.item} onSave={onSaveGoal} /> : null}
    {editor?.kind === "stage" ? <StageForm item={editor.item} onSave={onSaveStage} /> : null}
    {editor?.kind === "task" ? <TaskForm item={editor.item} stageId={editor.stageId} stages={stages} onSave={onSaveTask} /> : null}
    {editor?.kind === "log" ? <LogForm item={editor.item} taskId={editor.taskId} goalId={goalId} tasks={tasks} onSave={onSaveLog} /> : null}
  </DetailDialog>;
}

function GoalForm({ item, onSave }: { item?: LearningGoal; onSave: (value: Omit<LearningGoal, "id">) => Promise<void> }) {
  const [form, setForm] = useState<Omit<LearningGoal, "id">>({ title: item?.title ?? "", description: item?.description ?? "", category: item?.category ?? "", status: item?.status ?? "active", startDate: item?.startDate ?? localDateString(), targetDate: item?.targetDate ?? null, progress: item?.progress ?? 0 });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}><label className="field"><span>学习目标</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field"><span>目标说明</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="two-col"><label className="field"><span>分类</span><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="技能、考试、阅读" /></label><label className="field"><span>状态</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LearningGoal["status"] })}><option value="planning">规划中</option><option value="active">进行中</option><option value="paused">暂停</option><option value="completed">已完成</option></select></label></div><div className="two-col"><label className="field"><span>开始日期</span><input type="date" value={form.startDate ?? ""} onChange={(event) => setForm({ ...form, startDate: event.target.value || null })} /></label><label className="field"><span>目标日期</span><input type="date" value={form.targetDate ?? ""} onChange={(event) => setForm({ ...form, targetDate: event.target.value || null })} /></label></div><label className="field"><span>当前进度（%）</span><input max={100} min={0} type="number" value={form.progress} onChange={(event) => setForm({ ...form, progress: Number(event.target.value) })} /></label><button className="button primary" type="submit">保存学习目标</button></form>;
}

function StageForm({ item, onSave }: { item?: LearningStage; onSave: (value: Omit<LearningStage, "id">) => Promise<void> }) {
  const [form, setForm] = useState<Omit<LearningStage, "id">>({ goalId: item?.goalId ?? "", title: item?.title ?? "", status: item?.status ?? "planning", position: item?.position ?? 0, notes: item?.notes ?? "" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}><label className="field"><span>阶段或章节名称</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><div className="two-col"><label className="field"><span>状态</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LearningStage["status"] })}><option value="planning">未开始</option><option value="in_progress">进行中</option><option value="completed">已完成</option></select></label><label className="field"><span>顺序</span><input min={0} type="number" value={form.position} onChange={(event) => setForm({ ...form, position: Number(event.target.value) })} /></label></div><label className="field"><span>备注</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="button primary" type="submit">保存学习阶段</button></form>;
}

function TaskForm({ item, stageId, stages, onSave }: { item?: LearningTask; stageId?: string | null; stages: LearningStage[]; onSave: (value: Omit<LearningTask, "id">) => Promise<void> }) {
  const [form, setForm] = useState<Omit<LearningTask, "id">>({ goalId: item?.goalId ?? "", stageId: item?.stageId ?? stageId ?? null, title: item?.title ?? "", planDate: item?.planDate ?? localDateString(), status: item?.status ?? "todo", estimatedMinutes: item?.estimatedMinutes ?? 30, notes: item?.notes ?? "" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}><label className="field"><span>学习任务</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field"><span>所属阶段</span><select value={form.stageId ?? ""} onChange={(event) => setForm({ ...form, stageId: event.target.value || null })}><option value="">不指定阶段</option>{stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.title}</option>)}</select></label><div className="two-col"><label className="field"><span>计划日期</span><input type="date" value={form.planDate ?? ""} onChange={(event) => setForm({ ...form, planDate: event.target.value || null })} /></label><label className="field"><span>预计分钟</span><input min={1} type="number" value={form.estimatedMinutes ?? ""} onChange={(event) => setForm({ ...form, estimatedMinutes: event.target.value ? Number(event.target.value) : null })} /></label></div><label className="field"><span>状态</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LearningTask["status"] })}><option value="todo">待开始</option><option value="in_progress">进行中</option><option value="completed">已完成</option></select></label><label className="field"><span>备注</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="button primary" type="submit">保存学习任务</button></form>;
}

function LogForm({ item, taskId, goalId, tasks, onSave }: { item?: LearningLog; taskId?: string | null; goalId: string; tasks: LearningTask[]; onSave: (value: Omit<LearningLog, "id">) => Promise<void> }) {
  const [form, setForm] = useState<Omit<LearningLog, "id">>({ goalId, taskId: item?.taskId ?? taskId ?? null, studyDate: item?.studyDate ?? localDateString(), durationMinutes: item?.durationMinutes ?? 30, content: item?.content ?? "", progressAfter: item?.progressAfter ?? null });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}><label className="field"><span>学习日期</span><input required type="date" value={form.studyDate} onChange={(event) => setForm({ ...form, studyDate: event.target.value })} /></label><label className="field"><span>关联任务</span><select value={form.taskId ?? ""} onChange={(event) => setForm({ ...form, taskId: event.target.value || null })}><option value="">自由学习</option>{tasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select></label><div className="two-col"><label className="field"><span>学习分钟</span><input min={1} required type="number" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} /></label><label className="field"><span>学习后进度</span><input max={100} min={0} type="number" value={form.progressAfter ?? ""} onChange={(event) => setForm({ ...form, progressAfter: event.target.value ? Number(event.target.value) : null })} /></label></div><label className="field"><span>学习内容与收获</span><textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label><button className="button primary" type="submit">保存学习记录</button></form>;
}

function goalStatusLabel(status: LearningGoal["status"]) {
  return { planning: "规划中", active: "进行中", paused: "暂停", completed: "已完成" }[status];
}
function stageStatusLabel(status: LearningStage["status"]) {
  return { planning: "未开始", in_progress: "进行中", completed: "已完成" }[status];
}
function learningEditorTitle(editor: Editor) {
  if (!editor) return "";
  return `${editor.item ? "编辑" : "添加"}${{ goal: "学习目标", stage: "学习阶段", task: "学习任务", log: "学习记录" }[editor.kind]}`;
}
function startOfWeek() {
  const date = new Date();
  const offset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() - offset);
  return localDateString(date);
}
