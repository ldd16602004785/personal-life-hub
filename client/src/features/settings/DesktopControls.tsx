import { FolderOpen, LogOut, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { useUI } from "../../app/UIProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";

export function DesktopControls() {
  const bridge = window.personalLifeHubDesktop;
  const { notify } = useUI();
  const [info, setInfo] = useState<{ dataDir: string; version: string } | null>(
    null
  );
  const [quitOpen, setQuitOpen] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    void bridge
      .getInfo()
      .then(setInfo)
      .catch(() => notify("无法读取桌面版信息", "error"));
  }, [bridge, notify]);

  if (!bridge) return null;

  async function openDataFolder() {
    const result = await bridge!.openDataFolder();
    if (!result.ok) {
      notify(result.message || "无法打开数据文件夹", "error");
    }
  }

  async function quitApp() {
    await bridge!.quit();
  }

  return (
    <>
      <section className="panel desktop-control-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">WINDOWS DESKTOP</span>
            <h2>桌面版</h2>
          </div>
          <span className="status-badge">独立运行</span>
        </div>
        <div className="panel-body desktop-controls">
          <div className="desktop-info">
            <Monitor size={22} aria-hidden="true" />
            <div>
              <strong>
                个人工作生活 {info ? `v${info.version}` : "正在读取版本…"}
              </strong>
              <span>{info?.dataDir ?? "正在读取本地数据目录…"}</span>
            </div>
          </div>
          <div className="row-actions">
            <button className="button secondary" onClick={openDataFolder} type="button">
              <FolderOpen size={14} />
              打开数据文件夹
            </button>
            <button className="button secondary" onClick={() => setQuitOpen(true)} type="button">
              <LogOut size={14} />
              退出软件
            </button>
          </div>
        </div>
      </section>
      <ConfirmDialog
        busy={false}
        confirmLabel="退出软件"
        description="已经保存的内容不会丢失。尚未点击“保存设置”的修改会取消。"
        onConfirm={quitApp}
        onOpenChange={setQuitOpen}
        open={quitOpen}
        title="现在退出个人工作生活？"
      />
    </>
  );
}
