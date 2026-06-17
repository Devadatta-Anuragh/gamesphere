'use client';

import Link from 'next/link';
import { useMatchStatus } from '@/lib/api-hooks';
import { shortId } from '@/lib/format';
import { Card, CardBody } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';

export default function LiveIndexPage() {
  const { data } = useMatchStatus();
  const match = data?.match;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Live Match</h1>
      <Card>
        <CardBody className="space-y-4 text-center">
          {match ? (
            <>
              <p className="text-sm text-muted">
                You have an active match · room{' '}
                <span className="font-mono text-ink">{shortId(match.id)}</span>
              </p>
              <Link href={`/live/${match.id}`}>
                <Button>Enter Match →</Button>
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                No active match. Join a cash table to get paired.
              </p>
              <Link href="/matchmaking">
                <Button variant="ghost">Go to Matchmaking</Button>
              </Link>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
