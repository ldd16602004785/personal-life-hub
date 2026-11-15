import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Database,
  Download,
  HardDrive,
  History,
  Settings2,
  Trash2,
  Upload
} from "lucide-react";
import { useRef, useState } from "react";
import { useUI } from "../../app/UIProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { apiRequest } from "../../lib/api";
import type { BackupInfo, DataStatus } from "../../lib/types";
import { DesktopControls } from "./DesktopControls";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { notify, setSaving, setSaved, setSaveError } = useUI();
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupInfo | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearPhrase, setClearPhrase] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const status = useQuery({
    queryKey: ["data-status"],
    queryFn: () => apiRequest<DataStatus>("/api/data/status")
  });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<Record<string, string>>("/api/settings")
  });
  const backups = useQuery({
    queryKey: ["backups"],
    queryFn: () => apiRequest<{ backups: BackupInfo[] }>("/api/backups")
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries();
  };

  const createBackup = useMutation({
    mutationFn: () => apiRequest<BackupInfo>("/api/backups", { method: "POST" }),
    onMutate: () => setSaving("正在创建备份…"),
    onSuccess: () => {
      setSaved();
      notify("本地备份已创建");
      invalidateAll();
    },
    onError: (error) => {
      setSaveError(error.message);
      notify(error.message, "error");
    }
  });

  const restore = useMutation({
    mutationFn: (filename: string) =>
      apiRequest("/api/backups/restore", {
        method: "POST",
        body: JSON.stringify({ filename })
      }),
    onMutate: () => setSaving("正在恢复备份…"),
    onSuccess: () => {
      setRestoreTarget(null);
      setSaved();
      notify("备份已恢复");
      invalidateAll();
    },
    onError: (error) => {
      setSaveError();
      notify(error.message, "error");
    }
  });

  const importBackup = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiRequest("/api/backups/import", {
        method: "POST",
        body: form
      });
    },
    onMutate: () => setSaving("正在导入备份…"),
    onSuccess: () => {
      setSaved();
      notify("备份已导入并恢复");
      invalidateAll();
    },
    onError: (error) => {
      setSaveError(error.message);
      notify(error.message, "error");
    }
  });

  const clearData = useMutation({
    mutationFn: () =>
      apiRequest("/api/data/clear", {
        method: "POST"
      }),
    onMutate: () => setSaving("正在清空数据…"),
    onSuccess: () => {
      setClearOpen(false);
      setClearPhrase("");
      setSaved();
      notify("数据已清空，安全备份已保留");
      invalidateAll();
    },
    onError: (error) => {
      setSaveError();
      notify(error.message, "error");
    }
  });

  const deleteBackup = useMutation({
    mutationFn: (filename: string) =>
      apiRequest(`/api/backups/${encodeURIComponent(filename)}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeleteTarget(null);
      notify("备份文件已删除");
      invalidateAll();
    },
    onError: (error) => notify(error.message, "error")
  });

  async function saveSettings(values: Record<string, string | boolean>) {
    setSaving();
    try {
      await apiRequest("/api/settings", {
        method: "PUT",
        body: JSON.stringify(values)
      });
      setSaved();
      notify("设置已保存");
      invalidateAll();
    } catch (error) {
      setSaveError();
      notify((error as Error).message, "error");
    }
  }

  if (status.isPending || settings.isPending || backups.isPending) {
    return <div className="page-content"><div className="loading-panel">正在读取本地数据状态…</div></div>;
  }
  if (status.isError || settings.isError || backups.isError) {
    return <div className="page-content"><div className="error-panel">无法读取本地数据状态，请重新启动应用。</div></div>;
  }

  return (
    <div className="page-content settings-page">
      <section className="panel">
        <div className="panel-head"><div><span className="eyebrow">LOCAL DATA</span><h2>本地数据文件</h2></div><span className="status-badge">运行正常</span></div>
        <div className="panel-body">
          <div className="storage-hero">
            <span className="storage-icon"><Database size={22} /></span>
            <div className="storage-copy">
              <strong>个人数据文件独立保存在当前电脑</strong>
              <span>{status.data.dataDir}</span>
              <span>数据库 {formatBytes(status.data.databaseSize)} · 附件 {formatBytes(status.data.attachmentSize)} · {status.data.backupCount} 份备份</span>
            </div>
            <button className="button secondary" onClick={() => { void navigator.clipboard.writeText(status.data.dataDir).then(() => notify("数据目录已复制")).catch(() => notify("无法复制数据目录", "error")); }} type="button"><Copy size={14} />复制路径</button>
          </div>
        </div>
      </section>

      <DesktopControls />

      <div className="settings-grid">
        <section className="panel">
          <div className="panel-head"><div><span className="eyebrow">BACKUPS</span><h2>本地备份</h2></div><div className="row-actions"><button className="button secondary" onClick={() => importInput.current?.click()} type="button"><Upload size={14} />导入</button><button className="button primary" onClick={() => createBackup.mutate()} type="button"><History size={14} />立即备份</button></div></div>
          <input accept=".zip,application/zip" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) importBackup.mutate(file); event.target.value = ""; }} ref={importInput} type="file" />
          <div className="panel-body backup-list">
            {backups.data.backups.length === 0 ? <div className="inline-empty">还没有备份，建议立即创建一份。</div> : backups.data.backups.map((backup) => (
              <div className="backup-row" key={backup.filename}>
                <div><strong>{backupLabel(backup)}</strong><span>{new Date(backup.createdAt).toLocaleString("zh-CN")} · {formatBytes(backup.size)}</span></div>
                <a className="icon-text-button" href={`/api/backups/${encodeURIComponent(backup.filename)}/download`} aria-label={`下载备份：${backup.filename}`}><Download size={13} /></a>
                <button className="tiny-text-button" onClick={() => setRestoreTarget(backup)} type="button">恢复</button>
                <button className="icon-text-button" aria-label={`删除备份：${backup.filename}`} onClick={() => setDeleteTarget(backup)} type="button"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><span className="eyebrow">PREFERENCES</span><h2>使用偏好</h2></div></div>
          <SettingsForm key={JSON.stringify(settings.data)} values={settings.data} onSave={saveSettings} />
        </section>
      </div>

      <section className="panel danger-panel">
        <div className="panel-head"><div><span className="eyebrow">DANGER ZONE</span><h2>危险操作</h2></div></div>
        <div className="panel-body danger-copy">
          <div><HardDrive size={18} /><div><strong>清空全部业务数据</strong><span>会删除所有模块数据与照片，清空前自动创建安全备份。</span></div></div>
          <button className="button danger" onClick={() => setClearOpen(true)} type="button">清空全部数据</button>
        </div>
      </section>

      <ConfirmDialog open={Boolean(restoreTarget)} onOpenChange={(open) => { if (!open) setRestoreTarget(null); }} title="恢复这份备份？" description={`当前数据会先自动备份，再从 ${restoreTarget ? new Date(restoreTarget.createdAt).toLocaleString("zh-CN") : ""} 的备份恢复。`} confirmLabel="恢复备份" busy={restore.isPending} onConfirm={() => restoreTarget && restore.mutate(restoreTarget.filename)} />
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} title="删除这份备份？" description={`备份文件“${deleteTarget?.filename ?? ""}”删除后无法恢复。`} confirmLabel="删除备份" danger busy={deleteBackup.isPending} onConfirm={() => deleteTarget && deleteBackup.mutate(deleteTarget.filename)} />
      <ConfirmDialog open={clearOpen} onOpenChange={(open) => { if (!open) { setClearOpen(false); setClearPhrase(""); } }} title="清空全部数据" description="这会删除所有模块记录、偏好和本地照片。应用会先创建一份安全备份，但仍建议确认最新备份可用。" confirmLabel="确认清空" danger busy={clearData.isPending} confirmDisabled={clearPhrase !== "清空全部数据"} onConfirm={() => clearData.mutate()}>
        <label className="field"><span>请输入“清空全部数据”以确认</span><input aria-label="清空确认文字" value={clearPhrase} onChange={(event) => setClearPhrase(event.target.value)} /></label>
      </ConfirmDialog>
    </div>
  );
}

function SettingsForm({ values, onSave }: { values: Record<string, string>; onSave: (values: Record<string, string | boolean>) => Promise<void> }) {
  const [form, setForm] = useState({
    weekStartsOn: values.weekStartsOn ?? "1",
    defaultPage: values.defaultPage ?? "/",
    backupRetention: values.backupRetention ?? "30",
    waterTargetMl: values.waterTargetMl ?? "2000",
    fontSize: values.fontSize ?? "small",
    uiTheme: values.uiTheme ?? values.homeTheme ?? "standard",
    nightMode: values.nightMode === "true"
  });
  return (
    <form className="panel-body settings-form" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}>
      <label className="field"><span>一周开始于</span><select value={form.weekStartsOn} onChange={(event) => setForm({ ...form, weekStartsOn: event.target.value })}><option value="1">周一</option><option value="0">周日</option></select></label>
      <label className="field"><span>默认启动页面</span><select value={form.defaultPage} onChange={(event) => setForm({ ...form, defaultPage: event.target.value })}><option value="/">首页</option><option value="/today">今日计划</option><option value="/care">关怀对象</option><option value="/dev">开发工作</option><option value="/learning">学习计划</option><option value="/fitness">健身计划</option><option value="/diet">饮食计划</option><option value="/entertainment">游戏娱乐</option><option value="/settings">数据与设置</option></select></label>
      <label className="field"><span>保留最近备份数</span><input max={365} min={1} type="number" value={form.backupRetention} onChange={(event) => setForm({ ...form, backupRetention: event.target.value })} /></label>
      <label className="field"><span>每日饮水目标（ml）</span><input max={10000} min={100} type="number" value={form.waterTargetMl} onChange={(event) => setForm({ ...form, waterTargetMl: event.target.value })} /></label>
      <label className="field"><span>界面字号</span><select value={form.fontSize} onChange={(event) => setForm({ ...form, fontSize: event.target.value })}><option value="small">小</option><option value="medium">中</option><option value="large">大</option><option value="xlarge">特大</option></select></label>
      <label className="field"><span>界面主题</span><select value={form.uiTheme} onChange={(event) => setForm({ ...form, uiTheme: event.target.value })}><option value="standard">标准</option><option value="weather">天气氛围</option><option value="notion">Notion 笔记</option><option value="bubu">一二和布布</option></select></label>
      <label className="checkbox-row"><input aria-label="夜间模式" checked={form.nightMode} onChange={(event) => setForm({ ...form, nightMode: event.target.checked })} type="checkbox" />夜间模式</label>
      <button className="button primary" type="submit"><Settings2 size={14} />保存设置</button>
    </form>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
function backupLabel(backup: BackupInfo) {
  const labels: Record<string, string> = {
    daily: "每日自动备份",
    manual: "手动备份",
    "pre-restore": "恢复前安全备份",
    "pre-import": "导入前安全备份",
    "pre-clear": "清空前安全备份"
  };
  return labels[backup.reason] ?? "本地备份";
}
