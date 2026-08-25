'use client';

import { useState } from 'react';
import PINLogin from '@/components/PINLogin';

export default function RootLayoutClient({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  return (
    <>
      <PINLogin onSuccess={() => setAuthenticated(true)} />
      {authenticated && children}
    </>
  );
}
