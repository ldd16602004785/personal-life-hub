import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useUI } from "../../app/UIProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DetailDrawer } from "../../components/DetailDrawer";
import { EmptyState } from "../../components/EmptyState";
import { ProgressBar } from "../../components/ProgressBar";
import { apiRequest } from "../../lib/api";
import { formatClock, localDateString } from "../../lib/dates";
import type { DayPlan, DayPlansResponse, SourceItem } from "../../lib/types";

const editSchema = z.object({
  startTime: z.string().optional(),
  durationMinutes: z.number().int().min(5).max(1440),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  notes: z.string().max(5000)
});

type EditValues = z.infer<typeof editSchema>;

export function TodayPage() {
  const date = localDateString();
  const queryClient = useQueryClient();
  const { notify, setSaving, setSaved, setSaveError } = useUI();
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [sourceKey, setSourceKey] = useState("");
  const [selected, setSelected] = useState<DayPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DayPlan | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const plans = useQuery({
    queryKey: ["day-plans", date],
    queryFn: () => apiRequest<DayPlansResponse>(`/api/day-plans?date=${date}`)
  });
  const sources = useQuery({
    queryKey: ["day-plan-sources"],
    queryFn: () => apiRequest<{ items: SourceItem[] }>("/api/day-plans/sources")
  });
  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      startTime: "",
      durationMinutes: 30,
      priority: "medium",
      status: "pending",
      notes: ""
    }
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["day-plans"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["day-plan-sources"] });
  };

  const create = useMutation({
    mutationFn: () => {
      if (sourceKey) {
        const source = sources.data?.items.find(
          (item) => `${item.module}:${item.id}` === sourceKey
        );
        if (!source) throw new Error("请选择有效来源");
        return apiRequest("/api/day-plans", {
          method: "POST",
          body: JSON.stringify({
            date,
            sourceModule: source.module,
            sourceId: source.id,
            startTime: time || null
          })
        });
      }
      return apiRequest("/api/day-plans", {
        method: "POST",
        body: JSON.stringify({
          title,
          date,
          startTime: time || null,
          priority: "medium"
        })
      });
    },
    onMutate: () => setSaving(),
    onSuccess: () => {
      setSaved();
      setTitle("");
      setTime("");
      setSourceKey("");
      notify("已加入今日计划");
      refresh();
    },
    onError: (error) => {
      setSaveError();
      notify(error.message, "error");
    }
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      apiRequest(`/api/day-plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      }),
    onMutate: () => setSaving(),
    onSuccess: () => {
      setSaved();
      setSelected(null);
      notify("计划已更新");
      refresh();
    },
    onError: (error) => {
      setSaveError();
      notify(error.message, "error");
    }
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/day-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeleteTarget(null);
      setSelected(null);
      notify("已从今日计划移除");
      refresh();
    },
    onError: (error) => notify(error.message, "error")
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() && !sourceKey) return;
    create.mutate();
  }

  function openPlan(plan: DayPlan) {
    setSelected(plan);
    editForm.reset({
      startTime: plan.startTime ?? "",
      durationMinutes: plan.durationMinutes ?? 30,
      priority: plan.priority,
      status: plan.status,
      notes: plan.notes
    });
  }

  function savePlan(values: EditValues) {
    if (!selected) return;
    update.mutate({
      id: selected.id,
      patch: {
        ...values,
        startTime: values.startTime || null,
        durationMinutes: values.durationMinutes || null
      }
    });
  }

  if (plans.isPending) return <div className="page-content"><div className="loading-panel">正在读取今日计划…</div></div>;

  const filtered = (plans.data?.plans ?? []).filter(
    (plan) => statusFilter === "all" || plan.status === statusFilter
  );

  return (
    <div className="page-content">
      <div className="stat-strip">
        <div><span>今日事项</span><strong>{plans.data?.progress.total ?? 0}</strong></div>
        <div><span>已完成</span><strong>{plans.data?.progress.completed ?? 0}</strong></div>
        <div><span>完成度</span><strong>{plans.data?.progress.percent ?? 0}%</strong></div>
      </div>

      <form className="quick-entry" onSubmit={submit}>
        <input
          aria-label="添加今日事项"
          onChange={(event) => {
            setTitle(event.target.value);
            setSourceKey("");
          }}
          placeholder="添加一件只属于今天的事…"
          value={title}
        />
        <input
          aria-label="开始时间"
          onChange={(event) => setTime(event.target.value)}
          type="time"
          value={time}
        />
        <select
          aria-label="从模块选择事项"
          onChange={(event) => setSourceKey(event.target.value)}
          value={sourceKey}
        >
          <option value="">临时事项</option>
          {sources.data?.items.map((item) => (
            <option value={`${item.module}:${item.id}`} key={`${item.module}:${item.id}`}>
              {item.label} · {item.title}
            </option>
          ))}
        </select>
        <button className="button primary" disabled={create.isPending} type="submit">
          <Plus size={15} aria-hidden="true" />
          加入今天
        </button>
      </form>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">TODAY</span>
            <h2>今天的时间安排</h2>
          </div>
          <select
            aria-label="筛选今日计划状态"
            className="compact-select"
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option value="all">全部状态</option>
            <option value="pending">未开始</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
        <div className="panel-body">
          <div className="progress-row">
            <ProgressBar value={plans.data?.progress.percent ?? 0} label="今日计划完成度" />
            <span>{plans.data?.progress.percent ?? 0}%</span>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              title="今天还没有符合条件的安排"
              description="创建一个临时事项，或从已经建立的模块记录中加入今天。"
            />
          ) : (
            <div className="today-list">
              {filtered.map((plan) => (
                <article className={`today-row ${plan.status}`} key={plan.id}>
                  <span className="plan-time">{formatClock(plan.startTime) || "待安排"}</span>
                  <span className={`plan-mark ${plan.priority}`} aria-hidden="true" />
                  <button className="today-copy" onClick={() => openPlan(plan)} type="button">
                    <strong>{plan.title}</strong>
                    <span>
                      {plan.sourceType === "module" ? `模块事项 · ${plan.sourceModule}` : "临时事项"}
                      {!plan.sourceExists ? " · 来源已删除" : ""}
                      {plan.durationMinutes ? ` · 预计 ${plan.durationMinutes} 分钟` : ""}
                    </span>
                  </button>
                  <button
                    aria-label={plan.status === "completed" ? "恢复计划" : "完成计划"}
                    className={`check-button${plan.status === "completed" ? " checked" : ""}`}
                    onClick={() =>
                      update.mutate({
                        id: plan.id,
                        patch: {
                          status: plan.status === "completed" ? "pending" : "completed"
                        }
                      })
                    }
                    type="button"
                  >
                    {plan.status === "completed" ? <Check size={14} aria-hidden="true" /> : null}
                  </button>
                  <button
                    aria-label={`移除计划：${plan.title}`}
                    className="icon-text-button"
                    onClick={() => setDeleteTarget(plan)}
                    type="button"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <DetailDrawer
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.title ?? "计划详情"}
        description={selected?.sourceType === "module" ? "来自其他模块的执行安排" : "临时今日事项"}
      >
        <form className="form-stack" onSubmit={editForm.handleSubmit(savePlan)}>
          <label className="field">
            <span>开始时间</span>
            <input type="time" {...editForm.register("startTime")} />
          </label>
          <label className="field">
            <span>预计耗时（分钟）</span>
            <input
              min={5}
              type="number"
              {...editForm.register("durationMinutes", { valueAsNumber: true })}
            />
          </label>
          <label className="field">
            <span>优先级</span>
            <select {...editForm.register("priority")}>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </label>
          <label className="field">
            <span>执行状态</span>
            <select {...editForm.register("status")}>
              <option value="pending">未开始</option>
              <option value="in_progress">进行中</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </label>
          <label className="field">
            <span>备注</span>
            <textarea {...editForm.register("notes")} />
          </label>
          <button className="button primary" disabled={update.isPending} type="submit">
            保存修改
          </button>
        </form>
      </DetailDrawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="从今日计划中移除？"
        description={
          deleteTarget?.sourceType === "module"
            ? "只会移除今天的安排，不会删除来源模块中的记录。"
            : `“${deleteTarget?.title ?? ""}”将从今天移除。`
        }
        confirmLabel="移除"
        danger
        busy={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </div>
  );
}
