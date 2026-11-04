import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HttpError,
  NetworkError,
  RequestAbortedError,
  ResponseFormatError,
} from '../../../shared/api/apiError';
import { useAuth } from '../model/useAuth';
import styles from './LoginForm.module.css';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

type LoginFormProps = {
  initialEmail?: string;
  successMessage?: string;
};

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    errors.email = 'Email is required.';
  } else if (normalizedEmail.length > 320) {
    errors.email = 'Email must not exceed 320 characters.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password.trim()) {
    errors.password = 'Password is required.';
  }

  return errors;
}

function getSubmissionMessage(error: unknown) {
  if (error instanceof HttpError && error.status === 401) {
    return 'Email or password is incorrect.';
  }

  if (error instanceof NetworkError) {
    return 'Unable to reach CodeProgress. Check your connection and try again.';
  }

  if (error instanceof ResponseFormatError) {
    return 'CodeProgress returned an unexpected response. Please try again.';
  }

  if (error instanceof HttpError) {
    return error.apiError?.message ?? 'Sign in failed. Please try again.';
  }

  return 'Sign in failed. Please try again.';
}

function getServerFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof HttpError) || !error.apiError) {
    return {};
  }

  return error.apiError.fieldErrors.reduce<FieldErrors>((errors, fieldError) => {
    if (fieldError.field === 'email' || fieldError.field === 'password') {
      errors[fieldError.field] = fieldError.message;
    }
    return errors;
  }, {});
}

export function LoginForm({ initialEmail = '', successMessage }: LoginFormProps) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const validationErrors = validate(email, password);
    setFieldErrors(validationErrors);
    setSubmissionError(null);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn({ email: email.trim(), password });
      await navigate('/app', { replace: true });
    } catch (error) {
      if (!(error instanceof RequestAbortedError)) {
        const serverFieldErrors = getServerFieldErrors(error);
        setFieldErrors(serverFieldErrors);
        setSubmissionError(
          Object.keys(serverFieldErrors).length > 0 ? null : getSubmissionMessage(error),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
      {successMessage ? (
        <div className={styles.success} role="status">
          {successMessage}
        </div>
      ) : null}
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          maxLength={320}
          value={email}
          aria-invalid={fieldErrors.email ? 'true' : undefined}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          onChange={(event) => {
            setEmail(event.target.value);
            setFieldErrors((current) => ({ ...current, email: undefined }));
          }}
          disabled={isSubmitting}
        />
        {fieldErrors.email ? (
          <p id="email-error" className={styles.fieldError}>
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label htmlFor="password">Password</label>
          <span>8–72 characters for registered accounts</span>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          aria-invalid={fieldErrors.password ? 'true' : undefined}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          onChange={(event) => {
            setPassword(event.target.value);
            setFieldErrors((current) => ({ ...current, password: undefined }));
          }}
          disabled={isSubmitting}
        />
        {fieldErrors.password ? (
          <p id="password-error" className={styles.fieldError}>
            {fieldErrors.password}
          </p>
        ) : null}
      </div>

      {submissionError ? (
        <div className={styles.alert} role="alert">
          {submissionError}
        </div>
      ) : null}

      <button className={styles.submit} type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
