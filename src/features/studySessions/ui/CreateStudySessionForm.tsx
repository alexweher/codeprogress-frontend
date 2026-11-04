import { useState, type FormEvent } from 'react';
import { HttpError } from '../../../shared/api/apiError';
import type { LearningTaskResponse } from '../../learningTasks/api/learningTasksApi';
import { isLocalDate } from '../../learningTasks/lib/localDate';
import { learningTaskStatusLabels } from '../../learningTasks/model/learningTaskMetadata';
import {
  STUDY_SESSION_DURATION_MAX,
  STUDY_SESSION_NOTE_MAX_LENGTH,
  type CreateStudySessionRequest,
} from '../api/studySessionsApi';
import { getStudySessionErrorMessage } from '../lib/studySessionErrors';
import styles from './CreateStudySessionForm.module.css';

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
      nextErrors.sessionDate = 'Enter a valid session date.';
    }

    const duration = Number(durationMinutes);
    if (!/^\d+$/.test(durationMinutes) || !Number.isSafeInteger(duration) || duration < 1) {
      nextErrors.durationMinutes = 'Enter a whole number greater than zero.';
    } else if (duration > STUDY_SESSION_DURATION_MAX) {
      nextErrors.durationMinutes = `Use ${STUDY_SESSION_DURATION_MAX} minutes or fewer.`;
    }

    if (note.length > STUDY_SESSION_NOTE_MAX_LENGTH) {
      nextErrors.note = `Use ${STUDY_SESSION_NOTE_MAX_LENGTH} characters or fewer.`;
    }

    const availableTaskIds = new Set(tasks.map((task) => task.id));
    if (completedTaskIds.some((taskId) => !availableTaskIds.has(taskId))) {
      nextErrors.completedTaskIds = 'Refresh the topic and choose available tasks again.';
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
      setSubmissionError(
        getStudySessionErrorMessage(error, 'The study session could not be created. Try again.'),
      );
    }
  }

  function errorId(field: FieldName) {
    return fieldErrors[field] ? `study-session-${field}-error` : undefined;
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="study-session-date">Session date</label>
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
          <label htmlFor="study-session-duration">Duration (minutes)</label>
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
          />
          {fieldErrors.durationMinutes ? (
            <p id={errorId('durationMinutes')} className={styles.error} role="alert">
              {fieldErrors.durationMinutes}
            </p>
          ) : null}
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="study-session-note">Notes (optional)</label>
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
        />
        <p id="study-session-note-hint" className={styles.hint}>
          Up to {STUDY_SESSION_NOTE_MAX_LENGTH} characters.
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
        <legend>Tasks completed during this session (optional)</legend>
        <p id="study-session-tasks-hint" className={styles.hint}>
          Selected tasks are recorded in session history. Tasks not already complete are moved to
          Completed atomically by API v1.0.0.
        </p>
        {areTasksLoading ? <p className={styles.taskNotice}>Loading available tasks…</p> : null}
        {tasksUnavailable ? (
          <p className={styles.taskNotice} role="alert">
            Tasks are unavailable. You can still save this session without completed tasks.
          </p>
        ) : null}
        {!areTasksLoading && !tasksUnavailable && tasks.length === 0 ? (
          <p className={styles.taskNotice}>This topic has no learning tasks to select.</p>
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
                  <small>{learningTaskStatusLabels[task.status]}</small>
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
          {isPending ? 'Saving session…' : 'Save session'}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
