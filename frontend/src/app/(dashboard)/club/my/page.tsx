import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/activities/my?activityType=club');
}
