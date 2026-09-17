import { GoalDetail } from '@/components/goal-detail';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <GoalDetail id={(await params).id} />;
}
