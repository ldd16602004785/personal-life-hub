import * as Dialog from "@radix-ui/react-dialog";
import { Archive, FolderHeart, ShieldCheck } from "lucide-react";

export function DesktopWelcome({
  open,
  onComplete
}: {
  open: boolean;
  onComplete: () => void;
}) {
  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="confirm-dialog desktop-welcome">
          <span className="eyebrow">WELCOME</span>
          <Dialog.Title>欢迎使用个人工作生活</Dialog.Title>
          <Dialog.Description>
            这是一个只在你电脑上运行的本地软件。第一次使用，先记住下面三件事。
          </Dialog.Description>
          <div className="desktop-welcome-list">
            <div>
              <FolderHeart size={19} aria-hidden="true" />
              <span>
                <strong>不要单独移动 EXE</strong>
                数据和程序在同一个文件夹中，移动时请移动整个文件夹。
              </span>
            </div>
            <div>
              <ShieldCheck size={19} aria-hidden="true" />
              <span>
                <strong>看到“已保存”就代表写入成功</strong>
                关闭软件或重新启动不会丢失已经保存的内容。
              </span>
            </div>
            <div>
              <Archive size={19} aria-hidden="true" />
              <span>
                <strong>重要内容及时备份</strong>
                可以在“数据与设置”中创建备份，并复制到其他硬盘。
              </span>
            </div>
          </div>
          <div className="dialog-actions">
            <button className="button primary" onClick={onComplete} type="button">
              开始使用
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
