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
  name: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  accountTypes: z.array(z.string()).min(1, 'Pick at least one'),
});

const ACCOUNT_TYPES = [
  { value: 'buyer', label: 'I want to buy' },
  { value: 'tenant', label: 'I want to rent' },
  { value: 'owner', label: 'I want to sell my property' },
  { value: 'landlord', label: 'I want to rent out my property' },
];

export default function RegisterPage() {
  const [submitting, setSubmitting] = useState(false);
  const { register: signup } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', password: '', accountTypes: ['buyer'] },
  });

  const accountTypes = watch('accountTypes') || [];
  const toggleType = (val) => {
    const next = accountTypes.includes(val)
      ? accountTypes.filter((v) => v !== val)
      : [...accountTypes, val];
    setValue('accountTypes', next, { shouldValidate: true });
  };

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      await signup(values);
      navigate('/dashboard');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not create account',
        description: err.response?.data?.error || 'Try again in a moment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>Free forever for owners, buyers and tenants.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" autoComplete="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" type="tel" placeholder="+60 12-345 6789" autoComplete="tel" {...register('phone')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>What brings you here?</Label>
            <div className="grid grid-cols-2 gap-2">
              {ACCOUNT_TYPES.map((opt) => {
                const active = accountTypes.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => toggleType(opt.value)}
                    className={`rounded-xl border px-3 py-2 text-xs text-left transition-colors ${
                      active
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-inputBorderIdle hover:border-inputBorderFocus'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {errors.accountTypes && (
              <p className="text-sm text-destructive">{errors.accountTypes.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create account
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-xs text-center text-muted-foreground">
            By signing up you agree to our{' '}
            <Link to="/terms" className="underline">Terms</Link> and{' '}
            <Link to="/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
