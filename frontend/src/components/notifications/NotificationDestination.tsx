import { ExternalLink } from 'lucide-react';

interface NotificationDestinationProps {
  routeUrl?: string;
  compact?: boolean;
}

export default function NotificationDestination({ routeUrl, compact = false }: NotificationDestinationProps) {
  const destination = routeUrl?.trim();

  if (!destination) return null;

  return (
    <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-[#1A73E8]" title={destination}>
      <ExternalLink size={10} />
      <span className={compact ? 'truncate max-w-[180px]' : 'truncate max-w-[280px]'}>Mở ngay</span>
    </span>
  );
}
