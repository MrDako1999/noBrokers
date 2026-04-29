import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import PasswordInput from '@/components/PasswordInput';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';

export default function ProfilePage() {
  const { user, updateProfile } = useAuthStore();
  const { toast } = useToast();
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile(profile);
      toast({ title: 'Profile saved' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not save profile',
        description: err.response?.data?.error || 'Please try again.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setSavingPw(true);
    try {
      await api.put('/auth/password', pw);
      toast({ title: 'Password changed' });
      setPw({ currentPassword: '', newPassword: '' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not change password',
        description: err.response?.data?.error || 'Please try again.',
      });
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account details and password.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal info</CardTitle>
          <CardDescription>Visible to people you make offers to.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email || ''} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="curpw">Current password</Label>
              <PasswordInput
                id="curpw"
                autoComplete="current-password"
                value={pw.currentPassword}
                onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newpw">New password</Label>
              <PasswordInput
                id="newpw"
                autoComplete="new-password"
                value={pw.newPassword}
                onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={savingPw || !pw.currentPassword || !pw.newPassword}>
              {savingPw && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
