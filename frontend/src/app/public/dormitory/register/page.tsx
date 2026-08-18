'use client';

import { useRouter } from 'next/navigation';
import { PublicDormitoryRegistrationModal } from '@/components/dormitory/PublicDormitoryRegistrationModal';

export default function PublicDormitoryRegisterPage() {
  const router = useRouter();
  return <PublicDormitoryRegistrationModal onOpenChange={open => { if (!open) router.push('/'); }} />;
}
