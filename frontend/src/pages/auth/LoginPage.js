import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordInput from '@/components/PasswordInput';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import useAuthStore from '@/stores/authStore';

const schema = z.object({
  email: z.string().email('Enter a valid email').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      await login(values);
      navigate('/dashboard');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Sign-in failed',
        description: err.response?.data?.error || 'Please check your email and password.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your noBrokers account.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            New to noBrokers?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
