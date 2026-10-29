/** Decorative band of "building blocks" above the login card (UI_UX_GUIDELINES §8). */
export function BuildingBlocks() {
  const blocks = [
    "h-10 bg-primary-soft",
    "h-16 bg-brand",
    "h-12 bg-primary-soft",
    "h-20 bg-primary",
    "h-14 bg-primary-soft",
    "h-9 bg-brand",
    "h-16 bg-primary-soft",
  ];
  return (
    <div aria-hidden="true" className="flex h-20 items-end gap-2 overflow-hidden">
      {blocks.map((cls, i) => (
        <span key={i} className={`flex-1 rounded-t-[14px] ${cls}`} />
      ))}
    </div>
  );
}
