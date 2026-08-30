import {
  Archive,
  CalendarDays,
  Database,
  Home,
  LibraryBig,
  Layers3,
  Search,
  Settings as SettingsIcon,
} from "lucide-react";
import { lazy, Suspense, type ReactNode } from "react";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";

import { DexieAppRepository } from "../data/durable-store.js";
import type { AppRepository } from "../data/app-repository.js";
import { AppStoreProvider, useAppStore } from "../data/use-app-store.js";
import { browserRuntime, type AppRuntime } from "./runtime.js";
import { UpdatePrompt } from "./UpdatePrompt.js";

const defaultRepository = new DexieAppRepository();

const HomePage = lazy(() =>
  import("../features/home/HomePage.js").then((module) => ({ default: module.HomePage })),
);
const RunPage = lazy(() =>
  import("../features/run/RunPage.js").then((module) => ({ default: module.RunPage })),
);
const RunsPage = lazy(() =>
  import("../features/run/RunsPage.js").then((module) => ({ default: module.RunsPage })),
);
const TemplatesPage = lazy(() =>
  import("../features/templates/TemplatesPage.js").then((module) => ({ default: module.TemplatesPage })),
);
const TemplateDetailPage = lazy(() =>
  import("../features/templates/TemplateDetailPage.js").then((module) => ({ default: module.TemplateDetailPage })),
);
const TemplateEditorPage = lazy(() =>
  import("../features/templates/TemplateEditorPage.js").then((module) => ({ default: module.TemplateEditorPage })),
);
const SearchPage = lazy(() =>
  import("../features/search/SearchPage.js").then((module) => ({ default: module.SearchPage })),
);
const PlansPage = lazy(() =>
  import("../features/plans/PlansPage.js").then((module) => ({ default: module.PlansPage })),
);
const PlanFormPage = lazy(() =>
  import("../features/plans/PlanFormPage.js").then((module) => ({ default: module.PlanFormPage })),
);
const HistoryPage = lazy(() =>
  import("../features/history/HistoryPage.js").then((module) => ({ default: module.HistoryPage })),
);
const HistoryDetailPage = lazy(() =>
  import("../features/history/HistoryDetailPage.js").then((module) => ({ default: module.HistoryDetailPage })),
);
const SharePage = lazy(() =>
  import("../features/share/SharePage.js").then((module) => ({ default: module.SharePage })),
);
const DataPage = lazy(() =>
  import("../features/data/DataPage.js").then((module) => ({ default: module.DataPage })),
);
const SettingsPage = lazy(() =>
  import("../features/settings/SettingsPage.js").then((module) => ({ default: module.SettingsPage })),
);

function Shell({ children }: { children: ReactNode }) {
  const { error, clearError } = useAppStore();
  const desktopNavItems = [
    { to: "/", label: "首页", icon: Home, end: true },
    { to: "/templates", label: "模板", icon: LibraryBig, end: false },
    { to: "/runs", label: "进行中", icon: Layers3, end: true },
    { to: "/plans", label: "计划", icon: CalendarDays, end: false },
    { to: "/history", label: "历史", icon: Archive, end: false },
    { to: "/data", label: "数据", icon: Database, end: false },
    { to: "/settings", label: "设置", icon: SettingsIcon, end: false },
  ];
  const bottomNavItems = [
    { to: "/", label: "首页", icon: Home, end: true },
    { to: "/templates", label: "模板", icon: LibraryBig, end: false },
    { to: "/runs", label: "进行中", icon: Layers3, end: true },
    { to: "/plans", label: "计划", icon: CalendarDays, end: false },
    { to: "/history", label: "历史", icon: Archive, end: false },
  ];
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="别忘了首页">
          <span className="brand-mark" aria-hidden="true">✓</span>
          <span>别忘了</span>
        </NavLink>
        <div className="topbar-actions">
          <NavLink className="topbar-icon-link" to="/search" aria-label="搜索">
            <Search size={19} />
          </NavLink>
          <NavLink className="topbar-icon-link" to="/settings" aria-label="设置">
            <SettingsIcon size={19} />
          </NavLink>
          <span className="local-only-pill">仅存本机</span>
        </div>
      </header>
      {error ? (
        <div className="save-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={clearError}>知道了</button>
        </div>
      ) : null}
      <UpdatePrompt />
      <div className="shell-body">
        <aside className="desktop-sidebar" aria-label="主导航">
          <p className="sidebar-kicker">安心检查</p>
          {desktopNavItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <Icon aria-hidden="true" size={20} />
              {label}
            </NavLink>
          ))}
        </aside>
        <main className="main-content">{children}</main>
      </div>
      <nav className="bottom-nav" aria-label="主导航">
        {bottomNavItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              isActive ? "bottom-link active" : "bottom-link"
            }
          >
            <Icon aria-hidden="true" size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function NotFound() {
  return (
    <section className="page narrow-page">
      <p className="eyebrow">本地清单</p>
      <h1>这里没有内容</h1>
      <div className="empty-card">
        <Layers3 aria-hidden="true" />
        <p>这个地址不存在，当前本地数据没有受到影响。</p>
        <NavLink className="primary-button link-button" to="/">返回首页</NavLink>
      </div>
    </section>
  );
}

export function AppRoutes() {
  return (
    <Shell>
      <Suspense fallback={<div className="route-loading" role="status">正在打开本地页面…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/runs/:runId" element={<RunPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/templates/new" element={<TemplateEditorPage />} />
          <Route path="/templates/personal/:templateId/edit" element={<TemplateEditorPage />} />
          <Route path="/templates/:kind/:templateId" element={<TemplateDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/plans/new" element={<PlanFormPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:runId" element={<HistoryDetailPage />} />
          <Route path="/share/run/:runId" element={<SharePage />} />
          <Route path="/share/template/:kind/:templateId" element={<SharePage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}

export function App({
  repository = defaultRepository,
  runtime = browserRuntime,
}: {
  repository?: AppRepository;
  runtime?: AppRuntime;
}) {
  return (
    <AppStoreProvider repository={repository} runtime={runtime}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppStoreProvider>
  );
}
