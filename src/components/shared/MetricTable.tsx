"use client";

interface Column {
  key: string;
  label: string;
  formatter?: (v: unknown) => string;
  align?: "left" | "right" | "center";
}

interface MetricTableProps {
  columns: Column[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  onRowClick?: (row: unknown) => void;
  highlightField?: string;
  highlightColor?: string;
}

export default function MetricTable({ columns, data, onRowClick, highlightField, highlightColor }: MetricTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--surface)]">
            {columns.map(col => (
              <th key={col.key} className={`py-2.5 px-3 text-[var(--muted)] font-medium text-[11px] uppercase tracking-wider ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-hover)] ${onRowClick ? "cursor-pointer" : ""}`}
            >
              {columns.map(col => {
                const val = row[col.key];
                const isHighlight = highlightField === col.key;
                return (
                  <td key={col.key} className={`py-2.5 px-3 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}`}
                    style={isHighlight ? { color: highlightColor || "var(--accent)", fontWeight: 600 } : { color: "var(--foreground)" }}>
                    {col.formatter ? col.formatter(val) : String(val ?? "")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
