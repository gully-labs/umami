'use client';
import { Column } from '@umami/react-zen';
import { useEffect } from 'react';
import { BoardControls } from '@/app/(main)/boards/[boardId]/BoardControls';
import { BoardViewBody } from '@/app/(main)/boards/[boardId]/BoardViewBody';
import { Empty } from '@/components/common/Empty';
import { PageBody } from '@/components/common/PageBody';
import { useBoard, useMessages, useNavigation, useUserWebsitesQuery } from '@/components/hooks';
import { DashboardProvider } from './DashboardProvider';
import { GullyOnboarding } from './GullyOnboarding';
import { GullyWidgetSkeleton } from './GullyWidgetSkeleton';
import { DashboardViewHeader } from './DashboardViewHeader';

function DashboardContent() {
  const { board } = useBoard();
  const { t, messages } = useMessages();
  const rows = board?.parameters?.rows ?? [];
  const hasComponents = rows.some(row => row.columns?.some(column => !!column.component));
  // Gully Analytics: the server binds widgets to the user's own websites; with none, onboard.
  const { data: websites, isLoading } = useUserWebsitesQuery(
    {},
    { includeTeams: 1, pageSize: 1 },
    { enabled: !hasComponents },
  );

  if (!hasComponents) {
    if (isLoading) {
      return <GullyWidgetSkeleton />;
    }

    if (!websites?.count) {
      return <GullyOnboarding />;
    }

    return <Empty message={t(messages.emptyDashboard)} />;
  }

  return <BoardViewBody />;
}

export function DashboardViewPage() {
  const { teamId, router } = useNavigation();

  useEffect(() => {
    if (teamId) {
      router.replace('/dashboard');
    }
  }, [teamId, router]);

  if (teamId) {
    return null;
  }

  return (
    <DashboardProvider>
      <PageBody>
        <Column>
          <DashboardViewHeader />
          <BoardControls />
          <DashboardContent />
        </Column>
      </PageBody>
    </DashboardProvider>
  );
}
