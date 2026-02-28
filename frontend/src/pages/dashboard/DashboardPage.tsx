import { useState, useEffect, useCallback } from 'react';
import { sessionApi, authApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Button, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  Badge,
  Alert 
} from '../../components/ui';
import { 
  Monitor, 
  Smartphone, 
  Globe, 
  Clock, 
  MapPin, 
  LogOut, 
  Shield,
  AlertTriangle,
  Trash2,
  Settings,
  FlaskConical
} from 'lucide-react';
import { formatRelativeTime } from '../../lib/utils';

interface SessionData {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  ipAddress: string;
  country: string;
  city: string;
  isSuspicious: boolean;
  suspiciousReason?: string;
  isVerified: boolean;
  lastUsedAt: string;
  createdAt: string;
  isCurrent?: boolean;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, currentSession, logout: authLogout } = useAuthStore();
  
  // Sessions state
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  
  // Action loading states
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [isDeletingOther, setIsDeletingOther] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  
  // Token theft test states
  const [isTestingTokenTheft, setIsTestingTokenTheft] = useState(false);
  const [tokenTheftResult, setTokenTheftResult] = useState<{ success: boolean; message: string } | null>(null);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [showSecurityTest, setShowSecurityTest] = useState(false);
  
  // Suspicious login test states
  const [suspiciousTestResult, setSuspiciousTestResult] = useState<{ success: boolean; message: string; data?: unknown } | null>(null);
  const [isTestingSuspicious, setIsTestingSuspicious] = useState(false);
  const [testCountry, setTestCountry] = useState('RU');

  const fetchSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    setSessionsError(null);
    try {
      const response = await sessionApi.getSessions();
      setSessions(response.data.data.sessions as SessionData[]);
    } catch {
      setSessionsError('Failed to load sessions');
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Redirect to login if no sessions after loading completes
  // or if current session is no longer in the sessions list
  useEffect(() => {
    if (!isLoadingSessions) {
      if (sessions.length === 0) {
        authLogout();
        navigate('/login');
        return;
      }
      
      // Check if current session ID is still in the sessions list
      if (currentSession?.id) {
        const currentSessionExists = sessions.some(s => s.id === currentSession.id);
        if (!currentSessionExists) {
          authLogout();
          navigate('/login');
        }
      }
    }
  }, [sessions, isLoadingSessions, currentSession, authLogout, navigate]);

  

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authApi.logout();
      authLogout();
      navigate('/login');
    } catch {
      // Still logout locally even if API fails
      authLogout();
      navigate('/login');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setDeletingSessionId(sessionId);
    try {
      await sessionApi.deleteSession(sessionId);
      await fetchSessions();
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleDeleteOtherSessions = async () => {
    setIsDeletingOther(true);
    try {
      await sessionApi.deleteOtherSessions();
      await fetchSessions();
    } finally {
      setIsDeletingOther(false);
    }
  };

  const handleDeleteAllSessions = async () => {
    setIsDeletingAll(true);
    try {
      await sessionApi.deleteAllSessions();
      authLogout();
      navigate('/login');
    } catch {
      setIsDeletingAll(false);
    }
  };

  const getDeviceIcon = (deviceName: string) => {
    if (deviceName.toLowerCase().includes('mobile') || 
        deviceName.toLowerCase().includes('phone') ||
        deviceName.toLowerCase().includes('android') ||
        deviceName.toLowerCase().includes('iphone')) {
      return <Smartphone className="h-5 w-5" />;
    }
    return <Monitor className="h-5 w-5" />;
  };

  const otherSessions = sessions.filter(s => !s.isCurrent);

  return (
    <div className="min-h-screen bg-[hsl(var(--muted))]">
      {/* Header */}
      <header className="bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[hsl(var(--primary))] text-white">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Session Dashboard</h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Welcome, {user?.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user?.role === 'admin' && (
                <Link to="/admin">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
                isLoading={isLoggingOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Session Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-[hsl(var(--primary))]/10">
                  <Monitor className="h-6 w-6 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sessions.length}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Active Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-yellow-500/10">
                  <AlertTriangle className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {sessions.filter(s => s.isSuspicious).length}
                  </p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Suspicious Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <Globe className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {new Set(sessions.map(s => s.country)).size}
                  </p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Countries</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Session Actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button 
            variant="outline"
            onClick={handleDeleteOtherSessions}
            isLoading={isDeletingOther}
            disabled={otherSessions.length === 0}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout Other Devices ({otherSessions.length})
          </Button>
          
          <Button 
            variant="destructive"
            onClick={() => {
              if (confirm('This will log you out from all devices including this one. Continue?')) {
                handleDeleteAllSessions();
              }
            }}
            isLoading={isDeletingAll}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Logout All Devices
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => setShowSecurityTest(!showSecurityTest)}
            className="ml-auto"
          >
            <FlaskConical className="h-4 w-4 mr-2" />
            {showSecurityTest ? 'Hide' : 'Show'} Security Test
          </Button>
        </div>
        
        {/* Token Theft Test Section */}
        {showSecurityTest && (
          <>
          <Card className="mb-6 border-purple-500/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-purple-500" />
                <CardTitle>Token Rotation & Theft Detection Test</CardTitle>
              </div>
              <CardDescription>
                Test the rotating refresh token security. Simulates what happens if someone steals and reuses your token.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-[hsl(var(--muted))] p-4 rounded-lg text-sm space-y-2">
                <p><strong>How it works:</strong></p>
                <ol className="list-decimal list-inside space-y-1 text-[hsl(var(--muted-foreground))]">
                  <li>Click "Save Token" - stores your current refresh token</li>
                  <li>Click "Rotate Token" - gets a new token (old one becomes invalid)</li>
                  <li>Click "Simulate Theft" - tries to reuse the saved old token</li>
                  <li><strong>Result:</strong> Backend detects theft → ALL your sessions get invalidated!</li>
                </ol>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setIsTestingTokenTheft(true);
                    setTokenTheftResult(null);
                    try {
                      const response = await authApi.saveTokenForTest();
                      setTokenSaved(true);
                      setTokenTheftResult({ 
                        success: true, 
                        message: `Token saved! Preview: ${response.data.data.tokenPreview}` 
                      });
                    } catch (error) {
                      setTokenTheftResult({ success: false, message: `Failed: ${error}` });
                    } finally {
                      setIsTestingTokenTheft(false);
                    }
                  }}
                  disabled={isTestingTokenTheft}
                  isLoading={isTestingTokenTheft}
                >
                  1. Save Token
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setIsTestingTokenTheft(true);
                    try {
                      await authApi.refresh();
                      setTokenTheftResult({ 
                        success: true, 
                        message: 'Token rotated! The saved token is now INVALID. Click "Simulate Theft" to test.' 
                      });
                    } catch (error) {
                      setTokenTheftResult({ success: false, message: `Rotation failed: ${error}` });
                    } finally {
                      setIsTestingTokenTheft(false);
                    }
                  }}
                  disabled={isTestingTokenTheft || !tokenSaved}
                  isLoading={isTestingTokenTheft}
                >
                  2. Rotate Token
                </Button>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    setIsTestingTokenTheft(true);
                    try {
                      const response = await authApi.simulateTokenTheft();
                      const data = response.data.data;
                      if (data.theftDetected) {
                        setTokenTheftResult({ 
                          success: true, 
                          message: `✅ TOKEN THEFT DETECTED! ${data.message}` 
                        });
                      } else {
                        setTokenTheftResult({ 
                          success: true, 
                          message: `Token rejected: ${data.message}` 
                        });
                      }
                      setTokenSaved(false);
                    } catch (error: unknown) {
                      const err = error as { response?: { data?: { message?: string } } };
                      setTokenTheftResult({ 
                        success: false, 
                        message: err.response?.data?.message || `Error: ${error}` 
                      });
                    } finally {
                      setIsTestingTokenTheft(false);
                    }
                  }}
                  disabled={isTestingTokenTheft || !tokenSaved}
                  isLoading={isTestingTokenTheft}
                >
                  3. Simulate Theft
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTokenSaved(false);
                    setTokenTheftResult(null);
                  }}
                >
                  Clear
                </Button>
              </div>
              
              {tokenSaved && (
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded text-sm">
                  ✓ Token saved and ready for testing
                </div>
              )}
              
              {tokenTheftResult && (
                <Alert variant={tokenTheftResult.success ? 'default' : 'destructive'}>
                  {tokenTheftResult.message}
                </Alert>
              )}
            </CardContent>
          </Card>
          
          {/* Suspicious Login Test Section */}
          <Card className="mb-6 border-orange-500/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <CardTitle>Suspicious Login Detection Test</CardTitle>
              </div>
              <CardDescription>
                Test detection of logins from new countries/IPs. VPN won't work locally because requests come from localhost.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-[hsl(var(--muted))] p-4 rounded-lg text-sm space-y-2">
                <p><strong>Why VPN doesn't work locally:</strong></p>
                <p className="text-[hsl(var(--muted-foreground))]">
                  When testing on localhost, your requests always come from 127.0.0.1 regardless of VPN.
                  Use these buttons to simulate different locations.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setIsTestingSuspicious(true);
                    setSuspiciousTestResult(null);
                    try {
                      const response = await authApi.getDeviceInfo();
                      setSuspiciousTestResult({ 
                        success: true, 
                        message: `Detected: ${response.data.data.detected.country} (${response.data.data.detected.ipAddress})`,
                        data: response.data.data
                      });
                    } catch (error) {
                      setSuspiciousTestResult({ success: false, message: `Failed: ${error}` });
                    } finally {
                      setIsTestingSuspicious(false);
                    }
                  }}
                  disabled={isTestingSuspicious}
                  isLoading={isTestingSuspicious}
                >
                  View Detected Location
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setIsTestingSuspicious(true);
                    try {
                      const response = await authApi.addKnownLocation({ country: 'US', ipAddress: '8.8.8.0' });
                      setSuspiciousTestResult({ 
                        success: true, 
                        message: `Added US location. Known: ${response.data.data.knownCountries.join(', ')}`
                      });
                    } catch (error) {
                      setSuspiciousTestResult({ success: false, message: `Failed: ${error}` });
                    } finally {
                      setIsTestingSuspicious(false);
                    }
                  }}
                  disabled={isTestingSuspicious}
                  isLoading={isTestingSuspicious}
                >
                  1. Add Known Location (US)
                </Button>
                
                <select 
                  value={testCountry}
                  onChange={(e) => setTestCountry(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="RU">Russia (RU)</option>
                  <option value="CN">China (CN)</option>
                  <option value="IR">Iran (IR)</option>
                  <option value="KP">North Korea (KP)</option>
                  <option value="BR">Brazil (BR)</option>
                </select>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    setIsTestingSuspicious(true);
                    try {
                      const response = await authApi.simulateSuspiciousLogin({ country: testCountry });
                      const data = response.data.data;
                      setSuspiciousTestResult({ 
                        success: true, 
                        message: data.wouldBeSuspicious 
                          ? `⚠️ SUSPICIOUS! ${data.reason}` 
                          : `✓ Not suspicious. ${data.tip}`,
                        data
                      });
                    } catch (error) {
                      setSuspiciousTestResult({ success: false, message: `Failed: ${error}` });
                    } finally {
                      setIsTestingSuspicious(false);
                    }
                  }}
                  disabled={isTestingSuspicious}
                  isLoading={isTestingSuspicious}
                >
                  2. Simulate Login from {testCountry}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    setIsTestingSuspicious(true);
                    try {
                      await authApi.clearKnownLocations();
                      setSuspiciousTestResult({ 
                        success: true, 
                        message: 'Known locations cleared. Next real login will set your baseline location.'
                      });
                    } catch (error) {
                      setSuspiciousTestResult({ success: false, message: `Failed: ${error}` });
                    } finally {
                      setIsTestingSuspicious(false);
                    }
                  }}
                  disabled={isTestingSuspicious}
                  isLoading={isTestingSuspicious}
                >
                  Clear Known Locations
                </Button>
              </div>
              
              {suspiciousTestResult && (
                <Alert variant={suspiciousTestResult.success ? 'default' : 'destructive'}>
                  {suspiciousTestResult.message}
                </Alert>
              )}
            </CardContent>
          </Card>
          </>
        )}

        {/* Sessions List */}
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>
              Your account is currently signed in on these devices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSessions ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(var(--primary))]" />
              </div>
            ) : sessionsError ? (
              <Alert variant="destructive">
                Failed to load sessions. Please try again.
              </Alert>
            ) : sessions.length === 0 ? (
              <p className="text-center text-[hsl(var(--muted-foreground))] py-8">
                No active sessions found.
              </p>
            ) : (
              <div className="space-y-4">
                {sessions.map((session, index) => (
                  <div
                    key={session.id || `session-${index}`}
                    className={`p-4 rounded-lg border ${
                      session.isCurrent 
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5' 
                        : 'border-[hsl(var(--border))]'
                    } ${
                      session.isSuspicious 
                        ? 'border-yellow-500 bg-yellow-50' 
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div className={`p-2 rounded-lg ${
                          session.isCurrent 
                            ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' 
                            : 'bg-[hsl(var(--muted))]'
                        }`}>
                          {getDeviceIcon(session.deviceName)}
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{session.deviceName}</span>
                            {session.isCurrent && (
                              <Badge variant="success">Current</Badge>
                            )}
                            {session.isSuspicious && (
                              <Badge variant="warning">Suspicious</Badge>
                            )}
                            {!session.isVerified && (
                              <Badge variant="destructive">Unverified</Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                            <span className="flex items-center gap-1">
                              <Globe className="h-4 w-4" />
                              {session.browser} on {session.os}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {session.city}, {session.country}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Last active: {formatRelativeTime(session.lastUsedAt)}
                            </span>
                          </div>
                          
                          {session.suspiciousReason && (
                            <p className="text-sm text-yellow-600 mt-2">
                              ⚠️ {session.suspiciousReason}
                            </p>
                          )}
                          
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            IP: {session.ipAddress}
                          </p>
                        </div>
                      </div>
                      
                      {!session.isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSession(session.id)}
                          isLoading={deletingSessionId === session.id}
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
