import { useState, type FormEvent } from 'react';
import { HttpError } from '../../../shared/api/apiError';
import {
  LEARNING_TASK_DESCRIPTION_MAX_LENGTH,
  LEARNING_TASK_TITLE_MAX_LENGTH,
  type LearningTaskResponse,
  type UpdateLearningTaskRequest,
} from '../api/learningTasksApi';
import { getLearningTaskErrorMessage } from '../lib/learningTaskErrors';
import {
  isLearningTaskDifficulty,
  learningTaskDifficulties,
  learningTaskDifficultyLabels,
} from '../model/learningTaskMetadata';
import styles from './LearningTaskForms.module.css';

type FieldErrors = Partial<Record<'title' | 'description' | 'difficulty', string>>;

export function EditLearningTaskForm({
  task,
  isPending,
  onCancel,
  onSubmit,
}: {
  task: LearningTaskResponse;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (request: UpdateLearningTaskRequest) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [difficulty, setDifficulty] = useState<string>(task.difficulty);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const errors: FieldErrors = {};
    if (!title.trim()) errors.title = 'Enter a task title.';
    else if (title.length > LEARNING_TASK_TITLE_MAX_LENGTH)
      errors.title = `Use ${LEARNING_TASK_TITLE_MAX_LENGTH} characters or fewer.`;
    if (description.length > LEARNING_TASK_DESCRIPTION_MAX_LENGTH)
      errors.description = `Use ${LEARNING_TASK_DESCRIPTION_MAX_LENGTH} characters or fewer.`;
    if (!isLearningTaskDifficulty(difficulty)) errors.difficulty = 'Choose a difficulty.';
    setFieldErrors(errors);
    setSubmissionError(null);
    if (Object.keys(errors).length || !isLearningTaskDifficulty(difficulty)) return;
    try {
      await onSubmit({ title, description: description || null, difficulty });
    } catch (error) {
      if (error instanceof HttpError) {
        const next: FieldErrors = {};
        for (const item of error.apiError?.fieldErrors ?? []) {
          if (item.field === 'title' || item.field === 'description' || item.field === 'difficulty')
            next[item.field] ??= item.message;
        }
        setFieldErrors(next);
      }
      setSubmissionError(getLearningTaskErrorMessage(error, 'The task could not be updated.'));
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
      <label className={styles.field}>
        <span>Title</span>
        <input
          autoFocus
          required
          maxLength={LEARNING_TASK_TITLE_MAX_LENGTH}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isPending}
          aria-invalid={!!fieldErrors.title}
        />
        {fieldErrors.title ? <small role="alert">{fieldErrors.title}</small> : null}
      </label>
      <label className={styles.field}>
        <span>Description (optional)</span>
        <textarea
          rows={4}
          maxLength={LEARNING_TASK_DESCRIPTION_MAX_LENGTH}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
          aria-invalid={!!fieldErrors.description}
        />
        {fieldErrors.description ? <small role="alert">{fieldErrors.description}</small> : null}
      </label>
      <label className={styles.field}>
        <span>Difficulty</span>
        <select
          required
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          disabled={isPending}
          aria-invalid={!!fieldErrors.difficulty}
        >
          {learningTaskDifficulties.map((value) => (
            <option key={value} value={value}>
              {learningTaskDifficultyLabels[value]}
            </option>
          ))}
        </select>
        {fieldErrors.difficulty ? <small role="alert">{fieldErrors.difficulty}</small> : null}
      </label>
      {submissionError ? (
        <p className={styles.submissionError} role="alert">
          {submissionError}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save details'}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
