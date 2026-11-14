import { useEffect, useRef, useState, type RefObject } from 'react';
import styles from './ActionMenu.module.css';

export type ActionMenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export function ActionMenu({
  label,
  items,
  triggerRef,
}: {
  label: string;
  items: ActionMenuItem[];
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const internalTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeTriggerRef = triggerRef ?? internalTriggerRef;

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  function closeAndRestoreFocus() {
    setOpen(false);
    window.setTimeout(() => activeTriggerRef.current?.focus(), 0);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={activeTriggerRef}
        className={styles.trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {label} <span aria-hidden="true">•••</span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          className={styles.menu}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeAndRestoreFocus();
              return;
            }
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const buttons = Array.from(
              menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
            );
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const offset = event.key === 'ArrowDown' ? 1 : -1;
            buttons[(current + offset + buttons.length) % buttons.length]?.focus();
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? styles.danger : undefined}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
