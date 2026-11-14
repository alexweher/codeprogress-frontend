import { Link } from 'react-router-dom';
import { RegisterForm } from '../../features/auth/ui/RegisterForm';
import styles from './RegisterPage.module.css';
import { useI18n } from '../../shared/i18n/useI18n';

export function RegisterPage() {
  const { t } = useI18n();
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
          <p className={styles.eyebrow}>{t('auth.startWorkspace')}</p>
          <h1 id="register-title">{t('auth.makeProgressVisible')}</h1>
          <p className={styles.lead}>{t('auth.registerLead')}</p>
        </div>
        <p className={styles.securityNote}>{t('auth.registerNote')}</p>
      </section>

      <section className={styles.card} aria-labelledby="register-form-title">
        <div className={styles.cardHeading}>
          <p>{t('auth.createYourAccount')}</p>
          <h2 id="register-form-title">{t('auth.join')}</h2>
        </div>
        <RegisterForm />
        <p className={styles.secondaryAction}>
          {t('auth.existingUser')} <Link to="/login">{t('auth.signIn')}</Link>
        </p>
      </section>
    </main>
  );
}
