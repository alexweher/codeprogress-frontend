import { useEffect, useRef, type KeyboardEvent } from 'react';
import { formatLocalDate } from '../../learningTasks/lib/localDate';
import styles from '../../topics/ui/DeleteTopicDialog.module.css';

type DeleteStudySessionDialogProps = {
  sessionDate: string;
  durationMinutes: number;
  isPending: boolean;
  errorMessage: string | null;
  recoveryAction: 'back' | 'check' | null;
  onCancel: () => void;
  onConfirm: () => void;
  onRecovery: () => void;
};

export function DeleteStudySessionDialog({
  sessionDate,
  durationMinutes,
  isPending,
  errorMessage,
  recoveryAction,
  onCancel,
  onConfirm,
  onRecovery,
}: DeleteStudySessionDialogProps) {
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

    if (event.key !== 'Tab') return;
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
        aria-labelledby="delete-study-session-title"
        aria-describedby="delete-study-session-description delete-study-session-consequence"
        onKeyDown={handleKeyDown}
      >
        <p className={styles.eyebrow}>Destructive action</p>
        <h2 id="delete-study-session-title">Delete study session?</h2>
        <p className={styles.warning} id="delete-study-session-description">
          You are about to delete the session from <strong>{formatLocalDate(sessionDate)}</strong> (
          {durationMinutes} minutes).
        </p>
        <p className={styles.consequence} id="delete-study-session-consequence">
          This action is permanent. Tasks completed by this session may return to their previous
          status only when no other study session still completes them. Manually completed tasks
          remain completed.
        </p>

        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className={styles.actions}>
          {recoveryAction ? (
            <button className={styles.secondary} type="button" onClick={onRecovery}>
              {recoveryAction === 'back' ? 'Back to Topic' : 'Check session state'}
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
