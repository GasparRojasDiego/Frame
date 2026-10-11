import type { UserProfile } from '@/types';
import { SidebarContent } from './SidebarContent';
import { useCourse } from '@/context/CourseContext';
import { cn } from '@/lib/utils';

export default function Sidebar({ userProfile }: { userProfile: UserProfile | null }) {
  const { isSidebarCollapsed } = useCourse();

  return (
    <aside
      className={cn(
        'hidden md:flex md:flex-col border-r transition-[width] duration-300 ease-in-out',
        isSidebarCollapsed ? 'md:w-[68px]' : 'md:w-[250px]'
      )}
    >
      <SidebarContent userProfile={userProfile} collapsed={isSidebarCollapsed} />
    </aside>
  );
}
