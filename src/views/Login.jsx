import { db } from "@/api/db";

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ticket } from "lucide-react";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate(returnTo, { replace: true });
  }, [isAuthenticated, returnTo, navigate]);

  const handleGoogle = async () => {
    setError(null);
    try {
      await db.auth.loginWithProvider("google", returnTo);
    } catch (err) {
      setError(err?.message || "Could not start Google sign-in. Please try again.");
    }
  };

  const handleAdmin = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await db.auth.loginWithCredentials(email.trim(), password, returnTo);
    } catch (err) {
      setError(err?.message || "Sign in failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AuthLayout
        maxWidth="max-w-3xl"
        icon={Ticket}
        title="Sign in to EventPass"
        subtitle="Use Google to register for events, or sign in as an admin to manage them."
      >
        <div className="grid gap-8 md:grid-cols-2 md:divide-x md:divide-border">
          <div className="flex flex-col justify-center space-y-4 md:pr-8">
            <Button type="button" onClick={handleGoogle} className="w-full" size="lg">
              <GoogleIcon className="w-5 h-5 mr-2" /> Continue with Google
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              By continuing you agree to receive your digital ticket linked to this account.
            </p>
          </div>

          <div className="md:pl-8">
            <form onSubmit={handleAdmin} className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Admin sign-in</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Sign in with your admin email and password to manage events.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="secondary" className="w-full" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in as admin"}
              </Button>
            </form>
          </div>
        </div>
      </AuthLayout>
    </div>
  );
}
