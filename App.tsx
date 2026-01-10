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
  ExternalLink
} from 'lucide-react';

import { FireberryUser, FireberryInquiry, FireberryTask, SnoozeItem, ViewState, AgentStats } from './types';
import {
  getAllUsers,
  getMyInquiries,
  getMyTasks,
  updateInquiryStatus,
  testApiConnection,
  getRecordCount
} from './services/fireberryService';
import {
  LEAD_STATUS_HANDLED,
  LOCAL_STORAGE_CALLS_KEY,
  LOCAL_STORAGE_SNOOZE_KEY,
  LOCAL_STORAGE_USER_KEY
} from './constants';

import { DashboardCard } from './components/DashboardCard';
import { LeadCard } from './components/LeadCard';
import { TaskCard } from './components/TaskCard';
import { Loading } from './components/Loading';

const App = () => {
  const [currentUser, setCurrentUser] = useState<FireberryUser | null>(null);
  const [view, setView] = useState<ViewState>(ViewState.LOGIN);
  const [loading, setLoading] = useState(false);

  const [inquiries, setInquiries] = useState<FireberryInquiry[]>([]);
  const [tasks, setTasks] = useState<FireberryTask[]>([]);
  const [stats, setStats] = useState<AgentStats>({ inquiries: 0, tours: 0, properties: 0 });
  const [dailyCalls, setDailyCalls] = useState(0);
  const [snoozedItems, setSnoozedItems] = useState<SnoozeItem[]>([]);

  const [selectedInquiry, setSelectedInquiry] = useState<FireberryInquiry | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [apiStatus, setApiStatus] = useState<{ connected: boolean, message: string } | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
      setView(ViewState.DASHBOARD);
    }

    const storedCalls = localStorage.getItem(LOCAL_STORAGE_CALLS_KEY);
    if (storedCalls) {
      const { date, count } = JSON.parse(storedCalls);
      const today = new Date().toLocaleDateString();
      if (date === today) {
        setDailyCalls(count);
      } else {
        localStorage.setItem(LOCAL_STORAGE_CALLS_KEY, JSON.stringify({ date: today, count: 0 }));
      }
    }

    const storedSnoozes = localStorage.getItem(LOCAL_STORAGE_SNOOZE_KEY);
    if (storedSnoozes) {
      setSnoozedItems(JSON.parse(storedSnoozes));
    }

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
      // For Inquiry (customobject1014), the lookup 'pcfsystemfield758' likely points to the Agent record, not the User.
      // For Tour (customobject1004) and Product, 'ownerid' always points to the System User.
      const [fetchedInquiries, fetchedTasks, inquiryCount, tourCount, propertyCount] = await Promise.all([
        getMyInquiries(currentUser.agentId),
        getMyTasks(currentUser.id),
        getRecordCount('customobject1014', 'pcfsystemfield758', currentUser.agentId),
        getRecordCount('customobject1004', 'ownerid', currentUser.id),
        getRecordCount('Product', 'ownerid', currentUser.id)
      ]);

      setInquiries(fetchedInquiries);
      setTasks(fetchedTasks);
      setStats({
        inquiries: inquiryCount,
        tours: tourCount,
        properties: propertyCount
      });
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

    try {
      const users = await getAllUsers();
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      const foundUser = users.find(u => u.emailaddress.toLowerCase() === trimmedEmail);

      if (foundUser) {
        if (foundUser.password === trimmedPassword) {
          setCurrentUser(foundUser);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(foundUser));
          setView(ViewState.DASHBOARD);
        } else {
          setLoginError('סיסמה שגויה');
        }
      } else {
        setLoginError('משתמש לא נמצא');
      }
    } catch (err) {
      setLoginError('שגיאת תקשורת');
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
            <h2 className="text-xl font-bold text-[#111111]">{currentUser?.username}</h2>
          </div>
          <button onClick={handleLogout} className="text-gray-400">
            <LogOut size={20} />
          </button>
        </header>

        <main className="p-4">
          {/* Main Stats Row */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex justify-around items-start">
              <div className="flex flex-col items-center space-y-2 flex-1">
                <div className="bg-[#A2D294] text-white p-3 rounded-full flex items-center justify-center shadow-md">
                  <Settings size={22} strokeWidth={2.5} />
                </div>
                <span className="text-xs font-medium text-gray-800 text-center leading-tight">
                  פניות ({stats.inquiries})
                </span>
              </div>

              <div className="flex flex-col items-center space-y-2 flex-1">
                <div className="bg-[#A2D294] text-white p-3 rounded-full flex items-center justify-center shadow-md">
                  <Settings size={22} strokeWidth={2.5} />
                </div>
                <span className="text-xs font-medium text-gray-800 text-center leading-tight">
                  סיור שלם ללקוח ({stats.tours})
                </span>
              </div>

              <div className="flex flex-col items-center space-y-2 flex-1">
                <div className="bg-[#FF9F5A] text-white p-3 rounded-full flex items-center justify-center shadow-md">
                  <Box size={22} strokeWidth={2.5} />
                </div>
                <span className="text-xs font-medium text-gray-800 text-center leading-tight">
                  נכסים ({stats.properties})
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DashboardCard
              title="פניות חדשות"
              count={inquiries.length}
              icon={<Users size={24} />}
              colorClass="bg-[#A2D294]"
              textColorClass="text-black"
              onClick={() => setView(ViewState.LEAD_LIST)}
            />

            <DashboardCard
              title="פניות (כללי)"
              count={stats.inquiries}
              icon={<Clock size={24} />}
              colorClass="bg-[#1F1F1F]"
              textColorClass="text-[#A2D294]"
              onClick={() => setView(ViewState.LEAD_LIST)}
            />

            <DashboardCard
              title="תזכורות"
              count={snoozedItems.length}
              icon={<Bell size={24} />}
              colorClass="bg-white border-[#A2D294] border"
              textColorClass="text-gray-800"
              iconColorClass="text-[#A2D294]"
              onClick={() => setView(ViewState.SNOOZE_LIST)}
            />

            <DashboardCard
              title="שיחות היום"
              count={dailyCalls}
              icon={<Phone size={24} />}
              colorClass="bg-[#111111]"
              textColorClass="text-white"
              iconColorClass="text-green-500"
              action={
                <button
                  onClick={() => incrementDailyCalls()}
                  className="w-full mt-2 bg-[#222] hover:bg-[#333] text-green-500 rounded px-2 py-1.5 text-xs font-bold border border-green-900/30 transition-colors"
                >
                  <Plus size={14} className="inline ml-1" />
                  הוסף שיחה
                </button>
              }
            />
          </div>
        </main>
      </div>
    );
  }

  // Views for lists
  if (view === ViewState.LEAD_LIST) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <Header title={`פניות (${stats.inquiries})`} backAction={() => setView(ViewState.DASHBOARD)} />
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