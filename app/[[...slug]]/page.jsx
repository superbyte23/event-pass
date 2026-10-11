'use client';

import dynamic from 'next/dynamic';

// The app owns its own router (BrowserRouter) and touches browser APIs at
// module scope, so it must never be server-rendered.
const App = dynamic(() => import('@/App.jsx'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  ),
});

export default function Page() {
  return <App />;
}
