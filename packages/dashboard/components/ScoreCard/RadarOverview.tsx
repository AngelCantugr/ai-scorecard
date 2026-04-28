"use client";

import type { DimensionScore } from "@ai-scorecard/core";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card } from "@/components/ui/Card";

interface RadarOverviewProps {
  dimensions: DimensionScore[];
}

export function RadarOverview({ dimensions }: RadarOverviewProps) {
  const data = dimensions.map((d) => ({
    dimension: d.name,
    percentage: d.percentage,
    score: d.score,
    maxScore: d.maxScore,
  }));

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-white">
        Dimension Overview
      </h2>
      <div
        aria-label="Radar chart showing scores across all 6 dimensions"
        role="img"
      >
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />
            <Radar
              name="Score"
              dataKey="percentage"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f1f5f9",
              }}
              formatter={(value, _name, props) => {
                const item = props.payload as {
                  score: number;
                  maxScore: number;
                } | undefined;
                const pct = typeof value === "number" ? value : 0;
                if (item) {
                  return [
                    `${item.score}/${item.maxScore} (${pct}%)`,
                    "Score",
                  ];
                }
                return [`${pct}%`, "Score"];
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
