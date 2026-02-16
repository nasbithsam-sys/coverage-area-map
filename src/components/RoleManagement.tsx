import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Eye, EyeOff, RefreshCw, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  user_id: string;
  role: AppRole;
  profile: { full_name: string | null; email: string | null; otp_code?: string | null; totp_secret?: string | null } | null;
}

interface RoleManagementProps {
  users: UserWithRole[];
  onRefresh: () => void;
}

export default function RoleManagement({ users, onRefresh }: RoleManagementProps) {
  const { toast } = useToast();
  const { user, session } = useAuth();
  const [visibleOtps, setVisibleOtps] = useState<Set<string>>(new Set());
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("csr");
  const [creating, setCreating] = useState(false);
  const [totpDialog, setTotpDialog] = useState<{ open: boolean; uri: string; secret: string } | null>(null);

  const changeRole = async (userId: string, newRole: AppRole) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role updated" });
      onRefresh();
    }
  };

  const createUser = async () => {
    if (!newEmail || !newPassword || !newFullName) {
      toast({ title: "All fields required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: newEmail,
            password: newPassword,
            fullName: newFullName,
            role: newRole,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // If admin role, auto-generate TOTP
      if (newRole === "admin") {
        await setupTotp(data.user_id);
      }

      toast({
        title: "User created",
        description: newRole === "admin"
          ? `${newEmail} added as admin. Set up Google Authenticator.`
          : `${newEmail} added as ${newRole}. OTP: ${data.otp_code}`,
      });
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const setupTotp = async (userId: string) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-totp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ user_id: userId, action: "generate" }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTotpDialog({ open: true, uri: data.uri, secret: data.secret });
    } catch (e: any) {
      toast({ title: "Error generating TOTP", description: e.message, variant: "destructive" });
    }
  };

  const regenerateOtp = async (userId: string) => {
    const newOtp = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    const { error } = await supabase
      .from("profiles")
      .update({ otp_code: newOtp })
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "OTP regenerated", description: `New code: ${newOtp}` });
      onRefresh();
    }
  };

  const toggleOtpVisibility = (userId: string) => {
    setVisibleOtps(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Create User</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input placeholder="John Doe" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input placeholder="user@company.com" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input placeholder="Set password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="csr">CSR</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="mt-4" onClick={createUser} disabled={creating}>
            {creating ? "Creating..." : "Create User"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Users & Roles</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Auth Code</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>{u.profile?.full_name || "—"}</TableCell>
                  <TableCell>{u.profile?.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.role === "admin" ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {u.profile?.totp_secret ? "TOTP Active" : "TOTP Not Set"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setupTotp(u.user_id)}
                          title={u.profile?.totp_secret ? "Regenerate TOTP" : "Set up TOTP"}
                        >
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {visibleOtps.has(u.user_id)
                            ? (u.profile?.otp_code || "—")
                            : "••••••"}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => toggleOtpVisibility(u.user_id)}
                        >
                          {visibleOtps.has(u.user_id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        {visibleOtps.has(u.user_id) && u.profile?.otp_code && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyToClipboard(u.profile!.otp_code!)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => regenerateOtp(u.user_id)}
                          title="Regenerate OTP"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.user_id !== user?.id ? (
                      <Select value={u.role} onValueChange={(v) => changeRole(u.user_id, v as AppRole)}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="csr">CSR</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground">You</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* TOTP Setup Dialog */}
      <Dialog open={totpDialog?.open || false} onOpenChange={(open) => !open && setTotpDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Google Authenticator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan the QR code below with Google Authenticator or any TOTP app.
            </p>
            {totpDialog?.uri && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG value={totpDialog.uri} size={200} />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Manual entry secret</Label>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-muted px-3 py-2 rounded flex-1 break-all">
                  {totpDialog?.secret}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => totpDialog?.secret && copyToClipboard(totpDialog.secret)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={() => setTotpDialog(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
