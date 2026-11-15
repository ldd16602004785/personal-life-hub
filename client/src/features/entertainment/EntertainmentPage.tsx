import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Film, Gamepad2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useUI } from "../../app/UIProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DetailDialog } from "../../components/DetailDialog";
import { EmptyState } from "../../components/EmptyState";
import { ProgressBar } from "../../components/ProgressBar";
import { apiRequest } from "../../lib/api";
import { localDateString } from "../../lib/dates";
import type { EntertainmentData, EntertainmentItem, EntertainmentLog } from "../../lib/types";

type Editor =
  | { kind: "item"; item?: EntertainmentItem }
  | { kind: "log"; item: EntertainmentItem }
  | null;
interface DeleteTarget {
  kind: "item" | "log";
  id: string;
  title: string;
}

export function EntertainmentPage() {
  const queryClient = useQueryClient();
  const { notify, setSaving, setSaved, setSaveError } = useUI();
  const [editor, setEditor] = useState<Editor>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const entertainment = useQuery({
    queryKey: ["entertainment"],
    queryFn: () => apiRequest<EntertainmentData>("/api/entertainment")
  });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<Record<string, string>>("/api/settings")
  });

  const weekMinutes =
    entertainment.data?.logs
      .filter(
        (log) =>
          log.logDate >= startOfWeek(Number(settings.data?.weekStartsOn ?? 1))
      )
      .reduce((sum, log) => sum + log.durationMinutes, 0) ?? 0;

  const visibleItems = useMemo(
    () =>
      entertainment.data?.items.filter(
        (item) => typeFilter === "all" || item.mediaType === typeFilter
      ) ?? [],
    [entertainment.data, typeFilter]
  );

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["entertainment"] });
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

  async function saveItem(data: Omit<EntertainmentItem, "id">) {
    const item = editor?.kind === "item" ? editor.item : undefined;
    await mutate(
      item ? `/api/entertainment/items/${item.id}` : "/api/entertainment/items",
      item ? "PATCH" : "POST",
      data
    );
    setEditor(null);
    notify(item ? "娱乐项目已更新" : "娱乐项目已添加");
  }

  async function saveLog(data: Omit<EntertainmentLog, "id">) {
    await mutate("/api/entertainment/logs", "POST", data);
    setEditor(null);
    notify("本次体验已记录");
  }

  async function changeStatus(item: EntertainmentItem, status: EntertainmentItem["status"]) {
    await mutate(`/api/entertainment/items/${item.id}`, "PATCH", {
      mediaType: item.mediaType,
      name: item.name,
      status,
      progress: item.progress,
      startDate: item.startDate,
      finishDate: item.finishDate,
      rating: item.rating,
      notes: item.notes
    });
  }

  async function addToToday(item: EntertainmentItem) {
    await mutate("/api/day-plans", "POST", {
      date: localDateString(),
      sourceModule: "entertainment",
      sourceId: item.id
    });
    notify("已加入今日计划");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setSaving("正在删除…");
      await apiRequest(
        deleteTarget.kind === "item"
          ? `/api/entertainment/items/${deleteTarget.id}`
          : `/api/entertainment/logs/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      setDeleteTarget(null);
      setSaved();
      notify("记录已删除");
      refresh();
    } catch (error) {
      setSaveError();
      notify((error as Error).message, "error");
    }
  }

  if (entertainment.isPending) return <div className="page-content"><div className="loading-panel">正在读取娱乐收藏…</div></div>;
  if (entertainment.isError) return <div className="page-content"><div className="error-panel">{entertainment.error.message}</div></div>;

  return (
    <div className="page-content entertainment-page">
      <div className="stat-strip">
        <div><span>收藏项目</span><strong>{entertainment.data.items.length}</strong></div>
        <div><span>进行中</span><strong>{entertainment.data.items.filter((item) => item.status === "active").length}</strong></div>
        <div><span>本周时长</span><strong>{Math.round((weekMinutes / 60) * 10) / 10} 小时</strong></div>
      </div>
      <section className="panel">
        <div className="panel-head">
          <div><span className="eyebrow">LIBRARY</span><h2>游戏、影视与书籍</h2></div>
          <button className="button primary" onClick={() => setEditor({ kind: "item" })} type="button"><Plus size={14} />添加项目</button>
        </div>
        <div className="panel-body">
          <div className="filter-row">
            {[
              ["all", "全部"],
              ["game", "游戏"],
              ["film", "影视"],
              ["book", "书籍"],
              ["other", "其他"]
            ].map(([value, label]) => (
              <button className={`filter-chip${typeFilter === value ? " active" : ""}`} onClick={() => setTypeFilter(value)} type="button" key={value}>{label}</button>
            ))}
          </div>
          {visibleItems.length === 0 ? (
            <EmptyState title="还没有娱乐项目" description="想玩的游戏、想看的影视和想读的书都可以放在这里。" action={<button className="button primary" onClick={() => setEditor({ kind: "item" })} type="button">添加第一个项目</button>} />
          ) : (
            <div className="media-grid">
              {visibleItems.map((item) => (
                <article className="media-card" key={item.id}>
                  <div className={`media-cover ${item.mediaType}`}>{mediaIcon(item.mediaType)}</div>
                  <div className="media-copy">
                    <div className="card-meta"><span className={`status-tag ${item.status}`}>{mediaLabel(item.mediaType)} · {statusLabel(item.status)}</span>{item.rating ? <span>{item.rating}/10</span> : null}</div>
                    <strong>{item.name}</strong>
                    <ProgressBar value={item.progress} label={`${item.name}进度`} />
                    <span>{item.progress}% · 最近记录 {entertainment.data.logs.find((log) => log.itemId === item.id)?.logDate ?? "暂无"}</span>
                    <div className="card-actions">
                      <select aria-label={`改变状态：${item.name}`} onChange={(event) => void changeStatus(item, event.target.value as EntertainmentItem["status"])} value={item.status}><option value="wishlist">想看/想玩</option><option value="active">进行中</option><option value="completed">已完成</option><option value="paused">已搁置</option></select>
                      <button className="tiny-text-button" onClick={() => setEditor({ kind: "log", item })} type="button">记录</button>
                      <button className="icon-text-button" aria-label={`编辑项目：${item.name}`} onClick={() => setEditor({ kind: "item", item })} type="button"><Pencil size={12} /></button>
                      <button className="icon-text-button" aria-label={`安排项目：${item.name}`} onClick={() => void addToToday(item)} type="button"><Sparkles size={12} /></button>
                      <button className="icon-text-button" aria-label={`删除项目：${item.name}`} onClick={() => setDeleteTarget({ kind: "item", id: item.id, title: item.name })} type="button"><Trash2 size={12} /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><div><span className="eyebrow">RECENT</span><h2>最近体验</h2></div></div>
        <div className="panel-body recent-logs">
          {entertainment.data.logs.length === 0 ? <div className="inline-empty">还没有游玩、观看或阅读记录。</div> : entertainment.data.logs.slice(0, 8).map((log) => {
            const item = entertainment.data.items.find((entry) => entry.id === log.itemId);
            return <div className="recent-log-row" key={log.id}><div><strong>{item?.name ?? "已删除项目"}</strong><span>{log.logDate} · {log.durationMinutes} 分钟{log.progress !== null ? ` · 进度 ${log.progress}%` : ""}</span><p>{log.notes || "没有补充感受"}</p></div><button className="icon-text-button" aria-label="删除体验记录" onClick={() => setDeleteTarget({ kind: "log", id: log.id, title: `${log.logDate} 体验记录` })} type="button"><Trash2 size={12} /></button></div>;
          })}
        </div>
      </section>
      <DetailDialog open={Boolean(editor)} onOpenChange={(open) => { if (!open) setEditor(null); }} title={editor?.kind === "log" ? `记录《${editor.item.name}》` : editor?.item ? "编辑娱乐项目" : "添加娱乐项目"} description="娱乐项目与体验记录保存在本地文件中">
        {editor?.kind === "item" ? <ItemForm item={editor.item} onSave={saveItem} /> : null}
        {editor?.kind === "log" ? <LogForm item={editor.item} onSave={saveLog} /> : null}
      </DetailDialog>
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} title="确认删除？" description={deleteTarget?.kind === "item" ? `“${deleteTarget.title}”将被永久删除。已加入今日计划的记录会保留标题快照并标记“来源已删除”。` : `“${deleteTarget?.title ?? ""}”将被永久删除。`} confirmLabel="删除" danger onConfirm={() => void confirmDelete()} />
    </div>
  );
}

function ItemForm({ item, onSave }: { item?: EntertainmentItem; onSave: (value: Omit<EntertainmentItem, "id">) => Promise<void> }) {
  const [form, setForm] = useState({ mediaType: item?.mediaType ?? "game", name: item?.name ?? "", status: item?.status ?? "wishlist", progress: item?.progress ?? 0, startDate: item?.startDate ?? null, finishDate: item?.finishDate ?? null, rating: item?.rating ?? null, notes: item?.notes ?? "" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}><div className="two-col"><label className="field"><span>类型</span><select value={form.mediaType} onChange={(event) => setForm({ ...form, mediaType: event.target.value as EntertainmentItem["mediaType"] })}><option value="game">游戏</option><option value="film">影视</option><option value="book">书籍</option><option value="other">其他</option></select></label><label className="field"><span>状态</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as EntertainmentItem["status"] })}><option value="wishlist">想看/想玩</option><option value="active">进行中</option><option value="completed">已完成</option><option value="paused">已搁置</option></select></label></div><label className="field"><span>名称</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span>当前进度</span><input max={100} min={0} type="number" value={form.progress} onChange={(event) => setForm({ ...form, progress: Number(event.target.value) })} /></label><div className="two-col"><label className="field"><span>开始日期</span><input type="date" value={form.startDate ?? ""} onChange={(event) => setForm({ ...form, startDate: event.target.value || null })} /></label><label className="field"><span>完成日期</span><input type="date" value={form.finishDate ?? ""} onChange={(event) => setForm({ ...form, finishDate: event.target.value || null })} /></label></div><label className="field"><span>个人评分（1–10）</span><input max={10} min={1} type="number" value={form.rating ?? ""} onChange={(event) => setForm({ ...form, rating: event.target.value ? Number(event.target.value) : null })} /></label><label className="field"><span>备注或感受</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="button primary" type="submit">保存娱乐项目</button></form>;
}

function LogForm({ item, onSave }: { item: EntertainmentItem; onSave: (value: Omit<EntertainmentLog, "id">) => Promise<void> }) {
  const [form, setForm] = useState({ itemId: item.id, logDate: localDateString(), durationMinutes: 30, progress: item.progress, notes: "" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}><label className="field"><span>体验日期</span><input required type="date" value={form.logDate} onChange={(event) => setForm({ ...form, logDate: event.target.value })} /></label><label className="field"><span>时长（分钟）</span><input min={1} required type="number" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} /></label><label className="field"><span>记录后进度</span><input max={100} min={0} type="number" value={form.progress} onChange={(event) => setForm({ ...form, progress: Number(event.target.value) })} /></label><label className="field"><span>本次感受</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="button primary" type="submit">保存体验记录</button></form>;
}

function mediaIcon(type: EntertainmentItem["mediaType"]) {
  if (type === "game") return <Gamepad2 />;
  if (type === "film") return <Film />;
  return <BookOpen />;
}
function mediaLabel(type: EntertainmentItem["mediaType"]) {
  return { game: "游戏", film: "影视", book: "书籍", other: "其他" }[type];
}
function statusLabel(status: EntertainmentItem["status"]) {
  return { wishlist: "想看/想玩", active: "进行中", completed: "已完成", paused: "已搁置" }[status];
}
function startOfWeek(weekStartsOn: number) {
  const date = new Date();
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - offset);
  return localDateString(date);
}
