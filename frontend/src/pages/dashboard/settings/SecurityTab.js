import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import PasswordInput from '@/components/PasswordInput';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';

export default function SecurityTab() {
  const { toast } = useToast();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
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
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>
          Use a strong, unique password. We never share your credentials.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
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
          <Button type="submit" disabled={saving || !pw.currentPassword || !pw.newPassword}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Change password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
