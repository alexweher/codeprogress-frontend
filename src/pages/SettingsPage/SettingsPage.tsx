import { useState } from 'react';
import { useI18n } from '../../shared/i18n/useI18n';
import type { Locale } from '../../shared/i18n/messages';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const { locale, setLocale, t } = useI18n();
  const [saved, setSaved] = useState(false);

  function selectLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    setSaved(true);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{t('settings.eyebrow')}</p>
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.description')}</p>
      </header>
      <section className={styles.card} aria-labelledby="language-title">
        <h2 id="language-title">{t('settings.language')}</h2>
        <p>{t('settings.languageHelp')}</p>
        <fieldset>
          <legend>{t('settings.language')}</legend>
          <label>
            <input
              type="radio"
              name="language"
              value="ru"
              checked={locale === 'ru'}
              onChange={() => selectLocale('ru')}
            />
            <span>{t('settings.russian')}</span>
          </label>
          <label>
            <input
              type="radio"
              name="language"
              value="en"
              checked={locale === 'en'}
              onChange={() => selectLocale('en')}
            />
            <span>{t('settings.english')}</span>
          </label>
        </fieldset>
        {saved ? (
          <p className={styles.saved} role="status">
            {t('settings.saved')}
          </p>
        ) : null}
      </section>
    </main>
  );
}
