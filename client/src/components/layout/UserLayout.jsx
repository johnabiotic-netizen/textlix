import { Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Navbar from './Navbar';
import { useSocket } from '../../hooks/useSocket';
import { playNotificationSound } from '../../hooks/useNotificationSound';

function GlobalSmsNotifier() {
  const queryClient = useQueryClient();
  useSocket(
    (data) => {
      playNotificationSound();
      queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
      const code = data.smsCode;
      toast.success(
        code ? (
          <span>
            SMS received! Code:{' '}
            <strong style={{ fontFamily: 'monospace', letterSpacing: '0.1em', fontSize: '1.05em' }}>{code}</strong>
          </span>
        ) : 'New SMS received on your number!',
        { duration: 8000, id: `sms-${data.orderId}` }
      );
    },
    () => {}
  );
  return null;
}

export default function UserLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalSmsNotifier />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">© {new Date().getFullYear()} TextLix. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-700">Terms</a>
            <a href="#" className="hover:text-gray-700">Privacy</a>
            <a href="#" className="hover:text-gray-700">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
