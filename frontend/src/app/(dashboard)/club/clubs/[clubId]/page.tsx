import { redirect } from 'next/navigation';

export default function Page({ params }: { params: { clubId: string } }) {
  redirect(`/activities/${params.clubId}`);
}
