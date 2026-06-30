import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileHeader, MobileBottomNav, MobileMoreMenu } from './MobileNav';
import { QuickCapture } from '../capture/QuickCapture';
import { CommandCenter } from '../commandCenter/CommandCenter';
import { Toaster } from '../ui/Toaster';
import { useMobile } from '../../hooks/useMobile';
import styles from './AppShell.module.css';

export function AppShell() {
  const isMobile = useMobile();
  const [moreOpen, setMoreOpen] = useState(false);

  if (isMobile) {
    return (
      <div className={styles.shellMobile}>
        <MobileHeader />
        <div className={styles.mainMobile}>
          <Outlet />
        </div>
        <MobileBottomNav onMoreOpen={() => setMoreOpen(true)} />
        <MobileMoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
        <QuickCapture hideTrigger />
        <CommandCenter />
        <Toaster />
      </div>
    );
  }

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
      <Toaster />
    </div>
  );
}
