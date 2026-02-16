import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, ArrowRight, Eye, Users, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const otp = form.get("otp") as string;

    const { error } = await signIn(email, password);
    if (error) {
      setLoading(false);
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      return;
    }

    // Verify OTP
    const { data: otpValid, error: otpErr } = await supabase.rpc("verify_and_rotate_otp", {
      _user_id: (await supabase.auth.getUser()).data.user!.id,
      _otp: otp,
    });

    if (otpErr || !otpValid) {
      await supabase.auth.signOut();
      setLoading(false);
      toast({ title: "Invalid OTP", description: "Please contact your admin for a valid code.", variant: "destructive" });
      return;
    }

    setLoading(false);
    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: "var(--gradient-primary)" }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <MapPin className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight">TechMap</span>
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight mb-4">
            Technician Coverage<br />Intelligence Platform
          </h1>
          <p className="text-lg text-white/70 mb-12 max-w-md">
            Visualize, manage, and optimize your technician network across the entire United States.
          </p>
          <div className="space-y-5">
            {[
              { icon: Eye, label: "Real-time coverage visualization" },
              { icon: Users, label: "Manage thousands of technicians" },
              { icon: Zap, label: "Instant search & nearest tech finder" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-white/80">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-btn">
              <MapPin className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">TechMap</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@company.com" className="h-11 rounded-xl bg-muted/30 border-border/50 focus:bg-background transition-colors" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <Input id="password" name="password" type="password" required placeholder="••••••••" className="h-11 rounded-xl bg-muted/30 border-border/50 focus:bg-background transition-colors" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-sm font-semibold">Authenticator Code</Label>
              <Input id="otp" name="otp" type="text" required maxLength={6} placeholder="6-digit code" className="h-11 rounded-xl bg-muted/30 border-border/50 focus:bg-background transition-colors tracking-widest text-center font-mono" />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl gradient-btn text-sm" disabled={loading}>
              {loading ? "Signing in..." : (
                <span className="flex items-center gap-2">Sign In <ArrowRight className="h-4 w-4" /></span>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Contact your administrator for login credentials and OTP code
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
