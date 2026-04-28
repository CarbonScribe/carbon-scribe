import { ReactNode } from 'react';
import Button from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    {icon && (
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500">
        {icon}
      </div>
    )}
    <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">
      {title}
    </h3>
    {description && (
      <p className="mb-4 max-w-xs text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
    )}
    {action && (
      <Button variant="primary" size="sm" onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </div>
);

export default EmptyState;
