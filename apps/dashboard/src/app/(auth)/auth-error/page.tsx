import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

interface AuthErrorPageProps {
  searchParams: Promise<{ error?: string }>;
}

const errorKeyMap: Record<string, string> = {
  Configuration: 'configuration',
  AccessDenied: 'accessDenied',
  Verification: 'verification',
  Default: 'default',
  CredentialsSignin: 'credentialsSignin',
  OAuthSignin: 'oauthSignin',
  OAuthCallback: 'oauthCallback',
  OAuthAccountNotLinked: 'oauthAccountNotLinked',
};

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { error } = await searchParams;
  const t = await getTranslations('authError');

  const messageKey = error ? errorKeyMap[error] || 'default' : 'default';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errorMessage = t(messageKey as never);

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-destructive">{t('title')}</CardTitle>
        <CardDescription>{errorMessage}</CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground">
        {error && (
          <p className="rounded-md bg-muted p-3 font-mono text-xs">{t('errorCode', { code: error })}</p>
        )}
      </CardContent>
      <CardFooter className="justify-center">
        <Button asChild>
          <Link href="/login">{t('backToSignIn')}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
