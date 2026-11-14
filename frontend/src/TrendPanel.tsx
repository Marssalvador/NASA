import { ArrowUpRight } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Analysis, Biomarker } from './types';
import { dateTime, fmt } from './lib';
export default function TrendPanel({
  definitions,
  metric,
  setMetric,
  current,
  definition,
  isAlert,
  onDetail,
}: {
  definitions: Biomarker[];
  metric: string;
  setMetric: (id: string) => void;
  current?: Analysis;
  definition?: Biomarker;
  isAlert: boolean;
  onDetail: () => void;
}) {
  const chart = current?.series.map((m) => ({
    time: new Date(m.timestamp).getTime(),
    value: m.quality === 'good' ? m.value : null,
  }));
  return (
    <div className="anatomy-trend">
      <label>
        Biomarcador
        <select
          aria-label="Biomarcador de la gráfica"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
        >
          {definitions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <div className="anatomy-trend-heading">
        <strong>{definition?.name}</strong>
        <span>n = {current?.n ?? 0}</span>
      </div>
      <div className="anatomy-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chart} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="anatomyTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={isAlert ? '#ba5344' : '#8d9b88'} stopOpacity={0.14} />
                <stop offset="1" stopColor="#f8f5f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#ded9d3" strokeDasharray="2 5" />
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t) =>
                new Date(t).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  timeZone: 'UTC',
                })
              }
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8e8781', fontSize: 10 }}
              minTickGap={35}
            />
            <YAxis
              domain={['auto', 'auto']}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8e8781', fontSize: 10 }}
              tickFormatter={(v) => fmt(v)}
            />
            <Tooltip
              labelFormatter={(t) => dateTime(new Date(Number(t)).toISOString())}
              formatter={(v) => [`${fmt(Number(v), 2)} ${definition?.unit}`, 'Medición']}
              contentStyle={{
                background: '#fffdfa',
                border: '1px solid #ded7cf',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {current?.baseline && (
              <ReferenceLine y={current.baseline.mean} stroke="#8e9b89" strokeDasharray="5 5" />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={isAlert ? '#b85447' : '#809075'}
              fill="url(#anatomyTrendFill)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="anatomy-trend-footnote">
        Línea discontinua: baseline personal. Sin intervalos estimados: los supuestos de la serie no
        están verificados.
      </p>
      <button className="anatomy-outline-button" onClick={onDetail}>
        Ver estadística e incertidumbre <ArrowUpRight size={14} />
      </button>
    </div>
  );
}
