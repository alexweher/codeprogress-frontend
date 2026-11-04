import { Link } from 'react-router-dom';
import { RegisterForm } from '../../features/auth/ui/RegisterForm';
import styles from './RegisterPage.module.css';

export function RegisterPage() {
  return (
    <main className={styles.page}>
      <section className={styles.intro} aria-labelledby="register-title">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            CP
          </span>
          <span>CodeProgress</span>
        </div>
        <div>
          <p className={styles.eyebrow}>Start your workspace</p>
          <h1 id="register-title">Make progress visible.</h1>
          <p className={styles.lead}>
            Create an account to organize programming topics and build a consistent learning rhythm.
          </p>
        </div>
        <p className={styles.securityNote}>
          Account creation does not sign you in. You’ll continue securely on the login page.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="register-form-title">
        <div className={styles.cardHeading}>
          <p>Create your account</p>
          <h2 id="register-form-title">Join CodeProgress</h2>
        </div>
        <RegisterForm />
        <p className={styles.secondaryAction}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
