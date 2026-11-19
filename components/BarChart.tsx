"use client";
import { useState } from "react";
import { longDate, niceMax, shortDate } from "@/lib/stats";

type Point = { d: string; value: number };

const W = 600;
const H = 150;
const PAD = { l: 30, r: 8, t: 22, b: 22 };
const BAR = "#F55A00"; // laranja do logo: uma cor só por gráfico
const BAR_ACTIVE = "#CC4700";

/**
 * Gráfico de colunas de uma métrica por dia. Um eixo, uma cor, barras finas com topo arredondado
 * e valor ao passar o mouse/dedo ou focar com o teclado. A mesma informação existe na tabela abaixo.
 */
export function BarChart({ title, points, one, many, summary }: { title: string; points: Point[]; one: string; many: string; summary?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const slot = innerW / Math.max(n, 1);
  const barW = Math.min(24, slot * 0.62);
  const total = points.reduce((a, p) => a + p.value, 0);
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;
  const unit = (v: number) => `${v} ${v === 1 ? one : many}`;

  const maxIdx = points.reduce((best, p, i) => (p.value > (points[best]?.value ?? -1) ? i : best), 0);
  const labelStep = n <= 7 ? 1 : Math.ceil(n / 5);
  // `summary` permite um total que não é a soma das barras (ex.: pessoas únicas no período).
  const periodText = summary ?? `${unit(total)} no período`;
  const readout = active !== null ? `${longDate(points[active].d)} · ${unit(points[active].value)}` : periodText;

  return (
    <figure className="card !p-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-xs font-semibold text-navy/70" aria-live="polite">{readout}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full touch-none select-none" role="group" aria-label={`${title}: ${periodText}`}>
        {/* eixo: 0 e topo, em traço fino e discreto */}
        {[0, max].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#e7e1d9" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#51677f">{t}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const cx = PAD.l + slot * i + slot / 2;
          const h = (p.value / max) * innerH;
          const x = cx - barW / 2;
          const top = y(p.value);
          const r = Math.min(4, barW / 2, h);
          const on = active === i;
          return (
            <g key={p.d}>
              {p.value > 0 && (
                // topo arredondado (4px), base reta na linha de base
                <path
                  d={`M${x},${PAD.t + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${PAD.t + innerH} Z`}
                  fill={on ? BAR_ACTIVE : BAR}
                />
              )}
              {/* área de toque bem maior que a barra */}
              <rect
                x={PAD.l + slot * i}
                y={PAD.t}
                width={slot}
                height={innerH + PAD.b - 4}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${longDate(p.d)}: ${unit(p.value)}`}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
                onFocus={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onBlur={() => setActive(null)}
                style={{ outline: "none" }}
              />
              {i % labelStep === 0 || i === n - 1 ? (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize={11} fill="#51677f">{shortDate(p.d)}</text>
              ) : null}
            </g>
          );
        })}
        {/* valor só no ponto mais alto, para não encher o gráfico de números */}
        {points[maxIdx]?.value > 0 && active === null && (
          <text x={PAD.l + slot * maxIdx + slot / 2} y={y(points[maxIdx].value) - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1b3a59">
            {points[maxIdx].value}
          </text>
        )}
        {total === 0 && (
          <text x={W / 2} y={PAD.t + innerH / 2} textAnchor="middle" fontSize={13} fill="#51677f">Ainda sem dados neste período</text>
        )}
      </svg>
    </figure>
  );
}
