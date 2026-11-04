import { useState, type FormEvent } from 'react';
import { HttpError } from '../../../shared/api/apiError';
import type { TopicStatus, UpdateTopicStatusRequest } from '../api/topicsApi';
import { getTopicErrorMessage } from '../lib/topicErrors';
import { topicStatuses, topicStatusLabels } from '../model/topicStatus';
import styles from './TopicMutationForm.module.css';

type TopicStatusFormProps = {
  currentStatus: TopicStatus;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (request: UpdateTopicStatusRequest) => Promise<void>;
};

export function TopicStatusForm({
  currentStatus,
  isPending,
  onCancel,
  onSubmit,
}: TopicStatusFormProps) {
  const [status, setStatus] = useState<TopicStatus>(currentStatus);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || status === currentStatus) {
      return;
    }

    setFieldError(null);
    setSubmissionError(null);
    try {
      await onSubmit({ status });
    } catch (error) {
      if (error instanceof HttpError) {
        setFieldError(
          error.apiError?.fieldErrors.find((field) => field.field === 'status')?.message ?? null,
        );
      }
      setSubmissionError(getTopicErrorMessage(error, 'The topic status could not be changed.'));
    }
  }

  const errorId = fieldError ? 'topic-status-error' : undefined;

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div className={styles.field}>
        <label htmlFor="topic-status">Status</label>
        <select
          id="topic-status"
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as TopicStatus)}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={errorId}
          disabled={isPending}
          autoFocus
        >
          {topicStatuses.map((value) => (
            <option key={value} value={value}>
              {topicStatusLabels[value]}
            </option>
          ))}
        </select>
        {fieldError ? (
          <p className={styles.error} id={errorId} role="alert">
            {fieldError}
          </p>
        ) : null}
      </div>

      {submissionError ? (
        <p className={styles.error} role="alert">
          {submissionError}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={isPending || status === currentStatus}>
          {isPending ? 'Updating…' : 'Update status'}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
