import styles from './AppPage.module.css';
import { useI18n } from '../../shared/i18n/useI18n';

export function AppOverview() {
  const { t } = useI18n();
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>{t('overview.eyebrow')}</p>
      <h1>{t('overview.title')}</h1>
      <p>{t('overview.lead')}</p>
      <div className={styles.readyCard}>
        <span aria-hidden="true" />
        <div>
          <strong>{t('overview.ready')}</strong>
          <p>{t('overview.security')}</p>
        </div>
      </div>
    </main>
  );
}
