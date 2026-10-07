import Link from 'next/link';
import { Empty } from '@/components/States';
export default function NotFound() {
  return (
    <Empty title="Page not found" hint="The page or event you are looking for does not exist.">
      <Link href="/" className="btn-primary mt-2">Browse events</Link>
    </Empty>
  );
}
