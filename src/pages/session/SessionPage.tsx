import { memo, useEffect } from "react";
import { motion } from "framer-motion";
import { useUi } from "@/store/appStore";

import { Helmet } from "react-helmet-async";
import NoiseGenerator from "@/pages/session/NoiseGenerator";
import ScratchPad from "@/pages/session/ScratchPad";
import UnifiedTimer from "@/pages/session/UnifiedTimer";
import EventCountdown from '@/pages/session/EventCountdown';
import NotificationsPanel from "@/pages/session/NotificationsPanel";

const SessionPage = memo(() => {
  const ui = useUi();
  const isSynced = ui.isSynced;
  const isRunning = ui.isRunning;
  const resetKey = ui.resetKey;



  // --------------------------
  // Sincronización global de timers
  // --------------------------
  useEffect(() => {
    if (!isSynced) return;

    const timestamp = Date.now();

    window.dispatchEvent(
      new CustomEvent("globalTimerSync", {
        detail: { isRunning, resetKey, timestamp },
      })
    );

    if (resetKey > 0) {
      console.warn("[SessionPage] Emitiendo globalResetSync:", {
        resetKey,
        timestamp,
      });
      window.dispatchEvent(
        new CustomEvent("globalResetSync", { detail: { resetKey, timestamp } })
      );

      window.dispatchEvent(
        new CustomEvent("resetCountdownSync", {
          detail: { baseTimestamp: timestamp },
        })
      );
    }
  }, [isSynced, isRunning, resetKey]);

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <>
      <Helmet>
        <title>Focus Timer & Session Tracking | Veyro</title>
        <meta
          name="description"
          content="Free Pomodoro timer and focus session tracker. Track your time across any area, manage breaks, and boost productivity. No ads, no subscriptions."
        />
        <meta
          name="keywords"
          content="pomodoro timer, focus timer, productivity timer, time tracker, focus sessions, break timer, time management, work tracker"
        />
        <meta property="og:title" content="Focus Timer & Session Tracking | Veyro" />
        <meta
          property="og:description"
          content="Free Pomodoro timer and focus session tracker. Track your time across any area, manage breaks, and boost productivity."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://veyro.app/session" />
        <link rel="canonical" href="https://veyro.app/session" />
      </Helmet>
      <div className="w-full session-page px-4 sm:px-6 lg:px-2 pt-5 sm:pt-6 pb-24 sm:pb-8" style={{ fontSize: 'clamp(0.875rem, 0.85rem + 0.15vw, 1rem)' }}>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="w-full max-w-[73rem] 2xl:max-w-[92rem] mx-auto flex flex-col gap-5"
        >
          {/* 1. Timers: the focus of the page */}
          <motion.div variants={item} className="w-full" data-tour="session-timer">
            <UnifiedTimer isSynced={isSynced} isRunning={isRunning} />
          </motion.div>

          {/* 2. What is coming up (left) next to sounds and notes (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* One card, two sections: event countdown (hidden when empty) and deadline notifications */}
            <motion.div variants={item} className="lg:col-span-7 min-w-0 flex flex-col">
              <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] divide-y divide-[var(--border-primary)]">
                <EventCountdown />
                <NotificationsPanel />
              </div>
            </motion.div>
            <div className="lg:col-span-5 min-w-0 flex flex-col gap-5">
              <motion.div variants={item} className="dashboard-noise-card w-full">
                <NoiseGenerator />
              </motion.div>
              {/* Notes fill whatever height the left card needs, so both columns end together */}
              <motion.div variants={item} className="w-full flex-1 flex flex-col [&>*]:flex-1">
                <ScratchPad />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
});

SessionPage.displayName = "SessionPage";

export default SessionPage;
