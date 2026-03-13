"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#1a2e1a",
            color: "#fff",
            border: "1px solid #16a34a",
          },
        }}
      />
    </SessionProvider>
  );
}
