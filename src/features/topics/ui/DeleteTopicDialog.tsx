import { useEffect, useRef, type KeyboardEvent } from 'react';
import styles from './DeleteTopicDialog.module.css';

type DeleteTopicDialogProps = {
  topicTitle: string;
  isPending: boolean;
  errorMessage: string | null;
  recoveryAction: 'back' | 'check' | null;
  onCancel: () => void;
  onConfirm: () => void;
  onRecovery: () => void;
};

export function DeleteTopicDialog({
  topicTitle,
  isPending,
  errorMessage,
  recoveryAction,
  onCancel,
  onConfirm,
  onRecovery,
}: DeleteTopicDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !isPending) {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-topic-title"
        aria-describedby="delete-topic-description delete-topic-consequence"
        onKeyDown={handleKeyDown}
      >
        <p className={styles.eyebrow}>Destructive action</p>
        <h2 id="delete-topic-title">Delete Topic?</h2>
        <p className={styles.warning} id="delete-topic-description">
          You are about to delete <strong>{topicTitle}</strong>.
        </p>
        <p className={styles.consequence} id="delete-topic-consequence">
          This action is permanent and cannot be undone. Topics with learning tasks or study
          sessions cannot be deleted.
        </p>

        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className={styles.actions}>
          {recoveryAction ? (
            <button className={styles.secondary} type="button" onClick={onRecovery}>
              {recoveryAction === 'back' ? 'Back to Topics' : 'Check topic state'}
            </button>
          ) : null}
          <button
            ref={cancelButtonRef}
            className={styles.cancel}
            type="button"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </button>
          <button className={styles.delete} type="button" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
