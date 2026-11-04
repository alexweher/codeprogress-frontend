import { useState, type FormEvent } from 'react';
import { HttpError, NetworkError, ResponseFormatError } from '../../../shared/api/apiError';
import {
  TOPIC_DESCRIPTION_MAX_LENGTH,
  TOPIC_TITLE_MAX_LENGTH,
  type CreateTopicRequest,
} from '../api/topicsApi';

type CreateTopicFormProps = {
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (request: CreateTopicRequest) => Promise<void>;
};

type FieldErrors = Partial<Record<'title' | 'description', string>>;

function getSubmissionMessage(error: unknown) {
  if (error instanceof NetworkError) {
    return 'CodeProgress could not reach the server. Check your connection and try again.';
  }

  if (error instanceof ResponseFormatError) {
    return 'The server returned an unexpected response. Please try again.';
  }

  if (error instanceof HttpError) {
    return error.apiError?.message ?? 'The topic could not be created. Please try again.';
  }

  return 'Something went wrong. Please try again.';
}

export function CreateTopicForm({ isPending, onCancel, onSubmit }: CreateTopicFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
      await onSubmit({
        title,
        description: description.length > 0 ? description : null,
      });
      setTitle('');
      setDescription('');
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
      setSubmissionError(getSubmissionMessage(error));
    }
  }

  const titleErrorId = fieldErrors.title ? 'topic-title-error' : undefined;
  const descriptionErrorId = fieldErrors.description ? 'topic-description-error' : undefined;

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div>
        <label htmlFor="topic-title">Title</label>
        <input
          id="topic-title"
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
          <p id={titleErrorId} role="alert">
            {fieldErrors.title}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="topic-description">Description (optional)</label>
        <textarea
          id="topic-description"
          name="description"
          rows={5}
          maxLength={TOPIC_DESCRIPTION_MAX_LENGTH}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={fieldErrors.description ? true : undefined}
          aria-describedby={descriptionErrorId}
          disabled={isPending}
        />
        {fieldErrors.description ? (
          <p id={descriptionErrorId} role="alert">
            {fieldErrors.description}
          </p>
        ) : null}
      </div>

      {submissionError ? <p role="alert">{submissionError}</p> : null}

      <div>
        <button type="submit" disabled={isPending}>
          {isPending ? 'Creating…' : 'Create topic'}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
