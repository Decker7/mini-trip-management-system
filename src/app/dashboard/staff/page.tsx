import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Dashboard: Manage Staff'
};

export default function StaffPage() {
  return (
    <PageContainer>
      <div className='space-y-6'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Manage Staff</h1>
          <p className='text-muted-foreground'>Admin-only. Invite Staff and manage roles here.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Coming soon</CardTitle>
            <CardDescription>
              User listing, role assignment, and Clerk invitations land in a later ticket.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </PageContainer>
  );
}
