import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/model/useAuth';
import styles from './AppPage.module.css';

const navigationItems = [
  { label: 'Dashboard', to: '/app/dashboard', status: 'Live' },
  { label: 'Topics', to: '/app/topics', status: 'Live' },
  { label: 'Tasks', status: 'Soon' },
  { label: 'Sessions', status: 'Soon' },
] as const;

export function AppPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    await logout();
    await navigate('/login', { replace: true });
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            CP
          </span>
          <span>CodeProgress</span>
        </div>
        <div className={styles.account}>
          <span>{user?.email}</span>
          <button type="button" onClick={() => void handleLogout()} disabled={isLoggingOut}>
            {isLoggingOut ? 'Signing out…' : 'Logout'}
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <nav className={styles.navigation} aria-label="Primary navigation">
          <p>Workspace</p>
          <ul>
            {navigationItems.map((item) => (
              <li key={item.label}>
                {'to' in item ? (
                  <NavLink
                    to={item.to}
                    className={({ isActive }) => (isActive ? styles.active : undefined)}
                  >
                    <span>{item.label}</span>
                    <small>{item.status}</small>
                  </NavLink>
                ) : (
                  <div>
                    <span>{item.label}</span>
                    <small>{item.status}</small>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <Outlet />
      </div>
    </div>
  );
}
