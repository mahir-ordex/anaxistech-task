import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Alert } from '../../components/ui';
import { ShieldAlert } from 'lucide-react';

export function VerifySessionPage() {
  const navigate = useNavigate();
  const currentSession = useAuthStore((state) => state.currentSession);
  const setRequiresVerification = useAuthStore((state) => state.setRequiresVerification);
  
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!token.trim()) {
      setError('Please enter the verification token');
      return;
    }
    
    if (!currentSession?.id) {
      setError('No session found. Please login again.');
      return;
    }
    
    setIsLoading(true);
    try {
      await authApi.verifySession(currentSession.id, token);
      setRequiresVerification(false);
      navigate('/dashboard');
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError(axiosError.response?.data?.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--muted))] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-yellow-500 text-white">
              <ShieldAlert className="h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-2xl">Verify Your Session</CardTitle>
          <CardDescription>
            We detected a login from a new location. Please verify it's you.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {currentSession?.suspiciousReason && (
              <Alert variant="warning">
                {currentSession.suspiciousReason}
              </Alert>
            )}
            
            {error && <Alert variant="destructive">{error}</Alert>}

            {currentSession?.verificationToken && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-sm text-blue-600 mb-2">Your verification token:</p>
                <p className="text-2xl font-mono font-bold text-blue-800 tracking-wider">
                  {currentSession.verificationToken}
                </p>
              </div>
            )}

            <Input
              type="text"
              label="Verification Token"
              placeholder="Enter verification token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
            >
              Verify Session
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                useAuthStore.getState().logout();
                navigate('/login');
              }}
            >
              Cancel & Logout
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
