"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface VncViewerProps {
    streamUrl: string | null;
    isInitializing: boolean;
    refreshDesktop: () => void;
}

export const VncViewer = React.memo(({ streamUrl, isInitializing, refreshDesktop }: VncViewerProps) => {
    // console.log("Renderizando VNC Viewer"); // I need see if this component is re-rendering

    return (
        <div className="w-full h-full bg-black relative flex items-center justify-center">
            {streamUrl ? (
                <>
                    <iframe
                        src={streamUrl}
                        className="w-full h-full"
                        style={{
                            transformOrigin: "center",
                            width: "100%",
                            height: "100%",
                            border: "none"
                        }}
                        allow="autoplay"
                        title="Desktop VNC Viewer"
                    />
                    <Button
                        onClick={refreshDesktop}
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white px-3 py-1 rounded text-sm z-10"
                        disabled={isInitializing}
                    >
                        {isInitializing ? "Creating desktop..." : "New desktop"}
                    </Button>
                </>
            ) : (
                <div className="flex items-center justify-center h-full text-white">
                    {isInitializing ? "Initializing desktop..." : "Loading stream..."}
                </div>
            )}
        </div>
    );
});

VncViewer.displayName = "VncViewer";