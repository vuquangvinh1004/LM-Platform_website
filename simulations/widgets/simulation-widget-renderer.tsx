"use client";

import { MovingAverageWidget } from "@/simulations/widgets/moving-average-widget";
import { NormalDistributionLinearRegressionWidget } from "@/simulations/widgets/normal-distribution-linear-regression-widget";
import { SimpleExponentialSmoothingWidget } from "@/simulations/widgets/simple-exponential-smoothing-widget";

type SimulationWidgetRendererProps = {
  slug: string;
};

export function SimulationWidgetRenderer({ slug }: SimulationWidgetRendererProps) {
  if (slug === "moving-average-basic") {
    return <MovingAverageWidget />;
  }

  if (slug === "simple-exponential-smoothing") {
    return <SimpleExponentialSmoothingWidget />;
  }

  if (slug === "normal-distribution-linear-regression") {
    return <NormalDistributionLinearRegressionWidget />;
  }

  return (
    <div className="mt-3 rounded-md border border-dashed border-slate-300 p-3 text-xs text-slate-600">
      Chưa có widget renderer cho slug: {slug}
    </div>
  );
}
