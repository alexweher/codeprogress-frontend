import { useState, type FormEvent } from 'react';
import { HttpError } from '../../../shared/api/apiError';
import type {
  LearningTaskResponse,
  UpdateLearningTaskPlanningRequest,
} from '../api/learningTasksApi';
import { getLearningTaskErrorMessage } from '../lib/learningTaskErrors';
import { isLocalDate } from '../lib/localDate';
import { learningTaskPriorities, type LearningTaskPriority } from '../model/learningTaskMetadata';
import styles from './LearningTaskForms.module.css';
import { useI18n } from '../../../shared/i18n/useI18n';
import { localizePriority } from '../../../shared/i18n/domainLabels';

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
  const { t } = useI18n();
  const [deadline, setDeadline] = useState(task.deadline ?? '');
  const [priority, setPriority] = useState<LearningTaskPriority>(task.priority);
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    if (deadline && !isLocalDate(deadline)) {
      setDeadlineError(t('tasks.dateInvalid'));
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
      setError(getLearningTaskErrorMessage(cause, t('tasks.planningError'), t));
    }
  }
  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>
            {t('tasks.deadline')} {t('common.optional')}
          </span>
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
          <span>{t('tasks.priority')}</span>
          <select
            required
            value={priority}
            onChange={(e) => setPriority(e.target.value as LearningTaskPriority)}
            disabled={isPending}
            aria-invalid={!!priorityError}
          >
            {learningTaskPriorities.map((value) => (
              <option key={value} value={value}>
                {localizePriority(t, value)}
              </option>
            ))}
          </select>
          {priorityError ? <small role="alert">{priorityError}</small> : null}
        </label>
      </div>
      <p className={styles.hint}>{t('tasks.planningHint')}</p>
      {error ? (
        <p className={styles.submissionError} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button type="submit" disabled={isPending}>
          {isPending ? t('common.saving') : t('tasks.savePlanning')}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
