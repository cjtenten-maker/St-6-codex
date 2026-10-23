import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  tone = "brass",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "brass" | "ghost" | "good" | "danger" | "quiet" }) {
  const tones = {
    brass: "bg-brass text-ink hover:bg-[#f0c27a]",
    ghost: "border border-line bg-panel/60 text-paper hover:border-brass/70",
    good: "bg-good text-ink hover:bg-[#a8d194]",
    danger: "border border-hp/50 text-hp hover:bg-hp/10",
    quiet: "text-mute hover:text-paper",
  };
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl font-medium transition disabled:opacity-40",
        tones[tone],
        className,
      )}
    />
  );
}

export function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full min-h-11 rounded-xl border border-line bg-ink px-3 text-paper placeholder:text-mute/70",
        props.className,
      )}
    />
  );
}

export function Area(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx("w-full rounded-xl border border-line bg-ink px-3 py-2 text-paper placeholder:text-mute/70", props.className)}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-2xl border border-line bg-panel/90 p-4 shadow-card", className)}>{children}</section>;
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-[11px] uppercase tracking-[0.18em] text-brass">{children}</p>;
}

export function Meter({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "hp" | "mana";
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px] uppercase tracking-[0.16em] text-mute">
        <span>{label}</span>
        <span className="num text-sm tracking-normal text-paper">
          {value}/{max}
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/50">
        <div className={cx("h-full rounded-full", tone === "hp" ? "bg-hp" : "bg-mana")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Pips({ value, max = 8 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${value} of ${max} hero points`}>
      {Array.from({ length: max }, (_, index) => (
        <span
          key={index}
          className={cx("h-2.5 w-2.5 rotate-45 rounded-[2px]", index < value ? "bg-brass" : "bg-line")}
        />
      ))}
    </div>
  );
}

export function Banner({ children, tone = "brass" }: { children: ReactNode; tone?: "brass" | "good" | "miss" }) {
  const tones = {
    brass: "border-brass/40 bg-brass/10 text-brass",
    good: "border-good/40 bg-good/10 text-good",
    miss: "border-line bg-black/20 text-mute",
  };
  return <div className={cx("rounded-xl border px-3 py-2 text-sm", tones[tone])}>{children}</div>;
}
