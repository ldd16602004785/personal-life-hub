import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { apiRequest } from "../lib/api";
import { localDateString } from "../lib/dates";
import { useUI } from "./UIProvider";

type CaptureTarget =
  | "memo"
  | "today"
  | "care"
  | "dev"
  | "learning"
  | "fitness"
  | "diet"
  | "entertainment";

const targets: Array<{ value: CaptureTarget; label: string; title: string; hint: string }> = [
  { value: "memo", label: "快速备忘", title: "记下想到的事", hint: "稍后可以继续整理" },
  { value: "today", label: "今日计划", title: "添加今日安排", hint: "只需先写清楚要做什么" },
  { value: "care", label: "关怀对象", title: "记录与 TA 有关的事", hint: "可以之后补充日期、地点和照片" },
  { value: "dev", label: "开发工作", title: "添加开发事项", hint: "先记录问题或想法" },
  { value: "learning", label: "学习计划", title: "添加学习任务", hint: "先记录今天要学什么" },
  { value: "fitness", label: "健身计划", title: "添加训练", hint: "先写下训练名称" },
  { value: "diet", label: "饮食计划", title: "添加饮食记录", hint: "先记录吃了什么或准备吃什么" },
  { value: "entertainment", label: "游戏娱乐", title: "添加娱乐项目", hint: "想玩的游戏、影视或书籍" }
];

export function QuickCaptureDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [target, setTarget] = useState<CaptureTarget>("memo");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const { notify, setSaving, setSaved, setSaveError } = useUI();
  const current = useMemo(() => targets.find((item) => item.value === target)!, [target]);

  const save = useMutation({
    mutationFn: async () => {
      if (target === "memo") {
        return apiRequest("/api/memos", {
          method: "POST",
          body: JSON.stringify({
            content: [title.trim(), notes.trim()].filter(Boolean).join("\n")
          })
        });
      }
      if (target === "today") {
        return apiRequest("/api/day-plans", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            date: localDateString(),
            notes: notes.trim()
          })
        });
      }
      if (target === "care") {
        return apiRequest("/api/care/stories", {
          method: "POST",
          body: JSON.stringify({
            happenedOn: localDateString(),
            title: title.trim(),
            content: notes.trim() || title.trim(),
            location: "",
            tag: ""
          })
        });
      }
      if (target === "dev") {
        const data = await apiRequest<{ projects: Array<{ id: string }> }>("/api/dev");
        const projectId = data.projects[0]?.id;
        if (!projectId) throw new Error("请先在开发工作建立项目");
        return apiRequest("/api/dev/items", {
          method: "POST",
          body: JSON.stringify({
            projectId,
            title: title.trim(),
            description: notes.trim(),
            type: "feature",
            priority: "medium",
            status: "todo"
          })
        });
      }
      if (target === "learning") {
        const data = await apiRequest<{
          goals: Array<{ id: string }>;
          stages: Array<{ id: string; goalId: string }>;
        }>("/api/learning");
        const goalId = data.goals[0]?.id;
        if (!goalId) throw new Error("请先在学习计划建立学习目标");
        const stageId = data.stages.find((stage) => stage.goalId === goalId)?.id ?? null;
        return apiRequest("/api/learning/tasks", {
          method: "POST",
          body: JSON.stringify({
            goalId,
            stageId,
            title: title.trim(),
            planDate: localDateString(),
            status: "todo",
            notes: notes.trim()
          })
        });
      }
      if (target === "fitness") {
        return apiRequest("/api/fitness/templates", {
          method: "POST",
          body: JSON.stringify({
            name: title.trim(),
            weekday: null,
            bodyPart: "",
            durationMinutes: null,
            exercises: []
          })
        });
      }
      if (target === "diet") {
        return apiRequest("/api/diet/meal-logs", {
          method: "POST",
          body: JSON.stringify({
            logDate: localDateString(),
            mealType: "snack",
            foods: title.trim(),
            eatenAt: null,
            feelings: notes.trim()
          })
        });
      }
      if (target === "entertainment") {
        return apiRequest("/api/entertainment/items", {
          method: "POST",
          body: JSON.stringify({
            mediaType: "other",
            name: title.trim(),
            status: "wishlist",
            progress: 0,
            notes: notes.trim()
          })
        });
      }
      throw new Error(`${current.label}的完整记录表单将在该模块阶段接入`);
    },
    onMutate: () => setSaving(),
    onSuccess: async () => {
      setSaved();
      notify("记录已保存到本地");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["memos"] }),
        queryClient.invalidateQueries({ queryKey: ["day-plans"] })
      ]);
      void queryClient.invalidateQueries({ queryKey: ["care"] });
      void queryClient.invalidateQueries({ queryKey: ["dev"] });
      void queryClient.invalidateQueries({ queryKey: ["learning"] });
      void queryClient.invalidateQueries({ queryKey: ["fitness"] });
      void queryClient.invalidateQueries({ queryKey: ["diet"] });
      void queryClient.invalidateQueries({ queryKey: ["entertainment"] });
      setTitle("");
      setNotes("");
      onOpenChange(false);
    },
    onError: (error) => {
      setSaveError(error.message);
      notify(error.message, "error");
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    save.mutate();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="quick-capture" aria-describedby="quick-capture-description">
          <div className="dialog-head">
            <div>
              <Dialog.Title>快速记录</Dialog.Title>
              <Dialog.Description id="quick-capture-description">
                {current.hint}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="关闭快速记录">
              <X size={17} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <form onSubmit={submit}>
            <label className="field">
              <span>记录到</span>
              <select
                aria-label="记录模块"
                value={target}
                onChange={(event) => setTarget(event.target.value as CaptureTarget)}
              >
                {targets.map((item) => (
                  <option value={item.value} key={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{current.title}</span>
              <input
                aria-label="快速记录内容"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="先写最重要的一句话"
              />
            </label>
            <label className="field">
              <span>补充说明</span>
              <textarea
                aria-label="快速记录补充说明"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="可选"
              />
            </label>
            <div className="dialog-actions">
              <Dialog.Close className="button secondary">取消</Dialog.Close>
              <button
                className="button primary"
                type="submit"
                disabled={!title.trim() || save.isPending}
              >
                <Plus size={15} aria-hidden="true" />
                保存记录
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
