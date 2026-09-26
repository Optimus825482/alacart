import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminSidebar } from './admin-sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('alacarte_session');
  
  if (!sessionCookie?.value) {
    redirect('/login');
  }
  
  try {
    const session = JSON.parse(sessionCookie.value);
    if (session.role !== 'ADMIN') {
      redirect('/login');
    }
  } catch {
    redirect('/login');
  }
  
  return (
    <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full p-4 sm:p-6 gap-6">
      <AdminSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
