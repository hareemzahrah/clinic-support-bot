import { redirect } from 'next/navigation';

// Gaps is the screen worth landing on, so /admin goes straight there.
export default function AdminIndex() {
  redirect('/admin/gaps');
}
