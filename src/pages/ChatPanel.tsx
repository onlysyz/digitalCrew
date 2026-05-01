import React from 'react';
import { 
  Send, 
  Plus, 
  BrainCircuit, 
  Zap, 
  Cpu, 
  Search, 
  ChevronDown, 
  LayoutDashboard,
  FileUp,
  Terminal
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function ChatPanel() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat Stream Section */}
      <section className="flex-1 flex flex-col h-full bg-surface-lowest border-r border-outline-variant/10 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none opacity-50" />
        
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8 relative z-0">
          {/* User Message */}
          <div className="flex justify-end pr-4">
            <div className="max-w-[70%] bg-surface-container-highest border border-outline-variant/30 rounded-xl rounded-tr-sm p-4 shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-display text-[14px] font-bold text-on-surface">您</span>
                <span className="font-sans text-[11px] text-on-surface-variant/60">10:42 AM</span>
              </div>
              <p className="font-sans text-[15px] text-on-surface leading-relaxed">
                我需要一份关于三个新兴本地 AI 模型的竞争分析报告。你能收集数据、提取关键性能指标并起草一份摘要报告吗？
              </p>
            </div>
          </div>

          {/* Supervisor Agent Response */}
          <div className="flex justify-start pl-4">
            <div className="max-w-[85%]">
              <div className="bg-primary/5 border border-primary/20 rounded-xl rounded-tl-sm p-5 shadow-2xl backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
                
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 relative">
                    <BrainCircuit className="text-primary" size={22} />
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-secondary rounded-full border-2 border-surface animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-[16px] font-bold text-primary tracking-wide">主管代理</span>
                      <span className="font-label text-[10px] text-primary/70 border border-primary/30 px-1.5 py-0.5 rounded bg-primary/5">ORCHESTRATOR</span>
                    </div>
                    <span className="font-sans text-[11px] text-primary/60">10:43 AM</span>
                  </div>
                </div>
                
                <p className="font-sans text-[15px] text-on-surface mb-5 relative z-10">已收到。正在启动协同工作流进行竞争分析。</p>
                
                {/* Plan Summary */}
                <div className="bg-surface-container/60 border border-primary/10 rounded-lg p-4 mb-5 relative z-10">
                  <h4 className="font-label text-primary/80 text-[11px] mb-3 flex items-center gap-2 uppercase tracking-widest">
                    <Zap size={14} /> 执行计划
                  </h4>
                  <ul className="font-sans text-[13px] text-on-surface space-y-2">
                    <li className="flex items-start gap-3">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-tertiary" />
                      <span>分配给 <span className="text-tertiary font-medium bg-tertiary/10 px-1 rounded">@数据研究员</span> 收集 Llama 3、Mistral 和 Gemma 的技术规范。</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-secondary" />
                      <span>分配给 <span className="text-secondary font-medium bg-secondary/10 px-1 rounded">@数据分析师</span> 处理指标并生成对比。</span>
                    </li>
                  </ul>
                </div>

                {/* Thinking Log */}
                <div className="bg-[#0d1117] border border-outline-variant/30 rounded-lg overflow-hidden group">
                  <div className="flex items-center justify-between p-3 bg-white/2 cursor-pointer hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2">
                      <Terminal size={14} className="text-outline" />
                      <span className="font-mono text-[11px] text-outline font-medium uppercase tracking-wider">ReAct 思考日志 (主管代理)</span>
                    </div>
                    <ChevronDown size={16} className="text-outline" />
                  </div>
                  <div className="p-4 border-t border-white/5 font-mono text-[12px] space-y-3 leading-relaxed text-on-surface-variant/80">
                    <div className="flex gap-2">
                      <span className="text-tertiary font-bold">Thought:</span>
                      <span>用户需要三款本地 AI 模型的竞争分析。我需要委派信息收集和数据处理任务。</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-primary font-bold">Action:</span>
                      <span className="text-blue-400">DelegateTask("DataResearcher", "Analyze parameters")</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-surface-container/80 backdrop-blur-md border-t border-outline-variant/10 relative z-10">
          <div className="flex items-end gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-2 focus-within:border-primary/50 transition-all">
            <button className="p-2.5 text-outline hover:text-primary rounded-lg hover:bg-white/5">
              <Plus size={20} />
            </button>
            <textarea 
              className="flex-1 bg-transparent border-none focus:ring-0 resize-none font-sans text-sm text-on-surface placeholder-on-surface-variant/40 py-2.5 max-h-32 min-h-[40px] custom-scrollbar"
              placeholder="给主管代理发送指令..."
              rows={1}
            />
            <button className="p-2.5 text-primary hover:bg-primary/10 rounded-lg transition-colors">
              <Send size={20} />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-3 px-2">
            <span className="font-label text-[10px] text-outline-variant uppercase tracking-widest">提示：输入 '@' 来提及特定代理参与协作</span>
          </div>
        </div>
      </section>

      {/* Right Sidebar: Context Panel */}
      <aside className="w-80 bg-surface-container h-full flex flex-col border-l border-outline-variant/10 shadow-[-10px_0_30px_rgba(0,0,0,0.2)]">
        <div className="p-5 border-b border-outline-variant/10 bg-surface-lowest/30">
          <h3 className="font-label text-outline text-[11px] uppercase tracking-widest flex items-center gap-2 font-bold">
            <LayoutDashboard size={16} className="text-primary/70" /> 当前上下文
          </h3>
        </div>
        
        <div className="p-5 space-y-8 overflow-y-auto custom-scrollbar">
          {/* Active Agents list */}
          <div>
            <h4 className="font-display font-semibold text-[13px] text-on-surface mb-4 flex items-center gap-2">
              活跃代理
            </h4>
            <div className="space-y-4">
              {[
                { name: '主管代理', role: '协调分析工作', progress: 65, status: '调度中', color: 'primary' },
                { name: '数据研究员', role: '收集规格参数', progress: 100, status: '已完成', color: 'tertiary' }
              ].map((agent, i) => (
                <div key={i} className={cn(
                  "p-3 rounded-xl bg-surface-lowest border border-outline-variant/30 shadow-sm relative overflow-hidden group",
                  agent.color === 'primary' ? "hover:border-primary/30" : "hover:border-tertiary/30"
                )}>
                  <div className={cn("absolute top-0 left-0 w-1 h-full", `bg-${agent.color}`)} />
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center border", `bg-${agent.color}/10 border-${agent.color}/30 text-${agent.color}`)}>
                      {i === 0 ? <BrainCircuit size={18} /> : <Zap size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className="font-display font-bold text-[12px] text-on-surface truncate">{agent.name}</p>
                        <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded", `bg-${agent.color}/10 text-${agent.color}`)}>
                          {agent.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-outline font-mono">
                      <span>进度</span>
                      <span>{agent.progress}%</span>
                    </div>
                    <div className="w-full bg-surface-container-highest rounded-full h-1">
                      <div className={cn(`bg-${agent.color}`, "h-full rounded-full transition-all duration-1000")} style={{ width: `${agent.progress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-display font-semibold text-[13px] text-on-surface mb-4">关联资源</h4>
            <div className="border-2 border-outline-variant/20 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center bg-surface-lowest/50 hover:bg-surface-lowest transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileUp size={20} className="text-on-surface-variant group-hover:text-primary transition-colors" />
              </div>
              <p className="font-display text-[12px] font-medium text-on-surface">拖拽文件至此</p>
              <p className="font-sans text-[10px] text-outline mt-1">或点击上传本地文件作为上下文</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
