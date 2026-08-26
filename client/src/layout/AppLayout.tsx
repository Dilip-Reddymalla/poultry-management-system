import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/use-auth.js";
import { MenuIcon, SignOutIcon } from "../components/icons.js";
import { Button } from "../components/ui.js";
import { useToast } from "../components/use-toast.js";
import { initials } from "../lib/display.js";
import { InstallButton } from "../pwa/InstallButton.js";
import { OfflineNotice } from "../pwa/OfflineNotice.js";
import { Sidebar } from "./Sidebar.js";

export function AppLayout(): React.ReactElement {
  const { user, signOut } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut(): Promise<void> {
    setSigningOut(true);

    try {
      await signOut();
      notify("info", "Signed out.");
      navigate("/login", { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className={drawerOpen ? "shell shell--drawer-open" : "shell"}>
      <aside className="shell__sidebar">
        <Sidebar
          onNavigate={() => {
            setDrawerOpen(false);
          }}
        />
      </aside>

      <button
        type="button"
        className="shell__scrim"
        aria-label="Close menu"
        onClick={() => {
          setDrawerOpen(false);
        }}
      />

      <div className="shell__main">
        <header className="topbar">
          <button
            type="button"
            className="topbar__menu"
            onClick={() => {
              setDrawerOpen((open) => !open);
            }}
          >
            <MenuIcon />
            <span className="visually-hidden">Menu</span>
          </button>

          <div className="topbar__spacer" />

          <InstallButton />

          <div className="topbar__user">
            <span className="avatar" aria-hidden="true">
              {initials(user?.employee.name ?? "")}
            </span>
            <span className="topbar__identity">
              <span className="topbar__name">{user?.employee.name}</span>
              <span className="topbar__email">{user?.email}</span>
            </span>
          </div>

          <Button
            variant="ghost"
            onClick={handleSignOut}
            busy={signingOut}
            aria-label="Sign out"
          >
            <SignOutIcon className="button__icon" />
            <span className="button__label">Sign out</span>
          </Button>
        </header>

        <main className="content">
          <OfflineNotice />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
