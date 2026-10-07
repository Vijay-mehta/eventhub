import { Schema, model } from 'mongoose';

export const CATEGORIES = ['concert', 'workshop', 'conference', 'sports'] as const;
export type Category = (typeof CATEGORIES)[number];

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    date: { type: Date, required: true },
    venue: { type: String, required: true },
    city: { type: String, required: true },
    price: { type: Number, required: true, min: 0 }, // major currency units (INR)
    totalSeats: { type: Number, required: true, min: 1 },
    imageUrl: { type: String },
    // Flexible category-specific fields: concert -> artist, workshop -> speaker, ...
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

/*
 * Index choices (see README):
 *  - text(title, description)  -> keyword search
 *  - {category:1, date:1}      -> the most common listing: filter by category, order by date
 *  - {date:1}                  -> default sort + date range filter
 *  - {price:1}                 -> price filter / sort
 */
eventSchema.index({ title: 'text', description: 'text' }, { weights: { title: 5, description: 1 } });
eventSchema.index({ category: 1, date: 1 });
eventSchema.index({ date: 1 });
eventSchema.index({ price: 1 });

export const EventModel = model('Event', eventSchema);
