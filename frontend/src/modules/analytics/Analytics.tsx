"use client";

import { PageHeader } from "@/components/elements/PageHeader";
import { ProjectionPlanner } from "./component/ProjectionPlanner";
import { ApyHistoryChart } from "./component/ApyHistoryChart";

export function Analytics() {
  return (
    <>
      <PageHeader title="Analytics" />
      <div className="space-y-8">
        <ProjectionPlanner />
        <ApyHistoryChart />
      </div>
    </>
  );
}
