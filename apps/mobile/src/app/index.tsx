import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { Loading } from '@/components/ui/loading';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Loading message="Loading..." />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/auth/login" />;
}
