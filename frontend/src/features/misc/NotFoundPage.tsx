import { FileQuestion } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/States';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Card>
      <EmptyState
        icon={<FileQuestion className="size-6" aria-hidden />}
        title="Page not found"
        description="The page you are looking for does not exist or may have been moved."
        action={<Button onClick={() => navigate('/')}>Back to dashboard</Button>}
      />
    </Card>
  );
}
