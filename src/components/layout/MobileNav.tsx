import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import styles from './MobileNav.module.css';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Mission Control',
  '/inbox': 'Inbox',
  '/attention': 'Attention',
  '/ideas': 'Ideas',
  '/ventures': 'Ventures',
  '/goals': 'Goals',
  '/tasks': 'Tasks',
  '/resources': 'Resources',
  '/decisions': 'Decisions',
  '/experiments': 'Experiments',
  '/relationships': 'Relationships',
};

function getPageTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (pathname.startsWith('/ventures/')) return 'Venture';
  if (pathname.startsWith('/goals/')) return 'Goal';
  return 'MegaApp';
}

function getBackRoute(pathname: string): string | null {
  if (pathname.startsWith('/ventures/') && pathname !== '/ventures') return '/ventures';
  if (pathname.startsWith('/goals/') && pathname !== '/goals') return '/goals';
  return null;
}

const MORE_NAV = [
  { to: '/ideas',         label: 'Ideas' },
  { to: '/ventures',     label: 'Ventures' },
  { to: '/goals',        label: 'Goals' },
  { to: '/tasks',        label: 'Tasks' },
  { to: '/resources',    label: 'Resources' },
  { to: '/decisions',    label: 'Decisions' },
  { to: '/experiments',  label: 'Experiments' },
  { to: '/relationships', label: 'Relationships' },
];

export function MobileHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = getPageTitle(pathname);
  const backRoute = getBackRoute(pathname);

  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        {backRoute ? (
          <button className={styles.backBtn} onClick={() => navigate(backRoute)}>←</button>
        ) : (
          <span className={styles.brand}>M</span>
        )}
        <span className={styles.headerTitle}>{title}</span>
      </div>
      <button
        className={styles.searchBtn}
        onClick={() => window.dispatchEvent(new CustomEvent('megaapp:open-command'))}
        aria-label="Search"
      >
        ⌕
      </button>
    </div>
  );
}

export function MobileMoreMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  if (!open) return null;
  return (
    <div className={styles.moreOverlay} onClick={onClose}>
      <div className={styles.moreSheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.moreHandle} />
        <p className={styles.moreTitle}>More</p>
        <nav className={styles.moreNav}>
          {MORE_NAV.map((r) => (
            <button
              key={r.to}
              className={styles.moreLink}
              onClick={() => { navigate(r.to); onClose(); }}
            >
              {r.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function MobileBottomNav({ onMoreOpen }: { onMoreOpen: () => void }) {
  return (
    <nav className={styles.bottomNav}>
      <NavLink
        to="/"
        end
        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
      >
        <span className={styles.navIcon}>⌂</span>
        <span className={styles.navLabel}>Mission</span>
      </NavLink>

      <NavLink
        to="/inbox"
        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
      >
        <span className={styles.navIcon}>↓</span>
        <span className={styles.navLabel}>Inbox</span>
      </NavLink>

      <button
        className={`${styles.navItem} ${styles.captureItem}`}
        onClick={() => window.dispatchEvent(new CustomEvent('megaapp:open-capture'))}
      >
        <span className={styles.captureIcon}>+</span>
        <span className={styles.navLabel}>Capture</span>
      </button>

      <NavLink
        to="/attention"
        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
      >
        <span className={styles.navIcon}>◉</span>
        <span className={styles.navLabel}>Attention</span>
      </NavLink>

      <button className={styles.navItem} onClick={onMoreOpen}>
        <span className={styles.navIcon}>≡</span>
        <span className={styles.navLabel}>More</span>
      </button>
    </nav>
  );
}
