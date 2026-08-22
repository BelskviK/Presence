// Loading placeholders sized to match the content they stand in for, so a card
// occupies its final height from the first paint instead of growing when data
// lands. Shapes mirror the real rows rather than being generic grey boxes.

export function Skeleton({ w = '100%', h = 12, className = '', style }) {
  return <span className={`skeleton block ${className}`} style={{ width: w, height: h, ...style }} />;
}

// A person/entry row: avatar + two stacked lines, optional trailing value.
export function SkeletonRow({ avatar = true, lines = 2, trailing = true }) {
  return (
    <div
      className="flex items-center gap-2.5 py-2.5"
      style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}
    >
      {avatar && <Skeleton w={28} h={28} style={{ borderRadius: '50%', flex: 'none' }} />}
      <span className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton w="60%" h={11} />
        {lines > 1 && <Skeleton w="38%" h={9} />}
      </span>
      {trailing && <Skeleton w={44} h={11} style={{ flex: 'none' }} />}
    </div>
  );
}

export function SkeletonRows({ count = 3, ...props }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => <SkeletonRow key={i} {...props} />)}
    </>
  );
}

// Bar-chart placeholder with pseudo-random but deterministic heights, so it
// reads as a chart rather than a flat block.
export function SkeletonChart({ bars = 14, height = 120 }) {
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="flex-1 flex flex-col justify-end" style={{ height: '100%' }}>
          <Skeleton h={`${30 + ((i * 37) % 60)}%`} />
        </span>
      ))}
    </div>
  );
}

export default Skeleton;
