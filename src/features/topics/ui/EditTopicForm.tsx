import { useState, type FormEvent } from 'react';
import { HttpError } from '../../../shared/api/apiError';
import {
  TOPIC_DESCRIPTION_MAX_LENGTH,
  TOPIC_TITLE_MAX_LENGTH,
  type TopicResponse,
  type UpdateTopicRequest,
} from '../api/topicsApi';
import { getTopicErrorMessage } from '../lib/topicErrors';
import styles from './TopicMutationForm.module.css';

type EditTopicFormProps = {
  topic: TopicResponse;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (request: UpdateTopicRequest) => Promise<void>;
};

type FieldErrors = Partial<Record<'title' | 'description', string>>;

export function EditTopicForm({ topic, isPending, onCancel, onSubmit }: EditTopicFormProps) {
  const [title, setTitle] = useState(topic.title);
  const [description, setDescription] = useState(topic.description ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) {
      return;
    }

    const nextErrors: FieldErrors = {};
    if (title.trim().length === 0) {
      nextErrors.title = 'Enter a topic title.';
    } else if (title.length > TOPIC_TITLE_MAX_LENGTH) {
      nextErrors.title = `Use ${TOPIC_TITLE_MAX_LENGTH} characters or fewer.`;
    }
    if (description.length > TOPIC_DESCRIPTION_MAX_LENGTH) {
      nextErrors.description = `Use ${TOPIC_DESCRIPTION_MAX_LENGTH} characters or fewer.`;
    }

    setFieldErrors(nextErrors);
    setSubmissionError(null);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      await onSubmit({ title, description: description.length > 0 ? description : null });
    } catch (error) {
      if (error instanceof HttpError && error.apiError?.fieldErrors.length) {
        const backendErrors: FieldErrors = {};
        for (const fieldError of error.apiError.fieldErrors) {
          if (fieldError.field === 'title' || fieldError.field === 'description') {
            backendErrors[fieldError.field] ??= fieldError.message;
          }
        }
        setFieldErrors(backendErrors);
      }
      setSubmissionError(getTopicErrorMessage(error, 'The topic could not be updated.'));
    }
  }

  const titleErrorId = fieldErrors.title ? 'edit-topic-title-error' : undefined;
  const descriptionErrorId = fieldErrors.description ? 'edit-topic-description-error' : undefined;

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div className={styles.field}>
        <label htmlFor="edit-topic-title">Title</label>
        <input
          id="edit-topic-title"
          name="title"
          type="text"
          autoComplete="off"
          required
          maxLength={TOPIC_TITLE_MAX_LENGTH}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={fieldErrors.title ? true : undefined}
          aria-describedby={titleErrorId}
          disabled={isPending}
          autoFocus
        />
        {fieldErrors.title ? (
          <p className={styles.error} id={titleErrorId} role="alert">
            {fieldErrors.title}
          </p>
        ) : null}
      </div>

      <div className={styles.field}>
        <label htmlFor="edit-topic-description">Description (optional)</label>
        <textarea
          id="edit-topic-description"
          name="description"
          rows={6}
          maxLength={TOPIC_DESCRIPTION_MAX_LENGTH}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={fieldErrors.description ? true : undefined}
          aria-describedby={descriptionErrorId}
          disabled={isPending}
        />
        {fieldErrors.description ? (
          <p className={styles.error} id={descriptionErrorId} role="alert">
            {fieldErrors.description}
          </p>
        ) : null}
      </div>

      {submissionError ? (
        <p className={styles.error} role="alert">
          {submissionError}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
