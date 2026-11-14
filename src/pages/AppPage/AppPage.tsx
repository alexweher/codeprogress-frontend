import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/model/useAuth';
import { useI18n } from '../../shared/i18n/useI18n';
import styles from './AppPage.module.css';

type NavigationIcon = 'dashboard' | 'topics' | 'settings';

function NavIcon({ icon }: { icon: NavigationIcon }) {
  const paths: Record<NavigationIcon, ReactNode> = {
    dashboard: <path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" />,
    topics: (
      <path d="M5 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V5a1 1 0 0 1 1-1Zm2 13h9V7H7v10Zm0 0a1 1 0 0 0 0 2h10v-2H7Z" />
    ),
    settings: (
      <path d="M20.2 13.1c.1-.4.1-.7.1-1.1s0-.8-.1-1.1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.9-1.1L15.6 3h-4l-.4 2.9A8 8 0 0 0 9.3 7L6.9 6l-2 3.4 2 1.5c-.1.4-.1.7-.1 1.1s0 .8.1 1.1l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.9 1.1l.4 2.9h4l.4-2.9a8 8 0 0 0 1.9-1.1l2.4 1 2-3.4-2.1-1.5ZM13.6 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
    ),
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[icon]}
    </svg>
  );
}

export function AppPage() {
  const { user, logout } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigationItems = [
    { icon: 'dashboard', label: t('nav.dashboard'), to: '/app/dashboard' },
    { icon: 'topics', label: t('nav.topics'), to: '/app/topics' },
    { icon: 'settings', label: t('nav.settings'), to: '/app/settings' },
  ] as const;
  const pageLabel = location.pathname.includes('/settings')
    ? t('nav.settings')
    : location.pathname.includes('/topics') ||
        location.pathname.includes('/tasks') ||
        location.pathname.includes('/sessions')
      ? t('nav.topics')
      : t('nav.dashboard');

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await logout();
    await navigate('/login', { replace: true });
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            &lt;/&gt;
          </span>
          <span>CodeProgress</span>
        </div>
        <nav className={styles.navigation} aria-label={t('nav.primary')}>
          <p>{t('nav.workspace')}</p>
          <ul>
            {navigationItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => (isActive ? styles.active : undefined)}
                >
                  <span className={styles.navIcon}>
                    <NavIcon icon={item.icon} />
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.sideNote}>
          <span aria-hidden="true">✦</span>
          <p>{t('shell.motivation')}</p>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <span className={styles.mobileBrand}>CodeProgress</span>
            <strong>{pageLabel}</strong>
          </div>
          <div className={styles.topbarActions}>
            <div className={styles.languageSwitch} aria-label={t('settings.language')}>
              <button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>
                EN
              </button>
              <button type="button" aria-pressed={locale === 'ru'} onClick={() => setLocale('ru')}>
                RU
              </button>
            </div>
            <span className={styles.avatar} aria-hidden="true">
              {user?.email.slice(0, 1).toUpperCase()}
            </span>
            <span className={styles.accountEmail}>{user?.email}</span>
            <button
              className={styles.logout}
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? t('auth.loggingOut') : t('auth.logout')}
            </button>
          </div>
        </header>
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
