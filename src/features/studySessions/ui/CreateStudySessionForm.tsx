import { useState, type FormEvent } from 'react';
import { HttpError } from '../../../shared/api/apiError';
import type { LearningTaskResponse } from '../../learningTasks/api/learningTasksApi';
import { isLocalDate } from '../../learningTasks/lib/localDate';
import {
  STUDY_SESSION_DURATION_MAX,
  STUDY_SESSION_NOTE_MAX_LENGTH,
  type CreateStudySessionRequest,
} from '../api/studySessionsApi';
import { getStudySessionErrorMessage } from '../lib/studySessionErrors';
import styles from './CreateStudySessionForm.module.css';
import { useI18n } from '../../../shared/i18n/useI18n';
import { localizeTaskStatus } from '../../../shared/i18n/domainLabels';

type CreateStudySessionFormProps = {
  tasks: LearningTaskResponse[];
  areTasksLoading: boolean;
  tasksUnavailable: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (request: CreateStudySessionRequest) => Promise<void>;
};

type FieldName = 'sessionDate' | 'durationMinutes' | 'note' | 'completedTaskIds';
type FieldErrors = Partial<Record<FieldName, string>>;

function getBackendFieldErrors(error: HttpError) {
  const errors: FieldErrors = {};

  for (const fieldError of error.apiError?.fieldErrors ?? []) {
    const field = fieldError.field.replace(/\[.*$/, '') as FieldName;
    if (
      field === 'sessionDate' ||
      field === 'durationMinutes' ||
      field === 'note' ||
      field === 'completedTaskIds'
    ) {
      errors[field] ??= fieldError.message;
    }
  }

  return errors;
}

export function CreateStudySessionForm({
  tasks,
  areTasksLoading,
  tasksUnavailable,
  isPending,
  onCancel,
  onSubmit,
}: CreateStudySessionFormProps) {
  const { t } = useI18n();
  const [sessionDate, setSessionDate] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [note, setNote] = useState('');
  const [completedTaskIds, setCompletedTaskIds] = useState<number[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) {
      return;
    }

    const nextErrors: FieldErrors = {};
    if (!isLocalDate(sessionDate)) {
      nextErrors.sessionDate = t('sessions.dateInvalid');
    }

    const duration = Number(durationMinutes);
    if (!/^\d+$/.test(durationMinutes) || !Number.isSafeInteger(duration) || duration < 1) {
      nextErrors.durationMinutes = t('sessions.durationInvalid');
    } else if (duration > STUDY_SESSION_DURATION_MAX) {
      nextErrors.durationMinutes = t('sessions.maxMinutes', { count: STUDY_SESSION_DURATION_MAX });
    }

    if (note.length > STUDY_SESSION_NOTE_MAX_LENGTH) {
      nextErrors.note = t('common.maxCharacters', { count: STUDY_SESSION_NOTE_MAX_LENGTH });
    }

    const availableTaskIds = new Set(tasks.map((task) => task.id));
    if (completedTaskIds.some((taskId) => !availableTaskIds.has(taskId))) {
      nextErrors.completedTaskIds = t('sessions.refreshTasks');
    }

    setFieldErrors(nextErrors);
    setSubmissionError(null);
    if (Object.keys(nextErrors).length > 0 || !isLocalDate(sessionDate)) {
      return;
    }

    try {
      await onSubmit({
        sessionDate,
        durationMinutes: duration,
        note: note.length > 0 ? note : null,
        completedTaskIds,
      });
      setSessionDate('');
      setDurationMinutes('');
      setNote('');
      setCompletedTaskIds([]);
    } catch (error) {
      if (error instanceof HttpError) {
        setFieldErrors(getBackendFieldErrors(error));
      }
      setSubmissionError(getStudySessionErrorMessage(error, t('sessions.createError'), t));
    }
  }

  function errorId(field: FieldName) {
    return fieldErrors[field] ? `study-session-${field}-error` : undefined;
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="study-session-date">{t('sessions.date')}</label>
          <input
            id="study-session-date"
            name="sessionDate"
            type="date"
            required
            value={sessionDate}
            onChange={(event) => setSessionDate(event.target.value)}
            aria-invalid={fieldErrors.sessionDate ? true : undefined}
            aria-describedby={errorId('sessionDate')}
            disabled={isPending}
            autoFocus
          />
          {fieldErrors.sessionDate ? (
            <p id={errorId('sessionDate')} className={styles.error} role="alert">
              {fieldErrors.sessionDate}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="study-session-duration">{t('sessions.durationMinutes')}</label>
          <input
            id="study-session-duration"
            name="durationMinutes"
            type="number"
            inputMode="numeric"
            min="1"
            max={STUDY_SESSION_DURATION_MAX}
            step="1"
            required
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
            aria-invalid={fieldErrors.durationMinutes ? true : undefined}
            aria-describedby={errorId('durationMinutes')}
            disabled={isPending}
            placeholder={t('sessions.durationExample')}
          />
          {fieldErrors.durationMinutes ? (
            <p id={errorId('durationMinutes')} className={styles.error} role="alert">
              {fieldErrors.durationMinutes}
            </p>
          ) : null}
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="study-session-note">{t('sessions.notesOptional')}</label>
        <textarea
          id="study-session-note"
          name="note"
          rows={4}
          maxLength={STUDY_SESSION_NOTE_MAX_LENGTH}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-invalid={fieldErrors.note ? true : undefined}
          aria-describedby={`${errorId('note') ?? ''} study-session-note-hint`.trim()}
          disabled={isPending}
          placeholder={t('sessions.noteExample')}
        />
        <p id="study-session-note-hint" className={styles.hint}>
          {t('sessions.upToCharacters', { count: STUDY_SESSION_NOTE_MAX_LENGTH })}
        </p>
        {fieldErrors.note ? (
          <p id={errorId('note')} className={styles.error} role="alert">
            {fieldErrors.note}
          </p>
        ) : null}
      </div>

      <fieldset
        className={styles.tasksFieldset}
        aria-describedby="study-session-tasks-hint"
        disabled={isPending || areTasksLoading || tasksUnavailable}
      >
        <legend>{t('sessions.completedOptional')}</legend>
        <p id="study-session-tasks-hint" className={styles.hint}>
          {t('sessions.completionHint')}
        </p>
        {areTasksLoading ? <p className={styles.taskNotice}>{t('sessions.loadingTasks')}</p> : null}
        {tasksUnavailable ? (
          <p className={styles.taskNotice} role="alert">
            {t('sessions.tasksUnavailable')}
          </p>
        ) : null}
        {!areTasksLoading && !tasksUnavailable && tasks.length === 0 ? (
          <p className={styles.taskNotice}>{t('sessions.noTasksToSelect')}</p>
        ) : null}
        {!areTasksLoading && !tasksUnavailable && tasks.length > 0 ? (
          <div className={styles.taskOptions}>
            {tasks.map((task) => (
              <label className={styles.taskOption} key={task.id}>
                <input
                  type="checkbox"
                  name="completedTaskIds"
                  value={task.id}
                  checked={completedTaskIds.includes(task.id)}
                  onChange={(event) =>
                    setCompletedTaskIds((current) =>
                      event.target.checked
                        ? [...current, task.id]
                        : current.filter((taskId) => taskId !== task.id),
                    )
                  }
                />
                <span>
                  <strong>{task.title}</strong>
                  <small>{localizeTaskStatus(t, task.status)}</small>
                </span>
              </label>
            ))}
          </div>
        ) : null}
        {fieldErrors.completedTaskIds ? (
          <p id={errorId('completedTaskIds')} className={styles.error} role="alert">
            {fieldErrors.completedTaskIds}
          </p>
        ) : null}
      </fieldset>

      {submissionError ? (
        <p className={styles.submissionError} role="alert">
          {submissionError}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={isPending}>
          {isPending ? t('sessions.saving') : t('sessions.save')}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
