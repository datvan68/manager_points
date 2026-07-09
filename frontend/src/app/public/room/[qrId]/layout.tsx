/**
 * Public room layout — no auth guards, no sidebar.
 * Inherits root <html>/<body> from app/layout.tsx.
 */
export default function PublicRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
