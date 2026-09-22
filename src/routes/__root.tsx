import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { StudioProvider } from "@/components/studio-provider";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "StoryForge";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#0e0c0a" },
      { name: "description", content: "StoryForge — organisez, imaginez, dessinez. Donnez forme à vos mondes." },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="fr" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <StudioProvider>
            <Outlet />
          </StudioProvider>
        </AuthProvider>
        <div id="print-root" className="print-root hidden" />
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            className: "font-sans",
            style: { background: "#241c14", color: "#f1e9dc", border: "1px solid #d97b4a" },
          }}
        />
        <Scripts />
      </body>
    </html>
  ),
});