import { firmHue, initials } from "../lib/format";

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const hue = firmHue(name);
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.42, ["--hue" as string]: hue }}
    >
      {initials(name)}
    </span>
  );
}
