export function ProgressBar({
  value,
  label
}: {
  value: number;
  label: string;
}) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  );
}
