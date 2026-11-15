import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  Clock3,
  Pencil,
  Plus,
  Trash2
} from "lucide-react";
import { useState } from "react";
import { useUI } from "../../app/UIProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DetailDrawer } from "../../components/DetailDrawer";
import { EmptyState } from "../../components/EmptyState";
import { apiRequest } from "../../lib/api";
import { localDateString } from "../../lib/dates";
import type { DevData, DevItem, DevMilestone, DevProject, DevTimeEntry } from "../../lib/types";

type Editor =
  | { kind: "project"; item?: DevProject }
  | { kind: "item"; item?: DevItem }
  | { kind: "milestone"; item?: DevMilestone }
  | { kind: "time"; item?: DevTimeEntry }
  | null;

interface DeleteTarget {
  kind: "project" | "item" | "milestone" | "time";
  id: string;
  title: string;
}

const columns: Array<{ key: DevItem["status"]; label: string }> = [
  { key: "todo", label: "待处理" },
  { key: "in_progress", label: "进行中" },
  { key: "review", label: "待验收" },
  { key: "completed", label: "已完成" }
];

export function DevPage() {
  const queryClient = useQueryClient();
  const { notify, setSaving, setSaved, setSaveError } = useUI();
  const [projectId, setProjectId] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const dev = useQuery({
    queryKey: ["dev"],
    queryFn: () => apiRequest<DevData>("/api/dev")
  });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<Record<string, string>>("/api/settings")
  });

  const activeProjectId = projectId || dev.data?.projects[0]?.id || "";
  const project = dev.data?.projects.find((item) => item.id === activeProjectId);
  const projectItems = dev.data?.items.filter((item) => item.projectId === activeProjectId) ?? [];
  const milestones = dev.data?.milestones.filter((item) => item.projectId === activeProjectId) ?? [];
  const timeEntries = dev.data?.timeEntries.filter((item) => item.projectId === activeProjectId) ?? [];
  const weekMinutes = timeEntries
    .filter(
      (entry) =>
        entry.workDate >= startOfWeek(Number(settings.data?.weekStartsOn ?? 1))
    )
    .reduce((sum, entry) => sum + entry.durationMinutes, 0);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["dev"] });
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

  async function saveProject(data: Omit<DevProject, "id" | "archived" | "itemCount" | "completedCount" | "totalMinutes" | "nextMilestone">) {
    const item = editor?.kind === "project" ? editor.item : undefined;
    const result = (await mutate(
      item ? `/api/dev/projects/${item.id}` : "/api/dev/projects",
      item ? "PATCH" : "POST",
      { ...data, archived: Boolean(item?.archived) }
    )) as { id: string };
    setProjectId(result.id);
    setEditor(null);
    notify(item ? "项目已更新" : "项目已创建");
  }

  async function saveItem(data: Omit<DevItem, "id">) {
    const item = editor?.kind === "item" ? editor.item : undefined;
    await mutate(item ? `/api/dev/items/${item.id}` : "/api/dev/items", item ? "PATCH" : "POST", {
      ...data,
      projectId: activeProjectId
    });
    setEditor(null);
    notify(item ? "开发事项已更新" : "开发事项已添加");
  }

  async function saveMilestone(data: Omit<DevMilestone, "id" | "completed">) {
    const item = editor?.kind === "milestone" ? editor.item : undefined;
    await mutate(
      item ? `/api/dev/milestones/${item.id}` : "/api/dev/milestones",
      item ? "PATCH" : "POST",
      { ...data, projectId: activeProjectId, completed: Boolean(item?.completed) }
    );
    setEditor(null);
    notify(item ? "里程碑已更新" : "里程碑已添加");
  }

  async function saveTime(data: Omit<DevTimeEntry, "id">) {
    await mutate("/api/dev/time-entries", "POST", { ...data, projectId: activeProjectId });
    setEditor(null);
    notify("工时已记录");
  }

  async function updateItemStatus(item: DevItem, status: DevItem["status"]) {
    await mutate(`/api/dev/items/${item.id}`, "PATCH", {
      projectId: item.projectId,
      title: item.title,
      type: item.type,
      priority: item.priority,
      status,
      dueDate: item.dueDate,
      description: item.description
    });
  }

  async function toggleMilestone(milestone: DevMilestone) {
    await mutate(`/api/dev/milestones/${milestone.id}`, "PATCH", {
      projectId: milestone.projectId,
      name: milestone.name,
      targetDate: milestone.targetDate,
      completed: !milestone.completed
    });
  }

  async function addItemToToday(item: DevItem) {
    await mutate("/api/day-plans", "POST", {
      date: localDateString(),
      sourceModule: "dev",
      sourceId: item.id
    });
    notify("已加入今日计划");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const paths: Record<DeleteTarget["kind"], string> = {
      project: `/api/dev/projects/${deleteTarget.id}`,
      item: `/api/dev/items/${deleteTarget.id}`,
      milestone: `/api/dev/milestones/${deleteTarget.id}`,
      time: `/api/dev/time-entries/${deleteTarget.id}`
    };
    try {
      setSaving("正在删除…");
      await apiRequest(paths[deleteTarget.kind], { method: "DELETE" });
      setDeleteTarget(null);
      setSaved();
      if (deleteTarget.kind === "project") setProjectId("");
      notify("记录已删除");
      refresh();
    } catch (error) {
      setSaveError();
      notify((error as Error).message, "error");
    }
  }

  if (dev.isPending) return <div className="page-content"><div className="loading-panel">正在读取开发项目…</div></div>;
  if (dev.isError) return <div className="page-content"><div className="error-panel">{dev.error.message}</div></div>;

  if (dev.data.projects.length === 0) {
    return (
      <div className="page-content">
        <EmptyState
          title="还没有开发项目"
          description="先创建一个项目，再在项目里记录需求、Bug、里程碑和工时。"
          action={<button className="button primary" onClick={() => setEditor({ kind: "project" })} type="button">创建第一个项目</button>}
        />
        <DevDrawer editor={editor} projectId={activeProjectId} data={dev.data} onClose={() => setEditor(null)} onSaveProject={saveProject} onSaveItem={saveItem} onSaveMilestone={saveMilestone} onSaveTime={saveTime} />
      </div>
    );
  }

  return (
    <div className="page-content dev-page">
      <section className="panel project-bar">
        <div className="project-select-wrap">
          <span className="eyebrow">PROJECT</span>
          <select aria-label="当前开发项目" className="project-select" onChange={(event) => setProjectId(event.target.value)} value={activeProjectId}>
            {dev.data.projects.filter((item) => !item.archived).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <span className="mini-badge">{project?.status ?? ""}</span>
        </div>
        <div className="row-actions">
          <button className="button secondary" onClick={() => setEditor({ kind: "project", item: project })} type="button"><Pencil size={14} />编辑项目</button>
          <button className="button secondary" onClick={() => setEditor({ kind: "project" })} type="button"><Plus size={14} />新建项目</button>
          <button className="button primary" onClick={() => setEditor({ kind: "item" })} type="button"><Plus size={14} />新增事项</button>
        </div>
      </section>

      <div className="stat-strip">
        <div><span>本周投入</span><strong>{formatHours(weekMinutes)}</strong></div>
        <div><span>进行中事项</span><strong>{projectItems.filter((item) => item.status === "in_progress").length}</strong></div>
        <div><span>下一里程碑</span><strong>{milestones.find((item) => !item.completed)?.name ?? "未设置"}</strong></div>
      </div>

      <div className="dev-layout">
        <section className="kanban dev-kanban">
          {columns.map((column) => (
            <div className="kanban-column" key={column.key}>
              <div className="kanban-head"><strong>{column.label}</strong><span>{projectItems.filter((item) => item.status === column.key).length}</span></div>
              {projectItems.filter((item) => item.status === column.key).map((item) => (
                <article className="kanban-card dev-card" key={item.id}>
                  <div className="card-meta"><span className={`status-tag ${item.type}`}>{typeLabel(item.type)}</span><span className={`priority-dot ${item.priority}`}>{priorityLabel(item.priority)}</span></div>
                  <button className="card-title-button" onClick={() => setEditor({ kind: "item", item })} type="button">{item.title}</button>
                  {item.dueDate ? <span className="card-due"><CalendarClock size={11} />{item.dueDate}</span> : null}
                  <div className="card-actions">
                    <select aria-label={`改变状态：${item.title}`} onChange={(event) => void updateItemStatus(item, event.target.value as DevItem["status"])} value={item.status}>
                      {columns.map((target) => <option value={target.key} key={target.key}>{target.label}</option>)}
                    </select>
                    <button className="tiny-text-button" onClick={() => void addItemToToday(item)} type="button">安排</button>
                    <button className="icon-text-button" aria-label={`删除事项：${item.title}`} onClick={() => setDeleteTarget({ kind: "item", id: item.id, title: item.title })} type="button"><Trash2 size={12} /></button>
                  </div>
                </article>
              ))}
              {projectItems.filter((item) => item.status === column.key).length === 0 ? <div className="column-empty">暂无事项</div> : null}
            </div>
          ))}
        </section>

        <aside className="detail-stack">
          <section className="panel">
            <div className="panel-head"><div><span className="eyebrow">MILESTONES</span><h2>里程碑</h2></div><button className="button secondary" onClick={() => setEditor({ kind: "milestone" })} type="button"><Plus size={14} />添加</button></div>
            <div className="panel-body milestone-list">
              {milestones.length === 0 ? <div className="inline-empty">还没有里程碑。</div> : milestones.map((milestone) => (
                <div className={`milestone-row${milestone.completed ? " completed" : ""}`} key={milestone.id}>
                  <button className={`check-button${milestone.completed ? " checked" : ""}`} aria-label={milestone.completed ? "恢复里程碑" : "完成里程碑"} onClick={() => void toggleMilestone(milestone)} type="button">{milestone.completed ? <Check size={12} /> : null}</button>
                  <div><strong>{milestone.name}</strong><span>{milestone.targetDate}</span></div>
                  <button className="icon-text-button" aria-label={`删除里程碑：${milestone.name}`} onClick={() => setDeleteTarget({ kind: "milestone", id: milestone.id, title: milestone.name })} type="button"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><span className="eyebrow">TIME</span><h2>工时记录</h2></div><button className="button secondary" onClick={() => setEditor({ kind: "time" })} type="button"><Plus size={14} />记录</button></div>
            <div className="panel-body time-list">
              {timeEntries.length === 0 ? <div className="inline-empty">还没有工时记录。</div> : timeEntries.slice(0, 6).map((entry) => (
                <div className="time-row" key={entry.id}><Clock3 size={13} /><div><strong>{formatHours(entry.durationMinutes)}</strong><span>{entry.workDate} · {entry.notes || "未填写说明"}</span></div><button className="icon-text-button" aria-label="删除工时记录" onClick={() => setDeleteTarget({ kind: "time", id: entry.id, title: `${entry.workDate} 工时` })} type="button"><Trash2 size={12} /></button></div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><span className="eyebrow">PROJECT</span><h2>项目操作</h2></div></div>
            <div className="panel-body project-actions">
              <button className="button secondary" onClick={() => setEditor({ kind: "project", item: project })} type="button">编辑资料</button>
              <button className="button secondary" onClick={() => project && setEditor({ kind: "project", item: project })} type="button">调整状态</button>
              <button className="button danger" onClick={() => project && setDeleteTarget({ kind: "project", id: project.id, title: project.name })} type="button">删除项目</button>
            </div>
          </section>
        </aside>
      </div>

      <DevDrawer editor={editor} projectId={activeProjectId} data={dev.data} onClose={() => setEditor(null)} onSaveProject={saveProject} onSaveItem={saveItem} onSaveMilestone={saveMilestone} onSaveTime={saveTime} />
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} title="确认删除？" description={deleteTarget?.kind === "item" ? `“${deleteTarget.title}”及其关联内容将被删除。已加入今日计划的记录会保留标题快照并标记“来源已删除”。` : `“${deleteTarget?.title ?? ""}”及其关联内容将被删除。`} confirmLabel="删除" danger onConfirm={() => void confirmDelete()} />
    </div>
  );
}

function DevDrawer({
  editor,
  projectId,
  data,
  onClose,
  onSaveProject,
  onSaveItem,
  onSaveMilestone,
  onSaveTime
}: {
  editor: Editor;
  projectId: string;
  data: DevData;
  onClose: () => void;
  onSaveProject: (value: Omit<DevProject, "id" | "archived" | "itemCount" | "completedCount" | "totalMinutes" | "nextMilestone">) => Promise<void>;
  onSaveItem: (value: Omit<DevItem, "id">) => Promise<void>;
  onSaveMilestone: (value: Omit<DevMilestone, "id" | "completed">) => Promise<void>;
  onSaveTime: (value: Omit<DevTimeEntry, "id">) => Promise<void>;
}) {
  return (
    <DetailDrawer open={Boolean(editor)} onOpenChange={(open) => { if (!open) onClose(); }} title={devEditorTitle(editor)} description="项目数据保存在本地文件中">
      {editor?.kind === "project" ? <ProjectForm item={editor.item} onSave={onSaveProject} /> : null}
      {editor?.kind === "item" ? <ItemForm item={editor.item} projectId={projectId} onSave={onSaveItem} /> : null}
      {editor?.kind === "milestone" ? <MilestoneForm item={editor.item} onSave={onSaveMilestone} /> : null}
      {editor?.kind === "time" ? <TimeForm data={data} projectId={projectId} onSave={onSaveTime} /> : null}
    </DetailDrawer>
  );
}

function ProjectForm({ item, onSave }: { item?: DevProject; onSave: (value: any) => Promise<void> }) {
  const [form, setForm] = useState({ name: item?.name ?? "", description: item?.description ?? "", status: item?.status ?? "active", startDate: item?.startDate ?? null, dueDate: item?.dueDate ?? null });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}><label className="field"><span>项目名称</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span>项目说明</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="field"><span>项目状态</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DevProject["status"] })}><option value="planning">规划中</option><option value="active">进行中</option><option value="paused">暂停</option><option value="completed">已完成</option></select></label><div className="two-col"><label className="field"><span>开始日期</span><input type="date" value={form.startDate ?? ""} onChange={(event) => setForm({ ...form, startDate: event.target.value || null })} /></label><label className="field"><span>预计完成</span><input type="date" value={form.dueDate ?? ""} onChange={(event) => setForm({ ...form, dueDate: event.target.value || null })} /></label></div><button className="button primary" type="submit">保存项目</button></form>;
}

function ItemForm({ item, projectId, onSave }: { item?: DevItem; projectId: string; onSave: (value: Omit<DevItem, "id">) => Promise<void> }) {
  const [form, setForm] = useState({ title: item?.title ?? "", type: item?.type ?? "feature", priority: item?.priority ?? "medium", status: item?.status ?? "todo", dueDate: item?.dueDate ?? null, description: item?.description ?? "" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave({ ...form, projectId }); }}><label className="field"><span>标题</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><div className="two-col"><label className="field"><span>类型</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as DevItem["type"] })}><option value="feature">需求</option><option value="bug">Bug</option><option value="improvement">优化</option><option value="note">技术笔记</option><option value="other">其他</option></select></label><label className="field"><span>优先级</span><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as DevItem["priority"] })}><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label></div><label className="field"><span>状态</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DevItem["status"] })}><option value="todo">待处理</option><option value="in_progress">进行中</option><option value="review">待验收</option><option value="completed">已完成</option><option value="cancelled">已取消</option></select></label><label className="field"><span>截止日期</span><input type="date" value={form.dueDate ?? ""} onChange={(event) => setForm({ ...form, dueDate: event.target.value || null })} /></label><label className="field"><span>说明</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><button className="button primary" type="submit">保存事项</button></form>;
}

function MilestoneForm({ item, onSave }: { item?: DevMilestone; onSave: (value: Omit<DevMilestone, "id" | "completed">) => Promise<void> }) {
  const [form, setForm] = useState({ name: item?.name ?? "", targetDate: item?.targetDate ?? localDateString() });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave({ ...form, projectId: item?.projectId ?? "" }); }}><label className="field"><span>里程碑名称</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span>目标日期</span><input required type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} /></label><button className="button primary" type="submit">保存里程碑</button></form>;
}

function TimeForm({ data, projectId, onSave }: { data: DevData; projectId: string; onSave: (value: Omit<DevTimeEntry, "id">) => Promise<void> }) {
  const [form, setForm] = useState({ itemId: "", workDate: localDateString(), durationMinutes: 30, notes: "" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave({ ...form, projectId, itemId: form.itemId || null }); }}><label className="field"><span>关联事项</span><select value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value })}><option value="">项目工作</option>{data.items.filter((item) => item.projectId === projectId).map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label className="field"><span>工作日期</span><input required type="date" value={form.workDate} onChange={(event) => setForm({ ...form, workDate: event.target.value })} /></label><label className="field"><span>投入分钟</span><input min={1} required type="number" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} /></label><label className="field"><span>说明</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="button primary" type="submit">保存工时</button></form>;
}

function typeLabel(type: DevItem["type"]) {
  return { feature: "需求", bug: "Bug", improvement: "优化", note: "笔记", other: "其他" }[type];
}
function priorityLabel(priority: DevItem["priority"]) {
  return { low: "低", medium: "中", high: "高" }[priority];
}
function formatHours(minutes: number) {
  return `${Math.round((minutes / 60) * 10) / 10} 小时`;
}
function startOfWeek(weekStartsOn: number) {
  const date = new Date();
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - offset);
  return localDateString(date);
}
function devEditorTitle(editor: Editor) {
  if (!editor) return "";
  return `${editor.item ? "编辑" : "添加"}${{ project: "项目", item: "开发事项", milestone: "里程碑", time: "工时" }[editor.kind]}`;
}
