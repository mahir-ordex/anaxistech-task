import { AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

export function Alert({ className, variant = 'default', children, ...props }: AlertProps) {
  const variants = {
    default: 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]',
    success: 'bg-green-50 text-green-900 border-green-200',
    warning: 'bg-yellow-50 text-yellow-900 border-yellow-200',
    destructive: 'bg-red-50 text-red-900 border-red-200',
  };

  const icons = {
    default: Info,
    success: CheckCircle,
    warning: AlertCircle,
    destructive: XCircle,
  };

  const Icon = icons[variant];

  return (
    <div
      className={cn(
        'relative w-full rounded-lg border p-4 flex items-start gap-3',
        variants[variant],
        className
      )}
      {...props}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
