"use client";

import { useMemo, useState } from "react";
import { z } from "zod";

const movingAverageInputSchema = z.object({
  seriesText: z.string().trim().min(1),
  windowSize: z.coerce.number().int().min(2).max(20),
});

function parseSeries(seriesText: string): number[] {
  return seriesText
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

type MovingAveragePoint = {
  index: number;
  value: number;
};

export function MovingAverageWidget() {
  const [seriesText, setSeriesText] = useState("10,12,11,14,13,16,18,17");
  const [windowSize, setWindowSize] = useState("3");

  const parsed = useMemo(() => {
    const result = movingAverageInputSchema.safeParse({
      seriesText,
      windowSize,
    });

    if (!result.success) {
      return {
        ok: false as const,
        errorMessage: "Dữ liệu đầu vào không hợp lệ.",
      };
    }

    const series = parseSeries(result.data.seriesText);

    if (series.length < result.data.windowSize) {
      return {
        ok: false as const,
        errorMessage: "Số phần tử chuỗi dữ liệu phải lớn hơn hoặc bằng kích thước cửa sổ.",
      };
    }

    const points: MovingAveragePoint[] = [];

    for (let index = result.data.windowSize - 1; index < series.length; index += 1) {
      const window = series.slice(index - result.data.windowSize + 1, index + 1);
      const average = window.reduce((total, current) => total + current, 0) / window.length;

      points.push({
        index: index + 1,
        value: Number(average.toFixed(4)),
      });
    }

    return {
      ok: true as const,
      points,
    };
  }, [seriesText, windowSize]);

  return (
    <section className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid="simulation-moving-average-widget">
      <h3 className="text-sm font-semibold text-slate-900">Widget bình quân di động</h3>
      <p className="mt-1 text-xs text-slate-600">Nhập chuỗi số, phân tách bằng dấu phẩy, và kích thước cửa sổ.</p>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="text-xs text-slate-700">
          Chuỗi dữ liệu
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            onChange={(event) => setSeriesText(event.target.value)}
            value={seriesText}
          />
        </label>
        <label className="text-xs text-slate-700">
          Kích thước cửa sổ
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            onChange={(event) => setWindowSize(event.target.value)}
            type="number"
            value={windowSize}
          />
        </label>
      </div>

      {!parsed.ok ? (
        <p className="mt-3 text-xs text-red-700">{parsed.errorMessage}</p>
      ) : (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-emerald-700">Giá trị MA mới nhất: {parsed.points[parsed.points.length - 1]?.value ?? "-"}</p>
          <ul className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700">
            {parsed.points.map((point) => (
              <li key={`${point.index}-${point.value}`}>t={point.index}: {point.value}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
