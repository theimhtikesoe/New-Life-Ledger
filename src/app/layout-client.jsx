'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import PINLogin from '@/components/PINLogin';

export default function RootLayoutClient({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const pathname = usePathname();
  const isPublicAutoReportStatus = pathname === '/auto-report-status';

  if (isPublicAutoReportStatus) return children;

  return (
    <>
      <PINLogin onSuccess={() => setAuthenticated(true)} />
      {authenticated && children}
    </>
  );
}
