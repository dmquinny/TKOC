import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LoginForm from '@/components/LoginForm';
import { getSessionFromToken } from '@/lib/session';

// Signed-in rulers skip the landing page and go straight to their realm.
export default async function Home() {
  const store = await cookies();
  const session = await getSessionFromToken(store.get('auth_token')?.value);
  if (session) redirect(session.pID ? '/dashboard' : '/province/create');
  return <LoginForm />;
}
