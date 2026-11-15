import {
  Code2,
  Database,
  Dumbbell,
  Gamepad2,
  HandHeart,
  LayoutDashboard,
  BookOpenCheck,
  SunMedium,
  Utensils
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getBootstrap } from "../lib/api";
import { QuickCaptureDialog } from "./QuickCaptureDialog";
import { SaveState, useUI } from "./UIProvider";

const navigation = [
  {
    label: "总览",
    items: [
      { to: "/", label: "首页", icon: LayoutDashboard },
      { to: "/today", label: "今日计划", icon: SunMedium }
    ]
  },
  {
    label: "关系",
    items: [{ to: "/care", label: "关怀对象", icon: HandHeart }]
  },
  {
    label: "工作",
    items: [
      { to: "/dev", label: "开发工作", icon: Code2 },
      { to: "/learning", label: "学习计划", icon: BookOpenCheck }
    ]
  },
  {
    label: "生活",
    items: [
      { to: "/fitness", label: "健身计划", icon: Dumbbell },
      { to: "/diet", label: "饮食计划", icon: Utensils },
      { to: "/entertainment", label: "游戏娱乐", icon: Gamepad2 }
    ]
  },
  {
    label: "系统",
    items: [{ to: "/settings", label: "数据与设置", icon: Database }]
  }
];

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const { saveMode, saveLabel, setSaved, setSaveError } = useUI();
  const hadConnectionError = useRef(false);
  const appliedDefaultPage = useRef(false);
  const bootstrap = useQuery({
    queryKey: ["bootstrap"],
    queryFn: getBootstrap,
    staleTime: Infinity
  });
  const pageInfo = getPageInfo(location.pathname);
  const uiTheme =
    bootstrap.data?.settings.uiTheme ??
    bootstrap.data?.settings.homeTheme ??
    "standard";
  const nightMode = bootstrap.data?.settings.nightMode === "true";

  useEffect(() => {
    if (bootstrap.isError && !hadConnectionError.current) {
      hadConnectionError.current = true;
      setSaveError("本地数据服务未连接");
    } else if (bootstrap.isSuccess && hadConnectionError.current) {
      hadConnectionError.current = false;
      setSaved();
    }
  }, [bootstrap.isError, bootstrap.isSuccess, setSaveError, setSaved]);

  useEffect(() => {
    const defaultPage = bootstrap.data?.settings.defaultPage;
    if (
      !appliedDefaultPage.current &&
      bootstrap.isSuccess &&
      location.pathname === "/" &&
      defaultPage &&
      defaultPage !== "/"
    ) {
      appliedDefaultPage.current = true;
      navigate(defaultPage, { replace: true });
    }
  }, [bootstrap.data?.settings.defaultPage, bootstrap.isSuccess, location.pathname, navigate]);

  useEffect(() => {
    const fontSize = bootstrap.data?.settings.fontSize ?? "small";
    document.documentElement.dataset.fontSize = fontSize;
    document.documentElement.dataset.uiTheme = uiTheme;
    document.documentElement.dataset.nightMode = String(nightMode);
    document.documentElement.style.colorScheme = nightMode ? "dark" : "light";
  }, [
    bootstrap.data?.settings.fontSize,
    bootstrap.data?.settings.uiTheme,
    bootstrap.data?.settings.homeTheme,
    bootstrap.data?.settings.nightMode,
    nightMode,
    uiTheme
  ]);

  return (
    <div
      className="app-shell"
      data-ui-theme={uiTheme}
      data-night-mode={String(nightMode)}
    >
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            今
          </span>
          <div>
            <strong>个人工作生活</strong>
            <span>WORK · LIFE · PLAY</span>
          </div>
        </div>
        <nav aria-label="主导航">
          {navigation.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    end={item.to === "/"}
                    className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
                    key={item.to}
                    to={item.to}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className={`local-state ${bootstrap.isError ? "error" : ""}`} role="status">
          <Database size={16} aria-hidden="true" />
          <span>
            {bootstrap.isPending
              ? "本地数据服务连接中"
              : bootstrap.isError
                ? "本地数据服务不可用"
                : "本地文件已连接"}
          </span>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="page-heading">
            <span className="eyebrow">{formatToday()}</span>
            <h1>{pageInfo.title}</h1>
          </div>
          <div className="top-actions">
            <SaveState />
            <button
              className="button primary"
              onClick={() => setQuickCaptureOpen(true)}
              type="button"
            >
              <span aria-hidden="true">＋</span>
              快速记录
            </button>
          </div>
        </header>
        {saveMode === "error" ? (
          <div className="connection-banner" role="alert">
            保存没有完成：{saveLabel}。请检查本地数据服务或当前输入后重试。
          </div>
        ) : null}
        <Outlet />
      </main>
      <QuickCaptureDialog open={quickCaptureOpen} onOpenChange={setQuickCaptureOpen} />
    </div>
  );
}

const pageInfoMap: Record<string, { title: string; description: string }> = {
  "/": { title: "下午好，今天按自己的节奏来。", description: "首页总览" },
  "/today": { title: "把注意力留给真正重要的事", description: "今日计划" },
  "/care": { title: "把重要的日子和一起经历的小事留下来", description: "关怀对象" },
  "/dev": { title: "按项目推进任务、问题与工作记录", description: "开发工作" },
  "/learning": { title: "把学习目标拆成阶段与每天能完成的任务", description: "学习计划" },
  "/fitness": { title: "按训练日执行，并用实际数据留下记录", description: "健身计划" },
  "/diet": { title: "记录每天怎么吃，也管理接下来的采购", description: "饮食计划" },
  "/entertainment": { title: "给想玩的、在玩的和已完成的留一个位置", description: "游戏娱乐" },
  "/settings": { title: "数据掌握在自己手里，可以备份、恢复和导出", description: "数据与设置" }
};

function getPageInfo(pathname: string) {
  return pageInfoMap[pathname] ?? pageInfoMap["/"];
}

function formatToday() {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(new Date());
}
