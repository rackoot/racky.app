import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { getAuthHeaders } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace/workspace-context";

interface RequireSubscriptionProps {
  children: React.ReactNode;
  fallback?: string;
}
export function RequireSubscription({
  children,
  fallback = "/pricing",
}: RequireSubscriptionProps) {
  const [loading, setLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  const user = getCurrentUser();
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();

  useEffect(() => {
    console.log("RequireSubscription useEffect:", {
      workspaceLoading,
      currentWorkspace: currentWorkspace?._id,
      hasWorkspace: !!currentWorkspace,
    });

    // Only check subscription if workspace context is not loading
    if (!workspaceLoading) {
      checkSubscription();
    } else {
      // Reset loading state when workspace is loading
      setLoading(true);
    }
  }, [currentWorkspace, workspaceLoading]);

  const checkSubscription = async () => {
    console.log("checkSubscription called:", {
      user: user?.email,
      role: user?.role,
      currentWorkspace: currentWorkspace?._id,
      subscription: currentWorkspace?.subscription,
    });

    if (!user) {
      setLoading(false);
      return;
    }

    // SUPERADMIN users don't need subscriptions
    if (user.role === "SUPERADMIN") {
      setHasSubscription(true);
      setLoading(false);
      return;
    }

    // If no current workspace is selected after loading is complete, no subscription
    if (!currentWorkspace) {
      console.log("No current workspace, setting hasSubscription to false");
      setHasSubscription(false);
      setLoading(false);
      return;
    }

    try {
      // Check workspace subscription first (primary)
      if (currentWorkspace.subscription) {
        const { status } = currentWorkspace.subscription;
        console.log("Workspace subscription status:", status);
        setHasSubscription(status === "ACTIVE");
        setLoading(false);
        return;
      }

      // Fallback: Fetch fresh subscription data from API
      console.log("Fetching subscription data from API");
      const response = await fetch("/api/plans/user/current", {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("API subscription response:", data);
        if (data.success && data.data.userSubscription) {
          setHasSubscription(
            data.data.userSubscription.hasActiveSubscription || false
          );
        } else {
          setHasSubscription(false);
        }
      } else {
        console.log("API subscription response failed:", response.status);
        setHasSubscription(false);
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
      setHasSubscription(false);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // SUPERADMIN users don't need subscriptions - redirect them to admin panel
  if (user.role === "SUPERADMIN") {
    return <Navigate to="/admin" replace />;
  }

  // Show loading while workspace context is loading or while checking subscription
  if (workspaceLoading || loading) {
    console.log("Still loading:", { workspaceLoading, loading });
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check if user has an active subscription
  if (!hasSubscription) {
    console.log("No subscription, redirecting to:", fallback);
    return <Navigate to={fallback} replace />;
  }

  console.log("Has subscription, rendering children");

  return <>{children}</>;
}
