"use client";

import { useMemo, useState } from "react";
import { z } from "zod";

const normalInputSchema = z.object({
  mean: z.coerce.number(),
  standardDeviation: z.coerce.number().gt(0),
  value: z.coerce.number(),
});

const regressionInputSchema = z.object({
  pointsText: z.string().trim().min(1),
});

type RegressionPoint = {
  x: number;
  y: number;
};

function parsePoints(pointsText: string): RegressionPoint[] {
  return pointsText
    .split(",")
    .map((segment) => segment.trim())
    .map((segment) => {
      const [rawX, rawY] = segment.split(":");
      const x = Number((rawX ?? "").trim());
      const y = Number((rawY ?? "").trim());

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      return { x, y };
    })
    .filter((point): point is RegressionPoint => Boolean(point));
}

function normalDensity(value: number, mean: number, standardDeviation: number): number {
  const coefficient = 1 / (standardDeviation * Math.sqrt(2 * Math.PI));
  const exponent = -((value - mean) ** 2) / (2 * standardDeviation ** 2);
  return coefficient * Math.exp(exponent);
}

export function NormalDistributionLinearRegressionWidget() {
  const [mean, setMean] = useState("0");
  const [standardDeviation, setStandardDeviation] = useState("1");
  const [value, setValue] = useState("1.2");
  const [pointsText, setPointsText] = useState("1:2,2:3,3:5,4:4,5:6");

  const normalResult = useMemo(() => {
    const parsed = normalInputSchema.safeParse({
      mean,
      standardDeviation,
      value,
    });

    if (!parsed.success) {
      return {
        ok: false as const,
        errorMessage: "Thông số phân phối chuẩn không hợp lệ.",
      };
    }

    const zScore = (parsed.data.value - parsed.data.mean) / parsed.data.standardDeviation;
    const density = normalDensity(parsed.data.value, parsed.data.mean, parsed.data.standardDeviation);

    return {
      ok: true as const,
      zScore: Number(zScore.toFixed(4)),
      density: Number(density.toFixed(6)),
    };
  }, [mean, standardDeviation, value]);

  const regressionResult = useMemo(() => {
    const parsed = regressionInputSchema.safeParse({ pointsText });

    if (!parsed.success) {
      return {
        ok: false as const,
        errorMessage: "Dữ liệu điểm hồi quy không hợp lệ.",
      };
    }

    const points = parsePoints(parsed.data.pointsText);

    if (points.length < 2) {
      return {
        ok: false as const,
        errorMessage: "Cần ít nhất 2 điểm dạng x:y, phân tách bằng dấu phẩy.",
      };
    }

    const n = points.length;
    const sumX = points.reduce((total, point) => total + point.x, 0);
    const sumY = points.reduce((total, point) => total + point.y, 0);
    const sumXY = points.reduce((total, point) => total + point.x * point.y, 0);
    const sumX2 = points.reduce((total, point) => total + point.x * point.x, 0);

    const denominator = n * sumX2 - sumX * sumX;

    if (denominator === 0) {
      return {
        ok: false as const,
        errorMessage: "Không thể tính hồi quy, dữ liệu x bị trùng lặp hoàn toàn.",
      };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    return {
      ok: true as const,
      slope: Number(slope.toFixed(4)),
      intercept: Number(intercept.toFixed(4)),
    };
  }, [pointsText]);

  return (
    <section className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid="simulation-normal-regression-widget">
      <h3 className="text-sm font-semibold text-slate-900">Widget phân phối chuẩn và hồi quy tuyến tính</h3>
      <p className="mt-1 text-xs text-slate-600">Nhập tham số để tính z-score, mật độ xác suất (density) và đường hồi quy cơ bản.</p>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <label className="text-xs text-slate-700">
          Trung bình
          <input className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setMean(event.target.value)} type="number" value={mean} />
        </label>
        <label className="text-xs text-slate-700">
          Độ lệch chuẩn
          <input className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setStandardDeviation(event.target.value)} type="number" value={standardDeviation} />
        </label>
        <label className="text-xs text-slate-700">
          Z-score value
          <input className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setValue(event.target.value)} type="number" value={value} />
        </label>
      </div>

      {!normalResult.ok ? (
        <p className="mt-2 text-xs text-red-700">{normalResult.errorMessage}</p>
      ) : (
        <p className="mt-2 text-xs text-emerald-700">z-score: {normalResult.zScore} | Mật độ xác suất (density): {normalResult.density}</p>
      )}

      <div className="mt-3">
        <label className="text-xs text-slate-700">
          Điểm hồi quy (x:y)
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            onChange={(event) => setPointsText(event.target.value)}
            value={pointsText}
          />
        </label>
      </div>

      {!regressionResult.ok ? (
        <p className="mt-2 text-xs text-red-700">{regressionResult.errorMessage}</p>
      ) : (
        <p className="mt-2 text-xs text-emerald-700">y = {regressionResult.slope}x + {regressionResult.intercept}</p>
      )}
    </section>
  );
}
