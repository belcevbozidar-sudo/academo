import { useEffect } from "react";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useParams, useNavigate } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export default function Profile() {
  const { userId, lng } = useParams<{ userId: string; lng: string }>();
  const navigate = useNavigate();
  
  // Fetch current user
  const currentUser = useQuery(api.users.getCurrentUser);
  
  // Determine which user ID to use
  const targetUserId = userId || currentUser?._id;
  
  // Redirect to admin profile page
  useEffect(() => {
    if (targetUserId && lng) {
      navigate(`/${lng}/admin/user/${targetUserId}/admin-profile`, { replace: true });
    }
  }, [targetUserId, lng, navigate]);

  // Show loading while redirecting
  return (
    <Layout>
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    </Layout>
  );
}
