import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Overview from './pages/Overview';
import ChatPanel from './pages/ChatPanel';
import AuditCenter from './pages/AuditCenter';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Router>
      <div className="flex flex-col h-screen overflow-hidden bg-surface text-on-surface">
        <TopBar />
        <div className="flex flex-1 overflow-hidden relative">
          <Sidebar />
          <main className="flex-1 overflow-y-auto custom-scrollbar relative z-0 bg-[#0b1326] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(173,198,255,0.05),rgba(11,19,38,0))]">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/chat" element={<ChatPanel />} />
              <Route path="/audit" element={<AuditCenter />} />
              <Route path="/settings" element={<Settings />} />
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
            <span className="hover:text-on-surface transition-colors cursor-pointer">CPU: 24%</span>
            <span className="hover:text-on-surface transition-colors cursor-pointer">GPU: 41%</span>
            <span className="hover:text-on-surface transition-colors cursor-pointer">RAM: 12.4GB</span>
          </div>
        </footer>
      </div>
    </Router>
  );
}
