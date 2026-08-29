import {
  Archive,
  CalendarDays,
  Database,
  Home,
  Layers3,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";

import { DataPage } from "../features/data/DataPage.js";
import { HistoryPage } from "../features/history/HistoryPage.js";
import { HomePage } from "../features/home/HomePage.js";
import { PlanFormPage } from "../features/plans/PlanFormPage.js";
import { RunPage } from "../features/run/RunPage.js";
import { DexieAppRepository } from "../data/durable-store.js";
import { AppStoreProvider, useAppStore } from "../data/use-app-store.js";
import { browserRuntime, type AppRuntime } from "./runtime.js";
import { UpdatePrompt } from "./UpdatePrompt.js";

const defaultRepository = new DexieAppRepository();

function Shell({ children }: { children: ReactNode }) {
  const { error, clearError } = useAppStore();
  const navItems = [
    { to: "/", label: "首页", icon: Home, end: true },
    { to: "/plans/new", label: "计划", icon: CalendarDays, end: false },
    { to: "/history", label: "历史", icon: Archive, end: false },
    { to: "/data", label: "数据", icon: Database, end: false },
  ];
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="别忘了首页">
          <span className="brand-mark" aria-hidden="true">✓</span>
          <span>别忘了</span>
        </NavLink>
        <span className="local-only-pill">仅存本机</span>
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
          {navItems.map(({ to, label, icon: Icon, end }) => (
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
        {navItems.map(({ to, label, icon: Icon, end }) => (
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

function ComingSoon({ title }: { title: string }) {
  return (
    <section className="page narrow-page">
      <p className="eyebrow">本地清单</p>
      <h1>{title}</h1>
      <div className="empty-card">
        <Layers3 aria-hidden="true" />
        <p>这部分会在完整 V1 页面阶段接入同一套领域合同。</p>
      </div>
    </section>
  );
}

export function AppRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/runs/:runId" element={<RunPage />} />
        <Route path="/plans/new" element={<PlanFormPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="*" element={<ComingSoon title="这里还没有内容" />} />
      </Routes>
    </Shell>
  );
}

export function App({
  repository = defaultRepository,
  runtime = browserRuntime,
}: {
  repository?: DexieAppRepository;
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
