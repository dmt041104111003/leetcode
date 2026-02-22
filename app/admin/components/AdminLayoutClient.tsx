'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from '../styles/Layout.module.css';
import { ADMIN_NAV_ITEMS } from '../constants/admin';

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await fetch('/api/auth/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  const closeDrawer = () => setMenuOpen(false);

  return (
    <div className={styles.layoutContainer}>
      <div className={styles.mobileHeader}>
        <h2 className={styles.sidebarTitle}>Admin</h2>
        <button
          type="button"
          className={styles.menuToggle}
          onClick={() => setMenuOpen(true)}
          aria-label="Mở menu"
        >
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
        </button>
      </div>
      {menuOpen && (
        <div
          className={styles.sidebarBackdrop}
          onClick={closeDrawer}
          aria-hidden
        />
      )}
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>Admin</h2>
          <button
            type="button"
            className={styles.menuClose}
            onClick={closeDrawer}
            aria-label="Đóng menu"
          >
            ×
          </button>
        </div>
        <div className={styles.navBody}>
          <ul className={styles.navList}>
            {ADMIN_NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`}
                  onClick={closeDrawer}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className={styles.mainContent}>{children}</main>
    </div>
  );
}
