import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import LoadingScreen from '@/components/LoadingScreen';
import type { UserRole } from '@/types/auth';

const ROLE_ROUTES: Record<UserRole, string> = {
  PUBLIC: '/public',
  ADMIN: '/admin',
  DATA_ENCODER: '/encoder',
  ENFORCER: '/enforcer',
  DRIVER: '/driver',
};

export default function IndexScreen() {
  const { status, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || !user) {
      router.replace('/login');
      return;
    }
    const route = ROLE_ROUTES[user.userType] ?? '/login';
    router.replace(route as never);
  }, [status, user, router]);

  return <LoadingScreen message="Starting Basey FareCheck..." />;
}
