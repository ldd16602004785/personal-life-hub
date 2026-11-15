import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  MessageSquareText,
  Pencil,
  Plus,
  Trash2
} from "lucide-react";
import { useMemo, useState } from "react";
import { useUI } from "../../app/UIProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DetailDrawer } from "../../components/DetailDrawer";
import { EmptyState } from "../../components/EmptyState";
import { apiRequest } from "../../lib/api";
import { localDateString } from "../../lib/dates";
import type {
  ConsultingAction,
  ConsultingClient,
  ConsultingData,
  ConsultingProject,
  ConsultingSession
} from "../../lib/types";

type Editor =
  | { kind: "client"; item?: ConsultingClient }
  | { kind: "project"; item?: ConsultingProject }
  | { kind: "session"; item?: ConsultingSession }
  | { kind: "action"; item?: ConsultingAction }
  | null;

interface DeleteTarget {
  kind: "client" | "project" | "session" | "action";
  id: string;
  title: string;
}

type ActionInput = Omit<ConsultingAction, "id" | "completed"> & {
  completed: boolean;
};

export function ConsultingPage() {
  const queryClient = useQueryClient();
  const { notify, setSaving, setSaved, setSaveError } = useUI();
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const consulting = useQuery({
    queryKey: ["consulting"],
    queryFn: () => apiRequest<ConsultingData>("/api/consulting")
  });

  const availableClients = consulting.data?.clients.filter((item) => !item.archived) ?? [];
  const activeClientId = clientId || availableClients[0]?.id || "";
  const clientProjects = useMemo(
    () =>
      consulting.data?.projects.filter(
        (project) => project.clientId === activeClientId
      ) ?? [],
    [activeClientId, consulting.data?.projects]
  );
  const activeProjectId = projectId || clientProjects[0]?.id || "";
  const client = consulting.data?.clients.find((item) => item.id === activeClientId);
  const project = consulting.data?.projects.find((item) => item.id === activeProjectId);
  const sessions =
    consulting.data?.sessions.filter((item) => item.projectId === activeProjectId) ?? [];
  const actions =
    consulting.data?.actions.filter((item) => item.projectId === activeProjectId) ?? [];

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["consulting"] });
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

  async function saveClient(data: Omit<ConsultingClient, "id" | "archived">) {
    const item = editor?.kind === "client" ? editor.item : undefined;
    const result = (await mutate(
      item ? `/api/consulting/clients/${item.id}` : "/api/consulting/clients",
      item ? "PATCH" : "POST",
      { ...data, archived: Boolean(item?.archived) }
    )) as { id: string };
    setClientId(result.id);
    setEditor(null);
    notify(item ? "客户资料已更新" : "客户已添加");
  }

  async function saveProject(
    data: Omit<ConsultingProject, "id">
  ) {
    const item = editor?.kind === "project" ? editor.item : undefined;
    const result = (await mutate(
      item ? `/api/consulting/projects/${item.id}` : "/api/consulting/projects",
      item ? "PATCH" : "POST",
      { ...data, clientId: activeClientId }
    )) as { id: string };
    setProjectId(result.id);
    setEditor(null);
    notify(item ? "咨询项目已更新" : "咨询项目已添加");
  }

  async function saveSession(data: Omit<ConsultingSession, "id">) {
    const item = editor?.kind === "session" ? editor.item : undefined;
    await mutate(
      item ? `/api/consulting/sessions/${item.id}` : "/api/consulting/sessions",
      item ? "PATCH" : "POST",
      { ...data, projectId: activeProjectId }
    );
    setEditor(null);
    notify(item ? "咨询记录已更新" : "咨询记录已添加");
  }

  async function saveAction(data: ActionInput) {
    const item = editor?.kind === "action" ? editor.item : undefined;
    await mutate(
      item ? `/api/consulting/actions/${item.id}` : "/api/consulting/actions",
      item ? "PATCH" : "POST",
      { ...data, projectId: activeProjectId }
    );
    setEditor(null);
    notify(item ? "行动项已更新" : "行动项已添加");
  }

  async function toggleAction(action: ConsultingAction) {
    await mutate(`/api/consulting/actions/${action.id}`, "PATCH", {
      projectId: action.projectId,
      title: action.title,
      owner: action.owner,
      dueDate: action.dueDate,
      completed: !action.completed
    });
  }

  async function addActionToToday(action: ConsultingAction) {
    await mutate("/api/day-plans", "POST", {
      date: localDateString(),
      sourceModule: "consulting",
      sourceId: action.id
    });
    notify("已加入今日计划");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const paths: Record<DeleteTarget["kind"], string> = {
      client: `/api/consulting/clients/${deleteTarget.id}`,
      project: `/api/consulting/projects/${deleteTarget.id}`,
      session: `/api/consulting/sessions/${deleteTarget.id}`,
      action: `/api/consulting/actions/${deleteTarget.id}`
    };
    try {
      setSaving("正在删除…");
      await apiRequest(paths[deleteTarget.kind], { method: "DELETE" });
      setDeleteTarget(null);
      setSaved();
      if (deleteTarget.kind === "client") setClientId("");
      if (deleteTarget.kind === "project") setProjectId("");
      notify("记录已删除");
      refresh();
    } catch (error) {
      setSaveError();
      notify((error as Error).message, "error");
    }
  }

  if (consulting.isPending) return <div className="page-content"><div className="loading-panel">正在读取咨询资料…</div></div>;
  if (consulting.isError) return <div className="page-content"><div className="error-panel">{consulting.error.message}</div></div>;

  if (consulting.data.clients.length === 0) {
    return (
      <div className="page-content">
        <EmptyState title="还没有客户资料" description="先添加客户，再建立咨询项目、记录会谈和跟进事项。" action={<button className="button primary" onClick={() => setEditor({ kind: "client" })} type="button">添加第一个客户</button>} />
        <ConsultingDrawer editor={editor} onClose={() => setEditor(null)} onSaveClient={saveClient} onSaveProject={saveProject} onSaveSession={saveSession} onSaveAction={saveAction} />
      </div>
    );
  }

  return (
    <div className="page-content consulting-page">
      <div className="consulting-layout">
        <section className="panel client-panel">
          <div className="panel-head"><div><span className="eyebrow">CLIENTS</span><h2>客户与咨询</h2></div><button className="button secondary" onClick={() => setEditor({ kind: "client" })} type="button"><Plus size={14} />添加</button></div>
          <div className="panel-body client-list">
            {consulting.data.clients.filter((item) => !item.archived).map((item) => (
              <button className={`client-row${item.id === activeClientId ? " active" : ""}`} onClick={() => { setClientId(item.id); setProjectId(""); }} type="button" key={item.id}>
                <span className="avatar">{item.name.slice(0, 1)}</span>
                <span className="client-copy"><strong>{item.name}</strong><span>{item.direction || item.contactNotes || "咨询客户"}</span></span>
                <span className={`status-tag ${item.status}`}>{clientStatusLabel(item.status)}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="detail-stack">
          <section className="panel project-bar">
            <div className="project-select-wrap">
              <span className="eyebrow">{client?.name ?? "客户"}</span>
              <select aria-label="当前咨询项目" className="project-select" onChange={(event) => setProjectId(event.target.value)} value={activeProjectId}>
                <option value="">选择咨询项目</option>
                {clientProjects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="row-actions">
              {client ? <button className="button secondary" onClick={() => setEditor({ kind: "client", item: client })} type="button"><Pencil size={14} />编辑客户</button> : null}
              <button className="button secondary" onClick={() => setEditor({ kind: "project" })} type="button"><Plus size={14} />新建项目</button>
            </div>
          </section>

          {!project ? (
            <EmptyState title="该客户还没有咨询项目" description="建立项目后，就可以记录每次咨询、费用和行动项。" action={<button className="button primary" onClick={() => setEditor({ kind: "project" })} type="button">新建咨询项目</button>} />
          ) : (
            <>
              <section className="panel">
                <div className="panel-head"><div><span className="eyebrow">ENGAGEMENT</span><h2>{project.name}</h2></div><div className="row-actions"><span className="mini-badge">{projectStatusLabel(project.status)}</span><button className="button secondary" onClick={() => setEditor({ kind: "project", item: project })} type="button"><Pencil size={14} />编辑</button></div></div>
                <div className="panel-body">
                  <p className="project-goal">{project.goal || "还没有填写项目目标。"}</p>
                  <div className="mini-stats">
                    <div><span>下一次咨询</span><strong>{project.nextSessionAt ? new Date(project.nextSessionAt).toLocaleString("zh-CN") : "未安排"}</strong></div>
                    <div><span>费用状态</span><strong>{feeLabel(project.feeStatus)}</strong></div>
                    <div><span>待跟进</span><strong>{actions.filter((item) => !item.completed).length}</strong></div>
                  </div>
                </div>
              </section>

              <div className="consulting-details">
                <section className="panel">
                  <div className="panel-head"><div><span className="eyebrow">SESSIONS</span><h2>咨询记录</h2></div><button className="button secondary" onClick={() => setEditor({ kind: "session" })} type="button"><Plus size={14} />记录</button></div>
                  <div className="panel-body session-list">
                    {sessions.length === 0 ? <div className="inline-empty">还没有咨询记录。</div> : sessions.map((session) => (
                      <article className="session-row" key={session.id}>
                        <div className="session-icon"><MessageSquareText size={14} /></div>
                        <button className="session-copy" onClick={() => setEditor({ kind: "session", item: session })} type="button">
                          <strong>{session.topics || session.method || "咨询记录"}</strong>
                          <span>{session.sessionDate}{session.durationMinutes ? ` · ${session.durationMinutes} 分钟` : ""} · {session.method || "未记录方式"}</span>
                          {session.conclusions ? <p>{session.conclusions}</p> : null}
                        </button>
                        <button className="icon-text-button" aria-label="删除咨询记录" onClick={() => setDeleteTarget({ kind: "session", id: session.id, title: `${session.sessionDate} 咨询记录` })} type="button"><Trash2 size={12} /></button>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-head"><div><span className="eyebrow">ACTIONS</span><h2>行动项</h2></div><button className="button secondary" onClick={() => setEditor({ kind: "action" })} type="button"><Plus size={14} />添加</button></div>
                  <div className="panel-body action-list">
                    {actions.length === 0 ? <div className="inline-empty">还没有行动项。</div> : actions.map((action) => (
                      <div className={`action-row${action.completed ? " completed" : ""}`} key={action.id}>
                        <button className={`check-button${action.completed ? " checked" : ""}`} aria-label={action.completed ? "恢复行动项" : "完成行动项"} onClick={() => void toggleAction(action)} type="button">{action.completed ? <Check size={12} /> : null}</button>
                        <button className="action-copy" onClick={() => setEditor({ kind: "action", item: action })} type="button"><strong>{action.title}</strong><span>{action.owner || "我"} · {action.dueDate ?? "无截止日期"}</span></button>
                        <button className="tiny-text-button" onClick={() => void addActionToToday(action)} type="button">安排</button>
                        <button className="icon-text-button" aria-label={`删除行动项：${action.title}`} onClick={() => setDeleteTarget({ kind: "action", id: action.id, title: action.title })} type="button"><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </div>

      <ConsultingDrawer editor={editor} onClose={() => setEditor(null)} onSaveClient={saveClient} onSaveProject={saveProject} onSaveSession={saveSession} onSaveAction={saveAction} />
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} title="确认删除？" description={deleteTarget?.kind === "action" ? `“${deleteTarget.title}”及其关联内容将被删除。已加入今日计划的记录会保留标题快照并标记“来源已删除”。` : `“${deleteTarget?.title ?? ""}”及其关联内容将被删除。`} confirmLabel="删除" danger onConfirm={() => void confirmDelete()} />
    </div>
  );
}

function ConsultingDrawer({ editor, onClose, onSaveClient, onSaveProject, onSaveSession, onSaveAction }: {
  editor: Editor;
  onClose: () => void;
  onSaveClient: (value: Omit<ConsultingClient, "id" | "archived">) => Promise<void>;
  onSaveProject: (value: Omit<ConsultingProject, "id">) => Promise<void>;
  onSaveSession: (value: Omit<ConsultingSession, "id">) => Promise<void>;
  onSaveAction: (value: ActionInput) => Promise<void>;
}) {
  return <DetailDrawer open={Boolean(editor)} onOpenChange={(open) => { if (!open) onClose(); }} title={consultEditorTitle(editor)} description="客户和咨询信息保存在本地文件中">
    {editor?.kind === "client" ? <ClientForm item={editor.item} onSave={onSaveClient} /> : null}
    {editor?.kind === "project" ? <ConsultProjectForm item={editor.item} onSave={onSaveProject} /> : null}
    {editor?.kind === "session" ? <SessionForm item={editor.item} onSave={onSaveSession} /> : null}
    {editor?.kind === "action" ? <ActionForm item={editor.item} onSave={onSaveAction} /> : null}
  </DetailDrawer>;
}

function ClientForm({ item, onSave }: { item?: ConsultingClient; onSave: (value: Omit<ConsultingClient, "id" | "archived">) => Promise<void> }) {
  const [form, setForm] = useState({ name: item?.name ?? "", contactNotes: item?.contactNotes ?? "", direction: item?.direction ?? "", status: item?.status ?? "active" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}><label className="field"><span>称呼</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span>咨询方向</span><input value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value })} /></label><label className="field"><span>联系备注</span><textarea value={form.contactNotes} onChange={(event) => setForm({ ...form, contactNotes: event.target.value })} /></label><label className="field"><span>状态</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ConsultingClient["status"] })}><option value="active">合作中</option><option value="paused">暂停</option><option value="archived">归档</option></select></label><button className="button primary" type="submit">保存客户</button></form>;
}

function ConsultProjectForm({ item, onSave }: { item?: ConsultingProject; onSave: (value: Omit<ConsultingProject, "id">) => Promise<void> }) {
  const [form, setForm] = useState({ name: item?.name ?? "", goal: item?.goal ?? "", status: item?.status ?? "active", startDate: item?.startDate ?? null, nextSessionAt: item?.nextSessionAt ?? null, feeStatus: item?.feeStatus ?? "unquoted" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave({ ...form, clientId: item?.clientId ?? "" }); }}><label className="field"><span>项目名称</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span>目标或问题</span><textarea value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value })} /></label><div className="two-col"><label className="field"><span>项目状态</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ConsultingProject["status"] })}><option value="intake">对接中</option><option value="active">进行中</option><option value="paused">暂停</option><option value="completed">已结束</option></select></label><label className="field"><span>费用状态</span><select value={form.feeStatus} onChange={(event) => setForm({ ...form, feeStatus: event.target.value as ConsultingProject["feeStatus"] })}><option value="unquoted">未报价</option><option value="pending">待支付</option><option value="partial">部分支付</option><option value="paid">已支付</option><option value="not_required">无需收费</option></select></label></div><label className="field"><span>开始日期</span><input type="date" value={form.startDate ?? ""} onChange={(event) => setForm({ ...form, startDate: event.target.value || null })} /></label><label className="field"><span>下一次咨询</span><input type="datetime-local" value={form.nextSessionAt?.slice(0, 16) ?? ""} onChange={(event) => setForm({ ...form, nextSessionAt: event.target.value || null })} /></label><button className="button primary" type="submit">保存咨询项目</button></form>;
}

function SessionForm({ item, onSave }: { item?: ConsultingSession; onSave: (value: Omit<ConsultingSession, "id">) => Promise<void> }) {
  const [form, setForm] = useState<{
    sessionDate: string;
    durationMinutes: number | null;
    method: string;
    topics: string;
    conclusions: string;
    notes: string;
  }>({ sessionDate: item?.sessionDate ?? localDateString(), durationMinutes: item?.durationMinutes ?? 60, method: item?.method ?? "线上", topics: item?.topics ?? "", conclusions: item?.conclusions ?? "", notes: item?.notes ?? "" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave({ ...form, projectId: item?.projectId ?? "" }); }}><div className="two-col"><label className="field"><span>咨询日期</span><input required type="date" value={form.sessionDate} onChange={(event) => setForm({ ...form, sessionDate: event.target.value })} /></label><label className="field"><span>时长（分钟）</span><input min={1} type="number" value={form.durationMinutes ?? ""} onChange={(event) => setForm({ ...form, durationMinutes: event.target.value ? Number(event.target.value) : null })} /></label></div><label className="field"><span>方式</span><input value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })} /></label><label className="field"><span>议题</span><textarea value={form.topics} onChange={(event) => setForm({ ...form, topics: event.target.value })} /></label><label className="field"><span>结论</span><textarea value={form.conclusions} onChange={(event) => setForm({ ...form, conclusions: event.target.value })} /></label><label className="field"><span>备注</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="button primary" type="submit">保存咨询记录</button></form>;
}

function ActionForm({ item, onSave }: { item?: ConsultingAction; onSave: (value: ActionInput) => Promise<void> }) {
  const [form, setForm] = useState({ title: item?.title ?? "", owner: item?.owner ?? "", dueDate: item?.dueDate ?? null, completed: Boolean(item?.completed) });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave({ ...form, projectId: item?.projectId ?? "" }); }}><label className="field"><span>行动项</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field"><span>负责人</span><input value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} /></label><label className="field"><span>截止日期</span><input type="date" value={form.dueDate ?? ""} onChange={(event) => setForm({ ...form, dueDate: event.target.value || null })} /></label><label className="checkbox-row"><input checked={form.completed} onChange={(event) => setForm({ ...form, completed: event.target.checked })} type="checkbox" />已完成</label><button className="button primary" type="submit">保存行动项</button></form>;
}

function clientStatusLabel(status: ConsultingClient["status"]) {
  return { active: "合作中", paused: "暂停", archived: "归档" }[status];
}
function projectStatusLabel(status: ConsultingProject["status"]) {
  return { intake: "对接中", active: "进行中", paused: "暂停", completed: "已结束" }[status];
}
function feeLabel(status: ConsultingProject["feeStatus"]) {
  return { unquoted: "未报价", pending: "待支付", partial: "部分支付", paid: "已支付", not_required: "无需收费" }[status];
}
function consultEditorTitle(editor: Editor) {
  if (!editor) return "";
  return `${editor.item ? "编辑" : "添加"}${{ client: "客户", project: "咨询项目", session: "咨询记录", action: "行动项" }[editor.kind]}`;
}
