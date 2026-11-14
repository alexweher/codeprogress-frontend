import { useState, type FormEvent } from 'react';
import { HttpError } from '../../../shared/api/apiError';
import {
  LEARNING_TASK_DESCRIPTION_MAX_LENGTH,
  LEARNING_TASK_TITLE_MAX_LENGTH,
  type CreateLearningTaskRequest,
} from '../api/learningTasksApi';
import { getLearningTaskErrorMessage } from '../lib/learningTaskErrors';
import { isLocalDate } from '../lib/localDate';
import {
  isLearningTaskDifficulty,
  isLearningTaskPriority,
  learningTaskDifficulties,
  learningTaskPriorities,
} from '../model/learningTaskMetadata';
import styles from './CreateLearningTaskForm.module.css';
import { useI18n } from '../../../shared/i18n/useI18n';
import { localizeDifficulty, localizePriority } from '../../../shared/i18n/domainLabels';

type CreateLearningTaskFormProps = {
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (request: CreateLearningTaskRequest) => Promise<void>;
};

type FieldName = 'title' | 'description' | 'difficulty' | 'deadline' | 'priority';
type FieldErrors = Partial<Record<FieldName, string>>;

function getBackendFieldErrors(error: HttpError) {
  const errors: FieldErrors = {};

  for (const fieldError of error.apiError?.fieldErrors ?? []) {
    if (
      fieldError.field === 'title' ||
      fieldError.field === 'description' ||
      fieldError.field === 'difficulty' ||
      fieldError.field === 'deadline' ||
      fieldError.field === 'priority'
    ) {
      errors[fieldError.field] ??= fieldError.message;
    }
  }

  return errors;
}

export function CreateLearningTaskForm({
  isPending,
  onCancel,
  onSubmit,
}: CreateLearningTaskFormProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    const nextErrors: FieldErrors = {};
    if (title.trim().length === 0) {
      nextErrors.title = t('tasks.titleRequired');
    } else if (title.length > LEARNING_TASK_TITLE_MAX_LENGTH) {
      nextErrors.title = t('common.maxCharacters', { count: LEARNING_TASK_TITLE_MAX_LENGTH });
    }
    if (description.length > LEARNING_TASK_DESCRIPTION_MAX_LENGTH) {
      nextErrors.description = t('common.maxCharacters', {
        count: LEARNING_TASK_DESCRIPTION_MAX_LENGTH,
      });
    }
    if (!isLearningTaskDifficulty(difficulty)) {
      nextErrors.difficulty = t('tasks.difficultyRequired');
    }
    if (deadline.length > 0 && !isLocalDate(deadline)) {
      nextErrors.deadline = t('tasks.dateInvalid');
    }
    if (priority.length > 0 && !isLearningTaskPriority(priority)) {
      nextErrors.priority = t('tasks.priorityInvalid');
    }

    setFieldErrors(nextErrors);
    setSubmissionError(null);
    if (Object.keys(nextErrors).length > 0 || !isLearningTaskDifficulty(difficulty)) {
      return;
    }

    const request: CreateLearningTaskRequest = {
      title,
      description: description.length > 0 ? description : null,
      difficulty,
    };
    if (deadline.length > 0) {
      request.deadline = deadline;
    }
    if (isLearningTaskPriority(priority)) {
      request.priority = priority;
    }

    try {
      await onSubmit(request);
      setTitle('');
      setDescription('');
      setDifficulty('');
      setDeadline('');
      setPriority('');
    } catch (error) {
      if (error instanceof HttpError) {
        setFieldErrors(getBackendFieldErrors(error));
      }
      setSubmissionError(getLearningTaskErrorMessage(error, t('tasks.loadError'), t));
    }
  }

  function errorId(field: FieldName) {
    return fieldErrors[field] ? `learning-task-${field}-error` : undefined;
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div className={styles.field}>
        <label htmlFor="learning-task-title">{t('tasks.titleLabel')}</label>
        <input
          id="learning-task-title"
          name="title"
          type="text"
          autoComplete="off"
          required
          maxLength={LEARNING_TASK_TITLE_MAX_LENGTH}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={fieldErrors.title ? true : undefined}
          aria-describedby={errorId('title')}
          disabled={isPending}
          autoFocus
        />
        {fieldErrors.title ? (
          <p id={errorId('title')} className={styles.error} role="alert">
            {fieldErrors.title}
          </p>
        ) : null}
      </div>

      <div className={styles.field}>
        <label htmlFor="learning-task-description">
          {t('tasks.descriptionLabel')} {t('common.optional')}
        </label>
        <textarea
          id="learning-task-description"
          name="description"
          rows={4}
          maxLength={LEARNING_TASK_DESCRIPTION_MAX_LENGTH}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={fieldErrors.description ? true : undefined}
          aria-describedby={errorId('description')}
          disabled={isPending}
        />
        {fieldErrors.description ? (
          <p id={errorId('description')} className={styles.error} role="alert">
            {fieldErrors.description}
          </p>
        ) : null}
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="learning-task-difficulty">{t('tasks.difficulty')}</label>
          <select
            id="learning-task-difficulty"
            name="difficulty"
            required
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
            aria-invalid={fieldErrors.difficulty ? true : undefined}
            aria-describedby={errorId('difficulty')}
            disabled={isPending}
          >
            <option value="">{t('tasks.chooseDifficulty')}</option>
            {learningTaskDifficulties.map((value) => (
              <option key={value} value={value}>
                {localizeDifficulty(t, value)}
              </option>
            ))}
          </select>
          {fieldErrors.difficulty ? (
            <p id={errorId('difficulty')} className={styles.error} role="alert">
              {fieldErrors.difficulty}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="learning-task-deadline">
            {t('tasks.deadline')} {t('common.optional')}
          </label>
          <input
            id="learning-task-deadline"
            name="deadline"
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            aria-invalid={fieldErrors.deadline ? true : undefined}
            aria-describedby={errorId('deadline')}
            disabled={isPending}
          />
          {fieldErrors.deadline ? (
            <p id={errorId('deadline')} className={styles.error} role="alert">
              {fieldErrors.deadline}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="learning-task-priority">
            {t('tasks.priority')} {t('common.optional')}
          </label>
          <select
            id="learning-task-priority"
            name="priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            aria-invalid={fieldErrors.priority ? true : undefined}
            aria-describedby={`${errorId('priority') ?? ''} learning-task-priority-hint`.trim()}
            disabled={isPending}
          >
            <option value="">{t('tasks.defaultPriority')}</option>
            {learningTaskPriorities.map((value) => (
              <option key={value} value={value}>
                {localizePriority(t, value)}
              </option>
            ))}
          </select>
          <p id="learning-task-priority-hint" className={styles.hint}>
            {t('tasks.defaultPriorityHint')}
          </p>
          {fieldErrors.priority ? (
            <p id={errorId('priority')} className={styles.error} role="alert">
              {fieldErrors.priority}
            </p>
          ) : null}
        </div>
      </div>

      {submissionError ? (
        <p className={styles.submissionError} role="alert">
          {submissionError}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={isPending}>
          {isPending ? t('tasks.creating') : t('tasks.create')}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
