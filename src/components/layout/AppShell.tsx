import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { QuickCapture } from '../capture/QuickCapture';
import { CommandCenter } from '../commandCenter/CommandCenter';
import styles from './AppShell.module.css';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <div className={styles.topbar}>
          <QuickCapture />
        </div>
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
      <CommandCenter />
    </div>
  );
}
