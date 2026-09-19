'use client';
import { useState } from 'react';
import { ChartColumnBig, Table2 } from 'lucide-react';
export type Row = { key: string; label: string; value: number; display: string; note?: string };
export function Figure({
  title,
  caption,
  table,
  wide,
  children,
}: {
  title: string;
  caption: string;
  table: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className={wide ? 'chart-figure wide' : 'chart-figure'}>
      <figcaption>
        <div>
          <h3>{title}</h3>
          <p>{caption}</p>
        </div>
        <button
          className="chart-toggle"
          aria-pressed={asTable}
          onClick={() => setAsTable(!asTable)}
        >
          {asTable ? <ChartColumnBig size={13} /> : <Table2 size={13} />}
          {asTable ? 'Chart' : 'Table'}
        </button>
      </figcaption>
      {asTable ? <div className="chart-table">{table}</div> : children}
    </figure>
  );
}
export function Columns({ rows, peak }: { rows: Row[]; peak: number }) {
  const crest = rows.findIndex((r) => r.value === peak && peak > 0);
  return (
    <div className="chart-columns">
      <div className="columns-plot" style={{ '--peak': peak } as React.CSSProperties}>
        <span className="columns-tick">{peak}</span>
        {rows.map((r, i) => (
          <div className="column-slot" key={r.key} title={`${r.note ?? r.label}: ${r.display}`}>
            {i === crest && <span className="column-cap">{r.display}</span>}
            <span
              className="column-fill"
              style={{ height: peak ? `${(r.value / peak) * 100}%` : '0%' }}
            />
          </div>
        ))}
      </div>
      <div className="columns-labels">
        {rows.map((r) => (
          <span key={r.key}>{r.label}</span>
        ))}
      </div>
    </div>
  );
}
export function Bars({ rows, peak }: { rows: Row[]; peak: number }) {
  return (
    <div className="chart-bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.key} title={`${r.label}: ${r.display}`}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: peak ? `${Math.max((r.value / peak) * 100, 1.5)}%` : '0%' }}
            />
          </span>
          <span className="bar-value">{r.display}</span>
        </div>
      ))}
    </div>
  );
}
export type Pair = { key: string; label: string; from: number; to: number; display: string };
export function Dumbbells({ rows, peak }: { rows: Pair[]; peak: number }) {
  const pct = (n: number) => (peak ? (n / peak) * 100 : 0);
  return (
    <div className="chart-dumbbells">
      <p className="chart-legend">
        <span>
          <i className="key estimated" /> Estimated
        </span>
        <span>
          <i className="key actual" /> Actual
        </span>
      </p>
      {rows.map((r) => (
        <div className="dumbbell-row" key={r.key} title={r.display}>
          <span className="bar-label">{r.label}</span>
          <span className="dumbbell-track">
            <span
              className="dumbbell-line"
              style={{
                left: `${Math.min(pct(r.from), pct(r.to))}%`,
                width: `${Math.abs(pct(r.to) - pct(r.from))}%`,
              }}
            />
            <span className="dumbbell-dot estimated" style={{ left: `${pct(r.from)}%` }} />
            <span className="dumbbell-dot actual" style={{ left: `${pct(r.to)}%` }} />
          </span>
          <span className="bar-value">{r.display}</span>
        </div>
      ))}
      <p className="chart-scale">
        <span />
        <span>
          <span>0</span>
          <span>{Math.round(peak)} min</span>
        </span>
        <span />
      </p>
    </div>
  );
}
