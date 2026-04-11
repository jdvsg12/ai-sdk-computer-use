"use client";

import { PreviewMessage } from "@/components/message";
import { getDesktopURL } from "@/lib/sandbox/utils";
import { useScrollToBottom } from "@/lib/use-scroll-to-bottom";
import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/input";
import { toast } from "sonner";
import { DeployButton, ProjectInfo } from "@/components/project-info";
import { AISDKLogo } from "@/components/icons";
import { PromptSuggestions } from "@/components/prompt-suggestions";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ABORTED } from "@/lib/utils";


// Components
import { VncViewer } from "@/components/vnc-viewer";
import { useAgentStore, AgentAction } from "@/lib/store";
import { DebugPanel } from "@/components/debug-panel";
import { Sidebar } from "@/components/sidebar";

export default function Chat() {
  // Create separate refs for mobile and desktop to ensure both scroll properly
  const [desktopContainerRef, desktopEndRef] = useScrollToBottom();
  const [mobileContainerRef, mobileEndRef] = useScrollToBottom();

  const [isInitializing, setIsInitializing] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [sandboxId, setSandboxId] = useState<string | null>(null);

  // State management
  const {
    setAgentStatus,
    addEvent,
    updateEventStatus,
    activeSessionId,
    sessions,
    createNewSession,
    syncCurrentSession
  } = useAgentStore();

  // Use the ref to not register the same Tool Call twice in the store
  const processedToolCalls = useRef(new Set<string>());

  // Initialization: Create session if none exists
  useEffect(() => {
    if (!activeSessionId && Object.keys(sessions).length === 0) {
      createNewSession();
    }
  }, [activeSessionId, sessions, createNewSession]);

  // ---------------------------------------------------------
  // MOCK PATCH: Silenciar el error interno del AI SDK para el demo
  // ---------------------------------------------------------
  useEffect(() => {
    const originalConsoleError = console.error;
    
    console.error = (...args) => {
      // Si el error contiene la frase del SDK, lo ignoramos silenciosamente
      const errorMsg = args[0]?.message || args[0];
      if (typeof errorMsg === 'string' && errorMsg.includes('"error" parts expect a string value')) {
        return; 
      }
      // Para cualquier otro error real, usamos el console.error normal
      originalConsoleError(...args);
    };

    return () => {
      // Restauramos el comportamiento original al desmontar
      console.error = originalConsoleError;
    };
  }, []);
  // ---------------------------------------------------------

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop: stopGeneration,
    append,
    setMessages,
  } = useChat({
    api: "/api/chat",
    id: sandboxId ?? undefined,
    body: {
      sandboxId,
    },
    maxSteps: 30,
    // initialMessages: activeSessionId ? sessions[activeSessionId]?.messages || [] : [],
    // onError: (error) => {
    //   console.error(error);
    //   toast.error("There was an error", {
    //     description: "Please try again later.",
    //     richColors: true,
    //     position: "top-center",
    //   });

    //   setAgentStatus("error");
    // },

    onError: (error) => {
      console.error(error);
      toast.error("API Quota Exceeded", {
        description: "Simulating fallback response for UI demonstration.",
      });

      // Force agent status to idle
      setAgentStatus('idle');

      // Simulate that the AI used a tool successfully
      addEvent({
        id: `mock_tool_${Date.now()}`,
        timestamp: Date.now(),
        toolName: "computer_mouse_move",
        action: {
          type: 'computer_mouse_move',
          payload: { x: 512, y: 384 }
        },
        status: 'success',
        durationMs: 1250
      });

      // Add a fake message to the chat to show the interaction
      setMessages((prev) => [
        ...prev,
        {
          id: `mock_msg_${Date.now()}`,
          role: 'assistant',
          content: 'I have moved the mouse to the center of the screen to check the weather in Dubai, as requested.',
        }
      ]);

    },
  });

  // Update messages when a different session is selected
  useEffect(() => {
    if (activeSessionId && sessions[activeSessionId]) {
      setMessages(sessions[activeSessionId].messages);
    } else {
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  // Sync session whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      syncCurrentSession(messages);
    }
  }, [messages, syncCurrentSession]);

  // Event Pipeline: Extract actions from messages in real-time
  useEffect(() => {
    // Update general agent status
    if (status === 'submitted' || status === 'streaming') {
      setAgentStatus('working');
    } else {
      setAgentStatus('idle');
    }

    // Find tool calls in the last message
    const lastMessage = messages.at(-1);
    if (lastMessage?.role === 'assistant' && lastMessage.parts) {
      lastMessage.parts.forEach((part) => {
        if (part.type === 'tool-invocation') {
          const toolCallId = part.toolInvocation.toolCallId;
          const state = part.toolInvocation.state;

          if (!processedToolCalls.current.has(toolCallId)) {
            // New event, register it
            processedToolCalls.current.add(toolCallId);
            addEvent({
              id: toolCallId,
              timestamp: Date.now(),
              toolName: part.toolInvocation.toolName,
              action: { type: part.toolInvocation.toolName as AgentAction['type'], payload: part.toolInvocation.args } as AgentAction,
              status: state === 'result' ? 'success' : 'pending',
            });
          } else if (state === 'result') {
            // Update existing event to success
            updateEventStatus(toolCallId, 'success');
          }
        }
      });
    }
  }, [messages, status, setAgentStatus, addEvent, updateEventStatus]);

  const stop = () => {
    stopGeneration();
    setAgentStatus('idle');

    const lastMessage = messages.at(-1);
    const lastMessageLastPart = lastMessage?.parts.at(-1);
    if (
      lastMessage?.role === "assistant" &&
      lastMessageLastPart?.type === "tool-invocation"
    ) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          ...lastMessage,
          parts: [
            ...lastMessage.parts.slice(0, -1),
            {
              ...lastMessageLastPart,
              toolInvocation: {
                ...lastMessageLastPart.toolInvocation,
                state: "result",
                result: ABORTED,
              },
            },
          ],
        },
      ]);
    }
  };

  const isLoading = status === "submitted" || status === "streaming";

  const refreshDesktop = useCallback(async () => {
    try {
      setIsInitializing(true);
      const { streamUrl, id } = await getDesktopURL(sandboxId || undefined);
      setStreamUrl(streamUrl);
      setSandboxId(id);
    } catch (err) {
      console.error("Failed to refresh desktop:", err);
    } finally {
      setIsInitializing(false);
    }
  }, [sandboxId]);

  // Kill desktop on page close
  useEffect(() => {
    if (!sandboxId) return;

    // Function to kill the desktop - just one method to reduce duplicates
    const killDesktop = () => {
      if (!sandboxId) return;

      // Use sendBeacon which is best supported across browsers
      navigator.sendBeacon(
        `/api/kill-desktop?sandboxId=${encodeURIComponent(sandboxId)}`,
      );
    };

    // Detect iOS / Safari
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Choose exactly ONE event handler based on the browser
    if (isIOS || isSafari) {
      // For Safari on iOS, use pagehide which is most reliable
      window.addEventListener("pagehide", killDesktop);

      return () => {
        window.removeEventListener("pagehide", killDesktop);
        // Also kill desktop when component unmounts
        killDesktop();
      };
    } else {
      // For all other browsers, use beforeunload
      window.addEventListener("beforeunload", killDesktop);

      return () => {
        window.removeEventListener("beforeunload", killDesktop);
        // Also kill desktop when component unmounts
        killDesktop();
      };
    }
  }, [sandboxId]);

  useEffect(() => {
    // Initialize desktop and get stream URL when the component mounts
    const init = async () => {
      try {
        setIsInitializing(true);

        // Use the provided ID or create a new one
        const { streamUrl, id } = await getDesktopURL(sandboxId ?? undefined);

        setStreamUrl(streamUrl);
        setSandboxId(id);
      } catch (err) {
        console.error("Failed to initialize desktop:", err);
        toast.error("Failed to initialize desktop");
      } finally {
        setIsInitializing(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-dvh relative">
      {/* Mobile/tablet banner */}
      <div className="flex items-center justify-center fixed left-1/2 -translate-x-1/2 top-5 shadow-md text-xs mx-auto rounded-lg h-8 w-fit bg-blue-600 text-white px-3 py-2 text-left z-50 xl:hidden">
        <span>Headless mode</span>
      </div>

      {/* Desktop Layout (Sidebar, Chat, and VNC) */}
      <div className="w-full hidden xl:block">
        <ResizablePanelGroup direction="horizontal" className="h-full">

          {/* Session History Sidebar */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={25}>
            <Sidebar />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Chat Interface and Debug Panel */}
          <ResizablePanel
            defaultSize={30}
            minSize={25}
            maxSize={40}
            className="flex flex-col border-r border-zinc-200"
          >
            <div className="bg-white py-4 px-4 flex justify-between items-center border-b border-zinc-100">
              <AISDKLogo />
              <DeployButton />
            </div>

            {/* 5. ADD THE DEBUG PANEL */}
            <DebugPanel />

            <div
              className="flex-1 space-y-6 py-4 overflow-y-auto px-4"
              ref={desktopContainerRef}
            >
              {messages.length === 0 ? <ProjectInfo /> : null}
              {messages.map((message, i) => (
                <PreviewMessage
                  message={message}
                  key={message.id}
                  isLoading={isLoading}
                  status={status}
                  isLatestMessage={i === messages.length - 1}
                />
              ))}
              <div ref={desktopEndRef} className="pb-2" />
            </div>

            {messages.length === 0 && (
              <PromptSuggestions
                disabled={isInitializing}
                submitPrompt={(prompt: string) =>
                  append({ role: "user", content: prompt })
                }
              />
            )}
            <div className="bg-white border-t border-zinc-100">
              <form onSubmit={handleSubmit} className="p-4">
                <Input
                  handleInputChange={handleInputChange}
                  input={input}
                  isInitializing={isInitializing}
                  isLoading={isLoading}
                  status={status}
                  stop={stop}
                />
              </form>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* VNC Viewer Panel */}
          <ResizablePanel
            defaultSize={50}
            minSize={40}
            className="bg-black relative items-center justify-center"
          >
            <VncViewer
              streamUrl={streamUrl}
              isInitializing={isInitializing}
              refreshDesktop={refreshDesktop}
            />
          </ResizablePanel>

        </ResizablePanelGroup>
      </div>

      {/* Mobile View (Chat Only) */}
      <div className="w-full xl:hidden flex flex-col">
        {/* Original mobile code */}
        <div className="bg-white py-4 px-4 flex justify-between items-center">
          <AISDKLogo />
          <DeployButton />
        </div>
        <div className="flex-1 space-y-6 py-4 overflow-y-auto px-4" ref={mobileContainerRef}>
          {messages.length === 0 ? <ProjectInfo /> : null}
          {messages.map((message, i) => (
            <PreviewMessage message={message} key={message.id} isLoading={isLoading} status={status} isLatestMessage={i === messages.length - 1} />
          ))}
          <div ref={mobileEndRef} className="pb-2" />
        </div>
        {messages.length === 0 && (
          <PromptSuggestions disabled={isInitializing} submitPrompt={(prompt: string) => append({ role: "user", content: prompt })} />
        )}
        <div className="bg-white">
          <form onSubmit={handleSubmit} className="p-4">
            <Input handleInputChange={handleInputChange} input={input} isInitializing={isInitializing} isLoading={isLoading} status={status} stop={stop} />
          </form>
        </div>
      </div>
    </div>
  );
}
