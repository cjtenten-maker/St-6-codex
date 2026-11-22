import { cx, Kicker } from "./ui";

export function Brand({
  size = "lg",
  as = "span",
  className,
}: {
  size?: "sm" | "lg";
  as?: "h1" | "span";
  className?: string;
}) {
  const Name = as;
  const body = (
    <>
      <img
        src="/logo.png"
        alt=""
        width={512}
        height={512}
        className={cx("shrink-0", size === "sm" ? "h-8 w-8" : "h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]")}
      />
      <div className="min-w-0">
        {size === "lg" ? <Kicker>Field codex</Kicker> : null}
        <Name
          className={cx(
            "font-display font-medium tracking-tight text-paper",
            size === "sm" ? "text-lg leading-none" : "mt-1 block text-4xl leading-[0.95] sm:text-5xl",
          )}
        >
          ST-6 Codex
        </Name>
      </div>
    </>
  );
  return <div className={cx("flex items-center", size === "sm" ? "gap-2" : "gap-3 sm:gap-4", className)}>{body}</div>;
}
