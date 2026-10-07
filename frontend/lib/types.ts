export type Category = 'concert' | 'workshop' | 'conference' | 'sports';
export const CATEGORIES: Category[] = ['concert', 'workshop', 'conference', 'sports'];

export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: Category;
  date: string;
  venue: string;
  city: string;
  price: number;
  totalSeats: number;
  availableSeats: number;
  imageUrl: string | null;
  details: Record<string, unknown>;
}
export interface Meta { page: number; limit: number; total: number; totalPages: number }
export interface User { id: string; name: string; email: string; role: 'user' | 'admin' }
export interface Booking {
  id: string; eventId: string; eventTitle: string; eventDate: string; quantity: number;
  totalAmount: number; status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
  secondsLeft: number | null; canCancel: boolean; createdAt: string;
}
