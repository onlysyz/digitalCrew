import {
  BrowserRouter as Router,
  Routes,
  Route
} from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Loader2
} from 'lucide-react';
import { Toaster } from 'sonner';
import { useSystemStore } from './stores/systemStore';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Overview from './pages/Overview';
import ChatPanel from './pages/ChatPanel';
import AuditCenter from './pages/AuditCenter';
import Settings from './pages/Settings';
import SetupWizard from './pages/SetupWizard';
import KnowledgeBase from './pages/KnowledgeBase';
import SystemLogs from './pages/SystemLogs';
import HelpSupport from './pages/HelpSupport';

const SETUP_COMPLETED_KEY = 'digitalcrew_setup_completed';

export default function App() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const { resources, fetchResources } = useSystemStore();

  useEffect(() => {
    const isSetup = localStorage.getItem(SETUP_COMPLETED_KEY) === 'true';
    setNeedsSetup(!isSetup);
  }, []);

  useEffect(() => {
    fetchResources();
    const interval = setInterval(fetchResources, 5000);
    return () => clearInterval(interval);
  }, [fetchResources]);

  const handleSetupComplete = () => {
    localStorage.setItem(SETUP_COMPLETED_KEY, 'true');
    setNeedsSetup(false);
  };

  if (needsSetup === null) {
    return (
      <div className="min-h-screen bg-[#0b1326] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-right" richColors theme="dark" />
      {needsSetup ? (
        <SetupWizard onComplete={handleSetupComplete} />
      ) : (
        <div className="flex flex-col h-screen overflow-hidden bg-surface text-on-surface">
          <TopBar />
          <div className="flex flex-1 overflow-hidden relative">
            <Sidebar />
            <main className="flex-1 overflow-y-auto custom-scrollbar relative z-0 bg-[#0b1326] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(173,198,255,0.05),rgba(11,19,38,0))]">
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/chat" element={<ChatPanel />} />
                <Route path="/audit" element={<AuditCenter />} />
                <Route path="/logs" element={<SystemLogs />} />
                <Route path="/knowledge" element={<KnowledgeBase />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/support" element={<HelpSupport />} />
                <Route path="*" element={<Overview />} />
              </Routes>
            </main>
          </div>

          {/* Footer */}
          <footer className="bg-[#060a14] font-mono text-[11px] tracking-widest border-t border-white/5 w-full shrink-0 flex justify-between items-center px-6 py-2.5 z-50">
            <div className="text-secondary/80 flex items-center gap-3 font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_rgba(78,222,163,0.6)]" />
              OLLAMA 已连接：本地执行活跃
            </div>
            <div className="flex gap-8 text-outline-variant">
              <span className="hover:text-on-surface transition-colors cursor-pointer">CPU: {resources?.cpu_percent ?? '--'}%</span>
              <span className="hover:text-on-surface transition-colors cursor-pointer">GPU: {resources?.gpu_percent ?? '--'}%</span>
              <span className="hover:text-on-surface transition-colors cursor-pointer">RAM: {resources?.memory_used_gb != null ? `${resources.memory_used_gb.toFixed(1)}GB` : '--'}</span>
            </div>
          </footer>
        </div>
      )}
    </Router>
  );
}
