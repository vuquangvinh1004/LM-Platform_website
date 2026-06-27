import { GREEK_SYMBOLS } from "@/lib/utils/greek-symbols";

export type SimulationRegistryItem = {
  slug: string;
  title: string;
  description: string;
};

export const simulationsRegistry: SimulationRegistryItem[] = [
  {
    slug: "moving-average-basic",
    title: "Mô phỏng bình quân di động",
    description: "Widget mô phỏng tính bình quân di động với kích thước cửa sổ có thể điều chỉnh.",
  },
  {
    slug: "simple-exponential-smoothing",
    title: "Mô phỏng san bằng mũ đơn giản",
    description: `Widget mô phỏng hệ số ${GREEK_SYMBOLS.alpha} và dự báo theo chuỗi thời gian cơ bản.`,
  },
  {
    slug: "normal-distribution-linear-regression",
    title: "Mô phỏng phân phối chuẩn và hồi quy",
    description: "Widget minh họa xác suất cơ bản và đường hồi quy từ tập điểm mẫu.",
  },
];

export function findSimulationRegistryItem(slug: string): SimulationRegistryItem | undefined {
  return simulationsRegistry.find((item) => item.slug === slug);
}
