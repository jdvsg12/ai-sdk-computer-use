// components/debug-panel.tsx
"use client";

import { useState } from "react";
import { useAgentStore } from "@/lib/store";
import { ChevronDown, ChevronUp, Activity, MousePointer2, Keyboard, Terminal, CheckCircle2 } from "lucide-react";

export function DebugPanel() {
    const [isOpen, setIsOpen] = useState(false);

    // Global state subscription
    const { agentStatus, events, getEventCounts } = useAgentStore();
    const counts = getEventCounts();

    // Helper function to assign icons based on tool type
    const getToolIcon = (type: string) => {
        if (type.includes("mouse")) return <MousePointer2 className="w-4 h-4 text-blue-500" />;
        if (type.includes("keyboard")) return <Keyboard className="w-4 h-4 text-green-500" />;
        if (type.includes("bash")) return <Terminal className="w-4 h-4 text-orange-500" />;
        return <Activity className="w-4 h-4 text-zinc-500" />;
    };

    return (
        <div className="border-b border-zinc-200 bg-zinc-50/50 flex flex-col transition-all duration-300">
            {/* Header / Collapse Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full p-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    <span>Agent Debug Pipeline</span>
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-zinc-200 text-xs font-mono">
                        Status: {agentStatus}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 font-mono">{events.length} events</span>
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
            </button>

            {/* Expanded Content */}
            {isOpen && (
                <div className="p-4 border-t border-zinc-200 space-y-4 bg-white">
                    {/* Action Metrics */}
                    <div>
                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Action Counts</h4>
                        {Object.keys(counts).length === 0 ? (
                            <p className="text-sm text-zinc-400 italic">No actions recorded yet.</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(counts).map(([type, count]) => (
                                    <div key={type} className="flex items-center justify-between bg-zinc-50 p-2 rounded border border-zinc-100">
                                        <div className="flex items-center gap-2">
                                            {getToolIcon(type)}
                                            <span className="text-xs font-mono truncate max-w-[100px]" title={type}>
                                                {type.replace('computer_', '')}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold bg-zinc-200 px-1.5 rounded">{count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recent Event Log */}
                    <div>
                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Recent Events</h4>
                        <div className="space-y-1 max-h-[150px] overflow-y-auto">
                            {events.length === 0 && <p className="text-sm text-zinc-400 italic">Waiting for agent...</p>}
                            {events.slice(-5).reverse().map((event) => (
                                <div key={event.id} className="flex items-center justify-between text-xs font-mono bg-zinc-50 p-1.5 rounded">
                                    <div className="flex items-center gap-2 truncate">
                                        {event.status === 'success' ? (
                                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        ) : (
                                            <Activity className="w-3 h-3 text-blue-500 animate-pulse" />
                                        )}
                                        <span className="truncate">{event.action.type}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}