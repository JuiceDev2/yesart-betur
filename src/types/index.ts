export type UserRole = "admin" | "artist" | "client";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  bio: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicArtist {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export interface Artwork {
  id: string;
  artist_id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  status: "available" | "sold" | "reserved";
  is_hidden: boolean;
  created_at: string;
  updated_at?: string;
  artist?: PublicArtist | Profile | null;
}

export interface Service {
  id: string;
  artist_id: string;
  title: string;
  description: string | null;
  price_per_hour: number;
  image_url: string | null;
  is_active: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at?: string;
  artist?: PublicArtist | Profile | null;
}

export interface Order {
  id: string;
  client_name: string;
  client_phone: string;
  client_user_id: string | null;
  artwork_id: string | null;
  service_id: string | null;
  artist_id: string;
  status: "pending" | "contacted" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at?: string;
  artwork?: Artwork | null;
  service?: Service | null;
  artist?: Profile | PublicArtist | null;
}

export interface ArtistApplication {
  id: string;
  user_id: string;
  portfolio_url: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note?: string | null;
  created_at: string;
}

export interface GalleryFilters {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  artistId?: string;
  sort?: "recent" | "price_asc" | "price_desc";
  page?: number;
  pageSize?: number;
}
