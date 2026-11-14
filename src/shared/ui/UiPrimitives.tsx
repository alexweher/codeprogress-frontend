import type { HTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import styles from './UiPrimitives.module.css';

type Tone = 'primary' | 'success' | 'info' | 'warning' | 'neutral';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <article className={`${styles.card} ${className}`} {...props} />;
}

export function Badge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: Tone }>) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

export function ButtonLink({ className = '', ...props }: LinkProps) {
  return <Link className={`${styles.button} ${className}`} {...props} />;
}

export function Progress({ value, label }: { value: number; label: string }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
    >
      <span style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className={styles.emptyState}>
      <span className={styles.emptyIcon} aria-hidden="true">
        {icon}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </section>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`${styles.skeleton} ${className}`} aria-hidden="true" />;
}
