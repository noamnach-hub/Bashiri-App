import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Phone,
  CheckCircle,
  Clock,
  LogOut,
  TrendingUp,
  MapPin,
  ChevronRight,
  ArrowRight,
  User,
  Plus,
  Bell,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  Settings,
  Box,
  ExternalLink,
  X,
  RefreshCw,
  Search,
  ArrowUp,
  ArrowDown,
  Calendar,
  Filter
} from 'lucide-react';

import { FireberryUser, FireberryInquiry, FireberryTask, SnoozeItem, ViewState, AgentStats } from './types';
import { getRecordCount, getMyInquiries, getMyTasks, updateInquiryStatus, testApiConnection, getAllUsers, getAgents, getAllLeadsByAgentId, updateLeadAgentStatus } from './services/fireberryService';
import { getDebugLogs, addDebugLog } from './services/debugService';
import {
  LEAD_STATUS_HANDLED,
  LOCAL_STORAGE_CALLS_KEY,
  LOCAL_STORAGE_SNOOZE_KEY,
  LOCAL_STORAGE_USER_KEY,
  FIREBERRY_CONFIG
} from './constants';

import { DashboardCard } from './components/DashboardCard';
import { LeadCard } from './components/LeadCard';
import { TaskCard } from './components/TaskCard';
import { Loading } from './components/Loading';

const App = () => {
  const [showDebug, setShowDebug] = useState(false);
  const [currentUser, setCurrentUser] = useState<FireberryUser | null>(null);
  const [view, setView] = useState<ViewState>(ViewState.LOGIN);
  const [loading, setLoading] = useState(false);

  // Lead lists by status
  const [allLeads, setAllLeads] = useState<any[]>([]); // All leads from all agents
  const [newLeads, setNewLeads] = useState<any[]>([]); // Status: חדש (2)
  const [snoozeLeads, setSnoozeLeads] = useState<any[]>([]); // Status: נודניק (3)
  const [handledLeads, setHandledLeads] = useState<any[]>([]); // Status: טופל (4)
  const [currentStatusFilter, setCurrentStatusFilter] = useState<'new' | 'snooze' | 'handled' | null>(null);
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]); // Leads shown in list view

  const [inquiries, setInquiries] = useState<FireberryInquiry[]>([]);
  const [tasks, setTasks] = useState<FireberryTask[]>([]);
  const [agents, setAgents] = useState<any[]>([]); // Agents list
  const [stats, setStats] = useState<AgentStats>({
    inquiries: 0,
    tours: 0,
    properties: 0,
    accounts: 0,
    leases: 0,
    visits: 0
  });
  const [dailyCalls, setDailyCalls] = useState(0);
  const [snoozedItems, setSnoozedItems] = useState<SnoozeItem[]>([]);
  const [snoozeDropdownOpen, setSnoozeDropdownOpen] = useState<string | null>(null); // Lead ID with open dropdown

  // Lead list filtering and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'phone' | 'date'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'older'>('all');

  const [selectedInquiry, setSelectedInquiry] = useState<FireberryInquiry | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [apiStatus, setApiStatus] = useState<{ connected: boolean, message: string } | null>(null);
  const isNavigatingBack = useRef(false);

  useEffect(() => {
    addDebugLog("App Mount", "Application initialized");
    // Clear stored user on hard refresh to force login
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    checkConnection();
  }, []);

  // Sync View with Browser History (Back Button Support)
  useEffect(() => {
    // On mount, establish initial state
    window.history.replaceState({ view: ViewState.LOGIN }, '');

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        isNavigatingBack.current = true;
        setView(event.state.view);
      } else {
        // If history runs out (user went back past start), default to Dashboard if logged in
        if (currentUser) {
          isNavigatingBack.current = true;
          setView(ViewState.DASHBOARD);
          window.history.replaceState({ view: ViewState.DASHBOARD }, '');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser]);

  // Push new state when View changes (unless popping)
  useEffect(() => {
    if (isNavigatingBack.current) {
      isNavigatingBack.current = false;
      return;
    }
    // Don't push state for initial login view to avoid double entry
    if (view === ViewState.LOGIN && !currentUser) return;

    window.history.pushState({ view }, '');
  }, [view, currentUser]);

  useEffect(() => {
    if (currentUser && view === ViewState.DASHBOARD) {
      fetchDashboardData();
    }
  }, [currentUser, view]);

  const checkConnection = async () => {
    const result = await testApiConnection();
    setApiStatus({ connected: result.success, message: result.message });
  };

  const fetchDashboardData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // 1. Fetch Agents
      const fetchedAgents = await getAgents(currentUser.id);

      // 2. Fetch ALL Leads (all statuses) for ALL agents in parallel
      const leadsPromises = fetchedAgents.map(agent => getAllLeadsByAgentId(agent.id));
      const leadsResults = await Promise.all(leadsPromises);

      let allLeadsAggregated: any[] = [];

      // Map results back to agents
      const agentsWithCounts = fetchedAgents.map((agent, index) => {
        const agentSpecificLeads = leadsResults[index] || [];
        allLeadsAggregated = [...allLeadsAggregated, ...agentSpecificLeads];
        return {
          ...agent,
          leadCount: agentSpecificLeads.filter(l => l.statusRaw === 2 || l.statusRaw === '2').length // Count new leads
        };
      });

      // Categorize leads by status (CORRECT VALUES from user):
      // Status 2 = "חדש" (New/Open - Green)
      // Status 3 = "נודניק" (Snooze - Yellow)
      // Status 1 = "טופל" (Handled - Blue)
      const newList = allLeadsAggregated.filter(l =>
        l.statusRaw === 2 || l.statusRaw === '2'
      );
      const snoozeList = allLeadsAggregated.filter(l =>
        l.statusRaw === 3 || l.statusRaw === '3'
      );
      const handledList = allLeadsAggregated.filter(l =>
        l.statusRaw === 1 || l.statusRaw === '1'
      );

      addDebugLog("Lead Categorization", {
        total: allLeadsAggregated.length,
        new: newList.length,
        snooze: snoozeList.length,
        handled: handledList.length,
        uniqueStatuses: [...new Set(allLeadsAggregated.map(l => l.statusRaw))],
        sampleStatuses: allLeadsAggregated.slice(0, 10).map(l => ({ name: l.name, status: l.status, raw: l.statusRaw }))
      });

      setAgents(agentsWithCounts);
      setAllLeads(allLeadsAggregated);
      setNewLeads(newList);
      setSnoozeLeads(snoozeList);
      setHandledLeads(handledList);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handler to open lead list by status
  const openLeadsByStatus = (status: 'new' | 'snooze' | 'handled') => {
    setCurrentStatusFilter(status);
    switch (status) {
      case 'new':
        setFilteredLeads(newLeads);
        break;
      case 'snooze':
        setFilteredLeads(snoozeLeads);
        break;
      case 'handled':
        setFilteredLeads(handledLeads);
        break;
    }
    setView(ViewState.LEAD_LIST);
  };

  // Handler to mark lead as handled (Status 1 = טופל)
  const handleMarkAsHandled = async (leadId: string) => {
    setLoading(true);
    const success = await updateLeadAgentStatus(leadId, 1); // 1 = טופל
    if (success) {
      addDebugLog("Lead Marked Handled", { leadId, newStatus: 1 });
      // Remove from current filtered list immediately
      setFilteredLeads(prev => prev.filter(l => l.id !== leadId));
      // Refresh data in background
      await fetchDashboardData();
    }
    setLoading(false);
  };

  // Handler to mark lead as snooze (Status 3 = נודניק)
  // Also creates a Google Task reminder and sends webhook to Airtable
  const handleMarkAsSnooze = async (leadId: string, lead: any, delayMinutes: number, delayLabel: string) => {
    setSnoozeDropdownOpen(null); // Close dropdown
    setLoading(true);

    const success = await updateLeadAgentStatus(leadId, 3); // 3 = נודניק
    if (success) {
      addDebugLog("Lead Marked Snooze", { leadId, newStatus: 3, delay: delayLabel });

      // Calculate reminder time
      const reminderTime = new Date();
      reminderTime.setMinutes(reminderTime.getMinutes() + delayMinutes);

      // Send webhook to Airtable via CORS proxy
      try {
        // Format dates as DD-MM-YYYY HH:MM (adjusted for Airtable timezone)
        const formatDateForAirtable = (date: Date) => {
          // Airtable adds timezone offset, so we subtract it to get correct display
          const adjustedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000 * -1));
          // Actually, let's just use UTC values which Airtable will convert to local
          const day = date.getDate();
          const month = date.getMonth() + 1;
          const year = date.getFullYear();
          // Subtract 2 hours (Israel timezone offset) so Airtable shows correct time
          const adjustedHours = date.getHours() - 2;
          const hours = adjustedHours.toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          return `${day}-${month}-${year} ${hours}:${minutes}`;
        };

        const webhookData = {
          name: lead.linkedCustomerName || lead.name || '',
          phone: lead.phone || '',
          reminder_date: formatDateForAirtable(reminderTime),
          lead_creation_time: lead.createdOn ? formatDateForAirtable(new Date(lead.createdOn)) : '',
          agent: currentUser?.emailaddress || ''
        };

        addDebugLog("Sending Webhook", webhookData);

        // Use CORS proxy to send webhook
        const webhookUrl = 'https://hooks.airtable.com/workflows/v1/genericWebhook/appJA1grYnl1RPY2S/wflhCNJFhvgGbDkUI/wtrzLwDs8u0pGlUqW';
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(webhookUrl)}`;

        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookData)
        });

        addDebugLog("Webhook Response", { ok: response.ok, status: response.status });

      } catch (webhookError) {
        console.error("Webhook error:", webhookError);
        addDebugLog("Snooze Webhook Error", String(webhookError));
      }

      // Create Google Calendar event
      const taskTitle = encodeURIComponent(`תזכורת: ${lead.linkedCustomerName || lead.name || 'ליד'} - ${lead.phone || ''}`);
      const taskDetails = encodeURIComponent(`ליד לחזור אליו\nטלפון: ${lead.phone}\nנדחה ב: ${delayLabel}`);

      // Format date for Google Calendar URL in LOCAL time (YYYYMMDDTHHmmss)
      const formatGoogleDate = (date: Date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = '00';
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
      };

      // Event starts and ends at the same time (0 duration = just a reminder)
      const startTime = formatGoogleDate(reminderTime);
      const endTime = formatGoogleDate(reminderTime);

      // Open Google Calendar event:
      // - ctz=Asia/Jerusalem for Israel timezone
      // - crm=AVAILABLE makes it "Free" (not blocking time)
      const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${taskTitle}&details=${taskDetails}&dates=${startTime}/${endTime}&ctz=Asia/Jerusalem&crm=AVAILABLE`;

      // Open in new tab
      window.open(calendarUrl, '_blank');

      // Remove from current filtered list immediately (this will re-render)
      setFilteredLeads(prev => {
        const updated = prev.filter(l => l.id !== leadId);
        addDebugLog("Filtered Leads Updated", { before: prev.length, after: updated.length });
        return updated;
      });

      // Refresh dashboard counts in background (don't wait)
      fetchDashboardData();
    }
    setLoading(false);
  };

  // Snooze time options
  const snoozeOptions = [
    { label: 'רבע שעה', minutes: 15 },
    { label: 'חצי שעה', minutes: 30 },
    { label: 'שעה', minutes: 60 },
    {
      label: 'מחר ב-10:00', minutes: (() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        return Math.round((tomorrow.getTime() - Date.now()) / 60000);
      })()
    },
    {
      label: 'מחרתיים ב-10:00', minutes: (() => {
        const dayAfter = new Date();
        dayAfter.setDate(dayAfter.getDate() + 2);
        dayAfter.setHours(10, 0, 0, 0);
        return Math.round((dayAfter.getTime() - Date.now()) / 60000);
      })()
    }
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    addDebugLog("handleLogin", "Login attempt started");

    try {
      addDebugLog("handleLogin", "Calling getAllUsers...");
      const users = await getAllUsers();
      addDebugLog("handleLogin", { usersCount: users.length, firstUser: users[0] });
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      const foundUser = users.find(u => u.emailaddress.toLowerCase() === trimmedEmail);
      addDebugLog("handleLogin", { searchEmail: trimmedEmail, foundUser: foundUser ? 'Yes' : 'No' });

      if (foundUser) {
        // Strict Login Rules:
        // 1. Must be active
        // 2. Password must match phone
        if (!foundUser.isactive) {
          setLoginError('משתמש זה אינו פעיל במערכת');
          setLoading(false);
          return;
        }

        if (foundUser.password === trimmedPassword) {
          setCurrentUser(foundUser);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(foundUser));
          setView(ViewState.DASHBOARD);
        } else {
          setLoginError('סיסמה שגויה (יש להזין מספר טלפון)');
        }
      } else {
        setLoginError('משתמש לא נמצא');
      }
    } catch (err) {
      setLoginError('שגיאת תקשורת עם השרת');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    setCurrentUser(null);
    setView(ViewState.LOGIN);
    setEmail('');
    setPassword('');
  };

  const incrementDailyCalls = () => {
    const newCount = dailyCalls + 1;
    setDailyCalls(newCount);
    localStorage.setItem(LOCAL_STORAGE_CALLS_KEY, JSON.stringify({
      date: new Date().toLocaleDateString(),
      count: newCount
    }));
  };

  const handleLeadAction = async (action: 'handled' | 'snooze', payload?: any) => {
    if (!selectedInquiry) return;

    if (action === 'handled') {
      setLoading(true);
      const success = await updateInquiryStatus(selectedInquiry.id, LEAD_STATUS_HANDLED);
      if (success) {
        setInquiries(prev => prev.filter(l => l.id !== selectedInquiry.id));
        setView(ViewState.LEAD_LIST);
      }
      setLoading(false);
    } else if (action === 'snooze') {
      const minutes = payload as number;
      const newItem: SnoozeItem = {
        id: Date.now().toString(),
        leadId: selectedInquiry.id,
        leadName: selectedInquiry.name,
        remindAt: Date.now() + (minutes * 60 * 1000),
        note: `נדחה ב-${minutes} דקות`
      };
      const newSnoozeList = [...snoozedItems, newItem];
      setSnoozedItems(newSnoozeList);
      localStorage.setItem(LOCAL_STORAGE_SNOOZE_KEY, JSON.stringify(newSnoozeList));
      setView(ViewState.DASHBOARD);
    }
  };

  if (view === ViewState.LOGIN) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#111111] text-white">
        <div className="w-full max-w-md">
          <div className="text-center mb-10 flex flex-col items-center">
            <div className="mb-4">
              <img
                src="https://bashiri.co.il/wp-content/uploads/2021/11/logo.png"
                alt="תיווך בשירי"
                className="h-24 object-contain"
              />
            </div>
            <p className="text-gray-400 text-sm tracking-widest uppercase">Real Estate Experts</p>
            <p className="text-[#A2D294] mt-2 font-medium">פורטל סוכנים</p>
          </div>

          <div className="bg-[#1F1F1F] rounded-2xl p-8 shadow-2xl border border-[#333]">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-[#A2D294] mb-2 uppercase tracking-wide text-right">אימייל</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#111111] border border-[#333] focus:border-[#A2D294] focus:ring-1 focus:ring-[#A2D294] outline-none text-white placeholder-gray-600 transition-all text-left"
                  dir="ltr"
                  placeholder="name@bashiri.co.il"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A2D294] mb-2 uppercase tracking-wide text-right">סיסמה (מספר טלפון)</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-[#111111] border border-[#333] focus:border-[#A2D294] focus:ring-1 focus:ring-[#A2D294] outline-none text-white placeholder-gray-600 transition-all text-left"
                    dir="ltr"
                    placeholder="******"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 hover:text-[#A2D294]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <p className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded border border-red-900/50">{loginError}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#A2D294] hover:bg-[#8fbf81] text-black font-bold py-3.5 rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 mt-4"
              >
                {loading ? 'מתחבר...' : 'כניסה למערכת'}
              </button>
            </form>
          </div>

          <div className="mt-8 text-center">
            {apiStatus ? (
              <div className={`flex items-center justify-center gap-2 text-xs ${apiStatus.connected ? 'text-green-500' : 'text-red-500'}`}>
                {apiStatus.connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                <span>{apiStatus.message}</span>
              </div>
            ) : (
              <div className="text-gray-600 text-xs">בודק חיבור למערכת...</div>
            )}
          </div>

          <div className="mt-4 text-center">
            <button onClick={() => setShowDebug(true)} className="text-gray-500 text-xs underline hover:text-[#A2D294]">
              Show Debug Logs
            </button>
          </div>

          {showDebug && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-black">Debug Logs</h3>
                  <button onClick={() => setShowDebug(false)} className="text-gray-500 hover:text-gray-700">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-auto bg-gray-100 p-4 rounded text-xs font-mono whitespace-pre-wrap mb-4 custom-scrollbar text-black text-left" dir="ltr">
                  {JSON.stringify(getDebugLogs(), null, 2)}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(getDebugLogs(), null, 2));
                      alert("Logs copied to clipboard!");
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={() => setShowDebug(false)}
                    className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const Header = ({ title, backAction }: { title: string, backAction?: () => void }) => (
    <header className="bg-[#111111] border-b border-[#333] sticky top-0 z-10 px-4 py-4 flex items-center justify-between shadow-md">
      <div className="flex items-center">
        {backAction && (
          <button onClick={backAction} className="ml-3 p-1 rounded-full text-[#A2D294] hover:bg-[#222]">
            <ChevronRight size={28} />
          </button>
        )}
        <h1 className="text-xl font-bold text-white tracking-wide">{title}</h1>
      </div>
      {!backAction && (
        <button onClick={handleLogout} className="text-red-400 p-2 rounded-full hover:bg-[#222]">
          <LogOut size={20} />
        </button>
      )}
    </header>
  );

  if (view === ViewState.DASHBOARD) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-20">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="bg-[#111111] p-2 rounded-lg">
              <img src="https://bashiri.co.il/wp-content/uploads/2021/11/logo.png" className="h-6" alt="Bashiri" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#111111]">{currentUser?.username}</h2>
              <div className="text-xs text-gray-500 font-mono flex flex-col">
                <span>ID: {currentUser?.id}</span>
                <span>Pass: {currentUser?.password}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="text-[#A2D294] hover:text-[#8fbf81] disabled:opacity-50"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="p-4">
          {loading ? (
            <Loading />
          ) : (
            <>
              {/* Agents Summary Section (Horizontal Scroll) */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">סוכנים ופניות ({agents.length})</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar" style={{ scrollbarWidth: 'none' }}>
                  {agents.length === 0 ? (
                    <div className="text-gray-400 text-sm italic">לא נמצאו סוכנים</div>
                  ) : (
                    agents.map((agent) => (
                      <div key={agent.id} className="min-w-[140px] bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold mb-2 text-sm">
                          {(agent.name || '?').charAt(0)}
                        </div>
                        <h4 className="font-bold text-[#111] text-xs mb-1 truncate w-full">{agent.name || 'לא ידוע'}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${agent.leadCount > 0 ? 'bg-[#A2D294]/20 text-green-800 font-bold' : 'bg-gray-100 text-gray-400'}`}>
                          {agent.leadCount || 0} פניות
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Status Cards - 3 Buttons */}
              <div className="space-y-4">
                {/* New Leads Button */}
                <div
                  onClick={() => openLeadsByStatus('new')}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 cursor-pointer group hover:border-[#A2D294] transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-2 h-full bg-[#A2D294]" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-[#A2D294] text-[#111111] p-3 rounded-xl group-hover:scale-110 transition-transform duration-300">
                        <Users size={28} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-[#111111]">
                          לידים פתוחים
                          <span className="text-[#A2D294] font-mono mr-2">({newLeads.length})</span>
                        </h3>
                        <p className="text-gray-500 text-sm">סטטוס: 2. חדש</p>
                      </div>
                    </div>
                    <ChevronRight size={24} className="text-gray-400 group-hover:text-[#A2D294]" />
                  </div>
                </div>

                {/* Snooze Leads Button */}
                <div
                  onClick={() => openLeadsByStatus('snooze')}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 cursor-pointer group hover:border-yellow-400 transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-2 h-full bg-yellow-400" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-yellow-100 text-yellow-700 p-3 rounded-xl group-hover:scale-110 transition-transform duration-300">
                        <Clock size={28} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-[#111111]">
                          לידים בנודניק
                          <span className="text-yellow-600 font-mono mr-2">({snoozeLeads.length})</span>
                        </h3>
                        <p className="text-gray-500 text-sm">סטטוס: 3. נודניק</p>
                      </div>
                    </div>
                    <ChevronRight size={24} className="text-gray-400 group-hover:text-yellow-500" />
                  </div>
                </div>

                {/* Handled Leads Button */}
                <div
                  onClick={() => openLeadsByStatus('handled')}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 cursor-pointer group hover:border-blue-400 transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-2 h-full bg-blue-400" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-100 text-blue-700 p-3 rounded-xl group-hover:scale-110 transition-transform duration-300">
                        <CheckCircle size={28} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-[#111111]">
                          לידים שטופלו
                          <span className="text-blue-600 font-mono mr-2">({handledLeads.length})</span>
                        </h3>
                        <p className="text-gray-500 text-sm">סטטוס: 1. טופל</p>
                      </div>
                    </div>
                    <ChevronRight size={24} className="text-gray-400 group-hover:text-blue-500" />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setShowDebug(true)}
              className="bg-gray-800 text-white px-4 py-2 rounded shadow text-xs font-mono"
            >
              Show Debug Logs
            </button>
          </div>

          {showDebug && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">Debug Logs</h3>
                  <button onClick={() => setShowDebug(false)} className="text-gray-500 hover:text-gray-700">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-auto bg-gray-100 p-4 rounded text-xs font-mono whitespace-pre-wrap mb-4 custom-scrollbar">
                  {JSON.stringify(getDebugLogs(), null, 2)}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(getDebugLogs(), null, 2));
                      alert("Logs copied to clipboard!");
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={() => setShowDebug(false)}
                    className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Views for lists
  if (view === ViewState.LEAD_LIST) {
    const statusTitle = currentStatusFilter === 'new' ? 'לידים פתוחים' :
      currentStatusFilter === 'snooze' ? 'לידים בנודניק' :
        currentStatusFilter === 'handled' ? 'לידים שטופלו' : 'לידים';

    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <div className="max-w-4xl mx-auto bg-white min-h-screen shadow-xl border-x border-gray-100 relative">
          {/* Header with back, refresh, logout */}
          <div className="bg-[#111111] text-white p-4 flex items-center justify-between sticky top-0 z-20 shadow-md">
            <div className="flex items-center gap-3">
              <button onClick={() => { setView(ViewState.DASHBOARD); setSnoozeDropdownOpen(null); }} className="p-1">
                <ArrowRight size={24} />
              </button>
              <h1 className="text-lg font-bold">{statusTitle} ({filteredLeads.length})</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchDashboardData}
                disabled={loading}
                className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
                title="רענן נתונים"
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => { setCurrentUser(null); setView(ViewState.LOGIN); }}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                title="יציאה"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          <div className="bg-white border-b border-gray-200 sticky top-[68px] z-10 shadow-sm">
            {/* Search and Date Filters */}
            <div className="p-3 bg-gray-50 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="חפש לפי שם או טלפון..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#111111] focus:border-transparent text-sm"
                  />
                  <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute left-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Date Filters */}
                <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                  {[
                    { id: 'all', label: 'הכל' },
                    { id: 'today', label: 'היום' },
                    { id: 'yesterday', label: 'אתמול' },
                    { id: 'older', label: 'ישן יותר' }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setDateFilter(filter.id as any)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${dateFilter === filter.id
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sortable Column Headers - Now strictly aligned with List Grid */}
            <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-bold text-gray-500 bg-gray-50">
              <button
                onClick={() => {
                  if (sortField === 'name') setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                  else { setSortField('name'); setSortDirection('asc'); }
                }}
                className="col-span-4 text-right flex items-center gap-1 hover:text-[#111111]"
              >
                שם
                {sortField === 'name' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </button>
              <button
                onClick={() => {
                  if (sortField === 'phone') setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                  else { setSortField('phone'); setSortDirection('asc'); }
                }}
                className="col-span-4 text-right flex items-center gap-1 hover:text-[#111111]"
              >
                טלפון
                {sortField === 'phone' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </button>
              <button
                onClick={() => {
                  if (sortField === 'date') setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                  else { setSortField('date'); setSortDirection('desc'); } // Default desc for date
                }}
                className="col-span-4 text-right flex items-center gap-1 hover:text-[#111111]"
              >
                תאריך
                {sortField === 'date' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </button>
            </div>
          </div>

          <div className="">
            {loading ? <Loading /> : (
              filteredLeads.length === 0 ? (
                <div className="text-center text-gray-400 mt-20">
                  <CheckCircle size={48} className="mx-auto mb-2 opacity-30 text-[#A2D294]" />
                  <p>אין לידים ברשימה זו</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {/* Processed Leads List */}
                  {filteredLeads
                    .filter(lead => {
                      // Search filter
                      const searchLower = searchQuery.toLowerCase();
                      const nameMatch = (lead.linkedCustomerName || lead.name || '').toLowerCase().includes(searchLower);
                      const phoneMatch = (lead.phone || '').includes(searchLower);
                      if (!nameMatch && !phoneMatch) return false;

                      // Date filter
                      if (dateFilter !== 'all') {
                        const leadDate = new Date(lead.createdOn);
                        const today = new Date();
                        const isToday = leadDate.getDate() === today.getDate() && leadDate.getMonth() === today.getMonth() && leadDate.getFullYear() === today.getFullYear();

                        const yesterday = new Date(today);
                        yesterday.setDate(yesterday.getDate() - 1);
                        const isYesterday = leadDate.getDate() === yesterday.getDate() && leadDate.getMonth() === yesterday.getMonth() && leadDate.getFullYear() === yesterday.getFullYear();

                        if (dateFilter === 'today' && !isToday) return false;
                        if (dateFilter === 'yesterday' && !isYesterday) return false;
                        if (dateFilter === 'older' && (isToday || isYesterday)) return false;
                      }
                      return true;
                    })
                    .sort((a, b) => {
                      let valA, valB;
                      if (sortField === 'name') {
                        valA = a.linkedCustomerName || a.name || '';
                        valB = b.linkedCustomerName || b.name || '';
                      } else if (sortField === 'phone') {
                        valA = a.phone || '';
                        valB = b.phone || '';
                      } else { // date
                        valA = new Date(a.createdOn || 0).getTime();
                        valB = new Date(b.createdOn || 0).getTime();
                      }

                      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
                      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
                      return 0;
                    })
                    .map((lead, index) => (
                      <div
                        key={lead.id}
                        className={`bg-white border-b border-gray-100 last:border-b-0 relative hover:bg-gray-50 transition-colors`}
                      >
                        {/* Grid Row for Data Columns */}
                        <div className="grid grid-cols-12 gap-2 p-3 items-center">
                          {/* Name Column */}
                          <div className="col-span-4 flex items-center gap-2 overflow-hidden">
                            <div className="w-8 h-8 bg-gradient-to-br from-[#111111] to-[#333333] rounded-full flex items-center justify-center text-[#A2D294] font-bold text-xs flex-shrink-0">
                              {(lead.linkedCustomerName || lead.name || '?').charAt(0)}
                            </div>
                            <h4
                              className="font-semibold text-[#111111] text-sm leading-tight"
                              title={lead.linkedCustomerName || lead.name}
                              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                            >
                              {lead.linkedCustomerName || lead.name || 'ללא שם'}
                            </h4>
                          </div>

                          {/* Phone Column */}
                          <div className="col-span-4 text-right">
                            <a href={`tel:${lead.phone}`} className="font-mono text-xs text-gray-600 block truncate hover:text-blue-600" dir="ltr">
                              {lead.phone || '-'}
                            </a>
                          </div>

                          {/* Date Column */}
                          <div className="col-span-4 text-right">
                            <span className="text-xs text-gray-500 block truncate" dir="ltr">
                              {lead.createdOn ? new Date(lead.createdOn).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </span>
                          </div>
                        </div>

                        {/* Content & Actions Row */}
                        <div className="px-3 pb-3 flex items-center justify-between gap-3 border-t border-gray-50 pt-2 mx-3">
                          {/* Details/Content */}
                          <div className="flex-1 min-w-0">
                            {lead.content ? (
                              <p className="text-xs text-gray-400 truncate">
                                {lead.content}
                              </p>
                            ) : <span className="text-xs text-gray-300">אין תוכן</span>}
                          </div>

                          {/* Action Buttons - Compact */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <a
                              href={`tel:${lead.phone}`}
                              className="p-3 bg-[#111111] text-[#A2D294] rounded-lg hover:bg-gray-800 transition-all active:scale-95 shadow-sm"
                              title="חייג"
                            >
                              <Phone size={20} />
                            </a>

                            <div className="relative">
                              <button
                                onClick={() => setSnoozeDropdownOpen(snoozeDropdownOpen === lead.id ? null : lead.id)}
                                disabled={loading}
                                className="p-3 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-all active:scale-95 disabled:opacity-50 border border-yellow-200"
                                title="תזכורת"
                              >
                                <Clock size={20} />
                              </button>

                              {/* Snooze Dropdown */}
                              {snoozeDropdownOpen === lead.id && (
                                <div className="absolute left-0 bottom-full mb-2 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 min-w-[120px]">
                                  {snoozeOptions.map((option) => (
                                    <button
                                      key={option.label}
                                      onClick={() => handleMarkAsSnooze(lead.id, lead, option.minutes, option.label)}
                                      className="w-full text-right px-3 py-2 text-xs text-gray-700 hover:bg-yellow-50 hover:text-yellow-700 transition-colors"
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => handleMarkAsHandled(lead.id)}
                              disabled={loading}
                              className="p-3 bg-[#A2D294] text-[#111111] rounded-lg hover:bg-[#8fbf81] transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                              title="טופל"
                            >
                              <CheckCircle size={20} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )
            )}
          </div>

          {/* Click outside to close dropdown */}
          {snoozeDropdownOpen && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setSnoozeDropdownOpen(null)}
            />
          )}
        </div>
      </div>
    );
  }

  if (view === ViewState.LEAD_DETAIL && selectedInquiry) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header title="פרטי ליד (פנייה)" backAction={() => setView(ViewState.LEAD_LIST)} />
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex flex-col items-center mb-8 border-b border-gray-100 pb-8">
            <div className="w-20 h-20 bg-[#111111] rounded-full flex items-center justify-center text-[#A2D294] mb-4 shadow-lg border-2 border-[#A2D294]">
              <User size={36} />
            </div>
            <h2 className="text-2xl font-bold text-[#111111]">{selectedInquiry.name}</h2>
            <p className="text-xl text-[#A2D294] font-medium mt-1">{selectedInquiry.phone}</p>
          </div>
          <div className="bg-[#FAFAFA] rounded-xl p-5 border border-gray-100 mb-6">
            <h3 className="text-xs font-bold text-[#A2D294] mb-3 uppercase tracking-wider">תקציר הפנייה</h3>
            <p className="text-gray-700 leading-relaxed text-sm">
              {selectedInquiry.description || 'אין פירוט נוסף'}
            </p>
          </div>

          <a
            href={`https://app.powerlink.co.il/Record/Details/1014/${selectedInquiry.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full py-3 px-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:text-[#A2D294] hover:border-[#A2D294] transition-all group mb-4"
          >
            <ExternalLink size={18} className="ml-2 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">פתח בפיירברי (CRM)</span>
          </a>
        </div>
        <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
          <a href={`tel:${selectedInquiry.phone}`} className="flex items-center justify-center w-full bg-[#111111] text-white font-bold text-lg py-4 rounded-xl shadow-lg mb-3 active:bg-black transition-colors">
            <Phone className="ml-2 text-[#A2D294]" />
            חייג ללקוח
          </a>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleLeadAction('handled')} className="flex items-center justify-center bg-[#A2D294] text-black font-bold py-3 rounded-xl shadow-sm hover:bg-[#8fbf81] transition-colors">
              <CheckCircle className="ml-2" size={20} />
              טופל
            </button>
            <button onClick={() => handleLeadAction('snooze', 60)} className="flex items-center justify-center bg-white text-gray-700 font-bold py-3 rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors">
              <Clock className="ml-2" size={20} />
              נודניק (1 ש')
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === ViewState.FOLLOWUP_LIST) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <Header title={`פולואפים להיום (${tasks.length})`} backAction={() => setView(ViewState.DASHBOARD)} />
        <div className="p-4 space-y-3">
          {loading ? <Loading /> : (
            tasks.length === 0 ? (
              <div className="text-center text-gray-400 mt-20">
                <CheckCircle size={48} className="mx-auto mb-2 opacity-30 text-[#A2D294]" />
                <p>אין משימות פתוחות להיום</p>
              </div>
            ) : (
              tasks.map(task => (
                <TaskCard
                  key={task.activityid}
                  task={task}
                  onCall={() => incrementDailyCalls()}
                />
              ))
            )
          )}
        </div>
      </div>
    );
  }

  if (view === ViewState.SNOOZE_LIST) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <Header title={`תזכורות אישיות (${snoozedItems.length})`} backAction={() => setView(ViewState.DASHBOARD)} />
        <div className="p-4 space-y-3">
          {snoozedItems.length === 0 ? (
            <div className="text-center text-gray-400 mt-20">
              <Bell size={48} className="mx-auto mb-2 opacity-30 text-[#A2D294]" />
              <p>אין תזכורות פעילות</p>
            </div>
          ) : (
            snoozedItems.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border-r-4 border-r-[#A2D294] flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-[#111111]">{item.leadName}</h4>
                  <p className="text-sm text-gray-500">{new Date(item.remindAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-xs text-[#A2D294] font-medium">{item.note}</p>
                </div>
                <button
                  onClick={() => {
                    const newList = snoozedItems.filter(i => i.id !== item.id);
                    setSnoozedItems(newList);
                    localStorage.setItem(LOCAL_STORAGE_SNOOZE_KEY, JSON.stringify(newList));
                  }}
                  className="text-gray-300 hover:text-[#A2D294] p-2 transition-colors"
                >
                  <CheckCircle size={22} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return <Loading />;
};

export default App;