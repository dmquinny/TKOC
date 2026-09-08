import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getSessionFromToken } from '@/lib/session';

// Reading the session cookie makes this layout render per request.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const session = await getSessionFromToken(store.get('auth_token')?.value);
  if (!session) redirect('/');
  if (!session.pID) redirect('/province/create');

  return (
    <div className="dashboard-layout">
      <Sidebar isAdmin={session.isAdmin} />
      <main id="main-content" className="dashboard-content">
        {children}
      </main>
    </div>
  );
}
