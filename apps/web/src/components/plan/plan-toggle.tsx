"use client";

interface PlanToggleProps {
  active: boolean;
  color: string;
}

export function PlanToggle({ active, color }: PlanToggleProps) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block h-[30px] w-[50px] flex-shrink-0 rounded-full transition-colors duration-200"
      style={{ background: active ? color : "rgba(13,27,53,0.14)" }}
    >
      <span
        className="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow-md transition-[left] duration-200 ease-out"
        style={{ left: active ? 23 : 3 }}
      />
    </span>
  );
}
