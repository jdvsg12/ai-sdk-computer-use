import { create } from "zustand";
import { persist } from "zustand/middleware"
import { Message } from "ai"

export type toolStatus = "pending" | "success" | "error" | "aborted";

export type AgentAction = | { type: 'computer_screenshot'; payload: unknown }
    | { type: 'computer_mouse_move'; payload: { x: number; y: number } }
    | { type: 'computer_mouse_click'; payload: { button: string } }
    | { type: 'computer_keyboard_type'; payload: { text: string } }
    | { type: 'bash_command'; payload: { command: string } }
    | { type: 'unknown_tool'; payload: unknown };

export interface AgentEvent {
    id: string;
    timestamp: number;
    toolName: string;
    action: AgentAction;
    status: toolStatus;
    durationMs?: number;
}

export interface Session {
    id: string;
    title: string;
    createdAt: number;
    messages: Message[];
    events: AgentEvent[];
}


interface AgentState {
    events: AgentEvent[];
    agentStatus: 'idle' | 'working' | 'error';
    sessions: Record<string, Session>;
    activeSessionId: string | null;
    
    addEvent: (event: AgentEvent) => void;
    updateEventStatus: (id: string, status: toolStatus, durationMs?: number) => void;
    setAgentStatus: (status: 'idle' | 'working' | 'error') => void;
    clearEvents: () => void;
    getEventCounts: () => Record<string, number>;
    createNewSession: () => string;
    switchSession: (sessionId: string) => void;
    deleteSession: (sessionId: string) => void;
    syncCurrentSession: (messages: Message[]) => void;
}

export const useAgentStore = create<AgentState>()(
    persist(
        (set, get) => ({
            events: [],
            agentStatus: 'idle',
            sessions: {},
            activeSessionId: null,

            addEvent: (event) =>
                set((state) => {
                    const newEvents = [...state.events, event];
                    return { events: newEvents };
                }),

            updateEventStatus: (id, status, durationMs) =>
                set((state) => {
                    const newEvents = state.events.map((e) =>
                        e.id === id ? { ...e, status, durationMs } : e
                    );
                    return { events: newEvents };
                }),

            setAgentStatus: (status) => set({ agentStatus: status }),

            clearEvents: () => set({ events: [] }),

            getEventCounts: () => {
                const counts: Record<string, number> = {};
                get().events.forEach((event) => {
                    const type = event.action.type;
                    counts[type] = (counts[type] || 0) + 1;
                });
                return counts;
            },

            createNewSession: () => {
                const newId = `session_${Date.now()}`;
                const newSession: Session = {
                    id: newId,
                    title: 'New Conversation',
                    createdAt: Date.now(),
                    messages: [],
                    events: [],
                };
                set((state) => ({
                    sessions: { ...state.sessions, [newId]: newSession },
                    activeSessionId: newId,
                    events: [],
                    agentStatus: 'idle',
                }));
                return newId;
            },

            switchSession: (sessionId) => {
                const session = get().sessions[sessionId];
                if (session) {
                    set({
                        activeSessionId: sessionId,
                        events: session.events || [],
                        agentStatus: 'idle',
                    });
                }
            },

            deleteSession: (sessionId) => {
                set((state) => {
                    const newSessions = { ...state.sessions };
                    delete newSessions[sessionId];

                    let newActiveId = state.activeSessionId;
                    let newEvents = state.events;

                    if (sessionId === state.activeSessionId) {
                        const remainingIds = Object.keys(newSessions);
                        newActiveId = remainingIds.length > 0 ? remainingIds[0] : null;
                        newEvents = newActiveId ? newSessions[newActiveId].events : [];
                    }

                    return {
                        sessions: newSessions,
                        activeSessionId: newActiveId,
                        events: newEvents
                    };
                });
            },

            syncCurrentSession: (messages) => {
                const { activeSessionId, events, sessions } = get();
                if (!activeSessionId) return;

                const firstUserMsg = messages.find(m => m.role === 'user')?.content;
                const title = firstUserMsg ? (firstUserMsg.length > 30 ? firstUserMsg.slice(0, 30) + '...' : firstUserMsg) : 'New Conversation';

                set({
                    sessions: {
                        ...sessions,
                        [activeSessionId]: {
                            ...sessions[activeSessionId],
                            title,
                            messages,
                            events,
                        },
                    },
                });
            },
        }),
        {
            name: 'agent-sessions-storage',
            partialize: (state) => ({ sessions: state.sessions, activeSessionId: state.activeSessionId }),
        }
    )
);


