import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

const NAV = [
  { to: '/', label: 'Mission Control', end: true },
  { to: '/inbox', label: 'Inbox', end: false },
  { to: '/ideas', label: 'Ideas', end: false },
  { to: '/ventures', label: 'Ventures', end: false },
  { to: '/goals', label: 'Goals', end: false },
  { to: '/tasks', label: 'Tasks', end: false },
  { to: '/resources', label: 'Resources', end: false },
  { to: '/decisions', label: 'Decisions', end: false },
  { to: '/experiments', label: 'Experiments', end: false },
  { to: '/relationships', label: 'Relationships', end: false },
];

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandName}>MegaApp</span>
        <span className={styles.brandVer}>v1</span>
      </div>
      <nav className={styles.nav}>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.active : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
