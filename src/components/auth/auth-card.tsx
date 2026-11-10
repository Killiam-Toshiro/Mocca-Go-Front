import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';

/** Marco común de `/login` y `/registro`. */
export function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <Link
        href="/"
        className="text-center text-2xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Mocca Go
      </Link>
      <Card>
        <CardHeader>
          <h1 className="text-xl leading-none font-semibold tracking-tight">
            {title}
          </h1>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {children}
          <p className="text-center text-sm text-muted-foreground">{footer}</p>
        </CardContent>
      </Card>
    </main>
  );
}
