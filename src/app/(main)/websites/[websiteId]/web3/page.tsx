import type { Metadata } from 'next';
import { Web3Page } from './Web3Page';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <Web3Page websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Web3',
};
