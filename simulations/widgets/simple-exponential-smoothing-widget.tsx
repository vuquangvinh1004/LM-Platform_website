"use client";

import { useMemo, useState } from "react";
import { z } from "zod";

import { GREEK_SYMBOLS } from "@/lib/utils/greek-symbols";

const smoothingInputSchema = z.object({
  seriesText: z.string().trim().min(1),
  alpha: z.coerce.number().gt(0).lte(1),
});

function parseSeries(seriesText: string): number[] {
  return seriesText
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

type SmoothingPoint = {
  index: number;
  smoothed: number;
};

export function SimpleExponentialSmoothingWidget() {
  const [seriesText, setSeriesText] = useState("10,11,13,12,15,17,16");
  const [alpha, setAlpha] = useState("0.4");

  const parsed = useMemo(() => {
    const result = smoothingInputSchema.safeParse({
      seriesText,
      alpha,
    });

    if (!result.success) {
      return {
        ok: false as const,
        errorMessage: "Dữ liệu đầu vào không hợp lệ.",
      };
    }

    const series = parseSeries(result.data.seriesText);

    if (series.length < 2) {
      return {
        ok: false as const,
        errorMessage: "Cần ít nhất 2 điểm dữ liệu để mô phỏng.",
      };
    }

    const points: SmoothingPoint[] = [];
    let previousSmoothed = series[0];

    points.push({
      index: 1,
      smoothed: Number(previousSmoothed.toFixed(4)),
    });

    for (let index = 1; index < series.length; index += 1) {
      const smoothed = result.data.alpha * series[index] + (1 - result.data.alpha) * previousSmoothed;
      previousSmoothed = smoothed;

      points.push({
        index: index + 1,
        smoothed: Number(smoothed.toFixed(4)),
      });
    }

    return {
      ok: true as const,
      points,
      nextForecast: Number(previousSmoothed.toFixed(4)),
    };
  }, [alpha, seriesText]);

  return (
    <section className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid="simulation-exponential-smoothing-widget">
      <h3 className="text-sm font-semibold text-slate-900">Widget san bằng mũ đơn giản</h3>
      <p className="mt-1 text-xs text-slate-600">
        Điều chỉnh hệ số {GREEK_SYMBOLS.alpha} trong khoảng (0, 1] để thay đổi mức độ làm mượt của dự báo.
      </p>

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
          Hệ số {GREEK_SYMBOLS.alpha}
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            max="1"
            min="0.01"
            onChange={(event) => setAlpha(event.target.value)}
            step="0.01"
            type="number"
            value={alpha}
          />
        </label>
      </div>

      {!parsed.ok ? (
        <p className="mt-3 text-xs text-red-700">{parsed.errorMessage}</p>
      ) : (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-emerald-700">Dự báo kỳ tiếp theo: {parsed.nextForecast}</p>
          <ul className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700">
            {parsed.points.map((point) => (
              <li key={`${point.index}-${point.smoothed}`}>t={point.index}: {point.smoothed}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
