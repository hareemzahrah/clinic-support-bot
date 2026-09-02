import { ChatWidget } from '@/components/chat/ChatWidget';

/**
 * The widget on its own, for embedding in an iframe on a clinic's website.
 *
 * No page chrome and no launcher — the host page's script owns the bubble and the open/closed
 * state, so this route is only ever the panel itself, filling whatever box it is given.
 */
export const metadata = {
  title: 'Chat — Ashfield Dental Practice',
  robots: { index: false, follow: false },
};

export default function EmbedPage() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-white">
      <ChatWidget embedded />
    </div>
  );
}
