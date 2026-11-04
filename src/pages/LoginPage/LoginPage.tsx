import { Link, useLocation } from 'react-router-dom';
import { LoginForm } from '../../features/auth/ui/LoginForm';
import styles from './LoginPage.module.css';

type RegistrationState = {
  registeredEmail: string;
};

function getRegistrationState(value: unknown): RegistrationState | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'registeredEmail' in value &&
    typeof value.registeredEmail === 'string'
  ) {
    return { registeredEmail: value.registeredEmail };
  }

  return null;
}

export function LoginPage() {
  const location = useLocation();
  const registrationState = getRegistrationState(location.state);

  return (
    <main className={styles.page}>
      <section className={styles.intro} aria-labelledby="login-title">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            CP
          </span>
          <span>CodeProgress</span>
        </div>
        <div>
          <p className={styles.eyebrow}>Continue learning</p>
          <h1 id="login-title">Welcome back.</h1>
          <p className={styles.lead}>
            Sign in to return to your programming topics, study sessions, and progress.
          </p>
        </div>
        <p className={styles.securityNote}>
          Your session stays in this browser tab and is cleared when the page reloads.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="form-title">
        <div className={styles.cardHeading}>
          <p>Secure access</p>
          <h2 id="form-title">Sign in to CodeProgress</h2>
        </div>
        <LoginForm
          initialEmail={registrationState?.registeredEmail}
          successMessage={
            registrationState ? 'Account created. Sign in with your new credentials.' : undefined
          }
        />
        <p className={styles.secondaryAction}>
          New to CodeProgress? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
