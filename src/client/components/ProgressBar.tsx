export default function ProgressBar({
  value,
  className = '',
}: {
  value: number;
  className?: string;
}) {
  return (
    <div className={`h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-accent rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
