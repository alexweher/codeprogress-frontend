import { useState, type FormEvent } from 'react';
import { HttpError } from '../../../shared/api/apiError';
import type { LearningTaskResponse } from '../../learningTasks/api/learningTasksApi';
import { isLocalDate } from '../../learningTasks/lib/localDate';
import {
  STUDY_SESSION_DURATION_MAX,
  STUDY_SESSION_NOTE_MAX_LENGTH,
  type StudySessionResponse,
  type UpdateStudySessionRequest,
} from '../api/studySessionsApi';
import { getStudySessionErrorMessage } from '../lib/studySessionErrors';
import styles from './CreateStudySessionForm.module.css';
import { useI18n } from '../../../shared/i18n/useI18n';
import { localizeTaskStatus } from '../../../shared/i18n/domainLabels';

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

export function EditStudySessionForm({
  session,
  tasks,
  isPending,
  onCancel,
  onSubmit,
}: {
  session: StudySessionResponse;
  tasks: LearningTaskResponse[];
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (request: UpdateStudySessionRequest) => Promise<void>;
}) {
  const { t } = useI18n();
  const [sessionDate, setSessionDate] = useState(session.sessionDate);
  const [durationMinutes, setDurationMinutes] = useState(String(session.durationMinutes));
  const [note, setNote] = useState(session.note ?? '');
  const [completedTaskIds, setCompletedTaskIds] = useState([...session.completedTaskIds]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const errors: FieldErrors = {};
    if (!isLocalDate(sessionDate)) errors.sessionDate = t('sessions.dateInvalid');
    const duration = Number(durationMinutes);
    if (!/^\d+$/.test(durationMinutes) || !Number.isSafeInteger(duration) || duration < 1) {
      errors.durationMinutes = t('sessions.durationInvalid');
    } else if (duration > STUDY_SESSION_DURATION_MAX) {
      errors.durationMinutes = t('sessions.maxMinutes', { count: STUDY_SESSION_DURATION_MAX });
    }
    if (note.length > STUDY_SESSION_NOTE_MAX_LENGTH) {
      errors.note = t('common.maxCharacters', { count: STUDY_SESSION_NOTE_MAX_LENGTH });
    }
    const availableTaskIds = new Set(tasks.map((task) => task.id));
    if (completedTaskIds.some((taskId) => !availableTaskIds.has(taskId))) {
      errors.completedTaskIds = t('sessions.refreshSessionTasks');
    }

    setFieldErrors(errors);
    setSubmissionError(null);
    if (Object.keys(errors).length > 0 || !isLocalDate(sessionDate)) return;

    try {
      await onSubmit({
        sessionDate,
        durationMinutes: duration,
        note: note || null,
        completedTaskIds,
      });
    } catch (error) {
      if (error instanceof HttpError) setFieldErrors(getBackendFieldErrors(error));
      setSubmissionError(getStudySessionErrorMessage(error, t('sessions.updateError'), t));
    }
  }

  function errorId(field: FieldName) {
    return fieldErrors[field] ? `edit-study-session-${field}-error` : undefined;
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
      <p className={styles.warning} role="note">
        {t('sessions.updateWarning')}
      </p>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="edit-study-session-date">{t('sessions.date')}</label>
          <input
            id="edit-study-session-date"
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
          <label htmlFor="edit-study-session-duration">{t('sessions.durationMinutes')}</label>
          <input
            id="edit-study-session-duration"
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
        <label htmlFor="edit-study-session-note">{t('sessions.notesOptional')}</label>
        <textarea
          id="edit-study-session-note"
          name="note"
          rows={4}
          maxLength={STUDY_SESSION_NOTE_MAX_LENGTH}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-invalid={fieldErrors.note ? true : undefined}
          aria-describedby={errorId('note')}
          disabled={isPending}
          placeholder={t('sessions.noteExample')}
        />
        {fieldErrors.note ? (
          <p id={errorId('note')} className={styles.error} role="alert">
            {fieldErrors.note}
          </p>
        ) : null}
      </div>

      <fieldset className={styles.tasksFieldset} disabled={isPending}>
        <legend>{t('sessions.completedOptional')}</legend>
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
          {isPending ? t('sessions.updating') : t('sessions.update')}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
