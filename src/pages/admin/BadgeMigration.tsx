import { useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import { useState } from "react";

function MigrationPageInner() {
  // DEPRECATED: Тази страница вече не се използва
  // Вместо това използвайте /admin/delete-all-badges
  
  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Тази страница е остаряла</CardTitle>
            <CardDescription>
              Тази страница вече не се използва. Вместо това отидете на /admin/delete-all-badges за изтриване на всички забележки.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">
                ⚠️ Важно: Използвайте новата страница за изтриване на забележки.
              </p>
            </div>

            <Button
              onClick={() => window.location.href = '/bg/admin/delete-all-badges'}
              size="lg"
            >
              Отидете на новата страница
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function MigrationPage() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Необходима е автентикация</CardTitle>
                <CardDescription>
                  Моля влезте в системата за да продължите
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SignInButton />
              </CardContent>
            </Card>
          </div>
        </Layout>
      </Unauthenticated>
      <AuthLoading>
        <Layout>
          <div className="p-6 max-w-4xl mx-auto">
            <Skeleton className="h-64 w-full" />
          </div>
        </Layout>
      </AuthLoading>
      <Authenticated>
        <MigrationPageInner />
      </Authenticated>
    </>
  );
}
