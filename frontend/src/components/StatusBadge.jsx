// Deliberately monochrome — matches the design system, which uses tag-accent
// (positive/resolved), tag-outline (pending/awaiting) and tag-neutral (closed,
// negative, inactive) rather than semantic red/green/yellow colors.
const VARIANTS = {
  COMPLETED: 'tag tag-accent',
  APPROVED: 'tag tag-accent',
  ACTIVE: 'tag tag-accent',
  PENDING: 'tag tag-outline',
  MISSING_CLOCKOUT: 'tag tag-neutral',
  REJECTED: 'tag tag-neutral',
  INCOMPLETE: 'tag tag-neutral',
  CANCELLED: 'tag tag-neutral',
  ON_LEAVE: 'tag tag-accent-2',
  INACTIVE: 'tag tag-neutral',
};

export default function StatusBadge({ status, label }) {
  const variant = VARIANTS[status] || 'tag tag-neutral';
  return <span className={variant}>{label || status}</span>;
}
