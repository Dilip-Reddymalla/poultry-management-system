import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useInstallPrompt } from "./useInstallPrompt.js";
import { Button } from "../components/ui.js";
import {
  InstallIcon,
  CheckIcon,
  EggIcon,
} from "../components/icons.js";
import "./InstallPage.css";

export function InstallPage(): React.ReactElement {
  const navigate = useNavigate();
  const { canInstall, isInstalled, platform, install } = useInstallPrompt();
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const [promptUnavailableMessage, setPromptUnavailableMessage] = useState(false);

  async function handleDirectInstall(): Promise<void> {
    setInstalling(true);
    setPromptUnavailableMessage(false);
    try {
      if (canInstall) {
        const accepted = await install();
        if (accepted) {
          setJustInstalled(true);
        }
      } else {
        // Native trigger unavailable: alert user to use the 1-2-3 guide below
        setPromptUnavailableMessage(true);
      }
    } finally {
      setInstalling(false);
    }
  }

  const effectiveInstalled = isInstalled || justInstalled;

  return (
    <div className="install-page">
      <div className="install-card">
        {/* Header Branding */}
        <div className="install-card__brand">
          <div className="install-card__logo-wrapper">
            <EggIcon className="install-card__logo-icon" />
          </div>
          <div className="install-card__title-group">
            <h1 className="install-card__title">
              Poultry<strong>Ops</strong>
            </h1>
            <p className="install-card__subtitle">
              Professional Poultry Management System
            </p>
          </div>
        </div>

        {/* State 1: Already Installed */}
        {effectiveInstalled ? (
          <div className="install-status install-status--success">
            <div className="install-status__icon-circle">
              <CheckIcon className="install-status__icon" />
            </div>
            <h2 className="install-status__heading">App Already Installed!</h2>
            <p className="install-status__desc">
              PoultryOps is running or already installed on your device. You can launch it directly from your home screen or application launcher.
            </p>
            <div className="install-status__actions">
              <Button
                variant="primary"
                onClick={() => {
                  navigate("/dashboard");
                }}
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Primary Action Hero - ALWAYS DISPLAYED */}
            <div className="install-hero">
              <div className="install-hero__meta">
                <span className="install-badge">Progressive Web App</span>
                <span className="install-badge install-badge--ghost">Offline-Ready</span>
                <span className="install-badge install-badge--ghost">Fast &amp; Secure</span>
              </div>

              <div className="install-cta-box">
                <p className="install-cta-box__text">
                  Install PoultryOps directly to your device for an instant full-screen, native application experience.
                </p>

                <Button
                  variant="primary"
                  className="install-button--hero"
                  busy={installing}
                  onClick={() => {
                    void handleDirectInstall();
                  }}
                >
                  <InstallIcon className="button__icon" />
                  <span>
                    {canInstall ? "Install App Now" : "Install App to Home Screen"}
                  </span>
                </Button>

                {promptUnavailableMessage && (
                  <div className="install-alert-banner">
                    💡 Your browser requires manual confirmation: please tap your browser&apos;s menu (or Share icon on iOS) and choose <strong>&quot;Add to Home Screen&quot;</strong> or <strong>&quot;Install App&quot;</strong> as shown in the steps below.
                  </div>
                )}
              </div>
            </div>

            {/* Platform Guides */}
            <div className="install-instructions">
              <h2 className="install-instructions__heading">
                Step-by-Step Installation Guide
              </h2>

              {platform === "ios" && (
                <div className="instruction-card instruction-card--featured">
                  <div className="instruction-card__header">
                    <span className="instruction-card__tag">Apple iOS / Safari</span>
                    <h3>Add to Home Screen in 3 taps</h3>
                  </div>
                  <ol className="instruction-steps">
                    <li className="instruction-step">
                      <div className="instruction-step__num">1</div>
                      <div className="instruction-step__content">
                        <strong>Open in Safari</strong> and tap the <strong>Share button</strong>
                        <span className="instruction-step__inline-icon" title="Share icon">
                          ⎋
                        </span>
                        at the bottom bar of your iPhone or top bar of your iPad.
                      </div>
                    </li>
                    <li className="instruction-step">
                      <div className="instruction-step__num">2</div>
                      <div className="instruction-step__content">
                        Scroll down the menu and tap <strong>Add to Home Screen</strong>
                        <span className="instruction-step__inline-icon" title="Plus icon">
                          ➕
                        </span>.
                      </div>
                    </li>
                    <li className="instruction-step">
                      <div className="instruction-step__num">3</div>
                      <div className="instruction-step__content">
                        Tap <strong>Add</strong> in the top right corner. The PoultryOps icon will appear on your home screen!
                      </div>
                    </li>
                  </ol>
                </div>
              )}

              {platform === "android" && (
                <div className="instruction-card instruction-card--featured">
                  <div className="instruction-card__header">
                    <span className="instruction-card__tag">Android Browser / Chrome</span>
                    <h3>Add to Home Screen via Menu</h3>
                  </div>
                  <ol className="instruction-steps">
                    <li className="instruction-step">
                      <div className="instruction-step__num">1</div>
                      <div className="instruction-step__content">
                        Tap the <strong>three vertical dots (⋮)</strong> or browser menu icon in the top right corner.
                      </div>
                    </li>
                    <li className="instruction-step">
                      <div className="instruction-step__num">2</div>
                      <div className="instruction-step__content">
                        Look for <strong>Install app</strong> or <strong>Add to Home screen</strong> and tap it.
                      </div>
                    </li>
                    <li className="instruction-step">
                      <div className="instruction-step__num">3</div>
                      <div className="instruction-step__content">
                        Confirm when prompted by tapping <strong>Install</strong>.
                      </div>
                    </li>
                  </ol>
                </div>
              )}

              {platform === "desktop" && (
                <div className="instruction-card instruction-card--featured">
                  <div className="instruction-card__header">
                    <span className="instruction-card__tag">Desktop Browser</span>
                    <h3>Install from Browser Address Bar</h3>
                  </div>
                  <ol className="instruction-steps">
                    <li className="instruction-step">
                      <div className="instruction-step__num">1</div>
                      <div className="instruction-step__content">
                        Look at the right end of the address bar at the top of Chrome, Edge, or Brave.
                      </div>
                    </li>
                    <li className="instruction-step">
                      <div className="instruction-step__num">2</div>
                      <div className="instruction-step__content">
                        Click the small <strong>Install App icon (computer with down arrow)</strong>.
                      </div>
                    </li>
                    <li className="instruction-step">
                      <div className="instruction-step__num">3</div>
                      <div className="instruction-step__content">
                        Click <strong>Install</strong> in the dialog box.
                      </div>
                    </li>
                  </ol>
                </div>
              )}

              {/* Show generic fallback if non-targeted */}
              {platform === "other" && (
                <div className="instruction-card">
                  <div className="instruction-card__header">
                    <span className="instruction-card__tag">Universal</span>
                    <h3>Browser Menu Installation</h3>
                  </div>
                  <p className="instruction-card__note">
                    Open your browser&apos;s settings or share menu and choose &quot;Add to Home Screen&quot; or &quot;Install PoultryOps&quot;.
                  </p>
                </div>
              )}
            </div>

            {/* Why Install section */}
            <div className="install-benefits">
              <h2 className="install-benefits__heading">Why Install PoultryOps?</h2>
              <div className="install-benefits__grid">
                <div className="benefit-item">
                  <span className="benefit-item__icon">⚡</span>
                  <div>
                    <h4>Instant Startup</h4>
                    <p>Loads instantly without having to re-type web addresses or search bookmarks.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <span className="benefit-item__icon">📶</span>
                  <div>
                    <h4>Offline Resilience</h4>
                    <p>Browse cached attendance and core operational views even with poor shed connectivity.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <span className="benefit-item__icon">📱</span>
                  <div>
                    <h4>Full-Screen Native Feel</h4>
                    <p>No browser address bar or cluttered tabs—giving full screen space to records and camera tools.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <span className="benefit-item__icon">🔔</span>
                  <div>
                    <h4>Real-time Notifications</h4>
                    <p>Receive immediate alerts regarding attendance approvals, audits, and farm updates.</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="install-footer">
          <Link to="/login" className="install-footer__link">
            Return to Login
          </Link>
          <span className="install-footer__sep">•</span>
          <Link to="/dashboard" className="install-footer__link">
            Go to App
          </Link>
        </div>
      </div>
    </div>
  );
}
export default InstallPage;
