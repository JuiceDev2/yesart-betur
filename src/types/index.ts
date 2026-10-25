export type UserRole = "admin" | "creator" | "fan";

export interface Profile {
  id: string;
  email: string | null;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  role: UserRole;
  is_active: boolean;
  age_confirmed_at: string | null;
  terms_accepted_at: string | null;
  created_at: string;
}

export interface CreatorSettings {
  user_id: string;
  price_cents: number;
  category: string | null;
  is_nsfw: boolean;
  welcome_message: string | null;
  status: "active" | "suspended";
  suspended_reason: string | null;
}

/** Fila de la vista public_creators. */
export interface PublicCreator {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  price_cents: number;
  category: string | null;
  is_nsfw: boolean;
  created_at: string;
  post_count: number;
  last_post_at: string | null;
}

/** Fila devuelta por la función get_feed. */
export interface FeedPost {
  id: string;
  creator_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  body: string | null;
  teaser: string | null;
  visibility: "free" | "subscribers" | "ppv";
  price_cents: number | null;
  is_nsfw: boolean;
  is_hidden: boolean;
  published_at: string;
  like_count: number;
  comment_count: number;
  locked: boolean;
  liked: boolean;
  image_count: number;
  video_count: number;
}

export interface PostMedia {
  id: string;
  post_id: string;
  path: string;
  kind: "image" | "video";
  position: number;
}

export interface CommentRow {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  body: string;
  created_at: string;
  mine: boolean;
  can_delete: boolean;
}

export interface SubscriptionRow {
  id: string;
  creator_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  status: "active" | "past_due" | "canceled" | "expired";
  price_cents: number;
  provider: string;
  cancel_at_period_end: boolean;
  current_period_end: string;
  created_at: string;
}

export interface Balance {
  earned_cents: number;
  available_cents: number;
  hold_cents: number;
  pending_payout_cents: number;
  paid_out_cents: number;
  min_payout_cents: number;
  currency: string;
}

export interface ConversationRow {
  other_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  last_body: string;
  last_at: string;
  last_from_me: boolean;
  unread: number;
  can_reply: boolean;
}

export interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}
