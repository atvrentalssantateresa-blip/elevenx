import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Inbox } from 'lucide-react';

export default function EmptyState({ message, actionText, link }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Inbox className="w-12 h-12 text-muted-foreground/30 mb-4" />
      <p className="text-muted-foreground text-sm">{message || 'Nothing here yet'}</p>
      {actionText && link && (
        <Link to={link} className="mt-4">
          <Button variant="outline" className="rounded-xl h-9 px-4 text-xs">{actionText}</Button>
        </Link>
      )}
    </div>
  );
}