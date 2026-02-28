import { useState, useEffect, useCallback } from 'react';
import { adminApi, authApi } from '../../lib/api';
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
  Alert,
  Input
} from '../../components/ui';
import { 
  Monitor, 
  Smartphone, 
  Users,
  Shield,
  ArrowLeft,
  Search,
  LogOut,
  Trash2,
  AlertTriangle,
  FlaskConical
} from 'lucide-react';
import { formatRelativeTime } from '../../lib/utils';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  sessionCount?: number;
  lastLogin: string;
}

interface SessionData {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
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
}

export function AdminPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // Sessions state
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // Users state
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Action loading states
  const [forceLogoutUserId, setForceLogoutUserId] = useState<string | null>(null);
  const [forceLogoutSessionId, setForceLogoutSessionId] = useState<string | null>(null);
  
  // Token theft test states
  const [isTestingTokenTheft, setIsTestingTokenTheft] = useState(false);
  const [tokenTheftResult, setTokenTheftResult] = useState<{ success: boolean; message: string } | null>(null);
  const [tokenSaved, setTokenSaved] = useState(false);

  const fetchSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    setSessionsError(null);
    try {
      const response = await adminApi.getAllSessions();
      setSessions(response.data.data.sessions as SessionData[]);
    } catch {
      setSessionsError('Failed to load sessions');
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const response = await adminApi.getAllUsers();
      setUsers(response.data.data.users as UserData[]);
    } catch {
      // Handle error silently
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchUsers();
  }, [fetchSessions, fetchUsers]);

  // Redirect if not admin
  if (user?.role !== 'admin') {
    navigate('/dashboard');
    return null;
  }

  const handleForceLogoutUser = async (userId: string) => {
    setForceLogoutUserId(userId);
    try {
      await adminApi.forceLogoutUser(userId);
      await Promise.all([fetchSessions(), fetchUsers()]);
    } finally {
      setForceLogoutUserId(null);
    }
  };

  const handleForceLogoutSession = async (sessionId: string) => {
    setForceLogoutSessionId(sessionId);
    try {
      await adminApi.forceLogoutSession(sessionId);
      await Promise.all([fetchSessions(), fetchUsers()]);
    } finally {
      setForceLogoutSessionId(null);
    }
  };

  const getDeviceIcon = (deviceName: string) => {
    if (deviceName.toLowerCase().includes('mobile') || 
        deviceName.toLowerCase().includes('phone')) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  // Filter sessions
  const filteredSessions = sessions.filter(session => {
    const matchesSearch = !searchTerm || 
      session.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.ipAddress.includes(searchTerm);
    
    const matchesUser = !selectedUser || session.user.id === selectedUser;
    
    return matchesSearch && matchesUser;
  });

  return (
    <div className="min-h-screen bg-[hsl(var(--muted))]">
      {/* Header */}
      <header className="bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="p-2 rounded-lg bg-[hsl(var(--primary))] text-white">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Admin Dashboard</h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Manage all user sessions
                </p>
              </div>
            </div>
            <Badge variant="destructive">Admin Mode</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-[hsl(var(--primary))]/10">
                  <Users className="h-6 w-6 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{users.length}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <Monitor className="h-6 w-6 text-green-500" />
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
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Suspicious</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-red-500/10">
                  <Shield className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {sessions.filter(s => !s.isVerified).length}
                  </p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Unverified</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Token Theft Test Section */}
        <Card className="mb-8 border-purple-500/50">
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

        {/* Users Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>Quick overview of all users and their sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(var(--primary))]" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))]">
                      <th className="text-left py-3 px-4 font-medium">User</th>
                      <th className="text-left py-3 px-4 font-medium">Role</th>
                      <th className="text-left py-3 px-4 font-medium">Sessions</th>
                      <th className="text-left py-3 px-4 font-medium">Last Login</th>
                      <th className="text-left py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-[hsl(var(--border))]">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{u.name}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{u.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={u.role === 'admin' ? 'destructive' : 'secondary'}>
                            {u.role}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">{u.sessionCount ?? '-'}</td>
                        <td className="py-3 px-4">
                          {u.lastLogin ? formatRelativeTime(u.lastLogin) : 'Never'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedUser(selectedUser === u.id ? null : u.id)}
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Force logout all sessions for ${u.name}?`)) {
                                  handleForceLogoutUser(u.id);
                                }
                              }}
                              disabled={!u.sessionCount || u.sessionCount === 0}
                              isLoading={forceLogoutUserId === u.id}
                            >
                              <Trash2 className="h-4 w-4 text-[hsl(var(--destructive))]" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sessions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Sessions</CardTitle>
                <CardDescription>
                  {selectedUser ? 'Filtered by selected user' : 'All active sessions across all users'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {selectedUser && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                    Clear Filter
                  </Button>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <Input
                    placeholder="Search by name, email, or IP"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingSessions ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(var(--primary))]" />
              </div>
            ) : sessionsError ? (
              <Alert variant="destructive">Failed to load sessions</Alert>
            ) : filteredSessions.length === 0 ? (
              <p className="text-center text-[hsl(var(--muted-foreground))] py-8">
                No sessions found.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-4 rounded-lg border ${
                      session.isSuspicious 
                        ? 'border-yellow-500 bg-yellow-50' 
                        : 'border-[hsl(var(--border))]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div className="p-2 rounded-lg bg-[hsl(var(--muted))]">
                          {getDeviceIcon(session.deviceName)}
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{session.user.name}</span>
                            <span className="text-sm text-[hsl(var(--muted-foreground))]">
                              ({session.user.email})
                            </span>
                            {session.isSuspicious && (
                              <Badge variant="warning">Suspicious</Badge>
                            )}
                            {!session.isVerified && (
                              <Badge variant="destructive">Unverified</Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                            <span>{session.deviceName}</span>
                            <span>•</span>
                            <span>{session.browser} on {session.os}</span>
                            <span>•</span>
                            <span>{session.city}, {session.country}</span>
                          </div>
                          
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">
                            IP: {session.ipAddress} | Last active: {formatRelativeTime(session.lastUsedAt)}
                          </div>

                          {session.suspiciousReason && (
                            <p className="text-sm text-yellow-600">
                              ⚠️ {session.suspiciousReason}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Force logout this session?')) {
                            handleForceLogoutSession(session.id);
                          }
                        }}
                        isLoading={forceLogoutSessionId === session.id}
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
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
