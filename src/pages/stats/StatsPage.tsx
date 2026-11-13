import { memo, useEffect } from 'react';
import { useFetchTasks, useWorkspace } from '@/store/appStore';

import { Helmet } from "react-helmet-async";
import AnalyticsOverview from '@/pages/stats/AnalyticsOverview';
import FocusHours from '@/pages/stats/FocusHours';
import Statistics from '@/pages/stats/Stats';
import StudyHeatmap from '@/pages/stats/StudyHeatmap';
import SubjectBreakdown from '@/pages/stats/SubjectBreakdown';
import StatsChartsPanel from '@/pages/stats/StatsChartsPanel';
import TaskStudyTimeCard from '@/pages/stats/TaskStudyTimeCard';
import { fetchLaps } from '@/store/LapActions';
import { useAuth } from '@/hooks/useAuth';
import { useLapRealtimeSubscription } from '@/hooks/useLapRealtimeSubscription';
import { useLocation } from 'react-router-dom';

const StatsPage = memo(() => {
  const location = useLocation();
  const isVisible = location.pathname === '/analytics';
  const fetchTasks = useFetchTasks();
  const { user } = useAuth();
  const { currentWorkspace: activeWorkspace } = useWorkspace();

  // Use the real-time subscription hook
  useLapRealtimeSubscription();

  // Refresca tasks y laps solo cuando el usuario esté listo
  useEffect(() => {
    if (user && isVisible) {
      fetchLaps();
      fetchTasks(activeWorkspace?.id, false); // Use cache, don't force refresh
    }
  }, [user, isVisible]); // Remove fetchTasks from dependencies

  // Escuchar eventos de actualización de laps únicamente
  useEffect(() => {
    if (!user) return;
    const handleRefresh = () => {
      fetchLaps();
    };

    window.addEventListener('refreshStats', handleRefresh);

    return () => {
      window.removeEventListener('refreshStats', handleRefresh);
    };
  }, [user]); // Remove fetchTasks from dependencies

  return (
    <>
      <Helmet>
        <title>Study Statistics & Analytics | Veyro</title>
        <meta
          name="description"
          content="Track your study progress with detailed analytics. View study time statistics, productivity charts, and performance insights."
        />
        <meta
          name="keywords"
          content="study statistics, productivity analytics, study time tracking, performance charts, study insights, academic analytics"
        />
        <meta property="og:title" content="Study Statistics & Analytics | Veyro" />
        <meta
          property="og:description"
          content="Track your study progress with detailed analytics. View study time statistics, productivity charts, and performance insights."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://veyro.app/analytics" />
        <link rel="canonical" href="https://veyro.app/analytics" />
      </Helmet>
      <div className="w-full px-4 pb-24 pt-5 sm:px-6 sm:pb-8 sm:pt-6 lg:px-2">
        <div className="stagger-children mx-auto flex w-full max-w-[73rem] flex-col gap-5 2xl:max-w-[92rem]">
          {/* Headline numbers */}
          <AnalyticsOverview />

          {/* Six months at a glance */}
          <StudyHeatmap />

          {/* When and what you study */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <FocusHours />
            <SubjectBreakdown />
          </div>

          {/* Detail: per task, per period charts, and the full numbers */}
          <TaskStudyTimeCard />
          <StatsChartsPanel />
          <Statistics />
        </div>
      </div>
    </>
  );
});

StatsPage.displayName = 'StatsPage';

export default StatsPage; 