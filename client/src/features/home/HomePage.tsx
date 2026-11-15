import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Dumbbell,
  Gamepad2,
  HandHeart,
  BookOpenCheck,
  Plus,
  Trash2,
  Utensils
} from "lucide-react";
import { useState, type FormEvent } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { DetailDialog } from "../../components/DetailDialog";
import { ProgressBar } from "../../components/ProgressBar";
import { apiRequest, getBootstrap } from "../../lib/api";
import { formatClock } from "../../lib/dates";
import type { DashboardData, DayPlan, Memo } from "../../lib/types";
import { useUI } from "../../app/UIProvider";

export function HomePage() {
  const queryClient = useQueryClient();
  const { notify, setSaving, setSaved, setSaveError } = useUI();
  const [memoText, setMemoText] = useState("");
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const bootstrap = useQuery({
    queryKey: ["bootstrap"],
    queryFn: getBootstrap,
    staleTime: Infinity
  });
  const theme =
    bootstrap.data?.settings.uiTheme ??
    bootstrap.data?.settings.homeTheme ??
    "standard";
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<DashboardData>("/api/dashboard")
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["memos"] });
    void queryClient.invalidateQueries({ queryKey: ["day-plans"] });
  }

  const createMemo = useMutation({
    mutationFn: (content: string) =>
      apiRequest<Memo>("/api/memos", {
        method: "POST",
        body: JSON.stringify({ content })
      }),
    onMutate: () => setSaving("正在保存备忘…"),
    onSuccess: () => {
      setSaved();
      setMemoText("");
      notify("备忘已保存到本地");
      refresh();
    },
    onError: (error) => {
      setSaveError();
      notify(error.message, "error");
    }
  });

  const updateMemo = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; completed?: boolean; content?: string }) =>
      apiRequest(`/api/memos/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      }),
    onMutate: () => setSaving(),
    onSuccess: () => {
      setSaved();
      refresh();
    },
    onError: (error) => {
      setSaveError();
      notify(error.message, "error");
    }
  });

  const deleteMemo = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/memos/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      notify("备忘已删除");
      refresh();
    },
    onError: (error) => notify(error.message, "error")
  });

  const convertMemo = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/memos/${id}/convert-to-day`, {
        method: "POST"
      }),
    onSuccess: () => {
      notify("已转为今日计划");
      refresh();
    },
    onError: (error) => notify(error.message, "error")
  });

  const updatePlan = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DayPlan["status"] }) =>
      apiRequest(`/api/day-plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      }),
    onMutate: () => setSaving(),
    onSuccess: () => {
      setSaved();
      refresh();
    },
    onError: (error) => {
      setSaveError();
      notify(error.message, "error");
    }
  });

  function addMemo(event: FormEvent) {
    event.preventDefault();
    if (memoText.trim()) createMemo.mutate(memoText.trim());
  }

  if (dashboard.isPending) return <PageLoading />;
  if (dashboard.isError) {
    return (
      <div className="page-content">
        <div className="error-panel">{dashboard.error.message}</div>
      </div>
    );
  }

  const data = dashboard.data;

  return (
    <div className={`page-content home-page theme-${theme}`}>
      {theme === "weather" ? <WeatherHomeHero data={data} /> : null}
      {theme === "notion" ? <NotionHomeHeader /> : null}
      {theme === "bubu" ? <BubuHomeHero /> : null}
      <div className="home-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">TODAY</span>
              <h2>今日计划</h2>
            </div>
            <Link className="text-link" to="/today">
              查看完整计划
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="panel-body">
            <div className="progress-row">
              <ProgressBar value={data.progress.percent} label="今日计划完成度" />
              <span>
                {data.progress.completed} / {data.progress.total} 已完成
              </span>
            </div>
            <div className="plan-list compact">
              {data.plans.length === 0 ? (
                <div className="inline-empty">今天还没有安排，先放一件重要的事进来。</div>
              ) : (
                data.plans.map((plan) => (
                  <PlanRow
                    key={plan.id}
                    plan={plan}
                    onToggle={() =>
                      updatePlan.mutate({
                        id: plan.id,
                        status: plan.status === "completed" ? "pending" : "completed"
                      })
                    }
                  />
                ))
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">QUICK MEMO</span>
              <h2>快速备忘</h2>
            </div>
            <span className="meta-text">保存到本地文件</span>
          </div>
          <div className="panel-body">
            <form className="memo-form" onSubmit={addMemo}>
              <textarea
                aria-label="新增快速备忘"
                onChange={(event) => setMemoText(event.target.value)}
                placeholder="想到的事，先放在这里…"
                value={memoText}
              />
              <button
                className="button primary"
                disabled={!memoText.trim() || createMemo.isPending}
                type="submit"
              >
                <Plus size={15} aria-hidden="true" />
                添加
              </button>
            </form>
            <div className="memo-list">
              {data.memos.length === 0 ? (
                <div className="inline-empty">暂时没有备忘。</div>
              ) : (
                data.memos.map((memo) => (
                  <div className={`memo-row${memo.completed ? " done" : ""}`} key={memo.id}>
                    <button
                      aria-label={memo.completed ? "恢复备忘" : "完成备忘"}
                      className="check-button"
                      onClick={() =>
                        updateMemo.mutate({
                          id: memo.id,
                          completed: memo.completed === 0
                        })
                      }
                      type="button"
                    >
                      {memo.completed ? <Check size={13} aria-hidden="true" /> : null}
                    </button>
                    <button
                      className="memo-copy"
                      onClick={() => setEditingMemo(memo)}
                      type="button"
                    >
                      {memo.content}
                    </button>
                    <button
                      className="tiny-text-button"
                      onClick={() => convertMemo.mutate(memo.id)}
                      type="button"
                    >
                      转为今日
                    </button>
                    <button
                      aria-label={`删除备忘：${memo.content}`}
                      className="icon-text-button"
                      onClick={() => deleteMemo.mutate(memo.id)}
                      type="button"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="section-heading">
        <div>
          <span className="eyebrow">{theme === "notion" ? "DATABASE" : "AT A GLANCE"}</span>
          <h2>模块动态</h2>
        </div>
        {theme === "notion" ? <span className="meta-text">6 条记录</span> : null}
      </div>
      {theme === "notion" ? (
        <NotionModuleDatabase data={data} />
      ) : (
        <div className="module-grid">
        <ModuleCard
          icon={<HandHeart />}
          title="关怀对象"
          badge={
            data.modules.care.days === undefined
              ? "还没有重要日期"
              : `${data.modules.care.days} 天后`
          }
          summary={data.modules.care.title ?? data.modules.care.latestStory?.title ?? "记录与 TA 的重要日子"}
          meta={data.modules.care.latestStory ? `最近趣事：${data.modules.care.latestStory.title}` : "还没有趣事记录"}
          to="/care"
          tone="rose"
        />
        <ModuleCard
          icon={<Code2 />}
          title="开发工作"
          badge={`${data.modules.dev.activeProjects} 个项目`}
          summary={`${data.modules.dev.openItems} 个事项待推进`}
          meta={`本周投入 ${Math.round(data.modules.dev.weekMinutes / 60 * 10) / 10} 小时`}
          to="/dev"
          tone="green"
        />
        <ModuleCard
          icon={<BookOpenCheck />}
          title="学习计划"
          badge={`${data.modules.learning.pendingTasks} 项待完成`}
          summary={
            data.modules.learning.nextTask
              ? data.modules.learning.nextTask.title
              : "还没有学习任务"
          }
          meta={
            data.modules.learning.nextTask
              ? `${data.modules.learning.nextTask.goalTitle} · ${data.modules.learning.nextTask.planDate ?? "待安排"}`
              : `${data.modules.learning.activeGoals} 个进行中的学习目标`
          }
          to="/learning"
          tone="purple"
        />
        <ModuleCard
          icon={<Dumbbell />}
          title="健身计划"
          badge={`本周 ${data.modules.fitness.completedThisWeek} 次`}
          summary={data.modules.fitness.nextPlan?.name ?? "还没有训练安排"}
          meta={data.modules.fitness.nextPlan?.bodyPart ?? "建立每周训练模板"}
          to="/fitness"
          tone="amber"
        />
        <ModuleCard
          icon={<Utensils />}
          title="饮食计划"
          badge={`饮水 ${data.modules.diet.waterMl} ml`}
          summary={
            data.modules.diet.nextMeal
              ? `${data.modules.diet.nextMeal.mealType}：${data.modules.diet.nextMeal.foods}`
              : "还没有餐食安排"
          }
          meta={`${data.modules.diet.shoppingPending} 项采购未完成`}
          to="/diet"
          tone="red"
        />
        <ModuleCard
          icon={<Gamepad2 />}
          title="游戏娱乐"
          badge={`本周 ${Math.round(data.modules.entertainment.weekMinutes / 6) / 10} 小时`}
          summary={data.modules.entertainment.activeItem?.name ?? "还没有进行中的项目"}
          meta={
            data.modules.entertainment.activeItem
              ? `当前进度 ${data.modules.entertainment.activeItem.progress}%`
              : "收藏游戏、影视和书籍"
          }
          to="/entertainment"
          tone="blue"
        />
        </div>
      )}
      <DetailDialog
        open={Boolean(editingMemo)}
        onOpenChange={(open) => {
          if (!open) setEditingMemo(null);
        }}
        title="编辑快速备忘"
        description="修改后保存到本地数据文件"
      >
        {editingMemo ? (
          <MemoEditForm
            memo={editingMemo}
            onSave={async (content) => {
              await updateMemo.mutateAsync({ id: editingMemo.id, content });
              setEditingMemo(null);
              notify("备忘已更新");
            }}
          />
        ) : null}
      </DetailDialog>
    </div>
  );
}

function WeatherHomeHero({ data }: { data: DashboardData }) {
  return (
    <section className="weather-home-hero" aria-label="今日概览">
      <div>
        <span className="weather-hero-eyebrow">TODAY · 今日</span>
        <h2>把今天过成喜欢的样子</h2>
        <p>
          {data.progress.total} 项安排，已完成 {data.progress.completed} 项
        </p>
      </div>
      <div className="weather-hero-progress">
        <strong>{data.progress.percent}%</strong>
        <span>今日完成度</span>
      </div>
    </section>
  );
}

function NotionHomeHeader() {
  return (
    <header className="notion-home-header">
      <span className="notion-page-icon" aria-hidden="true">🏠</span>
      <div>
        <span className="notion-breadcrumb">个人空间 / 首页</span>
        <h2>我的工作与生活</h2>
        <p>今天值得关注的事情，都整理在这里。</p>
      </div>
    </header>
  );
}

function BubuHomeHero() {
  return (
    <section className="bubu-home-hero">
      <img
        src="/assets/bubu/pair-coffee.png"
        alt="一二和布布背着包一起散步"
      />
      <div>
        <span className="eyebrow">ONE TWO & BUBU</span>
        <h2>一二和布布陪你过好今天</h2>
        <p>把工作做完，也给生活留一点轻松的时间。</p>
      </div>
    </section>
  );
}

function NotionModuleDatabase({ data }: { data: DashboardData }) {
  const rows = [
    {
      module: "关怀对象",
      status:
        data.modules.care.days === undefined
          ? "暂无日期"
          : `${data.modules.care.days} 天后`,
      detail:
        data.modules.care.title ??
        data.modules.care.latestStory?.title ??
        "记录与 TA 的重要日子",
      next:
        data.modules.care.latestStory?.title ?? "添加趣事或重要日期",
      to: "/care"
    },
    {
      module: "开发工作",
      status: `${data.modules.dev.activeProjects} 个项目`,
      detail: `${data.modules.dev.openItems} 个事项待推进`,
      next: `本周投入 ${Math.round((data.modules.dev.weekMinutes / 60) * 10) / 10} 小时`,
      to: "/dev"
    },
    {
      module: "学习计划",
      status: `${data.modules.learning.activeGoals} 个目标`,
      detail: data.modules.learning.nextTask?.title ?? "还没有学习任务",
      next: data.modules.learning.nextTask?.goalTitle ?? "创建学习目标",
      to: "/learning"
    },
    {
      module: "健身计划",
      status: `本周 ${data.modules.fitness.completedThisWeek} 次`,
      detail: data.modules.fitness.nextPlan?.name ?? "还没有训练安排",
      next: data.modules.fitness.nextPlan?.bodyPart ?? "建立训练模板",
      to: "/fitness"
    },
    {
      module: "饮食计划",
      status: `饮水 ${data.modules.diet.waterMl} ml`,
      detail: data.modules.diet.nextMeal?.foods ?? "还没有餐食安排",
      next: `${data.modules.diet.shoppingPending} 项采购未完成`,
      to: "/diet"
    },
    {
      module: "游戏娱乐",
      status: `本周 ${Math.round((data.modules.entertainment.weekMinutes / 60) * 10) / 10} 小时`,
      detail: data.modules.entertainment.activeItem?.name ?? "还没有进行中的项目",
      next: data.modules.entertainment.activeItem
        ? `当前进度 ${data.modules.entertainment.activeItem.progress}%`
        : "收藏游戏、影视和书籍",
      to: "/entertainment"
    }
  ];

  return (
    <div className="notion-database" role="table" aria-label="模块摘要">
      <div className="notion-database-row notion-database-head" role="row">
        <span role="columnheader">模块</span>
        <span role="columnheader">状态</span>
        <span role="columnheader">重要信息</span>
        <span role="columnheader">下一步</span>
      </div>
      {rows.map((row) => (
        <Link className="notion-database-row" to={row.to} role="row" key={row.module}>
          <strong role="cell">{row.module}</strong>
          <span role="cell"><span className="notion-status">{row.status}</span></span>
          <span role="cell">{row.detail}</span>
          <span role="cell">{row.next} <ArrowRight size={12} /></span>
        </Link>
      ))}
    </div>
  );
}

function MemoEditForm({
  memo,
  onSave
}: {
  memo: Memo;
  onSave: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState(memo.content);
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (content.trim()) void onSave(content.trim());
      }}
    >
      <label className="field">
        <span>备忘内容</span>
        <textarea
          aria-label="编辑备忘内容"
          onChange={(event) => setContent(event.target.value)}
          value={content}
        />
      </label>
      <button className="button primary" disabled={!content.trim()} type="submit">
        保存修改
      </button>
    </form>
  );
}

function PlanRow({ plan, onToggle }: { plan: DayPlan; onToggle: () => void }) {
  return (
    <div className={`plan-row${plan.status === "completed" ? " done" : ""}`}>
      <span className="plan-time">{formatClock(plan.startTime) || "待安排"}</span>
      <span className={`plan-mark ${plan.priority}`} aria-hidden="true" />
      <div>
        <strong>{plan.title}</strong>
        <span>
          {plan.sourceType === "module" ? plan.sourceModule : "临时事项"}
          {plan.sourceType === "module" && !plan.sourceExists ? " · 来源已删除" : ""}
        </span>
      </div>
      <button
        aria-label={plan.status === "completed" ? "恢复计划" : "完成计划"}
        className={`check-button${plan.status === "completed" ? " checked" : ""}`}
        onClick={onToggle}
        type="button"
      >
        {plan.status === "completed" ? <CheckCircle2 size={18} aria-hidden="true" /> : null}
      </button>
    </div>
  );
}

function ModuleCard({
  icon,
  title,
  badge,
  summary,
  meta,
  to,
  tone
}: {
  icon: ReactNode;
  title: string;
  badge: string;
  summary: string;
  meta: string;
  to: string;
  tone: string;
}) {
  return (
    <Link className="module-card" to={to}>
      <div className="module-card-head">
        <span className={`module-icon ${tone}`}>{icon}</span>
        <span className="mini-badge">{badge}</span>
      </div>
      <div>
        <span className="module-name">{title}</span>
        <strong>{summary}</strong>
        <span>{meta}</span>
      </div>
    </Link>
  );
}

function PageLoading() {
  return (
    <div className="page-content">
      <div className="loading-panel">正在读取本地数据…</div>
    </div>
  );
}
