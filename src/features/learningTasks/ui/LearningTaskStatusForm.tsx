import { useState, type FormEvent } from 'react';
import { getLearningTaskErrorMessage } from '../lib/learningTaskErrors';
import {
  learningTaskStatuses,
  learningTaskStatusLabels,
  type LearningTaskStatus,
} from '../model/learningTaskMetadata';
import type { UpdateLearningTaskStatusRequest } from '../api/learningTasksApi';
import styles from './LearningTaskForms.module.css';

export function LearningTaskStatusForm({
  currentStatus,
  isPending,
  onCancel,
  onSubmit,
}: {
  currentStatus: LearningTaskStatus;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (request: UpdateLearningTaskStatusRequest) => Promise<void>;
}) {
  const [status, setStatus] = useState<LearningTaskStatus>(currentStatus);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setError(null);
    try {
      await onSubmit({ status });
    } catch (cause) {
      setError(getLearningTaskErrorMessage(cause, 'The task status could not be changed.'));
    }
  }
  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
      <label className={styles.field}>
        <span>Status</span>
        <select
          autoFocus
          value={status}
          onChange={(e) => setStatus(e.target.value as LearningTaskStatus)}
          disabled={isPending}
        >
          {learningTaskStatuses.map((value) => (
            <option key={value} value={value}>
              {learningTaskStatusLabels[value]}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className={styles.submissionError} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button type="submit" disabled={isPending}>
          {isPending ? 'Changing…' : 'Change status'}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
