"use client";

import { useAgentStore } from "@/lib/store";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Sidebar() {
    const { sessions, activeSessionId, createNewSession, switchSession, deleteSession } = useAgentStore();

    const sessionsList = Object.values(sessions).sort((a, b) => b.createdAt - a.createdAt);

    return (
        <div className="w-full h-full bg-zinc-50 border-r border-zinc-200 flex flex-col">
            <div className="p-4 border-b border-zinc-200">
                <Button
                    onClick={createNewSession}
                    className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                    <Plus className="w-4 h-4" />
                    New Session
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {sessionsList.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center mt-4">No recent sessions.</p>
                ) : (
                    sessionsList.map((session) => (
                        <div
                            key={session.id}
                            className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${activeSessionId === session.id ? 'bg-zinc-200 text-zinc-900' : 'hover:bg-zinc-100 text-zinc-600'
                                }`}
                            onClick={() => switchSession(session.id)}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <MessageSquare className="w-4 h-4 shrink-0" />
                                <span className="text-sm truncate">{session.title}</span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSession(session.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 transition-opacity"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}