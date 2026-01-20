import React, { useState, useEffect } from 'react';
import {
  Users,
  Phone,
  CheckCircle,
  Clock,
  LogOut,
  TrendingUp,
  MapPin,
  ChevronRight,
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
  X
} from 'lucide-react';

import { FireberryUser, FireberryInquiry, FireberryTask, SnoozeItem, ViewState, AgentStats } from './types';
import { getRecordCount, getMyInquiries, getMyTasks, updateInquiryStatus, testApiConnection, getAllUsers, getAgents, getLeadsByAgentId } from './services/fireberryService';
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

  const [inquiries, setInquiries] = useState<FireberryInquiry[]>([]);
  const [tasks, setTasks] = useState<FireberryTask[]>([]);
  const [agents, setAgents] = useState<any[]>([]); // New state for agents
  const [totalNewLeads, setTotalNewLeads] = useState(0); // Total count for the big button
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
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [agentLeads, setAgentLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadSortField, setLeadSortField] = useState<string>('name');
  const [leadSortDirection, setLeadSortDirection] = useState<'asc' | 'desc'>('asc');

  const [selectedInquiry, setSelectedInquiry] = useState<FireberryInquiry | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [apiStatus, setApiStatus] = useState<{ connected: boolean, message: string } | null>(null);

  useEffect(() => {
    addDebugLog("App Mount", "Application initialized");
    // Clear stored user on hard refresh to force login
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    checkConnection();
  }, []);

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

      // 2. Fetch Leads for ALL agents in parallel
      // We need this to get the counts for the top bar AND the total joint list for the main button
      const leadsPromises = fetchedAgents.map(agent => getLeadsByAgentId(agent.id));
      const leadsResults = await Promise.all(leadsPromises);

      let allLeadsAggregated: any[] = [];

      // Map results back to agents to add individual counts
      const agentsWithCounts = fetchedAgents.map((agent, index) => {
        const agentSpecificLeads = leadsResults[index] || [];
        allLeadsAggregated = [...allLeadsAggregated, ...agentSpecificLeads];
        return {
          ...agent,
          leadCount: agentSpecificLeads.length
        };
      });

      setAgents(agentsWithCounts);
      setInquiries(allLeadsAggregated); // Store ALL leads ready for the list view
      setTotalNewLeads(allLeadsAggregated.length);
      setAgentLeads(allLeadsAggregated); // Keep a backup or use shared state

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleAgentExpand = async (agentId: string) => {
    if (expandedAgentId === agentId) {
      setExpandedAgentId(null);
      setAgentLeads([]);
      return;
    }

    setExpandedAgentId(agentId);
    setLoadingLeads(true);
    try {
      const leads = await getLeadsByAgentId(agentId);
      setAgentLeads(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      setAgentLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleLeadSort = (field: string) => {
    if (leadSortField === field) {
      setLeadSortDirection(leadSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setLeadSortField(field);
      setLeadSortDirection('asc');
    }
  };

  const sortedLeads = [...agentLeads].sort((a, b) => {
    const aVal = a[leadSortField] || '';
    const bVal = b[leadSortField] || '';
    const comparison = aVal.toString().localeCompare(bVal.toString(), 'he');
    return leadSortDirection === 'asc' ? comparison : -comparison;
  });

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
          <button onClick={handleLogout} className="text-gray-400">
            <LogOut size={20} />
          </button>
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

              {/* Main "New Leads" Button */}
              <div
                onClick={() => setView(ViewState.LEAD_LIST)}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 cursor-pointer group hover:border-[#A2D294] transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-2 h-full bg-[#A2D294]" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="bg-[#111111] text-[#A2D294] p-4 rounded-xl group-hover:scale-110 transition-transform duration-300">
                      <Users size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-[#111111]">
                        לידים חדשים
                        <span className="text-[#A2D294] font-mono mr-2">({totalNewLeads})</span>
                      </h3>
                      <p className="text-gray-500 text-sm mt-1">רשימה מרוכזת לטיפול מיידי</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-full group-hover:bg-[#A2D294] group-hover:text-black transition-colors">
                    <ChevronRight size={24} />
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
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <Header title={`פניות לטיפול (${inquiries.length})`} backAction={() => setView(ViewState.DASHBOARD)} />
        <div className="p-4 space-y-3">
          {loading ? <Loading /> : (
            inquiries.length === 0 ? (
              <div className="text-center text-gray-400 mt-20">
                <CheckCircle size={48} className="mx-auto mb-2 opacity-30 text-[#A2D294]" />
                <p>אין לידים חדשים לטיפול</p>
              </div>
            ) : (
              inquiries.map(inq => (
                <LeadCard
                  key={inq.id}
                  lead={inq}
                  onClick={() => {
                    setSelectedInquiry(inq);
                    setView(ViewState.LEAD_DETAIL);
                  }}
                />
              ))
            )
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