import { useState, type FormEvent } from 'react';
import { getLearningTaskErrorMessage } from '../lib/learningTaskErrors';
import { learningTaskStatuses, type LearningTaskStatus } from '../model/learningTaskMetadata';
import type { UpdateLearningTaskStatusRequest } from '../api/learningTasksApi';
import styles from './LearningTaskForms.module.css';
import { useI18n } from '../../../shared/i18n/useI18n';
import { localizeTaskStatus } from '../../../shared/i18n/domainLabels';

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
  const { t } = useI18n();
  const [status, setStatus] = useState<LearningTaskStatus>(currentStatus);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setError(null);
    try {
      await onSubmit({ status });
    } catch (cause) {
      setError(getLearningTaskErrorMessage(cause, t('tasks.statusError'), t));
    }
  }
  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
      <label className={styles.field}>
        <span>{t('topics.status')}</span>
        <select
          autoFocus
          value={status}
          onChange={(e) => setStatus(e.target.value as LearningTaskStatus)}
          disabled={isPending}
        >
          {learningTaskStatuses.map((value) => (
            <option key={value} value={value}>
              {localizeTaskStatus(t, value)}
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
          {isPending ? t('common.saving') : t('tasks.changeStatusButton')}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
