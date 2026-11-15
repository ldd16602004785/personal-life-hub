import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";

const HomePage = lazy(() =>
  import("../features/home/HomePage").then((module) => ({ default: module.HomePage }))
);
const TodayPage = lazy(() =>
  import("../features/today/TodayPage").then((module) => ({ default: module.TodayPage }))
);
const CarePage = lazy(() =>
  import("../features/care/CarePage").then((module) => ({ default: module.CarePage }))
);
const DevPage = lazy(() =>
  import("../features/dev/DevPage").then((module) => ({ default: module.DevPage }))
);
const LearningPage = lazy(() =>
  import("../features/learning/LearningPage").then((module) => ({
    default: module.LearningPage
  }))
);
const FitnessPage = lazy(() =>
  import("../features/fitness/FitnessPage").then((module) => ({ default: module.FitnessPage }))
);
const DietPage = lazy(() =>
  import("../features/diet/DietPage").then((module) => ({ default: module.DietPage }))
);
const EntertainmentPage = lazy(() =>
  import("../features/entertainment/EntertainmentPage").then((module) => ({
    default: module.EntertainmentPage
  }))
);
const SettingsPage = lazy(() =>
  import("../features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage }))
);

function page(element: ReactNode) {
  return (
    <Suspense fallback={<div className="route-loading">正在读取本地页面…</div>}>
      {element}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: page(<HomePage />) },
      { path: "today", element: page(<TodayPage />) },
      { path: "care", element: page(<CarePage />) },
      { path: "dev", element: page(<DevPage />) },
      { path: "learning", element: page(<LearningPage />) },
      { path: "consulting", element: <Navigate to="/learning" replace /> },
      { path: "fitness", element: page(<FitnessPage />) },
      { path: "diet", element: page(<DietPage />) },
      { path: "entertainment", element: page(<EntertainmentPage />) },
      { path: "settings", element: page(<SettingsPage />) },
      { path: "*", element: <Navigate to="/" replace /> }
    ]
  }
]);
