import { useState, type FormEvent } from 'react';
import { HttpError } from '../../../shared/api/apiError';
import type {
  LearningTaskResponse,
  UpdateLearningTaskPlanningRequest,
} from '../api/learningTasksApi';
import { getLearningTaskErrorMessage } from '../lib/learningTaskErrors';
import { isLocalDate } from '../lib/localDate';
import {
  learningTaskPriorities,
  learningTaskPriorityLabels,
  type LearningTaskPriority,
} from '../model/learningTaskMetadata';
import styles from './LearningTaskForms.module.css';

export function LearningTaskPlanningForm({
  task,
  isPending,
  onCancel,
  onSubmit,
}: {
  task: LearningTaskResponse;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (request: UpdateLearningTaskPlanningRequest) => Promise<void>;
}) {
  const [deadline, setDeadline] = useState(task.deadline ?? '');
  const [priority, setPriority] = useState<LearningTaskPriority>(task.priority);
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    if (deadline && !isLocalDate(deadline)) {
      setDeadlineError('Enter a valid date.');
      return;
    }
    setDeadlineError(null);
    setPriorityError(null);
    setError(null);
    try {
      await onSubmit({ deadline: deadline || null, priority });
    } catch (cause) {
      if (cause instanceof HttpError) {
        for (const item of cause.apiError?.fieldErrors ?? []) {
          if (item.field === 'deadline') setDeadlineError(item.message);
          if (item.field === 'priority') setPriorityError(item.message);
        }
      }
      setError(getLearningTaskErrorMessage(cause, 'The task planning could not be updated.'));
    }
  }
  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Deadline (optional)</span>
          <input
            autoFocus
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            disabled={isPending}
            aria-invalid={!!deadlineError}
          />
          {deadlineError ? <small role="alert">{deadlineError}</small> : null}
        </label>
        <label className={styles.field}>
          <span>Priority</span>
          <select
            required
            value={priority}
            onChange={(e) => setPriority(e.target.value as LearningTaskPriority)}
            disabled={isPending}
            aria-invalid={!!priorityError}
          >
            {learningTaskPriorities.map((value) => (
              <option key={value} value={value}>
                {learningTaskPriorityLabels[value]}
              </option>
            ))}
          </select>
          {priorityError ? <small role="alert">{priorityError}</small> : null}
        </label>
      </div>
      <p className={styles.hint}>
        Clear the date to remove the deadline. Priority is required by API v1.0.0.
      </p>
      {error ? (
        <p className={styles.submissionError} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save planning'}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
