import { Link, useLocation } from 'react-router-dom';
import { LoginForm } from '../../features/auth/ui/LoginForm';
import styles from './LoginPage.module.css';
import { useI18n } from '../../shared/i18n/useI18n';

type RegistrationState = {
  registeredEmail: string;
};

function getProtectedRedirect(value: unknown) {
  if (
    typeof value === 'object' &&
    value !== null &&
    'from' in value &&
    typeof value.from === 'string' &&
    value.from.startsWith('/app/')
  ) {
    return value.from;
  }
  return '/app/dashboard';
}

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
  const { t } = useI18n();
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
          <p className={styles.eyebrow}>{t('auth.continueLearning')}</p>
          <h1 id="login-title">{t('auth.welcomeBack')}</h1>
          <p className={styles.lead}>{t('auth.loginLead')}</p>
        </div>
        <p className={styles.securityNote}>{t('auth.sessionNote')}</p>
      </section>

      <section className={styles.card} aria-labelledby="form-title">
        <div className={styles.cardHeading}>
          <p>{t('auth.secureAccess')}</p>
          <h2 id="form-title">{t('auth.signInTitle')}</h2>
        </div>
        <LoginForm
          initialEmail={registrationState?.registeredEmail}
          successMessage={registrationState ? t('auth.registerSuccess') : undefined}
          redirectTo={getProtectedRedirect(location.state)}
        />
        <p className={styles.secondaryAction}>
          {t('auth.newUser')} <Link to="/register">{t('auth.createAccountLink')}</Link>
        </p>
      </section>
    </main>
  );
}
