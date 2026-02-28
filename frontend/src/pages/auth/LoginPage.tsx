import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { MapPin } from 'lucide-react';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Alert } from '../../components/ui';
import { Shield } from 'lucide-react';

interface LoginForm {
  email: string;
  password: string;
}

interface ApiError {
  message: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const setRequiresVerification = useAuthStore((state) => state.setRequiresVerification);
  
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<LoginForm>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'pending' | 'granted' | 'denied' | 'unavailable'>('pending');

  // Request location permission on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationStatus('granted');
      },
      (error) => {
        console.log('Location permission denied or error:', error.message);
        setLocationStatus('denied');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setApiError(null);
    
    // Basic validation
    const newErrors: Partial<LoginForm> = {};
    if (!form.email) newErrors.email = 'Email is required';
    if (!form.password) newErrors.password = 'Password is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setIsLoading(true);
    try {
      const loginData = location 
        ? { ...form, latitude: location.latitude, longitude: location.longitude }
        : form;
      const response = await authApi.login(loginData);
      const { user, accessToken, session, requiresVerification } = response.data.data;
      login(user, accessToken, session, requiresVerification);
      
      if (requiresVerification) {
        setRequiresVerification(true);
        navigate('/verify-session');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      const axiosError = error as AxiosError<ApiError>;
      const message = axiosError.response?.data?.message || 'Login failed';
      setApiError(message);
      setErrors({ email: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--muted))] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
              <Shield className="h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
          
          {/* Location status indicator */}
          <div className="flex items-center justify-center gap-2 text-xs mt-2">
            <MapPin className={`h-3 w-3 ${
              locationStatus === 'granted' ? 'text-green-500' : 
              locationStatus === 'denied' ? 'text-yellow-500' : 
              locationStatus === 'unavailable' ? 'text-gray-400' : 'text-blue-500 animate-pulse'
            }`} />
            <span className="text-[hsl(var(--muted-foreground))]">
              {locationStatus === 'pending' && 'Requesting location...'}
              {locationStatus === 'granted' && 'Location enabled'}
              {locationStatus === 'denied' && 'Location disabled (IP-based)'}
              {locationStatus === 'unavailable' && 'Location unavailable'}
            </span>
          </div>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {apiError && (
              <Alert variant="destructive">
                {apiError}
              </Alert>
            )}
            
            <Input
              type="email"
              label="Email"
              placeholder="name@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={errors.email}
              autoComplete="email"
            />
            
            <Input
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={errors.password}
              autoComplete="current-password"
            />
          </CardContent>
          
          <CardFooter className="flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full" 
              isLoading={isLoading}
            >
              Sign In
            </Button>
            
            <p className="text-sm text-center text-[hsl(var(--muted-foreground))]">
              Don't have an account?{' '}
              <Link to="/register" className="text-[hsl(var(--primary))] hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
